import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customerApi } from '../../../services/api'
import { fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const empty = {
  code: '', name: '', cr_number: '', vat_number: '',
  address: '', tel: '', email: '', notes: '',
  payment_terms_days: 30,
  supplier_payment_terms_days: '',
  is_customer: false,
}

function SupplierForm({ supplier, onClose, onSaved }) {
  const isEdit = !!supplier?.id
  const qc = useQueryClient()
  const [form, setForm] = useState(supplier
    ? { ...empty, ...supplier }
    : empty
  )
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveMut = useMutation({
    mutationFn: (data) => isEdit
      ? customerApi.update(supplier.id, { ...data, is_supplier: true })
      : customerApi.create({ ...data, type: 'supplier', is_supplier: true }),
    onSuccess: (res) => {
      toast.success(isEdit ? 'Supplier updated' : 'Supplier created')
      qc.invalidateQueries(['suppliers'])
      qc.invalidateQueries(['typeahead-customers'])
      onSaved && onSaved(res.data.data)
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  const handleSave = () => {
    if (!form.name.trim()) { toast.error('Supplier name is required'); return }
    saveMut.mutate(form)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>{isEdit ? `Edit Supplier — ${supplier.name}` : '＋ New Supplier'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-toolbar">
          <button className="btn primary" onClick={handleSave} disabled={saveMut.isPending}>
            {saveMut.isPending ? '⏳ Saving…' : '💾 Save'}
          </button>
          <div className="toolbar-sep" />
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>

        <div className="modal-body">
          <div className="form-section">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Supplier Name *</label>
                <input value={form.name} onChange={e => F('name', e.target.value)}
                  placeholder="Company or trading name" autoFocus />
              </div>
              <div className="field">
                <label>Supplier Code</label>
                <input value={form.code} onChange={e => F('code', e.target.value)}
                  placeholder="SUP-001" />
              </div>
              <div className="field">
                <label>{form.is_customer ? 'Customer Payment Terms — AR (days)' : 'Payment Terms (days)'}</label>
                <input type="number" value={form.payment_terms_days}
                  onChange={e => F('payment_terms_days', e.target.value)} min={0} />
              </div>
              {form.is_customer && (
                <div className="field">
                  <label>Supplier Payment Terms — AP (days)</label>
                  <input type="number"
                    value={form.supplier_payment_terms_days ?? ''}
                    onChange={e => F('supplier_payment_terms_days', e.target.value === '' ? null : e.target.value)}
                    min={0} placeholder={`Same as AR (${form.payment_terms_days}d)`}/>
                  <div style={{fontSize:10,color:'#888',marginTop:2}}>
                    How long before you must pay this supplier. Leave blank to use AR terms.
                  </div>
                </div>
              )}
              <div className="field">
                <label>CR / Trade Licence No.</label>
                <input value={form.cr_number} onChange={e => F('cr_number', e.target.value)}
                  placeholder="12345-1" />
              </div>
              <div className="field">
                <label>VAT Registration No.</label>
                <input value={form.vat_number} onChange={e => F('vat_number', e.target.value)}
                  placeholder="BH000000000" />
              </div>
              <div className="field">
                <label>Phone / Tel</label>
                <input value={form.tel} onChange={e => F('tel', e.target.value)}
                  placeholder="+973 1234 5678" />
              </div>
              <div className="field">
                <label>Email</label>
                <input type="email" value={form.email} onChange={e => F('email', e.target.value)}
                  placeholder="orders@supplier.com" />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Address</label>
                <input value={form.address} onChange={e => F('address', e.target.value)}
                  placeholder="Street, city, country" />
              </div>
              <div className="field" style={{ gridColumn: 'span 2' }}>
                <label>Notes</label>
                <textarea rows={2} value={form.notes} onChange={e => F('notes', e.target.value)}
                  placeholder="Internal notes about this supplier…" />
              </div>
              <div style={{ gridColumn: 'span 2', padding: '8px 10px', background: '#f0f7ff',
                            border: '1px solid #b0d0f0', borderRadius: 4 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 0 }}>
                  <input type="checkbox" checked={!!form.is_customer}
                    onChange={e => F('is_customer', e.target.checked)} />
                  <span style={{ fontSize: 12, fontWeight: 600 }}>Also acts as Customer</span>
                  <span style={{ fontSize: 11, color: '#555', fontWeight: 400 }}>
                    — this company both supplies to you and buys from you (enables invoicing &amp; contra accounts)
                  </span>
                </label>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function SuppliersModule() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['suppliers', q],
    queryFn: () => customerApi.list({ role: 'supplier', q }).then(r => r.data.data || []),
  })
  const rows = data || []
  const sel = rows.find(r => r.id === selectedId)

  const openNew = () => { setEditing(null); setShowForm(true) }
  const openEdit = () => {
    if (!sel) return
    setEditing(sel)
    setShowForm(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="module-title">Suppliers</div>

      <div className="toolbar">
        <button className="btn primary" onClick={openNew}>＋ New Supplier</button>
        <button className="btn" disabled={!selectedId} onClick={openEdit}>✏️ Edit</button>
        <div className="toolbar-sep" />
        <div className="toolbar-search">
          <input type="text" placeholder="Search supplier name, VAT, CR…"
            value={q} onChange={e => setQ(e.target.value)} />
          <button className="btn">🔍</button>
        </div>
      </div>

      {sel && (
        <div style={{ background: 'var(--blue-light)', borderBottom: '1px solid #b0c8f0', padding: '5px 12px', fontSize: 12, color: '#1a3a6c', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 16 }}>
          Selected: <strong>{sel.name}</strong>
          {sel.tel && <span>📞 {sel.tel}</span>}
          {sel.email && <span>✉️ {sel.email}</span>}
        </div>
      )}

      <div className="grid-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: 28 }}><input type="checkbox" /></th>
              <th>Code</th>
              <th>Supplier Name</th>
              <th>Role</th>
              <th>CR / Licence</th>
              <th>VAT No.</th>
              <th>Phone</th>
              <th>Email</th>
              <th>Address</th>
              <th>Payment Terms</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={9}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row">
                <td colSpan={9}>No suppliers yet — click New Supplier to add one</td>
              </tr>
            )}
            {rows.map(s => (
              <tr key={s.id}
                className={selectedId === s.id ? 'selected' : ''}
                onClick={() => setSelectedId(s.id)}
                onDoubleClick={() => { setSelectedId(s.id); setEditing(s); setShowForm(true) }}
              >
                <td><input type="checkbox" checked={selectedId === s.id} onChange={() => setSelectedId(s.id)} /></td>
                <td style={{ color: 'var(--blue)', fontWeight: 600, fontSize: 11 }}>{s.code || '—'}</td>
                <td style={{ fontWeight: 600 }}>{s.name}</td>
                <td>
                  {s.is_customer
                    ? <span style={{ fontSize: 10, background: '#fff3e0', color: '#e65100', padding: '1px 6px', borderRadius: 8, fontWeight: 600 }}>supplier + {s.customer_category || 'customer'}</span>
                    : <span style={{ fontSize: 10, color: '#aaa' }}>supplier</span>
                  }
                </td>
                <td style={{ fontSize: 11 }}>{s.cr_number || '—'}</td>
                <td style={{ fontSize: 11 }}>{s.vat_number || '—'}</td>
                <td style={{ fontSize: 11 }}>{s.tel || '—'}</td>
                <td style={{ fontSize: 11 }}>{s.email || '—'}</td>
                <td style={{ fontSize: 11, color: '#666' }}>{s.address || '—'}</td>
                <td style={{ textAlign: 'center' }}>
                  {s.is_customer && s.supplier_payment_terms_days != null
                    ? <span title={`AR: ${s.payment_terms_days}d`}>
                        {s.supplier_payment_terms_days}d <span style={{fontSize:10,color:'#aaa'}}>(AP)</span>
                      </span>
                    : <span>{s.payment_terms_days ?? 30}d</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="status-bar">
        <span>{rows.length} suppliers</span>
      </div>

      {showForm && (
        <SupplierForm
          supplier={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={(s) => setSelectedId(s?.id)}
        />
      )}
    </div>
  )
}
