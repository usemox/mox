import { motion, AnimatePresence } from 'framer-motion'
import { LoadingIcon } from '@renderer/components/icons'
import type { JSX } from 'react'

export type SyncStatus = 'done' | 'pending' | 'error'

export const SyncBadge = ({
  syncStatus
}: {
  syncStatus: 'done' | 'pending' | 'error'
}): JSX.Element => (
  <div className="text-xs px-2 py-1 rounded-md bg-gray-400/10">
    <AnimatePresence>
      {syncStatus === 'pending' ? (
        <motion.div
          className="flex items-center gap-1 text-green-600"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LoadingIcon className="w-4 h-4 animate-spin" /> Syncing
        </motion.div>
      ) : syncStatus === 'done' ? (
        <div className="text-xs text-secondary-foreground/40 flex items-center">In Sync</div>
      ) : (
        <div className="text-xs text-orange-800/70 flex items-center">Error</div>
      )}
    </AnimatePresence>
  </div>
)
