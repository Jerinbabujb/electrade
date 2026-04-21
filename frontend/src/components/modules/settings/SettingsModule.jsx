import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, companyApi, auditApi, automationApi, inviteApi } from '../../../services/api'
import { useAuthStore } from '../../../store'
import toast from 'react-hot-toast'
import api from '../../../services/api'
import BackupTab from './BackupTab'
import ImportTab from './ImportTab'
import SimpleInvoiceImportTab from './SimpleInvoiceImportTab'
import { applyTheme, extractLogoColor, THEME_PRESETS, deriveTheme } from '../../../utils/theme.js'

function LogoUpload({ coData }) {
  const qc = useQueryClient()
  const inputRef = useRef()
  const [preview, setPreview] = useState(null)

  const current = preview || coData?.logo || null

  const uploadMut = useMutation({
    mutationFn: (logo) => api.post('/companies/logo', { logo }),
    onSuccess: () => {
      toast.success('Logo saved')
      qc.invalidateQueries(['company-settings'])
      setPreview(null)
    },
  })

  const removeMut = useMutation({
    mutationFn: () => api.delete('/companies/logo'),
    onSuccess: () => {
      toast.success('Logo removed')
      qc.invalidateQueries(['company-settings'])
      setPreview(null)
    },
  })

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 500 * 1024) { toast.error('Image must be under 500 KB'); return }
    const reader = new FileReader()
    reader.onload = (ev) => setPreview(ev.target.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  return (
    <div style={{marginBottom:18,padding:'12px 14px',border:'1px solid #e0e0e0',borderRadius:4,background:'#fafafa'}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:'#333'}}>Company Logo</div>
      <div style={{display:'flex',alignItems:'center',gap:16,flexWrap:'wrap'}}>
        <div style={{width:160,height:64,border:'1px dashed #bbb',borderRadius:3,display:'flex',alignItems:'center',justifyContent:'center',background:'#fff',overflow:'hidden'}}>
          {current
            ? <img src={current} alt="logo" style={{maxWidth:'100%',maxHeight:'100%',objectFit:'contain'}} />
            : <span style={{fontSize:11,color:'#aaa'}}>No logo</span>
          }
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:6}}>
          <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp"
            style={{display:'none'}} onChange={handleFile} />
          <button className="btn" onClick={() => inputRef.current.click()}>📁 Choose Image</button>
          {preview && (
            <button className="btn primary" onClick={() => uploadMut.mutate(preview)} disabled={uploadMut.isPending}>
              {uploadMut.isPending ? '⏳ Saving...' : '💾 Save Logo'}
            </button>
          )}
          {coData?.logo && !preview && (
            <button className="btn danger" onClick={() => removeMut.mutate()} disabled={removeMut.isPending}>
              🗑 Remove Logo
            </button>
          )}
          <div style={{fontSize:10,color:'#888'}}>PNG, JPG, SVG · max 500 KB<br/>Recommended: 300×100 px, transparent bg</div>
        </div>
      </div>
    </div>
  )
}

function ThemePicker({ coData, onThemeChange }) {
  const [picking, setPicking] = useState(false)
  const [custom, setCustom]   = useState(coData?.theme_color || '#1a5fa8')
  const current = coData?.theme_color || '#1a5fa8'

  const preview = (hex) => applyTheme(hex)
  const revert  = () => applyTheme(current)

  const pickFromLogo = async () => {
    if (!coData?.logo) { toast.error('Upload a logo first'); return }
    setPicking(true)
    try {
      const color = await extractLogoColor(coData.logo)
      if (!color) { toast.error('Could not detect a color from the logo'); return }
      setCustom(color)
      preview(color)
      onThemeChange(color)
      toast.success(`Color detected: ${color}`)
    } finally { setPicking(false) }
  }

  return (
    <div style={{marginBottom:18,padding:'12px 14px',border:'1px solid #e0e0e0',borderRadius:4,background:'#fafafa'}}>
      <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:'#333'}}>Color Theme</div>

      {/* Preset swatches */}
      <div style={{display:'flex',flexWrap:'wrap',gap:6,marginBottom:10}}>
        {THEME_PRESETS.map(p => {
          const vars = deriveTheme(p.color)
          const isCurrent = current === p.color
          return (
            <button key={p.color} title={p.name}
              style={{width:32,height:32,borderRadius:4,border: isCurrent ? '3px solid #333' : '2px solid transparent',
                background:vars['--blue'],cursor:'pointer',position:'relative',outline:'none'}}
              onClick={() => { setCustom(p.color); preview(p.color); onThemeChange(p.color) }}
              onMouseLeave={revert}
              onMouseEnter={() => preview(p.color)}>
              {isCurrent && <span style={{position:'absolute',top:1,right:2,fontSize:10,color:'#fff',fontWeight:900}}>✓</span>}
            </button>
          )
        })}
      </div>

      {/* Custom color + logo extract */}
      <div style={{display:'flex',alignItems:'center',gap:10,flexWrap:'wrap'}}>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <label style={{fontSize:11,fontWeight:700,color:'#555'}}>CUSTOM</label>
          <input type="color" value={custom}
            onChange={e => { setCustom(e.target.value); preview(e.target.value) }}
            onBlur={e => onThemeChange(e.target.value)}
            style={{width:40,height:28,border:'1px solid #ccc',borderRadius:3,cursor:'pointer',padding:2}} />
          <span style={{fontSize:11,color:'#888',fontFamily:'monospace'}}>{custom}</span>
        </div>
        <button className="btn" onClick={pickFromLogo} disabled={picking || !coData?.logo}
          title={!coData?.logo ? 'Upload a logo first' : 'Auto-detect brand color from logo'}>
          {picking ? '⏳ Detecting...' : '🎨 Pick from Logo'}
        </button>
        <div style={{fontSize:10,color:'#aaa',marginLeft:'auto'}}>
          Hover swatches to preview · Click to select
        </div>
      </div>
    </div>
  )
}

