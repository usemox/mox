export enum MessageType {
  ERROR = 'ERROR',
  INFO = 'INFO',
  SYNC_STATUS = 'SYNC_STATUS'
}

// Message type mapping to enforce type safety
export type MessageDataMap = {
  [MessageType.ERROR]: ErrorMessageData
  [MessageType.INFO]: string | undefined
  [MessageType.SYNC_STATUS]: SyncStatusMessageData
}

// Updated AppMessage with automatic type inference
export interface AppMessage<T extends MessageType> {
  type: T
  description: string
  data?: MessageDataMap[T]
  timestamp?: number
}

export interface ErrorMessageData {
  code: string
  details?: string
}

export interface SyncStatusMessageData {
  status: 'started' | 'completed' | 'failed'
}
