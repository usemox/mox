import { BrowserWindow, ipcMain } from 'electron'
import { IPC_CHANNELS } from '../services/config'
import { authService } from '../services/auth'

export function setupAuthHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.AUTH.START_AUTH, async () => {
    try {
      const window = BrowserWindow.getFocusedWindow()
      if (!window) throw new Error('No window found')
      const tokens = await authService.startAuth(window)
      return { success: true, data: tokens }
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