function EditUserModal({ u, onClose }) {
  const qc = useQueryClient()
  const [form, setForm] = useState({ name: u.name, email: u.email, role: u.role, is_active: u.is_active, password: '' })
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = { name: form.name, email: form.email, role: form.role, is_active: form.is_active }
      if (form.password) payload.password = form.password
      return api.put(`/auth/users/${u.id}`, payload)
    },
    onSuccess: () => { toast.success('User updated'); qc.invalidateQueries(['users']); onClose() },
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <div className="modal-header">
          <h3>Edit User — {u.name}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 16 }}>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>Full Name</label>
            <input value={form.name} onChange={e => F('name', e.target.value)} />
          </div>
          <div className="field" style={{ marginBottom: 8 }}>
            <label>Email</label>
            <input type="email" value={form.email} onChange={e => F('email', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={e => F('role', e.target.value)}>
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="storekeeper">Storekeeper</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.is_active ? 'active' : 'inactive'} onChange={e => F('is_active', e.target.value === 'active')}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
          <div className="field" style={{ marginBottom: 4 }}>
            <label>New Password <span style={{ fontWeight: 400, color: '#888' }}>(leave blank to keep current)</span></label>
            <input type="password" value={form.password} onChange={e => F('password', e.target.value)} placeholder="Enter new password" />
          </div>
        </div>
        <div className="modal-footer" style={{ padding: '10px 16px', display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.name || !form.email}>
            {saveMut.isPending ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Automation Tab ─────────────────────────────────────────
function AutomationTab() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['automation-settings'],
    queryFn:  () => automationApi.get().then(r => r.data.data),
  })

  const [form, setForm] = useState(null)
  const [running, setRunning] = useState(null)  // 'overdue' | 'lowstock' | null

  // Sync form with fetched data
  if (data && !form) {
    setForm({
      overdue_enabled:       data.overdue_enabled       ?? false,
      overdue_interval_days: data.overdue_interval_days ?? 7,
      lowstock_enabled:      data.lowstock_enabled      ?? false,
      lowstock_alert_email:  data.lowstock_alert_email  ?? '',
    })
  }

  const saveMut = useMutation({
    mutationFn: () => automationApi.save(form),
    onSuccess:  () => { toast.success('Automation settings saved'); qc.invalidateQueries(['automation-settings']) },
    onError:    (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  const runJob = async (job, label) => {
    setRunning(job)
    try {
      const { data: res } = await automationApi.runNow(job)
      const r = res.results || {}
      const parts = []
      if (r.overdue)  parts.push(`${r.overdue.sent  ?? 0} reminder${r.overdue.sent  === 1 ? '' : 's'} sent`)
      if (r.lowstock) parts.push(`${r.lowstock.alerts_sent ?? 0} alert${r.lowstock.alerts_sent === 1 ? '' : 's'} sent`)
      toast.success(`${label}: ${parts.join(', ') || 'done'}`)
      qc.invalidateQueries(['automation-settings'])
    } catch (e) {
      toast.error(e.response?.data?.error?.message || `${label} failed`)
    } finally {
      setRunning(null)
    }
  }

  const fmtRun = (ts, count, noun) => {
    if (!ts) return 'Never run'
    const d = new Date(ts)
    return `Last run: ${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${count} ${noun}${count === 1 ? '' : 's'} sent`
  }

  if (isLoading || !form) return <div style={{ padding: 20, color: '#888' }}>Loading…</div>

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const card = (children, enabled) => (
    <div style={{
      border: `1px solid ${enabled ? '#b0c8f0' : '#e0e0e0'}`,
      borderRadius: 6, padding: '14px 18px',
      background: enabled ? '#f7faff' : '#fafafa',
      display: 'flex', flexDirection: 'column', gap: 10,
    }}>
      {children}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 640 }}>
      <div style={{ fontSize: 11, color: '#888' }}>
        Automation jobs run daily at 08:00. Use "Run Now" to test without waiting.
        Email delivery requires SMTP to be configured (SMTP_HOST, SMTP_USER, SMTP_PASS env vars).
      </div>

      {/* Overdue Reminders */}
      {card(<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={form.overdue_enabled}
              onChange={e => set('overdue_enabled', e.target.checked)} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>📬 Overdue Invoice Reminders</span>
          </label>
          <button className="btn" style={{ fontSize: 11, padding: '2px 10px' }}
            disabled={running === 'overdue'} onClick={() => runJob('overdue', 'Overdue reminders')}>
            {running === 'overdue' ? 'Running…' : 'Run Now'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#555' }}>
          Automatically emails customers with unpaid overdue invoices (tax invoices only).
          Customers without a registered email address are skipped.
        </div>
        {form.overdue_enabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#555' }}>Send at most once every</span>
            <select value={form.overdue_interval_days}
              onChange={e => set('overdue_interval_days', Number(e.target.value))}
              style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
              {[1, 3, 7, 14, 30].map(d => (
                <option key={d} value={d}>{d} day{d === 1 ? '' : 's'}</option>
              ))}
            </select>
            <span style={{ fontSize: 12, color: '#555' }}>per invoice</span>
          </div>
        )}
        <div style={{ fontSize: 11, color: '#aaa' }}>
          {fmtRun(data?.overdue_last_run, data?.overdue_last_count ?? 0, 'reminder')}
        </div>
      </>, form.overdue_enabled)}

      {/* Low-Stock Alerts */}
      {card(<>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', flex: 1 }}>
            <input type="checkbox" checked={form.lowstock_enabled}
              onChange={e => set('lowstock_enabled', e.target.checked)} />
            <span style={{ fontWeight: 700, fontSize: 13 }}>📦 Low-Stock Alerts</span>
          </label>
          <button className="btn" style={{ fontSize: 11, padding: '2px 10px' }}
            disabled={running === 'lowstock'} onClick={() => runJob('lowstock', 'Low-stock alert')}>
            {running === 'lowstock' ? 'Running…' : 'Run Now'}
          </button>
        </div>
        <div style={{ fontSize: 12, color: '#555' }}>
          Sends one consolidated email listing all stock-tracked products where
          current stock ≤ minimum stock. Only products with a minimum stock level set are included.
        </div>
        {form.lowstock_enabled && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, color: '#555' }}>Alert email:</span>
            <input type="email" value={form.lowstock_alert_email}
              onChange={e => set('lowstock_alert_email', e.target.value)}
              placeholder="warehouse@company.com"
              style={{ flex: 1, fontSize: 12, padding: '4px 8px',
                       border: '1px solid #ccc', borderRadius: 4 }} />
          </div>
        )}
        <div style={{ fontSize: 11, color: '#aaa' }}>
          {fmtRun(data?.lowstock_last_run, data?.lowstock_last_count ?? 0, 'alert')}
        </div>
      </>, form.lowstock_enabled)}

      {/* Save */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-primary" onClick={() => saveMut.mutate()}
          disabled={saveMut.isPending}>
          {saveMut.isPending ? 'Saving…' : 'Save Settings'}
        </button>
      </div>
    </div>
  )
}

