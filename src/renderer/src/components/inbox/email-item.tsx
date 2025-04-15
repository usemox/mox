import { memo, type JSX } from 'react'
import { Email } from '@/types/email'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { cn } from '@renderer/lib/utils'
import { parseEmail } from '@/utils/index'
import { Badge } from '../ui/badge'
import { emailStore } from '@renderer/stores/email'
import { Labels } from './lables'

export const EmailItem = memo(
  ({ email }: { email: Email }): JSX.Element => (
    <Link
      to="/threads/$threadId"
      onClick={(e): void => {
        if (e.metaKey) {
          e.preventDefault()
          e.stopPropagation()
          emailStore.toggleEmailSelection(email.threadId)
        } else if (e.shiftKey) {
          e.preventDefault()
          e.stopPropagation()
          emailStore.selectEmails([email.threadId], true)
        }
      }}
      params={{ threadId: email.threadId ?? email.id }}
      className="flex min-w-0 flex-1 items-center gap-4 py-2 px-4"
    >
      <div className="w-48 shrink-0">
        <EmailSender sender={email.fromAddress} />
      </div>
      <div className="flex-1 min-w-0">
        <div
          className={cn('flex items-center gap-2 text-foreground/60', {
            'text-foreground': email.unread
          })}
        >
          {email.folder === 'DRAFTS' && (
            <Badge className="text-xxs" variant="secondary">
              Draft
            </Badge>
          )}
          <Labels labels={email.labels ?? []} />
          <span className="truncate shrink-0 text-sm">{email.subject?.slice(0, 50)}</span>
          <span className="truncate text-sm text-muted-foreground/50">{email.snippet?.trim()}</span>
        </div>
      </div>
      <div className="w-36 shrink-0 text-right text-xs text-muted-foreground/50">
        {format(new Date(email.date), 'MMM dd, yyyy HH:mm')}
      </div>
    </Link>
  )
)
EmailItem.displayName = 'EmailItem'

export const EmailSender = memo(
  ({ sender, showEmail = false }: { sender: string; showEmail?: boolean }): JSX.Element => {
    const { name, email } = parseEmail(sender)

    return (
      <div className="flex flex-col">
        <span className="text-sm font-medium truncate">{name}</span>
        {showEmail && <span className="text-xs text-muted-foreground/50 truncate">{email}</span>}
      </div>
    )
  }
)
EmailSender.displayName = 'EmailSender'
