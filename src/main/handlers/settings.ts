import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../services/config'
import secretsManager from '../services/secrets'

export function setupSettingsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.SETTINGS.GET_CREDENTIALS, async () => {
    try {
      const credentials = await secretsManager.getAllCredentials()
      return { success: true, data: credentials }
    } catch (error) {
      console.error('Credential fetch error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.SETTINGS.SET_CREDENTIAL, async (_, id: string, secret: string) => {
    try {
      await secretsManager.storeCredential(id, secret)
      return { success: true }
    } catch (error) {
      console.error('Credential set error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })
}