// ── Audit Log Tab ──────────────────────────────────────────
const ACTION_LABELS = {
  'invoice.void':          { label: 'Invoice Voided',        color: '#c62828', bg: '#ffebee' },
  'invoice.payment_added': { label: 'Payment Added',         color: '#1565c0', bg: '#e3f2fd' },
  'user.created':          { label: 'User Created',          color: '#2e7d32', bg: '#e8f5e9' },
  'user.role_change':      { label: 'Role Changed',          color: '#e65100', bg: '#fff3e0' },
  'user.activated':        { label: 'User Activated',        color: '#2e7d32', bg: '#e8f5e9' },
  'user.deactivated':      { label: 'User Deactivated',      color: '#c62828', bg: '#ffebee' },
  'company.user_added':    { label: 'User Added to Company', color: '#1565c0', bg: '#e3f2fd' },
  'company.user_removed':  { label: 'User Removed',         color: '#c62828', bg: '#ffebee' },
  'auth.company_switch':   { label: 'Company Switched',      color: '#6a1b9a', bg: '#f3e5f5' },
}

function ActionBadge({ action }) {
  const s = ACTION_LABELS[action] || { label: action, color: '#555', bg: '#f0f0f0' }
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                   background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>
      {s.label}
    </span>
  )
}

function AuditLogTab() {
  const [page,       setPage]       = useState(1)
  const [filterUser, setFilterUser] = useState('')
  const [filterAction, setFilterAction] = useState('')
  const [filterFrom, setFilterFrom] = useState('')
  const [filterTo,   setFilterTo]   = useState('')

  const params = {
    page, limit: 50,
    ...(filterUser   && { user_id: filterUser }),
    ...(filterAction && { action: filterAction }),
    ...(filterFrom   && { from: filterFrom }),
    ...(filterTo     && { to: filterTo }),
  }

  const { data, isLoading } = useQuery({
    queryKey: ['audit-log', params],
    queryFn:  () => auditApi.list(params).then(r => r.data),
    keepPreviousData: true,
  })
  const { data: actionsData } = useQuery({
    queryKey: ['audit-log-actions'],
    queryFn:  () => auditApi.actions().then(r => r.data.data),
  })

  const rows   = data?.data  || []
  const total  = data?.total || 0
  const pages  = data?.pages || 1

  const fmtTs = (ts) => {
    if (!ts) return '—'
    const d = new Date(ts)
    return d.toLocaleDateString() + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  const formatDiff = (oldV, newV) => {
    if (!oldV && !newV) return null
    if (oldV?.role && newV?.role) return `${oldV.role} → ${newV.role}`
    if (newV?.amount) return `BHD ${parseFloat(newV.amount).toFixed(3)}`
    if (newV?.role)   return `Role: ${newV.role}`
    return null
  }

  const reset = () => { setPage(1); setFilterUser(''); setFilterAction(''); setFilterFrom(''); setFilterTo('') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={filterAction} onChange={e => { setFilterAction(e.target.value); setPage(1) }}
          style={{ fontSize: 12, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Actions</option>
          {(actionsData || []).map(a => (
            <option key={a} value={a}>{ACTION_LABELS[a]?.label || a}</option>
          ))}
        </select>
        <input type="date" value={filterFrom} onChange={e => { setFilterFrom(e.target.value); setPage(1) }}
          style={{ fontSize: 12, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
        <span style={{ fontSize: 11, color: '#888' }}>to</span>
        <input type="date" value={filterTo} onChange={e => { setFilterTo(e.target.value); setPage(1) }}
          style={{ fontSize: 12, padding: '4px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
        {(filterAction || filterFrom || filterTo) && (
          <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }} onClick={reset}>
            Clear
          </button>
        )}
        <span style={{ fontSize: 11, color: '#aaa', marginLeft: 'auto' }}>
          {total} {total === 1 ? 'entry' : 'entries'}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto' }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th style={{ minWidth: 130 }}>Time</th>
            <th>User</th>
            <th>Action</th>
            <th>Entity</th>
            <th>Detail</th>
            <th>IP</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={6}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={6}>No audit entries found</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ color: '#888', whiteSpace: 'nowrap' }}>{fmtTs(r.created_at)}</td>
                <td style={{ fontWeight: 600 }}>{r.user_name || '—'}</td>
                <td><ActionBadge action={r.action} /></td>
                <td>
                  {r.entity_label
                    ? <><span style={{ fontWeight: 600 }}>{r.entity_label}</span>
                        <span style={{ fontSize: 10, color: '#aaa', marginLeft: 4 }}>({r.entity_type})</span></>
                    : <span style={{ color: '#aaa' }}>{r.entity_type}</span>}
                </td>
                <td style={{ color: '#555', fontSize: 11 }}>
                  {formatDiff(r.old_value, r.new_value) || '—'}
                </td>
                <td style={{ color: '#aaa', fontSize: 11 }}>{r.ip || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', gap: 4, alignItems: 'center', justifyContent: 'flex-end' }}>
          <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }}
            disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
            ‹ Prev
          </button>
          <span style={{ fontSize: 11, color: '#888' }}>Page {page} of {pages}</span>
          <button className="btn" style={{ fontSize: 11, padding: '2px 8px' }}
            disabled={page >= pages} onClick={() => setPage(p => p + 1)}>
            Next ›
          </button>
        </div>
      )}

      <div style={{ fontSize: 11, color: '#aaa' }}>
        Admin-only · Captures invoice voids, payments, user management, and company switches
      </div>
    </div>
  )
}

