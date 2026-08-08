"""
config.py
All configurable settings for the voice agent live here.
Edit this file, then run: python setup_agent.py
"""

# ── Agent identity ─────────────────────────────────────────────────────
AGENT_NAME = "My Voice Assistant"

# The agent's role / behavior. Defined in prompts.py (persona + DBC reference material).
from prompts import SYSTEM_PROMPT

FIRST_MESSAGE = "Hi! I'm ready to help. What would you like to talk about?"

# ── Model ──────────────────────────────────────────────────────────────
# The LLM that powers the agent's reasoning (billed from your ElevenLabs credits).
# Common options: "gemini-2.0-flash", "gemini-2.5-flash", "gpt-4o", "gpt-4o-mini",
# "claude-sonnet-4-5", "claude-3-5-haiku".
# Check https://elevenlabs.io/docs/eleven-agents/customization/llm for the current list.
LLM_MODEL = "gemini-2.0-flash"

# ── Voice ──────────────────────────────────────────────────────────────
# Any voice_id from your ElevenLabs Voice Library. Leave as None to use the
# agent's default voice.
VOICE_ID = None  # e.g. "21m00Tcm4TlvDq8ikWAM" (Rachel)

# ── Knowledge base (PDF context) — OPTIONAL ───────────────────────────
# Path to a local PDF to give the agent as context. Leave as None (or don't
# pass --pdf on the command line) to run the agent with no document context.
PDF_PATH = None  # e.g. "./context.pdf"

# ── Multimodal input ───────────────────────────────────────────────────
# Allow users to attach images/PDFs mid-conversation from the widget/app,
# independent of whether you preload a PDF above.
ALLOW_FILE_UPLOADS = True
MAX_FILES_PER_CONVERSATION = 3
