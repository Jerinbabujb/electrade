import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customerApi } from '../../../services/api'
import toast from 'react-hot-toast'

const emptyForm = { code:'', name:'', type:'retail', vat_number:'', cr_number:'', tel:'', email:'', address:'', payment_terms_days:30, price_tier:1, credit_limit:0 }

export default function CustomerPickerModal({ onSelect, onClose }) {
  const [q, setQ] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['cust-pick', q],
    queryFn:  () => customerApi.list({ q }).then(r => r.data.data)
  })
  const rows = (data || []).filter(c => c.type !== 'supplier')

  const createMut = useMutation({
    mutationFn: d => customerApi.create(d),
    onSuccess: (res) => {
      const newCust = res.data.data
      toast.success(`Customer "${newCust.name}" created`)
      qc.invalidateQueries(['customers'])
      qc.invalidateQueries(['cust-pick'])
      onSelect(newCust)
    }
  })

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm" style={{ maxHeight:'80vh' }}>
        <div className="modal-header">
          <h3>📁 {showNew ? 'New Customer' : 'Select Customer'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {!showNew ? (
          <>
            <div style={{ padding:'8px 12px', borderBottom:'1px solid #ddd', background:'#f8f8f8', flexShrink:0, display:'flex', gap:6 }}>
              <input type="text" value={q} onChange={e => setQ(e.target.value)}
                placeholder="Search by name, CR, VAT..." autoFocus
                style={{ flex:1, padding:'5px 8px', border:'1px solid #bbb', borderRadius:2, fontSize:13 }}/>
              <button className="btn primary" style={{ flexShrink:0, fontSize:11 }} onClick={() => { setForm(emptyForm); setShowNew(true) }}>＋ New Customer</button>
            </div>
            <div style={{ overflow:'auto', flex:1 }}>
              <table className="data-table" style={{ fontSize:12 }}>
                <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>VAT No.</th></tr></thead>
                <tbody>
                  {isLoading && <tr className="empty-row"><td colSpan={4}>Searching...</td></tr>}
                  {!isLoading && !rows.length && (
                    <tr className="empty-row">
                      <td colSpan={4}>
                        No customers found —{' '}
                        <span style={{ color:'var(--blue)', cursor:'pointer', textDecoration:'underline' }}
                          onClick={() => { setForm({ ...emptyForm, name: q }); setShowNew(true) }}>
                          + Create "{q || 'new customer'}"
                        </span>
                      </td>
                    </tr>
                  )}
                  {rows.map(c => (
                    <tr key={c.id} style={{ cursor:'pointer' }} onClick={() => onSelect(c)}
                      onMouseEnter={e => e.currentTarget.style.background='#eef4fc'}
                      onMouseLeave={e => e.currentTarget.style.background=''}>
                      <td style={{ color:'var(--blue)', fontWeight:600 }}>{c.code}</td>
                      <td style={{ fontWeight:600 }}>{c.name}</td>
                      <td><span style={{ fontSize:11, padding:'1px 6px', background:'#e8e8e8', borderRadius:10 }}>{c.type}</span></td>
                      <td style={{ color:'#888' }}>{c.vat_number || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <div style={{ padding:12, overflow:'auto', flex:1 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:8, marginBottom:8 }}>
              <div className="field">
                <label>Code <span style={{ color:'#aaa', fontWeight:400 }}>(optional)</span></label>
                <input value={form.code} onChange={e => F('code', e.target.value)} placeholder="Auto-generated" autoFocus/>
              </div>
              <div className="field"><label>Name *</label><input value={form.name} onChange={e => F('name', e.target.value)} placeholder="Company or person name"/></div>
              <div className="field"><label>Type</label>
                <select value={form.type} onChange={e => F('type', e.target.value)}>
                  {['retail','wholesale','contractor','government'].map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
              <div className="field"><label>VAT Number</label><input value={form.vat_number} onChange={e => F('vat_number', e.target.value)} placeholder="BH-VAT-..."/></div>
              <div className="field"><label>CR Number</label><input value={form.cr_number} onChange={e => F('cr_number', e.target.value)}/></div>
              <div className="field"><label>Tel</label><input value={form.tel} onChange={e => F('tel', e.target.value)} placeholder="+973 17..."/></div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
              <div className="field"><label>Email</label><input type="email" value={form.email} onChange={e => F('email', e.target.value)} placeholder="accounts@company.com"/></div>
              <div className="field"><label>Address</label><input value={form.address} onChange={e => F('address', e.target.value)} placeholder="Building, Road, Block, Area"/></div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="btn primary"
                disabled={createMut.isPending || !form.name.trim()}
                onClick={() => createMut.mutate(form)}>
                {createMut.isPending ? '⏳ Saving...' : '💾 Save & Select'}
              </button>
              <button className="btn" onClick={() => setShowNew(false)}>← Back to Search</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
