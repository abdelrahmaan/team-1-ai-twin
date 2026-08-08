import type { Message } from '../lib/messages'

export function MessageBubble({ message }: { message: Message }) {
  if (message.role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="max-w-[75%] rounded-3xl bg-neutral-100 px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap">
          {message.text}
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-[85%] text-[15px] leading-relaxed whitespace-pre-wrap text-neutral-900">
      {message.text}
    </div>
  )
}
