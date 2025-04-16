import { makeAutoObservable, observable, runInAction } from 'mobx'
import type { Credential } from '@/types/settings'
import { SyncStatus } from '@renderer/components/sync-badge'

class SettingsStore {
  credentials = observable.map<string, Credential>()
  syncStatus: SyncStatus = 'done'
  isLoading = false

  constructor() {
    makeAutoObservable(this)
  }

  async loadCredentials(): Promise<void> {
    runInAction(() => {
      this.isLoading = true
    })

    try {
      const result = await window.api.settings.getCredentials()
      if (result.success) {
        runInAction(() => {
          this.credentials.clear()
          result.data?.forEach((cred) => {
            this.credentials.set(cred.id, { id: cred.id, secret: cred.secret })
          })
        })
      } else {
        console.error('Failed to load credentials:', result.error)
      }
    } catch (error) {
      console.error('Credentials request failed:', error)
    } finally {
      runInAction(() => {
        this.isLoading = false
      })
    }
  }

  /**
   * @param id The unique ID of the credential.
   * @param secret The secret value (usually the user input).
   */
  upsertSecret(id: string, secret: string): void {
    if (!id) {
      console.warn('Cannot upsert secret: ID is required.')
      return
    }
    this.credentials.set(id, { id, secret })
  }

  /**
   * @param id The unique ID of the credential.
   * @param secret The secret value (usually the user input).
   */
  async saveCredential(id: string, secret: string): Promise<void> {
    if (!id || !secret) {
      console.warn('Cannot save credential: ID or secret is required.')
      return
    }

    runInAction(() => {
      this.syncStatus = 'pending'
    })

    try {
      const result = await window.api.settings.setCredential(id, secret)
      if (result.success) {
        runInAction(() => {
          this.syncStatus = 'done'
        })
      } else {
        console.error('Failed to sync credentials:', result.error)
        runInAction(() => {
          this.syncStatus = 'error'
        })
      }
    } catch (error) {
      console.error('Sync request failed:', error)
      runInAction(() => {
        this.syncStatus = 'error'
      })
    }
  }

  /**
   * @param id The ID of the credential to remove.
   */
  async removeSecret(id: string): Promise<void> {
    runInAction(() => {
      this.syncStatus = 'pending'
    })

    try {
      const result = await window.api.settings.deleteCredential(id)
      if (result.success) {
        runInAction(() => {
          this.credentials.delete(id)
          this.syncStatus = 'done'
        })
      } else {
        console.error('Failed to remove credential:', result.error)
        runInAction(() => {
          this.syncStatus = 'error'
        })
      }
    } catch (error) {
      console.error('Credential delete request failed:', error)
      runInAction(() => {
        this.syncStatus = 'error'
      })
    }
  }

  /**
   * @returns An array of CredentialState objects.
   */
  get currentCredentials(): Credential[] {
    return Array.from(this.credentials.values())
  }
}

const settingsStore = new SettingsStore()
export default settingsStore
