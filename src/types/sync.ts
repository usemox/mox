export interface SyncMetrics {
  emailsFetched: number
  emailsStored: number
  syncDuration: number
  errors: { message: string; count: number }[]
  lastSuccessfulSync: number
}

export interface SyncState {
  id: string
  initialSyncComplete: boolean | null
  lastSyncPageToken: string | null
  lastSyncDate: number | null
  syncInProgress: boolean | null
}
