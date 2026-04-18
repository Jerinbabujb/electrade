import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { expenseApi, categoryApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

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
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showCatMgr, setShowCatMgr] = useState(false)

  const { data, isLoading } = useQuery({ queryKey:['expenses'], queryFn:()=>expenseApi.list().then(r=>r.data.data) })
  const { data: cats } = useQuery({ queryKey:['cats-expense'], queryFn:()=>categoryApi.list('expense').then(r=>r.data.data) })
  const rows = data || []
  const totalNet = rows.reduce((s,r)=>s+parseFloat(r.net_amount||0),0)
  const totalVat = rows.reduce((s,r)=>s+parseFloat(r.vat_amount||0),0)

  const deleteMut = useMutation({
    mutationFn: () => expenseApi.delete(selectedId),
    onSuccess: (r) => { toast.success(r.data.message); qc.invalidateQueries(['expenses']); setSelectedId(null) },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Delete failed'),
  })

  const openEdit = () => {
    const row = rows.find(r => r.id === selectedId)
    if (!row) return
    setEditing(row)
    setShowForm(true)
  }

  const openNew = () => { setEditing(null); setShowForm(true) }

  const confirmDelete = () => {
    const row = rows.find(r => r.id === selectedId)
    if (row && window.confirm(`Delete ${row.expense_no}?`)) deleteMut.mutate()
  }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Expenses</div>
      <div className="toolbar">
        <button className="btn primary" onClick={openNew}>＋ New Expense</button>
        <button className="btn" disabled={!selectedId} onClick={openEdit}>✏️ Edit</button>
        <button className="btn danger" disabled={!selectedId} onClick={confirmDelete}>🗑 Delete</button>
        <div className="toolbar-sep"/>
        <button className="btn" onClick={() => setShowCatMgr(true)}>📂 Categories</button>
        <button className="btn">📤 Export</button>
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
              <tr key={e.id} className={selectedId===e.id?'selected':''} onClick={()=>setSelectedId(e.id)} onDoubleClick={()=>{setSelectedId(e.id);setEditing(e);setShowForm(true)}}>
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

      {showForm && (
        <ExpenseForm
          cats={cats||[]}
          editing={editing}
          onClose={()=>{ setShowForm(false); setEditing(null) }}
          onSaved={()=>{ qc.invalidateQueries(['expenses']); setShowForm(false); setEditing(null) }}
          onManageCats={() => setShowCatMgr(true)}
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
