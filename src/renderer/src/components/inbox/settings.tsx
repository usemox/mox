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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@renderer/components/ui/tabs'
import settingsStore from '@renderer/stores/settings'
import { SettingsIcon, XIcon } from '../icons'
import { SyncBadge } from '../sync-badge'
import { TiptapEditor } from '../editor'
import { useTiptapEditor } from '../editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { PromptType } from '@/types/settings'

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
    <DialogContent className="flex flex-col sm:max-w-[725px] h-[60vh]">
      <DialogHeader>
        <DialogTitle>MOX Settings</DialogTitle>
        <DialogDescription />
      </DialogHeader>
      <Tabs defaultValue="account" className="w-full h-full overflow-y-hidden">
        <TabsList>
          <TabsTrigger value="credentials">Credentials</TabsTrigger>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
        </TabsList>
        <TabsContent value="credentials" className="flex flex-col gap-4 h-full">
          <p className="text-xs text-muted-foreground">
            Manage third-party account credentials and environment variables required for some
            features. They are securely stored in your system&apos;s keychain.
          </p>
          <div className="flex">
            <NewCredential />
          </div>
          <div className="flex gap-2 flex-col overflow-y-auto">
            <Credentials />
          </div>
        </TabsContent>
        <TabsContent value="prompts" className="flex flex-col gap-4 h-full">
          <p className="text-xs text-muted-foreground">
            Manage your custom prompts used used by MOX when making LLM calls.
          </p>
          <Prompts />
        </TabsContent>
      </Tabs>
      <SyncStatus />
    </DialogContent>
  </Dialog>
)

const SyncStatus = observer(() => (
  <div className="absolute top-2 right-2">
    <SyncBadge syncStatus={settingsStore.syncStatus} />
  </div>
))

const Credentials = observer(() => {
  if (settingsStore.credentials.size === 0) {
    return (
      <p className="text-xs text-muted-foreground self-center">
        No credentials found, add one above
      </p>
    )
  }

  return Array.from(settingsStore.credentials.values()).map((cred) => (
    <Credential key={cred.id} id={cred.id} secret={cred.secret} />
  ))
})

const Credential = memo(
  ({ id, secret }: { id: string; secret: string }): JSX.Element => (
    <div className="grid grid-cols-[1fr_3fr] items-center gap-2">
      <Label htmlFor={`cred-${id}`} className="text-right truncate pr-2">
        {id}
      </Label>
      <div className="relative">
        <Input
          type="password"
          id={`cred-${id}`}
          placeholder={secret}
          onChange={(e) => settingsStore.upsertSecret(id, e.target.value)}
          className="col-span-1 pr-8"
        />
        <button
          className="absolute right-2 top-1/2 transform -translate-y-1/2 cursor-pointer text-secondary-foreground/60 rounded-full p-0.5 border"
          onClick={() => settingsStore.removeSecret(id)}
          aria-label={`Remove ${id} credential`}
        >
          <XIcon className="w-3 h-3 bg-black" />
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

const Prompts = observer(() => {
  const [selectedPrompt, setSelectedPrompt] = useState<PromptType>('IMPROVE_EMAIL')

  const { editor } = useTiptapEditor({
    onUpdate: (html) => {
      settingsStore.upsertPrompt(selectedPrompt, { id: selectedPrompt, prompt: html })
    },
    content: settingsStore.getPrompt(selectedPrompt)?.prompt ?? ''
  })

  return (
    <div className="relative h-full">
      <Select
        value={selectedPrompt}
        onValueChange={(value: PromptType) => setSelectedPrompt(value)}
      >
        <SelectTrigger
          onClick={(e) => e.stopPropagation()}
          size="sm"
          className="w-[180px] border-dashed absolute z-10 right-2 top-2"
        >
          <SelectValue placeholder="Select a prompt" />
        </SelectTrigger>
        <SelectContent>
          {Array.from(settingsStore.prompts.keys()).map((promptId) => (
            <SelectItem key={promptId} value={promptId}>
              {promptId}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <TiptapEditor
        editor={editor}
        disabled={!selectedPrompt}
        className="border w-full h-full flex-grow border-border/50 rounded-md border-dashed"
      />
    </div>
  )
})
