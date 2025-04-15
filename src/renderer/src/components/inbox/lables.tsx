import type { JSX } from 'react'
import { cn } from '@renderer/lib/utils'
import { Badge } from '@renderer/components/ui/badge'

export const Labels = ({
  labels,
  type
}: {
  labels: string[]
  type?: 'primary' | 'secondary'
}): JSX.Element | null => {
  if (labels.length === 0) return null

  return (
    <>
      <Badge
        key={labels[0]}
        variant="outline"
        className={cn(
          'px-1.5 rounded-sm font-semibold h-5 bg-transparent border-blue-400/40 text-blue-300/60',
          {
            'bg-primary text-primary-foreground border-primary': type === 'primary'
          }
        )}
      >
        {labels[0].toUpperCase()}
      </Badge>
      {labels.length > 1 && (
        <Badge
          variant="outline"
          className={cn('px-1.5 rounded-sm font-medium text-foreground/40 h-5', {
            'bg-primary text-primary-foreground': type === 'primary'
          })}
        >
          +{labels.length - 1}
        </Badge>
      )}
    </>
  )
}
