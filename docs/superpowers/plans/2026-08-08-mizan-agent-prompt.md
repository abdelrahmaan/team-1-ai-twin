# Mizan Agent Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `prompts.py` with Mizan's real system prompt (persona + behavior
rules) and per-batch Dubai Building Code reference material loaded from `data/batch_002.json` and
`data/batch_003.json`, then wire `config.py` to use it.

**Architecture:** `prompts.py` dynamically loads and formats the two batch JSON files into
citation-tagged text blocks (sub-prompts), assembles them with the persona prompt into one
`SYSTEM_PROMPT`, and `config.py` imports that instead of its hardcoded placeholder.

**Tech Stack:** Python 3.12 stdlib only (`json`, `pathlib`) — no new dependencies.

## Global Constraints

- No hardcoded copies of page text in `prompts.py` — load `data/batch_*.json` dynamically at
  import time (the spec requires this; `data/` is gitignored, so hardcoding would also silently
  bake copyrighted DBC text into a committed file).
- Reference material blocks are tagged `--- Page N ---` per page, so every citation in a model
  answer can be traced back to a source page.
- The agent identifies itself as **Mizan** (confirmed with the user — the doc's body text, not
  its title, is the source of truth for the agent's name).
- No new dependencies (no pytest) — this repo has no test framework installed; verify with plain
  `python3 -c` assertions, consistent with the project's existing scripts
  (`scripts/assemble.py`, `scripts/extract_text.py`), which follow the same no-framework style.
- Use `venv/bin/python3` for any verification that imports `setup_agent.py` (it has `elevenlabs`
  installed); `.venv/bin/python3` does not have `elevenlabs` installed.

---

### Task 1: Build `prompts.py`

**Files:**
- Modify (full rewrite): `prompts.py`
- Reads (not modified): `data/batch_002.json`, `data/batch_003.json`

**Interfaces:**
- Produces: `prompts._load_pages(path: pathlib.Path) -> list[dict]`, `prompts._format_pages(pages: list[dict]) -> str`, `prompts.AGENT_PERSONA_PROMPT: str`, `prompts.BATCH_002_CONTEXT: str`, `prompts.BATCH_003_CONTEXT: str`, `prompts.DBC_KNOWLEDGE_CONTEXT: str`, `prompts.SYSTEM_PROMPT: str` — Task 2 imports `SYSTEM_PROMPT`.

- [ ] **Step 1: Write `prompts.py`**

Replace the entire contents of `prompts.py` with:

```python
"""
prompts.py
Mizan's system prompt: the persona/behavior rules, plus Dubai Building Code
reference material loaded from the ingested page batches in data/.

config.py imports SYSTEM_PROMPT from here to configure the ElevenLabs agent
(see setup_agent.py).
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent / "data"


def _load_pages(path: Path) -> list[dict]:
    """Load a batch_*.json file: a list of {page_number, summary, page_content}."""
    return json.loads(path.read_text(encoding="utf-8"))


def _format_pages(pages: list[dict]) -> str:
    """Concatenate pages, sorted by page_number, each tagged for citation."""
    ordered = sorted(pages, key=lambda page: page["page_number"])
    return "\n\n".join(
        f"--- Page {page['page_number']} ---\n{page['page_content']}"
        for page in ordered
    )


# ── Persona ───────────────────────────────────────────────────────────
AGENT_PERSONA_PROMPT = """You are Mizan, an in-meeting voice assistant for architectural client and consultant meetings in Dubai. You are grounded in the Dubai Building Code (DBC) and, where provided, the firm's own agreements.

You are addressed by name — "Mizan" — during a live meeting. Answer only when addressed, in natural, concise spoken language suitable for being read aloud. Do not produce long written-style answers; give the figure or rule first, then the citation.

Behave according to these principles, in order of importance:

1. Grounded, not guessing. Answer only from the Reference Material provided below. Every factual answer must cite the exact clause or table it comes from (e.g. "per Table B.1", "under B.4.2.2"). Never state a number, distance, or rule that is not directly supported by the Reference Material.

2. Defer instead of bluffing. If the answer is not in the Reference Material — for example, a plot-specific figure such as a coverage percentage that lives in the DCR or affection plan — say so plainly and name the right authority to check (e.g. "That's not on file here — it would be in this plot's DCR or affection plan"). Never invent or estimate a number to avoid saying you don't know.

3. Know the hierarchy. The Dubai Building Code is the general baseline. A plot's affection plan or DCR overrides the general code where they conflict. Proactively flag this when it's relevant to the question, even if not asked — e.g. note that a general code setback may be superseded by the plot's own DCR.

Scope: for this version, you only answer questions about the Dubai Building Code. If asked about firm agreements, contracts, budgets, or anything outside the Reference Material below, say that's outside what you currently have access to.

You are a decision-support co-pilot, not the decision-maker. The architect of record still decides and signs. Your job is to make sure they never face a hard question with no facts to stand on."""

# ── Reference material (sub-prompts) ────────────────────────────────────
_batch_002_pages = _load_pages(DATA_DIR / "batch_002.json")
_batch_003_pages = _load_pages(DATA_DIR / "batch_003.json")

BATCH_002_CONTEXT = _format_pages(_batch_002_pages)
BATCH_003_CONTEXT = _format_pages(_batch_003_pages)

_all_pages = _batch_002_pages + _batch_003_pages
_page_numbers = sorted(page["page_number"] for page in _all_pages)

DBC_KNOWLEDGE_CONTEXT = _format_pages(_all_pages)

# ── Assembled whole prompt ──────────────────────────────────────────────
SYSTEM_PROMPT = f"""{AGENT_PERSONA_PROMPT}

# Reference Material (Dubai Building Code, pages {_page_numbers[0]}-{_page_numbers[-1]})

{DBC_KNOWLEDGE_CONTEXT}
"""
```

- [ ] **Step 2: Verify structure and content**

Run:

```bash
venv/bin/python3 -c "
import prompts

assert 'Mizan' in prompts.AGENT_PERSONA_PROMPT
assert 'grounded' in prompts.AGENT_PERSONA_PROMPT.lower()
assert 'defer' in prompts.AGENT_PERSONA_PROMPT.lower()
assert 'hierarchy' in prompts.AGENT_PERSONA_PROMPT.lower() or 'DCR' in prompts.AGENT_PERSONA_PROMPT

assert '--- Page 11 ---' in prompts.BATCH_002_CONTEXT
assert '--- Page 17 ---' in prompts.BATCH_002_CONTEXT
assert '--- Page 18 ---' not in prompts.BATCH_002_CONTEXT

assert '--- Page 18 ---' in prompts.BATCH_003_CONTEXT
assert '--- Page 39 ---' in prompts.BATCH_003_CONTEXT

assert '--- Page 11 ---' in prompts.DBC_KNOWLEDGE_CONTEXT
assert '--- Page 39 ---' in prompts.DBC_KNOWLEDGE_CONTEXT

assert prompts.AGENT_PERSONA_PROMPT in prompts.SYSTEM_PROMPT
assert prompts.DBC_KNOWLEDGE_CONTEXT in prompts.SYSTEM_PROMPT
assert 'pages 11-39' in prompts.SYSTEM_PROMPT

print(f'OK: SYSTEM_PROMPT is {len(prompts.SYSTEM_PROMPT):,} chars, {len(prompts._all_pages)} pages')
"
```

Expected: prints `OK: SYSTEM_PROMPT is N chars, 29 pages` with no assertion errors.

- [ ] **Step 3: Commit**

```bash
git add prompts.py
git commit -m "Build Mizan system prompt with DBC batch reference material"
```

---

### Task 2: Wire `config.py` to `prompts.py`

**Files:**
- Modify: `config.py` (currently has a hardcoded `SYSTEM_PROMPT` string — see file for exact
  current line range before editing, since line numbers may drift)

**Interfaces:**
- Consumes: `prompts.SYSTEM_PROMPT: str` (produced by Task 1)
- Produces: `config.SYSTEM_PROMPT: str` — already consumed as-is by `setup_agent.py`'s
  `build_conversation_config()`, which does `"prompt": {"prompt": config.SYSTEM_PROMPT, ...}`.
  No changes needed in `setup_agent.py`.

- [ ] **Step 1: Replace the hardcoded prompt with an import**

In `config.py`, replace:

```python
# The agent's role / behavior. Edit this freely.
SYSTEM_PROMPT = """You are a helpful, concise voice assistant.
Speak naturally, keep answers short unless asked for detail.
If the user's question relates to an attached document, use it to answer accurately.
"""
```

with:

```python
# The agent's role / behavior. Defined in prompts.py (persona + DBC reference material).
from prompts import SYSTEM_PROMPT
```

Leave everything else in `config.py` (`AGENT_NAME`, `FIRST_MESSAGE`, `LLM_MODEL`, etc.) unchanged.

- [ ] **Step 2: Verify the wiring**

Run:

```bash
venv/bin/python3 -c "
import config
import prompts

assert config.SYSTEM_PROMPT == prompts.SYSTEM_PROMPT
assert 'Mizan' in config.SYSTEM_PROMPT
print('OK: config.SYSTEM_PROMPT is wired to prompts.SYSTEM_PROMPT')
"
```

Expected: prints `OK: config.SYSTEM_PROMPT is wired to prompts.SYSTEM_PROMPT` with no errors.

Then confirm `setup_agent.py` still builds a valid config with it (no network call — this only
exercises `build_conversation_config()`, and a dummy API key is enough since the `ElevenLabs`
client doesn't validate it until a real request is made):

```bash
ELEVENLABS_API_KEY=dummy venv/bin/python3 -c "
import setup_agent

cfg = setup_agent.build_conversation_config()
assert cfg['agent']['prompt']['prompt'] == setup_agent.config.SYSTEM_PROMPT
assert 'Mizan' in cfg['agent']['prompt']['prompt']
print('OK: build_conversation_config() embeds the Mizan prompt')
"
```

Expected: prints `OK: build_conversation_config() embeds the Mizan prompt` with no errors.

- [ ] **Step 3: Commit**

```bash
git add config.py
git commit -m "Wire config.py SYSTEM_PROMPT to prompts.py"
```
