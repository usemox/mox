import type { JSX } from 'react'

export const SummarySkeleton = (): JSX.Element => (
  <div className="grid grid-cols-[repeat(40,1fr)] gap-1 h-[100px]">
    {Array.from({ length: 200 }).map((_, i) => (
      <div key={i} className="flex items-center justify-center">
        <div
          className="w-0.5 h-0.5 rounded-full bg-orange-600 animate-wave"
          style={{ animationDelay: `${(i % 40) * 0.05}s`, animationDuration: '2s' }}
        />
      </div>
    ))}
  </div>
)
