import { createFileRoute } from '@tanstack/react-router'
import { EmailView, EmailViewLoading } from '@renderer/components/inbox/view'
import { emailStore } from '@renderer/stores/email'

export const Route = createFileRoute('/threads/$threadId')({
  loader: async ({ params: { threadId } }) => {
    const thread = await emailStore.fetchEmailThread(threadId)
    return {
      thread
    }
  },
  onEnter: async ({ params: { threadId } }) => {
    await emailStore.markAsRead([threadId])
  },
  component: EmailView,
  pendingComponent: EmailViewLoading
})
