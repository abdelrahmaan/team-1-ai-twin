# Context.dev Search Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `GET /search` FastAPI endpoint that searches the web via the Context.dev `/v1/web/search` API and returns lightweight results (url, title, description, relevance) — then extend it with a second, authenticated, domain-locked route that Mizan (the ElevenLabs voice agent in this repo) calls as a fallback tool when its Dubai Building Code reference material has no answer.

**Architecture:** A small `app/` package: `config.py` (settings), `schemas.py` (Pydantic response models), `services/context_search.py` (wraps the `context.dev` SDK), `routers/search.py` (the generic route), `routers/authority_search.py` (the Mizan-facing, secret-gated, domain-locked route), `main.py` (FastAPI app). Both routers share the same `search_web()` service function. `setup_agent.py` registers the authority-search route as an ElevenLabs webhook tool and attaches it to the agent; `prompts.py` gets a new persona rule governing when Mizan may use it. Dependencies managed with `uv`.

**Tech Stack:** Python 3.11+, FastAPI, `context.dev` SDK (PyPI package `context.dev`, distribution name `context-dev`, version 2.9.0 confirmed), `pydantic-settings`, `uv`, `pytest`, `elevenlabs` SDK (already a dependency, version constraint `>=1.50.0` per `pyproject.toml`; tool-registration code confirmed against the installed `1.x` API surface).

## Global Constraints

- Python >= 3.11.
- All dependency management goes through `uv` (`uv add`, `uv run`) — no manual `pip install`.
- `CONTEXT_DEV_API_KEY` is read only from the environment/`.env` (already present and git-ignored) — never hardcoded, never included in a response body or log line. Same rule applies to the new `MIZAN_WEBHOOK_SECRET`.
- `num_results` is constrained to 10–100 (Context.dev's own accepted range), default 10.
- `GET /search` response shape stays lightweight only: `url`, `title`, `description`, `relevance` per result. No Markdown/full-page scraping, no `freshness`/`excludeDomains`/`country` filters — out of scope for that route. (`include_domains` is exposed only through the authority-search route, Task 7, never as a caller-supplied parameter.)
- No Docker/CI scaffolding for `GET /search` itself — out of scope. (Task 8 does add Docker wiring for the authority-search route, since ElevenLabs must be able to reach it.)
- `include_domains` for the authority-search route is always injected server-side from `settings.authority_search_allowed_domains` — never accepted from the request body.
- Spec: `docs/superpowers/specs/2026-08-08-context-dev-search-endpoint-design.md`.

---

## Task 1: Project scaffolding & settings

**Files:**
- Create: `pyproject.toml`
- Create: `.python-version`
- Create: `app/__init__.py`
- Create: `app/config.py`
- Test: `tests/test_config.py`

**Interfaces:**
- Produces: `app.config.Settings` (pydantic-settings `BaseSettings` subclass with field `context_dev_api_key: str`), and `app.config.settings` (a module-level `Settings()` instance, built at import time).

- [ ] **Step 1: Scaffold the uv project**

Run from the repo root:

```bash
uv init --app --no-readme --vcs none --name ai-twin-search --python 3.11
```

Expected: creates `pyproject.toml`, `.python-version`, and a placeholder `main.py` at the repo root.

- [ ] **Step 2: Remove the generated placeholder `main.py`**

```bash
rm main.py
```

(The real app entrypoint will be `app/main.py`, created in Task 4.)

- [ ] **Step 3: Add runtime and dev dependencies**

```bash
uv add fastapi "uvicorn[standard]" context.dev pydantic-settings
uv add --dev pytest httpx2
```

Expected: `pyproject.toml` gains a `dependencies` list (fastapi, uvicorn, context-dev, pydantic-settings) and a `[dependency-groups] dev` list (pytest, httpx2). `uv.lock` is created/updated.

- [ ] **Step 4: Configure pytest to resolve `app.*` imports**

Edit `pyproject.toml`, adding this section:

```toml
[tool.pytest.ini_options]
pythonpath = ["."]
```

- [ ] **Step 5: Create the `app` package**

```bash
mkdir -p app
touch app/__init__.py
```

- [ ] **Step 6: Write the failing test**

Create `tests/test_config.py`:

```python
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_loads_api_key_from_env(monkeypatch):
    monkeypatch.setenv("CONTEXT_DEV_API_KEY", "ctxt_secret_test123")

    settings = Settings(_env_file=None)

    assert settings.context_dev_api_key == "ctxt_secret_test123"


def test_settings_raises_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("CONTEXT_DEV_API_KEY", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `uv run pytest tests/test_config.py -v`
Expected: FAIL/ERROR — `ModuleNotFoundError: No module named 'app.config'`

- [ ] **Step 8: Implement `app/config.py`**

```python
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    context_dev_api_key: str


settings = Settings()
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `uv run pytest tests/test_config.py -v`
Expected: 2 passed

- [ ] **Step 10: Commit**

```bash
git add pyproject.toml uv.lock .python-version app/__init__.py app/config.py tests/test_config.py
git commit -m "Add uv project scaffolding and Context.dev settings"
```

---

## Task 2: Response schemas

**Files:**
- Create: `app/schemas.py`
- Test: `tests/test_schemas.py`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `app.schemas.SearchResult(url: str, title: str, description: str, relevance: Literal["high", "medium", "low"])` and `app.schemas.SearchResponse(query: str, results: list[SearchResult])`.

- [ ] **Step 1: Write the failing test**

Create `tests/test_schemas.py`:

```python
import pytest
from pydantic import ValidationError

from app.schemas import SearchResponse, SearchResult


def test_search_result_accepts_valid_data():
    result = SearchResult(
        url="https://example.com",
        title="Example",
        description="An example page",
        relevance="high",
    )

    assert result.url == "https://example.com"
    assert result.relevance == "high"


def test_search_result_rejects_invalid_relevance():
    with pytest.raises(ValidationError):
        SearchResult(
            url="https://example.com",
            title="Example",
            description="An example page",
            relevance="extreme",
        )


def test_search_response_holds_list_of_results():
    response = SearchResponse(
        query="dubai building code",
        results=[
            SearchResult(
                url="https://example.com",
                title="Example",
                description="An example page",
                relevance="medium",
            )
        ],
    )

    assert response.query == "dubai building code"
    assert len(response.results) == 1
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `uv run pytest tests/test_schemas.py -v`
Expected: FAIL/ERROR — `ModuleNotFoundError: No module named 'app.schemas'`

- [ ] **Step 3: Implement `app/schemas.py`**

```python
from typing import Literal

from pydantic import BaseModel


class SearchResult(BaseModel):
    url: str
    title: str
    description: str
    relevance: Literal["high", "medium", "low"]


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResult]
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `uv run pytest tests/test_schemas.py -v`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add app/schemas.py tests/test_schemas.py
git commit -m "Add SearchResult/SearchResponse schemas"
```

---

## Task 3: Context.dev search service

**Files:**
- Create: `app/services/__init__.py`
- Create: `app/services/context_search.py`
- Test: `tests/test_context_search.py`

**Interfaces:**
- Consumes: `app.config.settings.context_dev_api_key` (Task 1), `app.schemas.SearchResult` (Task 2).
- Produces: `app.services.context_search.client` (module-level `ContextDev` instance — tests patch this attribute directly), and `app.services.context_search.search_web(query: str, num_results: int = 10) -> list[SearchResult]`. On an upstream error, `search_web` lets the `context.dev` SDK's exception propagate unchanged (it does not catch or wrap errors — that's the router's job in Task 4).

- [ ] **Step 1: Create the `services` package**

```bash
mkdir -p app/services
touch app/services/__init__.py
```

- [ ] **Step 2: Write the failing tests**

Create `tests/test_context_search.py`:

```python
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from context.dev import RateLimitError

