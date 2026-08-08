"""
setup_agent.py
Creates (or updates) an ElevenLabs Conversational AI agent using the
settings in config.py:
  - a configurable role/prompt
  - a chosen LLM (billed via your ElevenLabs credits)
  - an OPTIONAL PDF uploaded as knowledge-base context

Usage:
  export ELEVENLABS_API_KEY=your_api_key
  python setup_agent.py                  # no PDF context
  python setup_agent.py --pdf notes.pdf  # with PDF context
"""

import argparse
import os
from elevenlabs import ElevenLabs

import config

client = ElevenLabs(api_key=os.environ["ELEVENLABS_API_KEY"])


def build_conversation_config():
    agent_cfg = {
        "first_message": config.FIRST_MESSAGE,
        "prompt": {
            "prompt": config.SYSTEM_PROMPT,
            "llm": config.LLM_MODEL,
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


def upload_pdf_to_knowledge_base(pdf_path: str):
    print(f"Uploading {pdf_path} to knowledge base...")
    with open(pdf_path, "rb") as f:
        doc = client.conversational_ai.knowledge_base.documents.create_from_file(
            file=f,
            name=os.path.basename(pdf_path),
        )
    print(f"Uploaded. Document ID: {doc.id}")
    return doc.id


def main():
    parser = argparse.ArgumentParser(description="Create/configure an ElevenLabs voice agent.")
    parser.add_argument(
        "--pdf",
        default=config.PDF_PATH,
        help="Path to a PDF to attach as knowledge-base context (optional).",
    )
    args = parser.parse_args()

    agent = client.conversational_ai.agents.create(
        name=config.AGENT_NAME,
        conversation_config=build_conversation_config(),
    )
    print(f"Agent created. AGENT_ID={agent.agent_id}")

    if args.pdf:
        if os.path.exists(args.pdf):
            doc_id = upload_pdf_to_knowledge_base(args.pdf)
            client.conversational_ai.agents.update(
                agent_id=agent.agent_id,
                conversation_config={
                    "agent": {
                        "prompt": {
                            "knowledge_base": [
                                {"id": doc_id, "type": "file", "name": os.path.basename(args.pdf)}
                            ]
                        }
                    }
                },
            )
            print("PDF attached to agent's knowledge base.")
        else:
            print(f"Warning: PDF '{args.pdf}' not found — continuing without it.")
    else:
        print("No PDF provided — agent created without document context.")

    print("\nPut this in index.html's agent-id field:")
    print(agent.agent_id)


if __name__ == "__main__":
    main()
