import { useState, type JSX } from 'react'
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from '../ui/dialog'
import { EmailComposer } from './compose'
import { composeStore } from '@renderer/stores/compose'
import { KeyBinding, useKeyBindings } from '@renderer/hooks/use-key-bindings'
import { MenubarButton } from '@renderer/components/ui/menubar'
import { ComposeIcon } from '../icons'

export const NewEmail = (): JSX.Element => {
  const [composeId, setComposeId] = useState<string | undefined>()

  const closeCompose = (): void => {
    if (composeId) composeStore.closeCompose(composeId)
    setComposeId(undefined)
  }

  const openCompose = (): void => {
    setComposeId(composeStore.createNewCompose())
  }

  const bindings: KeyBinding[] = [
    {
      combo: { key: 'Escape' },
      handler: closeCompose
    },
    {
      combo: { key: 'c' },
      handler: (): void => {
        openCompose()
      }
    }
  ]

  useKeyBindings(bindings)

  return (
    <Dialog open={!!composeId}>
      <DialogTrigger asChild>
        <MenubarButton onClick={openCompose}>
          <ComposeIcon className="w-3 h-3 mr-2 text-primary/70" /> New
        </MenubarButton>
      </DialogTrigger>
      <DialogContent className="p-0 border-0" aria-describedby={undefined}>
        <DialogTitle className="hidden" />
        <div>
          {composeId && (
            <EmailComposer composeId={composeId} onDelete={closeCompose} onSend={closeCompose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
