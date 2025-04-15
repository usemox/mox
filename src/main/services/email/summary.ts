import { emailRepository } from '../database/email'
import { openai } from '@ai-sdk/openai'
import { streamText } from 'ai'
import { cleanHtml } from '../utils'

// NOTE: this is a work in progress, we need to make it smarter, and user modifiable

const PROMPT = `You are a concise, helpful summarizer converting HTML emails into clear, easy-to-read text:
	1.	Remove all HTML tags.
  2.  Club summary if multiple followup emails are there!
	3.	Skip links, images, buttons—anything not purely text.
	4.	Include only the sender and the summary (no subject).
	5.	Use line breaks and relevant formatting for readability where necessary.
	6.	Highlight key details (dates, times, names, prices, etc.) but keep the content brief.
	7.	Remain in the email's original language.
  8.  Keep the timeline of the email in mind when summarizing.

Output each email as:

### [Sender]
Summary line 1 (less than 100 words)
Summary line 2 (less than 100 words)

Focus on clarity and brevity. Avoid overwhelming formatting.`

export const generateSummary = async (threadId: string): Promise<ReadableStream<string>> => {
  const thread = await emailRepository.getEmailThread(threadId)
  if (!thread) return new ReadableStream<string>()

  const messageDocs = thread.messages
    .map(
      (message) =>
        `### ${message.fromAddress} - ${message.subject}\n${cleanHtml(message.body?.html ?? '', 'text')}`
    )
    .join('\n')

  const result = streamText({
    model: openai('gpt-4o-mini'),
    system: PROMPT,
    prompt: `BEGINNING OF EMAIL HTML BODY:
    ${messageDocs}`
  })

  return result.textStream
}
