import { observer } from 'mobx-react-lite'
import { memo, useCallback } from 'react'
import type { JSX } from 'react'
import { Input } from '@renderer/components/ui/input'
import { composeStore } from '@renderer/stores/compose'
import { Button } from '../ui/button'
import { AttachmentIcon, MagicIcon, MagicPenIcon, TrashIcon, XIcon } from '../icons'
import { useGenerate } from '@renderer/hooks/use-generate'
import { RecipientField } from './recipients'
import { cn } from '@renderer/lib/utils'
import { TiptapEditor, useTiptapEditor } from '../editor'
import { Badge } from '@renderer/components/ui/badge'

export type EmailComposerProps = {
  composeId: string
  onDelete?: () => void
  onSend?: () => void
}

export const EmailComposer = memo(({ composeId, onDelete, onSend }: EmailComposerProps) => (
  <div className="flex flex-col border border-border/50 rounded-md bg-muted/25">
    <div className="px-3.5 py-3">
      <RecipientField composeId={composeId} />
      <SubjectField composeId={composeId} />
    </div>
    <ComposeBody composeId={composeId} onDelete={onDelete} onSend={onSend} />
  </div>
))
EmailComposer.displayName = 'EmailComposer'

const SubjectField = observer(({ composeId }: EmailComposerProps) => {
  const compose = composeStore.getCompose(composeId)
  if (!compose) return null

  return (
    <Input
      id="subject"
      value={compose.subject ?? ''}
      onChange={(e) => composeStore.updateSubject(composeId, e.target.value)}
      placeholder="Subject"
      className={cn(INPUT_STYLE, 'font-medium text-foreground/90')}
    />
  )
})

const ComposeBody = observer(({ composeId, onDelete, onSend }: EmailComposerProps) => {
  const { text, isLoading, generate } = useGenerate()

  const { editor, getContent } = useTiptapEditor({
    onUpdate: (html) => composeStore.updateContent(composeId, html),
    content: text
  })

  const handleGenerate = useCallback(
    (type: 'write' | 'improve') => {
      const content = getContent()
      if (content && content.length > 0) {
        generate(content, type)
      }
    },
    [getContent, generate]
  )

  const compose = composeStore.getCompose(composeId)
  if (!compose || !editor) return null

  return (
    <>
      <TiptapEditor
        editor={editor}
        disabled={isLoading}
        className="border-t w-full border-border/50"
      />
      <EditorMenu
        onGenerate={handleGenerate}
        isLoading={isLoading}
        composeId={composeId}
        onDelete={onDelete}
        onSend={onSend}
      />
    </>
  )
})

const AttachmentList = observer(({ composeId }: { composeId: string }) => {
  const compose = composeStore.getCompose(composeId)
  if (!compose || compose.attachments.length === 0) return null

  const handleRemove = (path: string): void => {
    composeStore.removeAttachment(composeId, path)
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {compose.attachments.map((att) => (
        <Badge key={att.path} variant="outline" className="flex items-center h-8 gap-1.5">
          <span className="truncate max-w-[150px]" title={att.filename}>
            {att.filename}
          </span>
          <button
            onClick={() => handleRemove(att.path)}
            className="text-muted-foreground hover:text-destructive focus:outline-none"
            aria-label={`Remove ${att.filename}`}
          >
            <XIcon className="w-3 h-3" />
          </button>
        </Badge>
      ))}
    </ul>
  )
})

const EditorMenu = memo(
  ({
    onGenerate,
    isLoading,
    composeId,
    onDelete,
    onSend
  }: {
    onGenerate: (type: 'write' | 'improve') => void
    isLoading: boolean
  } & EmailComposerProps) => {
    const handleAttachFiles = async (): Promise<void> => {
      const selectedFiles = await window.api.files.select()
      if (selectedFiles) {
        selectedFiles.forEach((file) => {
          composeStore.addAttachment(composeId, file)
        })
      }
    }

    return (
      <div className="p-3.5 flex flex-col gap-3.5 border-t border-border/50">
        <AttachmentList composeId={composeId} />
        <div className="flex justify-between items-center">
          <div className="flex gap-2 items-center">
            <SendButton composeId={composeId} onSend={onSend} />
            <Button
              variant="ghost"
              onClick={handleAttachFiles}
              size="icon"
              aria-label="Attach files"
              className="text-muted-foreground"
            >
              <AttachmentIcon className="w-[18px] h-[18px]" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => onGenerate('improve')}
              size="icon"
              aria-label="Improve"
              disabled={isLoading}
              className="text-muted-foreground"
            >
              <MagicPenIcon className="w-[18px] h-[18px]" />
            </Button>
            <Button
              variant="ghost"
              onClick={() => onGenerate('write')}
              size="icon"
              aria-label="Generate"
              disabled={isLoading}
              className="text-muted-foreground"
            >
              <MagicIcon className="w-[18px] h-[18px]" />
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              size="icon"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                composeStore.closeCompose(composeId)
                onDelete?.()
              }}
            >
              <TrashIcon className="w-[18px] h-[18px]" />
            </Button>
          </div>
        </div>
      </div>
    )
  }
)
EditorMenu.displayName = 'EditorMenu'

const SendButton = observer(
  ({ composeId, onSend }: EmailComposerProps): JSX.Element => (
    <Button
      onClick={async () => {
        const res = await composeStore.markAsSent(composeId)
        if (res.status) onSend?.()
      }}
      size="sm"
      disabled={composeStore.isSending}
    >
      {composeStore.isSending ? 'Sending' : 'Send'}
    </Button>
  )
)

export const INPUT_STYLE =
  'border-0 w-full shadow-none outline-none focus:outline-none ring-0 focus:ring-0 focus-visible:ring-0 focus-visible:outline-none px-0 placeholder:text-muted-foreground/60'
