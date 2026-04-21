import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expenseApi, recurringExpenseApi, categoryApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const FREQ_LABEL = { weekly:'Weekly', monthly:'Monthly', quarterly:'Quarterly', yearly:'Yearly' }
const FREQ_COLOR = { weekly:'#7b1fa2', monthly:'#1565c0', quarterly:'#2e7d32', yearly:'#e65100' }

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
  const [tab, setTab] = useState('expenses')  // 'expenses' | 'recurring'
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showCatMgr, setShowCatMgr] = useState(false)
  const [showRecurForm, setShowRecurForm] = useState(false)
  const [editingRecur, setEditingRecur] = useState(null)

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

  const today = new Date().toISOString().split('T')[0]
  const overdue  = recurRows.filter(r => r.is_active && r.next_due_date <= today)
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
        {TAB('recurring', `Recurring Templates${overdue.length ? ` ⚠ ${overdue.length} due` : ''}`)}
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

        {overdue.length > 0 && (
          <div style={{background:'#fff8e1',borderBottom:'1px solid #ffe082',padding:'6px 12px',fontSize:12,color:'#5d4037',flexShrink:0}}>
            ⚠ <strong>{overdue.length} template{overdue.length>1?'s':''} due today or overdue</strong> — click <em>Post Now</em> to generate the expense entry, or they will be auto-posted tonight at 8:00 AM.
          </div>
        )}

        <div className="grid-wrap">
          <table className="data-table">
            <thead><tr>
              <th>Description</th><th>Category</th><th>Frequency</th>
              <th className="right">Net BHD</th><th className="right">VAT BHD</th><th className="right">Total BHD</th>
              <th>Next Due</th><th>Last Posted</th><th>Status</th><th style={{width:160}}>Actions</th>
            </tr></thead>
            <tbody>
              {recurLoading && <tr className="empty-row"><td colSpan={10}>Loading...</td></tr>}
              {!recurLoading && !recurRows.length && (
                <tr className="empty-row"><td colSpan={10}>
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
                      {r.is_active
                        ? <span style={{fontSize:11,padding:'2px 7px',borderRadius:10,background:'#e8f5e9',color:'#2e7d32',fontWeight:600}}>Active</span>
                        : <span style={{fontSize:11,padding:'2px 7px',borderRadius:10,background:'#f5f5f5',color:'#888',fontWeight:600}}>Paused</span>}
                    </td>
                    <td style={{whiteSpace:'nowrap'}}>
                      {r.is_active && isDue && (
                        <button className="btn primary" style={{fontSize:10,padding:'2px 7px',marginRight:4}}
                          onClick={() => generateMut.mutate(r.id)} disabled={generateMut.isPending}>
                          ▶ Post Now
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
  }
  const [form, setForm] = useState(editing ? {
    category_id:  editing.category_id  || '',
    description:  editing.description  || '',
    net_amount:   editing.net_amount   || '',
    vat_amount:   editing.vat_amount   || '0',
    frequency:    editing.frequency    || 'monthly',
    day_of_month: editing.day_of_month || '1',
    next_due_date: editing.next_due_date?.split('T')[0] || defaultNext,
    end_date:     editing.end_date?.split('T')[0] || '',
    notes:        editing.notes || '',
  } : empty)
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
    weekly:    'Generates every 7 days',
    monthly:   `Generates on day ${form.day_of_month} of each month`,
    quarterly: `Generates on day ${form.day_of_month} every 3 months`,
    yearly:    `Generates on day ${form.day_of_month} of the same month each year`,
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
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
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
          <div style={{padding:'8px 10px',background:'#e8f5e9',borderRadius:4,fontSize:12,color:'#1b5e20'}}>
            <strong>Total per occurrence: BHD {total}</strong>
            <span style={{marginLeft:12,color:'#388e3c'}}>{freqNote}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
