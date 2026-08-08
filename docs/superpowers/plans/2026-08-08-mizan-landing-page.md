# Mizan Landing Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a landing page at `elevenlabs-chat`'s `/` route that introduces Mizan to
the internal team, with a "Launch Mizan" button that takes them to the existing
chat/voice app, now at `/app`.

**Architecture:** A tiny client-side router lives in `App.tsx` — no router library.
`window.location.pathname` decides which page renders; a `popstate` listener keeps it
in sync with browser back/forward; a `navigate()` helper uses `history.pushState` so
switching pages doesn't reload. The path ↔ page mapping is extracted into a pure
`src/lib/routes.ts` module (testable without a DOM), while `App.tsx` itself stays a
thin, untested wiring layer — the same split the codebase already uses for
`src/hooks/useAgent.ts` (untested SDK/browser seam) vs. `src/lib/messages.ts` (tested
pure logic).

**Tech Stack:** React 19, Vite, Tailwind v4, TypeScript, Vitest — all already in
`elevenlabs-chat`. No new dependencies.

## Global Constraints

- No new dependency for routing (spec: "No new routing library" — two routes don't
  justify one).
- Route mapping: `/app` → the assistant (chat/voice) experience; every other path,
  including `/`, → the landing page (spec: "Any other path falls back to `Landing`").
- Landing page copy is exact, from the approved spec:
  - Eyebrow: "Mizan"
  - Headline: "Your Dubai Building Code co-pilot for client meetings"
  - Body: "Say "Mizan" and ask — it answers from the DBC and cites the clause. If it's
    not in the code, it says so."
  - CTA button: "Launch Mizan →"
- Styling reuses the existing palette only — white background, `neutral-900` text,
  system sans-serif stack (already global via `index.css`), the orb-gradient blue
  (`#6376f4` family) as the one accent color, `tracking-tight` headings, Tailwind
  utility classes only (no new CSS file).
- `AGENT_ID`-missing behavior (the existing `SetupNotice` fallback) must be unchanged
  and must still trigger only when visiting `/app`.
- This repo's dev environment currently has another Claude Code session/terminal
  active on the same working directory (confirmed with the user). Before running any
  branch-changing git command (checkout, merge, rebase), run `git status` and
  `git branch --show-current` first, and stick to plain `git add`/`git commit` on the
  current branch unless the user says otherwise.

---

### Task 1: Pure route-mapping helpers

**Files:**
- Create: `elevenlabs-chat/src/lib/routes.ts`
- Test: `elevenlabs-chat/src/lib/routes.test.ts`

**Interfaces:**
- Produces: `Route = 'landing' | 'app'` (type), `routeForPath(pathname: string): Route`,
  `pathForRoute(route: Route): string` — Task 3 imports all three from
  `../lib/routes`.

- [ ] **Step 1: Write the failing test**

Create `elevenlabs-chat/src/lib/routes.test.ts`:

```ts
import { describe, expect, it } from 'vitest'
import { pathForRoute, routeForPath } from './routes'

describe('routeForPath', () => {
  it('maps /app to the app route', () => {
    expect(routeForPath('/app')).toBe('app')
  })

  it('maps / to the landing route', () => {
    expect(routeForPath('/')).toBe('landing')
  })

  it('falls back to landing for any unrecognized path', () => {
    expect(routeForPath('/whatever')).toBe('landing')
    expect(routeForPath('')).toBe('landing')
  })
})

describe('pathForRoute', () => {
  it('maps the app route to /app', () => {
    expect(pathForRoute('app')).toBe('/app')
  })

  it('maps the landing route to /', () => {
    expect(pathForRoute('landing')).toBe('/')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `elevenlabs-chat/`): `npm test -- routes`
Expected: FAIL — `Failed to resolve import "./routes"` (the module doesn't exist yet).

- [ ] **Step 3: Write the minimal implementation**

Create `elevenlabs-chat/src/lib/routes.ts`:

```ts
export type Route = 'landing' | 'app'

