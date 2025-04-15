import { Button } from '@renderer/components/ui/button'
import { cn } from '@renderer/lib/utils'
import { useState } from 'react'
import type { JSX } from 'react'
import { ArrowDownIcon, ArrowUpIcon } from '../icons'

export const Expandable = ({
  showButton,
  children
}: {
  showButton?: boolean
  children: React.ReactNode
}): JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(!showButton)

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'relative flex flex-col gap-2 overflow-hidden transition-[max-height] duration-200 ease-in-out',
          isExpanded ? 'max-h-[1200px]' : 'max-h-[200px]'
        )}
      >
        {children}
        {!isExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent transition-opacity duration-300" />
        )}
      </div>
      {showButton && (
        <Button
          onClick={() => setIsExpanded(!isExpanded)}
          variant="link"
          className="mx-auto h-auto text-gray-500 hover:text-foreground"
        >
          <span className="flex items-center gap-2">
            {isExpanded ? (
              <>
                Show Less <ArrowUpIcon className="h-4 w-4" />
              </>
            ) : (
              <>
                Show More <ArrowDownIcon className="h-4 w-4" />
              </>
            )}
          </span>
        </Button>
      )}
    </div>
  )
}
Expandable.displayName = 'Expandable'
