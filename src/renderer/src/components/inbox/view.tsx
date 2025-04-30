import { observer } from 'mobx-react-lite'
import { format, formatDistanceToNow } from 'date-fns'
import { cn } from '@renderer/lib/utils'
import { parseEmail } from '@/utils/index'
import { memo, useEffect, useMemo, useState, type JSX } from 'react'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Button } from '@renderer/components/ui/button'
import { EmailSender } from './email-item'
import { Route } from '@renderer/routes/threads.$threadId'
import { Link, useRouter } from '@tanstack/react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@renderer/components/ui/card'
import { useKeyBindings } from '@renderer/hooks/use-key-bindings'
import { Attachment, EmailThread } from '@/types/email'
import { EmailComposer } from './compose'
import { Accordion } from '@renderer/components/ui/accordion'
import { composeStore } from '@renderer/stores/compose'
import { Shortcut } from '@renderer/components/shortcut'
import EmailContent from './email-content'
import { emailStore } from '@renderer/stores/email'
import { useSummary } from '@renderer/hooks/use-summary'
import Markdown from 'marked-react'
import { SummarySkeleton } from './skelaton'
import { Expandable } from '@renderer/components/ui/expandable'
import { ArrowLeftIcon, ForwardIcon, TrashIcon, ReplyIcon, ArchiveIcon } from '../icons'
import { Labels } from './lables'

export const EmailView = observer(function EmailView(): JSX.Element {
  const router = useRouter()

  const handleArchive = (): void => {
    if (!thread) return
    emailStore.archiveEmails([thread.id])
    router.history.back()
  }

  useKeyBindings([
    {
      combo: { key: 'Escape' },
      handler: (): void => {
        router.navigate({ to: '/$folder', params: { folder: 'INBOX' } })
      }
    },
    {
      combo: { key: 'a' },
      handler: handleArchive
    },
    {
      combo: { key: 'j' },
      handler: (): void => {
        const result = emailStore.selectNextEmail()
        if (result?.nextId) {
          router.navigate({ to: '/threads/$threadId', params: { threadId: result.nextId } })
        }
      }
    },
    {
      combo: { key: 'k' },
      handler: (): void => {
        const result = emailStore.selectPreviousEmail()
        if (result?.previousId) {
          router.navigate({ to: '/threads/$threadId', params: { threadId: result.previousId } })
        }
      }
    }
  ])

  const { thread } = Route.useLoaderData()

  const labels = useMemo(
    () => [...new Set(thread?.messages.flatMap((email) => email.labels ?? []))],
    [thread]
  )

  if (!thread) return <EmailError />

  return (
    <div className="flex flex-col h-screen overflow-y-auto">
      <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md border-b border-border/30 shadow-md space-y-3 p-4 pt-10">
        <div className="flex flex-col gap-1">
          <h1 className="text-md font-semibold line-clamp-1">{thread.messages[0]?.subject}</h1>
          <div className="flex items-center gap-2">
            {labels.length > 0 && (
              <div className="flex items-center gap-1">
                <Labels labels={labels} type="primary" />
              </div>
            )}
            <div className="text-sm text-muted-foreground">
              {thread.messages.length} message{thread.messages.length === 1 ? '' : 's'} in this
              conversation
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => router.navigate({ to: '/$folder', params: { folder: 'INBOX' } })}
            variant="secondary"
            size="icon"
          >
            <ArrowLeftIcon />
          </Button>
          <Button variant="secondary" size="icon">
            <ReplyIcon />
          </Button>
          <Button variant="secondary" size="icon">
            <ForwardIcon />
          </Button>
          <Button onClick={handleArchive} variant="secondary" size="icon">
            <ArchiveIcon />
          </Button>
          <Button variant="secondary" size="icon">
            <TrashIcon />
          </Button>
        </div>
      </div>
      <div className="p-4 space-y-4">
        <Summary thread={thread} />
        <Thread thread={thread} />
        <ComposeForThread thread={thread} />
      </div>
    </div>
  )
})

const ComposeForThread = observer(function ComposeForThread({
  thread
}: {
  thread: EmailThread
}): JSX.Element {
  const activeCompose = composeStore.getCompose(thread.id)

  useKeyBindings([
    {
      combo: { key: 'r' },
      handler: (): void => {
        if (activeCompose) return
        const latestMessage = thread.messages[thread.messages.length - 1]
        composeStore.createNewCompose({
          ...latestMessage,
          toAddress: latestMessage.fromAddress,
          fromAddress: latestMessage.toAddress,
          recipients: new Map([[parseEmail(latestMessage.fromAddress).email, 'to']]),
          attachments: []
        })
      }
    },
    {
      combo: { key: 'd', meta: true },
      handler: (): void => {
        if (!activeCompose) return
        composeStore.closeCompose(activeCompose.id)
      }
    }
  ])

  return activeCompose ? (
    <EmailComposer composeId={activeCompose.id} />
  ) : (
    <Shortcut shortcut="r" label="reply to the thread" />
  )
})

