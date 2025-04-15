import { AttachmentFileData } from '@/types/email'

interface EmailContent {
  to: string
  from: string
  cc?: string
  bcc?: string
  subject: string
  references?: string
  inReplyTo?: string
  htmlBody: string
  attachments: AttachmentFileData[]
}

export const packageEmailContent = ({
  to,
  from,
  cc,
  bcc,
  subject,
  references,
  inReplyTo,
  htmlBody,
  attachments = []
}: EmailContent): string => {
  const messageId = generateMessageId(from)
  const boundary = generateBoundary()

  const emailParts = [
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    `Date: ${new Date().toUTCString()}`,
    `Message-ID: ${messageId}`,
    `From: ${from}`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    ...(references ? [`References: ${references}`] : []),
    ...(inReplyTo ? [`In-Reply-To: ${inReplyTo}`] : [])
  ]

  // Add HTML body part
  emailParts.push('', `--${boundary}`, 'Content-Type: text/html; charset=UTF-8', '', htmlBody)

  // Add attachment parts if any
  for (const attachment of attachments) {
    const base64Content = attachment.content.toString('base64')

    emailParts.push(
      '',
      `--${boundary}`,
      `Content-Type: ${attachment.type ?? 'application/octet-stream'}`,
      `Content-Transfer-Encoding: base64`,
      `Content-Disposition: attachment; filename="${attachment.name}"`,
      '',
      base64Content.match(/.{1,76}/g)?.join('\n') ?? base64Content
    )
  }

  emailParts.push('', `--${boundary}--`)
  const emailContent = emailParts.join('\r\n')

  return Buffer.from(emailContent)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

const generateBoundary = (): string => {
  return `${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`
}

const generateMessageId = (email: string): string => {
  const domain = email.split('@')[1]
  const randomPart = Math.random().toString(36).substring(2)
  const timestamp = Date.now()
  return `<${timestamp}.${randomPart}@${domain}>`
}
