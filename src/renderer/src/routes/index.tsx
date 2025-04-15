import { createFileRoute } from '@tanstack/react-router'
import { Inbox, InboxLoading } from '@renderer/components/inbox'
import { emailStore } from '@renderer/stores/email'

export const Route = createFileRoute('/')({
  component: Inbox,
  pendingComponent: InboxLoading,
  loader: async () => {
    const folder = 'INBOX' as const
    await emailStore.getProfile()
    emailStore.setCurrentFolder(folder)
    await emailStore.fetchEmails(50, 0, folder)
  }
})
