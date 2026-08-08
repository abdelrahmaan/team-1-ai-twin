import { APP_NAME } from '../config'
import { ChevronDownIcon, SlidersIcon } from './icons'

export function Header() {
  return (
    <header className="flex items-center justify-between px-5 py-4">
      <div className="flex items-center gap-1.5">
        <span className="text-xl font-semibold tracking-tight">{APP_NAME}</span>
        <ChevronDownIcon className="h-4 w-4 text-neutral-900" />
      </div>
      <button
        type="button"
        aria-label="Settings"
        className="rounded-lg p-1.5 text-neutral-900 transition-colors hover:bg-neutral-100"
      >
        <SlidersIcon className="h-5 w-5" />
      </button>
    </header>
  )
}
