export interface ActionItem {
  id: string
  description: string
  priority?: 'high' | 'medium' | 'low'
  completed: boolean
  createdAt: number
  dueDate?: string | null
  emailId: string
}
