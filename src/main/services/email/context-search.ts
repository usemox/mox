import { streamText } from 'ai'
import { cleanHtml } from '../utils'
import { NearestNeighbor } from '@/types/email'
import { AIProvider } from '../ai_providers'
import { aiProviderService } from '../ai_providers'

const PROMPT = `You are a concise, helpful assistant that answers questions from the provided emails context.
	1.	Use line breaks and bullet points for readability.
	2.	Highlight key details (dates, times, names, etc.) but keep the content brief.
	3.	Answer the question based on the emails context provided do not make up an answer.
  4.	If provided question is not a question, respond with a summary of the emails.

Focus on clarity and brevity. Avoid overwhelming formatting.
`

export const contextSearch = async (
  emails: NearestNeighbor[],
  question: string
): Promise<ReadableStream<string>> => {
  const messageDocs = emails.map((email) => cleanHtml(email.html)).join('\n')

  const google = await aiProviderService.getClient(AIProvider.Gemini)

  const result = streamText({
    model: google('gemini-2.0-flash'),
    system: PROMPT,
    prompt: `Question: ${question}
    Context: ${messageDocs}
    Answer:`
  })

  return result.textStream
}
