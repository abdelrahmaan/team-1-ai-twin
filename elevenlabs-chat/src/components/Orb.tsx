import { useEffect, useRef } from 'react'
import type { AgentState } from '../hooks/useAgent'

type OrbProps = {
  /** Returns the current audio level, 0..1. Polled on every animation frame. */
  getLevel: () => number
  state: AgentState
  size?: number
}

export function Orb({ getLevel, state, size = 385 }: OrbProps) {
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let frame = 0
    let smoothed = 0

    const tick = () => {
      const target = Math.min(1, Math.max(0, getLevel()))
      // Ease toward the live reading so the orb swells instead of flickering.
      smoothed += (target - smoothed) * 0.18

      const node = wrap.current
      if (node) {
        node.style.transform = `scale(${(1 + smoothed * 0.09).toFixed(4)})`
        node.style.setProperty('--glow', (0.22 + smoothed * 0.6).toFixed(3))
      }

      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [getLevel])

  return (
    <div
      ref={wrap}
      className="orb-wrap"
      data-state={state}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <div className="orb">
        <span className="orb-cloud orb-cloud-a" />
        <span className="orb-cloud orb-cloud-b" />
        <span className="orb-cloud orb-cloud-c" />
      </div>
    </div>
  )
}
