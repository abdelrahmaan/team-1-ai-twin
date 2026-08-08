# elevenlabs-chat

A ChatGPT-style client for an ElevenLabs Agent. Chat bubbles plus a full-screen voice mode
with an animated orb, on one page.

## Setup

1. Create an agent at [elevenlabs.io](https://elevenlabs.io) — prompt, voice, knowledge base,
   tools. Set it to **Public** so the browser can connect without an API key.
2. Copy the agent ID into `.env`:

   ```
   VITE_ELEVENLABS_AGENT_ID=your_agent_id
   ```

   Vite also reads `.env.local`, `.env.development`, and `.env.production` if you prefer to
   split them. All are gitignored except `.env.example`.

3. Start it:

   ```bash
   npm run dev
   ```

Without an agent ID the app shows a setup screen instead of the chat.

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server on http://localhost:5173 |
| `npm test` | Unit tests |
| `npm run build` | Typecheck and production build |
| `npm run lint` | oxlint |

## How it works

`src/hooks/useAgent.ts` is the only file that touches the ElevenLabs SDK. It exposes plain
values — `messages`, `state`, `getLevel`, `send`, `startVoice`, `stop` — so the components
stay unaware of the provider.

Typing and talking share one session. Typing opens a text-only WebSocket; hitting the mic
tears that down and reopens over WebRTC, because a text socket cannot carry audio.

The orb reads the audio level on each animation frame and writes the transform straight to
the DOM. Putting that level in React state would re-render the page sixty times a second.

## Changing the name

`APP_NAME` in `src/config.ts`.

## Not built yet

- **Private agents.** Those need a server route that mints a signed URL with your API key,
  which means moving off a client-only build. Public is correct for localhost.
- Conversation history and persistence.
- Deployment.
