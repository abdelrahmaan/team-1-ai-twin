import { useRef, type KeyboardEvent } from 'react'
import { ArrowUpIcon, CloseIcon, MicIcon, MicOffIcon, PlusIcon } from './icons'

type ComposerProps = {
  draft: string
  onDraftChange: (value: string) => void
  onSubmit: () => void
  mode: 'chat' | 'voice'
  onStartVoice: () => void
  onEndVoice: () => void
  isMuted: boolean
  onToggleMute: () => void
  error: string | null
}

export function Composer({
  draft,
  onDraftChange,
  onSubmit,
  mode,
  onStartVoice,
  onEndVoice,
  isMuted,
  onToggleMute,
  error,
}: ComposerProps) {
  const input = useRef<HTMLTextAreaElement>(null)
  const hasDraft = draft.trim().length > 0

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey) return
    event.preventDefault()
    onSubmit()
  }

  const grow = (value: string) => {
    onDraftChange(value)
    const node = input.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`
  }

  return (
    <div className="px-4 pb-6">
      <div className="mx-auto w-full max-w-3xl">
        {error && <p className="mb-2 px-2 text-sm text-red-500">{error}</p>}

        <div className="rounded-[28px] border border-neutral-200 bg-white px-4 py-3 shadow-[0_2px_18px_rgba(0,0,0,0.06)]">
          <textarea
            ref={input}
            rows={1}
            value={draft}
            onChange={event => grow(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type"
            className="w-full resize-none bg-transparent px-1 py-1.5 text-[16px] leading-6 outline-none placeholder:text-neutral-400"
          />

          <div className="mt-1 flex items-center justify-between">
            <button
              type="button"
              aria-label="Add attachment"
              className="rounded-full p-1.5 text-neutral-700 transition-colors hover:bg-neutral-100"
            >
              <PlusIcon className="h-5 w-5" />
            </button>

            <div className="flex items-center gap-2">
              {mode === 'voice' ? (
                <>
                  <button
                    type="button"
                    onClick={onToggleMute}
                    aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
                    className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-800 transition-colors hover:bg-neutral-200"
                  >
                    {isMuted ? (
                      <MicOffIcon className="h-5 w-5" />
                    ) : (
                      <MicIcon className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={onEndVoice}
                    aria-label="End voice conversation"
                    className="grid h-10 w-10 place-items-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700"
                  >
                    <CloseIcon className="h-5 w-5" />
                  </button>
                </>
              ) : hasDraft ? (
                <button
                  type="button"
                  onClick={onSubmit}
                  aria-label="Send message"
                  className="grid h-10 w-10 place-items-center rounded-full bg-neutral-900 text-white transition-colors hover:bg-neutral-700"
                >
                  <ArrowUpIcon className="h-5 w-5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onStartVoice}
                  aria-label="Start voice conversation"
                  className="grid h-10 w-10 place-items-center rounded-full bg-neutral-100 text-neutral-800 transition-colors hover:bg-neutral-200"
                >
                  <MicIcon className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
