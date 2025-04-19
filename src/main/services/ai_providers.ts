import { createOpenAI, OpenAIProvider } from '@ai-sdk/openai'
import { createGoogleGenerativeAI, GoogleGenerativeAIProvider } from '@ai-sdk/google'

import secretsManager from './secrets'

export enum AIProvider {
  OpenAI = 'openai',
  Gemini = 'gemini'
}

const PROVIDER_SECRET_IDS: Record<AIProvider, string> = {
  [AIProvider.OpenAI]: 'OPENAI_API_KEY',
  [AIProvider.Gemini]: 'GOOGLE_GENERATIVE_AI_API_KEY'
}

type AIClient = OpenAIProvider | GoogleGenerativeAIProvider

class AIProviderService {
  private initializedClients = new Map<AIProvider, AIClient>()
  private initializationPromises = new Map<AIProvider, Promise<void>>()

  private async _initializeProvider(provider: AIProvider): Promise<void> {
    const secretId = PROVIDER_SECRET_IDS[provider]
    if (!secretId) {
      throw new Error(`Configuration error: No secret ID defined for provider '${provider}'.`)
    }

    try {
      const apiKey = await secretsManager.getCredential(secretId)

      if (!apiKey) {
        throw new Error(`API key ('${secretId}') for provider '${provider}' not found in secrets.`)
      }

      let client: AIClient
      switch (provider) {
        case AIProvider.OpenAI:
          client = createOpenAI({ apiKey: apiKey })
          break
        case AIProvider.Gemini:
          client = createGoogleGenerativeAI({ apiKey: apiKey })
          break
        default:
          client = provider
          throw new Error(`Initialization logic not implemented for provider '${client}'.`)
      }

      this.initializedClients.set(provider, client)
      console.info(`AI client for provider '${provider}' initialized successfully.`)
    } catch (error) {
      console.error(`Failed to initialize AI client for provider '${provider}':`, error)
      this.initializationPromises.delete(provider)
      this.initializedClients.delete(provider)
      throw error
    }
  }

  /**
   * @param provider The AI provider to initialize.
   * @returns A promise that resolves upon successful initialization for the provider.
   */
  public ensureInitialized(provider: AIProvider): Promise<void> {
    if (!this.initializationPromises.has(provider)) {
      const promise = this._initializeProvider(provider)
      this.initializationPromises.set(provider, promise)
    }
    return this.initializationPromises.get(provider)!
  }

  /**
   * @param provider The AI provider whose client is requested.
   * @returns A promise that resolves with the initialized AI client.
   */
  public async getClient(provider: AIProvider): Promise<AIClient> {
    await this.ensureInitialized(provider)

    const client = this.initializedClients.get(provider)
    if (!client) {
      throw new Error(`AI client for provider '${provider}' could not be initialized or retrieved.`)
    }

    return client
  }
}

export const aiProviderService = new AIProviderService()
