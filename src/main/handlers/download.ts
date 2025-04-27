import { dialog, app } from 'electron'
import { promises as fsPromises } from 'fs'
import path from 'path'
import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../services/config'
import { emailRepository } from '../services/database/email'

export function setupDownloadHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ATTACHMENTS.DOWNLOAD, async (_, id: string) => {
    try {
      const attachment = await emailRepository.getAttachment(id)
      if (!attachment) {
        return { success: false, error: 'Attachment not found' }
      }

      const defaultPath = path.join(app.getPath('downloads'), attachment.fileName)

      const { canceled, filePath } = await dialog.showSaveDialog({
        title: 'Save Attachment',
        defaultPath: defaultPath,
        buttonLabel: 'Save',
        filters: [{ name: 'All Files', extensions: ['*'] }]
      })

      if (!canceled && filePath) {
        try {
          await fsPromises.writeFile(filePath, attachment.data ?? '')
          console.info(`Attachment saved successfully: ${filePath}`)
          return { success: true, filePath }
        } catch (err) {
          console.error('Failed to save attachment:', err)
          // Ensure err is an Error object before accessing message
          const errorMessage = err instanceof Error ? err.message : String(err)
          return { success: false, error: errorMessage }
        }
      } else {
        // Handle the case where the dialog was canceled
        return { success: false, error: 'Save dialog canceled' }
      }
    } catch (error) {
      console.error('Error showing save dialog or processing download:', error)
      return { success: false, error: (error as Error).message }
    }
    return { success: true }
  })
}
