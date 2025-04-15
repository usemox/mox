import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../services/config'
import { peopleRepository } from '../services/database/people'

export function setupPeopleHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.PEOPLE.SEARCH, async (_, query: string) => {
    try {
      const people = await peopleRepository.fuzzySearch(query)
      return { success: true, data: people }
    } catch (error) {
      console.error('People search error:', (error as Error).message)
      return { success: false, error: (error as Error).message }
    }
  })
}
