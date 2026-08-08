import type { AgentState } from '../hooks/useAgent'
import { Orb } from './Orb'

const LABELS: Partial<Record<AgentState, string>> = {
  connecting: 'Connecting…',
  idle: 'Tap the mic to start',
}

export function VoiceView({
  getLevel,
  state,
}: {
  getLevel: () => number
  state: AgentState
}) {
  const label = LABELS[state]

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-10">
      <Orb getLevel={getLevel} state={state} />
      <p className="h-5 text-sm text-neutral-400">{label ?? ''}</p>
    </div>
  )
}
