import { makeAutoObservable } from 'mobx'

class ActionItemsStore {
  constructor() {
    makeAutoObservable(this, {}, { autoBind: true })
  }

  async toggleCompleted(ids: string[]): Promise<void> {
    try {
      for (const id of ids) {
        await window.api.actionItems.markAsCompleted(id)
      }
    } catch (error) {
      console.error(
        'Failed to mark tasks as completed:',
        error instanceof Error ? error.message : error
      )
    }
  }
}

export const actionItemsStore = new ActionItemsStore()
