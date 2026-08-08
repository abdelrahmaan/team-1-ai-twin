# Context.dev Search Endpoint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `GET /search` FastAPI endpoint that searches the web via the Context.dev `/v1/web/search` API and returns lightweight results (url, title, description, relevance).

**Architecture:** A small `app/` package: `config.py` (settings), `schemas.py` (Pydantic response models), `services/context_search.py` (wraps the `context.dev` SDK), `routers/search.py` (the route), `main.py` (FastAPI app). Dependencies managed with `uv`.

**Tech Stack:** Python 3.11+, FastAPI, `context.dev` SDK (PyPI package `context.dev`, distribution name `context-dev`, version 2.9.0 confirmed), `pydantic-settings`, `uv`, `pytest`.

## Global Constraints

- Python >= 3.11.
- All dependency management goes through `uv` (`uv add`, `uv run`) — no manual `pip install`.
- `CONTEXT_DEV_API_KEY` is read only from the environment/`.env` (already present and git-ignored) — never hardcoded, never included in a response body or log line.
- `num_results` is constrained to 10–100 (Context.dev's own accepted range), default 10.
- Response shape is lightweight only: `url`, `title`, `description`, `relevance` per result. No Markdown/full-page scraping, no `freshness`/`includeDomains`/`excludeDomains`/`country` filters — out of scope for this endpoint.
- No Docker/CI scaffolding — out of scope.
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
