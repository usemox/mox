import type { JSX } from 'react'
import { observer } from 'mobx-react-lite'
import { useNavigate } from '@tanstack/react-router'
import { motion, AnimatePresence } from 'framer-motion'
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
import { UserIcon, SearchIcon, FileIcon, MagicIcon, LoadingIcon } from '@renderer/components/icons'
import { useSyncEvent } from '@renderer/hooks/use-events'
import logo from '@renderer/assets/logo-dark.png'

export const MainNav = observer(function CategoriesNav({
  profile
}: {
  profile: Profile
}): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-4 justify-between items-end z-50">
      <div className="m-2">
        <SyncStatus />
      </div>
      <div className="flex px-4 w-full items-center justify-between">
        <img src={logo} alt="logo" className="w-10 h-10" />
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

  return (
    <div className="text-xs px-2 py-1 rounded-md bg-gray-400/10">
      <AnimatePresence>
        {isSyncing ? (
          <motion.div
            className="flex items-center gap-1 text-green-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <LoadingIcon className="w-4 h-4 animate-spin" /> Syncing
          </motion.div>
        ) : (
          <div className="text-xs text-secondary-foreground/50 flex items-center">Synced</div>
        )}
      </AnimatePresence>
    </div>
  )
}
