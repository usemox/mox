import { Command as CommandPrimitive } from 'cmdk'
import { useState } from 'react'
import { Command, CommandGroup, CommandItem, CommandList } from './command'
import { Input } from './input'
import { Popover, PopoverAnchor, PopoverContent } from './popover'
import type { JSX } from 'react'
import { LoadingIcon } from '../icons'

export type AutoCompleteItem<T> = {
  value: string
  label: string
  description: string
  data: T
}

type Props<T> = {
  onSelectedValueChange: (value: T) => void
  onSearchValueChange: (value: string) => void
  items: AutoCompleteItem<T>[]
  isLoading?: boolean
  emptyMessage?: string
  placeholder?: string
  value?: string
  className?: string
}

export function AutoComplete<T>({
  onSelectedValueChange,
  onSearchValueChange,
  items,
  value,
  isLoading,
  placeholder = 'Search...',
  className
}: Props<T>): JSX.Element {
  const [open, setOpen] = useState(false)

  const onSelectItem = (inputValue: AutoCompleteItem<T>): void => {
    onSearchValueChange('')
    onSelectedValueChange(inputValue.data)
    setOpen(false)
  }

  const shouldShowDropdown = Boolean(value?.trim())

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Command shouldFilter={false}>
        <PopoverAnchor asChild>
          <CommandPrimitive.Input
            asChild
            onValueChange={onSearchValueChange}
            onKeyDown={(e) => setOpen(e.key !== 'Escape')}
            onFocus={() => shouldShowDropdown && setOpen(true)}
            value={value}
          >
            <div className="relative flex items-center gap-2">
              <Input placeholder={placeholder} className={className} />
              {isLoading && (
                <LoadingIcon className="absolute right-2 h-4 w-4 animate-spin text-orange-300 drop-shadow-loading" />
              )}
            </div>
          </CommandPrimitive.Input>
        </PopoverAnchor>
        <PopoverContent
          asChild
          onOpenAutoFocus={(e) => e.preventDefault()}
          onInteractOutside={(e) => {
            if (e.target instanceof Element && e.target.hasAttribute('cmdk-input')) {
              e.preventDefault()
            }
          }}
          hidden={items.length === 0}
          className="w-[--radix-popover-trigger-width] min-w-[200px] p-0 bg-background left-0"
          align="start"
          sideOffset={4}
        >
          <CommandList>
            {items.length > 0 && !isLoading ? (
              <CommandGroup>
                {items.map((option) => (
                  <CommandItem
                    key={option.value}
                    value={option.value}
                    onMouseDown={(e) => e.preventDefault()}
                    onSelect={() => onSelectItem(option)}
                  >
                    <div className="flex flex-col">
                      <span className="text-sm">{option.label}</span>
                      <span className="text-xs text-muted-foreground">{option.description}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
          </CommandList>
        </PopoverContent>
      </Command>
    </Popover>
  )
}
