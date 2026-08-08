import { describe, expect, it } from 'vitest'
import { appendMessage, consumeEcho, toMessage, type Message } from './messages'

describe('toMessage', () => {
  it('maps the ai source onto the agent role', () => {
    expect(toMessage({ message: 'hello', source: 'ai' }, 'm1')).toEqual({
      id: 'm1',
      role: 'agent',
      text: 'hello',
    })
  })

  it('maps the user source onto the user role', () => {
    expect(toMessage({ message: 'hi', source: 'user' }, 'm1')?.role).toBe('user')
  })

  it('prefers the explicit role over the deprecated source', () => {
    expect(toMessage({ message: 'hi', source: 'ai', role: 'user' }, 'm1')?.role).toBe('user')
  })

  it('trims surrounding whitespace', () => {
    expect(toMessage({ message: '  spaced  ', source: 'ai' }, 'm1')?.text).toBe('spaced')
  })

  it('returns null for an empty turn', () => {
    expect(toMessage({ message: '', source: 'ai' }, 'm1')).toBeNull()
    expect(toMessage({ message: '   ', source: 'ai' }, 'm1')).toBeNull()
  })
})

describe('appendMessage', () => {
  it('appends to the end', () => {
    const first = { id: 'm1', role: 'user' as const, text: 'a' }
    const second = { id: 'm2', role: 'agent' as const, text: 'b' }
    expect(appendMessage([first], second)).toEqual([first, second])
  })

  it('returns the same array reference when there is nothing to add', () => {
    const messages = [{ id: 'm1', role: 'user' as const, text: 'a' }]
    expect(appendMessage(messages, null)).toBe(messages)
  })

  it('does not mutate the input', () => {
    const messages = [{ id: 'm1', role: 'user' as const, text: 'a' }]
    appendMessage(messages, { id: 'm2', role: 'agent', text: 'b' })
    expect(messages).toHaveLength(1)
  })
})

describe('consumeEcho', () => {
  const user = (text: string): Message => ({ id: 'x', role: 'user', text })
  const agent = (text: string): Message => ({ id: 'x', role: 'agent', text })

  it('flags a user turn we already rendered and drops it from the queue', () => {
    expect(consumeEcho(['hello'], user('hello'))).toEqual({ echoed: true, awaiting: [] })
  })

  it('lets a user turn we did not type through', () => {
    expect(consumeEcho(['hello'], user('spoken out loud'))).toEqual({
      echoed: false,
      awaiting: ['hello'],
    })
  })

  it('never suppresses an agent turn', () => {
    expect(consumeEcho(['hello'], agent('hello'))).toEqual({
      echoed: false,
      awaiting: ['hello'],
    })
  })

  it('consumes one entry at a time when the same text was sent twice', () => {
    const first = consumeEcho(['ok', 'ok'], user('ok'))
    expect(first).toEqual({ echoed: true, awaiting: ['ok'] })

    const second = consumeEcho(first.awaiting, user('ok'))
    expect(second).toEqual({ echoed: true, awaiting: [] })

    // A third identical turn is genuinely spoken, so it must render.
    expect(consumeEcho(second.awaiting, user('ok')).echoed).toBe(false)
  })

  it('does not mutate the queue it was given', () => {
    const awaiting = ['hello']
    consumeEcho(awaiting, user('hello'))
    expect(awaiting).toEqual(['hello'])
  })
})
