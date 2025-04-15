import type { JSX } from 'react'

export const Shortcut = ({ shortcut, label }: { shortcut: string; label: string }): JSX.Element => (
  <div className="flex text-xs items-center gap-1 justify-center text-foreground/50">
    Press
    <kbd className="px-2 py-0.5 rounded-sm text-muted-foreground bg-muted/50 border border-border/50">
      {shortcut}
    </kbd>
    to {label}
  </div>
)
