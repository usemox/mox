import * as keytar from 'keytar'
import type { Credential } from '@/types/settings'

const SERVICE = 'com.mox.secrets'

class SecretsManager {
  /**
   * @param id - A unique identifier for the secret (e.g., 'openai_key').
   * @param secret - The secret value to store.
   * @returns A promise that resolves when the operation is complete.
   */
  async storeCredential(id: string, secret: string): Promise<void> {
    await keytar.setPassword(SERVICE, id, secret)
  }

  /**
   * @param id - The unique identifier of the secret to retrieve.
   * @returns A promise that resolves with the secret string, or null if not found.
   */
  async getCredential(id: string): Promise<string | null> {
    return keytar.getPassword(SERVICE, id)
  }

  /**
   * @returns A promise that resolves with an array of Credential objects.
   */
  async getAllCredentials(): Promise<Credential[]> {
    const rawCredentials = await keytar.findCredentials(SERVICE)

    return rawCredentials
      .filter((cred) => cred.account !== 'oauth-tokens')
      .map((cred) => ({
        id: cred.account,
        secret: '•'.repeat(cred.password.length)
      }))
  }

  /**
   * @param id - The unique identifier of the secret to delete.
   * @returns A promise that resolves with true if deletion was successful, false otherwise.
   */
  async deleteCredential(id: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE, id)
  }
}

const secretsManager = new SecretsManager()
export default secretsManager
