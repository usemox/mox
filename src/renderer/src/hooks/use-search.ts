import { Email } from '@/types/email'
import { useState, useCallback, useRef, useEffect } from 'react'

export const useSearch = (): {
  summary: string
  isLoadingSummary: boolean
  isLoadingReferences: boolean
  error: string | null
  search: (query: string) => Promise<void>
  references: Email[]
} => {
  const [summary, setSummary] = useState('')
  const [references, setReferences] = useState<Email[]>([])
  const [isLoadingSummary, setIsLoadingSummary] = useState(false)
  const [isLoadingReferences, setIsLoadingReferences] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isSearching = useRef(false)

  useEffect(() => {
    console.log('test', summary)
  }, [summary])

  const search = useCallback(async (query: string) => {
    if (isSearching.current) return
    setIsLoadingSummary(true)
    setIsLoadingReferences(true)
    setError(null)
    setSummary('')

    try {
      isSearching.current = true
      await window.api.emails.search(
        query,
        (chunk) => setSummary((prev) => prev + chunk),
        () => setIsLoadingSummary(false),
        (emails) => {
          setIsLoadingReferences(false)
          setReferences(emails)
        }
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setIsLoadingSummary(false)
      setIsLoadingReferences(false)
      isSearching.current = false
    }
  }, [])

  return { summary, isLoadingSummary, isLoadingReferences, error, search, references }
}
