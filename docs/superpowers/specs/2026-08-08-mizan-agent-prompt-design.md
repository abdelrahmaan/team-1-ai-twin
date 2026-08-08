# Mizan Agent Prompt — Design

**Date:** 2026-08-08
**Status:** Approved

## Purpose

`prompts.py` currently holds a generic, unused placeholder prompt. This replaces it with the
real system prompt for Mizan — the in-meeting Dubai Building Code voice assistant described in
the product doc — plus the DBC page content ingested so far (`data/batch_002.json`,
`data/batch_003.json`) as reference material, so the agent can be tested as text before wiring
up real retrieval (per the product doc's Phase 1: "test it as text first").

## Scope

In scope:

- `prompts.py`: persona prompt, per-batch knowledge sub-prompts, and one assembled `SYSTEM_PROMPT`.
- Wiring `config.py`'s `SYSTEM_PROMPT` to import from `prompts.py` (single source of truth for
  `setup_agent.py`).

Out of scope:

- Real retrieval / vector search over the DBC (per the doc's roadmap, that's later).
- Ingesting more of the DBC beyond the existing `data/batch_002.json` / `batch_003.json`.
- Any change to `setup_agent.py` — it already just reads `config.SYSTEM_PROMPT`.

## Design

### Persona prompt

`AGENT_PERSONA_PROMPT` — Mizan's identity and behavior rules, taken directly from the product
doc:

- Identity: Mizan, an in-meeting voice assistant for architectural client meetings in Dubai,
  answering from the Dubai Building Code.
- Grounded, not guessing: answer only from the reference material provided; always cite the
  exact clause/table (e.g. "Table B.1", "B.4.2.2").
- Defers instead of bluffing: if the answer isn't in the reference material (e.g. a
  plot-specific figure that lives in the DCR), say so plainly and name the right authority
  instead of inventing a number.
- Knows the hierarchy: proactively flags that a plot's DCR/affection plan overrides the
  general code where relevant.
- Voice-appropriate: concise, natural spoken delivery — not a long read-out — citing clause
  numbers verbally.
- Name-triggered: responds when addressed as "Mizan".
- Scope discipline: V1 only answers Dubai Building Code questions (per the doc's "narrow on
  purpose" roadmap framing) — it does not improvise on firm agreements or contracts, which are
  future-roadmap scope.

### Knowledge sub-prompts

A loader reads a `data/batch_*.json` file (list of `{page_number, summary, page_content}`),
sorts by `page_number`, and concatenates each page's `page_content` under a `--- Page N ---`
header, so a citation can be traced back to a page.

- `BATCH_002_CONTEXT` — pages 11–17, loaded from `data/batch_002.json`.
- `BATCH_003_CONTEXT` — pages 18–39, loaded from `data/batch_003.json`.
- `DBC_KNOWLEDGE_CONTEXT` — both batches merged and sorted by page number into one reference
  block.

Loading is dynamic (reads the JSON files at import time via a path relative to `prompts.py`),
matching the existing `scripts/assemble.py` pattern, so it stays current as more batches are
added later — no hardcoded copies of page text.

### Assembled prompt

`SYSTEM_PROMPT` = `AGENT_PERSONA_PROMPT` + a "Reference Material" section containing
`DBC_KNOWLEDGE_CONTEXT`. This is the single value other modules import.

### Integration

`config.py`'s `SYSTEM_PROMPT` changes from its hardcoded generic string to
`from prompts import SYSTEM_PROMPT`. `setup_agent.py` is unaffected — it already reads
`config.SYSTEM_PROMPT`.

## Testing

Manual: import `prompts` and `config`, confirm `config.SYSTEM_PROMPT` contains the Mizan
persona text and both batches' page content, and that page headers/citations are present.
No automated tests — this is prompt content, not logic.