from app.services import context_search


def _fake_result(url="https://example.com", title="Example", description="desc", relevance="high"):
    return SimpleNamespace(url=url, title=title, description=description, relevance=relevance)


def test_search_web_maps_results(monkeypatch):
    fake_response = SimpleNamespace(
        query="dubai building code",
        results=[_fake_result()],
        key_metadata=None,
    )
    mock_client = MagicMock()
    mock_client.web.search.return_value = fake_response
    monkeypatch.setattr(context_search, "client", mock_client)

    results = context_search.search_web("dubai building code", num_results=10)

    assert len(results) == 1
    assert results[0].url == "https://example.com"
    assert results[0].relevance == "high"
    mock_client.web.search.assert_called_once_with(query="dubai building code", num_results=10)


def test_search_web_returns_empty_list_when_no_results(monkeypatch):
    fake_response = SimpleNamespace(query="obscure query", results=[], key_metadata=None)
    mock_client = MagicMock()
    mock_client.web.search.return_value = fake_response
    monkeypatch.setattr(context_search, "client", mock_client)

    results = context_search.search_web("obscure query")

    assert results == []


def test_search_web_propagates_upstream_errors(monkeypatch):
    mock_response = MagicMock(status_code=429, request=MagicMock())
    mock_client = MagicMock()
    mock_client.web.search.side_effect = RateLimitError(
        "rate limited", response=mock_response, body=None
    )
    monkeypatch.setattr(context_search, "client", mock_client)

    with pytest.raises(RateLimitError):
        context_search.search_web("dubai building code")
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `uv run pytest tests/test_context_search.py -v`
Expected: FAIL/ERROR — `ModuleNotFoundError: No module named 'app.services.context_search'`

- [ ] **Step 4: Implement `app/services/context_search.py`**

```python
from context.dev import ContextDev

from app.config import settings
from app.schemas import SearchResult

client = ContextDev(api_key=settings.context_dev_api_key)


def search_web(query: str, num_results: int = 10) -> list[SearchResult]:
    response = client.web.search(query=query, num_results=num_results)

    return [
        SearchResult(
            url=result.url,
            title=result.title,
            description=result.description,
            relevance=result.relevance,
        )
        for result in response.results
    ]
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `uv run pytest tests/test_context_search.py -v`
Expected: 3 passed

- [ ] **Step 6: Commit**

```bash
git add app/services/__init__.py app/services/context_search.py tests/test_context_search.py
git commit -m "Add Context.dev search service"
```

---

## Task 4: Search router and app entrypoint

**Files:**
- Create: `app/routers/__init__.py`
- Create: `app/routers/search.py`
- Create: `app/main.py`
- Test: `tests/test_search_router.py`

**Interfaces:**
- Consumes: `app.services.context_search.search_web` (Task 3, imported by name into `app.routers.search` so tests can monkeypatch it there), `app.schemas.SearchResponse`/`SearchResult` (Task 2).
- Produces: `app.routers.search.router` (a `fastapi.APIRouter` with one route, `GET /search`), `app.main.app` (the `FastAPI` instance, importable as `app.main:app` for `uvicorn`).

- [ ] **Step 1: Create the `routers` package**

```bash
mkdir -p app/routers
touch app/routers/__init__.py
```

- [ ] **Step 2: Write the failing tests**

Create `tests/test_search_router.py`:

```python
from unittest.mock import MagicMock

