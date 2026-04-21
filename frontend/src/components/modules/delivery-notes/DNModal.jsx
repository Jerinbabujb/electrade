import { useState, useEffect } from 'react'
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query'
import { dnApi, invoiceApi, convertApi } from '../../../services/api'
import { useUIStore } from '../../../store'
import { fmtBhd, fmtDate } from '../../../utils/format'
import CustomerTypeahead   from '../shared/CustomerTypeahead'
import ProductPickerModal  from '../shared/ProductPickerModal'
import DocTrail            from '../shared/DocTrail'
import toast from 'react-hot-toast'

const STATUS_COLOR = {
  pending_invoice: { bg:'#fff8e1', color:'#e65100', border:'#ffcc80' },
  invoiced:        { bg:'#e8f5e9', color:'#2e7d32', border:'#a5d6a7' },
  cancelled:       { bg:'#fce4ec', color:'#c62828', border:'#f48fb1' },
}

const emptyForm = () => ({
  customer_id: '', customer_name: '', customer_vat: '',
  dn_date: new Date().toISOString().split('T')[0],
  delivery_address: '', project_ref: '', po_reference: '',
  delivered_by: '', notes: '', items: [],
})

export default function DNModal() {
  const { closeModal, getModal } = useUIStore()
  const qc = useQueryClient()
  const modal = getModal('dn')

  const existingDnId  = modal.data?.id               // view mode
  const fromInvoiceId = modal.data?.from_invoice_id   // convert mode

  const isView    = !!existingDnId && !fromInvoiceId
  const isConvert = !!fromInvoiceId

  // ── All hooks must be called unconditionally (Rules of Hooks) ──

  const [form, setForm]       = useState(emptyForm)
  const [showProd, setShowProd]   = useState(false)
  const [shortfalls, setShortfalls] = useState(null)  // stock shortfall confirmation state
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Load existing DN for view mode
  const { data: existingDn, isLoading: loadingDn } = useQuery({
    queryKey: ['dn', existingDnId],
    queryFn:  () => dnApi.get(existingDnId).then(r => r.data.data),
    enabled:  isView,
  })

  // Load source quotation/proforma for convert mode
  const { data: sourceDoc, isLoading: loadingSrc } = useQuery({
    queryKey: ['invoice', fromInvoiceId],
    queryFn:  () => invoiceApi.get(fromInvoiceId).then(r => r.data.data),
    enabled:  isConvert,
  })

  // Pre-populate form from source document when converting
  useEffect(() => {
    if (!sourceDoc || !isConvert) return
    setForm({
      ...emptyForm(),
      customer_id:   sourceDoc.customer_id,
      customer_name: sourceDoc.customer_name,
      customer_vat:  sourceDoc.customer_vat || '',
      po_reference:  sourceDoc.po_reference || sourceDoc.invoice_no,
      notes:         sourceDoc.notes || '',
      items: (sourceDoc.items || []).map(it => ({
        _id:           it.id || String(Date.now() + Math.random()),
        product_id:    it.product_id || '',
        part_no:       it.part_no || '',
        description:   it.description || '',
        qty_ordered:   parseFloat(it.qty) || 0,
        qty_delivered: parseFloat(it.qty) || 0,
        unit:          it.unit || 'pcs',
        unit_price:    parseFloat(it.unit_price) || 0,
      })),
    })
  }, [sourceDoc])

  const doSave = (forceOverstock = false) => {
    if (isConvert) {
      return convertApi.convert({
        from_id:   fromInvoiceId,
        from_type: 'invoice',
        to_type:   'delivery_note',
        overrides: {
          dn_date:          form.dn_date,
          project_ref:      form.project_ref,
          po_reference:     form.po_reference,
          delivery_address: form.delivery_address,
          delivered_by:     form.delivered_by,
          notes:            form.notes,
          force_overstock:  forceOverstock,
          items: form.items.map(it => ({
            product_id:    it.product_id || null,
            part_no:       it.part_no,
            description:   it.description,
            qty_ordered:   parseFloat(it.qty_ordered),
            qty_delivered: parseFloat(it.qty_delivered),
            unit:          it.unit,
            unit_price:    parseFloat(it.unit_price),
          })),
        },
      })
    }
    return dnApi.create({ ...form, force_overstock: forceOverstock })
  }

  const saveMut = useMutation({
    mutationFn: () => doSave(false),
    onSuccess: (res) => {
      const dn = res.data.data
      toast.success(res.data.message || `${dn.dn_no} created — stock deducted`)
      qc.invalidateQueries(['dns'])
      qc.invalidateQueries(['products'])
      if (isConvert) qc.invalidateQueries(['quotations'])
      closeModal('dn')
    },
    onError: (err) => {
      if (err.response?.data?.code === 'STOCK_SHORTFALL') {
        setShortfalls(err.response.data.shortfalls)  // show confirmation dialog
      }
    },
  })

  const confirmOverstockMut = useMutation({
    mutationFn: () => doSave(true),
    onSuccess: (res) => {
      const dn = res.data.data
      toast.success(res.data.message || `${dn.dn_no} created`)
      qc.invalidateQueries(['dns'])
      qc.invalidateQueries(['products'])
      if (isConvert) qc.invalidateQueries(['quotations'])
      setShortfalls(null)
      closeModal('dn')
    },
  })

  const addItem = (product) => {
    setForm(f => ({ ...f, items: [...f.items, {
      _id:         Date.now(),
      product_id:  product?.id || '',
      part_no:     product?.sku || '',
      description: product?.name || '',
      qty_ordered: 1, qty_delivered: 1,
      unit:        product?.unit || 'pcs',
      unit_price:  parseFloat(product?.price_1 || 0),
    }]}))
    setShowProd(false)
  }
  const updItem = (idx, k, v) => setForm(f => {
    const items = [...f.items]; items[idx] = { ...items[idx], [k]: v }; return { ...f, items }
  })
  const remItem = idx => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))

  // ── Now branch on mode — AFTER all hooks ──────────────────

  // ── VIEW MODE: read-only display of an existing committed DN ─
  if (isView) {
    const dn = existingDn
    const totalNet = (dn?.items || []).reduce(
      (s, i) => s + parseFloat(i.qty_delivered || 0) * parseFloat(i.unit_price || 0), 0)
    const sc = STATUS_COLOR[dn?.status] || STATUS_COLOR.pending_invoice

    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal('dn')}>
        <div className="modal modal-lg">
          <div className="modal-header teal">
            <h3>
              🚚 {loadingDn ? '…' : `Delivery Note — ${dn?.dn_no || ''}`}
              {dn?.status && (
                <span style={{ marginLeft:10, fontSize:11, fontWeight:700, padding:'2px 8px',
                  background: sc.bg, color: sc.color, border:`1px solid ${sc.border}`,
                  borderRadius:10, verticalAlign:'middle' }}>
                  {dn.status === 'pending_invoice' ? 'Pending Invoice'
                    : dn.status === 'invoiced' ? 'Invoiced' : 'Cancelled'}
                </span>
              )}
            </h3>
            <button className="close-btn" onClick={() => closeModal('dn')}>✕</button>
          </div>

          {/* Document trail — shows source quotation if converted from one */}
          <DocTrail docId={existingDnId} />

          <div className="modal-toolbar">
            <button className="btn" onClick={() => window.open(dnApi.getPdfUrl(existingDnId), '_blank')}>📄 PDF DN</button>
            <button className="btn" onClick={() => window.open(dnApi.getPrintUrl(existingDnId), '_blank')}>🖨 Print DN</button>
            <div className="toolbar-sep"/>
            <button className="btn" onClick={() => closeModal('dn')}>Close</button>
          </div>

          {loadingDn ? (
            <div style={{ padding:24, textAlign:'center', color:'#888' }}>Loading…</div>
          ) : dn ? (
            <div className="modal-body">
              <div className="form-section">
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:8 }}>
                  <div className="field"><label>DN No.</label>
                    <input value={dn.dn_no} readOnly style={{ background:'#f5f5f5', fontWeight:700, color:'var(--teal)' }}/>
                  </div>
                  <div className="field"><label>Date</label>
                    <input value={fmtDate(dn.dn_date)} readOnly style={{ background:'#f5f5f5' }}/>
                  </div>
                  <div className="field"><label>Client PO No.</label>
                    <input value={dn.po_reference || '—'} readOnly style={{ background:'#f5f5f5' }}/>
                  </div>
                  <div className="field"><label>Delivered By</label>
                    <input value={dn.delivered_by || '—'} readOnly style={{ background:'#f5f5f5' }}/>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8 }}>
                  <div className="field"><label>Customer</label>
                    <input value={dn.customer_name} readOnly style={{ background:'#f5f5f5', fontWeight:600 }}/>
                    <div style={{ fontSize:10, color:'#888', marginTop:2 }}>VAT: {dn.customer_vat || '—'}</div>
                  </div>
                  <div className="field"><label>Project / Reference</label>
                    <input value={dn.project_ref || '—'} readOnly style={{ background:'#f5f5f5' }}/>
                  </div>
                  <div className="field"><label>Delivery Address</label>
                    <input value={dn.delivery_address || '—'} readOnly style={{ background:'#f5f5f5' }}/>
                  </div>
                </div>
                {dn.linked_invoice_no && (
                  <div style={{ marginTop:6, fontSize:11, color:'#1565c0', fontWeight:600 }}>
                    🧾 Invoiced as: {dn.linked_invoice_no}
                  </div>
                )}
              </div>

              <div style={{ padding:'8px 12px' }}>
                <table className="items-grid">
                  <thead><tr>
                    <th style={{ width:26 }}>#</th>
                    <th style={{ width:90 }}>Part No.</th>
                    <th>Description</th>
                    <th style={{ width:70 }}>Qty Ordered</th>
                    <th style={{ width:70, background:'#e8f5e9', color:'#1b5e20' }}>Qty Delivered</th>
                    <th style={{ width:50 }}>Unit</th>
                    <th style={{ width:80 }}>Unit Price</th>
                    <th style={{ width:80 }}>Net BHD</th>
                  </tr></thead>
                  <tbody>
                    {(dn.items || []).map((it, idx) => (
                      <tr key={it.id || idx}>
                        <td style={{ textAlign:'center', color:'#888' }}>{idx + 1}</td>
                        <td style={{ fontSize:11, color:'var(--blue)', fontWeight:600 }}>{it.part_no || '—'}</td>
                        <td>{it.description}</td>
                        <td style={{ textAlign:'right', color:'#555' }}>{it.qty_ordered}</td>
                        <td style={{ textAlign:'right', fontWeight:700, background:'#f1faf3',
                          color: parseFloat(it.qty_delivered) < parseFloat(it.qty_ordered) ? '#e65100' : '#2e7d32' }}>
                          {it.qty_delivered}
                        </td>
                        <td style={{ textAlign:'center', color:'#888' }}>{it.unit}</td>
                        <td style={{ textAlign:'right' }}>{fmtBhd(it.unit_price)}</td>
                        <td style={{ textAlign:'right', fontWeight:600 }}>
                          {fmtBhd(parseFloat(it.qty_delivered || 0) * parseFloat(it.unit_price || 0))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {dn.notes && (
                <div style={{ padding:'6px 12px', fontSize:12, color:'#555' }}>
                  <strong>Notes:</strong> {dn.notes}
                </div>
              )}
            </div>
          ) : null}

          <div className="modal-footer">
            <table style={{ width:'100%', fontSize:12.5 }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight:700, fontSize:14, color:'#00695c' }}>Total Net Value:</td>
                  <td style={{ textAlign:'right', fontWeight:700, fontSize:14, color:'#00695c' }}>BHD {fmtBhd(totalNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── CREATE / CONVERT MODE ─────────────────────────────────
  const totalNet = form.items.reduce(
    (s, i) => s + parseFloat(i.qty_delivered || 0) * parseFloat(i.unit_price || 0), 0)

  const headerTitle = isConvert
    ? `🚚 Convert ${loadingSrc ? '…' : sourceDoc?.invoice_no || ''} → Delivery Note`
    : '🚚 New Delivery Note'

  return (
    <>
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal('dn')}>
        <div className="modal modal-lg">
          <div className="modal-header teal">
            <h3>{headerTitle}</h3>
            <button className="close-btn" onClick={() => closeModal('dn')}>✕</button>
          </div>

          {isConvert && sourceDoc && (
            <div style={{
              background: '#e8f5e9', borderBottom: '1px solid #a5d6a7',
              padding: '5px 14px', fontSize: 11, color: '#1b5e20',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <strong>📎 Source:</strong>
              <span style={{ fontWeight:700 }}>{sourceDoc.invoice_no}</span>
              <span>— {sourceDoc.customer_name}</span>
              <span style={{ color:'#555' }}>|</span>
              <span>Review items, set Qty Delivered, fill in delivery details, then save</span>
            </div>
          )}

          <div className="modal-toolbar">
            <button className="btn teal"
              onClick={() => saveMut.mutate()}
              disabled={saveMut.isPending || !form.customer_id || !form.items.length || loadingSrc}>
              💾 {saveMut.isPending
                ? 'Saving & deducting stock…'
                : isConvert ? 'Confirm & Create DN (Deducts Stock)' : 'Save (Deducts Stock)'}
            </button>
            <div className="toolbar-sep"/>
            <button className="btn danger" onClick={() => closeModal('dn')}>✕ Cancel</button>
          </div>

          <div className="modal-body">
            <div className="form-section">
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:8 }}>
                <div className="field"><label>DN No.</label>
                  <input value="Auto-generated" readOnly style={{ background:'#f5f5f5' }}/>
                </div>
                <div className="field"><label>Date *</label>
                  <input type="date" value={form.dn_date} onChange={e => F('dn_date', e.target.value)}/>
                </div>
                <div className="field"><label>Client PO No.</label>
                  <input value={form.po_reference} onChange={e => F('po_reference', e.target.value)}
                    placeholder={isConvert ? (sourceDoc?.invoice_no || 'QT reference') : 'Leave blank if not received'}/>
                </div>
                <div className="field"><label>Delivered By</label>
                  <input value={form.delivered_by} onChange={e => F('delivered_by', e.target.value)} placeholder="Driver / courier name"/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8 }}>
                <div className="field"><label>Customer *</label>
                  <CustomerTypeahead
                    value={form.customer_id}
                    displayName={form.customer_name}
                    onChange={c => { F('customer_id', c.id); F('customer_name', c.name); F('customer_vat', c.vat_number || '') }}
                    onClear={() => { F('customer_id', ''); F('customer_name', ''); F('customer_vat', '') }}
                    placeholder="Search customer…"
                    allowCreate={true}
                    disabled={isConvert}
                  />
                  {form.customer_name && (
                    <div style={{ fontSize:10, color:'#888', marginTop:2 }}>VAT: {form.customer_vat || '—'}</div>
                  )}
                </div>
                <div className="field"><label>Project / Reference</label>
                  <input value={form.project_ref} onChange={e => F('project_ref', e.target.value)} placeholder="Project name or site ref"/>
                </div>
                <div className="field"><label>Delivery Address</label>
                  <input value={form.delivery_address} onChange={e => F('delivery_address', e.target.value)} placeholder="Site / project address"/>
                </div>
              </div>
            </div>

            <div style={{ padding:'8px 12px' }}>
              <table className="items-grid">
                <thead><tr>
                  <th style={{ width:26 }}>#</th>
                  <th style={{ width:90 }}>Part No.</th>
                  <th>Description</th>
                  <th style={{ width:70 }}>Qty Ordered</th>
                  <th style={{ width:70, background:'#e8f5e9', color:'#1b5e20' }}>Qty Delivered ✎</th>
                  <th style={{ width:50 }}>Unit</th>
                  <th style={{ width:80 }}>Unit Price</th>
                  <th style={{ width:80 }}>Net BHD</th>
                  <th style={{ width:24 }}></th>
                </tr></thead>
                <tbody>
                  {loadingSrc && (
                    <tr><td colSpan={9} style={{ padding:12, textAlign:'center', color:'#888', fontStyle:'italic' }}>
                      Loading items from {sourceDoc?.invoice_no || 'quotation'}…
                    </td></tr>
                  )}
                  {!loadingSrc && form.items.map((it, idx) => (
                    <tr key={it._id} style={{ background: !it.product_id ? '#fffdf0' : undefined }}>
                      <td style={{ textAlign:'center', color:'#888' }}>
                        {idx + 1}
                        {!it.product_id && <div style={{ fontSize:9, color:'#aaa', lineHeight:1 }}>free</div>}
                      </td>
                      <td><input value={it.part_no || ''} onChange={e => updItem(idx, 'part_no', e.target.value)} placeholder="Part No."/></td>
                      <td><input value={it.description || ''} onChange={e => updItem(idx, 'description', e.target.value)}
                        placeholder="Description" style={{ width:'100%' }}/></td>
                      <td>
                        <input type="number" value={it.qty_ordered}
                          onChange={e => updItem(idx, 'qty_ordered', e.target.value)}
                          readOnly={isConvert}
                          style={{ textAlign:'right', background: isConvert ? '#f5f5f5' : undefined }}/>
                      </td>
                      <td style={{ background:'#f1faf3' }}>
                        <input type="number" value={it.qty_delivered}
                          onChange={e => updItem(idx, 'qty_delivered', e.target.value)}
                          style={{ textAlign:'right', fontWeight:700,
                            color: parseFloat(it.qty_delivered) < parseFloat(it.qty_ordered) ? '#e65100' : '#2e7d32' }}/>
                      </td>
                      <td>
                        <select value={it.unit || 'pcs'} onChange={e => updItem(idx, 'unit', e.target.value)} style={{ fontSize:11 }}>
                          {['pcs','mtr','box','reel','kg','set'].map(u => <option key={u}>{u}</option>)}
                        </select>
                      </td>
                      <td><input type="number" step="0.001" value={it.unit_price}
                        onChange={e => updItem(idx, 'unit_price', e.target.value)} style={{ textAlign:'right' }}/></td>
                      <td style={{ textAlign:'right', fontWeight:600, padding:'3px 5px' }}>
                        {fmtBhd(parseFloat(it.qty_delivered || 0) * parseFloat(it.unit_price || 0))}
                      </td>
                      <td><button onClick={() => remItem(idx)}
                        style={{ background:'none', border:'none', color:'#c62828', cursor:'pointer', fontSize:13 }}>✕</button></td>
                    </tr>
                  ))}
                  {!loadingSrc && !form.items.length && (
                    <tr><td colSpan={9} style={{ padding:12, textAlign:'center', color:'#aaa', fontStyle:'italic' }}>
                      No items — click ＋ Add Item below
                    </td></tr>
                  )}
                </tbody>
              </table>
              <div style={{ display:'flex', gap:6, marginTop:4 }}>
                <button className="add-item-btn" onClick={() => setShowProd(true)}>＋ Pick from Catalog</button>
                <button className="add-item-btn" style={{ background:'#fff8e1', borderColor:'#ffe082', color:'#5d4037' }}
                  onClick={() => addItem()}>✎ Free Text Line</button>
              </div>
            </div>

            <div style={{ background:'#fff8e1', borderTop:'1px solid #ffe082', padding:'7px 12px', fontSize:12, color:'#5d4037' }}>
              ⚠ Stock is deducted <strong>immediately on save</strong>.
              {isConvert
                ? <span style={{ marginLeft:4 }}>Partial delivery allowed — Qty Delivered can be less than ordered (shown in orange). Source quotation will be marked as converted.</span>
                : <span style={{ marginLeft:4 }}>Cancelling a DN will automatically reverse the stock.</span>}
            </div>
          </div>

          <div className="modal-footer">
            <table style={{ width:'100%', fontSize:12.5 }}>
              <tbody>
                <tr>
                  <td style={{ fontWeight:700, fontSize:14, color:'#00695c' }}>Total Net Value:</td>
                  <td style={{ textAlign:'right', fontWeight:700, fontSize:14, color:'#00695c' }}>BHD {fmtBhd(totalNet)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showProd && <ProductPickerModal onSelect={addItem} onClose={() => setShowProd(false)}/>}

      {/* Stock Shortfall Confirmation Dialog */}
      {shortfalls && (
        <div className="modal-overlay" style={{ zIndex: 1200 }} onClick={e => e.target === e.currentTarget && setShortfalls(null)}>
          <div className="modal modal-sm" style={{ maxWidth: 480 }}>
            <div className="modal-header" style={{ background:'#e65100', color:'#fff' }}>
              <h3>⚠ Stock Shortfall — Confirm Backorder</h3>
              <button className="close-btn" onClick={() => setShortfalls(null)} style={{ color:'#fff' }}>✕</button>
            </div>
            <div className="modal-body" style={{ padding: 16 }}>
              <p style={{ fontSize: 13, marginBottom: 12, color: '#555' }}>
                The following items exceed available stock. You can still create this DN — stock will go negative
                and must be replenished via a Purchase Order before or after delivery.
              </p>
              <table className="data-table" style={{ fontSize: 12, marginBottom: 14 }}>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th style={{ textAlign:'right' }}>Available</th>
                    <th style={{ textAlign:'right' }}>Requested</th>
                    <th style={{ textAlign:'right' }}>Shortfall</th>
                  </tr>
                </thead>
                <tbody>
                  {shortfalls.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.name}</td>
                      <td style={{ textAlign:'right', color: s.available <= 0 ? '#c62828' : '#e65100' }}>{s.available}</td>
                      <td style={{ textAlign:'right' }}>{s.requested}</td>
                      <td style={{ textAlign:'right', color:'#c62828', fontWeight: 700 }}>−{s.shortfall}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:4, padding:'8px 12px', fontSize:11, color:'#5d4037' }}>
                💡 After confirming, go to <strong>Purchases</strong> to create a Purchase Order for the shortfall.
                Receiving the PO will bring stock back to positive.
              </div>
            </div>
            <div style={{ padding:'10px 16px', borderTop:'1px solid #e0e0e0', display:'flex', gap:8 }}>
              <button className="btn"
                style={{ background:'#e65100', color:'#fff', borderColor:'#bf360c' }}
                onClick={() => confirmOverstockMut.mutate()}
                disabled={confirmOverstockMut.isPending}>
                {confirmOverstockMut.isPending ? '⏳ Creating…' : '✓ Confirm — Create DN (Backorder)'}
              </button>
              <button className="btn" onClick={() => setShortfalls(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
