import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { inviteApi } from '../../services/api'
import { useAuthStore } from '../../store'

export default function AcceptInvitePage({ token }) {
  const setAuth = useAuthStore(s => s.setAuth)

  const { data, isLoading, error } = useQuery({
    queryKey: ['invite', token],
    queryFn:  () => inviteApi.get(token).then(r => r.data.data),
    retry: false,
  })

  const [form, setForm] = useState({ name: '', password: '', confirm: '' })
  const [done, setDone] = useState(false)

  const acceptMut = useMutation({
    mutationFn: () => inviteApi.accept(token, { name: form.name, password: form.password }),
    onSuccess: ({ data: res }) => {
      localStorage.setItem('et_token', res.token)
      localStorage.setItem('et_user',  JSON.stringify(res.user))
      setDone(true)
      // Redirect to main app after short delay
      setTimeout(() => {
        window.location.href = '/'
      }, 1500)
    },
  })

  const submit = (e) => {
    e.preventDefault()
    if (form.password !== form.confirm) { alert('Passwords do not match'); return }
    if (form.password.length < 6)       { alert('Password must be at least 6 characters'); return }
    acceptMut.mutate()
  }

  const cardStyle = {
    minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: '#f5f7fa', fontFamily: 'Arial, sans-serif',
  }
  const boxStyle = {
    background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
    padding: 32, maxWidth: 400, width: '100%', margin: '0 16px',
  }

  if (isLoading) return (
    <div style={cardStyle}>
      <div style={boxStyle}>
        <div style={{ textAlign: 'center', color: '#888' }}>Checking invitation…</div>
      </div>
    </div>
  )

  if (error || !data) return (
    <div style={cardStyle}>
      <div style={{ ...boxStyle, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⛔</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#c62828', marginBottom: 8 }}>
          {error?.response?.data?.error?.message || 'Invalid invite link'}
        </div>
        <div style={{ fontSize: 13, color: '#888' }}>
          This link may have expired or already been used.
        </div>
      </div>
    </div>
  )

  if (done) return (
    <div style={cardStyle}>
      <div style={{ ...boxStyle, textAlign: 'center' }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#2e7d32' }}>Welcome aboard!</div>
        <div style={{ fontSize: 13, color: '#888', marginTop: 8 }}>Redirecting to the app…</div>
      </div>
    </div>
  )

  return (
    <div style={cardStyle}>
      <div style={boxStyle}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>You're invited!</div>
          <div style={{ fontSize: 13, color: '#555', marginTop: 6 }}>
            Join <strong>{data.company_name}</strong> as <strong>{data.role}</strong>
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>{data.email}</div>
        </div>

        {acceptMut.error && (
          <div style={{ background: '#ffebee', color: '#c62828', padding: '8px 12px',
                        borderRadius: 4, fontSize: 12, marginBottom: 14 }}>
            {acceptMut.error.response?.data?.error?.message || 'Something went wrong'}
          </div>
        )}

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Your name</label>
            <input required type="text" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Full name"
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
                       border: '1px solid #ccc', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Password</label>
            <input required type="password" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              placeholder="Choose a password (min 6 chars)"
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
                       border: '1px solid #ccc', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#555' }}>Confirm password</label>
            <input required type="password" value={form.confirm}
              onChange={e => setForm(f => ({ ...f, confirm: e.target.value }))}
              placeholder="Repeat password"
              style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px',
                       border: '1px solid #ccc', borderRadius: 4, fontSize: 13, boxSizing: 'border-box' }} />
          </div>
          <button type="submit" disabled={acceptMut.isPending}
            style={{ marginTop: 8, padding: '10px 0', background: '#1a5fa8', color: '#fff',
                     border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700,
                     cursor: acceptMut.isPending ? 'not-allowed' : 'pointer' }}>
            {acceptMut.isPending ? 'Setting up account…' : 'Accept & Create Account'}
          </button>
        </form>
      </div>
    </div>
  )
}
