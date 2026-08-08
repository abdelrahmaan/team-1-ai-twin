# Mizan Landing Page — Design

## Goal

Give the team a front door at the root of `elevenlabs-chat` that explains what Mizan is
and how to talk to it, before they land in the chat/voice app itself. Internal audience
only — colleagues, not prospective clients.

## Non-goals

- No marketing copy, testimonials, pricing, or signup flow (internal tool).
- No new routing library — `elevenlabs-chat` has exactly two routes; a router
  dependency (react-router or similar) is unjustified weight for that.
- No visual redesign of the existing chat/voice UI — the landing page adopts its
  existing look (palette, type, spacing), it doesn't introduce a new one.

## Architecture

`elevenlabs-chat` gets a minimal client-side router built directly into `App.tsx`,
replacing its current unconditional render of the assistant:

- Reads `window.location.pathname` into state on mount.
- Listens for the browser's `popstate` event (back/forward) and updates that state.
- Exposes a `navigate(path: string)` helper: calls `history.pushState(null, '', path)`,
  then updates the state directly (no reload, no flash).
- `/` renders `Landing`. `/app` renders `Assistant`. Any other path falls back to
  `Landing` (no 404 page needed for an internal two-route app).

This keeps the whole app a single Vite build with no new dependency — proportionate to
two routes with no nesting, params, or guards.

## Components

| File | Change |
| --- | --- |
| `src/App.tsx` | Becomes a thin router: path state, `popstate` listener, `navigate`, and the `/` vs `/app` branch. |
| `src/pages/Assistant.tsx` | **New** — the `Assistant` component (and its `Mode` type) moved here verbatim from the current `App.tsx`. Behavior unchanged, including the existing `SetupNotice` fallback when `AGENT_ID` is unset. |
| `src/pages/Landing.tsx` | **New** — the landing page described below. Takes an `onLaunch: () => void` prop (wired to `navigate('/app')` by `App.tsx`) rather than importing the router itself, so it stays easy to reason about in isolation. |

`src/config.ts`, `src/hooks/useAgent.ts`, and every other existing file are untouched.

## Content

Static copy, no data fetching:

- Eyebrow: "MIZAN"
- Headline: "Your Dubai Building Code co-pilot for client meetings"
- Body: "Say “Mizan” and ask — it answers from the DBC and cites the clause. If it’s not
  in the code, it says so."
- CTA button: "Launch Mizan →"

## Layout & styling

Centered single column, generous vertical whitespace, no nav bar or footer (nothing
else to link to yet). Reuses the existing design language rather than inventing one:

- White background, `neutral-900` text, system sans-serif stack — same as
  `index.css`/`Header.tsx` today.
- CTA button uses the blue from the existing orb gradient (`#6376f4` family) as its
  accent, so it reads as the same product as the chat/voice screens.
- `tracking-tight` on the headline, matching the existing `Header` title treatment.
- Built with Tailwind utility classes only, consistent with every other component in
  the app — no new CSS file.

## Testing

- New unit test for `App.tsx`'s routing behavior: navigating updates the rendered
  path, and a `popstate` event is reflected in state. This is the only new logic;
  static JSX in `Landing.tsx` isn't tested, consistent with the rest of the app (only
  `src/lib/messages.ts` has tests today).
- No new error states: visiting `/app` directly with `AGENT_ID` unset still shows the
  existing `SetupNotice`, unchanged.

## Open questions

None — all resolved during brainstorming.