const Thread = ({ thread }: { thread: EmailThread }): JSX.Element => {
  const [isExpanded, setIsExpanded] = useState(false)

  if (thread.messages.length <= 10) {
    return (
      <div className="flex flex-col space-y-4">
        {thread.messages.map((message) => (
          <MessageItem key={message.id} message={message} />
        ))}
      </div>
    )
  }

  const firstMessages = thread.messages.slice(0, 3)
  const lastMessages = thread.messages.slice(-3)
  const middleMessages = thread.messages.slice(3, -3)
  const hiddenCount = middleMessages.length

  return (
    <div className="flex flex-col space-y-4">
      {firstMessages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}

      {isExpanded ? (
        middleMessages.map((message) => <MessageItem key={message.id} message={message} />)
      ) : (
        <ExpandButton hiddenCount={hiddenCount} onClick={() => setIsExpanded(true)} />
      )}

      {lastMessages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  )
}

const ExpandButton = ({
  hiddenCount,
  onClick
}: {
  hiddenCount: number
  onClick: () => void
}): JSX.Element => (
  <div
    onClick={onClick}
    className="rounded-lg border border-border/50 p-3 text-center cursor-pointer hover:bg-accent hover:text-accent-foreground transition-colors"
  >
    <span className="text-sm font-medium">
      {hiddenCount} more email{hiddenCount === 1 ? '' : 's'} in this thread
    </span>
  </div>
)

const MessageItem = memo(
  ({ message }: { message: EmailThread['messages'][0] }): JSX.Element => (
    <div
      className={cn(
        'hover:border-orange-500/30 hover:shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]',
        'rounded-lg border border-border/50 p-4 transition-all duration-200'
      )}
    >
      <Accordion>
        <Accordion.Header className="flex justify-between items-center">
          <EmailSender sender={message.fromAddress} showEmail={true} />
          <div className="text-xs text-muted-foreground">
            {format(new Date(message.date), 'MMM d, yyyy HH:mm')}
            <span className="pl-1 italic">
              ({formatDistanceToNow(new Date(message.date), { addSuffix: true })})
            </span>
          </div>
        </Accordion.Header>
        <Accordion.Body>
          <EmailContent html={message.body?.html ?? message.body?.plain ?? ''} />
          {message.attachments && message.attachments.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border/50">
              <div className="text-xs font-medium text-muted-foreground mb-2">
                {message.attachments.length} Attachment{message.attachments.length > 1 ? 's' : ''}
              </div>
              <div className="flex flex-wrap gap-2">
                {message.attachments.map((attachment) => (
                  <AttachmentItem key={attachment.attachmentId} attachment={attachment} />
                ))}
              </div>
            </div>
          )}
        </Accordion.Body>
      </Accordion>
    </div>
  )
)
MessageItem.displayName = 'MessageItem'

const AttachmentItem = ({ attachment }: { attachment: Attachment }): JSX.Element => {
  const fileType = attachment.mimeType.split('/')[1]?.toUpperCase() || 'FILE'

  return (
    <div
      className="flex items-center gap-2 p-1 pr-3 rounded-md bg-accent/50 hover:bg-accent cursor-pointer transition-colors"
      title={attachment.fileName}
      onClick={() => emailStore.downloadAttachment(attachment.attachmentId)}
    >
      <div className="flex items-center justify-center w-8 h-6 rounded bg-primary/10 text-[8px] font-bold">
        {fileType.substring(0, 3)}
      </div>
      <div className="text-xs truncate max-w-[180px]">{attachment.fileName}</div>
    </div>
  )
}

const Summary = ({ thread }: { thread: EmailThread }): JSX.Element => {
  const { summary, isLoading, generateSummary } = useSummary()

  useEffect(() => {
    generateSummary(thread.id)
  }, [thread.id])

  return (
    <div
      className={cn(
        'w-full rounded-lg p-4 min-h-[134px]',
        'border border-orange-600/50 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]'
      )}
    >
      {isLoading && summary.length === 0 ? (
        <SummarySkeleton />
      ) : (
        <Expandable showButton={summary.length > 300}>
          <div className="text-sm prose max-w-none prose-sm prose-invert">
            <Markdown>{summary}</Markdown>
          </div>
        </Expandable>
      )}
    </div>
  )
}

const EmailError = (): JSX.Element => (
  <div className="flex min-h-svh items-center justify-center bg-gray-950/50 p-6">
    <Card className="w-full max-w-md border-border/50 shadow-md">
      <CardHeader className="text-center">
        <CardTitle className="text-xl">Something went wrong!</CardTitle>
        <CardDescription>We couldn&apos;t find the thread you were looking for.</CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <Link to="/$folder" params={{ folder: 'INBOX' }}>
          <Button variant="outline" size="sm">
            <ArrowLeftIcon /> Back to inbox
          </Button>
        </Link>
      </CardContent>
    </Card>
  </div>
)

export const EmailViewLoading = (): JSX.Element => (
  <div className="flex flex-col h-full">
    <div className="border-b border-border/50 space-y-4 p-6">
      <div className="flex flex-col space-y-2">
        <Skeleton className="h-6 w-1/2" />
        <Skeleton className="h-4 w-1/3" />
      </div>
      <div className="flex items-center gap-2">
        <Skeleton className="h-[36px] w-[36px] rounded" />
        <Skeleton className="h-[36px] w-[36px] rounded" />
        <Skeleton className="h-[36px] w-[36px] rounded" />
        <Skeleton className="h-[36px] w-[36px] rounded" />
        <Skeleton className="h-[36px] w-[36px] rounded" />
      </div>
    </div>
    <div className="flex-1 overflow-auto p-6">
      <div className="flex flex-col space-y-6">
        <div className="rounded-lg border border-border/50 p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-32 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </div>
            <Skeleton className="h-4 w-32 rounded" />
          </div>
          <div className="max-w-none rounded overflow-hidden">
            <div className="space-y-2">
              <Skeleton className="h-10 w-full rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)
