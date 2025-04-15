import { useState, useCallback, useRef } from 'react'

export const useGenerate = (): {
  text: string
  isLoading: boolean
  error: string | null
  generate: (body: string, type: 'write' | 'improve') => Promise<void>
} => {
  const [text, setText] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isGenerating = useRef(false)

  const generate = useCallback(async (body: string, type: 'write' | 'improve') => {
    if (isGenerating.current) return

    setIsLoading(true)
    setError(null)
    setText('')

    try {
      isGenerating.current = true
      await window.api.emails.generateEmail(
        body,
        type,
        (chunk) => setText((prev) => prev + chunk),
        () => setIsLoading(false)
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate summary')
    } finally {
      setIsLoading(false)
      isGenerating.current = false
    }
  }, [])

  return { text, isLoading, error, generate }
}
