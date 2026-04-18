import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customerApi, invoiceApi, crmApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'
import StatementOfAccounts from '../reports/StatementOfAccounts'

const INTERACTION_ICONS = { call:'📞', email:'📧', meeting:'🤝', visit:'🚗', note:'📝', whatsapp:'💬' }
const INTERACTION_TYPES = ['call','email','meeting','visit','note','whatsapp']

export default function CustomersModule() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ q:'', category:'' })
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showStatement, setShowStatement] = useState(false)
  const [showEmail, setShowEmail] = useState(false)
  const [detailTab, setDetailTab] = useState('contacts')

  const queryFilters = { ...filters, role: 'customer' }
  const { data, isLoading } = useQuery({ queryKey:['customers',queryFilters], queryFn:()=>customerApi.list(queryFilters).then(r=>r.data.data) })
  const rows = data || []
  const selected = rows.find(r => r.id === selectedId)

  const empty = { code:'',name:'',customer_category:'retail',cr_number:'',vat_number:'',address:'',tel:'',email:'',credit_limit:0,payment_terms_days:30,supplier_payment_terms_days:'',price_tier:1,notes:'',is_supplier:false }
  const [form, setForm] = useState(empty)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const saveMut = useMutation({
    mutationFn: d => editing ? customerApi.update(editing.id, d) : customerApi.create(d),
    onSuccess: () => { toast.success(editing?'Customer updated':'Customer created'); qc.invalidateQueries(['customers']); setShowForm(false); setEditing(null) },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  const openEdit = () => {
    const r = rows.find(x=>x.id===selectedId); if(!r) return
    setForm({...empty,...r}); setEditing(r); setShowForm(true)
  }
  const openNew = () => { setForm(empty); setEditing(null); setShowForm(true) }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Customers & Contacts</div>
      <div className="toolbar">
        <button className="btn primary" onClick={openNew}>＋ New Customer</button>
        <button className="btn" disabled={!selectedId} onClick={openEdit}>✏️ Edit</button>
        <button className="btn" disabled={!selectedId} onClick={()=>setShowStatement(true)}>📄 Statement</button>
        <button className="btn" disabled={!selectedId} onClick={()=>setShowEmail(true)}>✉️ Email Reminder</button>
        <div className="toolbar-sep"/>
        <select className="btn" style={{height:26,cursor:'default'}} value={filters.category} onChange={e=>setFilters(f=>({...f,category:e.target.value}))}>
          <option value="">All Categories</option>
          <option value="retail">Retail</option>
          <option value="wholesale">Wholesale</option>
          <option value="contractor">Contractor</option>
          <option value="government">Government</option>
        </select>
        <div className="toolbar-search">
          <input type="text" placeholder="Search name, CR, VAT..." value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value}))}/>
        </div>
      </div>

      {/* Main area: list + side panel */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Customer list */}
        <div style={{ flex:1, overflow:'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th style={{width:28}}><input type="checkbox"/></th>
              <th>Code</th><th>Name</th><th>Type</th>
              <th>CR No.</th><th>VAT No.</th><th>Tel</th><th>Email</th>
              <th className="right">Credit Limit</th><th>Terms</th><th>Tier</th><th>Status</th>
            </tr></thead>
            <tbody>
              {isLoading&&<tr className="empty-row"><td colSpan={12}>Loading...</td></tr>}
              {!isLoading&&!rows.length&&<tr className="empty-row"><td colSpan={12}>No customers found</td></tr>}
              {rows.map(c=>(
                <tr key={c.id} className={selectedId===c.id?'selected':''} onClick={()=>setSelectedId(c.id)} onDoubleClick={()=>{setSelectedId(c.id);setEditing(c);setForm({...empty,...c});setShowForm(true)}}>
                  <td><input type="checkbox" checked={selectedId===c.id} onChange={()=>setSelectedId(c.id)}/></td>
                  <td style={{color:'var(--blue)',fontWeight:600}}>{c.code}</td>
                  <td style={{fontWeight:600}}>{c.name}</td>
                  <td>
                    <span style={{fontSize:11,padding:'1px 6px',background:'#e8e8e8',borderRadius:10}}>{c.customer_category || c.type}</span>
                    {c.is_supplier && <span style={{marginLeft:4,fontSize:10,background:'#fff3e0',color:'#e65100',padding:'1px 5px',borderRadius:8}}>+supplier</span>}
                  </td>
                  <td>{c.cr_number||'—'}</td>
                  <td>{c.vat_number||'—'}</td>
                  <td>{c.tel||'—'}</td>
                  <td style={{color:'var(--blue)'}}>{c.email||'—'}</td>
                  <td className="right">{fmtBhd(c.credit_limit)}</td>
                  <td>Net {c.payment_terms_days}d</td>
                  <td className="center">T{c.price_tier}</td>
                  <td><span className={`badge ${c.is_active?'badge-paid':'badge-cancelled'}`}>{c.is_active?'Active':'Inactive'}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* CRM detail side panel */}
        {selectedId && (
          <div style={{
            width:380, borderLeft:'1px solid #e0e0e0', display:'flex', flexDirection:'column',
            background:'#fafafa', flexShrink:0,
          }}>
            {/* Customer summary header */}
            <div style={{ padding:'10px 14px', background:'var(--blue)', color:'#fff' }}>
              <div style={{ fontWeight:700, fontSize:13 }}>{selected?.name}</div>
              <div style={{ fontSize:11, opacity:.85 }}>{selected?.code} · {selected?.customer_category || selected?.type} · Net {selected?.payment_terms_days}d</div>
              {selected?.tel && <div style={{ fontSize:11, opacity:.8 }}>📞 {selected.tel}</div>}
              {selected?.email && <div style={{ fontSize:11, opacity:.8 }}>✉️ {selected.email}</div>}
            </div>

            {/* Tabs */}
            <div style={{ display:'flex', borderBottom:'1px solid #e0e0e0', background:'#fff' }}>
              {[['contacts','Contacts'],['activity','Activity']].map(([t,l])=>(
                <button key={t} onClick={()=>setDetailTab(t)} style={{
                  flex:1, background:'none', border:'none',
                  borderBottom: detailTab===t?'2px solid var(--blue)':'2px solid transparent',
                  color: detailTab===t?'var(--blue)':'#555', fontWeight: detailTab===t?700:400,
                  padding:'7px 0', cursor:'pointer', fontSize:12,
                }}>{l}</button>
              ))}
            </div>

            <div style={{ flex:1, overflow:'auto' }}>
              {detailTab === 'contacts' && <ContactsPanel customerId={selectedId} />}
              {detailTab === 'activity' && <ActivityPanel customerId={selectedId} />}
            </div>
          </div>
        )}
      </div>

      <div className="status-bar"><span>{rows.length} customers</span>{selectedId&&<span style={{marginLeft:8,color:'var(--blue)'}}>· {selected?.name} selected</span>}</div>

      {/* Customer form modal */}
      {showForm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal">
            <div className="modal-header"><h3>{editing?`Edit — ${editing.name}`:'New Customer'}</h3><button className="close-btn" onClick={()=>setShowForm(false)}>✕</button></div>
            <div className="modal-toolbar">
              <button className="btn primary" onClick={()=>saveMut.mutate(form)} disabled={saveMut.isPending}>💾 {saveMut.isPending?'Saving...':'Save'}</button>
              <button className="btn" onClick={()=>setShowForm(false)}>✕ Cancel</button>
            </div>
            <div className="modal-body" style={{padding:12}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>Customer Code *</label><input value={form.code} onChange={e=>F('code',e.target.value)} placeholder="C001"/></div>
                <div className="field" style={{gridColumn:'span 2'}}><label>Name *</label><input value={form.name} onChange={e=>F('name',e.target.value)}/></div>
                <div className="field"><label>Category</label>
                  <select value={form.customer_category || 'retail'} onChange={e=>F('customer_category',e.target.value)}>
                    {['retail','wholesale','contractor','government'].map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>CR Number</label><input value={form.cr_number||''} onChange={e=>F('cr_number',e.target.value)}/></div>
                <div className="field"><label>VAT Number</label><input value={form.vat_number||''} onChange={e=>F('vat_number',e.target.value)}/></div>
                <div className="field"><label>Tel</label><input value={form.tel||''} onChange={e=>F('tel',e.target.value)} placeholder="+973 1711 0000"/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(2,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>Email</label><input type="email" value={form.email||''} onChange={e=>F('email',e.target.value)}/></div>
                <div className="field"><label>Address</label><input value={form.address||''} onChange={e=>F('address',e.target.value)}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>Credit Limit BHD</label><input type="number" step="0.001" value={form.credit_limit} onChange={e=>F('credit_limit',e.target.value)}/></div>
                <div className="field">
                  <label>{form.is_supplier ? 'Customer Payment Terms — AR (days)' : 'Payment Terms (days)'}</label>
                  <input type="number" value={form.payment_terms_days} onChange={e=>F('payment_terms_days',e.target.value)}/>
                </div>
                {form.is_supplier && (
                  <div className="field">
                    <label>Supplier Payment Terms — AP (days)</label>
                    <input type="number"
                      value={form.supplier_payment_terms_days ?? ''}
                      onChange={e=>F('supplier_payment_terms_days', e.target.value===''?null:e.target.value)}
                      placeholder={`Same as AR (${form.payment_terms_days}d)`}/>
                  </div>
                )}
                <div className="field"><label>Price Tier</label>
                  <select value={form.price_tier} onChange={e=>F('price_tier',e.target.value)}>
                    <option value={1}>Tier 1 — Retail</option>
                    <option value={2}>Tier 2 — Wholesale</option>
                    <option value={3}>Tier 3 — Contractor</option>
                    <option value={4}>Tier 4 — Special</option>
                  </select>
                </div>
              </div>
              <div className="field"><label>Notes</label><textarea value={form.notes||''} onChange={e=>F('notes',e.target.value)} rows={2}/></div>
              <div style={{padding:'8px 10px',background:'#fff3e0',border:'1px solid #f0c080',borderRadius:4}}>
                <label style={{display:'flex',alignItems:'center',gap:8,cursor:'pointer',marginBottom:0}}>
                  <input type="checkbox" checked={!!form.is_supplier} onChange={e=>F('is_supplier',e.target.checked)}/>
                  <span style={{fontSize:12,fontWeight:600}}>Also acts as Supplier</span>
                  <span style={{fontSize:11,color:'#555',fontWeight:400}}>— enable if you also purchase from this company (enables purchases &amp; contra accounts)</span>
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statement modal */}
      {showStatement && selectedId && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowStatement(false)}>
          <div className="modal modal-xl" style={{maxWidth:920,width:'95vw'}}>
            <div className="modal-header">
              <h3>Statement of Accounts — {selected?.name}</h3>
              <button className="close-btn" onClick={()=>setShowStatement(false)}>✕</button>
            </div>
            <div className="modal-body" style={{padding:14,overflowY:'auto',maxHeight:'75vh'}}>
              <StatementOfAccounts preselectedCustomerId={selectedId} />
            </div>
          </div>
        </div>
      )}

      {/* Email reminder modal */}
      {showEmail && selectedId && (
        <EmailReminderModal customer={selected} onClose={()=>setShowEmail(false)} />
      )}
    </div>
  )
}

// ── Contacts Panel ────────────────────────────────────────
function ContactsPanel({ customerId }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editingContact, setEditingContact] = useState(null)
  const emptyC = { name:'', title:'', department:'', tel:'', mobile:'', email:'', is_primary:false, notes:'' }
  const [form, setForm] = useState(emptyC)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const { data, isLoading } = useQuery({
    queryKey: ['crm-contacts', customerId],
    queryFn: () => crmApi.listContacts(customerId).then(r => r.data.data),
    enabled: !!customerId,
  })
  const contacts = data || []

  const saveMut = useMutation({
    mutationFn: (d) => editingContact
      ? crmApi.updateContact(editingContact.id, d)
      : crmApi.createContact({ ...d, customer_id: customerId }),
    onSuccess: () => { toast.success('Saved'); qc.invalidateQueries(['crm-contacts', customerId]); setShowForm(false); setEditingContact(null) },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => crmApi.deleteContact(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['crm-contacts', customerId]) },
  })

  const openNew = () => { setForm(emptyC); setEditingContact(null); setShowForm(true) }
  const openEdit = (c) => { setForm({ name:c.name,title:c.title||'',department:c.department||'',tel:c.tel||'',mobile:c.mobile||'',email:c.email||'',is_primary:c.is_primary,notes:c.notes||'' }); setEditingContact(c); setShowForm(true) }

  return (
    <div style={{ padding:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:600, color:'#555' }}>Contact Persons</span>
        <button className="btn primary" style={{ fontSize:11, padding:'3px 10px' }} onClick={openNew}>＋ Add Contact</button>
      </div>

      {isLoading && <div style={{ color:'#888', fontSize:12 }}>Loading...</div>}
      {!isLoading && contacts.length === 0 && (
        <div style={{ textAlign:'center', padding:'20px 0', color:'#bbb', fontSize:12 }}>No contacts yet</div>
      )}

      {contacts.map(c => (
        <div key={c.id} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:4, padding:'8px 10px', marginBottom:6 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
            <div>
              <div style={{ fontWeight:600, fontSize:12 }}>
                {c.is_primary && <span style={{ fontSize:9, background:'var(--blue)', color:'#fff', borderRadius:3, padding:'1px 5px', marginRight:5 }}>PRIMARY</span>}
                {c.name}
              </div>
              {(c.title || c.department) && <div style={{ fontSize:11, color:'#777', marginTop:1 }}>{[c.title, c.department].filter(Boolean).join(' · ')}</div>}
              {c.mobile && <div style={{ fontSize:11, color:'#555', marginTop:2 }}>📱 {c.mobile}</div>}
              {c.tel    && <div style={{ fontSize:11, color:'#555' }}>📞 {c.tel}</div>}
              {c.email  && <div style={{ fontSize:11, color:'var(--blue)' }}>✉️ {c.email}</div>}
            </div>
            <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:6 }}>
              <button className="btn" style={{ fontSize:10, padding:'2px 7px' }} onClick={()=>openEdit(c)}>Edit</button>
              <button className="btn" style={{ fontSize:10, padding:'2px 7px', color:'#c62828' }} onClick={()=>{ if(confirm('Delete contact?')) deleteMut.mutate(c.id) }}>✕</button>
            </div>
          </div>
        </div>
      ))}

      {/* Contact form inline */}
      {showForm && (
        <div style={{ background:'#fff', border:'2px solid var(--blue)', borderRadius:4, padding:10, marginTop:8 }}>
          <div style={{ fontWeight:600, fontSize:12, marginBottom:8, color:'var(--blue)' }}>
            {editingContact ? 'Edit Contact' : 'New Contact'}
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div className="field" style={{ gridColumn:'span 2' }}><label>Name *</label><input value={form.name} onChange={e=>F('name',e.target.value)}/></div>
            <div className="field"><label>Title/Role</label><input value={form.title} onChange={e=>F('title',e.target.value)} placeholder="e.g. Procurement Manager"/></div>
            <div className="field"><label>Department</label><input value={form.department} onChange={e=>F('department',e.target.value)}/></div>
            <div className="field"><label>Mobile</label><input value={form.mobile} onChange={e=>F('mobile',e.target.value)} placeholder="+973 3XXX XXXX"/></div>
            <div className="field"><label>Direct Tel</label><input value={form.tel} onChange={e=>F('tel',e.target.value)}/></div>
            <div className="field" style={{ gridColumn:'span 2' }}><label>Email</label><input type="email" value={form.email} onChange={e=>F('email',e.target.value)}/></div>
            <div className="field" style={{ gridColumn:'span 2' }}>
              <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_primary} onChange={e=>F('is_primary',e.target.checked)}/> Primary contact
              </label>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button className="btn primary" style={{ fontSize:11 }} onClick={()=>saveMut.mutate(form)} disabled={saveMut.isPending||!form.name}>
              💾 {saveMut.isPending?'Saving...':'Save'}
            </button>
            <button className="btn" style={{ fontSize:11 }} onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Activity Panel (Interaction Log) ─────────────────────
function ActivityPanel({ customerId }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const emptyI = { type:'note', subject:'', body:'', occurred_at: new Date().toISOString().slice(0,16), follow_up_date:'' }
  const [form, setForm] = useState(emptyI)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['crm-interactions', customerId],
    queryFn: () => crmApi.listInteractions(customerId).then(r => r.data.data),
    enabled: !!customerId,
  })
  const interactions = data || []

  const saveMut = useMutation({
    mutationFn: (d) => crmApi.createInteraction({ ...d, customer_id: customerId }),
    onSuccess: () => { toast.success('Activity logged'); qc.invalidateQueries(['crm-interactions', customerId]); qc.invalidateQueries(['crm-dashboard']); setShowForm(false); setForm(emptyI) },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => crmApi.deleteInteraction(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['crm-interactions', customerId]); qc.invalidateQueries(['crm-dashboard']) },
  })

  const doneMut = useMutation({
    mutationFn: (id) => crmApi.doneInteraction(id),
    onSuccess: () => { toast.success('Follow-up done'); refetch() },
  })

  return (
    <div style={{ padding:10 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <span style={{ fontSize:12, fontWeight:600, color:'#555' }}>Activity Log</span>
        <button className="btn primary" style={{ fontSize:11, padding:'3px 10px' }} onClick={()=>setShowForm(s=>!s)}>
          {showForm ? '✕ Cancel' : '＋ Log Activity'}
        </button>
      </div>

      {/* Log form */}
      {showForm && (
        <div style={{ background:'#fff', border:'2px solid var(--blue)', borderRadius:4, padding:10, marginBottom:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6 }}>
            <div className="field">
              <label>Type</label>
              <select value={form.type} onChange={e=>F('type',e.target.value)}>
                {INTERACTION_TYPES.map(t=><option key={t} value={t}>{INTERACTION_ICONS[t]} {t}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Date & Time</label>
              <input type="datetime-local" value={form.occurred_at} onChange={e=>F('occurred_at',e.target.value)}/>
            </div>
            <div className="field" style={{ gridColumn:'span 2' }}>
              <label>Subject</label>
              <input value={form.subject} onChange={e=>F('subject',e.target.value)} placeholder="e.g. Discussed Q2 cable order"/>
            </div>
            <div className="field" style={{ gridColumn:'span 2' }}>
              <label>Notes</label>
              <textarea value={form.body} onChange={e=>F('body',e.target.value)} rows={3} placeholder="Details of the interaction..."/>
            </div>
            <div className="field">
              <label>Follow-up Date (optional)</label>
              <input type="date" value={form.follow_up_date} onChange={e=>F('follow_up_date',e.target.value)}/>
            </div>
          </div>
          <div style={{ display:'flex', gap:6, marginTop:8 }}>
            <button className="btn primary" style={{ fontSize:11 }} onClick={()=>saveMut.mutate(form)} disabled={saveMut.isPending}>
              💾 {saveMut.isPending?'Saving...':'Log Activity'}
            </button>
          </div>
        </div>
      )}

      {isLoading && <div style={{ color:'#888', fontSize:12 }}>Loading...</div>}
      {!isLoading && interactions.length === 0 && !showForm && (
        <div style={{ textAlign:'center', padding:'20px 0', color:'#bbb', fontSize:12 }}>No activity logged yet</div>
      )}

      {/* Timeline */}
      {interactions.map(i => (
        <div key={i.id} style={{ display:'flex', gap:8, marginBottom:10 }}>
          {/* Icon dot */}
          <div style={{ flexShrink:0, paddingTop:2 }}>
            <span style={{ fontSize:16 }}>{INTERACTION_ICONS[i.type]}</span>
          </div>
          <div style={{ flex:1, background:'#fff', border:'1px solid #e0e0e0', borderRadius:4, padding:'7px 10px' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
              <div>
                <span style={{ fontWeight:600, fontSize:12 }}>{i.subject || i.type}</span>
                <span style={{ fontSize:10, color:'#888', marginLeft:8 }}>
                  {fmtDate(i.occurred_at)} · {i.created_by_name || 'Unknown'}
                </span>
              </div>
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                {i.follow_up_date && !i.follow_up_done && (
                  <button className="btn" style={{ fontSize:9, padding:'2px 6px', color:'#e65100' }}
                    onClick={()=>doneMut.mutate(i.id)}>
                    📅 {fmtDate(i.follow_up_date)} ✓
                  </button>
                )}
                {i.follow_up_date && i.follow_up_done && (
                  <span style={{ fontSize:9, color:'#4caf50' }}>✅ Follow-up done</span>
                )}
                <button className="btn" style={{ fontSize:10, padding:'2px 6px', color:'#c62828' }}
                  onClick={()=>{ if(confirm('Delete?')) deleteMut.mutate(i.id) }}>✕</button>
              </div>
            </div>
            {i.body && <div style={{ fontSize:11, color:'#555', marginTop:4, lineHeight:1.5 }}>{i.body}</div>}
            {i.contact_name && <div style={{ fontSize:10, color:'#777', marginTop:3 }}>Contact: {i.contact_name}</div>}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Email Reminder Modal ──────────────────────────────────
function EmailReminderModal({ customer, onClose }) {
  const { data: invoices } = useQuery({
    queryKey: ['customer-invoices-unpaid', customer.id],
    queryFn: () => invoiceApi.list({ customer_id: customer.id, status: 'unpaid,partial,overdue' }).then(r => r.data.data),
  })

  const [selectedInvoiceId, setSelectedInvoiceId] = useState('')
  const [toEmail, setToEmail] = useState(customer.email || '')
  const unpaid = (invoices || []).filter(i => ['unpaid','partial','overdue'].includes(i.payment_status))

  const reminderMut = useMutation({
    mutationFn: () => invoiceApi.sendReminder(selectedInvoiceId, { to: toEmail }),
    onSuccess: (r) => { toast.success(r.data.message); onClose() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to send'),
  })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>Send Payment Reminder — {customer.name}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={()=>reminderMut.mutate()} disabled={reminderMut.isPending||!selectedInvoiceId||!toEmail}>
            ✉️ {reminderMut.isPending ? 'Sending...' : 'Send Reminder'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-body" style={{padding:12}}>
          {unpaid.length === 0 ? (
            <div style={{textAlign:'center',padding:'20px 0',color:'#4caf50',fontSize:13}}>
              ✅ No outstanding invoices for this customer.
            </div>
          ) : (
            <>
              <div className="field" style={{marginBottom:10}}>
                <label>Select Invoice *</label>
                <select value={selectedInvoiceId} onChange={e=>setSelectedInvoiceId(e.target.value)}>
                  <option value="">— select invoice —</option>
                  {unpaid.map(inv => (
                    <option key={inv.id} value={inv.id}>
                      {inv.invoice_no} — BHD {fmtBhd(inv.balance_due)} outstanding
                      {inv.due_date ? ` (due ${fmtDate(inv.due_date)})` : ''}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field" style={{marginBottom:10}}>
                <label>Send To (email) *</label>
                <input type="email" value={toEmail} onChange={e=>setToEmail(e.target.value)} placeholder="customer@example.com"/>
                {!customer.email && <span style={{fontSize:10,color:'#e65100',marginTop:2,display:'block'}}>⚠ No email on file — please enter manually</span>}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
