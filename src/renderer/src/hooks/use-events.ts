import { useEffect, useRef, useState } from 'react'
import { MessageType, AppMessage } from '@/types/messages'

function isSyncStatusMessage(
  message: AppMessage<MessageType>
): message is AppMessage<MessageType.SYNC_STATUS> {
  return message.type === MessageType.SYNC_STATUS
}

export const useSyncEvent = () => {
  const [isSyncing, setIsSyncing] = useState(false)
  const handlerRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    if (!handlerRef.current) {
      handlerRef.current = window.api.notifications.onMessage(
        (message: AppMessage<MessageType>) => {
          if (isSyncStatusMessage(message) && message.data) {
            setIsSyncing(message.data.status === 'started')
          }
        }
      )
    }

    return () => {
      if (handlerRef.current) {
        handlerRef.current()
        handlerRef.current = null
      }
    }
  }, [])

  return { isSyncing }
}
