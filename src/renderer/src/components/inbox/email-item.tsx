import { memo, type JSX } from 'react'
import { Email } from '@/types/email'
import { Link } from '@tanstack/react-router'
import { format } from 'date-fns'
import { cn } from '@renderer/lib/utils'
import { parseEmail } from '@/utils/index'
import { Badge } from '../ui/badge'
import { emailStore } from '@renderer/stores/email'
import { Labels } from './lables'

export const ITEM_ACTIVE_STYLE = 'border-orange-500/30 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]'
export const ITEM_SELECTED_STYLE = 'bg-white/10 transition-all duration-200 ease-in-out'

export const EmailItem = memo(
  ({ email, isFocused }: { email: Email; isFocused?: boolean }): JSX.Element => (
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
      className={cn(
        'flex min-w-0 flex-1 items-center gap-4 py-2 px-4 rounded-md border border-border/50 cursor-pointer',
        {
          [ITEM_ACTIVE_STYLE]: isFocused,
          [ITEM_SELECTED_STYLE]: email.selected
        }
      )}
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
