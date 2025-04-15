import { useCallback } from 'react'
import { cn } from '@renderer/lib/utils'
import { composeStore } from '@renderer/stores/compose'
import { Badge } from '@renderer/components/ui/badge'
import { AutoComplete } from '@renderer/components/ui/autocomplete'
import { XIcon } from '@renderer/components/icons/x'
import { EmailComposerProps, INPUT_STYLE } from './compose'
import { observer } from 'mobx-react-lite'
import { contactsStore } from '@renderer/stores/contacts'

export const RecipientField = observer(({ composeId }: EmailComposerProps) => {
  const compose = composeStore.getCompose(composeId)
  const contacts = contactsStore.contacts
  const isLoading = contactsStore.isLoading

  // Fetch contacts with debounce
  const fetchContacts = useCallback(async (searchQuery: string) => {
    try {
      console.log('fetching contacts', searchQuery)
      await contactsStore.getContacts(searchQuery)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    }
  }, [])

  const handleRecipientSelect = useCallback(
    (value: string) => {
      console.log('handleRecipientSelect', value)
      composeStore.addRecipient(composeId, value, 'to')
    },
    [composeId]
  )

  const handleRemoveRecipient = useCallback(
    (email: string) => {
      console.log('handleRemoveRecipient', email)
      composeStore.removeRecipient(composeId, email)
    },
    [composeId]
  )

  if (!compose) return null

  return (
    <div className="inline-flex flex-wrap items-center gap-2 w-full">
      {Array.from(compose.recipients.entries()).map(([email, type]) => (
        <Badge
          key={email}
          variant="secondary"
          className="flex-none flex items-center gap-1 px-2 py-1 rounded-sm"
        >
          {type !== 'to' && <span className="text-xs text-muted-foreground">{type}:</span>}
          {email}
          <XIcon className="h-3 w-3 cursor-pointer" onClick={() => handleRemoveRecipient(email)} />
        </Badge>
      ))}
      <div className="flex-1 min-w-[200px]">
        <AutoComplete
          items={contacts}
          onSelectedValueChange={handleRecipientSelect}
          onSearchValueChange={fetchContacts}
          placeholder="recipient@example.com"
          className={cn(INPUT_STYLE, 'w-full')}
          isLoading={isLoading}
        />
      </div>
    </div>
  )
})
