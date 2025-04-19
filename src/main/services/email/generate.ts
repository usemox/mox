import { streamText } from 'ai'
import { cleanHtml } from '../utils'
import { emailRepository } from '../database/email'
import { emailService } from '.'
import { aiProviderService, AIProvider } from '../ai_providers'

// NOTE: this is a work in progress, we need to make it smarter, and user modifiable
const WRITE_PROMPT = `You are a helpful assistant. Your goal is to craft clear, concise, and persuasive emails.

*Using the given CONTEXT, use the following guidelines to generate email body:*
- Understand the Objective
- Clearly define the sender's goal—whether it's persuasion, informing, requesting, updating, or thanking.

*Structure Clearly:*
- Brief, polite greeting.
- Clear opening sentence summarizing the email's purpose.
- Concise paragraphs using natural language that is easy to read and quickly comprehensible.
- Utilize minimal HTML formatting (only essential text formatting like bold, italics) to enhance readability without overwhelming the reader.
- End with a clear, succinct call-to-action (if applicable).
- Brief, polite closing with sender's name.

*Psychological Techniques:*
- Respect cognitive load by eliminating jargon, redundancy, and filler words.
- Use short sentences and paragraphs.
- Prioritize the most important information upfront.

*Formatting Rules:* 
- Minimalist HTML formatting (no headers, no markdown)
- Clean paragraphs separated by <p> tags
- No <body> or <html> tags
- Use <b> <i> <u> <s> tags for bold, italics, underline, and strikethrough only when necessary

Be careful, we want the email to sound like the person who is using the platform.

SAMPLE EMAILS FOR TONE AND LANGUAGE:
{{ sample_emails }}

PERSONAL DETAILS:
{{ personal_details }}

Now, using the above examples and CONTEXT below, follow these guidelines precisely to generate clear, concise, and psychologically optimized email body.`

// NOTE: this is a work in progress, we need to make it smarter, and user modifiable
const IMPROVE_PROMPT = `You are a helpful assistant that improves emails.

You will need to improve the language of the email body based on the inforamtion provided:
- Brief, polite greeting.
- Clear opening sentence summarizing the email's purpose.
- Concise paragraphs using natural language that is easy to read and quickly comprehensible.
- Utilize minimal HTML formatting (only essential text formatting like bold, italics) to enhance readability without overwhelming the reader.
- End with a clear, succinct call-to-action (if applicable).
- Brief, polite closing with sender's name.

Psychological Techniques:
- Respect cognitive load by eliminating jargon, redundancy, and filler words.
- Use short sentences and paragraphs.
- Prioritize the most important information upfront.

Formatting Rules:
- Minimalist HTML formatting (no headers, no markdown)
- Clean paragraphs separated by <p> tags
- No <body> or <html> tags
- Use <b> <i> <u> <s> tags for bold, italics, underline, and strikethrough only when necessary

Be careful, we want the email to sound like the person who is using the platform.

SAMPLE EMAILS FOR TONE AND LANGUAGE:
{{ sample_emails }}

PERSONAL DETAILS:
{{ personal_details }}

Now, using the above examples and CONTEXT below, follow these guidelines precisely to improve the email body.`

export const generateEmail = async (
  body: string,
  type: 'write' | 'improve'
): Promise<ReadableStream<string>> => {
  const cleanBody = cleanHtml(body, 'text')

  let systemPrompt = type === 'write' ? WRITE_PROMPT : IMPROVE_PROMPT

  const sentMails = await emailRepository.getRecentEmails(3, 0, 'SENT')
  const profile = await emailService.getProfile()

  if (sentMails.length > 0) {
    const sampleEmails = sentMails
      .map((mail) => cleanHtml(mail.body?.html ?? '', 'html'))
      .join('\n')
    systemPrompt = systemPrompt.replace('{{ sample_emails }}', sampleEmails)
  }

  if (profile?.emailAddress) {
    systemPrompt = systemPrompt.replace('{{ personal_details }}', profile.emailAddress)
  }

  const openai = await aiProviderService.getClient(AIProvider.OpenAI)

  const result = streamText({
    model: openai('gpt-4o'),
    system: systemPrompt,
    prompt: `CONTEXT: ${cleanBody}
    EMAIL BODY:`
  })

  return result.textStream
}
