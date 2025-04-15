import { eq, desc, count } from 'drizzle-orm'
import { DatabaseService, type Database } from './index'
import { actionItems } from './schema'
import type { ActionItem } from '@/types/action-item'
import { ulid } from 'ulid'

export class ActionItemsRepository {
  private db: Database

  constructor() {
    this.db = DatabaseService.getInstance().getDb()
  }

  async createActionItem(actionItem: Omit<ActionItem, 'id' | 'createdAt'>): Promise<ActionItem> {
    const newActionItem: ActionItem = {
      ...actionItem,
      id: ulid(),
      createdAt: Date.now()
    }

    await this.db.insert(actionItems).values(newActionItem)
    return newActionItem
  }

  async updateActionItem(
    id: string,
    updates: Partial<Omit<ActionItem, 'id' | 'createdAt'>>
  ): Promise<void> {
    await this.db.update(actionItems).set(updates).where(eq(actionItems.id, id))
  }

  async deleteActionItem(id: string): Promise<void> {
    await this.db.delete(actionItems).where(eq(actionItems.id, id))
  }

  async markActionItemAsCompleted(id: string, completed: boolean = true): Promise<void> {
    await this.db.update(actionItems).set({ completed }).where(eq(actionItems.id, id))
  }

  async getActionItems(emailId: string): Promise<ActionItem[]> {
    const result = await this.db.select().from(actionItems).where(eq(actionItems.emailId, emailId))
    return result
  }

  async getActionItemById(id: string): Promise<ActionItem | null> {
    const result = await this.db.select().from(actionItems).where(eq(actionItems.id, id)).limit(1)
    return result.length > 0 ? result[0] : null
  }

  async getAllactionItems(
    limit: number = 50,
    offset: number = 0,
    includeCompleted: boolean = false
  ): Promise<ActionItem[]> {
    const query = this.db.select().from(actionItems)

    if (!includeCompleted) {
      query.where(eq(actionItems.completed, false))
    }

    return await query.orderBy(desc(actionItems.createdAt)).limit(limit).offset(offset)
  }

  async getActionItemCount(includeCompleted: boolean = false): Promise<number> {
    const query = this.db.select({ count: count() }).from(actionItems)

    if (!includeCompleted) {
      query.where(eq(actionItems.completed, false))
    }

    const result = await query
    return result[0].count ?? 0
  }
}

export const actionItemsRepository = new ActionItemsRepository()
