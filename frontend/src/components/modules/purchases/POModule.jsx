import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { poApi, purchaseApi } from '../../../services/api'
import CustomerTypeahead from '../shared/CustomerTypeahead'
import ProductPickerModal from '../shared/ProductPickerModal'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const STATUS_META = {
  draft:               { label: 'Draft',             bg: '#fff3e0', color: '#e65100' },
  sent:                { label: 'Sent',              bg: '#e3f2fd', color: '#1565c0' },
  partially_received:  { label: 'Part. Received',    bg: '#f3e5f5', color: '#6a1b9a' },
  received:            { label: 'Received',          bg: '#e8f5e9', color: '#2e7d32' },
  cancelled:           { label: 'Cancelled',         bg: '#fafafa', color: '#888'    },
}

const EMPTY_ITEM = { product_id:'', part_no:'', description:'', qty:1, unit:'pcs', unit_price:0, vat_rate:10 }

// ── PO Form Modal ──────────────────────────────────────────
function POFormModal({ po, onClose, onSaved }) {
  const isEdit = !!po?.id
  const qc = useQueryClient()

  const [supplierId,   setSupplierId]   = useState(po?.supplier_id   || '')
  const [supplierName, setSupplierName] = useState(po?.supplier_name || '')
  const [poDate,       setPoDate]       = useState(po?.po_date?.split('T')[0]       || new Date().toISOString().split('T')[0])
  const [expectedDate, setExpectedDate] = useState(po?.expected_date?.split('T')[0] || '')
  const [notes,        setNotes]        = useState(po?.notes         || '')
  const [internalNotes,setInternalNotes]= useState(po?.internal_notes|| '')
  const [items,        setItems]        = useState(po?.items?.length ? po.items : [{ ...EMPTY_ITEM, _id: crypto.randomUUID() }])
  const [showPicker,   setShowPicker]   = useState(false)

  const updateItem = (idx, key, val) =>
    setItems(its => its.map((it, i) => i === idx ? { ...it, [key]: val } : it))
  const removeItem = (idx) => setItems(its => its.filter((_, i) => i !== idx))
  const addItem    = ()    => setItems(its => [...its, { ...EMPTY_ITEM, _id: crypto.randomUUID() }])

  const handleProductSelect = useCallback((product) => {
    setItems(its => [...its, {
      ...EMPTY_ITEM, _id: crypto.randomUUID(),
      product_id:  product.id,
      part_no:     product.sku      || '',
      description: product.name     || '',
      unit:        product.unit     || 'pcs',
      unit_price:  product.cost_price || product.price_1 || 0,
      vat_rate:    product.vat_rate || 10,
    }])
    setShowPicker(false)
  }, [])

  const subtotal   = items.reduce((s, i) => s + Number(i.qty||0) * Number(i.unit_price||0), 0)
  const total_vat  = items.reduce((s, i) => s + Number(i.qty||0) * Number(i.unit_price||0) * Number(i.vat_rate||10) / 100, 0)
  const grand_total = subtotal + total_vat

  const saveMut = useMutation({
    mutationFn: (payload) => isEdit ? poApi.update(po.id, payload) : poApi.create(payload),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Saved')
      qc.invalidateQueries(['purchase-orders'])
      onSaved && onSaved(res.data.data)
      onClose()
    },
  })

  const handleSave = () => {
    if (!supplierId) { toast.error('Select a supplier'); return }
    if (!items.length) { toast.error('Add at least one item'); return }
    saveMut.mutate({ supplier_id: supplierId, po_date: poDate, expected_date: expectedDate || null, notes, internal_notes: internalNotes, items })
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 860 }}>
          <div className="modal-header">
            <h3>{isEdit ? `Edit PO — ${po.po_no}` : 'New Purchase Order'}</h3>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>

          <div className="modal-toolbar">
            <button className="btn primary" onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? '⏳ Saving…' : '💾 Save'}
            </button>
            <div className="toolbar-sep" />
            <button className="btn danger" onClick={onClose}>✕ Cancel</button>
          </div>

          <div className="modal-body">
            <div className="form-section">
              <div className="field-row" style={{ marginBottom: 8 }}>
                <div className="field" style={{ flex: 2 }}>
                  <label>Supplier *</label>
                  <CustomerTypeahead
                    value={supplierId}
                    displayName={supplierName}
                    onChange={c => { setSupplierId(c.id); setSupplierName(c.name) }}
                    onClear={() => { setSupplierId(''); setSupplierName('') }}
                    filterType="supplier"
                    placeholder="Search supplier…"
                    allowCreate={true}
                  />
                </div>
                <div className="field">
                  <label>PO Date</label>
                  <input type="date" value={poDate} onChange={e => setPoDate(e.target.value)} />
                </div>
                <div className="field">
                  <label>Expected Delivery</label>
                  <input type="date" value={expectedDate} onChange={e => setExpectedDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Items */}
            <table className="items-grid">
              <thead>
                <tr>
                  <th style={{ width: 28 }}>#</th>
                  <th style={{ width: 90 }}>Part No.</th>
                  <th>Description</th>
                  <th style={{ width: 60 }}>Qty</th>
                  <th style={{ width: 50 }}>Unit</th>
                  <th style={{ width: 90 }}>Unit Price</th>
                  <th style={{ width: 55 }}>VAT%</th>
                  <th style={{ width: 90 }}>Amount BHD</th>
                  <th style={{ width: 26 }}></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => {
                  const amt = Number(it.qty||0) * Number(it.unit_price||0) * (1 + Number(it.vat_rate||10) / 100)
                  return (
                    <tr key={it._id || it.id || idx}>
                      <td style={{ textAlign:'center', color:'#888' }}>{idx+1}</td>
                      <td><input value={it.part_no||''} onChange={e => updateItem(idx,'part_no',e.target.value)} placeholder="SKU" /></td>
                      <td><input value={it.description||''} onChange={e => updateItem(idx,'description',e.target.value)} placeholder="Description" style={{ width:'100%' }} /></td>
                      <td><input type="number" value={it.qty} min="0" step="1" onChange={e => updateItem(idx,'qty',e.target.value)} style={{ textAlign:'right' }} /></td>
                      <td>
                        <select value={it.unit||'pcs'} onChange={e => updateItem(idx,'unit',e.target.value)} style={{ fontSize:11 }}>
                          {['pcs','mtr','box','reel','kg','set','pack','ltr'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td><input type="number" value={it.unit_price} min="0" step="0.001" onChange={e => updateItem(idx,'unit_price',e.target.value)} style={{ textAlign:'right' }} /></td>
                      <td><input type="number" value={it.vat_rate||10} min="0" max="100" step="1" onChange={e => updateItem(idx,'vat_rate',e.target.value)} style={{ textAlign:'right' }} /></td>
                      <td style={{ textAlign:'right', fontWeight:600, padding:'3px 5px' }}>{amt.toFixed(3)}</td>
                      <td>
                        <button onClick={() => removeItem(idx)} style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:13 }}>✕</button>
                      </td>
                    </tr>
                  )
                })}
                {items.length === 0 && (
                  <tr><td colSpan={9} style={{ textAlign:'center', padding:16, color:'#999', fontStyle:'italic' }}>No items added</td></tr>
                )}
              </tbody>
            </table>

            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button className="add-item-btn" onClick={addItem}>＋ Add Item</button>
              <button className="btn" style={{ fontSize:11 }} onClick={() => setShowPicker(true)}>📦 Pick Product</button>
            </div>

            <div className="field" style={{ marginTop:10 }}>
              <label>Notes to Supplier (printed on PO)</label>
              <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} placeholder="Delivery instructions, terms…" />
            </div>
            <div className="field">
              <label>Internal Notes</label>
              <textarea rows={2} value={internalNotes} onChange={e => setInternalNotes(e.target.value)} />
            </div>
          </div>

          <div className="modal-footer">
            <table className="totals-block">
              <tbody>
                <tr><td style={{ color:'#555' }}>Subtotal:</td><td style={{ textAlign:'right', width:130 }}>BHD {subtotal.toFixed(3)}</td></tr>
                <tr><td style={{ color:'var(--red)' }}>VAT:</td><td style={{ textAlign:'right', color:'var(--red)' }}>BHD {total_vat.toFixed(3)}</td></tr>
                <tr className="grand"><td>GRAND TOTAL:</td><td style={{ textAlign:'right' }}>BHD {grand_total.toFixed(3)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {showPicker && <ProductPickerModal onSelect={handleProductSelect} onClose={() => setShowPicker(false)} />}
    </>
  )
}

