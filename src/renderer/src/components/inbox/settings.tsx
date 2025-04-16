import { Button } from '@renderer/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@renderer/components/ui/dialog'
import { Input } from '@renderer/components/ui/input'
import { Label } from '@renderer/components/ui/label'
import type { JSX } from 'react'
import { SettingsIcon } from '../icons'

export const Settings = (): JSX.Element => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button className="text-xs px-2 py-1 rounded-md bg-gray-400/10">
          <SettingsIcon className="w-3 h-3 text-secondary-foreground/50" />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[625px]">
        <DialogHeader>
          <DialogTitle>MOX Settings</DialogTitle>
          <DialogDescription>
            Some third party account credentials are required for some features to work.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <h2 className="text-lg font-semibold">Model Credentials</h2>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="name" className="text-right">
              OpenAI API Key
            </Label>
            <Input type="password" id="name" defaultValue="Pedro Duarte" className="col-span-3" />
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="username" className="text-right">
              Gemini API Key
            </Label>
            <Input type="password" id="username" defaultValue="@peduarte" className="col-span-3" />
          </div>
        </div>
        <DialogFooter>
          <Button type="submit">Save changes</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
