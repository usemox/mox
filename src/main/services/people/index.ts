import { google } from 'googleapis'
import type { people_v1 } from 'googleapis'
import { authService } from '../auth'

class PeopleService {
  private people: people_v1.People | null = null
  private readonly CACHE_TTL = 5 * 60 * 1000

  private clientExpiryTime: number = 0

  /**
   * Get a People client
   * @returns The People client
   */
  private async getPeopleClient(): Promise<people_v1.People> {
    const now = Date.now()
    if (!this.people || now > this.clientExpiryTime) {
      const auth = await authService.getAuthenticatedClient()
      this.people = google.people({ version: 'v1', auth })
      this.clientExpiryTime = now + this.CACHE_TTL
    }
    return this.people
  }

  /**
   * Retry an operation
   * @param operation - The operation to retry
   * @param retries - The number of retries
   * @param delay - The delay between retries
   * @returns The result of the operation
   */
  // private async retryOperation<T>(
  //   operation: () => Promise<T>,
  //   retries = 3,
  //   delay = 1000
  // ): Promise<T> {
  //   try {
  //     return await operation()
  //   } catch (error) {
  //     if (retries > 0 && this.isRetryableError(error)) {
  //       await new Promise((resolve) => setTimeout(resolve, delay))
  //       return this.retryOperation(operation, retries - 1, delay * 2)
  //     }
  //     console.error(error)
  //     throw new CustomPeopleError('Operation failed after retries', { cause: error })
  //   }
  // }

  /**
   * Check if an error is retryable
   * @param error - The error
   * @returns True if the error is retryable, false otherwise
   */
  // private isRetryableError(error: unknown): boolean {
  //   if (error instanceof Error) {
  //     return error.message.includes('429') || error.message.includes('503')
  //   }
  //   return false
  // }

  /**
   * Initialize a history watch for the user's inbox
   * @returns The history ID and expiration time
   */
  async getContacts(
    pageToken?: string
  ): Promise<{ connections: people_v1.Schema$Person[]; nextPageToken?: string }> {
    const people = await this.getPeopleClient()

    const { data } = await people.people.connections.list({
      resourceName: 'people/me',
      pageSize: 100,
      pageToken
    })

    return {
      connections: data.connections ?? [],
      nextPageToken: data.nextPageToken ?? undefined
    }
  }
}

export const peopleService = new PeopleService()
