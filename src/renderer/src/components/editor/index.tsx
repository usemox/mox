import { Editor, EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import { useCallback, useEffect } from 'react'
import { cn } from '@renderer/lib/utils'
import type { JSX } from 'react'

const defaultEditorConfig = {
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

interface UseTiptapEditorProps {
  onUpdate?: (html: string) => void
  content?: string
}

export const useTiptapEditor = ({
  onUpdate,
  content
}: UseTiptapEditorProps): {
  editor: Editor | null
  getContent: () => string
} => {
  const editor = useEditor({
    ...defaultEditorConfig,
    extensions: [...defaultEditorConfig.extensions],
    onUpdate: ({ editor }) => {
      onUpdate?.(editor.getHTML())
    }
  })

  useEffect(() => {
    if (typeof content === 'string' && editor) {
      editor.commands.setContent(content)
      onUpdate?.(content)
    }
  }, [content, editor])

  const getContent = useCallback(() => {
    return editor?.getHTML() ?? ''
  }, [editor])

  return {
    editor,
    getContent
  }
}

interface TiptapEditorProps {
  editor: Editor | null
  disabled?: boolean
  className?: string
}

export const TiptapEditor = ({ editor, disabled, className }: TiptapEditorProps): JSX.Element => {
  return <EditorContent disabled={disabled} editor={editor} className={cn('w-full', className)} />
}
