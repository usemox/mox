import { JSX } from 'react'
import { createHashHistory, createRouter, RouterProvider } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import { KeyBindingsProvider } from './hooks/use-key-bindings'

const hashHistory = createHashHistory()
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const router = createRouter({
  routeTree,
  history: hashHistory,
  scrollRestoration: true,
  defaultPreload: 'intent'
})

function App(): JSX.Element {
  return (
    <KeyBindingsProvider>
      <RouterProvider router={router} />
    </KeyBindingsProvider>
  )
}

export default App
