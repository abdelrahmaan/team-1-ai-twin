# Mizan — Technical Specification

## 1. Overview

Mizan is a real-time voice/chat assistant, built on **ElevenLabs Conversational AI**,
for architectural client and consultant meetings in Dubai. It answers questions
grounded in the Dubai Building Code (DBC), always citing the clause or table an
answer comes from, and explicitly defers instead of guessing when the reference
material doesn't cover the question.

The system has three parts that all live in this repo:

1. A **reference-material pipeline** that turns the DBC PDF into a plain-text
   knowledge base.
2. An **agent-configuration layer** that assembles that knowledge base plus a
   persona prompt into an ElevenLabs Conversational AI agent.
3. A **client UI** (React, chat + voice) that end users talk to.

## 2. Architecture

```
 data/source/*.pdf (not committed, third-party copyrighted)
        │  scripts/extract_text.py (pdftotext -layout, cached)
        ▼
 data/source/*.full_text.txt  ── author by hand/LLM ──▶  data/batch_NNN.json (gitignored)
                                                        │
                                            scripts/assemble.py
                                                        ▼
                                       data/dbc_reference.txt  (committed)
                                                        │
                                              agent/prompts.py (SYSTEM_PROMPT =
                                              persona + reference material)
                                                        │
                                              agent/config.py (agent name, LLM,
                                              voice, file-upload limits)
                                                        │
                                              agent/setup_agent.py ── ElevenLabs API ──▶ Conversational AI Agent
                                                                                          │
                                              ┌───────────────────────────────────────────┘
                                              ▼
                                    elevenlabs-chat/ (React, @elevenlabs/react)
                                              │
                                        end user (chat + voice, WebSocket/WebRTC)
```

Everything upstream of "Conversational AI Agent" is offline tooling that runs
locally (or in the Docker dev container) and produces either committed text
artifacts or direct API calls; only the client UI and the ElevenLabs-hosted
agent run continuously.

## 3. Components

### 3.1 Reference-material pipeline

| File | Role |
|---|---|
| `scripts/extract_text.py` | Runs `pdftotext -layout` once against the source PDF and caches it as `<pdf>.full_text.txt`; can also dump a page range for authoring. |
| `data/batch_NNN.json` (gitignored) | Hand/LLM-authored `{page_number, summary, page_content}` records, one array per batch of pages. |
| `scripts/assemble.py` | Merges batch files into `data/dbc_reference.txt`, a `--- Page N ---`-tagged text file, reporting duplicate/missing pages so a partial ingestion pass is never mistaken for complete. |
| `data/dbc_reference.txt` (committed) | The single distilled reference file actually shipped to the agent. Currently covers pages 11–161, with a known gap at 59–160. |

### 3.2 Agent configuration

The Python code that assembles and pushes the agent config lives in the `agent/`
package, run as `python -m agent.setup_agent`.

| File | Role |
|---|---|
| `agent/prompts.py` | Defines `AGENT_PERSONA_PROMPT` (Mizan's behavior rules, in priority order: grounded-not-guessing, defer-instead-of-bluffing, know-the-hierarchy) and assembles `SYSTEM_PROMPT` from the persona plus `data/dbc_reference.txt`. |
| `agent/config.py` | Agent settings: `AGENT_NAME`, `LLM_MODEL` (e.g. `gemini-2.0-flash`, `gpt-4o`, `claude-sonnet-4-5`), optional `VOICE_ID`, optional `PDF_PATH` for extra knowledge-base context, and file-upload limits (`ALLOW_FILE_UPLOADS`, `MAX_FILES_PER_CONVERSATION`). |
| `agent/setup_agent.py` | Talks to the ElevenLabs API (`ELEVENLABS_API_KEY` from the environment, see `.env.example`). Creates a new agent, or — with `--agent-id` — updates prompt/LLM on an existing agent in place without touching its other settings (voice, knowledge base, tools). Optionally uploads a PDF to the agent's knowledge base via `--pdf`. |

### 3.3 Client UI

- **`elevenlabs-chat/`** — the client UI. React 19 + Vite + Tailwind v4, using
  `@elevenlabs/react`. `src/hooks/useAgent.ts` is the sole file touching the
  ElevenLabs SDK, exposing `messages`, `state`, `getLevel`, `send`,
  `startVoice`, `stop` so components stay provider-agnostic. Typing and
  talking share one session: text starts on a WebSocket; starting voice
  tears that down and reopens over WebRTC (a text socket can't carry audio).
  The voice orb reads audio level on each animation frame and writes the
  transform directly to the DOM rather than through React state, to avoid
  re-rendering at 60fps. Configured via `elevenlabs-chat/.env.local`
  (`VITE_ELEVENLABS_AGENT_ID`).

### 3.4 Dev environment

`Dockerfile` bundles Python 3.12, `uv`, and `poppler-utils`.
`docker-compose.yml` bind-mounts the repo. Dependencies are managed with `uv`
(`pyproject.toml` / `uv.lock`), with `requirements.txt` kept in sync for
plain-`pip` use.

## 4. Tech stack

| Layer | Technology |
|---|---|
| Voice/chat runtime | ElevenLabs Conversational AI (LLM + TTS + turn-taking, billed via ElevenLabs credits) |
| Agent config/tooling | Python 3.12, `elevenlabs` SDK, `uv` |
| PDF text extraction | `poppler` (`pdftotext`) |
| Client UI | React 19, TypeScript, Vite, Tailwind CSS v4, `@elevenlabs/react` |
| Client tests | Vitest |
| Client lint | oxlint |
| Dev container | Docker / docker-compose |

## 5. Data flow at conversation time

1. Client establishes a session with the ElevenLabs agent (WebSocket for
   text, WebRTC once voice starts), authenticated by public `agent-id`.
2. The agent's `SYSTEM_PROMPT` (persona + full DBC reference text) was
   already baked in at `agent/setup_agent.py` time — there is no per-turn
   retrieval step; the whole reference material is in context.
3. ElevenLabs runs the configured `LLM_MODEL` against that prompt plus the
   conversation turns, and streams back text/audio.
4. The client renders chat bubbles and/or drives the voice orb from the
   streamed response; `useAgent.ts` is the only integration point.

## 6. Known gaps / planned work

- **Private agents.** The current client embeds a public `agent-id`
  directly; a private agent needs a backend route that mints a signed URL
  via `get_signed_url()`, which isn't built yet.
- **Conversation history/persistence** — not built.
- **Deployment** — not built; today the app only runs locally or via Docker.
- **DBC reference coverage gap** — pages 59–160 not yet ingested into
  `data/dbc_reference.txt`.
- **Web-search fallback.** A design spec and implementation plan exist
  (`docs/superpowers/specs/2026-08-08-context-dev-search-endpoint-design.md`,
  `docs/superpowers/plans/2026-08-08-context-dev-search-endpoint.md`) for a
  FastAPI service wrapping the Context.dev `/v1/web/search` API, including a
  secret-gated, domain-locked route Mizan can call as a tool when the DBC
  reference material has no answer. Not yet implemented in this branch.

## 7. Data and copyright

The source PDF (`data/source/Dubai Building Code_English_2021 Edition.pdf`) and the
raw per-page batch transcriptions (`data/batch_*.json`) are gitignored — both are
derived from, or are, third-party copyrighted material. Only the distilled
`data/dbc_reference.txt` and the full extracted-text cache
(`data/source/*.full_text.txt`) are committed. Reconsider whether either belongs in
a public repo before publishing it.
