import { createContext, useCallback, useContext, useEffect, useRef } from 'react'
import type { ReactNode, JSX } from 'react'

type KeyCombo = {
  key: string
  ctrl?: boolean
  alt?: boolean
  meta?: boolean
  shift?: boolean
}

export type KeyBinding = {
  combo: KeyCombo
  handler: (event: KeyboardEvent) => void
}

type KeyBindingsContextType = {
  registerBindings: (id: string, bindings: KeyBinding[]) => void
  unregisterBindings: (id: string) => void
}

const normalizeKeyCombo = (event: KeyboardEvent): KeyCombo => ({
  key: event.key.toLowerCase(),
  ctrl: event.ctrlKey,
  alt: event.altKey,
  meta: event.metaKey,
  shift: event.shiftKey
})

const matchesKeyCombo = (combo: KeyCombo, event: KeyboardEvent): boolean => {
  const target = event.target as HTMLElement
  // Allow shortcuts with meta key even in input fields
  if (
    combo.key.toLowerCase() !== 'escape' &&
    (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
  ) {
    return false
  }

  const normalized = normalizeKeyCombo(event)
  return (
    combo.key.toLowerCase() === normalized.key &&
    !!combo.ctrl === normalized.ctrl &&
    !!combo.meta === normalized.meta &&
    !!combo.alt === normalized.alt &&
    !!combo.shift === normalized.shift
  )
}

const KeyBindingsContext = createContext<KeyBindingsContextType | null>(null)

export function KeyBindingsProvider({ children }: { children: ReactNode }): JSX.Element {
  const bindingsMapRef = useRef<[string, KeyBinding[]][]>([])

  const registerBindings = useCallback((id: string, bindings: KeyBinding[]) => {
    bindingsMapRef.current = bindingsMapRef.current.filter(([existingId]) => existingId !== id)
    bindingsMapRef.current.push([id, bindings])
  }, [])

  const unregisterBindings = useCallback((id: string) => {
    bindingsMapRef.current = bindingsMapRef.current.filter(([existingId]) => existingId !== id)
  }, [])

  const handleKeyEvent = useCallback((event: KeyboardEvent) => {
    const allBindings = bindingsMapRef.current
      .slice()
      .reverse()
      .flatMap(([, bindings]) => bindings)

    for (const binding of allBindings) {
      if (matchesKeyCombo(binding.combo, event)) {
        event.preventDefault()
        event.stopPropagation()
        binding.handler(event)
        break
      }
    }
  }, [])

  useEffect(() => {
    const handler = handleKeyEvent
    window.addEventListener('keydown', handler, { passive: false })

    return (): void => {
      window.removeEventListener('keydown', handler)
      bindingsMapRef.current = []
    }
  }, [handleKeyEvent])

  return (
    <KeyBindingsContext.Provider value={{ registerBindings, unregisterBindings }}>
      {children}
    </KeyBindingsContext.Provider>
  )
}

export function useKeyBindings(bindings: KeyBinding[]): void {
  const context = useContext(KeyBindingsContext)
  const id = useRef(crypto.randomUUID()).current

  useEffect(() => {
    if (!context) {
      throw new Error('useKeyBindings must be used within a KeyBindingsProvider')
    }

    context.registerBindings(id, bindings)
    return (): void => context.unregisterBindings(id)
  }, [context, bindings, id])
}
