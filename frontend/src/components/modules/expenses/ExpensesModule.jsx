import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expenseApi, recurringExpenseApi, categoryApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const FREQ_LABEL = { weekly:'Weekly', monthly:'Monthly', quarterly:'Quarterly', half_yearly:'Half-Yearly', yearly:'Yearly', bi_annual:'Every 2 Years' }
const FREQ_COLOR = { weekly:'#7b1fa2', monthly:'#1565c0', quarterly:'#2e7d32', half_yearly:'#00695c', yearly:'#e65100', bi_annual:'#4e342e' }

function CategoryManager({ onClose }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data } = useQuery({ queryKey:['cats-expense'], queryFn:()=>categoryApi.list('expense').then(r=>r.data.data) })
  const cats = data || []

  const createMut = useMutation({
    mutationFn: () => categoryApi.create({ name: name.trim(), type: 'expense' }),
    onSuccess: () => { toast.success('Category added'); qc.invalidateQueries(['cats-expense']); setName('') },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => categoryApi.delete(id),
    onSuccess: () => { toast.success('Category deleted'); qc.invalidateQueries(['cats-expense']) },
    onError: () => toast.error('Cannot delete — may be in use'),
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>📂 Expense Categories</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 16 }}>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="New category name…"
              style={{ flex:1 }} autoFocus
              onKeyDown={e=>{ if(e.key==='Enter' && name.trim()) createMut.mutate() }} />
            <button className="btn primary" onClick={()=>createMut.mutate()} disabled={!name.trim()||createMut.isPending}>＋ Add</button>
          </div>
          <div style={{ maxHeight:300, overflowY:'auto' }}>
            {cats.length === 0 && <div style={{ color:'#aaa', fontSize:12, textAlign:'center', padding:16 }}>No categories yet</div>}
            {cats.map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', borderBottom:'1px solid #f0f0f0' }}>
                <span style={{ fontSize:13 }}>📂 {c.name}</span>
                <button onClick={()=>{ if(window.confirm(`Delete "${c.name}"?`)) deleteMut.mutate(c.id) }}
                  style={{ background:'none', border:'none', color:'#c62828', cursor:'pointer', fontSize:13, padding:'0 4px' }}>✕</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'10px 16px', borderTop:'1px solid #e0e0e0', textAlign:'right' }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function ExpensesModule() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('expenses')  // 'expenses' | 'recurring' | 'forecast'
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [showRecurForm, setShowRecurForm] = useState(false)
  const [editingRecur, setEditingRecur] = useState(null)
  const [confirmPayItem, setConfirmPayItem] = useState(null)  // template row to confirm payment for

  const { data, isLoading } = useQuery({ queryKey:['expenses'], queryFn:()=>expenseApi.list().then(r=>r.data.data) })
  const { data: cats } = useQuery({ queryKey:['cats-expense'], queryFn:()=>categoryApi.list('expense').then(r=>r.data.data) })
  const { data: recurData, isLoading: recurLoading } = useQuery({
    queryKey:['recurring-expenses'],
    queryFn: () => recurringExpenseApi.list().then(r => r.data.data),
  })
  const rows      = data || []
  const recurRows = recurData || []
  const totalNet  = rows.reduce((s,r)=>s+parseFloat(r.net_amount||0),0)
  const totalVat  = rows.reduce((s,r)=>s+parseFloat(r.vat_amount||0),0)

  const today   = new Date().toISOString().split('T')[0]
  const in30    = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0]
  const in60    = new Date(Date.now() + 60 * 86400000).toISOString().split('T')[0]
  const overdue  = recurRows.filter(r => r.is_active && r.next_due_date <= today)
  const dueIn30  = recurRows.filter(r => r.is_active && r.next_due_date > today && r.next_due_date <= in30)
  const dueIn60  = recurRows.filter(r => r.is_active && r.next_due_date > in30  && r.next_due_date <= in60)
  const upcoming = recurRows.filter(r => r.is_active && r.next_due_date > today)

  const deleteMut = useMutation({
    mutationFn: () => expenseApi.delete(selectedId),
    onSuccess: (r) => { toast.success(r.data.message); qc.invalidateQueries(['expenses']); setSelectedId(null) },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Delete failed'),
  })

  const toggleMut = useMutation({
    mutationFn: (id) => recurringExpenseApi.toggle(id),
    onSuccess: (r) => { toast.success(r.data.message); qc.invalidateQueries(['recurring-expenses']) },
  })

  const deleteRecurMut = useMutation({
    mutationFn: (id) => recurringExpenseApi.delete(id),
    onSuccess: (r) => { toast.success(r.data.message); qc.invalidateQueries(['recurring-expenses']) },
  })

  const generateMut = useMutation({
    mutationFn: (id) => recurringExpenseApi.generate(id),
    onSuccess: (r) => {
      toast.success(`Expense generated — next due: ${fmtDate(r.data.next_due_date)}`)
      qc.invalidateQueries(['recurring-expenses'])
      qc.invalidateQueries(['expenses'])
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })

  const openEdit = () => {
    const row = rows.find(r => r.id === selectedId)
    if (!row) return; setEditing(row); setShowForm(true)
  }
  const openNew = () => { setEditing(null); setShowForm(true) }
  const confirmDelete = () => {
    const row = rows.find(r => r.id === selectedId)
    if (row && window.confirm(`Delete ${row.expense_no}?`)) deleteMut.mutate()
  }

  const TAB = (key, label) => (
    <button key={key} onClick={() => setTab(key)} style={{
      padding:'8px 18px', fontSize:12, fontWeight:600, border:'none', background:'transparent',
      borderBottom: tab === key ? '2px solid var(--blue)' : '2px solid transparent',
      color: tab === key ? 'var(--blue)' : '#666', cursor:'pointer', marginBottom:-2,
    }}>{label}</button>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Expenses</div>

      {/* Tab bar */}
      <div style={{display:'flex',gap:0,padding:'0 12px',borderBottom:'2px solid #e0e0e0',flexShrink:0,background:'#fafafa'}}>
        {TAB('expenses', 'All Expenses')}
        {TAB('recurring', `Recurring Templates${overdue.length ? ` ⚠ ${overdue.length} overdue` : dueIn30.length ? ` 🔔 ${dueIn30.length} due soon` : ''}`)}
        {TAB('forecast', '📊 12-Month Forecast')}
      </div>

      {/* ── ALL EXPENSES TAB ── */}
      {tab === 'expenses' && <>
        <div className="toolbar">
          <button className="btn primary" onClick={openNew}>＋ New Expense</button>
          <button className="btn" disabled={!selectedId} onClick={openEdit}>✏️ Edit</button>
          <button className="btn danger" disabled={!selectedId} onClick={confirmDelete}>🗑 Delete</button>
          <div className="toolbar-sep"/>
          <button className="btn" onClick={() => setShowCatMgr(true)}>📂 Categories</button>
        </div>
        <div style={{background:'#e8f5e9',borderBottom:'1px solid #a5d6a7',padding:'5px 12px',fontSize:12,color:'#1b5e20',flexShrink:0}}>
          ℹ VAT paid on expenses is automatically included in your input VAT report for NBR filing.
        </div>
        <div className="grid-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Expense No.</th><th>Date</th><th>Category</th><th>Description</th>
              <th className="right">Net BHD</th><th className="right">VAT BHD</th><th className="right">Total BHD</th>
            </tr></thead>
            <tbody>
              {isLoading&&<tr className="empty-row"><td colSpan={7}>Loading...</td></tr>}
              {!isLoading&&!rows.length&&<tr className="empty-row"><td colSpan={7}>No expenses recorded</td></tr>}
              {rows.map(e=>(
                <tr key={e.id} className={selectedId===e.id?'selected':''} onClick={()=>setSelectedId(e.id)}
                  onDoubleClick={()=>{setSelectedId(e.id);setEditing(e);setShowForm(true)}}>
                  <td style={{color:'var(--blue)',fontWeight:600}}>{e.expense_no}</td>
                  <td>{fmtDate(e.expense_date)}</td>
                  <td>{e.category_name||'—'}</td>
                  <td>{e.description}</td>
                  <td className="right">{fmtBhd(e.net_amount)}</td>
                  <td className="right" style={{color:'#c62828'}}>{fmtBhd(e.vat_amount)}</td>
                  <td className="right" style={{fontWeight:600}}>{fmtBhd(e.total_amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="status-bar">
          <span>{rows.length} expenses</span><span>|</span>
          <span>Total net: <strong>BHD {fmtBhd(totalNet)}</strong></span><span>|</span>
          <span>Input VAT: <strong style={{color:'#2e7d32'}}>BHD {fmtBhd(totalVat)}</strong></span>
        </div>
      </>}

      {/* ── RECURRING TEMPLATES TAB ── */}
      {tab === 'recurring' && <>
        <div className="toolbar">
          <button className="btn primary" onClick={() => { setEditingRecur(null); setShowRecurForm(true) }}>
            ＋ New Recurring Expense
          </button>
        </div>

        {(overdue.length > 0 || dueIn30.length > 0 || dueIn60.length > 0) && (
          <div style={{flexShrink:0,borderBottom:'1px solid #e0e0e0'}}>
            {/* Overdue row */}
            {overdue.length > 0 && (
              <div style={{background:'#fdecea',padding:'6px 12px',fontSize:12,color:'#b71c1c',display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontWeight:700}}>⚠ {overdue.length} overdue</span>
                {overdue.map(r => (
                  <span key={r.id} style={{display:'inline-flex',alignItems:'center',gap:6,background:'rgba(0,0,0,.06)',borderRadius:12,padding:'2px 10px'}}>
                    <span>{r.description}</span>
                    <span style={{color:'#888',fontSize:10}}>{fmtDate(r.next_due_date)}</span>
                    <button style={{fontSize:10,padding:'1px 7px',background:'#c62828',color:'#fff',border:'none',borderRadius:3,cursor:'pointer',fontWeight:700}}
                      onClick={() => setConfirmPayItem(r)}>Confirm</button>
                  </span>
                ))}
                <span style={{marginLeft:'auto',color:'#888',fontSize:11}}>
                  {overdue.some(r => r.auto_post) ? 'auto_post items post at 08:00 — confirm payment to record actual date & amount' : 'Confirm payment to record expense'}
                </span>
              </div>
            )}
            {/* Due in 30 days row */}
            {dueIn30.length > 0 && (
              <div style={{background:'#fff8e1',padding:'5px 12px',fontSize:12,color:'#5d4037',display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontWeight:700}}>🔔 Due within 30 days</span>
                {dueIn30.map(r => (
                  <span key={r.id} style={{display:'inline-flex',alignItems:'center',gap:5,background:'rgba(0,0,0,.05)',borderRadius:12,padding:'2px 10px'}}>
                    <span>{r.description}</span>
                    <span style={{color:'#f57c00',fontWeight:700,fontSize:11}}>{fmtDate(r.next_due_date)}</span>
                    <span style={{color:'#888',fontSize:10}}>BHD {parseFloat(r.total_amount).toFixed(3)}</span>
                  </span>
                ))}
              </div>
            )}
            {/* Due in 31–60 days row */}
            {dueIn60.length > 0 && (
              <div style={{background:'#f3f8ff',padding:'5px 12px',fontSize:12,color:'#37474f',display:'flex',gap:16,alignItems:'center',flexWrap:'wrap'}}>
                <span style={{fontWeight:700}}>📅 Due in 31–60 days</span>
                {dueIn60.map(r => (
                  <span key={r.id} style={{display:'inline-flex',alignItems:'center',gap:5,background:'rgba(0,0,0,.05)',borderRadius:12,padding:'2px 10px'}}>
                    <span>{r.description}</span>
                    <span style={{color:'#1565c0',fontSize:11}}>{fmtDate(r.next_due_date)}</span>
                    <span style={{color:'#888',fontSize:10}}>BHD {parseFloat(r.total_amount).toFixed(3)}</span>
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Description</th><th>Category</th><th>Frequency</th>
              <th className="right">Net BHD</th><th className="right">VAT BHD</th><th className="right">Total BHD</th>
              <th>Next Due</th><th>Last Posted</th><th>Posting</th><th>Status</th><th style={{width:160}}>Actions</th>
            </tr></thead>
            <tbody>
              {recurLoading && <tr className="empty-row"><td colSpan={11}>Loading...</td></tr>}
              {!recurLoading && !recurRows.length && (
                <tr className="empty-row"><td colSpan={11}>
                  No recurring expenses set up yet. Click <strong>＋ New Recurring Expense</strong> to add rent, utilities, etc.
                </td></tr>
              )}
              {recurRows.map(r => {
                const isDue = r.is_active && r.next_due_date <= today
                return (
                  <tr key={r.id} style={{background: isDue ? '#fff8e1' : !r.is_active ? '#fafafa' : 'inherit',
                                         opacity: r.is_active ? 1 : 0.6}}>
                    <td style={{fontWeight:600}}>{r.description}</td>
                    <td style={{fontSize:12,color:'#555'}}>{r.category_name||'—'}</td>
                    <td>
                      <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:700,
                        background: FREQ_COLOR[r.frequency]+'20', color: FREQ_COLOR[r.frequency]}}>
                        {FREQ_LABEL[r.frequency]}
                      </span>
                    </td>
                    <td className="right">{fmtBhd(r.net_amount)}</td>
                    <td className="right" style={{color:'#c62828'}}>{fmtBhd(r.vat_amount)}</td>
                    <td className="right" style={{fontWeight:700}}>{fmtBhd(r.total_amount)}</td>
                    <td style={{color: isDue?'#c62828':'inherit', fontWeight: isDue?700:'normal'}}>
                      {fmtDate(r.next_due_date)}{isDue?' ⚠':''}
                    </td>
                    <td style={{fontSize:12,color:'#888'}}>{r.last_generated ? fmtDate(r.last_generated) : '—'}</td>
                    <td>
                      {r.auto_post === false || r.auto_post === 'false'
                        ? <span title="Expense is only recorded after you confirm payment" style={{fontSize:11,padding:'2px 7px',borderRadius:10,background:'#fff3e0',color:'#e65100',fontWeight:600}}>Manual</span>
                        : <span title="Expense is auto-posted by scheduler on due date" style={{fontSize:11,padding:'2px 7px',borderRadius:10,background:'#e3f2fd',color:'#1565c0',fontWeight:600}}>Auto</span>}
                    </td>
                    <td>
                      {r.is_active
                        ? <span style={{fontSize:11,padding:'2px 7px',borderRadius:10,background:'#e8f5e9',color:'#2e7d32',fontWeight:600}}>Active</span>
                        : <span style={{fontSize:11,padding:'2px 7px',borderRadius:10,background:'#f5f5f5',color:'#888',fontWeight:600}}>Paused</span>}
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>
                      {r.is_active && isDue && (
                        <button className="btn primary" style={{fontSize:10,padding:'2px 7px',marginRight:4}}
                          onClick={() => setConfirmPayItem(r)}>
                          ✔ Confirm
                        </button>
                      )}
                      <button className="btn" style={{fontSize:10,padding:'2px 7px',marginRight:4}}
                        onClick={() => { setEditingRecur(r); setShowRecurForm(true) }}>✏</button>
                      <button className="btn" style={{fontSize:10,padding:'2px 7px',marginRight:4,
                        background: r.is_active?'#fff8e1':'#e8f5e9',
                        color:      r.is_active?'#f57c00':'#2e7d32',
                        borderColor:r.is_active?'#ffe082':'#a5d6a7'}}
                        onClick={() => toggleMut.mutate(r.id)}>
                        {r.is_active ? '⏸ Pause' : '▶ Resume'}
                      </button>
                      <button className="btn danger" style={{fontSize:10,padding:'2px 7px'}}
                        onClick={() => { if(window.confirm(`Delete "${r.description}"?`)) deleteRecurMut.mutate(r.id) }}>🗑</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="status-bar">
          <span>{recurRows.filter(r=>r.is_active).length} active templates</span><span>|</span>
          <span>{recurRows.filter(r=>!r.is_active).length} paused</span>
          {upcoming.length > 0 && <><span>|</span>
          <span>Monthly committed: <strong>BHD {fmtBhd(
            recurRows.filter(r=>r.is_active&&r.frequency==='monthly').reduce((s,r)=>s+parseFloat(r.total_amount||0),0)
          )}</strong>/mo</span></>}
        </div>
      </>}

      {/* ── FORECAST TAB ── */}
      {tab === 'forecast' && <ForecastTab recurRows={recurRows} />}

      {/* ── Modals ── */}
      {showForm && (
        <ExpenseForm cats={cats||[]} editing={editing}
          onClose={()=>{ setShowForm(false); setEditing(null) }}
          onSaved={()=>{ qc.invalidateQueries(['expenses']); setShowForm(false); setEditing(null) }}
          onManageCats={() => setShowCatMgr(true)} />
      )}
      {showRecurForm && (
        <RecurringExpenseForm cats={cats||[]} editing={editingRecur}
          onClose={()=>{ setShowRecurForm(false); setEditingRecur(null) }}
          onSaved={()=>{ qc.invalidateQueries(['recurring-expenses']); setShowRecurForm(false); setEditingRecur(null) }}
          onManageCats={() => setShowCatMgr(true)} />
      )}
      {confirmPayItem && (
        <ConfirmPaymentModal
          template={confirmPayItem}
          onClose={() => setConfirmPayItem(null)}
          onSaved={() => {
            qc.invalidateQueries(['recurring-expenses'])
            qc.invalidateQueries(['expenses'])
            setConfirmPayItem(null)
          }}
        />
      )}
      {showCatMgr && <CategoryManager onClose={() => { setShowCatMgr(false); qc.invalidateQueries(['cats-expense']) }} />}
    </div>
  )
}

function ExpenseForm({ cats, editing, onClose, onSaved, onManageCats }) {
  const empty = { category_id:'', expense_date: new Date().toISOString().split('T')[0], description:'', net_amount:'', vat_amount:'', notes:'' }
  const [form, setForm] = useState(editing ? {
    category_id:  editing.category_id || '',
    expense_date: editing.expense_date?.split('T')[0] || empty.expense_date,
    description:  editing.description || '',
    net_amount:   editing.net_amount || '',
    vat_amount:   editing.vat_amount || '',
    notes:        editing.notes || '',
  } : empty)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = {...form, total_amount:(parseFloat(form.net_amount||0)+parseFloat(form.vat_amount||0)).toFixed(3)}
      return editing ? expenseApi.update(editing.id, payload) : expenseApi.create(payload)
    },
    onSuccess: () => { toast.success(editing ? 'Expense updated' : 'Expense saved'); onSaved() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>{editing ? `Edit ${editing.expense_no}` : 'New Expense'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={()=>saveMut.mutate()} disabled={saveMut.isPending||!form.description||!form.net_amount}>
            💾 {saveMut.isPending ? 'Saving...' : 'Save'}
          </button>
          <button className="btn" onClick={onClose}>✕ Cancel</button>
        </div>
        <div className="modal-body" style={{padding:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div className="field"><label>Date *</label>
              <input type="date" value={form.expense_date} onChange={e=>F('expense_date',e.target.value)}/>
            </div>
            <div className="field"><label>Category</label>
              <div style={{ display:'flex', gap:4 }}>
                <select value={form.category_id} onChange={e=>F('category_id',e.target.value)} style={{ flex:1 }}>
                  <option value="">— None —</option>
                  {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" title="Manage categories" onClick={onManageCats}
                  style={{ padding:'0 8px', background:'#f5f5f5', border:'1px solid #ccc', borderRadius:3, cursor:'pointer', fontSize:14, color:'#555', flexShrink:0 }}>
                  ＋
                </button>
              </div>
            </div>
          </div>
          <div className="field" style={{marginBottom:8}}>
            <label>Description *</label>
            <input value={form.description} onChange={e=>F('description',e.target.value)} placeholder="What was this expense for?"/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div className="field"><label>Net Amount BHD *</label>
              <input type="number" step="0.001" value={form.net_amount} onChange={e=>F('net_amount',e.target.value)} placeholder="0.000"/>
            </div>
            <div className="field"><label>VAT Amount BHD</label>
              <input type="number" step="0.001" value={form.vat_amount} onChange={e=>F('vat_amount',e.target.value)} placeholder="0.000"/>
              <span style={{fontSize:10,color:'#888',marginTop:2}}>Leave 0 if no VAT receipt</span>
            </div>
          </div>
          <div className="field"><label>Notes</label>
            <textarea value={form.notes} onChange={e=>F('notes',e.target.value)} rows={2}/>
          </div>
          {form.net_amount && (
            <div style={{marginTop:8,padding:'6px 10px',background:'#f0f4fa',fontSize:12,borderRadius:2}}>
              Total: <strong>BHD {(parseFloat(form.net_amount||0)+parseFloat(form.vat_amount||0)).toFixed(3)}</strong>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Confirm Payment Modal ──────────────────────────────────────────────────
function ConfirmPaymentModal({ template, onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const [form, setForm] = useState({
    payment_date:      today,
    actual_amount:     parseFloat(template.net_amount || 0).toFixed(3),
    payment_method:    'bank_transfer',
    payment_reference: '',
    notes:             '',
  })
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveMut = useMutation({
    mutationFn: () => recurringExpenseApi.confirmPayment(template.id, form),
    onSuccess: (r) => {
      toast.success(`Payment recorded — next due: ${fmtDate(r.data.next_due_date)}`)
      onSaved()
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to record payment'),
  })

  const vatAmt   = parseFloat(template.vat_amount || 0)
  const netAmt   = parseFloat(form.actual_amount || 0)
  const totalAmt = (netAmt + vatAmt).toFixed(3)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>✔ Confirm Payment</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending || !form.payment_date || !form.actual_amount}>
            💾 {saveMut.isPending ? 'Recording…' : 'Record Payment'}
          </button>
          <button className="btn" onClick={onClose}>✕ Cancel</button>
        </div>
        <div className="modal-body" style={{ padding: 12 }}>
          {/* Description banner */}
          <div style={{ padding: '8px 10px', background: '#f3f8ff', borderRadius: 4, marginBottom: 10, fontSize: 13 }}>
            <strong>{template.description}</strong>
            <span style={{ float: 'right', color: '#1565c0', fontWeight: 700 }}>
              Due: {fmtDate(template.next_due_date)}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div className="field">
              <label>Payment Date *</label>
              <input type="date" value={form.payment_date} onChange={e => F('payment_date', e.target.value)} />
            </div>
            <div className="field">
              <label>Actual Net Amount BHD *</label>
              <input type="number" step="0.001" value={form.actual_amount}
                onChange={e => F('actual_amount', e.target.value)} />
              <span style={{ fontSize: 10, color: '#888', marginTop: 2 }}>
                Template: BHD {parseFloat(template.net_amount).toFixed(3)} · VAT: BHD {vatAmt.toFixed(3)}
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div className="field">
              <label>Payment Method</label>
              <select value={form.payment_method} onChange={e => F('payment_method', e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cheque">Cheque</option>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="online">Online Payment</option>
              </select>
            </div>
            <div className="field">
              <label>Reference / Receipt No.</label>
              <input value={form.payment_reference} onChange={e => F('payment_reference', e.target.value)}
                placeholder="TXN-2024-001 or receipt number" />
            </div>
          </div>

          <div className="field" style={{ marginBottom: 8 }}>
            <label>Notes</label>
            <input value={form.notes} onChange={e => F('notes', e.target.value)}
              placeholder="e.g. renewal for 2 years, paid at Ministry window 3" />
          </div>

          <div style={{ padding: '8px 10px', background: '#e8f5e9', borderRadius: 4, fontSize: 12, color: '#1b5e20' }}>
            <strong>Total to record: BHD {totalAmt}</strong>
            <span style={{ marginLeft: 12, color: '#555' }}>
              Next due date will advance to: <strong>{(() => {
                // Quick client-side preview (exact calc is done server-side)
                const d = new Date(form.payment_date || today)
                const freq = template.frequency
                const dom = Math.min(parseInt(template.day_of_month) || 1, 28)
                let next
                switch (freq) {
                  case 'weekly':      next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7); break
                  case 'quarterly':   next = new Date(d.getFullYear(), d.getMonth() + 3, dom); break
                  case 'half_yearly': next = new Date(d.getFullYear(), d.getMonth() + 6, dom); break
                  case 'yearly':      next = new Date(d.getFullYear() + 1, d.getMonth(), dom); break
                  case 'bi_annual':   next = new Date(d.getFullYear() + 2, d.getMonth(), dom); break
                  default:            next = new Date(d.getFullYear(), d.getMonth() + 1, dom)
                }
                return fmtDate(next.toISOString().split('T')[0])
              })()}</strong>
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Recurring Expense Form ──────────────────────────────────────────────────
function RecurringExpenseForm({ cats, editing, onClose, onSaved, onManageCats }) {
  const defaultNext = (() => {
    const d = new Date(); d.setMonth(d.getMonth()+1); d.setDate(1)
    return d.toISOString().split('T')[0]
  })()

  const empty = {
    category_id:'', description:'', net_amount:'', vat_amount:'0',
    frequency:'monthly', day_of_month:'1',
    next_due_date: defaultNext, end_date:'', notes:'',
    auto_post: true, reminder_days: [30, 7],
  }
  const [form, setForm] = useState(editing ? {
    category_id:   editing.category_id  || '',
    description:   editing.description  || '',
    net_amount:    editing.net_amount   || '',
    vat_amount:    editing.vat_amount   || '0',
    frequency:     editing.frequency    || 'monthly',
    day_of_month:  editing.day_of_month || '1',
    next_due_date: editing.next_due_date?.split('T')[0] || defaultNext,
    end_date:      editing.end_date?.split('T')[0] || '',
    notes:         editing.notes || '',
    auto_post:     editing.auto_post !== false,
    reminder_days: editing.reminder_days || [30, 7],
  } : empty)

  const toggleReminderDay = (day) => {
    const current = form.reminder_days || []
    const updated = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort((a,b) => b-a)
    F('reminder_days', updated)
  }
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = { ...form, vat_amount: form.vat_amount||0, day_of_month: parseInt(form.day_of_month)||1, end_date: form.end_date||null }
      return editing ? recurringExpenseApi.update(editing.id, payload) : recurringExpenseApi.create(payload)
    },
    onSuccess: () => { toast.success(editing ? 'Template updated' : 'Recurring expense created'); onSaved() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  const total = (parseFloat(form.net_amount||0)+parseFloat(form.vat_amount||0)).toFixed(3)

  const freqNote = {
    weekly:      'Generates every 7 days',
    monthly:     `Generates on day ${form.day_of_month} of each month`,
    quarterly:   `Generates on day ${form.day_of_month} every 3 months`,
    half_yearly: `Generates on day ${form.day_of_month} every 6 months`,
    yearly:      `Generates on day ${form.day_of_month} of the same month each year`,
    bi_annual:   `Generates on day ${form.day_of_month} every 2 years — use for visa/work permit renewals`,
  }[form.frequency]

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>{editing ? '✏ Edit Recurring Expense' : '🔁 New Recurring Expense'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={()=>saveMut.mutate()}
            disabled={saveMut.isPending||!form.description||!form.net_amount||!form.next_due_date}>
            💾 {saveMut.isPending?'Saving...':'Save'}
          </button>
          <button className="btn" onClick={onClose}>✕ Cancel</button>
        </div>
        <div className="modal-body" style={{padding:12}}>
          <div className="field" style={{marginBottom:8}}>
            <label>Description *</label>
            <input value={form.description} onChange={e=>F('description',e.target.value)}
              placeholder="e.g. Shop Rent — Ground Floor, BATELCO Internet, Electricity Bill" autoFocus/>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div className="field"><label>Category</label>
              <div style={{display:'flex',gap:4}}>
                <select value={form.category_id} onChange={e=>F('category_id',e.target.value)} style={{flex:1}}>
                  <option value="">— None —</option>
                  {cats.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button type="button" onClick={onManageCats}
                  style={{padding:'0 8px',background:'#f5f5f5',border:'1px solid #ccc',borderRadius:3,cursor:'pointer',fontSize:14,color:'#555',flexShrink:0}}>＋</button>
              </div>
            </div>
            <div className="field"><label>Frequency *</label>
              <select value={form.frequency} onChange={e=>F('frequency',e.target.value)}>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly (every 3 months)</option>
                <option value="half_yearly">Half-Yearly (every 6 months)</option>
                <option value="yearly">Yearly</option>
                <option value="bi_annual">Every 2 Years (visa / permit renewals)</option>
              </select>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div className="field"><label>Net Amount BHD *</label>
              <input type="number" step="0.001" value={form.net_amount} onChange={e=>F('net_amount',e.target.value)} placeholder="0.000"/>
            </div>
            <div className="field"><label>VAT Amount BHD</label>
              <input type="number" step="0.001" value={form.vat_amount} onChange={e=>F('vat_amount',e.target.value)} placeholder="0.000"/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:8}}>
            {form.frequency !== 'weekly' && (
              <div className="field"><label>Day of Month</label>
                <input type="number" min="1" max="28" value={form.day_of_month} onChange={e=>F('day_of_month',e.target.value)}/>
                <span style={{fontSize:10,color:'#888',marginTop:2}}>Max 28 (safe for all months)</span>
              </div>
            )}
            <div className="field"><label>First Due Date *</label>
              <input type="date" value={form.next_due_date} onChange={e=>F('next_due_date',e.target.value)}/>
            </div>
            <div className="field"><label>End Date (optional)</label>
              <input type="date" value={form.end_date} onChange={e=>F('end_date',e.target.value)}/>
              <span style={{fontSize:10,color:'#888',marginTop:2}}>Leave blank to run forever</span>
            </div>
          </div>
          <div className="field" style={{marginBottom:8}}>
            <label>Notes</label>
            <input value={form.notes} onChange={e=>F('notes',e.target.value)} placeholder="e.g. Lease ref: BLD-2024-001, Landlord: Al Rashid Properties"/>
          </div>

          {/* Posting mode + Reminders */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div className="field">
              <label>Posting Mode</label>
              <select value={form.auto_post ? 'auto' : 'manual'} onChange={e => F('auto_post', e.target.value === 'auto')}>
                <option value="auto">Auto-post on due date</option>
                <option value="manual">Manual — confirm payment first</option>
              </select>
              <span style={{fontSize:10,color:'#888',marginTop:2}}>
                {form.auto_post
                  ? 'Expense posted automatically by scheduler (utilities, rent)'
                  : 'Expense only recorded when you confirm payment (govt fees, licences)'}
              </span>
            </div>
            <div className="field">
              <label>Email Reminders</label>
              <div style={{display:'flex',gap:6,flexWrap:'wrap',marginTop:4}}>
                {[60,30,14,7,3,1].map(day => (
                  <label key={day} style={{display:'inline-flex',alignItems:'center',gap:3,fontSize:12,cursor:'pointer',
                    padding:'2px 8px',borderRadius:12,
                    background: (form.reminder_days||[]).includes(day) ? '#1565c020' : '#f5f5f5',
                    border: `1px solid ${(form.reminder_days||[]).includes(day) ? '#1565c0' : '#ccc'}`,
                    color: (form.reminder_days||[]).includes(day) ? '#1565c0' : '#555'}}>
                    <input type="checkbox" checked={(form.reminder_days||[]).includes(day)}
                      onChange={() => toggleReminderDay(day)}
                      style={{width:11,height:11,margin:0}} />
                    {day}d
                  </label>
                ))}
              </div>
              <span style={{fontSize:10,color:'#888',marginTop:2}}>Days before due date to send email reminder</span>
            </div>
          </div>

          <div style={{padding:'8px 10px',background:'#e8f5e9',borderRadius:4,fontSize:12,color:'#1b5e20'}}>
            <strong>Total per occurrence: BHD {total}</strong>
            <span style={{marginLeft:12,color:'#388e3c'}}>{freqNote}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── 12-Month Forecast Tab ──────────────────────────────────────────────────
function ForecastTab({ recurRows }) {
  const activeTemplates = (recurRows || []).filter(r => r.is_active)

  // Build a 12-month forecast from today
  const today   = new Date()
  const months  = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(today.getFullYear(), today.getMonth() + i, 1)
    return {
      key:   `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`,
      label: d.toLocaleDateString('en-BH', { month: 'short', year: 'numeric' }),
      year:  d.getFullYear(),
      month: d.getMonth(),     // 0-indexed
    }
  })

  // For each template, find all occurrences within the 12-month window
  function occurrencesInMonth(tmpl, year, month) {
    // Check if next_due_date falls in this month (and is within the 12-month window)
    // We simulate forward from next_due_date until past the 12-month window
    const windowEnd  = new Date(today.getFullYear(), today.getMonth() + 12, 0) // last day of month+12
    const items = []
    let   current = new Date(tmpl.next_due_date)
    const endDate = tmpl.end_date ? new Date(tmpl.end_date) : null

    // Walk forward through all occurrences in the window
    for (let i = 0; i < 200; i++) {  // safety cap
      if (current > windowEnd) break
      if (endDate && current > endDate) break
      if (current.getFullYear() === year && current.getMonth() === month) {
        items.push(current.toISOString().split('T')[0])
      }
      // Advance to next occurrence
      const dom = Math.min(parseInt(tmpl.day_of_month) || 1, 28)
      let next
      switch (tmpl.frequency) {
        case 'weekly':      next = new Date(current.getFullYear(), current.getMonth(), current.getDate() + 7); break
        case 'quarterly':   next = new Date(current.getFullYear(), current.getMonth() + 3, dom); break
        case 'half_yearly': next = new Date(current.getFullYear(), current.getMonth() + 6, dom); break
        case 'yearly':      next = new Date(current.getFullYear() + 1, current.getMonth(), dom); break
        case 'bi_annual':   next = new Date(current.getFullYear() + 2, current.getMonth(), dom); break
        default:            next = new Date(current.getFullYear(), current.getMonth() + 1, dom)
      }
      if (next <= current) break  // guard infinite loop
      current = next
    }
    return items
  }

  // Build month-by-month data
  const monthData = months.map(m => {
    const items = []
    for (const tmpl of activeTemplates) {
      const dates = occurrencesInMonth(tmpl, m.year, m.month)
      for (const date of dates) {
        items.push({ ...tmpl, occurrence_date: date })
      }
    }
    items.sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date))
    const total = items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)
    return { ...m, items, total }
  })

  const grandTotal = monthData.reduce((s, m) => s + m.total, 0)
  const maxTotal   = Math.max(...monthData.map(m => m.total), 1)

  const [expanded, setExpanded] = useState(null)

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '12px 16px' }}>
      <div style={{ fontSize: 12, color: '#666', marginBottom: 14 }}>
        Projected recurring expenses for the next 12 months based on active templates and their schedules.
        One-off or manually-confirmed expenses are not included.
      </div>

      {activeTemplates.length === 0 && (
        <div style={{ textAlign: 'center', color: '#aaa', padding: 40 }}>
          No active recurring expense templates. Add some in the Recurring Templates tab.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {monthData.map(m => {
          const isExpanded  = expanded === m.key
          const barWidth    = m.total > 0 ? `${Math.round((m.total / maxTotal) * 100)}%` : '0%'
          const isThisMonth = m.year === today.getFullYear() && m.month === today.getMonth()

          return (
            <div key={m.key} style={{
              border: `1px solid ${isThisMonth ? '#1565c0' : '#e0e0e0'}`,
              borderRadius: 6,
              overflow: 'hidden',
              background: isThisMonth ? '#f7faff' : '#fff',
            }}>
              {/* Month header row */}
              <div
                onClick={() => setExpanded(isExpanded ? null : m.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', cursor: 'pointer' }}>
                <div style={{ width: 110, fontSize: 12, fontWeight: isThisMonth ? 700 : 600,
                              color: isThisMonth ? '#1565c0' : '#333', flexShrink: 0 }}>
                  {isThisMonth ? '▶ ' : ''}{m.label}
                </div>
                {/* Bar */}
                <div style={{ flex: 1, height: 14, background: '#f0f0f0', borderRadius: 7, overflow: 'hidden' }}>
                  <div style={{ width: barWidth, height: '100%',
                    background: isThisMonth ? '#1565c0' : '#42a5f5', borderRadius: 7,
                    transition: 'width 0.3s' }} />
                </div>
                <div style={{ width: 90, textAlign: 'right', fontSize: 13, fontWeight: 700,
                              color: m.total > 0 ? '#1b5e20' : '#bbb', flexShrink: 0 }}>
                  {m.total > 0 ? `BHD ${m.total.toFixed(3)}` : '—'}
                </div>
                <div style={{ width: 22, textAlign: 'center', color: '#aaa', fontSize: 11, flexShrink: 0 }}>
                  {m.items.length > 0 ? (isExpanded ? '▲' : '▼') : ''}
                </div>
              </div>

              {/* Expanded items */}
              {isExpanded && m.items.length > 0 && (
                <div style={{ borderTop: '1px solid #e8e8e8', padding: '0 12px 8px' }}>
                  <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ color: '#888' }}>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Description</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Category</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Frequency</th>
                        <th style={{ textAlign: 'left', padding: '4px 6px', fontWeight: 600 }}>Date</th>
                        <th style={{ textAlign: 'right', padding: '4px 6px', fontWeight: 600 }}>Amount BHD</th>
                      </tr>
                    </thead>
                    <tbody>
                      {m.items.map((item, idx) => (
                        <tr key={idx} style={{ borderTop: '1px solid #f0f0f0' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600 }}>{item.description}</td>
                          <td style={{ padding: '4px 6px', color: '#666' }}>{item.category_name || '—'}</td>
                          <td style={{ padding: '4px 6px' }}>
                            <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 9,
                              background: FREQ_COLOR[item.frequency] + '20',
                              color: FREQ_COLOR[item.frequency], fontWeight: 700 }}>
                              {FREQ_LABEL[item.frequency]}
                            </span>
                          </td>
                          <td style={{ padding: '4px 6px', color: '#555' }}>{fmtDate(item.occurrence_date)}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 600 }}>
                            {parseFloat(item.total_amount).toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Grand total */}
      {grandTotal > 0 && (
        <div style={{ marginTop: 14, padding: '10px 16px', background: '#1b5e20', borderRadius: 6,
                      color: '#fff', display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
          <span>Total committed recurring spend (next 12 months)</span>
          <strong>BHD {grandTotal.toFixed(3)}</strong>
        </div>
      )}
    </div>
  )
}