// ── To-Invoice Modal ───────────────────────────────────────
function ToInvoiceModal({ po, onClose }) {
  const qc = useQueryClient()
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0])

  const mut = useMutation({
    mutationFn: () => poApi.toInvoice(po.id, { purchase_date: purchaseDate }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['purchase-orders'])
      qc.invalidateQueries(['purchases'])
      onClose()
    },
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-header">
          <h3>Convert to Purchase Invoice</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding:16 }}>
          <p style={{ fontSize:12, color:'#555', marginBottom:12 }}>
            Creating a purchase invoice from <strong>{po.po_no}</strong> ({po.supplier_name}).
            Stock will be updated automatically.
          </p>
          <div className="field">
            <label>Invoice Date</label>
            <input type="date" value={purchaseDate} onChange={e => setPurchaseDate(e.target.value)} />
          </div>
        </div>
        <div style={{ padding:'10px 16px', borderTop:'1px solid #e0e0e0', display:'flex', gap:8 }}>
          <button className="btn primary" onClick={() => mut.mutate()} disabled={mut.isPending}>
            {mut.isPending ? '⏳ Creating…' : '✅ Create Purchase Invoice'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── Main module ────────────────────────────────────────────
export default function POModule() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [q, setQ]                   = useState('')
  const [showForm,    setShowForm]   = useState(false)
  const [editPO,      setEditPO]     = useState(null)
  const [showConvert, setShowConvert]= useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['purchase-orders', q],
    queryFn:  () => poApi.list({ q }).then(r => r.data.data),
  })
  const rows = data || []
  const sel  = rows.find(r => r.id === selectedId)

  // Load detail when editing
  const { data: detail } = useQuery({
    queryKey: ['po-detail', editPO?.id],
    queryFn:  () => poApi.get(editPO.id).then(r => r.data.data),
    enabled:  !!editPO?.id,
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => poApi.setStatus(id, status),
    onSuccess: (res) => { toast.success(res.data.message); qc.invalidateQueries(['purchase-orders']) },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => poApi.delete(id),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['purchase-orders'])
      setSelectedId(null)
    },
  })

  const handleEdit = () => {
    if (!sel) return
    setEditPO({ id: sel.id })
  }

  const totalValue = rows.reduce((s, r) => s + parseFloat(r.grand_total || 0), 0)
  const selIsConverted = !!sel?.converted_to_purchase_id

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Purchase Orders</div>

      <div className="toolbar">
        <button className="btn primary" onClick={() => { setEditPO(null); setShowForm(true) }}>＋ New PO</button>
        <button className="btn" disabled={!sel || !['draft','sent'].includes(sel?.status)} onClick={handleEdit}>✏️ Edit</button>
        <div className="toolbar-sep"/>

        <button className="btn"
          style={{ background:'#1565c0', color:'#fff', borderColor:'#0d47a1' }}
          disabled={!sel || sel?.status !== 'draft'}
          title="Mark as sent to supplier"
          onClick={() => statusMut.mutate({ id: selectedId, status: 'sent' })}>
          📤 Mark Sent
        </button>
        <button className="btn"
          style={{ background:'#6a1b9a', color:'#fff', borderColor:'#4a148c' }}
          disabled={!sel || !['sent','partially_received'].includes(sel?.status)}
          title="Mark as partially received"
          onClick={() => statusMut.mutate({ id: selectedId, status: 'partially_received' })}>
          📦 Part. Received
        </button>
        <button className="btn"
          style={{ background:'#2e7d32', color:'#fff', borderColor:'#1b5e20' }}
          disabled={!sel || !['sent','partially_received'].includes(sel?.status)}
          title="Mark as fully received"
          onClick={() => statusMut.mutate({ id: selectedId, status: 'received' })}>
          ✅ Mark Received
        </button>

        <div className="toolbar-sep"/>
        <button className="btn teal"
          disabled={!sel || selIsConverted || sel?.status === 'cancelled' || sel?.status === 'draft'}
          title={selIsConverted ? 'Already converted to purchase invoice' : 'Convert to Purchase Invoice'}
          onClick={() => setShowConvert(true)}>
          🧾 → Purchase Invoice
        </button>
        <div className="toolbar-sep"/>
        <button className="btn danger"
          disabled={!sel || sel?.status !== 'draft'}
          onClick={() => { if (window.confirm(`Delete ${sel?.po_no}?`)) deleteMut.mutate(selectedId) }}>
          🗑 Delete
        </button>
        <div className="toolbar-sep"/>
        <div className="toolbar-search">
          <input type="text" placeholder="Search POs…" value={q} onChange={e => setQ(e.target.value)} />
        </div>
      </div>

      {sel && (
        <div style={{ background:'var(--blue-light)', borderBottom:'1px solid #b0c8f0', padding:'5px 12px', fontSize:12, color:'#1a3a6c', flexShrink:0, display:'flex', alignItems:'center', gap:16 }}>
          Selected: <strong>{sel.po_no}</strong> — {sel.supplier_name} — BHD {fmtBhd(sel.grand_total)}
          {selIsConverted && <span style={{ color:'#2e7d32', fontWeight:700 }}>✓ Converted to purchase invoice</span>}
        </div>
      )}

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th style={{ width:28 }}><input type="checkbox" /></th>
            <th>PO No.</th>
            <th>Date</th>
            <th>Expected</th>
            <th>Supplier</th>
            <th className="right">Subtotal BHD</th>
            <th className="right">VAT BHD</th>
            <th className="right">Total BHD</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={9}>Loading…</td></tr>}
            {!isLoading && !rows.length && <tr className="empty-row"><td colSpan={9}>No purchase orders — click New PO to create one</td></tr>}
            {rows.map(r => {
              const meta = STATUS_META[r.status] || STATUS_META.draft
              return (
                <tr key={r.id}
                  className={selectedId === r.id ? 'selected' : ''}
                  onClick={() => setSelectedId(r.id)}
                  onDoubleClick={() => { setSelectedId(r.id); if (['draft','sent'].includes(r.status)) { setEditPO({ id: r.id }); setShowForm(true) } }}>
                  <td><input type="checkbox" checked={selectedId === r.id} onChange={() => setSelectedId(r.id)} /></td>
                  <td style={{ color:'var(--blue)', fontWeight:600 }}>
                    {r.po_no}
                    {r.converted_to_purchase_id && <span style={{ marginLeft:5, fontSize:9, color:'#888' }}>✓</span>}
                  </td>
                  <td>{fmtDate(r.po_date)}</td>
                  <td>{fmtDate(r.expected_date) || '—'}</td>
                  <td>{r.supplier_name}</td>
                  <td className="right">{fmtBhd(r.subtotal)}</td>
                  <td className="right">{fmtBhd(r.total_vat)}</td>
                  <td className="right" style={{ fontWeight:600 }}>{fmtBhd(r.grand_total)}</td>
                  <td>
                    <span style={{ fontSize:11, padding:'1px 8px', borderRadius:10, background:meta.bg, color:meta.color, fontWeight:600, border:`1px solid ${meta.color}22` }}>
                      {meta.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="status-bar">
        <span>{rows.length} purchase orders</span><span>|</span>
        <span>{rows.filter(r => r.status === 'draft').length} drafts</span><span>|</span>
        <span>{rows.filter(r => r.status === 'sent').length} sent</span><span>|</span>
        <span>Total value: <strong>BHD {fmtBhd(totalValue)}</strong></span>
      </div>

      {showForm && (
        <POFormModal
          po={editPO?.id && detail ? detail : (editPO?.id ? null : undefined)}
          onClose={() => { setShowForm(false); setEditPO(null) }}
          onSaved={(po) => setSelectedId(po.id)}
        />
      )}
      {showConvert && sel && (
        <ToInvoiceModal po={sel} onClose={() => setShowConvert(false)} />
      )}
    </div>
  )
}
