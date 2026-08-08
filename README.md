# Voice Agent (ElevenLabs)

A real-time voice agent you can talk to from your laptop mic, with a
configurable prompt/role, a choice of LLM, and optional PDF context.

## Files

| File               | Purpose                                                        |
|---------------------|------------------------------------------------------------------|
| `config.py`         | All settings: prompt, LLM model, voice, PDF path, file uploads  |
| `prompts.py`         | Builds `SYSTEM_PROMPT` — persona plus DBC reference material from `data/dbc_reference.txt` |
| `setup_agent.py`     | Creates a new agent, or updates an existing one in place (`--agent-id`), from `config.py` |
| `requirements.txt`  | Python dependencies                                              |
| `elevenlabs-chat/`   | **Current UI** — a ChatGPT-style React client (chat + voice mode). See its own README for details |
| `index.html`        | Legacy minimal UI — one button, no build step required          |

## Prerequisites

- An [ElevenLabs](https://elevenlabs.io) account with API credits
- Your API key, from **elevenlabs.io → Settings → API Keys**
- Python 3.9+

## 1. Install dependencies

```bash
pip install -r requirements.txt
```

## 2. Set your API key

```bash
export ELEVENLABS_API_KEY=your_api_key_here
```

(On Windows PowerShell: `$env:ELEVENLABS_API_KEY="your_api_key_here"`)

## 3. Configure the agent

Open `config.py` and edit:

- `SYSTEM_PROMPT` — the agent's role/instructions
- `LLM_MODEL` — which model powers it (e.g. `gemini-2.0-flash`, `gpt-4o`, `claude-sonnet-4-5`)
- `VOICE_ID` — optional, pick a voice from your ElevenLabs Voice Library
- `PDF_PATH` — optional, leave as `None` if you don't want to give it a document

## 4. Create (or update) the agent

Create a new agent, without a PDF:
```bash
python setup_agent.py
```

Create a new agent, with a PDF (as context/knowledge base):
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
