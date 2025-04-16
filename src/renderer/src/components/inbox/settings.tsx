import { KeyboardEvent, memo, useState, type JSX } from 'react'
import { observer } from 'mobx-react-lite'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import settingsStore from '@renderer/stores/settings'
import { SettingsIcon, XIcon } from '../icons'
import { SyncBadge } from '../sync-badge'

export const Settings = (): JSX.Element => (
  <Dialog>
    <DialogTrigger asChild>
      <button
        onClick={() => settingsStore.loadCredentials()}
        className="text-xs px-2 py-1 rounded-md bg-gray-400/10"
      >
        <SettingsIcon className="w-3 h-3 text-secondary-foreground/50" />
      </button>
    </DialogTrigger>
    <DialogContent className="sm:max-w-[625px]">
      <SyncStatus />
      <DialogHeader>
        <DialogTitle>MOX Settings</DialogTitle>
        <DialogDescription />
      </DialogHeader>
      <div className="grid gap-4 max-h-[40vh]">
        <div className="flex flex-col gap-1">
          <h2 className="text-md font-semibold">Credentials</h2>
          <p className="text-xs text-muted-foreground">
            Manage third-party account credentials and environment variables required for some
            features. They are securely stored in your system&apos;s keychain.
          </p>
        </div>
        <NewCredential />
        <Credentials />
      </div>
    </DialogContent>
  </Dialog>
)

const SyncStatus = observer(() => (
  <div className="absolute top-2 right-2">
    <SyncBadge syncStatus={settingsStore.syncStatus} />
  </div>
))

const Credentials = observer(() => (
  <>
    {settingsStore.currentCredentials.map((cred) => (
      <Credential key={cred.id} id={cred.id} secret={cred.secret} />
    ))}
  </>
))

const Credential = memo(
  ({ id, secret }: { id: string; secret: string }): JSX.Element => (
    <div className="grid grid-cols-[1fr_2fr_auto] items-center gap-2">
      <Label htmlFor={`cred-${id}`} className="text-right truncate pr-2">
        {id}
      </Label>
      <div className="relative">
        <Input
          type="password"
          id={`cred-${id}`}
          placeholder={secret}
          onChange={(e) => settingsStore.upsertSecret(id, e.target.value)}
          onBlur={() => settingsStore.saveCredential(id, secret)}
          className="col-span-1"
        />
        <button
          className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer text-secondary-foreground/60 rounded-full p-0.5 border"
          onClick={() => settingsStore.removeSecret(id)}
          aria-label={`Remove ${id} credential`}
        >
          <XIcon className="w-3 h-3" />
        </button>
      </div>
    </div>
  )
)
Credential.displayName = 'Credential'

const NewCredential = (): JSX.Element => {
  const [name, setName] = useState('')

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter' && name !== '') {
      settingsStore.upsertSecret(name, '')
      setName('')
    }
  }

  return (
    <Input
      placeholder="Enter a name and press Enter to save add a new credential"
      value={name}
      type="text"
      onChange={(e) => setName(formatToEnvVar(e.target.value))}
      onKeyDown={handleKeyDown}
    />
  )
}

const formatToEnvVar = (input: string): string => {
  return input
    .toUpperCase()
    .replace(/\s+/g, '_')
    .replace(/[^A-Z0-9_]/g, '')
}
