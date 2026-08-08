# Mizan — Dubai Building Code Voice Assistant

A real-time voice agent (built on ElevenLabs Conversational AI) for architectural
client and consultant meetings in Dubai. Mizan answers questions grounded in the
Dubai Building Code (DBC), citing the exact clause or table behind every answer,
and defers instead of guessing when something isn't in its reference material.

## Idea

Mizan sits in on architectural client meetings. When a tricky question comes up,
the architect asks it out loud — "Mizan, what's our height limit here?" — and it
answers in a couple of seconds, in natural speech, quoting the exact rule from the
Dubai Building Code and the firm's own documents.

**The problem.** In client and consultant meetings, architects and managers
constantly face questions that need a precise, sourced answer — a setback figure,
a height cap, a clause in the signed agreement. But the right specialist isn't
always in the room, or the fact is buried in a 300-page code. So the team either
concedes a point they shouldn't, or says "let me check and get back to you" —
losing momentum and looking less authoritative in front of the client.

**The solution.** A voice agent grounded in the actual regulations and the firm's
contracts, that supplies the missing fact instantly and cites its source, so
anyone can verify it. Just as importantly, when it doesn't have a reliable
answer, it says so and points to the right authority instead of guessing — which
is what makes an architect trust it in a high-stakes room.

**The impact.** Teams stop stalling and start answering. Instead of "we'll
revert," points get resolved live, with a citation the client can check on the
spot. That means faster decisions, fewer costly mistakes, and a team that
presents with real authority — letting even a small practice walk into a meeting
with the instant regulatory recall of a much larger firm.

## Files