export function routeForPath(pathname: string): Route {
  return pathname === '/app' ? 'app' : 'landing'
}

export function pathForRoute(route: Route): string {
  return route === 'app' ? '/app' : '/'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- routes`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
cd elevenlabs-chat
git add src/lib/routes.ts src/lib/routes.test.ts
git commit -m "Add pure path<->route mapping for the landing page router"
```

---

### Task 2: Move the assistant view into `src/pages/Assistant.tsx`

**Files:**
- Create: `elevenlabs-chat/src/pages/Assistant.tsx`
- Modify: `elevenlabs-chat/src/App.tsx` (full rewrite — temporarily a plain
  passthrough; the router lands in Task 3)

**Interfaces:**
- Produces: `Assistant` (named export from `src/pages/Assistant.tsx`) — a
  component that takes no props, checks `AGENT_ID` itself, and renders either
  `SetupNotice` or the chat/voice UI. Task 3 imports it as
  `import { Assistant } from './pages/Assistant'`.

This task only relocates existing code — the app's behavior must be identical before
and after (still always shows the assistant, since the router doesn't exist yet).

- [ ] **Step 1: Create `src/pages/Assistant.tsx`**

This is the current contents of `App.tsx`, moved, with imports adjusted for the new
directory depth (`./components/...` → `../components/...`, `./config` → `../config`,
`./hooks/useAgent` → `../hooks/useAgent`), and the inner chat/voice component renamed
from `Assistant` to `Conversation` so it doesn't collide with the page-level
`Assistant` export below:

```tsx
import { useCallback, useState } from 'react'
import { ChatView } from '../components/ChatView'
import { Composer } from '../components/Composer'
import { Header } from '../components/Header'
import { SetupNotice } from '../components/SetupNotice'
import { VoiceView } from '../components/VoiceView'
import { AGENT_ID } from '../config'
import { useAgent } from '../hooks/useAgent'

type Mode = 'chat' | 'voice'

function Conversation({ agentId }: { agentId: string }) {
  const [mode, setMode] = useState<Mode>('chat')
  const [draft, setDraft] = useState('')
  const agent = useAgent(agentId)

  const submit = useCallback(() => {
    const text = draft
    setDraft('')
    void agent.send(text)
  }, [agent, draft])

  const startVoice = useCallback(async () => {
    const started = await agent.startVoice()
    if (started) setMode('voice')
  }, [agent])

  const endVoice = useCallback(() => {
    agent.stop()
    setMode('chat')
  }, [agent])

  return (
    <div className="flex h-full flex-col">
      <Header />

      {mode === 'voice' ? (
        <VoiceView getLevel={agent.getLevel} state={agent.state} />
      ) : (
        <ChatView messages={agent.messages} />
      )}

      <Composer
        draft={draft}
        onDraftChange={setDraft}
        onSubmit={submit}
        mode={mode}
        onStartVoice={startVoice}
        onEndVoice={endVoice}
        isMuted={agent.isMuted}
        onToggleMute={() => agent.setMuted(!agent.isMuted)}
        error={agent.error}
      />
    </div>
  )
}

export function Assistant() {
  if (!AGENT_ID) return <SetupNotice />
  return <Conversation agentId={AGENT_ID} />
}
```

- [ ] **Step 2: Replace `App.tsx` with a plain passthrough**

Replace the entire contents of `elevenlabs-chat/src/App.tsx` with:

```tsx
import { Assistant } from './pages/Assistant'

export default function App() {
  return <Assistant />
}
```

- [ ] **Step 3: Verify the build and existing tests still pass**

Run (from `elevenlabs-chat/`):
```bash
npm run build
npm test
```
Expected: both succeed — `tsc -b` reports no type errors, `vitest run` still passes
the existing `messages.test.ts` tests plus Task 1's `routes.test.ts` tests, unchanged
in count.

- [ ] **Step 4: Manually confirm no behavior change**

```bash
npm run dev
```
Visit `http://localhost:5173` — it must look and behave exactly as it did before this
task (either the chat/voice UI if `VITE_ELEVENLABS_AGENT_ID` is set in
`.env.local`, or the `SetupNotice` "One step left" screen if not). Stop the dev
server (Ctrl+C) once confirmed.

- [ ] **Step 5: Commit**

```bash
cd elevenlabs-chat
git add src/App.tsx src/pages/Assistant.tsx
git commit -m "Move the chat/voice assistant into src/pages/Assistant.tsx"
```

---

### Task 3: Build the landing page and wire up the router

**Files:**
- Create: `elevenlabs-chat/src/pages/Landing.tsx`
- Modify: `elevenlabs-chat/src/App.tsx` (full rewrite — becomes the router)

**Interfaces:**
- Consumes: `Route`, `routeForPath`, `pathForRoute` from `../lib/routes` (Task 1);
  `Assistant` from `./pages/Assistant` (Task 2).
- Produces: `Landing` (named export from `src/pages/Landing.tsx`), taking
  `{ onLaunch: () => void }`.

- [ ] **Step 1: Create `src/pages/Landing.tsx`**

```tsx
type LandingProps = {
  onLaunch: () => void
}

export function Landing({ onLaunch }: LandingProps) {
  return (
    <div className="grid min-h-full place-items-center px-6">
      <div className="w-full max-w-md text-center">
        <p className="text-sm font-semibold tracking-widest text-neutral-400 uppercase">
          Mizan
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-balance">
          Your Dubai Building Code co-pilot for client meetings
        </h1>
        <p className="mt-4 text-[15px] leading-relaxed text-neutral-600">
          Say "Mizan" and ask — it answers from the DBC and cites the clause. If it's
          not in the code, it says so.
        </p>
        <button
          type="button"
          onClick={onLaunch}
          className="mt-8 rounded-full bg-[#6376f4] px-6 py-3 text-[15px] font-medium text-white transition-colors hover:bg-[#5265e0]"
        >
          Launch Mizan →
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite `App.tsx` as the router**

Replace the entire contents of `elevenlabs-chat/src/App.tsx` with:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { pathForRoute, routeForPath, type Route } from './lib/routes'
import { Assistant } from './pages/Assistant'
import { Landing } from './pages/Landing'

export default function App() {
  const [route, setRoute] = useState<Route>(() => routeForPath(window.location.pathname))

  useEffect(() => {
    const onPopState = () => setRoute(routeForPath(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  const navigate = useCallback((next: Route) => {
    window.history.pushState(null, '', pathForRoute(next))
    setRoute(next)
  }, [])

  if (route === 'app') return <Assistant />
  return <Landing onLaunch={() => navigate('app')} />
}
```

- [ ] **Step 3: Verify the build and tests still pass**

Run (from `elevenlabs-chat/`):
```bash
npm run build
npm test
npm run lint
```
Expected: `tsc -b` and `vite build` succeed, all Vitest tests pass (unchanged from
Task 2), `oxlint` reports no errors.

- [ ] **Step 4: Manually verify the routing in a browser**

```bash
npm run dev
```

Check, at `http://localhost:5173`:
1. `/` shows the landing page — "Mizan" eyebrow, the headline, the body copy, and the
   "Launch Mizan →" button.
2. Clicking "Launch Mizan →" navigates to `/app` (check the URL bar) without a full
   page reload, and shows the same chat/voice UI (or `SetupNotice`) as before.
3. Using the browser's **back** button from `/app` returns to `/` and shows the
   landing page again.
4. Loading `http://localhost:5173/app` directly (typed in the address bar, fresh
   load) goes straight to the assistant.
5. Loading `http://localhost:5173/nonsense` falls back to the landing page.

Stop the dev server (Ctrl+C) once all five check out.

- [ ] **Step 5: Commit**

```bash
cd elevenlabs-chat
git add src/App.tsx src/pages/Landing.tsx
git commit -m "Add Mizan landing page at / with routing to /app"
```
