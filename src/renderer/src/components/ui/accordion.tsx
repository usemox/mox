import { cn } from '@renderer/lib/utils'
import type { JSX } from 'react'
import { createContext, useContext, useId } from 'react'
import { ArrowLeftIcon } from '../icons'

const AccordionContext = createContext<{ id: string } | null>(null)

interface AccordionRootProps {
  children: React.ReactNode
  className?: string
}

interface AccordionHeaderProps {
  children: React.ReactNode
  className?: string
}

interface AccordionBodyProps {
  children: React.ReactNode
  className?: string
}

export const Accordion = ({ children, className }: AccordionRootProps): JSX.Element => {
  const id = useId()
  return (
    <AccordionContext.Provider value={{ id }}>
      <div className={cn('group', className)}>{children}</div>
    </AccordionContext.Provider>
  )
}

const Header = ({ children, className }: AccordionHeaderProps): JSX.Element => {
  const context = useContext(AccordionContext)
  if (!context) throw new Error('Accordion.Header must be used within Accordion')

  return (
    <>
      <input type="checkbox" id={context.id} className="peer hidden" defaultChecked />
      <label htmlFor={context.id} className="flex items-center gap-2 w-full cursor-pointer">
        <div className={cn('flex-1 flex', className)}>{children}</div>
        <ArrowLeftIcon className="w-3 h-3 shrink-0" />
      </label>
    </>
  )
}

const Body = ({ children, className }: AccordionBodyProps): JSX.Element => {
  const context = useContext(AccordionContext)
  if (!context) throw new Error('Accordion.Body must be used within Accordion')

  return (
    <div
      className={cn(
        'grid overflow-hidden transition-all duration-200',
        'grid-rows-[0fr] peer-checked:grid-rows-[1fr]',
        className
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

Accordion.Header = Header
Accordion.Body = Body
