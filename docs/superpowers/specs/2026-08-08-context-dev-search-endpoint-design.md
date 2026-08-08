# Context.dev Search Endpoint — Design

## Purpose

Add a backend API endpoint that searches the web via the [Context.dev](https://docs.context.dev/) `/v1/web/search` API. This is a new component alongside the existing PDF-parsing pipeline (`scripts/`) — it does not touch or depend on that pipeline. `CONTEXT_DEV_API_KEY` is already present in `.env` (git-ignored, per the existing `.gitignore`).

## Architecture

A minimal FastAPI app with one route, backed by a thin service wrapper around the official `context.dev` Python SDK. Dependency management via `uv`, matching the stack used on the Mufty Assistant backend. No database, no auth on the endpoint itself — a straightforward search passthrough.

```
AI-Twin/
├── pyproject.toml
├── .env                      (existing — CONTEXT_DEV_API_KEY)
└── app/
    ├── main.py                # FastAPI() instance, includes router
    ├── config.py              # Settings (reads CONTEXT_DEV_API_KEY)
    ├── schemas.py             # SearchResult, SearchResponse (Pydantic)
    ├── routers/
    │   └── search.py          # GET /search
    └── services/
        └── context_search.py  # search_web(query, num_results) -> list[SearchResult]
```

## Components

- **`config.py`**: `pydantic-settings` `Settings` class loading `context_dev_api_key` from `.env` (env var `CONTEXT_DEV_API_KEY`). Fails fast at app startup if the key is missing — not deferred to request time.
- **`services/context_search.py`**: constructs a module-level `ContextDev` client singleton (built from `config.Settings` at import time) and exposes:
  ```python
  def search_web(query: str, num_results: int = 10) -> list[SearchResult]
  ```
  Calls `client.web.search(query=query, numResults=num_results)` — markdown scraping (`markdownOptions.enabled`) left off, since the endpoint returns lightweight results only. Maps each item in the response's `results[]` into a `SearchResult` (`url`, `title`, `description`, `relevance`).
- **`routers/search.py`**: `GET /search?q=...&num_results=10` — validates input, delegates to the service, returns a `SearchResponse`.
- **`schemas.py`**:
  - `SearchResult`: `url: str`, `title: str`, `description: str`, `relevance: Literal["high", "medium", "low"]`
  - `SearchResponse`: `query: str`, `results: list[SearchResult]`
- **`main.py`**: creates the `FastAPI()` app, includes the search router.

## Data Flow

`GET /search?q=foo&num_results=10`
→ router validates `q` (non-empty, required) and `num_results` (integer, 10–100, default 10 — matching Context.dev's own accepted range)
→ service calls Context.dev's `/v1/web/search` via the SDK
→ maps `results[]` into `SearchResult` objects
→ router returns `SearchResponse{query, results}` as JSON.

## Error Handling

- **Missing/invalid API key**: surfaces at app startup via `Settings` validation, not per-request.
- **Context.dev API errors** (auth failure, rate limit, timeout, upstream 5xx): caught in the service layer and re-raised as an `HTTPException`:
  - 502 for upstream/auth/unexpected failures
  - 429 if Context.dev signals rate-limiting
  - Error messages returned to the caller are generic — never include the raw API key or the verbatim upstream error body.
- **Bad input** (empty `q`, `num_results` outside 10–100): handled by FastAPI/Pydantic request validation → automatic 422.

## Testing

- Unit tests for `services/context_search.py` with the `ContextDev` client mocked (no real network calls, no credit spend). Cover: mapping a normal response, mapping an empty `results[]`, and the client raising an error.
- Router tests using FastAPI's `TestClient` with the service mocked. Cover: happy path (200 with results), the service raising an upstream error → verify it becomes a 502, and validation errors (missing `q`, out-of-range `num_results`) → verify 422.

## Out of Scope

- Full page content / Markdown scraping of results (can be added later as an opt-in parameter if a RAG use case needs it).
- Advanced filters (`freshness`, `includeDomains`/`excludeDomains`, `country`) — not exposed on this endpoint for now.
- Docker/CI scaffolding — not requested; only the app code and dependency manifest are in scope.
- Any integration with the existing PDF-parsing pipeline or Dubai Building Code data.
