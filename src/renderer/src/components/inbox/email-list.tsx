import { observer } from 'mobx-react-lite'
import { memo, useCallback, useRef, type JSX } from 'react'
import { emailStore } from '@renderer/stores/email'
import { useNavigate } from '@tanstack/react-router'
import { KeyBinding, useKeyBindings } from '@renderer/hooks/use-key-bindings'
import { Button } from '@renderer/components/ui/button'
import { EmailItem } from './email-item'
import { Email } from '@/types/email'
import { Skeleton } from '@renderer/components/ui/skeleton'
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso'

type EmailListProps = {
  emails: Email[]
  showLoadMore?: boolean
  loading?: boolean
}

export const VirtualizedEmailList = observer(function Inbox({
  emails,
  showLoadMore = true,
  loading = false
}: EmailListProps): JSX.Element {
  const navigate = useNavigate()

  const bindings: KeyBinding[] = [
    {
      combo: { key: 'ArrowDown' },
      handler: (): void => {
        const result = emailStore.selectNextEmail()
        scrollToIndexByThreadId(result?.index)
      }
    },
    {
      combo: { key: 'ArrowUp' },
      handler: (): void => {
        const result = emailStore.selectPreviousEmail()
        scrollToIndexByThreadId(result?.index)
      }
    },
    {
      combo: { key: '/' },
      handler: (): Promise<void> => navigate({ to: '/search' })
    },
    {
      combo: { key: 'Enter', meta: true },
      handler: (): void => {
        if (!emailStore.focusThreadId) return
        emailStore.toggleEmailSelection(emailStore.focusThreadId)
      }
    },
    {
      combo: { key: 'Enter', shift: true },
      handler: (): void => {
        if (!emailStore.focusThreadId) return
        emailStore.selectEmails([emailStore.focusThreadId], true)
      }
    },
    {
      combo: { key: 'Enter' },
      handler: (): void => {
        if (!emailStore.focusThreadId) return
        navigate({
          to: '/threads/$threadId',
          params: { threadId: emailStore.focusThreadId }
        })
      }
    },
    {
      combo: { key: 'a', meta: true },
      handler: async (): Promise<void> => {
        emailStore.selectAll()
      }
    },
    {
      combo: { key: 'a' },
      handler: async (): Promise<void> => {
        if (!emailStore.focusThreadId) return Promise.resolve()
        const idToArchive = emailStore.focusThreadId
        emailStore.selectNextEmail()
        return emailStore.archiveEmails([idToArchive])
      }
    }
  ]

  const virtuosoRef = useRef<VirtuosoHandle>(null)

  const scrollToIndexByThreadId = useCallback((index: number | undefined): void => {
    if (index && virtuosoRef.current) {
      virtuosoRef.current.scrollIntoView({
        index: index,
        behavior: 'smooth'
      })
    }
  }, [])

  useKeyBindings(bindings)

  if (loading) return <EmailListLoading />

  return (
    <Virtuoso
      ref={virtuosoRef}
      data={emails}
      context={{
        focusThreadId: emailStore.focusThreadId,
        showLoadMore: showLoadMore && emails.length > 0
      }}
      fixedItemHeight={46}
      increaseViewportBy={200}
      itemContent={(_, email, { focusThreadId }) => {
        return (
          <div
            key={email.id}
            style={{ height: 46, paddingTop: 4, paddingBottom: 4 }}
            onMouseEnter={(): void => {
              emailStore.setfocusThreadId(email.threadId)
            }}
          >
            <EmailItem email={email} isFocused={focusThreadId === email.threadId} />
          </div>
        )
      }}
      components={{ Footer }}
    />
  )
})

export const NonVirtualizedEmailList = memo(({ emails, loading }: EmailListProps): JSX.Element => {
  if (loading) return <EmailListLoading />

  return (
    <div className="flex flex-col gap-2">
      {emails.map((email) => (
        <EmailItem key={email.id} email={email} />
      ))}
    </div>
  )
})

const Footer = observer(
  ({ context: { showLoadMore } }: { context: { showLoadMore: boolean } }): JSX.Element => (
    <div className="flex justify-center items-center py-2">
      <Button
        variant="outline"
        className="w-full"
        size="sm"
        onClick={(): Promise<void> => emailStore.fetchNextEmails()}
        hidden={emailStore.reachedEnd || !showLoadMore}
      >
        Load More Emails
      </Button>
    </div>
  )
)

export const EmailListLoading = (): JSX.Element => (
  <div className="flex flex-col space-y-2 px-4 py-4">
    {Array.from({ length: 4 }).map((_, index) => (
      <div
        key={index}
        className="group flex items-center gap-4 py-2 px-4 rounded-lg border border-border/50"
      >
        <div className="flex-shrink-0 w-48">
          <Skeleton className="h-4 w-24 rounded-sm" />
        </div>
        <div className="flex-grow min-w-0">
          <Skeleton className="h-4 w-full rounded-sm" />
        </div>
        <div className="flex-shrink-0 w-32 text-sm text-muted-foreground">
          <Skeleton className="h-5 w-32 rounded-sm" />
        </div>
      </div>
    ))}
  </div>
)