| File                  | Purpose                                                        |
|-----------------------|------------------------------------------------------------------|
| `config.py`            | Settings: agent name, LLM model, voice, PDF path, file uploads  |
| `prompts.py`           | Builds `SYSTEM_PROMPT` — Mizan's persona plus DBC reference material from `data/dbc_reference.txt` |
| `setup_agent.py`       | Creates a new agent, or updates an existing one in place (`--agent-id`), from `config.py` |
| `pyproject.toml` / `uv.lock` | Python dependencies, managed with [uv](https://docs.astral.sh/uv/) |
| `requirements.txt`     | Same dependencies, for plain `pip` (no uv required)              |
| `Dockerfile` / `docker-compose.yml` | Containerized dev environment (uv + poppler) — see [Docker](#docker) |
| `data/`                | Dubai Building Code reference material — see [Building the reference material](#building-the-reference-material) |
| `scripts/extract_text.py` | Dumps the DBC PDF's text layer for a page range, or builds a full-text cache |
| `scripts/assemble.py`  | Merges per-batch page JSON into one parsed-document JSON          |
| `elevenlabs-chat/`     | **Current UI** — a ChatGPT-style React client (chat + voice mode). See its own README for details |
| `index.html`           | Legacy minimal UI — one button, no build step required          |

## Prerequisites

- An [ElevenLabs](https://elevenlabs.io) account with API credits
- Your API key, from **elevenlabs.io → Settings → API Keys**
- Python 3.12+, with either [uv](https://docs.astral.sh/uv/) (recommended) or `pip`
- [poppler](https://poppler.freedesktop.org/) (`brew install poppler`) — only needed if
  you're regenerating `data/dbc_reference.txt` from the source PDF; not required to run
  the agent as-is

## 1. Install dependencies

With uv (recommended — matches `uv.lock`):
```bash
uv sync
```

Or with plain pip:
```bash
pip install -r requirements.txt
```

Or skip local setup entirely and use [Docker](#docker).

## 2. Set your API key

```bash
export ELEVENLABS_API_KEY=your_api_key_here
```

(On Windows PowerShell: `$env:ELEVENLABS_API_KEY="your_api_key_here"`)

## 3. Configure the agent

Open `config.py` and edit:

- `AGENT_NAME` — the agent's display name in your ElevenLabs dashboard
- `LLM_MODEL` — which model powers it (e.g. `gemini-2.0-flash`, `gpt-4o`, `claude-sonnet-4-5`)
- `VOICE_ID` — optional, pick a voice from your ElevenLabs Voice Library
- `PDF_PATH` — optional, leave as `None` if you don't want to give it an extra document

The agent's persona and behavior rules (and the DBC reference material) live in
`prompts.py`, not `config.py` — edit `AGENT_PERSONA_PROMPT` there to change how Mizan
talks or what it prioritizes.

## 4. Create (or update) the agent

Create a new agent, without an extra PDF:
```bash
python setup_agent.py
```

Create a new agent, with a PDF attached as extra knowledge-base context:
```bash
python setup_agent.py --pdf path/to/document.pdf
```

This prints an `AGENT_ID`. Copy it.

Already have an agent and just changed `config.py` or `prompts.py`? Update
it in place instead of creating a new one:
```bash
python setup_agent.py --agent-id agent_xxx
```

## 5. Run the UI

**Current UI — `elevenlabs-chat/`** (React, chat + full-screen voice mode):

```bash
cd elevenlabs-chat
npm install          # first time only
```

Put your `AGENT_ID` in `elevenlabs-chat/.env.local`:
```
VITE_ELEVENLABS_AGENT_ID=agent_xxx
```

Then:
```bash
npm run dev
```

and visit `http://localhost:5173`. See `elevenlabs-chat/README.md` for how
it's built.

**Legacy UI — `index.html`** (no build step, one button):

Paste your `AGENT_ID` into the `agent-id="..."` attribute on the
`<elevenlabs-convai>` tag, then either double-click `index.html` to open it
directly in a browser, or serve it locally:
```bash
python -m http.server 8000
```
and visit `http://localhost:8000`.

Either way: click the widget/button, allow microphone access, and start
talking — you'll hear the agent respond in real time and can interrupt it
mid-sentence.

## Building the reference material

`data/dbc_reference.txt` is what `prompts.py` actually loads into `SYSTEM_PROMPT` — a
plain-text concatenation of DBC pages, each tagged `--- Page N ---` so every answer the
agent gives can cite a real page. It currently covers pages 11–161, with a gap at
59–160 not yet ingested.

It's built in three steps from the source PDF (`Dubai Building Code_English_2021
Edition.pdf`, not committed — see [Data and copyright](#data-and-copyright)):

1. **Extract the text layer.** `scripts/extract_text.py --cache <pdf>` runs
   `pdftotext -layout` once and caches the result as `<pdf>.full_text.txt`. You can also
   dump a specific page range to read while authoring a batch:
   ```bash
   python scripts/extract_text.py "Dubai Building Code_English_2021 Edition.pdf" 11 39
   ```
2. **Author page batches.** Each `data/batch_NNN.json` is a JSON array of
   `{page_number, summary, page_content}` objects — `page_content` is the page
   transcribed as clean markdown, `summary` is a one-to-two-sentence gist. These are
   gitignored (see below) and authored by hand or with LLM assistance from the cached
   text layer.
3. **Assemble and merge into `dbc_reference.txt`.** `scripts/assemble.py` merges the
   batch files into one parsed-document JSON, reporting any duplicate or missing page
   numbers so a partial ingestion run is never mistaken for a complete one. The pages
   are then written out as `--- Page N ---`-tagged text blocks into
   `data/dbc_reference.txt`, which is what's actually committed and read by `prompts.py`.

## Docker

The `Dockerfile` bundles Python 3.12, `uv`, and `poppler-utils` (for
`scripts/extract_text.py`). `docker-compose.yml` bind-mounts the repo into the
container and forwards port 8000 (for the legacy `index.html` UI):

```bash
docker compose build
docker compose run --rm app bash
```

Inside the container, `uv sync` has already run against the frozen lockfile; use the
same commands as above (`python setup_agent.py`, etc.).

## Data and copyright

The Dubai Building Code PDF itself (`*.pdf`) is gitignored — it's a large, third-party
copyrighted document and isn't committed. `data/batch_*.json` (the raw per-page
transcriptions) are also gitignored, to avoid multiplying copies of that copyrighted
text across files. `data/dbc_reference.txt` — the single distilled reference file
actually shipped to the agent — is committed, along with the full extracted text cache
(`Dubai Building Code_English_2021 Edition.full_text.txt`). Reconsider whether those
belong in a public repo before publishing it anywhere.

## Notes

- If your agent has **authentication enabled** (a private agent), the raw
  `agent-id` embed won't work from the browser directly — you'll need a
  small backend endpoint that calls `get_signed_url()` with your API key
  and passes that signed URL to the UI instead. (Not built yet in
  `elevenlabs-chat/` — see its README's "Not built yet" section.)
- `setup_agent.py --agent-id agent_xxx` updates that agent's prompt and LLM
  in place; running without `--agent-id` always creates a brand new agent
  with its own ID — save the printed `AGENT_ID` you want to keep.
- LLM usage is billed from your ElevenLabs account credits, not a separate key.
