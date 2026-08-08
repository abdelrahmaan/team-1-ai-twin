import { useConversation } from '@elevenlabs/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  appendMessage,
  consumeEcho,
  nextId,
  toMessage,
  type IncomingMessage,
  type Message,
} from '../lib/messages'

export type AgentState = 'idle' | 'connecting' | 'listening' | 'speaking'

/**
 * The single seam between this app and the ElevenLabs SDK. Everything below
 * this hook works with plain messages, a state string, and a 0..1 audio level.
 */
export function useAgent(agentId: string) {
  const [messages, setMessages] = useState<Message[]>([])
  const [error, setError] = useState<string | null>(null)

  /** Typed messages waiting to be sent once the session is up. */
  const queued = useRef<string[]>([])
  /** Typed messages already rendered, waiting for the SDK to echo them back. */
  const awaitingEcho = useRef<string[]>([])

  const conversation = useConversation({
    onConnect: () => setError(null),
    onMessage: (payload: IncomingMessage) => {
      const message = toMessage(payload, nextId())
      if (!message) return

      const { echoed, awaiting } = consumeEcho(awaitingEcho.current, message)
      awaitingEcho.current = awaiting
      if (echoed) return

      setMessages(current => appendMessage(current, message))
    },
    onError: (reason: unknown) => {
      setError(typeof reason === 'string' ? reason : 'Connection failed. Try again.')
    },
  })

  const { status, isSpeaking, startSession, endSession, sendUserMessage } = conversation

  // The conversation object is rebuilt each render; keep a stable handle for
  // effects and animation frames.
  const latest = useRef(conversation)
  latest.current = conversation

  // Flush anything typed before the session finished connecting.
  useEffect(() => {
    if (status !== 'connected' || queued.current.length === 0) return

    const pending = queued.current
    queued.current = []
    for (const text of pending) latest.current.sendUserMessage(text)
  }, [status])

  /** Opens a session unconditionally. Callers decide whether one is needed. */
  const openSession = useCallback(
    async (textOnly: boolean) => {
      if (!textOnly) {
        try {
          await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch {
          setError('Microphone access was blocked. You can still type.')
          return false
        }
      }

      setError(null)
      startSession({
        agentId,
        connectionType: textOnly ? 'websocket' : 'webrtc',
        textOnly,
      })
      return true
    },
    [agentId, startSession],
  )

  const waitForDisconnect = useCallback(async () => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      if (latest.current.status === 'disconnected') return
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }, [])

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed) return

      setMessages(current => appendMessage(current, { id: nextId(), role: 'user', text: trimmed }))
      awaitingEcho.current = [...awaitingEcho.current, trimmed]

      if (status === 'connected') {
        sendUserMessage(trimmed)
        return
      }

      // Held until onConnect; the effect above flushes the queue.
      queued.current = [...queued.current, trimmed]
      if (status !== 'connecting') await openSession(true)
    },
    [openSession, sendUserMessage, status],
  )

  const startVoice = useCallback(async () => {
    // A text-only socket cannot carry audio. Tear it down and reopen over
    // WebRTC, waiting for the teardown so the new session is not rejected.
    if (status !== 'disconnected') {
      endSession()
      await waitForDisconnect()
    }
    return openSession(false)
  }, [endSession, openSession, status, waitForDisconnect])

  const stop = useCallback(() => endSession(), [endSession])

  const state: AgentState =
    status === 'connecting'
      ? 'connecting'
      : status !== 'connected'
        ? 'idle'
        : isSpeaking
          ? 'speaking'
          : 'listening'

  /**
   * Read straight from the SDK on each animation frame rather than through
   * React state — 60 re-renders a second would make the whole page stutter.
   */
  const getLevel = useCallback(() => {
    if (latest.current.status !== 'connected') return 0
    return latest.current.isSpeaking
      ? latest.current.getOutputVolume()
      : latest.current.getInputVolume()
  }, [])

  return {
    messages,
    error,
    state,
    isConnected: status === 'connected',
    isMuted: conversation.isMuted,
    setMuted: conversation.setMuted,
    getLevel,
    send,
    startVoice,
    stop,
  }
}
