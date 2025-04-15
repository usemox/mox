import { createFileRoute, redirect } from '@tanstack/react-router'
import { Login } from '@renderer/components/login'
import { emailStore } from '@renderer/stores/email'

export const Route = createFileRoute('/login')({
  component: Login,
  beforeLoad: async () => {
    const isAuthenticated = await emailStore.checkAuth()
    if (isAuthenticated) {
      throw redirect({ to: '/', search: { category: undefined } })
    }
    return null
  }
})
