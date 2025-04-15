import { Attachment, EmailFolder } from '@/types/email'
import type { gmail_v1 } from 'googleapis'

type EmailHeaders = {
  from: string
  to: string
  cc: string
  bcc: string
  subject: string
  date: string
}

export const parseEmailHeaders = (
  headers: gmail_v1.Schema$MessagePartHeader[] = []
): EmailHeaders => {
  return {
    from: headers.find((h) => h.name === 'From')?.value ?? '',
    to: headers.find((h) => h.name === 'To')?.value ?? '',
    cc: headers.find((h) => h.name === 'Cc')?.value ?? '',
    bcc: headers.find((h) => h.name === 'Bcc')?.value ?? '',
    subject: headers.find((h) => h.name === 'Subject')?.value?.trim() ?? '',
    date: headers.find((h) => h.name === 'Date')?.value ?? ''
  }
}

export interface ParsedMessage {
  text: string
  html: string
  attachments: Attachment[]
}

export function decodeBase64(data: string): Buffer {
  data = data.replace(/-/g, '+').replace(/_/g, '/')
  return Buffer.from(data, 'base64')
}

function processPart(part: gmail_v1.Schema$MessagePart, parsed: ParsedMessage): void {
  // Recursively process nested parts
  if (part.parts && part.parts.length) {
    part.parts.forEach((subPart) => processPart(subPart, parsed))
    return
  }

  const mimeType = part.mimeType ?? ''
  const bodyData = part.body?.data

  // Handle text content
  if ((mimeType === 'text/plain' || mimeType === 'text/html') && bodyData) {
    const decoded = decodeBase64(bodyData).toString('utf8')

    if (mimeType === 'text/plain') {
      parsed.text += decoded
    } else if (mimeType === 'text/html') {
      parsed.html += decoded
    }
  }
  // Handle attachments
  else if (part.body?.attachmentId && part.filename && part.filename.length > 0) {
    const contentIdHeader = part.headers?.find((h) => h.name?.toLowerCase() === 'content-id')
    const contentId = contentIdHeader?.value?.replace(/[<>]/g, '')

    parsed.attachments.push({
      mimeType,
      fileName: part.filename,
      data: undefined,
      attachmentId: part.body?.attachmentId,
      contentId
    })
  }
}

export function parseGmailMessage(message: gmail_v1.Schema$Message): ParsedMessage {
  const parsed: ParsedMessage = {
    text: '',
    html: '',
    attachments: []
  }

  if (!message.payload) return parsed

  // Process the message payload as a part
  processPart(message.payload, parsed)

  return parsed
}

export function getFolderFromGmailLabels(labelIds: string[] | undefined | null): EmailFolder {
  if (!labelIds || labelIds.length === 0) {
    return 'ARCHIVE'
  }

  if (labelIds.includes('TRASH')) {
    return 'TRASH'
  }
  if (labelIds.includes('SPAM')) {
    return 'SPAM'
  }
  if (labelIds.includes('DRAFT')) {
    return 'DRAFTS'
  }
  if (labelIds.includes('SENT')) {
    return 'SENT'
  }
  if (labelIds.includes('INBOX')) {
    return 'INBOX'
  }

  return 'ARCHIVE'
}
