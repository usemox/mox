import { useState, useCallback, useRef } from 'react'

export const useSummary = (): {
  summary: string
  isLoading: boolean
  error: string | null
  generateSummary: (threadId: string) => Promise<void>
} => {
  const [summary, setSummary] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGenerating = useRef(false)

  const generateSummary = useCallback(async (threadId: string) => {
    if (isGenerating.current) return
    setIsLoading(true)
    setError(null)
    setSummary('')

    try {
      isGenerating.current = true
      await window.api.emails.generateSummary(
        threadId,
        (chunk) => setSummary((prev) => prev + chunk),
        () => setIsLoading(false)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setIsLoading(false)
      isGenerating.current = false
    }
  }, [])

  return { summary, isLoading, error, generateSummary }
}
