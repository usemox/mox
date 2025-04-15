import { createFileRoute } from '@tanstack/react-router'
import { Search } from '@renderer/components/inbox/search'

export const Route = createFileRoute('/search')({
  component: Search,
  loader: async () => {
    return {}
  }
})
