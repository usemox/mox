import { parseHTML } from 'linkedom'

export function cleanHtml(html: string, returnType: 'html' | 'text' = 'html'): string {
  if (!html) return ''

  try {
    const { document } = parseHTML(html)

    document.querySelectorAll('script').forEach((element) => {
      element.parentNode?.removeChild(element)
    })

    document.querySelectorAll('style').forEach((element) => {
      element.parentNode?.removeChild(element)
    })

    const quoteContainers = document.querySelectorAll(
      '.gmail_quote_container, .gmail_quote, .x_gmail_quote, .x_gmail_quote_container'
    )
    quoteContainers.forEach((element) => {
      element.parentNode?.removeChild(element)
    })

    if (returnType === 'html') {
      return document.documentElement.innerHTML
    } else {
      return (document.documentElement?.textContent ?? '').trim()
    }
  } catch (error) {
    console.error('Error cleaning HTML', error)
    return html
  }
}
