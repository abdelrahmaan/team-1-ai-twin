# ElevenLabs Chat — Design

**Date:** 2026-08-08
**Status:** Approved

## Purpose

A single-page web app that looks and feels like ChatGPT (chat bubbles + full-screen voice
mode with an animated orb), wired to an ElevenLabs Agent. The agent itself — prompt, voice,
knowledge base, tools — is built separately in the ElevenLabs dashboard. This app is the
client.

Primary use: running on localhost while recording short-form video.

## Scope

In scope:

- One page. Chat view with message bubbles, and a full-screen voice view with the orb.
- Both views drive the same live conversation. You can type mid-call.
- Visual match to ChatGPT voice mode: white background, blue/white gradient orb,
  rounded input pill, minimal chrome.

Out of scope (deliberately):

- Sidebar, conversation history, persistence
- Authentication
- Deployment and private-agent signed URLs (see Follow-ups)

## Stack

Vite + React + TypeScript + Tailwind, with a small hand-written CSS file for the orb.

Vite over Next.js because the app runs on localhost and the dev server's start time and HMR
matter while recording. No backend is required for a public agent. Adding a server route
later is contained — only `useAgent` would change.

## Architecture

```
src/
  App.tsx                 owns `mode: 'chat' | 'voice'`
  hooks/useAgent.ts       the only module that imports the ElevenLabs SDK
  lib/messages.ts         pure message reducer
  components/
    Header.tsx            title bar
    ChatView.tsx          message list + empty state
    MessageBubble.tsx
    VoiceView.tsx         full-screen orb + status text
    Orb.tsx               presentational; props: { level, state }
    Composer.tsx          the pill: +, text input, mic, close/send
    SetupNotice.tsx       shown when no agent ID is configured
```

### Boundaries

- `Orb` receives a number `0..1` and a state string. It has no knowledge of ElevenLabs,
  audio, or conversation state. It can be developed and eyeballed in isolation.
- `useAgent` is the single seam to the SDK. It exposes a provider-agnostic surface:
  `{ status, isSpeaking, messages, level, start, stop, send }`.
- `lib/messages.ts` holds the pure append/update logic so it is testable without mocking
  the SDK or the browser audio stack.

## Data flow

1. `useAgent` wraps `useConversation` from `@elevenlabs/react`.
2. The SDK's `onMessage` callback appends to `messages`, tagged `user` or `ai`.
3. Typing in the composer calls `sendUserMessage(text)`.
4. The mic button calls `startSession({ agentId, connectionType: 'webrtc' })` and sets
   `mode = 'voice'`.
5. `level` is polled from the SDK's output/input volume on an animation frame and passed
   down to `Orb`.

Chat and voice are the same session. Switching views does not reconnect.

## The orb

Layered blurred radial gradients with slow drifting keyframes. A wrapper div's
`transform: scale()` is driven by `level` via `requestAnimationFrame`, so it grows while the
agent speaks and pulses gently while listening. No WebGL, no shader dependency.

## Error handling

| Case | Behaviour |
| --- | --- |
| No agent ID configured | `SetupNotice` renders with the exact `.env` line to add |
| Microphone permission denied | Inline message under the composer; app stays usable in text mode |
| Connection drops or fails | Status returns to idle; composer stays interactive; no white screen |

## Testing

- Vitest unit tests over `lib/messages.ts` — the pure reducer.
- Manual verification in a real browser for the audio path and the orb.

No unit tests for gradient animation.

## Configuration

`.env`:

```
VITE_ELEVENLABS_AGENT_ID=your_agent_id
```

The agent must be set to **Public** in the ElevenLabs dashboard. A public agent needs no API
key in the browser, which is the correct posture for a client-only app.

## Follow-ups (not now)

- Signed-URL server route, required if the agent is made private
- Vercel deployment
- Conversation persistence
