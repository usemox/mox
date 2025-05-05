import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../services/config'
import { authService } from '../services/auth'
import { accountService } from '../services'

export function setupAuthHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH.START_AUTH, async () => {
    try {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) throw new Error('No window found')

      const data = await authService.startAuth(window)
      const client = await authService.getRefreshClient(data.email)
      accountService.initAccount(data.accountId, client)

      return { success: true, data }
    } catch (error) {
      console.error('Auth error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH.CHECK_AUTH, async () => {
    try {
      const isAuthenticated = await authService.isAuthenticated()
      return { success: true, isAuthenticated }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(IPC_CHANNELS.AUTH.LOGOUT, async () => {
    try {
      await authService.logout()
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })
}
