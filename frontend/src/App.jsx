import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store'
import AppShell         from './components/layout/AppShell'
import LoginPage        from './components/layout/LoginPage'
import CustomerPortalPage from './components/public/CustomerPortalPage'
import AcceptInvitePage   from './components/public/AcceptInvitePage'
import './index.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

// Simple path-based routing — no React Router needed for 2 public routes
function RouteSwitch() {
  const { isAuth } = useAuthStore()
  const path = window.location.pathname

  // Public routes — no auth required
  const portalMatch = path.match(/^\/portal\/([^/]+)/)
  if (portalMatch) return <CustomerPortalPage token={portalMatch[1]} />

  const inviteMatch = path.match(/^\/invite\/([^/]+)/)
  if (inviteMatch) return <AcceptInvitePage token={inviteMatch[1]} />

  // Auth-gated app
  return isAuth ? <AppShell /> : <LoginPage />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <RouteSwitch />
    </QueryClientProvider>
  )
}
