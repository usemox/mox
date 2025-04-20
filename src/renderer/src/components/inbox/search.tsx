import { useEffect, useRef, useMemo, memo } from 'react'
import { observer } from 'mobx-react-lite'
import { Input } from '@renderer/components/ui/input'
import Markdown from 'marked-react'
import { cn } from '@renderer/lib/utils'
import { useSearch } from '@renderer/hooks/use-search'
import { SummarySkeleton } from './skelaton'
import { useKeyBindings } from '@renderer/hooks/use-key-bindings'
import { KeyBinding } from '@renderer/hooks/use-key-bindings'
import { useNavigate } from '@tanstack/react-router'
import { SearchIcon } from '../icons'
import { NonVirtualizedEmailList } from './email-list'

export const Search = observer(function Search() {
  const { isLoadingSummary, isLoadingReferences, error, search, references, summary } = useSearch()

  const isLoading = isLoadingSummary || isLoadingReferences
  const searchInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const bindings: KeyBinding[] = [
    {
      combo: { key: 'Escape' },
      handler: (): void => {
        navigate({ to: '/', search: { category: undefined } })
      }
    }
  ]

  useKeyBindings(bindings)

  const handleSearch = useMemo(() => {
    return async (query: string): Promise<void> => {
      if (!query.trim() || isLoading) return
      await search(query)
    }
  }, [isLoading, search])

  useEffect(() => {
    if (searchInputRef.current) searchInputRef.current.focus()
  }, [])

  return (
    <div className="flex flex-col h-full px-4 py-8 space-y-6">
      <div className="flex items-center space-x-2">
        <SearchIcon className="h-5 w-5 text-muted-foreground/40" />
        <Input
          ref={searchInputRef}
          className="text-xl py-6 border-none shadow-none focus-visible:ring-0 bg-background/50 placeholder:text-muted-foreground/40"
          placeholder="Ask a question about your emails..."
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSearch(e.currentTarget.value)
          }}
          disabled={isLoading}
        />
      </div>
      <NonVirtualizedEmailList emails={references} loading={isLoadingReferences} />
      <AnswerSection summary={summary} isLoading={isLoadingSummary} error={error} />
    </div>
  )
})

const AnswerSection = memo(
  ({
    summary,
    isLoading,
    error
  }: {
    summary: string
    isLoading: boolean
    error: string | null
  }) => {
    if (error) return <div className="text-red-500">{error}</div>
    if (!isLoading && summary.length === 0) return null

    return (
      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">Answer</h3>
        <div
          className={cn(
            'text-sm prose max-w-none prose-sm prose-invert w-full rounded-lg p-4 min-h-[134px]',
            'border border-orange-600/50 shadow-[0_0_15px_-3px_rgba(249,115,22,0.3)]'
          )}
        >
          {isLoading && summary.length === 0 ? <SummarySkeleton /> : <Markdown>{summary}</Markdown>}
        </div>
      </div>
    )
  }
)
AnswerSection.displayName = 'AnswerSection'

export default Search
