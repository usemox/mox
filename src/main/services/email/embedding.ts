import { embed } from 'ai'
import { cleanHtml } from '../utils'
import { aiProviderService, AIProvider } from '../ai_providers'
/**
 * Generates embeddings for email content
 * @param content - Email content (HTML or plain text)
 * @returns Float32Array of embeddings
 */
export async function generateTextEmbedding(value: string): Promise<Array<number>> {
  try {
    const openai = await aiProviderService.getClient(AIProvider.OpenAI)
    const { embedding } = await embed({
      model: openai.embedding('text-embedding-3-small'),
      value
    })

    return embedding
  } catch (error) {
    console.error('Error generating embeddings:', error)
    return []
  }
}

/**
 * Generates embeddings for an email by combining subject and body
 * @param subject - Email subject
 * @param body - Email body (HTML or plain text)
 * @returns Float32Array of embeddings
 */
export async function generateEmailEmbedding(
  subject: string | null,
  body: string
): Promise<Array<number>> {
  const contentToEmbed = [subject || '', cleanHtml(body, 'text')].join('\n\n')
  return generateTextEmbedding(contentToEmbed)
}
