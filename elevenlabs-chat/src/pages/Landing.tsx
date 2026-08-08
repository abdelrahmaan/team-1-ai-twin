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
