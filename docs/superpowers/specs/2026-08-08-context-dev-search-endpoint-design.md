# Context.dev Search Endpoint — Design

## Purpose

Add a backend API endpoint that searches the web via the [Context.dev](https://docs.context.dev/) `/v1/web/search` API. This is a new component alongside the existing PDF-parsing pipeline (`scripts/`) — it does not touch or depend on that pipeline. `CONTEXT_DEV_API_KEY` is already present in `.env` (git-ignored, per the existing `.gitignore`).

This spec covers two layers, built in order:

1. **`GET /search`** — a generic, unauthenticated search endpoint (original design below). No domain filtering, no integration with Mizan.
2. **Mizan web-search fallback** (see [Extension](#extension-mizan-web-search-fallback) below) — a second, authenticated, domain-locked route that Mizan (the ElevenLabs voice agent defined by the root `config.py`/`prompts.py`/`setup_agent.py`) calls as a tool, only when its Dubai Building Code reference material has no answer. It reuses the `search_web()` service from layer 1 rather than duplicating search logic.

## Architecture

A minimal FastAPI app with one route, backed by a thin service wrapper around the official `context.dev` Python SDK. Dependency management via `uv`, matching the stack used on the Mufty Assistant backend. No database, no auth on `GET /search` itself — a straightforward search passthrough. (The Extension below adds a second, authenticated route to the same app — see [Extension](#extension-mizan-web-search-fallback).)

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
  Calls `client.web.search(query=query, num_results=num_results)` (Python SDK uses snake_case params) — markdown scraping (`markdown_options`) left off, since the endpoint returns lightweight results only. Maps each item in the response's `results[]` (a list of pydantic `Result` objects with `.url`, `.title`, `.description`, `.relevance` attributes) into our own `SearchResult` schema.
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

## Out of Scope (for `GET /search`)

- Full page content / Markdown scraping of results (can be added later as an opt-in parameter if a RAG use case needs it).
- Advanced filters (`freshness`, `excludeDomains`, `country`) — not exposed on this route. (`includeDomains` is exposed, but only through the separate, authenticated route below — never as a caller-supplied parameter on the public `/search` route.)
- Docker/CI scaffolding for `GET /search` itself — not requested; only the app code and dependency manifest are in scope. (The Extension below does add Docker wiring, since it must be reachable by ElevenLabs.)

---

## Extension: Mizan Web-Search Fallback

### Purpose

Mizan (`prompts.py`) answers strictly from the Dubai Building Code reference material and is instructed to defer, not guess, when the reference material has nothing on a topic. This extension gives Mizan an escape hatch for that deferral case: a tool it can call, restricted to an allowlist of authority websites, so it can say "that's not in the DBC, but per \[site\]..." instead of just deferring. It must never be usable as a general-purpose, unrestricted web search — every request through this route is forced onto the configured domain allowlist server-side, regardless of what the caller sends.

### Architecture

```
Mizan (ElevenLabs agent) ──[DBC reference material, in-prompt]
        │
        │ only when the reference material has no answer
        ▼
ElevenLabs webhook tool call (server tool, registered by setup_agent.py)
        │  POST, shared-secret header
        ▼
POST /tools/search-authority-sites   (app/routers/authority_search.py)
        │  validates X-Mizan-Webhook-Secret, then calls the SAME
        │  search_web() from app/services/context_search.py (layer 1),
        │  passing include_domains fixed from server-side config —
        │  never from the request body.
        ▼
Context.dev  POST /web/search  (includeDomains: [<allowlist>])
```

### Components

- **`app/services/context_search.py`** (extended, not replaced): `search_web()` gains an optional `include_domains: list[str] | None = None` parameter, forwarded to the SDK call only when provided. `GET /search` continues to call it with no domains (unchanged behavior, no regression to the existing tests). Confirm the SDK's actual parameter name (`include_domains`, mirroring `query`/`num_results`) against the installed `context.dev` package before relying on it — the REST field is `includeDomains`, but the Python SDK may spell it differently.
- **`app/config.py`** (extended): two new required settings, following the existing fail-fast-at-startup pattern —
  - `mizan_webhook_secret: str` — shared secret Mizan's webhook calls must present.
  - `authority_search_allowed_domains: list[str]` — parsed from a comma-separated env var (`AUTHORITY_SEARCH_ALLOWED_DOMAINS`). No default; must be set explicitly.
- **`app/routers/authority_search.py`** (new): `POST /tools/search-authority-sites`, body `{"query": "..."}`.
  - A FastAPI dependency checks the `X-Mizan-Webhook-Secret` header against `settings.mizan_webhook_secret`; mismatch or missing → 401.
  - Calls `search_web(query, include_domains=settings.authority_search_allowed_domains)`.
  - Returns the same `SearchResponse` shape as `/search` (no need for a bespoke response schema) — empty `results` list is a valid 200, not an error; Mizan's prompt handles "nothing found" phrasing.
  - Reuses the same error mapping as `/search` (429 on rate limit, 502 on upstream/auth failure).
- **`setup_agent.py`** (extended): registers the webhook tool via `client.conversational_ai.tools.create(...)` — name/description telling the LLM to call it *only* when the DBC reference material has no answer; `api_schema.url` pointing at the deployed `/tools/search-authority-sites` endpoint; `request_headers` referencing an ElevenLabs workspace secret (holding the same value as `MIZAN_WEBHOOK_SECRET`) for the `X-Mizan-Webhook-Secret` header; `request_body_schema` requiring `query: string`. The returned tool ID is attached to the agent via `conversation_config.agent.prompt.tool_ids`.
- **Root `config.py`** (extended): `AUTHORITY_SEARCH_URL` — the public base URL of the deployed `app/` service, used by `setup_agent.py` when registering the tool. (Local testing needs a public tunnel, e.g. `ngrok`, since ElevenLabs must reach this URL — noted here, not designed further; that's an operational step, not a code component.)
- **`prompts.py`** (extended): a new rule in `AGENT_PERSONA_PROMPT`, ordered after "defer instead of bluffing" — when the reference material has nothing, Mizan may use the search tool and must phrase the result as explicitly web-sourced (e.g. "That's not in the DBC reference I have — but per \[site\], ..."), never in the DBC citation style ("per Table B.1", "under B.4.2.2"). Scope stays otherwise unchanged: firm agreements/contracts remain out of scope entirely, not searched.
- **`Dockerfile` / `docker-compose.yml`** (extended): the existing Dockerfile is built for the agent-setup scripts and legacy `index.html` UI (port 8000). Add the `app/` FastAPI service as a second target/service (its own port, e.g. 8080) so it can run alongside or independently, using the same `uv`-managed dependencies.

### Data Flow

`POST /tools/search-authority-sites` `{"query": "coverage percentage for residential plots"}`, header `X-Mizan-Webhook-Secret: <secret>`
→ dependency validates the secret → 401 if wrong/missing
→ calls `search_web(query, include_domains=settings.authority_search_allowed_domains)`
→ Context.dev call scoped to the allowlist only
→ returns `SearchResponse{query, results}` (possibly `results: []`) as JSON, same shape as `/search`.

### Error Handling

Same mapping as `/search` (429 rate limit, 502 upstream/auth failure, generic error messages — never the raw API key or verbatim upstream body). Additionally: missing/incorrect webhook secret → 401, checked before any Context.dev call is made (no wasted credits on unauthorized requests).

### Security

- `include_domains` is never accepted from the request body — always injected server-side from `settings.authority_search_allowed_domains`, so a compromised or malicious tool call cannot widen the search beyond the allowlist.
- `MIZAN_WEBHOOK_SECRET` is a separate secret from `CONTEXT_DEV_API_KEY` and from ElevenLabs' own API key — scoped only to authenticating inbound calls to this one route.

### Domain Allowlist

Configured via `AUTHORITY_SEARCH_ALLOWED_DOMAINS`, not hardcoded — the user is responsible for populating it with real Dubai regulatory/authority sites (e.g. Dubai Municipality) before relying on this in a real meeting; an unreviewed placeholder domain must not ship silently.

### Testing

- `search_web()`: new test covering `include_domains` being forwarded to the SDK call when provided, and omitted (unchanged) when not — extends the existing mocked-client test style, no real network calls.
- New router tests for `/tools/search-authority-sites`: 401 without/with-wrong secret (and `search_web` never called in that case), 200 with correct secret verifying `include_domains` was passed through from config (not from the request body, even if the request tries to include one), and the same rate-limit/upstream-error → 429/502 mapping as `/search`.
- No test coverage for the ElevenLabs tool registration itself or the live voice conversation — that's exercised manually against a real (or sandboxed) agent, not unit-testable.

### Out of Scope (for this Extension)

- Choosing/provisioning where `app/` is hosted in production (Fly.io, Render, etc.) — a deployment decision, not part of this design.
- Automating creation of the ElevenLabs workspace secret via API — can be done once via the dashboard; `setup_agent.py` only references its `secret_id`.
- Full-page Markdown scraping of authority-site results (same as layer 1 — snippets only, for voice-conversation latency).
