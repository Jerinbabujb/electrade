import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi } from '../../../services/api'
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
        {[['company','Company'],['tax','VAT & Tax'],['users','Users & Access'],['invoice','Invoice Templates'],
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
