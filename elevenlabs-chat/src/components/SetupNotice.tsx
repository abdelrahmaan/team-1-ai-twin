export function SetupNotice() {
  return (
    <div className="grid min-h-full place-items-center px-6">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-semibold tracking-tight">One step left</h1>
        <p className="mt-2 text-[15px] leading-relaxed text-neutral-600">
          Create an agent at{' '}
          <span className="font-medium text-neutral-900">elevenlabs.io</span>, set it to{' '}
          <span className="font-medium text-neutral-900">Public</span>, then copy its ID into{' '}
          <code className="rounded bg-neutral-100 px-1.5 py-0.5">.env</code> in the project root:
        </p>

        <pre className="mt-4 overflow-x-auto rounded-xl bg-neutral-900 px-4 py-3 text-[13px] leading-relaxed text-neutral-100">
          <code>VITE_ELEVENLABS_AGENT_ID=your_agent_id</code>
        </pre>

        <p className="mt-4 text-sm text-neutral-500">
          Restart the dev server afterwards — Vite only reads env files at startup.
        </p>
      </div>
    </div>
  )
}
