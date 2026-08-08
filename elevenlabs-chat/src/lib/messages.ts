export type Role = 'user' | 'agent'

export type Message = {
  id: string
  role: Role
  text: string
}

/** Shape the ElevenLabs SDK hands to `onMessage`. */
export type IncomingMessage = {
  message: string
  source?: 'user' | 'ai'
  role?: 'user' | 'agent'
}

let counter = 0

export function nextId(): string {
  counter += 1
  return `m${counter}`
}

/**
 * Map an SDK payload onto our own Message. Returns null for anything with no
 * usable text — the SDK occasionally emits empty turns and they should not
 * render as blank bubbles.
 */
export function toMessage(incoming: IncomingMessage, id: string): Message | null {
  const text = incoming.message?.trim()
  if (!text) return null

  const role: Role = incoming.role ?? (incoming.source === 'user' ? 'user' : 'agent')
  return { id, role, text }
}

export function appendMessage(messages: Message[], message: Message | null): Message[] {
  if (!message) return messages
  return [...messages, message]
}

/**
 * A typed message is rendered immediately, then the SDK echoes the same turn
 * back through `onMessage`. Match the echo against what we are still waiting on
 * so the bubble is not drawn twice.
 */
export function consumeEcho(
  awaiting: string[],
  message: Message,
): { echoed: boolean; awaiting: string[] } {
  if (message.role !== 'user') return { echoed: false, awaiting }

  const index = awaiting.indexOf(message.text)
  if (index === -1) return { echoed: false, awaiting }

  const remaining = awaiting.slice()
  remaining.splice(index, 1)
  return { echoed: true, awaiting: remaining }
}
