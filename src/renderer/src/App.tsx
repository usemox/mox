import { JSX } from 'react'
import { createHashHistory, createRouter, RouterProvider } from '@tanstack/react-router'

import { routeTree } from './routeTree.gen'
import { KeyBindingsProvider } from './hooks/use-key-bindings'
import { PostHogProvider } from 'posthog-js/react'

const options = {
  api_host: 'https://us.i.posthog.com'
}

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
    <PostHogProvider apiKey={process.env.POSTHOG_API_KEY!} options={options}>
      <KeyBindingsProvider>
        <RouterProvider router={router} />
      </KeyBindingsProvider>
    </PostHogProvider>
  )
}

export default App
