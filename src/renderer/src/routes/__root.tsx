import { createRootRoute, Outlet, redirect } from '@tanstack/react-router'
// import { TanStackRouterDevtools } from '@tanstack/router-devtools'
import { emailStore } from '@renderer/stores/email'

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    if (location.pathname === '/login') {
      return
    }
    const isAuthenticated = await emailStore.checkAuth()
    if (!isAuthenticated) {
      throw redirect({ to: '/login' })
    }
  },

  component: () => {
    return <Outlet />
  }
})
