# Voice Agent (ElevenLabs)

A real-time voice agent you can talk to from your laptop mic, with a
configurable prompt/role, a choice of LLM, and optional PDF context.

## Files

| File               | Purpose                                                        |
|---------------------|------------------------------------------------------------------|
| `config.py`         | All settings: prompt, LLM model, voice, PDF path, file uploads  |
| `setup_agent.py`     | Creates/configures the agent on ElevenLabs using `config.py`     |
| `requirements.txt`  | Python dependencies                                              |
| `index.html`        | Simple browser UI — click a button, talk, hear the agent reply  |

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

## 4. Create the agent

Without a PDF:
```bash
python setup_agent.py
```

With a PDF (as context/knowledge base):
```bash
python setup_agent.py --pdf path/to/document.pdf
```

This prints an `AGENT_ID`. Copy it.

## 5. Run the voice UI

Open `index.html` and paste your `AGENT_ID` into the `agent-id="..."`
attribute on the `<elevenlabs-convai>` tag. Then either:

- Double-click `index.html` to open it directly in a browser, **or**
- Serve it locally:
  ```bash
  python -m http.server 8000
  ```
  and visit `http://localhost:8000`

Click the widget button, allow microphone access, and start talking —
you'll hear the agent respond in real time and can interrupt it mid-sentence.

## Notes

- If your agent has **authentication enabled** (a private agent), the raw
  `agent-id` embed won't work from the browser directly — you'll need a
  small backend endpoint that calls `get_signed_url()` with your API key
  and passes that signed URL to the widget instead.
- Re-run `setup_agent.py` any time you change `config.py` to create a new
  agent with the updated settings (it creates a new agent each run rather
  than editing in place — save the printed `AGENT_ID` you want to keep).
- LLM usage is billed from your ElevenLabs account credits, not a separate key.
