import { emailStore } from '@renderer/stores/email'
import { EmailList, EmailListLoading } from './email-list'
import { observer } from 'mobx-react-lite'
import { type JSX } from 'react'
import { MainNav } from './main-menu'
import { ActionMenu } from './action-menu'
import { motion, AnimatePresence } from 'motion/react'

const PROFILE = { unreadEmails: 0, email: 'MailBox <your@email.com>' }

export const Inbox = observer(
  (): JSX.Element => (
    <>
      <div className="flex flex-col h-screen overflow-y-auto">
        <div className="sticky top-0 z-10 bg-background/40 backdrop-blur-md border-b border-border/30 shadow-md">
          <MainNav profile={emailStore.profile ?? PROFILE} />
        </div>
        <EmailList className="px-4 pb-2" emails={emailStore.emailList} />
      </div>
      <Menu />
    </>
  )
)

const Menu = observer(
  (): JSX.Element => (
    <AnimatePresence>
      {emailStore.selectedThreads.length > 0 && (
        <motion.div
          key="actionMenu"
          variants={{
            hidden: { scale: 0 },
            visible: {
              scale: 1,
              transition: { type: 'spring', stiffness: 400, damping: 20 }
            },
            exit: {
              scale: 0,
              transition: { type: 'spring', stiffness: 400, damping: 30 }
            }
          }}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="fixed bottom-8 left-1/2 transform -translate-x-1/2"
        >
          <ActionMenu />
        </motion.div>
      )}
    </AnimatePresence>
  )
)

export const InboxLoading = (): JSX.Element => (
  <div className="flex flex-col h-screen overflow-y-auto">
    <div className="sticky top-0 z-10 bg-background/40 backdrop-blur-md border-b border-border/30 shadow-md">
      <MainNav profile={emailStore.profile ?? PROFILE} />
    </div>
    <EmailListLoading />
  </div>
)
