import { useCallback, useState } from 'react'
import { cn } from '@renderer/lib/utils'
import { composeStore, RecipientType } from '@renderer/stores/compose'
import { Badge } from '@renderer/components/ui/badge'
import { AutoComplete, AutoCompleteItem } from '@renderer/components/ui/autocomplete'
import { XIcon } from '@renderer/components/icons/x'
import { EmailComposerProps, INPUT_STYLE } from './compose'
import { observer } from 'mobx-react-lite'
import { contactsStore } from '@renderer/stores/contacts'
import { Button } from '../ui/button'

interface RecipientInputProps {
  composeId: string
  recipientType: RecipientType
  placeholder: string
  contacts: AutoCompleteItem<string>[]
  isLoading: boolean
  handleRecipientSelect: (value: string, type: RecipientType) => void
  handleRemoveRecipient: (email: string) => void
  fetchContacts: (searchQuery: string) => Promise<void>
}

const RecipientInput = observer(
  ({
    composeId,
    recipientType,
    placeholder,
    contacts,
    isLoading,
    handleRecipientSelect,
    handleRemoveRecipient,
    fetchContacts
  }: RecipientInputProps) => {
    const compose = composeStore.getCompose(composeId)
    if (!compose) return null

    const recipients = Array.from(compose.recipients.entries()).filter(
      ([, type]) => type === recipientType
    )

    return (
      <div className="inline-flex flex-wrap items-center gap-2 w-full">
        {recipients.map(([email]) => (
          <Badge
            key={`${recipientType}-${email}`}
            variant="secondary"
            className="flex-none flex items-center gap-1 px-2 py-1 rounded-sm"
          >
            {email}
            <XIcon
              className="h-3 w-3 cursor-pointer"
              onClick={() => handleRemoveRecipient(email)}
            />
          </Badge>
        ))}
        <div className="flex-1 min-w-[200px]">
          <AutoComplete
            items={contacts}
            onSelectedValueChange={(value) => handleRecipientSelect(value, recipientType)}
            onSearchValueChange={fetchContacts}
            placeholder={placeholder}
            className={cn(INPUT_STYLE, 'w-full')}
            isLoading={isLoading}
          />
        </div>
      </div>
    )
  }
)

export const RecipientField = observer(({ composeId }: EmailComposerProps) => {
  const compose = composeStore.getCompose(composeId)
  const contacts = contactsStore.contacts
  const isLoading = contactsStore.isLoading

  const [showCC, setShowCC] = useState(false)

  const fetchContacts = useCallback(async (searchQuery: string) => {
    try {
      await contactsStore.getContacts(searchQuery)
    } catch (error) {
      console.error('Failed to fetch contacts:', error)
    }
  }, [])

  const handleRecipientSelect = useCallback(
    (value: string, type: RecipientType) => {
      composeStore.addRecipient(composeId, value, type)
    },
    [composeId]
  )

  const handleRemoveRecipient = useCallback(
    (email: string) => {
      composeStore.removeRecipient(composeId, email)
    },
    [composeId]
  )

  if (!compose) return null

  const sharedProps = {
    composeId,
    contacts,
    isLoading,
    handleRecipientSelect,
    handleRemoveRecipient,
    fetchContacts
  }

  return (
    <div className="flex flex-col relative items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setShowCC(!showCC)}
        className="absolute right-0 top-1 z-50 text-muted-foreground"
      >
        CC BCC
      </Button>
      <RecipientInput {...sharedProps} recipientType="to" placeholder="recipient@example.com" />
      {showCC && (
        <>
          <RecipientInput {...sharedProps} recipientType="cc" placeholder="cc" />
          <RecipientInput {...sharedProps} recipientType="bcc" placeholder="bcc" />
        </>
      )}
    </div>
  )
})
