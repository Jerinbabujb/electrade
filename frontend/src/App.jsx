import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuthStore } from './store'
import AppShell  from './components/layout/AppShell'
import LoginPage from './components/layout/LoginPage'
import './index.css'

const qc = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
})

export default function App() {
  const { isAuth } = useAuthStore()
  return (
    <QueryClientProvider client={qc}>
      {isAuth ? <AppShell /> : <LoginPage />}
    </QueryClientProvider>
  )
}
