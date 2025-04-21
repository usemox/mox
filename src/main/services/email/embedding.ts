import { pipeline, type FeatureExtractionPipeline } from '@huggingface/transformers'
import { cleanHtml } from '../utils'
import path from 'path'
import { app } from 'electron'

class EmbeddingService {
  #extractor: FeatureExtractionPipeline | null = null

  private get cacheDir(): string {
    if (process.env.NODE_ENV === 'development') {
      return path.join(process.cwd(), 'cache', 'transformers')
    }

    return path.join(app.getPath('userData'), 'mox', 'cache', 'transformers')
  }

  async #getExtractor(): Promise<FeatureExtractionPipeline> {
    if (this.#extractor === null) {
      try {
        this.#extractor = await pipeline<'feature-extraction'>(
          'feature-extraction',
          'Xenova/all-MiniLM-L6-v2',
          {
            cache_dir: this.cacheDir
          }
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
      return []
    }
    try {
      const extractorInstance = await this.#getExtractor()
      const output = await extractorInstance(value, { pooling: 'mean', normalize: true })
      return output.tolist()[0]
    } catch (error) {
      console.error('Error generating local text embeddings:', error)
      return []
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