from context.dev import AuthenticationError, RateLimitError

from app.main import app
from app.routers import search as search_router
from app.schemas import SearchResult
from fastapi.testclient import TestClient

client = TestClient(app)


def test_search_returns_results(monkeypatch):
    fake_results = [
        SearchResult(url="https://example.com", title="Example", description="desc", relevance="high"),
    ]
    monkeypatch.setattr(search_router, "search_web", lambda q, num_results: fake_results)

    response = client.get("/search", params={"q": "dubai building code"})

    assert response.status_code == 200
    body = response.json()
    assert body["query"] == "dubai building code"
    assert body["results"][0]["url"] == "https://example.com"


def test_search_requires_query():
    response = client.get("/search")

    assert response.status_code == 422


def test_search_rejects_num_results_out_of_range():
    response = client.get("/search", params={"q": "x", "num_results": 5})

    assert response.status_code == 422


def test_search_maps_rate_limit_error_to_429(monkeypatch):
    mock_response = MagicMock(status_code=429, request=MagicMock())

    def raise_rate_limit(q, num_results):
        raise RateLimitError("rate limited", response=mock_response, body=None)

    monkeypatch.setattr(search_router, "search_web", raise_rate_limit)

    response = client.get("/search", params={"q": "dubai building code"})

    assert response.status_code == 429


def test_search_maps_auth_error_to_502(monkeypatch):
    mock_response = MagicMock(status_code=401, request=MagicMock())

    def raise_auth_error(q, num_results):
        raise AuthenticationError("bad key", response=mock_response, body=None)

    monkeypatch.setattr(search_router, "search_web", raise_auth_error)

    response = client.get("/search", params={"q": "dubai building code"})

    assert response.status_code == 502
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `uv run pytest tests/test_search_router.py -v`
Expected: FAIL/ERROR — `ModuleNotFoundError: No module named 'app.main'`

- [ ] **Step 4: Implement `app/routers/search.py`**

```python
from context.dev import APIConnectionError, APIStatusError, AuthenticationError, PermissionDeniedError, RateLimitError
from fastapi import APIRouter, HTTPException, Query

from app.schemas import SearchResponse
from app.services.context_search import search_web

router = APIRouter()


@router.get("/search", response_model=SearchResponse)
def search(
    q: str = Query(..., min_length=1),
    num_results: int = Query(10, ge=10, le=100),
) -> SearchResponse:
    try:
        results = search_web(q, num_results=num_results)
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail="Search provider rate limit exceeded") from exc
    except (AuthenticationError, PermissionDeniedError, APIStatusError, APIConnectionError) as exc:
        raise HTTPException(status_code=502, detail="Search provider request failed") from exc

    return SearchResponse(query=q, results=results)
```

- [ ] **Step 5: Implement `app/main.py`**

```python
from fastapi import FastAPI

from app.routers.search import router as search_router

app = FastAPI(title="AI-Twin Search API")
app.include_router(search_router)
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `uv run pytest tests/test_search_router.py -v`
Expected: 5 passed

- [ ] **Step 7: Run the full test suite**

Run: `uv run pytest -v`
Expected: 13 passed (2 config + 3 schemas + 3 service + 5 router)

- [ ] **Step 8: Manual smoke test**

```bash
uv run uvicorn app.main:app --reload
```

In another terminal:

```bash
curl "http://127.0.0.1:8000/search?q=dubai+building+code"
```

Expected: a 200 response with a `results` array of real Context.dev search results (this call spends real API credits — one request is fine). Stop the server with Ctrl+C when done.

- [ ] **Step 9: Commit**

```bash
git add app/routers/__init__.py app/routers/search.py app/main.py tests/test_search_router.py
git commit -m "Add GET /search router and FastAPI app entrypoint"
```

---

## Task 5: `include_domains` support in the search service

**Files:**
- Modify: `app/services/context_search.py`
- Test: `tests/test_context_search.py`

**Interfaces:**
- Consumes: `app.config.settings` (Task 1), `app.schemas.SearchResult` (Task 2) — unchanged.
- Produces: `app.services.context_search.search_web(query: str, num_results: int = 10, include_domains: list[str] | None = None) -> list[SearchResult]` — adds an optional third parameter. Existing two-argument call sites (Task 4's router) are unaffected: omitting `include_domains` reproduces today's exact `client.web.search(query=..., num_results=...)` call, verified against the installed SDK (`context.dev` 2.9.0), whose `WebResource.search()` accepts `include_domains: SequenceNotStr[str] | Omit` — passing nothing for it is equivalent to full omission, not `None`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/test_context_search.py`:

```python
def test_search_web_forwards_include_domains(monkeypatch):
    fake_response = SimpleNamespace(query="dubai building code", results=[], key_metadata=None)
    mock_client = MagicMock()
    mock_client.web.search.return_value = fake_response
    monkeypatch.setattr(context_search, "client", mock_client)

    context_search.search_web("dubai building code", num_results=10, include_domains=["dm.gov.ae"])

    mock_client.web.search.assert_called_once_with(
        query="dubai building code", num_results=10, include_domains=["dm.gov.ae"]
    )


def test_search_web_omits_include_domains_when_not_provided(monkeypatch):
    fake_response = SimpleNamespace(query="dubai building code", results=[], key_metadata=None)
    mock_client = MagicMock()
    mock_client.web.search.return_value = fake_response
    monkeypatch.setattr(context_search, "client", mock_client)

    context_search.search_web("dubai building code", num_results=10)

    mock_client.web.search.assert_called_once_with(query="dubai building code", num_results=10)
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/test_context_search.py -v`
Expected: `test_search_web_forwards_include_domains` FAILS with `TypeError: search_web() got an unexpected keyword argument 'include_domains'`. The other 4 tests (3 existing + the new "omits" test, which already matches current behavior) pass.

