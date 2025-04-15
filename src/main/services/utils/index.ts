import { parseHTML } from 'linkedom'

export function cleanHtml(html: string, returnType: 'html' | 'text' = 'html'): string {
  if (!html) return ''

  try {
    const { document } = parseHTML(
      html
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    )

    const quoteContainers = document.querySelectorAll(
      '.gmail_quote_container, .gmail_quote, .x_gmail_quote, .x_gmail_quote_container'
    )
    quoteContainers.forEach((element) => {
      element.parentNode?.removeChild(element)
    })

    return returnType === 'html' ? document.body.innerHTML : document.body.textContent?.trim() || ''
  } catch (error) {
    console.error('Error cleaning HTML')
    return html
  }
}
