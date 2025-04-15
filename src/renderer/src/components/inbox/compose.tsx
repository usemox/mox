import { observer } from 'mobx-react-lite'
import { memo, useCallback, useEffect } from 'react'
import type { JSX } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { Input } from '@renderer/components/ui/input'
import { composeStore } from '@renderer/stores/compose'
import { Button } from '../ui/button'
import { MagicIcon, MagicPenIcon, TrashIcon } from '../icons'
import { useGenerate } from '@renderer/hooks/use-generate'
import { RecipientField } from './recipients'
import { cn } from '@renderer/lib/utils'

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

const editorConfig = {
  extensions: [
    StarterKit.configure({
      bulletList: { HTMLAttributes: { class: 'list-disc pl-4' } },
      orderedList: { HTMLAttributes: { class: 'list-decimal pl-4' } }
    }),
    Link.configure({ openOnClick: false })
  ],
  editorProps: {
    attributes: {
      class:
        'prose prose-invert min-h-[200px] text-sm max-h-[500px] max-w-full overflow-y-auto p-3.5 focus:outline-none'
    }
  }
}

const ComposeBody = observer(({ composeId, onDelete, onSend }: EmailComposerProps) => {
  const { text, isLoading, generate } = useGenerate()

  const editor = useEditor({
    ...editorConfig,
    extensions: [...editorConfig.extensions],
    onUpdate: ({ editor }) => {
      composeStore.updateContent(composeId, editor.getHTML())
    }
  })

  const handleGenerate = useCallback(
    (type: 'write' | 'improve') => {
      const content = editor?.getHTML()
      if (content && content.length > 0) {
        generate(content, type)
      }
    },
    [editor, generate]
  )

  useEffect(() => {
    if (text) editor?.commands.setContent(text)
  }, [text, editor])

  const compose = composeStore.getCompose(composeId)
  if (!compose || !editor) return null

  return (
    <>
      <EditorContent
        disabled={isLoading}
        editor={editor}
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
  } & EmailComposerProps) => (
    <div className="p-3.5 flex justify-between items-center border-t border-border/50">
      <div className="flex gap-2">
        <Button
          variant="secondary"
          onClick={() => onGenerate('improve')}
          size="sm"
          aria-label="Improve"
          disabled={isLoading}
        >
          <MagicPenIcon />
          Improve
        </Button>
        <Button
          variant="secondary"
          onClick={() => onGenerate('write')}
          size="sm"
          aria-label="Generate"
          disabled={isLoading}
        >
          <MagicIcon />
          Generate
        </Button>
      </div>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            composeStore.closeCompose(composeId)
            onDelete?.()
          }}
        >
          <TrashIcon />
        </Button>
        <SendButton composeId={composeId} onSend={onSend} />
      </div>
    </div>
  )
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
