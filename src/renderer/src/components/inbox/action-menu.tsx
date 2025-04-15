import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList
} from '@renderer/components/ui/command'
import { Popover, PopoverContent, PopoverTrigger } from '@renderer/components/ui/popover'

import { useState, type JSX } from 'react'
import { ArchiveIcon, DoneIcon, StarIcon, TrashIcon, XIcon, LabelIcon } from '../icons'
import { useKeyBindings, KeyBinding } from '@renderer/hooks/use-key-bindings'
import { emailStore } from '@renderer/stores/email'

export const ActionMenu = (): JSX.Element => {
  const [activeIndex, setActiveIndex] = useState(0)
  const [open, setOpen] = useState(false)

  const bindings: KeyBinding[] = [
    {
      combo: { key: 'ArrowRight' },
      handler: (): void => setActiveIndex((i) => (i + 1) % icons.length)
    },
    {
      combo: { key: 'ArrowLeft' },
      handler: (): void => setActiveIndex((i) => (i - 1 + icons.length) % icons.length)
    },
    {
      combo: { key: 'Enter' },
      handler: (): void => {
        const icon = icons[activeIndex]
        if (icon.callback) {
          icon.callback()
        }
      }
    },
    {
      combo: { key: 'Escape' },
      handler: (): void => {
        emailStore.unselectAll()
      }
    }
  ]

  useKeyBindings(bindings)

  const icons = [
    { icon: StarIcon, callback: (): void => console.log('Star clicked') },
    {
      icon: DoneIcon,
      callback: async (): Promise<void> => {
        await emailStore.markAsRead(emailStore.selectedThreads)
        emailStore.unselectAll()
      }
    },
    {
      icon: ArchiveIcon,
      callback: async (): Promise<void> => {
        await emailStore.archiveEmails(emailStore.selectedThreads)
        emailStore.unselectAll()
      }
    },
    { icon: TrashIcon, callback: (): void => console.log('Trash clicked') },
    { icon: LabelIcon, callback: (): void => setOpen((open) => !open) }
  ]

  return (
    <div className="flex gap-2">
      <Wrapper>
        <div className="relative">
          {icons.slice(0, -1).map(({ icon: Icon, callback }, index) => (
            <button
              key={index}
              onClick={callback}
              onMouseEnter={() => setActiveIndex(index)}
              className="p-2 rounded-full relative z-10 cursor-pointer"
            >
              <Icon className="h-5 w-5 text-gray-300" />
            </button>
          ))}
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
              <button
                onMouseEnter={() => setActiveIndex(4)}
                className="p-2 rounded-full relative z-10 cursor-pointer outline-none"
              >
                <LabelIcon className="h-5 w-5 text-gray-300" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="max-w-40 p-0" side="top" align="center" sideOffset={14}>
              <LabelActions setOpen={setOpen} />
            </PopoverContent>
          </Popover>

          {/* Sliding Background */}
          <div
            className="absolute top-0 left-0 h-full bg-gradient-to-br from-[#fff]/15 to-white/10 rounded-full transition-transform duration-200 ease-in-out"
            style={{
              width: `calc(100%/${icons.length})`,
              transform: `translateX(${activeIndex * 100}%)`
            }}
          />
        </div>
        <div className="absolute top-0 left-0 w-full h-full rounded-full pointer-events-none">
          <div className="absolute -top-1 -left-16 w-full h-1/3 bg-gradient-to-br from-black to-transparent rounded-full blur-md" />
        </div>
      </Wrapper>
      <Wrapper>
        <button
          onClick={() => emailStore.unselectAll()}
          className="p-2 rounded-full relative z-10 cursor-pointer transition-colors duration-200 hover:bg-white/10"
        >
          <XIcon className="h-5 w-5 text-gray-300" />
        </button>
      </Wrapper>
    </div>
  )
}

const Wrapper = ({ children }: { children: React.ReactNode }): JSX.Element => (
  <div className="p-2 overflow-hidden bg-white/4 backdrop-blur-md rounded-full shadow-[0_10px_20px_rgba(0,0,0,0.3)] border border-white/5 flex items-center">
    {children}
  </div>
)

const LabelActions = ({ setOpen }: { setOpen: (open: boolean) => void }): JSX.Element => (
  <Command>
    <CommandInput placeholder="Change label..." />
    <CommandList>
      <CommandEmpty>No results found.</CommandEmpty>
      <CommandGroup>
        {lables.map((label) => (
          <CommandItem
            key={label.value}
            value={label.value}
            onSelect={(): void => {
              setOpen(false)
              emailStore.addLabels(emailStore.selectedThreads, [label.value])
            }}
          >
            <span>{label.label}</span>
          </CommandItem>
        ))}
      </CommandGroup>
    </CommandList>
  </Command>
)

type Label = {
  value: string
  label: string
}

const lables: Label[] = [
  {
    value: 'personal',
    label: 'Personal'
  },
  {
    value: 'updates',
    label: 'Updates'
  },
  {
    value: 'promotions',
    label: 'Promotions'
  },
  {
    value: 'social',
    label: 'Social'
  }
]
