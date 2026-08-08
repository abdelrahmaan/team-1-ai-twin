type IconProps = { className?: string }

export function PlusIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="2">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

export function MicIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="1.8">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function MicOffIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="1.8">
      <rect x="9" y="3" width="6" height="11" rx="3" fill="currentColor" stroke="none" />
      <path
        d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3M4 3l16 18"
        stroke="currentColor"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function CloseIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="2.2">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeLinecap="round" />
    </svg>
  )
}

export function ArrowUpIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="2.2">
      <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function ChevronDownIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="2.4">
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SlidersIcon({ className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} strokeWidth="2">
      <path d="M4 8h10M18 8h2M4 16h4M12 16h8" stroke="currentColor" strokeLinecap="round" />
      <circle cx="16" cy="8" r="2.2" stroke="currentColor" />
      <circle cx="10" cy="16" r="2.2" stroke="currentColor" />
    </svg>
  )
}
