import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { invoiceApi } from '../../../services/api'
import { useUIStore, useInvoiceFormStore, useAuthStore } from '../../../store'
import { fmtDate } from '../../../utils/format'
import CustomerTypeahead   from '../shared/CustomerTypeahead'
import ProductPickerModal  from '../shared/ProductPickerModal'
import DocTrail            from '../shared/DocTrail'
import toast from 'react-hot-toast'

const TYPE_LABELS = {
  tax_invoice:  'Tax Invoice',
  quotation:    'Quotation',
  proforma:     'Proforma Invoice',
  credit_note:  'Credit Note',
  receipt:      'Receipt',
}

// ── Payments sub-tab ──────────────────────────────────────────
function PaymentsTab({ invoiceId, grandTotal }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [pf, setPf] = useState({ payment_date: new Date().toISOString().split('T')[0], amount: '', method: 'bank_transfer', reference: '', notes: '' })
  const PF = (k, v) => setPf(f => ({ ...f, [k]: v }))

  const { data: payments, isLoading } = useQuery({
    queryKey: ['invoice-payments', invoiceId],
    queryFn:  () => invoiceApi.getPayments(invoiceId).then(r => r.data.data),
    enabled:  !!invoiceId,
  })

  const totalPaid = (payments || []).reduce((s, p) => s + parseFloat(p.amount || 0), 0)
  const balance   = grandTotal - totalPaid

  const addMut = useMutation({
    mutationFn: () => invoiceApi.addPayment(invoiceId, pf),
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries(['invoice-payments', invoiceId])
      qc.invalidateQueries(['invoices'])
      setShowForm(false)
      setPf({ payment_date: new Date().toISOString().split('T')[0], amount: '', method: 'bank_transfer', reference: '', notes: '' })
    },
  })

  if (!invoiceId) return (
    <div style={{ padding:16, color:'#888', fontSize:12 }}>
      Save the invoice first to record payments.
    </div>
  )

  return (
    <div style={{ padding:12 }}>
      {/* Summary bar */}
      <div style={{ display:'flex', gap:16, marginBottom:10, fontSize:12 }}>
        <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:4, padding:'6px 12px' }}>
          Grand Total: <strong>BHD {grandTotal.toFixed(3)}</strong>
        </div>
        <div style={{ background:'#e3f2fd', border:'1px solid #90caf9', borderRadius:4, padding:'6px 12px' }}>
          Paid: <strong style={{ color:'#1565c0' }}>BHD {totalPaid.toFixed(3)}</strong>
        </div>
        <div style={{ background: balance <= 0.001 ? '#e8f5e9' : '#fff8e1', border:`1px solid ${balance <= 0.001 ? '#a5d6a7' : '#ffe082'}`, borderRadius:4, padding:'6px 12px' }}>
          Balance: <strong style={{ color: balance <= 0.001 ? '#2e7d32' : '#e65100' }}>BHD {balance.toFixed(3)}</strong>
        </div>
      </div>

      <table className="data-table" style={{ fontSize:12, marginBottom:8 }}>
        <thead><tr>
          <th>Date</th><th>Method</th><th className="right">Amount BHD</th><th>Reference</th><th>Notes</th>
        </tr></thead>
        <tbody>
          {isLoading && <tr className="empty-row"><td colSpan={5}>Loading…</td></tr>}
          {!isLoading && !(payments||[]).length && <tr className="empty-row"><td colSpan={5}>No payments recorded yet</td></tr>}
          {(payments||[]).map(p => (
            <tr key={p.id}>
              <td>{fmtDate(p.payment_date)}</td>
              <td style={{ textTransform:'capitalize' }}>{(p.method||'').replace(/_/g,' ')}</td>
              <td className="right" style={{ fontWeight:600 }}>BHD {parseFloat(p.amount).toFixed(3)}</td>
              <td>{p.reference_no || p.reference || '—'}</td>
              <td style={{ color:'#888', fontSize:11 }}>{p.notes || ''}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {!showForm && balance > 0.001 && (
        <button className="btn primary" onClick={() => { setPf(f => ({ ...f, amount: balance.toFixed(3) })); setShowForm(true) }}>
          ＋ Record Payment
        </button>
      )}
      {!showForm && balance <= 0.001 && (payments||[]).length > 0 && (
        <div style={{ fontSize:12, color:'#2e7d32', fontWeight:600 }}>✓ Fully paid</div>
      )}

      {showForm && (
        <div style={{ background:'#f8f9fa', border:'1px solid #e0e0e0', borderRadius:4, padding:12, marginTop:8 }}>
          <div style={{ fontWeight:700, fontSize:12, marginBottom:8 }}>Record Payment</div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:8 }}>
            <div className="field"><label>Date</label><input type="date" value={pf.payment_date} onChange={e=>PF('payment_date',e.target.value)}/></div>
            <div className="field"><label>Amount BHD</label><input type="number" step="0.001" value={pf.amount} onChange={e=>PF('amount',e.target.value)}/></div>
            <div className="field"><label>Method</label>
              <select value={pf.method} onChange={e=>PF('method',e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field"><label>Reference</label><input value={pf.reference} onChange={e=>PF('reference',e.target.value)} placeholder="Chq/Txn no."/></div>
          </div>
          <div className="field" style={{ marginBottom:8 }}>
            <label>Notes</label>
            <input value={pf.notes} onChange={e=>PF('notes',e.target.value)} placeholder="Optional notes"/>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            <button className="btn primary" onClick={() => addMut.mutate()} disabled={addMut.isPending || !pf.amount}>
              {addMut.isPending ? '⏳ Saving…' : '💾 Save Payment'}
            </button>
            <button className="btn" onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Write-Off Modal ───────────────────────────────────────────
const WO_REASONS = [
  'Customer unresponsive / untraceable',
  'Customer business closed',
  'Customer declared bankruptcy / insolvent',
  'Debt too small to pursue legally',
  'Dispute settled at reduced amount',
  'Bad debt — legally time-barred',
  'Other',
]

function WriteOffModal({ invoice, onClose, onDone }) {
  const qc = useQueryClient()
  const balance = parseFloat(invoice.balance_due || invoice.grand_total || 0)
  const [reason,  setReason]  = useState(WO_REASONS[0])
  const [notes,   setNotes]   = useState('')
  const [amount,  setAmount]  = useState(balance.toFixed(3))

  const writeOffMut = useMutation({
    mutationFn: () => invoiceApi.writeOff(invoice.id, { reason, notes, amount }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['invoice', invoice.id])
      qc.invalidateQueries(['invoice-payments', invoice.id])
      qc.invalidateQueries(['fin-summary'])
      qc.invalidateQueries(['overdue-rpt'])
      onDone()
    },
  })

  return (
    <div className="modal-overlay" style={{ zIndex:1100 }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>Write Off — {invoice.invoice_no}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn" style={{ background:'#c62828', color:'#fff', borderColor:'#b71c1c' }}
            onClick={() => writeOffMut.mutate()} disabled={writeOffMut.isPending || !reason}>
            {writeOffMut.isPending ? '⏳ Processing…' : '✓ Confirm Write-Off'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-body" style={{ padding:14 }}>
          <div style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:4, padding:'8px 12px', marginBottom:12, fontSize:12 }}>
            <strong>Invoice:</strong> {invoice.invoice_no} &nbsp;|&nbsp;
            <strong>Customer:</strong> {invoice.customer_name} &nbsp;|&nbsp;
            <strong>Balance:</strong> <span style={{ color:'#c62828', fontWeight:700 }}>BHD {balance.toFixed(3)}</span>
          </div>

          <div className="field" style={{ marginBottom:10 }}>
            <label style={{ fontWeight:600 }}>Write-Off Amount BHD *</label>
            <input type="number" step="0.001" min="0.001" max={balance.toFixed(3)}
              value={amount} onChange={e => setAmount(e.target.value)}
              style={{ fontWeight:700, fontSize:14 }}/>
            {parseFloat(amount) < balance - 0.001 && (
              <div style={{ fontSize:11, color:'#e65100', marginTop:3 }}>
                Partial write-off — remaining BHD {(balance - parseFloat(amount||0)).toFixed(3)} stays outstanding
              </div>
            )}
          </div>

          <div className="field" style={{ marginBottom:10 }}>
            <label style={{ fontWeight:600 }}>Reason *</label>
            <select value={reason} onChange={e => setReason(e.target.value)}>
              {WO_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>

          <div className="field">
            <label>Additional Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Optional — e.g. collection attempts made, legal advice received…"/>
          </div>

          <div style={{ background:'#fdecea', border:'1px solid #ef9a9a', borderRadius:4, padding:'8px 12px', marginTop:12, fontSize:11, color:'#b71c1c' }}>
            ⚠ This action will mark the invoice as paid (bad debt) and remove it from AR.
            The write-off will be recorded with your name, timestamp, and reason for audit purposes.
            Admin can reverse this if needed.
          </div>
        </div>
      </div>
    </div>
  )
}

export default function InvoiceModal() {
  const { closeModal, getModal, openModal } = useUIStore()
  const modal = getModal('invoice')
  const qc    = useQueryClient()
  const user  = useAuthStore(s => s.user)
  const isAdmin = user?.role === 'admin'

  const { form, setForm, setCustomer, addItem, updateItem, removeItem, reset, totals } = useInvoiceFormStore()
  const [activeTab,     setActiveTab]     = useState('items')
  const [showProdPicker,setShowProdPicker] = useState(false)
  const [showWriteOff,  setShowWriteOff]  = useState(false)

  const reverseWriteOffMut = useMutation({
    mutationFn: () => invoiceApi.reverseWriteOff(modal.data.id),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['invoice', modal.data.id])
      qc.invalidateQueries(['invoice-payments', modal.data.id])
      qc.invalidateQueries(['fin-summary'])
      qc.invalidateQueries(['overdue-rpt'])
    },
  })

  // Load existing invoice if editing
  const { data: existing } = useQuery({
    queryKey: ['invoice', modal.data?.id],
    queryFn:  () => invoiceApi.get(modal.data.id).then(r => r.data.data),
    enabled:  !!modal.data?.id,
  })

  useEffect(() => {
    if (existing) {
      setForm({
        ...existing,
        invoice_date: existing.invoice_date?.split('T')[0] || '',
        due_date:     existing.due_date?.split('T')[0] || existing.invoice_date?.split('T')[0] || '',
        valid_until:  existing.valid_until?.split('T')[0] || '',
        items: existing.items.map(i => ({ ...i, _id: i.id })),
      })
    } else if (!modal.data?.id) {
      reset()
      const t = modal.data?.type
      if (t) {
        const defaults = { type: t }
        if (['quotation','proforma'].includes(t)) {
          const d = new Date(); d.setDate(d.getDate() + 7)
          defaults.valid_until = d.toISOString().split('T')[0]
        }
        setForm(defaults)
      }
    }
  }, [existing, modal.data?.id, modal.data?.type])

  const saveMut = useMutation({
    mutationFn: (payload) => modal.data?.id
      ? invoiceApi.update(modal.data.id, payload)
      : invoiceApi.create(payload),
    onSuccess: (res) => {
      toast.success(`Invoice ${res.data.data.invoice_no} ${modal.data?.id ? 'updated' : 'created'}`)
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['quotations'])
      closeModal('invoice')
    },
  })

  const issueMut = useMutation({
    mutationFn: () => invoiceApi.issue(modal.data.id),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['quotations'])
      closeModal('invoice')
    },
  })

  const handleSave = () => {
    if (!form.customer_id) { toast.error('Select a customer'); return }
    if (!form.items.length) { toast.error('Add at least one item'); return }
    const { subtotal, totalDisc, totalVat, grandTotal } = totals()
    const invDisc = Number(form.invoice_discount || 0)
    saveMut.mutate({
      ...form,
      subtotal:          subtotal.toFixed(3),
      total_discount:    (totalDisc + invDisc).toFixed(3),
      total_vat:         totalVat.toFixed(3),
      shipping:          Number(form.shipping || 0).toFixed(3),
      grand_total:       (grandTotal - invDisc).toFixed(3),
    })
  }

  const { subtotal, totalDisc, totalVat, grandTotal } = totals()
  const invDisc  = Number(form.invoice_discount || 0)
  const finalGrand = grandTotal - invDisc
  // For new docs use modal.data.type (set by the button) so the label is correct on first render
  const effectiveType = modal.data?.id ? form.type : (modal.data?.type || form.type)
  const isQuoteType   = ['quotation','proforma'].includes(effectiveType)
  const typeLabel = TYPE_LABELS[effectiveType] || 'Invoice'
  const refLabel  = typeLabel + ' No.'

  const handleProductSelect = (product) => {
    addItem()
    const idx = useInvoiceFormStore.getState().form.items.length - 1
    // populate the new item with product details
    setTimeout(() => {
      useInvoiceFormStore.getState().updateItem(idx, 'product_id',  product.id)
      useInvoiceFormStore.getState().updateItem(idx, 'part_no',     product.sku)
      useInvoiceFormStore.getState().updateItem(idx, 'description', product.name)
      useInvoiceFormStore.getState().updateItem(idx, 'unit',        product.unit)
      useInvoiceFormStore.getState().updateItem(idx, 'unit_price',  product.price_1)
      useInvoiceFormStore.getState().updateItem(idx, 'vat_rate',    product.vat_rate)
    }, 0)
    setShowProdPicker(false)
  }

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal('invoice')}>
        <div className="modal">
          {/* Header */}
          <div className="modal-header">
            <h3>
              {modal.data?.id ? `Edit ${typeLabel} — ${existing?.invoice_no || ''}` : `New ${typeLabel}`}
              {existing?.payment_status === 'draft' && (
                <span style={{ marginLeft:10, fontSize:11, fontWeight:700, padding:'2px 8px', background:'#fff3e0', color:'#e65100', border:'1px solid #ffcc80', borderRadius:10, verticalAlign:'middle' }}>
                  DRAFT
                </span>
              )}
              {existing?.write_off_date && (
                <span style={{ marginLeft:10, fontSize:11, fontWeight:700, padding:'2px 8px', background:'#fdecea', color:'#b71c1c', border:'1px solid #ef9a9a', borderRadius:10, verticalAlign:'middle' }}>
                  WRITTEN OFF
                </span>
              )}
            </h3>
            <button className="close-btn" onClick={() => closeModal('invoice')}>✕</button>
          </div>

          {/* Document trail — only shown when editing an existing document */}
          {modal.data?.id && <DocTrail docId={modal.data.id} />}

          {/* Modal toolbar */}
          <div className="modal-toolbar">
            <button className="btn primary" onClick={handleSave} disabled={saveMut.isPending}>
              {saveMut.isPending ? '⏳ Saving...' : '💾 Save'}
            </button>
            {modal.data?.id && existing?.payment_status === 'draft' && ['quotation','proforma'].includes(existing?.type) && (
              <button className="btn" style={{ background:'#e65100', color:'#fff', borderColor:'#bf360c' }}
                onClick={() => { if (window.confirm(`Issue ${existing.invoice_no} to customer? It will become active and can no longer be edited as a draft.`)) issueMut.mutate() }}
                disabled={issueMut.isPending}>
                {issueMut.isPending ? '⏳ Issuing…' : '⚡ Issue'}
              </button>
            )}
            {modal.data?.id && <>
              <button className="btn" onClick={() => window.open(invoiceApi.getPdfUrl(modal.data.id), '_blank')}>📄 PDF</button>
              <button className="btn" onClick={() => openModal('payment', { invoiceId: modal.data.id })}>💳 Payment</button>
              {/* Write-off controls — admin only, tax invoices only */}
              {isAdmin && existing?.type === 'tax_invoice' && !existing?.write_off_date &&
               ['unpaid','partial','overdue'].includes(existing?.payment_status) && (
                <button className="btn"
                  style={{ background:'#7b1fa2', color:'#fff', borderColor:'#6a1b9a' }}
                  onClick={() => setShowWriteOff(true)}>
                  ✗ Write Off
                </button>
              )}
              {isAdmin && existing?.write_off_date && (
                <button className="btn warn"
                  onClick={() => { if (window.confirm(`Reverse the write-off on ${existing.invoice_no}? The balance will be reinstated to AR.`)) reverseWriteOffMut.mutate() }}
                  disabled={reverseWriteOffMut.isPending}>
                  {reverseWriteOffMut.isPending ? '⏳…' : '↩ Reverse Write-Off'}
                </button>
              )}
            </>}
            <div className="toolbar-sep" />
            <button className="btn danger" onClick={() => closeModal('invoice')}>✕ Cancel</button>
          </div>

          {/* Write-off info banner */}
          {existing?.write_off_date && (
            <div style={{ background:'#fdecea', borderBottom:'1px solid #ef9a9a', padding:'7px 14px', fontSize:12, color:'#b71c1c', display:'flex', gap:16, flexWrap:'wrap' }}>
              <strong>Written Off</strong>
              <span>Amount: BHD {parseFloat(existing.write_off_amount||0).toFixed(3)}</span>
              <span>Date: {existing.write_off_date ? new Date(existing.write_off_date).toLocaleDateString() : '—'}</span>
              <span>Reason: {existing.write_off_reason}</span>
            </div>
          )}

          {/* Body */}
          <div className="modal-body">
            {/* Header fields */}
            <div className="form-section">
              <div className="field-row" style={{ marginBottom: 8 }}>
                <div className="field">
                  <label>{refLabel}</label>
                  <input value={form.invoice_no || 'Auto-generated'} readOnly style={{ background:'#f5f5f5' }} />
                </div>
                <div className="field">
                  <label>Type</label>
                  <select value={form.type} onChange={e => setForm({ type: e.target.value })}>
                    <option value="tax_invoice">Tax Invoice</option>
                    <option value="quotation">Quotation</option>
                    <option value="proforma">Proforma Invoice</option>
                    <option value="credit_note">Credit Note</option>
                    <option value="receipt">Receipt</option>
                  </select>
                </div>
                <div className="field">
                  <label>Date</label>
                  <input type="date" value={form.invoice_date} onChange={e => setForm({ invoice_date: e.target.value })} />
                </div>
                {!isQuoteType && (
                  <div className="field">
                    <label>Due Date</label>
                    <input type="date" value={form.due_date || ''} onChange={e => setForm({ due_date: e.target.value })} />
                  </div>
                )}
                {isQuoteType && (
                  <div className="field">
                    <label>Valid Until</label>
                    <input type="date" value={form.valid_until || ''} onChange={e => setForm({ valid_until: e.target.value })} />
                  </div>
                )}
              </div>

              <div className="field-row">
                <div className="field" style={{ flex: 2 }}>
                  <label>Customer</label>
                  <CustomerTypeahead
                    value={form.customer_id}
                    displayName={form.customer_name}
                    onChange={c => setCustomer(c)}
                    onClear={() => setForm({ customer_id:'', customer_name:'', customer_vat:'', customer_cr:'' })}
                    placeholder="Search customer by name, CR, VAT..."
                    allowCreate={true}
                  />
                  {form.customer_name && (
                    <div style={{ fontSize:11, color:'var(--gray-dark)', marginTop:2 }}>
                      VAT: {form.customer_vat || '—'} &nbsp;|&nbsp; CR: {form.customer_cr || '—'}
                    </div>
                  )}
                </div>
                {!isQuoteType && (
                  <div className="field">
                    <label>Client PO No.</label>
                    <input value={form.po_reference || ''} onChange={e => setForm({ po_reference: e.target.value })}
                      placeholder="Client purchase order ref" />
                  </div>
                )}
                <div className="field">
                  <label>Linked DNs</label>
                  <div style={{ display:'flex', gap:4 }}>
                    <input value={(form.linked_dn_ids || []).join(', ')} readOnly
                      style={{ flex:1, background:'#f5f5f5' }} placeholder="None" />
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="tab-bar">
              {['items','payments','message'].map(t => (
                <div key={t} className={`tab ${activeTab === t ? 'active' : ''}`}
                  onClick={() => setActiveTab(t)}>
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </div>
              ))}
            </div>

            {/* Items tab */}
            {activeTab === 'items' && (
              <div style={{ padding:'8px 12px' }}>
                <table className="items-grid">
                  <thead>
                    <tr>
                      <th style={{ width:28 }}>#</th>
                      <th style={{ width:90 }}>Part No.</th>
                      <th>Description</th>
                      <th style={{ width:55 }}>Qty</th>
                      <th style={{ width:50 }}>Unit</th>
                      <th style={{ width:80 }}>Unit Price</th>
                      <th style={{ width:70 }}>Discount</th>
                      <th style={{ width:55 }}>VAT%</th>
                      <th style={{ width:90 }}>Amount BHD</th>
                      <th style={{ width:26 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.items.map((item, idx) => {
                      const net = (Number(item.qty) * Number(item.unit_price)) - Number(item.discount || 0)
                      const amt = net + net * Number(item.vat_rate) / 100
                      return (
                        <tr key={item._id || idx}>
                          <td style={{ textAlign:'center', color:'#888' }}>{idx + 1}</td>
                          <td><input value={item.part_no || ''} onChange={e => updateItem(idx,'part_no',e.target.value)} placeholder="SKU" /></td>
                          <td><input value={item.description || ''} onChange={e => updateItem(idx,'description',e.target.value)} placeholder="Product description" style={{ width:'100%' }} /></td>
                          <td><input type="number" value={item.qty} min="0" step="1" onChange={e => updateItem(idx,'qty',e.target.value)} style={{ textAlign:'right' }} /></td>
                          <td>
                            <select value={item.unit || 'pcs'} onChange={e => updateItem(idx,'unit',e.target.value)} style={{ fontSize:11 }}>
                              {['pcs','mtr','box','reel','kg','set','pack','ltr'].map(u => <option key={u}>{u}</option>)}
                            </select>
                          </td>
                          <td><input type="number" value={item.unit_price} min="0" step="0.001" onChange={e => updateItem(idx,'unit_price',e.target.value)} style={{ textAlign:'right' }} /></td>
                          <td><input type="number" value={item.discount || 0} min="0" step="0.001" onChange={e => updateItem(idx,'discount',e.target.value)} style={{ textAlign:'right' }} /></td>
                          <td><input type="number" value={item.vat_rate || 10} min="0" max="100" step="1" onChange={e => updateItem(idx,'vat_rate',e.target.value)} style={{ textAlign:'right' }} /></td>
                          <td style={{ textAlign:'right', fontWeight:600, padding:'3px 5px' }}>{amt.toFixed(3)}</td>
                          <td>
                            <button onClick={() => removeItem(idx)}
                              style={{ background:'none', border:'none', color:'var(--red)', cursor:'pointer', fontSize:13 }}>✕</button>
                          </td>
                        </tr>
                      )
                    })}
                    {form.items.length === 0 && (
                      <tr><td colSpan={10} style={{ textAlign:'center', padding:16, color:'#999', fontStyle:'italic' }}>No items added</td></tr>
                    )}
                  </tbody>
                </table>

                <div style={{ display:'flex', gap:8, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                  <button className="add-item-btn" onClick={() => setShowProdPicker(true)}>＋ Add Item</button>
                  <div style={{ display:'flex', alignItems:'center', gap:6, marginLeft:8, fontSize:12 }}>
                    <label style={{ color:'var(--green)', fontWeight:600, whiteSpace:'nowrap' }}>🏷 {isQuoteType ? 'Overall Discount' : 'Invoice Discount'} (BHD):</label>
                    <input type="number" min="0" step="0.001"
                      value={form.invoice_discount || ''}
                      onChange={e => setForm({ invoice_discount: e.target.value })}
                      placeholder="0.000"
                      style={{ width:90, textAlign:'right', border:'1px solid #ccc', borderRadius:3, padding:'2px 6px', fontSize:12 }} />
                  </div>
                  <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                    <label style={{ color:'#555', fontWeight:600, whiteSpace:'nowrap' }}>🚚 Shipping (BHD):</label>
                    <input type="number" min="0" step="0.001"
                      value={form.shipping || ''}
                      onChange={e => setForm({ shipping: e.target.value })}
                      placeholder="0.000"
                      style={{ width:90, textAlign:'right', border:'1px solid #ccc', borderRadius:3, padding:'2px 6px', fontSize:12 }} />
                  </div>
                </div>
              </div>
            )}

            {/* Payments tab */}
            {activeTab === 'payments' && (
              <PaymentsTab invoiceId={modal.data?.id} grandTotal={finalGrand} />
            )}

            {/* Message tab */}
            {activeTab === 'message' && (
              <div style={{ padding:12 }}>
                <div className="field" style={{ marginBottom:10 }}>
                  <label>Notes / Message to Customer (printed on invoice)</label>
                  <textarea rows={4} value={form.notes || ''} onChange={e => setForm({ notes: e.target.value })}
                    placeholder="e.g. Payment due within 30 days. Thank you for your business." />
                </div>
                <div className="field">
                  <label>Internal Notes (not printed)</label>
                  <textarea rows={2} value={form.internal_notes || ''} onChange={e => setForm({ internal_notes: e.target.value })} />
                </div>
              </div>
            )}
          </div>

          {/* Totals footer */}
          <div className="modal-footer">
            <table className="totals-block">
              <tbody>
                <tr><td style={{ color:'#555' }}>Subtotal:</td><td style={{ textAlign:'right', width:130 }}>BHD {subtotal.toFixed(3)}</td></tr>
                {totalDisc > 0 && <tr><td style={{ color:'var(--green)' }}>Line Discounts:</td><td style={{ textAlign:'right', color:'var(--green)' }}>— {totalDisc.toFixed(3)}</td></tr>}
                {invDisc > 0 && <tr><td style={{ color:'var(--green)' }}>{isQuoteType ? 'Overall Discount:' : 'Invoice Discount:'}</td><td style={{ textAlign:'right', color:'var(--green)' }}>— {invDisc.toFixed(3)}</td></tr>}
                <tr><td style={{ color:'var(--red)' }}>VAT (10%):</td><td style={{ textAlign:'right', color:'var(--red)' }}>BHD {totalVat.toFixed(3)}</td></tr>
                {Number(form.shipping||0) > 0 && <tr><td style={{ color:'#555' }}>Shipping:</td><td style={{ textAlign:'right' }}>BHD {Number(form.shipping||0).toFixed(3)}</td></tr>}
                <tr className="grand">
                  <td>GRAND TOTAL:</td>
                  <td style={{ textAlign:'right' }}>BHD {finalGrand.toFixed(3)}</td>
                </tr>
                <tr>
                  <td style={{ fontSize:11, color:'#555' }}>Balance Due:</td>
                  <td style={{ textAlign:'right' }}>
                    <span className={`balance-badge ${finalGrand > 0 ? 'balance-unpaid' : 'balance-paid'}`}>
                      BHD {finalGrand.toFixed(3)}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showProdPicker && <ProductPickerModal onSelect={handleProductSelect} onClose={() => setShowProdPicker(false)} />}
      {showWriteOff && existing && (
        <WriteOffModal
          invoice={existing}
          onClose={() => setShowWriteOff(false)}
          onDone={() => setShowWriteOff(false)}
        />
      )}
    </>
  )
}
