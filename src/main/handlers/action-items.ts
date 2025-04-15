import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../services/config'
import { actionItemsRepository } from '../services/database/action-items'

export function setupActionItemsHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.ACTION_ITEMS.MARK_AS_COMPLETED, async (_, id: string) => {
    await actionItemsRepository.markActionItemAsCompleted(id)
    return { success: true }
  })
}
