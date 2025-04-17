import type { JSX } from 'react'
import { observer } from 'mobx-react-lite'
import { useNavigate } from '@tanstack/react-router'
import { NewEmail } from '@renderer/components/inbox/new-mail'
import { Profile } from '@/types/email'

import {
  Menubar,
  MenubarButton,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarShortcut,
  MenubarTrigger
} from '@renderer/components/ui/menubar'
import { Separator } from '@renderer/components/ui/separator'
import { UserIcon, SearchIcon, FileIcon, MagicIcon } from '@renderer/components/icons'
import { useSyncEvent } from '@renderer/hooks/use-events'
import { Settings } from '@renderer/components/inbox/settings'
import { SyncBadge } from '@renderer/components/sync-badge'

export const MainNav = observer(function CategoriesNav({
  profile
}: {
  profile: Profile
}): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4 justify-between items-end z-50">
      <div className="m-2 flex gap-1">
        <SyncStatus />
        <Settings />
      </div>
      <div className="flex px-4 w-full items-center justify-between">
        <Menubar className="border-none bg-transparent">
          <MenubarMenu>
            <MenubarTrigger>
              <UserIcon className="w-4 h-4 mr-2 text-primary/80" />
              {profile.email}
            </MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                Logout <MenubarShortcut>⌘T</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <Separator orientation="vertical" className="bg-border" />
          <MenubarMenu>
            <MenubarTrigger>Inbox</MenubarTrigger>
            <MenubarContent>
              <MenubarItem onClick={() => navigate({ to: '/' })}>All Mail</MenubarItem>
              <MenubarSeparator />
              <MenubarItem onClick={() => navigate({ to: '/$folder', params: { folder: 'SENT' } })}>
                Sent
              </MenubarItem>
              <MenubarItem
                onClick={() => navigate({ to: '/$folder', params: { folder: 'DRAFTS' } })}
              >
                Drafts
              </MenubarItem>
              <MenubarItem
                onClick={() => navigate({ to: '/$folder', params: { folder: 'TRASH' } })}
              >
                Trash
              </MenubarItem>
              <MenubarItem onClick={() => navigate({ to: '/$folder', params: { folder: 'SPAM' } })}>
                Spam
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Categories</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>
                Personal <MenubarShortcut>⌘I</MenubarShortcut>
              </MenubarItem>
              <MenubarSeparator />
              <MenubarItem>
                Updates <MenubarShortcut>⌘U</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Social <MenubarShortcut>⌘S</MenubarShortcut>
              </MenubarItem>
              <MenubarItem>
                Promotions <MenubarShortcut>⌘P</MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <MenubarMenu>
            <MenubarTrigger>Views</MenubarTrigger>
            <MenubarContent>
              <MenubarItem>Newest</MenubarItem>
              <MenubarItem>Categories</MenubarItem>
              <MenubarItem>
                Priority
                <MenubarShortcut>
                  <MagicIcon className="w-2 h-2 text-primary/50" />
                </MenubarShortcut>
              </MenubarItem>
            </MenubarContent>
          </MenubarMenu>
          <Separator orientation="vertical" className="bg-border" />
          <MenubarMenu>
            <NewEmail />
            <MenubarButton onClick={() => navigate({ to: '/search' })}>
              <SearchIcon className="w-3 h-3 mr-2 text-primary/70" /> Search
            </MenubarButton>
            <MenubarButton onClick={() => navigate({ to: '/search' })}>
              <FileIcon className="w-3 h-3 mr-2 text-primary/70" /> Files
            </MenubarButton>
          </MenubarMenu>
        </Menubar>
      </div>
    </div>
  )
})

export const SyncStatus = (): JSX.Element => {
  const { isSyncing } = useSyncEvent()
  return <SyncBadge syncStatus={isSyncing ? 'pending' : 'done'} />
}