// ── Companies Tab ──────────────────────────────────────────
function CompanyUsersPanel({ company, currentUserId }) {
  const qc = useQueryClient()
  const [addForm,    setAddForm]    = useState({ email: '', role: 'sales' })
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'sales' })
  const [addMode,    setAddMode]    = useState('existing') // 'existing' | 'invite'
  const key = ['company-users', company.id]

  const { data: usersData, isFetching } = useQuery({
    queryKey: key,
    queryFn: () => companyApi.listUsers(company.id).then(r => r.data.data),
  })

  const addMut = useMutation({
    mutationFn: () => companyApi.addUser(company.id, addForm),
    onSuccess: () => {
      toast.success('User added')
      qc.invalidateQueries(key)
      setAddForm({ email: '', role: 'sales' })
    },
  })

  const inviteMut = useMutation({
    mutationFn: () => inviteApi.send(company.id, inviteForm),
    onSuccess: () => {
      toast.success(`Invite sent to ${inviteForm.email}`)
      setInviteForm({ email: '', role: 'sales' })
    },
  })

  const removeMut = useMutation({
    mutationFn: (userId) => companyApi.removeUser(company.id, userId),
    onSuccess: () => { toast.success('User removed'); qc.invalidateQueries(key) },
  })

  return (
    <div style={{ borderTop: '1px solid #e8e8e8', padding: '10px 14px', background: '#fafafa' }}>
      <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8, color: '#444' }}>Users with access</div>
      {isFetching
        ? <div style={{ fontSize: 12, color: '#888' }}>Loading...</div>
        : (
          <table className="data-table" style={{ fontSize: 12, marginBottom: 10 }}>
            <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {(usersData || []).map(u => (
                <tr key={u.id}>
                  <td style={{ fontWeight: 600 }}>{u.name}{u.id === currentUserId ? ' (you)' : ''}</td>
                  <td>{u.email}</td>
                  <td><span style={{ padding: '1px 7px', background: 'var(--blue-light)', borderRadius: 10, fontSize: 11, color: 'var(--blue)' }}>{u.role}</span></td>
                  <td><span className={`badge ${u.is_active ? 'badge-paid' : 'badge-cancelled'}`}>{u.is_active ? 'Active' : 'Inactive'}</span></td>
                  <td>
                    <button className="btn danger" style={{ fontSize: 11, padding: '1px 7px' }}
                      disabled={removeMut.isPending}
                      onClick={() => removeMut.mutate(u.id)}>
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }

      {/* Toggle between add-existing and invite */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {[['existing', '＋ Add Existing User'], ['invite', '✉ Invite by Email']].map(([mode, label]) => (
          <button key={mode} className={`btn${addMode === mode ? ' primary' : ''}`}
            style={{ fontSize: 11, padding: '3px 10px' }}
            onClick={() => setAddMode(mode)}>
            {label}
          </button>
        ))}
      </div>

      {addMode === 'existing' && (
        <>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
            Add a user who already has an ElecTrade account.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 2, marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Email address</label>
              <input value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))}
                placeholder="user@example.com" style={{ fontSize: 12 }} />
            </div>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Role</label>
              <select value={addForm.role} onChange={e => setAddForm(f => ({ ...f, role: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="storekeeper">Storekeeper</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
            <button className="btn primary" style={{ fontSize: 12, marginBottom: 1 }}
              disabled={addMut.isPending || !addForm.email}
              onClick={() => addMut.mutate()}>
              {addMut.isPending ? '⏳' : '＋ Add'}
            </button>
          </div>
        </>
      )}

      {addMode === 'invite' && (
        <>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
            Send an invitation email. The recipient will set their own password when they accept.
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div className="field" style={{ flex: 2, marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Email address</label>
              <input value={inviteForm.email} onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                placeholder="newuser@example.com" style={{ fontSize: 12 }} />
            </div>
            <div className="field" style={{ flex: 1, marginBottom: 0 }}>
              <label style={{ fontSize: 11 }}>Role</label>
              <select value={inviteForm.role} onChange={e => setInviteForm(f => ({ ...f, role: e.target.value }))} style={{ fontSize: 12 }}>
                <option value="admin">Admin</option>
                <option value="sales">Sales</option>
                <option value="storekeeper">Storekeeper</option>
                <option value="accountant">Accountant</option>
              </select>
            </div>
            <button className="btn primary" style={{ fontSize: 12, marginBottom: 1, background: '#6a1b9a', borderColor: '#6a1b9a' }}
              disabled={inviteMut.isPending || !inviteForm.email}
              onClick={() => inviteMut.mutate()}>
              {inviteMut.isPending ? '⏳' : '✉ Send Invite'}
            </button>
          </div>
          {inviteMut.isError && (
            <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>
              {inviteMut.error?.response?.data?.error?.message || 'Failed to send invite'}
            </div>
          )}
          <div style={{ fontSize: 11, color: '#888', marginTop: 6 }}>
            Invite link expires after 7 days.
          </div>
        </>
      )}
    </div>
  )
}

function CompaniesTab({ currentUserId }) {
  const qc = useQueryClient()
  const { switchCompany } = useAuthStore()
  const [expanded, setExpanded] = useState(null)
  const [showNew, setShowNew] = useState(false)
  const [newCo, setNewCo] = useState({ name: '', cr_number: '', vat_number: '', default_vat_rate: 10, default_currency: 'BHD' })
  const NC = (k, v) => setNewCo(f => ({ ...f, [k]: v }))

  const { data: companies } = useQuery({
    queryKey: ['all-companies'],
    queryFn: () => companyApi.listAll().then(r => r.data.data),
  })

  const createMut = useMutation({
    mutationFn: () => companyApi.create(newCo),
    onSuccess: async (res) => {
      const newId = res.data.data?.id
      toast.success('Company created — switching to it now…')
      setNewCo({ name: '', cr_number: '', vat_number: '', default_vat_rate: 10, default_currency: 'BHD' })
      setShowNew(false)
      // Switch to the new company so the auth token includes it and
      // all settings (logo, config) are applied to the correct company.
      if (newId) await switchCompany(newId, qc)
    },
  })

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#333' }}>Companies you have access to</div>
        <button className="btn primary" onClick={() => setShowNew(s => !s)}>
          {showNew ? '✕ Cancel' : '＋ New Company'}
        </button>
      </div>

      {showNew && (
        <div style={{ border: '1px solid #b0c8f0', borderRadius: 4, padding: 14, marginBottom: 14, background: 'var(--blue-light)' }}>
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: 'var(--blue)' }}>Create New Company</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Company Name *</label>
              <input value={newCo.name} onChange={e => NC('name', e.target.value)} />
            </div>
            <div className="field">
              <label>CR Number *</label>
              <input value={newCo.cr_number} onChange={e => NC('cr_number', e.target.value)} />
            </div>
            <div className="field">
              <label>VAT Number *</label>
              <input value={newCo.vat_number} onChange={e => NC('vat_number', e.target.value)} />
            </div>
            <div className="field">
              <label>Default VAT %</label>
              <input type="number" value={newCo.default_vat_rate} onChange={e => NC('default_vat_rate', e.target.value)} />
            </div>
            <div className="field">
              <label>Currency</label>
              <select value={newCo.default_currency} onChange={e => NC('default_currency', e.target.value)}>
                <option>BHD</option><option>USD</option><option>SAR</option>
              </select>
            </div>
          </div>
          <div style={{ fontSize: 11, color: '#555', marginBottom: 10 }}>
            You will be automatically added as admin of the new company. Switch to it from the company selector in the top bar.
          </div>
          <button className="btn primary" onClick={() => createMut.mutate()}
            disabled={createMut.isPending || !newCo.name || !newCo.cr_number || !newCo.vat_number}>
            {createMut.isPending ? '⏳ Creating...' : '✔ Create Company'}
          </button>
        </div>
      )}

      <div style={{ border: '1px solid #e0e0e0', borderRadius: 4, overflow: 'hidden' }}>
        {(companies || []).length === 0 && (
          <div style={{ padding: 16, color: '#888', fontSize: 12, textAlign: 'center' }}>No companies found</div>
        )}
        {(companies || []).map((co, i) => {
          const isOpen = expanded === co.id
          return (
            <div key={co.id} style={{ borderTop: i > 0 ? '1px solid #e0e0e0' : 'none' }}>
              <div
                onClick={() => setExpanded(isOpen ? null : co.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px',
                  cursor: 'pointer', background: isOpen ? 'var(--blue-light)' : '#fff',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 13, color: '#aaa', width: 14 }}>{isOpen ? '▼' : '▶'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#222' }}>
                    {co.name}
                    {co.is_default && <span style={{ marginLeft: 8, fontSize: 10, background: 'var(--blue)', color: '#fff', borderRadius: 10, padding: '1px 7px' }}>default</span>}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>CR: {co.cr_number} · VAT: {co.vat_number} · {co.user_count} user{co.user_count !== 1 ? 's' : ''}</div>
                </div>
                <span style={{ fontSize: 11, padding: '2px 8px', background: '#f0f0f0', borderRadius: 10, color: '#555' }}>{co.role}</span>
              </div>
              {isOpen && <CompanyUsersPanel company={co} currentUserId={currentUserId} />}
            </div>
          )
        })}
      </div>

      <div style={{ marginTop: 12, fontSize: 11, color: '#888' }}>
        To create a user and add them to a company: first create them in the <strong>Users &amp; Access</strong> tab, then grant access here.
      </div>
    </div>
  )
}

export default function SettingsModule() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const [tab, setTab] = useState('company')

  const { data: coData } = useQuery({ queryKey:['company-settings'], queryFn:()=>api.get('/companies').then(r=>r.data.data) })
  const { data: usersData } = useQuery({ queryKey:['users'], queryFn:()=>authApi.listUsers().then(r=>r.data.data) })

  const [co, setCo] = useState(null)
  const form = co || coData || {}
  const F = (k,v) => setCo(c=>({...(c||coData||{}),[k]:v}))

  const saveCo = useMutation({
    mutationFn: ()=>api.put('/companies', form),
    onSuccess: ()=>{ toast.success('Company settings saved'); qc.invalidateQueries(['company-settings']) }
  })

  const [clearConfirm, setClearConfirm] = useState('')
  const [demoConfirm,  setDemoConfirm]  = useState('')
  const [dbStatus, setDbStatus] = useState(null)

  const loadStatus = async () => {
    try { const r = await api.get('/admin/status'); setDbStatus(r.data.data) } catch {}
  }

  const clearMut = useMutation({
    mutationFn: () => api.post('/admin/clear'),
    onSuccess: () => {
      toast.success('All data cleared')
      setClearConfirm('')
      setDbStatus(null)
      qc.invalidateQueries()
    },
    onError: () => setClearConfirm(''),
  })

  const demoMut = useMutation({
    mutationFn: () => api.post('/admin/load-demo'),
    onSuccess: () => {
      toast.success('Demo data loaded!')
      setDemoConfirm('')
      setDbStatus(null)
      qc.invalidateQueries()
    },
    onError: () => setDemoConfirm(''),
  })

  const [editingUser, setEditingUser] = useState(null)
  const [newUser, setNewUser] = useState({ name:'', email:'', password:'', role:'sales' })
  const NU = (k,v) => setNewUser(u=>({...u,[k]:v}))
  const createUser = useMutation({
    mutationFn: ()=>api.post('/auth/users', newUser),
    onSuccess: ()=>{ toast.success('User created'); qc.invalidateQueries(['users']); setNewUser({name:'',email:'',password:'',role:'sales'}) }
  })

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Settings</div>
      <div className="tab-bar">
        {[['company','Company'],['tax','VAT & Tax'],['users','Users & Access'],
          ...(user?.role==='admin' ? [['companies','Companies'],['automation','Automation'],['audit','Audit Log']] : []),
          ['invoice','Invoice Templates'],
          ...(user?.role==='admin' ? [['import','Import Data'],['sinvoice','Simple Invoice'],['backup','Backups'],['demo','Demo & Reset']] : [])
        ].map(([id,label])=>(
          <div key={id} className={`tab ${tab===id?'active':''}`} onClick={()=>setTab(id)}
            style={id==='demo'?{color:'#c62828'}:{}}>{label}</div>
        ))}
      </div>

      <div style={{flex:1,overflow:'auto',padding:16,background:'#fff'}}>

        {tab==='company'&&(
          <div style={{maxWidth:680}}>
            <LogoUpload coData={coData} />
            <ThemePicker coData={coData} onThemeChange={hex => F('theme_color', hex)} />
            <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:'#333'}}>Company Information</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
              <div className="field" style={{gridColumn:'span 2'}}><label>Company Name (English) *</label><input value={form.name||''} onChange={e=>F('name',e.target.value)}/></div>
              <div className="field" style={{gridColumn:'span 2'}}><label>Company Name (Arabic)</label><input value={form.name_ar||''} onChange={e=>F('name_ar',e.target.value)} dir="rtl" placeholder="اسم الشركة بالعربي"/></div>
              <div className="field"><label>CR Number</label><input value={form.cr_number||''} onChange={e=>F('cr_number',e.target.value)}/></div>
              <div className="field"><label>VAT Registration Number</label><input value={form.vat_number||''} onChange={e=>F('vat_number',e.target.value)}/></div>
              <div className="field"><label>Tel</label><input value={form.tel||''} onChange={e=>F('tel',e.target.value)}/></div>
              <div className="field"><label>Email</label><input type="email" value={form.email||''} onChange={e=>F('email',e.target.value)}/></div>
              <div className="field" style={{gridColumn:'span 2'}}><label>Address</label><textarea value={form.address||''} onChange={e=>F('address',e.target.value)} rows={2}/></div>
            </div>
            <div style={{fontSize:13,fontWeight:700,margin:'14px 0 8px',color:'#333'}}>Bank Details (shown on invoices)</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              <div className="field"><label>Bank Name</label><input value={form.bank_name||''} onChange={e=>F('bank_name',e.target.value)}/></div>
              <div className="field"><label>Account Name</label><input value={form.bank_acct_name||''} onChange={e=>F('bank_acct_name',e.target.value)}/></div>
              <div className="field"><label>IBAN</label><input value={form.bank_iban||''} onChange={e=>F('bank_iban',e.target.value)}/></div>
              <div className="field"><label>SWIFT / BIC</label><input value={form.bank_swift||''} onChange={e=>F('bank_swift',e.target.value)}/></div>
            </div>
            <button className="btn primary" onClick={()=>saveCo.mutate()} disabled={saveCo.isPending}>💾 {saveCo.isPending?'Saving...':'Save Company Settings'}</button>

            {/* Module Visibility */}
            <div style={{marginTop:24,paddingTop:16,borderTop:'1px solid #e0e0e0'}}>
              <div style={{fontSize:13,fontWeight:700,marginBottom:4,color:'#333'}}>Module Visibility</div>
              <div style={{fontSize:11,color:'#888',marginBottom:12}}>
                Hide modules not used by this company. Applies to all users regardless of role.
                Core modules (Delivery Notes, Invoices, Products, Customers) cannot be hidden.
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:6}}>
                {[
                  { id:'quotations',      label:'Quotations' },
                  { id:'suppliers',       label:'Suppliers' },
                  { id:'purchase-orders', label:'Purchase Orders' },
                  { id:'purchases',       label:'Purchase Invoices' },
                  { id:'shipments',       label:'Landed Costs' },
                  { id:'crm',             label:'Pipeline (CRM)' },
                  { id:'hr',              label:'HR & Payroll' },
                  { id:'tasks',           label:'Tasks' },
                  { id:'contra',          label:'Contra Accounts' },
                  { id:'finance',         label:'Fin. Overview' },
                  { id:'cheques',         label:'Cheque Register' },
                  { id:'expenses',        label:'Expenses' },
                  { id:'bank',            label:'Bank Recon.' },
                  { id:'analytics',       label:'Analytics' },
                  { id:'reports',         label:'Reports' },
                ].map(({ id, label }) => {
                  const hidden = (form.hidden_modules || []).includes(id)
                  return (
                    <label key={id} style={{display:'flex',alignItems:'center',gap:7,fontSize:12,cursor:'pointer',
                      padding:'5px 8px',borderRadius:3,border:'1px solid #e0e0e0',
                      background: hidden ? '#fff8f8' : '#f9f9f9',
                      color: hidden ? '#c62828' : '#333'}}>
                      <input type="checkbox" checked={!hidden}
                        onChange={e => {
                          const current = form.hidden_modules || []
                          F('hidden_modules', e.target.checked
                            ? current.filter(m => m !== id)
                            : [...current, id])
                        }}/>
                      {hidden ? '🚫' : '✓'} {label}
                    </label>
                  )
                })}
              </div>
              <div style={{marginTop:10}}>
                <button className="btn primary" onClick={()=>saveCo.mutate()} disabled={saveCo.isPending}>
                  💾 {saveCo.isPending?'Saving...':'Save Visibility Settings'}
                </button>
              </div>
            </div>

            {/* PDF Layout */}
            {(() => {
              const pdfS = form.pdf_settings || {}
              const Fpdf = (k, v) => F('pdf_settings', { ...(form.pdf_settings || {}), [k]: v })
              const chkStyle = (on) => ({
                display:'flex', alignItems:'center', gap:7, fontSize:12, cursor:'pointer',
                padding:'5px 8px', borderRadius:3, border:'1px solid #e0e0e0',
                background: on ? '#f9f9f9' : '#fff8f8', color: on ? '#333' : '#c62828',
              })
              return (
                <div style={{marginTop:24,paddingTop:16,borderTop:'1px solid #e0e0e0'}}>
                  <div style={{fontSize:13,fontWeight:700,marginBottom:4,color:'#333'}}>PDF Layout</div>
                  <div style={{fontSize:11,color:'#888',marginBottom:14}}>
                    Customize how invoices, quotations, and delivery notes are printed.
                  </div>

                  {/* Template */}
                  <div style={{fontSize:11,fontWeight:600,color:'#555',marginBottom:8}}>Template Style</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:18}}>
                    {[
                      { id:'clean',   icon:'📄', label:'Clean',   desc:'Modern, minimal, white background' },
                      { id:'classic', icon:'🏢', label:'Classic',  desc:'Colored header bar, traditional look' },
                      { id:'compact', icon:'📋', label:'Compact',  desc:'Smaller text, fits more line items' },
                    ].map(({ id, icon, label, desc }) => {
                      const active = (pdfS.template || 'clean') === id
                      return (
                        <div key={id} onClick={() => Fpdf('template', id)} style={{
                          border:`2px solid ${active?'var(--blue)':'#ddd'}`,
                          borderRadius:4, padding:'10px 12px', cursor:'pointer',
                          background: active ? 'var(--blue-light)' : '#fafafa', textAlign:'center',
                        }}>
                          <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                          <div style={{fontSize:12,fontWeight:700,color:active?'var(--blue)':'#333'}}>{label}</div>
                          <div style={{fontSize:10,color:'#888',marginTop:3,lineHeight:1.4}}>{desc}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Language */}
                  <div style={{fontSize:11,fontWeight:600,color:'#555',marginBottom:8}}>Document Language</div>
                  <div style={{display:'flex',gap:8,marginBottom:18}}>
                    {[['bilingual','Bilingual (EN + Arabic)'],['en','English Only']].map(([val, lbl]) => {
                      const active = (pdfS.language || 'bilingual') === val
                      return (
                        <label key={val} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',
                          padding:'6px 14px',border:`1px solid ${active?'var(--blue)':'#ddd'}`,borderRadius:3,
                          background:active?'var(--blue-light)':'#fafafa'}}>
                          <input type="radio" name="pdf_lang" checked={active} onChange={() => Fpdf('language', val)}/>
                          {lbl}
                        </label>
                      )
                    })}
                  </div>

                  {/* Columns */}
                  <div style={{fontSize:11,fontWeight:600,color:'#555',marginBottom:8}}>Table Columns</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6,marginBottom:18}}>
                    {[
                      ['show_part_no',  'Part No. column'],
                      ['show_unit',     'Unit column'],
                      ['show_discount', 'Discount column (when items have discounts)'],
                      ['show_vat_col',  'VAT% column'],
                    ].map(([key, label]) => {
                      const on = pdfS[key] !== false
                      return (
                        <label key={key} style={chkStyle(on)}>
                          <input type="checkbox" checked={on} onChange={e => Fpdf(key, e.target.checked)}/>
                          {on ? '✓' : '🚫'} {label}
                        </label>
                      )
                    })}
                  </div>

                  {/* Sections */}
                  <div style={{fontSize:11,fontWeight:600,color:'#555',marginBottom:8}}>Document Sections</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:6,marginBottom:18}}>
                    {[
                      ['show_bank',         'Payment / bank details'],
                      ['show_balance_due',  'Balance Due row'],
                      ['show_signatures',   'Signature boxes (Delivery Notes)'],
                    ].map(([key, label]) => {
                      const on = pdfS[key] !== false
                      return (
                        <label key={key} style={chkStyle(on)}>
                          <input type="checkbox" checked={on} onChange={e => Fpdf(key, e.target.checked)}/>
                          {on ? '✓' : '🚫'} {label}
                        </label>
                      )
                    })}
                  </div>

                  {/* Custom footer */}
                  <div className="field" style={{marginBottom:14}}>
                    <label>Custom Footer Text <span style={{fontWeight:400,color:'#999'}}>(optional — overrides the default legal line)</span></label>
                    <input value={pdfS.custom_footer || ''}
                      placeholder="e.g. All sales are final · جميع المبيعات نهائية"
                      onChange={e => Fpdf('custom_footer', e.target.value)}/>
                  </div>

                  <button className="btn primary" onClick={() => saveCo.mutate()} disabled={saveCo.isPending}>
                    💾 {saveCo.isPending ? 'Saving...' : 'Save PDF Settings'}
                  </button>
                </div>
              )
            })()}
          </div>
        )}

        {tab==='tax'&&(
          <div style={{maxWidth:480}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:'#333'}}>VAT & Tax Settings</div>
            <div style={{background:'var(--blue-light)',border:'1px solid #b0c8f0',borderRadius:3,padding:'10px 14px',marginBottom:14,fontSize:12}}>
              <strong>Bahrain VAT rate:</strong> 10% (effective January 2022 — NBR standard rate). Change only if advised by your accountant.
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
              <div className="field"><label>Default VAT Rate %</label><input type="number" step="0.01" value={form.default_vat_rate||10} onChange={e=>F('default_vat_rate',e.target.value)}/></div>
              <div className="field"><label>Default Currency</label>
                <select value={form.default_currency||'BHD'} onChange={e=>F('default_currency',e.target.value)}>
                  <option>BHD</option><option>USD</option><option>SAR</option>
                </select>
              </div>
            </div>
            <div style={{background:'#fff8e1',border:'1px solid #ffe082',borderRadius:3,padding:'8px 12px',fontSize:12,color:'#5d4037',marginBottom:12}}>
              ⚠ VAT quarter start month: <strong>January</strong> (Q1: Jan–Mar, Q2: Apr–Jun, Q3: Jul–Sep, Q4: Oct–Dec). NBR filing is due within 30 days of each quarter end.
            </div>
            <button className="btn primary" onClick={()=>saveCo.mutate()}>💾 Save Tax Settings</button>
          </div>
        )}

        {tab==='users'&&(
          <div style={{maxWidth:680}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:10,color:'#333'}}>System Users</div>
            <table className="data-table" style={{marginBottom:16,fontSize:12}}>
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last Login</th><th>Status</th>{user?.role==='admin'&&<th></th>}</tr></thead>
              <tbody>
                {(usersData||[]).map(u=>(
                  <tr key={u.id}>
                    <td style={{fontWeight:600}}>{u.name}</td>
                    <td>{u.email}</td>
                    <td><span style={{padding:'1px 7px',background:'var(--blue-light)',borderRadius:10,fontSize:11,color:'var(--blue)'}}>{u.role}</span></td>
                    <td style={{color:'#888'}}>{u.last_login?new Date(u.last_login).toLocaleDateString():'Never'}</td>
                    <td><span className={`badge ${u.is_active?'badge-paid':'badge-cancelled'}`}>{u.is_active?'Active':'Inactive'}</span></td>
                    {user?.role==='admin'&&<td><button className="btn" style={{fontSize:11,padding:'2px 8px'}} onClick={()=>setEditingUser(u)}>✏️ Edit</button></td>}
                  </tr>
                ))}
              </tbody>
            </table>
            {editingUser && <EditUserModal u={editingUser} onClose={()=>setEditingUser(null)} />}

            {user?.role==='admin'&&(
              <>
                <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#333'}}>Add New User</div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:8}}>
                  <div className="field"><label>Full Name</label><input value={newUser.name} onChange={e=>NU('name',e.target.value)}/></div>
                  <div className="field"><label>Email</label><input type="email" value={newUser.email} onChange={e=>NU('email',e.target.value)}/></div>
                  <div className="field"><label>Password</label><input type="password" value={newUser.password} onChange={e=>NU('password',e.target.value)}/></div>
                  <div className="field"><label>Role</label>
                    <select value={newUser.role} onChange={e=>NU('role',e.target.value)}>
                      <option value="admin">Admin</option>
                      <option value="sales">Sales</option>
                      <option value="storekeeper">Storekeeper</option>
                      <option value="accountant">Accountant</option>
                    </select>
                  </div>
                </div>
                <button className="btn primary" onClick={()=>createUser.mutate()} disabled={createUser.isPending||!newUser.name||!newUser.email||!newUser.password}>
                  ＋ {createUser.isPending?'Creating...':'Create User'}
                </button>
                <div style={{marginTop:10,fontSize:11,color:'#888'}}>
                  Roles: Admin = full access | Sales = invoices & DNs | Storekeeper = stock & purchases | Accountant = reports & bank
                </div>
              </>
            )}
          </div>
        )}

        {tab==='invoice'&&(
          <div style={{maxWidth:480}}>
            <div style={{fontSize:13,fontWeight:700,marginBottom:12,color:'#333'}}>Invoice & Document Settings</div>
            <div style={{background:'#fff8e1',border:'1px solid #ffe082',borderRadius:3,padding:'8px 12px',fontSize:12,color:'#5d4037',marginBottom:12}}>
              ⚠ Changing prefixes only affects <strong>new</strong> documents. Existing document numbers will not change.
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
              <div className="field">
                <label>Invoice Prefix</label>
                <input value={form.invoice_prefix||'INV'} onChange={e=>F('invoice_prefix',e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,''))} placeholder="INV" maxLength={10}/>
              </div>
              <div className="field">
                <label>DN Prefix</label>
                <input value={form.dn_prefix||'DN'} onChange={e=>F('dn_prefix',e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,''))} placeholder="DN" maxLength={10}/>
              </div>
              <div className="field">
                <label>Purchase Prefix</label>
                <input value={form.po_prefix||'PUR'} onChange={e=>F('po_prefix',e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g,''))} placeholder="PUR" maxLength={10}/>
              </div>
            </div>
            <div style={{fontSize:11,color:'#888',marginBottom:14}}>
              Format: <strong>{form.invoice_prefix||'INV'}-{new Date().getFullYear()}-0001</strong>, &nbsp;
              <strong>{form.dn_prefix||'DN'}-{new Date().getFullYear()}-0001</strong>, &nbsp;
              <strong>{form.po_prefix||'PUR'}-{new Date().getFullYear()}-0001</strong>
            </div>
            <button className="btn primary" onClick={()=>saveCo.mutate()} disabled={saveCo.isPending}>
              💾 {saveCo.isPending?'Saving...':'Save Prefix Settings'}
            </button>
            <div style={{background:'var(--blue-light)',border:'1px solid #b0c8f0',borderRadius:3,padding:'10px 14px',fontSize:12,marginTop:16}}>
              Invoice PDFs are generated as browser-printable HTML pages. Click the Print button on any invoice and choose "Save as PDF" in your browser's print dialog to save a PDF copy.
            </div>
          </div>
        )}

        {tab==='companies'  && <CompaniesTab currentUserId={user?.id} />}
        {tab==='automation' && user?.role==='admin' && <AutomationTab />}
        {tab==='audit'      && user?.role==='admin' && <AuditLogTab />}

        {tab==='import'   && user?.role==='admin' && <ImportTab />}
        {tab==='sinvoice' && user?.role==='admin' && <SimpleInvoiceImportTab />}
        {tab==='backup'   && user?.role==='admin' && <BackupTab />}

        {tab==='demo' && user?.role==='admin' && (
          <div style={{maxWidth:640}}>

            {/* Current data status */}
            <div style={{fontSize:13,fontWeight:700,marginBottom:8,color:'#333'}}>Current Database Status</div>
            {!dbStatus
              ? <button className="btn" onClick={loadStatus} style={{marginBottom:16}}>Check current record counts</button>
              : (
                <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
                  {Object.entries(dbStatus).map(([k,v]) => (
                    <div key={k} style={{background:'#f5f5f5',border:'1px solid #e0e0e0',borderRadius:3,padding:'8px 12px',textAlign:'center'}}>
                      <div style={{fontSize:20,fontWeight:700,color:v>0?'var(--blue)':'#aaa'}}>{v}</div>
                      <div style={{fontSize:10,color:'#888',textTransform:'capitalize'}}>{k}</div>
                    </div>
                  ))}
                  <div style={{gridColumn:'span 4'}}>
                    <button className="btn" onClick={loadStatus} style={{fontSize:11}}>Refresh counts</button>
                  </div>
                </div>
              )
            }

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>

              {/* ── Panel 1: Clear data ── */}
              <div style={{border:'2px solid #c62828',borderRadius:4,overflow:'hidden'}}>
                <div style={{background:'#c62828',padding:'8px 14px',color:'#fff',fontWeight:700,fontSize:13}}>
                  Clear All Data
                </div>
                <div style={{padding:14}}>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.6,marginBottom:12}}>
                    Deletes <strong>all</strong> invoices, customers, products, employees, purchases, expenses, cheques, payroll, and bank records. Document number sequences are reset to 1.
                    <br/><br/>
                    Company settings and user accounts are <strong>preserved</strong>.
                  </div>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:'#555'}}>
                    Type <code style={{background:'#f0f0f0',padding:'1px 5px',borderRadius:3,letterSpacing:1}}>CLEAR</code> to confirm:
                  </div>
                  <input
                    value={clearConfirm}
                    onChange={e => setClearConfirm(e.target.value)}
                    placeholder="Type CLEAR"
                    style={{width:'100%',padding:'6px 10px',marginBottom:10,
                      border:`2px solid ${clearConfirm==='CLEAR'?'#c62828':'#d0d0d0'}`,
                      borderRadius:3,fontSize:13,fontFamily:'monospace',letterSpacing:2,boxSizing:'border-box'}}
                  />
                  <button
                    onClick={() => clearMut.mutate()}
                    disabled={clearConfirm!=='CLEAR' || clearMut.isPending}
                    style={{width:'100%',padding:'8px',fontSize:13,fontWeight:700,borderRadius:3,border:'none',
                      cursor:clearConfirm==='CLEAR'?'pointer':'not-allowed',
                      background:clearConfirm==='CLEAR'?'#c62828':'#e0e0e0',
                      color:clearConfirm==='CLEAR'?'#fff':'#aaa'}}>
                    {clearMut.isPending ? '⏳ Clearing...' : 'Clear All Data'}
                  </button>
                </div>
              </div>

              {/* ── Panel 2: Load demo data ── */}
              <div style={{border:'2px solid var(--blue)',borderRadius:4,overflow:'hidden'}}>
                <div style={{background:'var(--blue)',padding:'8px 14px',color:'#fff',fontWeight:700,fontSize:13}}>
                  Load Demo Data
                </div>
                <div style={{padding:14}}>
                  <div style={{fontSize:12,color:'#555',lineHeight:1.5,marginBottom:10}}>
                    Inserts a full set of realistic demo records <strong>on top of existing data</strong>. Run Clear first if you want a clean slate.
                  </div>
                  <div style={{fontSize:11,background:'#f5f5f5',borderRadius:3,padding:'8px 10px',marginBottom:12}}>
                    {[
                      ['Customers','6 customers + 3 suppliers'],
                      ['Products','17 electrical items w/ stock'],
                      ['Employees','6 staff (Bahraini + expat)'],
                      ['Invoices','8 — paid / partial / overdue'],
                      ['Purchases','4 supplier orders'],
                      ['Expenses','6 records'],
                      ['Cheques','5 issued & received'],
                      ['Bank','BBK account + petty cash'],
                      ['Payroll','Last month — paid run'],
                    ].map(([k,v]) => (
                      <div key={k} style={{display:'flex',justifyContent:'space-between',padding:'2px 0',borderBottom:'1px solid #eee'}}>
                        <span style={{fontWeight:600,color:'#555'}}>{k}</span>
                        <span style={{color:'#333'}}>{v}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:'#555'}}>
                    Type <code style={{background:'#f0f0f0',padding:'1px 5px',borderRadius:3,letterSpacing:1}}>DEMO</code> to confirm:
                  </div>
                  <input
                    value={demoConfirm}
                    onChange={e => setDemoConfirm(e.target.value)}
                    placeholder="Type DEMO"
                    style={{width:'100%',padding:'6px 10px',marginBottom:10,
                      border:`2px solid ${demoConfirm==='DEMO'?'var(--blue)':'#d0d0d0'}`,
                      borderRadius:3,fontSize:13,fontFamily:'monospace',letterSpacing:2,boxSizing:'border-box'}}
                  />
                  <button
                    onClick={() => demoMut.mutate()}
                    disabled={demoConfirm!=='DEMO' || demoMut.isPending}
                    style={{width:'100%',padding:'8px',fontSize:13,fontWeight:700,borderRadius:3,border:'none',
                      cursor:demoConfirm==='DEMO'?'pointer':'not-allowed',
                      background:demoConfirm==='DEMO'?'var(--blue)':'#e0e0e0',
                      color:demoConfirm==='DEMO'?'#fff':'#aaa'}}>
                    {demoMut.isPending ? '⏳ Loading demo data...' : 'Load Demo Data'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  )
}
