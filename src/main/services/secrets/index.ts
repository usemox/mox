import * as keytar from 'keytar'
import type { Credential } from '@/types/settings'

const SERVICE_PREFIX = 'com.mox.secrets.'

class SecretsManager {
  private getServiceName(id: string): string {
    return `${SERVICE_PREFIX}${id}`
  }

  /**
   * @param id - A unique identifier for the secret (e.g., 'openai_key').
   * @param secret - The secret value to store.
   * @returns A promise that resolves when the operation is complete.
   */
  async storeCredential(id: string, secret: string): Promise<void> {
    await keytar.setPassword(this.getServiceName(id), id, secret)
  }

  /**
   * @param id - The unique identifier of the secret to retrieve.
   * @returns A promise that resolves with the secret string, or null if not found.
   */
  async getCredential(id: string): Promise<string | null> {
    return keytar.getPassword(this.getServiceName(id), id)
  }

  /**
   * @returns A promise that resolves with an array of Credential objects.
   */
  async getAllCredentials(): Promise<Credential[]> {
    const rawCredentials = await keytar.findCredentials(SERVICE_PREFIX)

    return rawCredentials.map((cred) => ({
      id: cred.account,
      secret: '*'.repeat(cred.password.length)
    }))
  }

  /**
   * @param id - The unique identifier of the secret to delete.
   * @returns A promise that resolves with true if deletion was successful, false otherwise.
   */
  async deleteCredential(id: string): Promise<boolean> {
    return keytar.deletePassword(this.getServiceName(id), id)
  }

  /**
   * @param token - The authentication token to store.
   */
  async storeAuthToken(token: string): Promise<void> {
    await this.storeCredential('auth_token', token)
  }

  /**
   * @returns A promise that resolves with the auth token, or null if not found.
   */
  async getAuthToken(): Promise<string | null> {
    return this.getCredential('auth_token')
  }

  async deleteAuthToken(): Promise<boolean> {
    return this.deleteCredential('auth_token')
  }
}

const secretsManager = new SecretsManager()
export default secretsManager
