import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { cleanHtml } from '../utils'

class EmbeddingService {
  #extractor: FeatureExtractionPipeline | null = null

  async #getExtractor(): Promise<FeatureExtractionPipeline> {
    if (this.#extractor === null) {
      try {
        this.#extractor = await pipeline<'feature-extraction'>(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2'
        )
      } catch (error) {
        console.error('Failed to initialize embedding model:', error)
        throw new Error('Embedding model initialization failed.')
      }
    }
    return this.#extractor
  }

  /**
   * @param value - Text content to embed.
   * @returns Array<number> of embeddings.
   */
  async generateTextEmbedding(value: string): Promise<Array<number>> {
    if (!value || value.trim().length === 0) {
      console.warn('Attempted to generate embedding for empty string.')
      return [] // Return empty array for empty input
    }
    try {
      const extractorInstance = await this.#getExtractor()
      const output = await extractorInstance(value, { pooling: 'mean', normalize: true })
      // Return the first element as tolist() returns a nested array e.g., [[0.1, 0.2, ...]]
      return output.tolist()[0]
    } catch (error) {
      console.error('Error generating local text embeddings:', error)
      return [] // Return empty array on error
    }
  }

  /**
   * @param subject - Email subject.
   * @param body - Email body (HTML or plain text).
   * @returns Array<number> of embeddings.
   */
  async generateEmailEmbedding(subject: string | null, body: string): Promise<Array<number>> {
    const contentToEmbed = [subject || '', cleanHtml(body, 'text')].join('\n\n').trim()
    return this.generateTextEmbedding(contentToEmbed)
  }
}

export const embeddingService = new EmbeddingService()
