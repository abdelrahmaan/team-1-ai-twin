"""
setup_agent.py
Creates (or updates) an ElevenLabs Conversational AI agent using the
settings in config.py:
  - a configurable role/prompt
  - a chosen LLM (billed via your ElevenLabs credits)
  - an OPTIONAL PDF uploaded as knowledge-base context

Usage:
  export ELEVENLABS_API_KEY=your_api_key
  python setup_agent.py                        # create a new agent, no PDF context
  python setup_agent.py --pdf notes.pdf         # create a new agent, with PDF context
  python setup_agent.py --agent-id agent_xxx    # update an existing agent's prompt/LLM in place
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


def update_existing_agent(agent_id: str):
    """Push config.py's prompt/LLM onto an existing agent, leaving its other
    settings (voice, knowledge base, tools) exactly as configured."""
    print(f"Fetching existing agent {agent_id}...")
    existing = client.conversational_ai.agents.get(agent_id=agent_id)
    updated_prompt = existing.conversation_config.agent.prompt.model_copy(
        update={"prompt": config.SYSTEM_PROMPT, "llm": config.LLM_MODEL}
    )
    updated_agent = existing.conversation_config.agent.model_copy(update={"prompt": updated_prompt})
    updated_config = existing.conversation_config.model_copy(update={"agent": updated_agent})
    client.conversational_ai.agents.update(agent_id=agent_id, conversation_config=updated_config)
    print(f"Agent updated in place. AGENT_ID={agent_id}")


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
    parser.add_argument(
        "--agent-id",
        default=None,
        help="Existing agent ID to update in place (prompt + LLM only), instead of creating a new agent.",
    )
    args = parser.parse_args()

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

    if args.pdf:
        if os.path.exists(args.pdf):
            doc_id = upload_pdf_to_knowledge_base(args.pdf)
            client.conversational_ai.agents.update(
                agent_id=agent_id,
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
        print("No PDF provided.")

    print("\nPut this in elevenlabs-chat/.env.local as VITE_ELEVENLABS_AGENT_ID")
    print("(or in index.html's agent-id field for the legacy UI):")
    print(agent_id)


if __name__ == "__main__":
    main()
