import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { authApi } from '../../services/api'
import { useAuthStore } from '../../store'
import toast from 'react-hot-toast'
import { Toaster } from 'react-hot-toast'

export default function LoginPage() {
  const { login } = useAuthStore()
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')

  const mut = useMutation({
    mutationFn: () => authApi.login({ email, password }),
    onSuccess:  (res) => {
      login(res.data.user, res.data.token)
      toast.success('Welcome back!')
    },
    onError: () => toast.error('Invalid email or password'),
  })

  return (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--gray-bg)', flexDirection: 'column', gap: 0,
    }}>
      <Toaster />

      {/* Header strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        height: 6, background: 'var(--blue)',
      }} />

      <div style={{
        background: '#fff', border: '1px solid var(--gray-border)',
        padding: '32px 40px', width: 380,
        boxShadow: 'var(--shadow)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 48, height: 48, background: 'var(--blue)', borderRadius: 4,
            fontSize: 22, fontWeight: 900, color: '#fff', marginBottom: 12,
          }}>E</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--blue)' }}>ElecTrade Pro</div>
          <div style={{ fontSize: 12, color: 'var(--gray-dark)', marginTop: 2 }}>
            Al Manama Electrical Trading Co. W.L.L
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <div className="field">
            <label>Email Address</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder="your@email.com" autoFocus
              onKeyDown={e => e.key === 'Enter' && mut.mutate()} />
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <div className="field">
            <label>Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && mut.mutate()} />
          </div>
        </div>

        <button className="btn primary" style={{ width: '100%', height: 34, fontSize: 13 }}
          onClick={() => mut.mutate()} disabled={mut.isPending}>
          {mut.isPending ? '⏳ Signing in...' : '→ Sign In'}
        </button>

        <div style={{ fontSize: 11, color: '#888', marginTop: 16, textAlign: 'center' }}>
          Forgot password? Contact your system administrator.
        </div>
      </div>

      <div style={{ fontSize: 11, color: '#aaa', marginTop: 16 }}>
        ElecTrade Pro v1.0 — Powered by Al Manama Electrical
      </div>
    </div>
  )
}
