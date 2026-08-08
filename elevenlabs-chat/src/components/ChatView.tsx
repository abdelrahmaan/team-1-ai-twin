import { useEffect, useRef } from 'react'
import { APP_NAME } from '../config'
import type { Message } from '../lib/messages'
import { MessageBubble } from './MessageBubble'

export function ChatView({ messages }: { messages: Message[] }) {
  const end = useRef<HTMLDivElement>(null)

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages])

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6">
        <p className="text-2xl font-medium tracking-tight text-neutral-400">
          Talk to {APP_NAME}
        </p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-5 py-6">
        {messages.map(message => (
          <MessageBubble key={message.id} message={message} />
        ))}
        <div ref={end} />
      </div>
    </div>
  )
}
