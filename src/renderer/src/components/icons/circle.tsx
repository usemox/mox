import type { JSX } from 'react'

export const CircleIcon = ({ className }: { className?: string }): JSX.Element => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    width={24}
    height={24}
    className={className}
    fill={'none'}
  >
    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
)