- [ ] **Step 3: Implement the change in `app/services/context_search.py`**

```python
from context.dev import ContextDev

from app.config import settings
from app.schemas import SearchResult

client = ContextDev(api_key=settings.context_dev_api_key)


def search_web(
    query: str, num_results: int = 10, include_domains: list[str] | None = None
) -> list[SearchResult]:
    kwargs = {"query": query, "num_results": num_results}
    if include_domains is not None:
        kwargs["include_domains"] = include_domains

    response = client.web.search(**kwargs)

    return [
        SearchResult(
            url=result.url,
            title=result.title,
            description=result.description,
            relevance=result.relevance,
        )
        for result in response.results
    ]
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `uv run pytest tests/test_context_search.py -v`
Expected: 5 passed

- [ ] **Step 5: Commit**

```bash
git add app/services/context_search.py tests/test_context_search.py
git commit -m "Support include_domains in search_web()"
```

---

## Task 6: Webhook-secret and allowed-domains settings

**Files:**
- Modify: `app/config.py`
- Modify: `tests/test_config.py`
- Modify: `.env` (local only — gitignored, not committed)

**Interfaces:**
- Consumes: nothing new.
- Produces: `app.config.Settings.mizan_webhook_secret: str`, `app.config.Settings.authority_search_allowed_domains: list[str]` (parsed from a comma-separated env var `AUTHORITY_SEARCH_ALLOWED_DOMAINS`). Both are required — `app.config.settings` is built at import time (existing pattern from Task 1), so **every** test that imports anything from `app.main` or `app.config` from this task onward needs these two env vars present in `.env`, or the import itself raises `ValidationError` before any test body runs.

- [ ] **Step 1: Add the new variables to your local `.env`**

`.env` is gitignored and never committed — this step only touches your local file. Generate a secret and add both lines (replace the domain list with real, vetted Dubai regulatory authority sites — e.g. Dubai Municipality's site — never ship a placeholder domain into a real conversation):

```bash
python3 -c "import secrets; print(secrets.token_hex(32))"
```

Add to `.env`:
```
MIZAN_WEBHOOK_SECRET='<paste the generated value>'
AUTHORITY_SEARCH_ALLOWED_DOMAINS='<comma-separated real authority domains, e.g. dm.gov.ae>'
```

- [ ] **Step 2: Write the failing tests**

Replace `tests/test_config.py` with:

```python
import pytest
from pydantic import ValidationError

from app.config import Settings


def test_settings_loads_api_key_from_env(monkeypatch):
    monkeypatch.setenv("CONTEXT_DEV_API_KEY", "ctxt_secret_test123")
    monkeypatch.setenv("MIZAN_WEBHOOK_SECRET", "shh")
    monkeypatch.setenv("AUTHORITY_SEARCH_ALLOWED_DOMAINS", "dm.gov.ae")

    settings = Settings(_env_file=None)

    assert settings.context_dev_api_key == "ctxt_secret_test123"


def test_settings_raises_when_api_key_missing(monkeypatch):
    monkeypatch.delenv("CONTEXT_DEV_API_KEY", raising=False)
    monkeypatch.setenv("MIZAN_WEBHOOK_SECRET", "shh")
    monkeypatch.setenv("AUTHORITY_SEARCH_ALLOWED_DOMAINS", "dm.gov.ae")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_raises_when_webhook_secret_missing(monkeypatch):
    monkeypatch.setenv("CONTEXT_DEV_API_KEY", "ctxt_secret_test123")
    monkeypatch.delenv("MIZAN_WEBHOOK_SECRET", raising=False)
    monkeypatch.setenv("AUTHORITY_SEARCH_ALLOWED_DOMAINS", "dm.gov.ae")

    with pytest.raises(ValidationError):
        Settings(_env_file=None)


def test_settings_parses_comma_separated_domains(monkeypatch):
    monkeypatch.setenv("CONTEXT_DEV_API_KEY", "ctxt_secret_test123")
    monkeypatch.setenv("MIZAN_WEBHOOK_SECRET", "shh")
    monkeypatch.setenv("AUTHORITY_SEARCH_ALLOWED_DOMAINS", "dm.gov.ae, dcd.gov.ae")

    settings = Settings(_env_file=None)

    assert settings.authority_search_allowed_domains == ["dm.gov.ae", "dcd.gov.ae"]


