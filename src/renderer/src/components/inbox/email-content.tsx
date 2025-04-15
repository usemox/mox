import { adjustElementColor } from '@renderer/lib/colors'
import { useEffect, useRef } from 'react'
import type { JSX } from 'react'

const STYLES = `
:host {
  display: block;
  background: transparent;
  font-size: 13px;
  font-family: system-ui, -apple-system, sans-serif;
  color: #f0f0f0;
}
`

const EmailContent = ({ html }: { html: string }): JSX.Element => {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let wrapper: HTMLDivElement | null = null
    if (!container.shadowRoot) {
      const shadow = container.attachShadow({ mode: 'open' })

      const style = document.createElement('style')
      style.textContent = STYLES
      shadow.appendChild(style)

      wrapper = document.createElement('div')
      wrapper.innerHTML = html

      shadow.appendChild(wrapper)
    } else {
      wrapper = container.shadowRoot.querySelector('div')
      if (wrapper) wrapper.innerHTML = html
    }

    if (!wrapper) return

    const quote = wrapper.querySelector(
      '.gmail_quote_container, .gmail_quote, .x_gmail_quote, .x_gmail_quote_container'
    )
    if (quote) quote.remove()

    const elements = wrapper.querySelectorAll('*')
    if (elements) elements.forEach((el) => adjustElementColor(el as HTMLElement))
  }, [])

  return <div ref={containerRef} className="rounded-sm overflow-hidden mt-4" />
}

export default EmailContent
