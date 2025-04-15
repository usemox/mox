import { createFileRoute } from '@tanstack/react-router'
import { Inbox, InboxLoading } from '@renderer/components/inbox'
import { emailStore } from '@renderer/stores/email'
import type { EmailFolder } from '@/types/email'

export const Route = createFileRoute('/$folder')({
  component: Inbox,
  pendingComponent: InboxLoading,
  loader: async ({ params }) => {
    const folder = params.folder as EmailFolder
    await emailStore.getProfile()
    emailStore.setCurrentFolder(folder)
    await emailStore.fetchEmails(50, 0, folder)
  }
})