def test_settings_raises_when_allowed_domains_missing(monkeypatch):
    monkeypatch.setenv("CONTEXT_DEV_API_KEY", "ctxt_secret_test123")
    monkeypatch.setenv("MIZAN_WEBHOOK_SECRET", "shh")
    monkeypatch.delenv("AUTHORITY_SEARCH_ALLOWED_DOMAINS", raising=False)

    with pytest.raises(ValidationError):
        Settings(_env_file=None)
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `uv run pytest tests/test_config.py -v`
Expected: FAIL — the 3 new tests fail (fields don't exist yet / no validation error raised), and the 2 pre-existing tests fail too once you compare against the new required-field behavior (they didn't set `MIZAN_WEBHOOK_SECRET`/`AUTHORITY_SEARCH_ALLOWED_DOMAINS`, but that's fine — they'll pass again once Step 4 makes those fields required, since the two tests already set them in Step 2's rewrite).

- [ ] **Step 4: Implement `app/config.py`**

```python
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    context_dev_api_key: str
    mizan_webhook_secret: str
    authority_search_allowed_domains: list[str]

    @field_validator("authority_search_allowed_domains", mode="before")
    @classmethod
    def _split_domains(cls, value):
        if isinstance(value, str):
            return [domain.strip() for domain in value.split(",") if domain.strip()]
        return value


settings = Settings()
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `uv run pytest tests/test_config.py -v`
Expected: 5 passed

- [ ] **Step 6: Commit**

```bash
git add app/config.py tests/test_config.py
git commit -m "Add webhook secret and allowed-domains settings"
```

(`.env` is gitignored and stays local — nothing to commit there.)

---

## Task 7: Authority-search router, wired into the app

**Files:**
- Create: `app/routers/authority_search.py`
- Modify: `app/main.py`
- Test: `tests/test_authority_search_router.py`

**Interfaces:**
- Consumes: `app.config.settings` (Task 6), `app.services.context_search.search_web` (Task 5, imported by name into `app.routers.authority_search` so tests can monkeypatch it there), `app.schemas.SearchResponse` (Task 2).
- Produces: `app.routers.authority_search.router` (a `fastapi.APIRouter` with one route, `POST /tools/search-authority-sites`), `app.routers.authority_search.verify_webhook_secret` (a FastAPI dependency checking the `X-Mizan-Webhook-Secret` header).

- [ ] **Step 1: Write the failing tests**

Create `tests/test_authority_search_router.py`:

```python
from unittest.mock import MagicMock

from context.dev import AuthenticationError, RateLimitError
from fastapi.testclient import TestClient

from app.config import settings
from app.main import app
from app.routers import authority_search as authority_search_router
from app.schemas import SearchResult

client = TestClient(app)


def test_missing_secret_returns_401(monkeypatch):
    mock_search = MagicMock()
    monkeypatch.setattr(authority_search_router, "search_web", mock_search)

    response = client.post("/tools/search-authority-sites", json={"query": "coverage percentage"})

    assert response.status_code == 401
    mock_search.assert_not_called()


def test_wrong_secret_returns_401(monkeypatch):
    mock_search = MagicMock()
    monkeypatch.setattr(authority_search_router, "search_web", mock_search)

    response = client.post(
        "/tools/search-authority-sites",
        json={"query": "coverage percentage"},
        headers={"X-Mizan-Webhook-Secret": "wrong"},
    )

    assert response.status_code == 401
    mock_search.assert_not_called()


def test_correct_secret_searches_with_allowed_domains(monkeypatch):
    monkeypatch.setattr(settings, "mizan_webhook_secret", "correct-secret")
    monkeypatch.setattr(settings, "authority_search_allowed_domains", ["dm.gov.ae"])
    fake_results = [
        SearchResult(url="https://dm.gov.ae/page", title="Page", description="desc", relevance="high"),
    ]
    mock_search = MagicMock(return_value=fake_results)
    monkeypatch.setattr(authority_search_router, "search_web", mock_search)

    response = client.post(
        "/tools/search-authority-sites",
        json={"query": "coverage percentage"},
        headers={"X-Mizan-Webhook-Secret": "correct-secret"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["results"][0]["url"] == "https://dm.gov.ae/page"
    mock_search.assert_called_once_with("coverage percentage", include_domains=["dm.gov.ae"])


def test_ignores_domains_supplied_in_request_body(monkeypatch):
    monkeypatch.setattr(settings, "mizan_webhook_secret", "correct-secret")
    monkeypatch.setattr(settings, "authority_search_allowed_domains", ["dm.gov.ae"])
    mock_search = MagicMock(return_value=[])
    monkeypatch.setattr(authority_search_router, "search_web", mock_search)

    response = client.post(
        "/tools/search-authority-sites",
        json={"query": "coverage percentage", "include_domains": ["attacker.example.com"]},
        headers={"X-Mizan-Webhook-Secret": "correct-secret"},
    )

    assert response.status_code == 200
    mock_search.assert_called_once_with("coverage percentage", include_domains=["dm.gov.ae"])


def test_rate_limit_error_returns_429(monkeypatch):
    monkeypatch.setattr(settings, "mizan_webhook_secret", "correct-secret")

    mock_response = MagicMock(status_code=429, request=MagicMock())

    def raise_rate_limit(query, include_domains):
        raise RateLimitError("rate limited", response=mock_response, body=None)

    monkeypatch.setattr(authority_search_router, "search_web", raise_rate_limit)

    response = client.post(
        "/tools/search-authority-sites",
        json={"query": "coverage percentage"},
        headers={"X-Mizan-Webhook-Secret": "correct-secret"},
    )

    assert response.status_code == 429


def test_upstream_error_returns_502(monkeypatch):
    monkeypatch.setattr(settings, "mizan_webhook_secret", "correct-secret")

    mock_response = MagicMock(status_code=401, request=MagicMock())

    def raise_auth_error(query, include_domains):
        raise AuthenticationError("bad key", response=mock_response, body=None)

    monkeypatch.setattr(authority_search_router, "search_web", raise_auth_error)

    response = client.post(
        "/tools/search-authority-sites",
        json={"query": "coverage percentage"},
        headers={"X-Mizan-Webhook-Secret": "correct-secret"},
    )

    assert response.status_code == 502
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `uv run pytest tests/test_authority_search_router.py -v`
Expected: FAIL/ERROR — `ModuleNotFoundError: No module named 'app.routers.authority_search'`

- [ ] **Step 3: Implement `app/routers/authority_search.py`**

```python
from context.dev import APIConnectionError, APIStatusError, AuthenticationError, PermissionDeniedError, RateLimitError
from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from app.config import settings
from app.schemas import SearchResponse
from app.services.context_search import search_web

router = APIRouter()


class AuthoritySearchRequest(BaseModel):
    query: str = Field(..., min_length=1)


def verify_webhook_secret(x_mizan_webhook_secret: str | None = Header(default=None)) -> None:
    if x_mizan_webhook_secret != settings.mizan_webhook_secret:
        raise HTTPException(status_code=401, detail="Invalid or missing webhook secret")


@router.post(
    "/tools/search-authority-sites",
    response_model=SearchResponse,
    dependencies=[Depends(verify_webhook_secret)],
)
def search_authority_sites(body: AuthoritySearchRequest) -> SearchResponse:
    try:
        results = search_web(body.query, include_domains=settings.authority_search_allowed_domains)
    except RateLimitError as exc:
        raise HTTPException(status_code=429, detail="Search provider rate limit exceeded") from exc
    except (AuthenticationError, PermissionDeniedError, APIStatusError, APIConnectionError) as exc:
        raise HTTPException(status_code=502, detail="Search provider request failed") from exc

    return SearchResponse(query=body.query, results=results)
```

- [ ] **Step 4: Implement `app/main.py`**

```python
from fastapi import FastAPI

from app.routers.authority_search import router as authority_search_router
from app.routers.search import router as search_router

app = FastAPI(title="AI-Twin Search API")
app.include_router(search_router)
app.include_router(authority_search_router)
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `uv run pytest tests/test_authority_search_router.py -v`
Expected: 6 passed

- [ ] **Step 6: Run the full test suite**

Run: `uv run pytest -v`
Expected: 24 passed (5 config + 3 schemas + 5 context_search + 5 search router + 6 authority_search router)

- [ ] **Step 7: Commit**

```bash
git add app/routers/authority_search.py app/main.py tests/test_authority_search_router.py
git commit -m "Add authenticated, domain-locked authority-search route"
```

---

## Task 8: Docker wiring for the search API

**Files:**
- Modify: `Dockerfile`
- Modify: `docker-compose.yml`

**Interfaces:** none — deployment configuration only.

- [ ] **Step 1: Add `app/` to the Docker image**

In `Dockerfile`, change:

```dockerfile
COPY scripts/ scripts/
COPY config.py setup_agent.py ./
```

to:

```dockerfile
COPY scripts/ scripts/
COPY app/ app/
COPY config.py setup_agent.py ./
```

- [ ] **Step 2: Add a `search-api` service to `docker-compose.yml`**

Replace the full contents of `docker-compose.yml` with:

```yaml
services:
  app:
    build: .
    working_dir: /app
    volumes:
      - .:/app
    env_file:
      - .env
    ports:
      - "8000:8000" # python -m http.server 8000, for index.html
    stdin_open: true
    tty: true

  search-api:
    build: .
    working_dir: /app
    volumes:
      - .:/app
    env_file:
      - .env
    ports:
      - "8080:8080"
    command: uv run uvicorn app.main:app --host 0.0.0.0 --port 8080
```

- [ ] **Step 3: Manual smoke test**

```bash
docker compose build search-api
docker compose run --rm --service-ports search-api
```

In another terminal:

```bash
curl -i -X POST http://127.0.0.1:8080/tools/search-authority-sites \
  -H "Content-Type: application/json" \
  -H "X-Mizan-Webhook-Secret: wrong" \
  -d '{"query": "test"}'
```

Expected: `HTTP/1.1 401 Unauthorized` with body `{"detail":"Invalid or missing webhook secret"}` — confirms the container builds, starts, and the route is reachable. Stop the container with Ctrl+C when done.

- [ ] **Step 4: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "Add search-api Docker Compose service"
```

---

## Task 9: `AUTHORITY_SEARCH_URL` setting for the agent-setup script

**Files:**
- Modify: `config.py` (root — Mizan's own config, not `app/config.py`)

**Interfaces:**
- Produces: `config.AUTHORITY_SEARCH_URL: str | None` — the public base URL of the deployed `app/` search service, consumed by `setup_agent.py` in Task 10.

No tests for this task — plain constants file, matching this file's existing zero-test-coverage convention (`AGENT_NAME`, `PDF_PATH`, etc. aren't tested either).

- [ ] **Step 1: Add the setting**

In `config.py`, after the `PDF_PATH` section, add:

```python
# ── Web-search fallback (Mizan authority-site tool) — OPTIONAL ────────
# Base URL of the deployed app/ search service (see
# docs/superpowers/specs/2026-08-08-context-dev-search-endpoint-design.md).
# When set, setup_agent.py registers a webhook tool so Mizan can search an
# allowlisted set of Dubai authority sites when the DBC reference material
# has no answer. Leave as None to skip this entirely — the agent behaves
# exactly as before.
AUTHORITY_SEARCH_URL = None  # e.g. "https://your-search-api.example.com"
```

- [ ] **Step 2: Commit**

```bash
git add config.py
git commit -m "Add optional AUTHORITY_SEARCH_URL setting"
```

---

## Task 10: Register the authority-search tool on the agent

**Files:**
- Modify: `setup_agent.py`

**Interfaces:**
- Consumes: `config.AUTHORITY_SEARCH_URL` (Task 9); `elevenlabs` SDK types `ToolRequestModel`, `ToolRequestModelToolConfig_Webhook`, `WebhookToolApiSchemaConfigInput`, `ConvAiSecretLocator`, `ObjectJsonSchemaPropertyInput`, `LiteralJsonSchemaProperty` — all confirmed present on the installed `elevenlabs` SDK (`client.conversational_ai.tools.create(request: ToolRequestModel)`, `client.conversational_ai.tools.list(search: str | None)`, `client.conversational_ai.secrets.create(name: str, value: str)`, `client.conversational_ai.secrets.list(search: str | None)`).
- Produces: `setup_agent.get_or_create_authority_search_tool_id() -> str | None` — returns `None` when `config.AUTHORITY_SEARCH_URL` isn't set (opt-in, mirrors the existing `PDF_PATH` pattern); `build_conversation_config(tool_ids: list[str])` and `update_existing_agent(agent_id: str, tool_ids: list[str])` — both gain a required `tool_ids` parameter.

No automated tests for this task — matches the existing convention for this file (a one-shot CLI script against a live ElevenLabs account; zero test coverage today, and mocking the entire SDK surface here would test the mock, not the integration). Verified manually in Step 3.

- [ ] **Step 1: Add the new imports and constants**

At the top of `setup_agent.py`, add to the existing imports:

```python
from elevenlabs.types import (
    ConvAiSecretLocator,
    LiteralJsonSchemaProperty,
    ObjectJsonSchemaPropertyInput,
    ToolRequestModel,
    ToolRequestModelToolConfig_Webhook,
    WebhookToolApiSchemaConfigInput,
)
```

After the `client = ElevenLabs(...)` line, add:

```python
AUTHORITY_SEARCH_TOOL_NAME = "search_authority_sites"
WEBHOOK_SECRET_NAME = "MIZAN_WEBHOOK_SECRET"
```

- [ ] **Step 2: Add the tool-registration functions**

Add these two functions (e.g. after `upload_pdf_to_knowledge_base`):

```python
def get_or_create_webhook_secret_id() -> str:
    secret_value = os.environ["MIZAN_WEBHOOK_SECRET"]
    existing = client.conversational_ai.secrets.list(search=WEBHOOK_SECRET_NAME)
    for secret in existing.secrets:
        if secret.name == WEBHOOK_SECRET_NAME:
            return secret.secret_id
    created = client.conversational_ai.secrets.create(name=WEBHOOK_SECRET_NAME, value=secret_value)
    return created.secret_id


def get_or_create_authority_search_tool_id() -> str | None:
    if not config.AUTHORITY_SEARCH_URL:
        return None

    existing = client.conversational_ai.tools.list(search=AUTHORITY_SEARCH_TOOL_NAME)
    for tool in existing.tools:
        if tool.tool_config.name == AUTHORITY_SEARCH_TOOL_NAME:
            return tool.id

    webhook_secret_id = get_or_create_webhook_secret_id()
    created = client.conversational_ai.tools.create(
        request=ToolRequestModel(
            tool_config=ToolRequestModelToolConfig_Webhook(
                type="webhook",
                name=AUTHORITY_SEARCH_TOOL_NAME,
                description=(
                    "Search a fixed allowlist of Dubai regulatory authority websites. "
                    "Call this ONLY when the Dubai Building Code reference material has "
                    "no answer to the question."
                ),
                api_schema=WebhookToolApiSchemaConfigInput(
                    url=f"{config.AUTHORITY_SEARCH_URL}/tools/search-authority-sites",
                    method="POST",
                    request_headers={
                        "X-Mizan-Webhook-Secret": ConvAiSecretLocator(secret_id=webhook_secret_id),
                    },
                    request_body_schema=ObjectJsonSchemaPropertyInput(
                        type="object",
                        required=["query"],
                        properties={
                            "query": LiteralJsonSchemaProperty(
                                type="string",
                                description="The question to search for on the allowlisted authority sites.",
                            ),
                        },
                    ),
                ),
            )
        )
    )
    return created.id
```

- [ ] **Step 3: Thread `tool_ids` through `build_conversation_config` and `update_existing_agent`**

Replace `build_conversation_config`:

```python
def build_conversation_config(tool_ids: list[str]):
    agent_cfg = {
        "first_message": config.FIRST_MESSAGE,
        "prompt": {
            "prompt": config.SYSTEM_PROMPT,
            "llm": config.LLM_MODEL,
            "tool_ids": tool_ids,
        },
    }
    cfg = {"agent": agent_cfg}
    if config.VOICE_ID:
        cfg["tts"] = {"voice_id": config.VOICE_ID}
    cfg["conversation"] = {
        "file_input": {
            "enabled": config.ALLOW_FILE_UPLOADS,
            "max_files_per_conversation": config.MAX_FILES_PER_CONVERSATION,
        }
    }
    return cfg
```

Replace `update_existing_agent`:

```python
def update_existing_agent(agent_id: str, tool_ids: list[str]):
    """Push config.py's prompt/LLM onto an existing agent, leaving its other
    settings (voice, knowledge base) exactly as configured. `tool_ids` are
    merged into whatever tools the agent already has, not clobbered."""
    print(f"Fetching existing agent {agent_id}...")
    existing = client.conversational_ai.agents.get(agent_id=agent_id)
    merged_tool_ids = list(existing.conversation_config.agent.prompt.tool_ids or [])
    for tool_id in tool_ids:
        if tool_id not in merged_tool_ids:
            merged_tool_ids.append(tool_id)
    updated_prompt = existing.conversation_config.agent.prompt.model_copy(
        update={"prompt": config.SYSTEM_PROMPT, "llm": config.LLM_MODEL, "tool_ids": merged_tool_ids}
    )
    updated_agent = existing.conversation_config.agent.model_copy(update={"prompt": updated_prompt})
    updated_config = existing.conversation_config.model_copy(update={"agent": updated_agent})
    client.conversational_ai.agents.update(agent_id=agent_id, conversation_config=updated_config)
    print(f"Agent updated in place. AGENT_ID={agent_id}")
```

- [ ] **Step 4: Wire it into `main()`**

Replace:

```python
    if args.agent_id:
        update_existing_agent(args.agent_id)
        agent_id = args.agent_id
    else:
        agent = client.conversational_ai.agents.create(
            name=config.AGENT_NAME,
            conversation_config=build_conversation_config(),
        )
        agent_id = agent.agent_id
        print(f"Agent created. AGENT_ID={agent_id}")
```

with:

```python
    authority_search_tool_id = get_or_create_authority_search_tool_id()
    tool_ids = [authority_search_tool_id] if authority_search_tool_id else []

    if args.agent_id:
        update_existing_agent(args.agent_id, tool_ids)
        agent_id = args.agent_id
    else:
        agent = client.conversational_ai.agents.create(
            name=config.AGENT_NAME,
            conversation_config=build_conversation_config(tool_ids),
        )
        agent_id = agent.agent_id
        print(f"Agent created. AGENT_ID={agent_id}")
```

- [ ] **Step 5: Manual verification**

This step requires a real `ELEVENLABS_API_KEY` and hits your live ElevenLabs account (creates/reuses a workspace secret and a tool — no destructive effect on existing agents beyond merging in the new tool ID). Only run it once `MIZAN_WEBHOOK_SECRET` is exported and `config.AUTHORITY_SEARCH_URL` points at a publicly reachable deployment of `app/` (e.g. an `ngrok` tunnel to the `search-api` Docker service from Task 8):

```bash
set -a; source .env; set +a
uv run python setup_agent.py --agent-id <your existing agent ID>
```

Expected: prints `Agent updated in place. AGENT_ID=...` with no traceback. Re-running the same command should not create a duplicate tool or secret (both `get_or_create_*` functions look up existing ones by name first).

- [ ] **Step 6: Commit**

```bash
git add setup_agent.py
git commit -m "Register authority-search tool and attach it to the agent"
```

---

## Task 11: Mizan persona rule for the web-search fallback

**Files:**
- Modify: `prompts.py`

**Interfaces:** none — prompt string content only, no test coverage (matches this file's existing convention).

- [ ] **Step 1: Insert the new rule and renumber**

In `prompts.py`, inside `AGENT_PERSONA_PROMPT`, replace:

```python
2. Defer instead of bluffing. If the answer is not in the Reference Material — for example, a plot-specific figure such as a coverage percentage that lives in the DCR or affection plan — say so plainly and name the right authority to check (e.g. "That's not on file here — it would be in this plot's DCR or affection plan"). Never invent or estimate a number to avoid saying you don't know.

3. Know the hierarchy. The Dubai Building Code is the general baseline. A plot's affection plan or DCR overrides the general code where they conflict. Proactively flag this when it's relevant to the question, even if not asked — e.g. note that a general code setback may be superseded by the plot's own DCR.```

with:

```python
2. Defer instead of bluffing. If the answer is not in the Reference Material — for example, a plot-specific figure such as a coverage percentage that lives in the DCR or affection plan — say so plainly and name the right authority to check (e.g. "That's not on file here — it would be in this plot's DCR or affection plan"). Never invent or estimate a number to avoid saying you don't know.

3. Search only as a last resort, and say so. If the Reference Material has nothing on the question, you may use the search_authority_sites tool to check a fixed set of Dubai regulatory authority websites — but only after concluding the Reference Material doesn't cover it. If it turns something up, say so explicitly as a web result, never in the DBC citation style — do not say "per Table B.1" or "under B.4.2.2" for anything the tool returns. Say instead, e.g., "That's not in the DBC reference I have, but per [site name], ..." If the tool finds nothing either, say so plainly rather than guessing.

4. Know the hierarchy. The Dubai Building Code is the general baseline. A plot's affection plan or DCR overrides the general code where they conflict. Proactively flag this when it's relevant to the question, even if not asked — e.g. note that a general code setback may be superseded by the plot's own DCR.```

This sits before the existing `Scope:` paragraph and the closing `"""` further down — leave everything after it untouched.

- [ ] **Step 2: Sanity-check the prompt still builds**

Run: `uv run python -c "from prompts import SYSTEM_PROMPT; print(len(SYSTEM_PROMPT))"`
Expected: prints a number (no traceback) — confirms `prompts.py` still imports cleanly and `SYSTEM_PROMPT` assembles.

- [ ] **Step 3: Commit**

```bash
git add prompts.py
git commit -m "Add web-search fallback rule to Mizan's persona"
```
