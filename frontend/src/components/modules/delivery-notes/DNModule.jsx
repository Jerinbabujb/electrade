import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dnApi, invoiceApi } from '../../../services/api'
import { useUIStore } from '../../../store'
import { fmtBhd, fmtDate } from '../../../utils/format'
import DNModal          from './DNModal'
import ConsolidateModal from '../invoices/ConsolidateModal'
import InvoiceModal     from '../invoices/InvoiceModal'
import toast from 'react-hot-toast'

const PAGE_SIZES = [25, 50, 100, 500]

// ── Create Quotation Modal ─────────────────────────────────
function CreateQuotationModal({ checkedIds, rows, onClose }) {
  const qc = useQueryClient()
  const { openModal } = useUIStore()

  const selectedDns     = rows.filter(r => checkedIds.includes(r.id))
  const customerId      = selectedDns[0]?.customer_id
  const customerName    = selectedDns[0]?.customer_name
  const allSameCustomer = selectedDns.every(d => d.customer_id === customerId)

  const [form, setForm] = useState({
    quotation_date: new Date().toISOString().split('T')[0],
    valid_until: '',
    notes: '',
  })
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Fetch full item details for each selected DN in parallel
  const { data: dnDetails, isLoading: itemsLoading } = useQuery({
    queryKey: ['dn-details-for-quote', checkedIds],
    queryFn: () => Promise.all(checkedIds.map(id => dnApi.get(id).then(r => r.data.data))),
    enabled: allSameCustomer,
  })
  const allItems = dnDetails ? dnDetails.flatMap(dn =>
    (dn.items || []).map(it => ({ ...it, dn_no: dn.dn_no }))
  ) : []
  const subtotal    = allItems.reduce((s, it) => s + parseFloat(it.qty_delivered) * parseFloat(it.unit_price), 0)
  const totalVat    = subtotal * 0.10
  const grandTotal  = subtotal + totalVat

  const mut = useMutation({
    mutationFn: () => dnApi.quoteFromDNs({ dn_ids: checkedIds, ...form }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['dns'])
      qc.invalidateQueries(['quotations'])
      onClose()
      // Open the newly-created quotation
      openModal('invoice', { id: res.data.data.id })
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to create quotation'),
  })

  if (!allSameCustomer) {
    return (
      <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
        <div className="modal" style={{ maxWidth: 420 }}>
          <div className="modal-header"><h3>Cannot Create Quotation</h3><button className="close-btn" onClick={onClose}>✕</button></div>
          <div className="modal-body" style={{ padding: 16 }}>
            <p style={{ color: '#c62828' }}>All selected delivery notes must belong to the <strong>same customer</strong>.</p>
            <p style={{ fontSize: 12, color: '#555' }}>
              Currently selected DNs belong to multiple customers. Deselect all and re-select
              only DNs for a single customer before creating a quotation.
            </p>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #eee' }}>
            <button className="btn" onClick={onClose}>Close</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 720 }}>
        <div className="modal-header">
          <h3>📋 Create Quotation from {checkedIds.length} DN{checkedIds.length > 1 ? 's' : ''}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={() => mut.mutate()} disabled={mut.isPending || itemsLoading || !allItems.length}>
            {mut.isPending ? '⏳ Creating…' : '📋 Create Quotation'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-body" style={{ padding: 14 }}>
          {/* Summary */}
          <div style={{ background: '#f0f7ff', border: '1px solid #b0d0f0', borderRadius: 4, padding: '8px 12px', marginBottom: 12, fontSize: 12 }}>
            <strong>Customer:</strong> {customerName} &nbsp;·&nbsp;
            <strong>DNs:</strong> {selectedDns.map(d => d.dn_no).join(', ')}
          </div>

          {/* Quotation fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div className="field">
              <label>Quotation Date</label>
              <input type="date" value={form.quotation_date} onChange={e => F('quotation_date', e.target.value)} />
            </div>
            <div className="field">
              <label>Valid Until</label>
              <input type="date" value={form.valid_until} onChange={e => F('valid_until', e.target.value)} />
            </div>
            <div className="field" style={{ gridColumn: 'span 2' }}>
              <label>Notes (optional)</label>
              <input value={form.notes} onChange={e => F('notes', e.target.value)}
                placeholder="e.g. Quotation for Project XYZ — per site visit on …" />
            </div>
          </div>

          {/* Items preview */}
          {itemsLoading && <div style={{ color: '#888', fontSize: 12, padding: '8px 0' }}>Loading line items…</div>}
          {!itemsLoading && allItems.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                Line items ({allItems.length}) — read-only preview, edit in Quotations after creation
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 280 }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 70 }}>DN</th>
                      <th style={{ width: 80 }}>Part No.</th>
                      <th>Description</th>
                      <th className="right" style={{ width: 60 }}>Qty</th>
                      <th style={{ width: 50 }}>Unit</th>
                      <th className="right" style={{ width: 90 }}>Unit Price</th>
                      <th className="right" style={{ width: 90 }}>Net BHD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allItems.map((it, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: 10, color: 'var(--teal)', fontWeight: 600 }}>{it.dn_no}</td>
                        <td style={{ fontSize: 11 }}>{it.part_no || '—'}</td>
                        <td style={{ fontSize: 12 }}>{it.description}</td>
                        <td className="right">{it.qty_delivered}</td>
                        <td style={{ fontSize: 11 }}>{it.unit}</td>
                        <td className="right">{parseFloat(it.unit_price).toFixed(3)}</td>
                        <td className="right">{(parseFloat(it.qty_delivered) * parseFloat(it.unit_price)).toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 20, padding: '8px 4px 0', fontSize: 12 }}>
                <span>Subtotal: <strong>BHD {fmtBhd(subtotal)}</strong></span>
                <span>VAT (10%): <strong>BHD {fmtBhd(totalVat)}</strong></span>
                <span style={{ fontWeight: 700, color: 'var(--blue)' }}>Total: BHD {fmtBhd(grandTotal)}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main DN Module ─────────────────────────────────────────
export default function DNModule() {
  const { openModal, getModal } = useUIStore()
  const qc = useQueryClient()
  const [activeTab,   setActiveTab]   = useState('native')   // 'native' | 'historical'
  const [filters,     setFilters]     = useState({ status: '', customer_id: '', q: '' })
  const [selectedId,  setSelectedId]  = useState(null)
  const [checkedIds,  setCheckedIds]  = useState([])
  const [showQuoteModal, setShowQuoteModal] = useState(false)

  // Historical tab state
  const [hFilters,    setHFilters]    = useState({ q: '', from: '', to: '' })
  const [hPage,       setHPage]       = useState(1)
  const [hPageSize,   setHPageSize]   = useState(50)
  const [hSelectedId, setHSelectedId] = useState(null)

  const setHFiltersAndReset = (upd) => { setHFilters(upd); setHPage(1) }
  const setHPageSizeAndReset = (n)  => { setHPageSize(n);  setHPage(1) }

  const { data, isLoading } = useQuery({
    queryKey: ['dns', filters],
    queryFn:  () => dnApi.list(filters).then(r => r.data.data),
  })

  const hOffset = (hPage - 1) * hPageSize
  const { data: hResp, isLoading: hLoading } = useQuery({
    queryKey: ['si-historical-dns', hFilters, hPage, hPageSize],
    queryFn:  () => invoiceApi.list({
      type: 'delivery_note', q: hFilters.q, from: hFilters.from, to: hFilters.to,
      limit: hPageSize, offset: hOffset,
    }).then(r => r.data),
    keepPreviousData: true,
    enabled: activeTab === 'historical',
  })
  const hRows      = hResp?.data  || []
  const hTotal     = hResp?.total ?? 0
  const hTotalPages = Math.max(1, Math.ceil(hTotal / hPageSize))

  const cancelMut = useMutation({
    mutationFn: (id) => dnApi.cancel(id),
    onSuccess:  () => {
      toast.success('DN cancelled — stock reversed')
      qc.invalidateQueries(['dns'])
      qc.invalidateQueries(['products'])
    },
  })

  const rows    = data || []
  const pending = rows.filter(r => r.status === 'pending_invoice')
  const quoted  = rows.filter(r => r.status === 'quoted')
  const pendingValue = pending.reduce((s, r) => s + parseFloat(r.net_value || 0), 0)

  const toggleCheck = (id) => {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // Determine state of checked DNs for button logic
  const checkedRows       = rows.filter(r => checkedIds.includes(r.id))
  const checkedAllPending = checkedRows.length > 0 && checkedRows.every(r => r.status === 'pending_invoice')
  const checkedHasQuoted  = checkedRows.some(r => r.status === 'quoted')
  const checkedSameCustomer = checkedRows.length > 0 && new Set(checkedRows.map(r => r.customer_id)).size === 1

  const handleCreateQuotation = () => {
    if (!checkedAllPending)  { toast.error('Select only pending-invoice DNs to create a quotation'); return }
    if (!checkedSameCustomer){ toast.error('All selected DNs must belong to the same customer'); return }
    setShowQuoteModal(true)
  }

  const handleCreateInvoice = () => {
    if (!checkedIds.length) { toast.error('Select at least one DN'); return }
    if (checkedHasQuoted)   { toast.error('Cannot directly invoice quoted DNs — convert via the Quotation instead'); return }
    openModal('consolidate', { dn_ids: checkedIds })
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Delivery Notes</div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, padding:'0 12px', borderBottom:'2px solid #e0e0e0', flexShrink:0, background:'#fafafa' }}>
        {[
          { key:'native',     label:'Active Delivery Notes' },
          { key:'historical', label:`SI Historical DNs (${hTotal > 0 ? hTotal.toLocaleString() : '3,023'})` },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)}
            style={{
              padding:'8px 18px', fontSize:12, fontWeight:600, border:'none', background:'transparent',
              borderBottom: activeTab === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
              color: activeTab === tab.key ? 'var(--blue)' : '#666',
              cursor:'pointer', marginBottom:-2,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── NATIVE DN TAB ──────────────────────────────── */}
      {activeTab === 'native' && <>

        {(pending.length > 0 || quoted.length > 0) && (
          <div className="alert-banner">
            ⚠️ <strong>{pending.length} DN{pending.length !== 1 ? 's' : ''}</strong> pending invoice
            (BHD {fmtBhd(pendingValue)})
            {quoted.length > 0 && <> · <strong>{quoted.length}</strong> awaiting LPO</>}
            {' '}— select pending DNs and use <strong>"Create Quotation"</strong> or <strong>"Create Invoice"</strong>.
          </div>
        )}

        <div className="toolbar">
          <button className="btn primary" onClick={() => openModal('dn', {})}>
            <span className="btn-icon">＋</span> New Delivery Note
          </button>
          <button className="btn"
            style={{ background: checkedAllPending && checkedIds.length ? '#6a1b9a' : undefined,
                     color:      checkedAllPending && checkedIds.length ? '#fff'    : undefined,
                     borderColor:checkedAllPending && checkedIds.length ? '#4a148c' : undefined }}
            onClick={handleCreateQuotation}
            disabled={checkedIds.length === 0}
            title="Create a Quotation pre-populated with selected DN items. Customer LPO will be required before converting to invoice.">
            <span className="btn-icon">📋</span> Create Quotation ({checkedIds.length})
          </button>
          <button className="btn teal"
            onClick={handleCreateInvoice}
            disabled={checkedIds.length === 0}>
            <span className="btn-icon">🔗</span> Create Invoice from DNs ({checkedIds.length})
          </button>
          <button className="btn" disabled={!selectedId} onClick={() => openModal('dn', { id: selectedId })}>
            ✏️ View/Edit
          </button>
          <button className="btn"
            disabled={!selectedId} onClick={() => window.open(dnApi.getPdfUrl(selectedId), '_blank')}>
            📄 PDF DN
          </button>
          <button className="btn"
            disabled={!selectedId} onClick={() => window.open(dnApi.getPrintUrl(selectedId), '_blank')}>
            🖨 Print DN
          </button>
          <button className="btn warn"
            disabled={!selectedId}
            onClick={() => { if (selectedId && window.confirm('Cancel this DN? Stock will be reversed automatically.')) cancelMut.mutate(selectedId) }}>
            ↩ Cancel DN
          </button>
          <div className="toolbar-sep" />
          <select className="btn" style={{ height:26, cursor:'default' }}
            value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}>
            <option value="">All Status</option>
            <option value="pending_invoice">Pending Invoice</option>
            <option value="quoted">Quoted — Awaiting LPO</option>
            <option value="invoiced">Invoiced</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <div className="toolbar-search">
            <input type="text" placeholder="Search DN / customer / project..."
              value={filters.q} onChange={e => setFilters(f => ({ ...f, q: e.target.value }))} />
            <button className="btn">🔍</button>
          </div>
        </div>

        <div className="grid-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:30 }}>
                  <input type="checkbox"
                    checked={checkedIds.length === pending.length && pending.length > 0}
                    onChange={e => setCheckedIds(e.target.checked ? pending.map(r => r.id) : [])} />
                </th>
                <th>DN No.</th><th>Date</th><th>Customer</th><th>Project / Ref</th>
                <th className="right">Items</th><th className="right">Net Value BHD</th>
                <th>Stock</th><th>Invoice Status</th><th>Linked Invoice</th><th>QT Ref</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <tr className="empty-row"><td colSpan={11}>Loading...</td></tr>}
              {!isLoading && rows.length === 0 && <tr className="empty-row"><td colSpan={11}>No delivery notes found</td></tr>}
              {rows.map(dn => (
                <tr key={dn.id}
                  className={selectedId === dn.id ? 'selected' : ''}
                  onClick={() => setSelectedId(dn.id)}
                  onDoubleClick={() => openModal('dn', { id: dn.id })}
                >
                  <td onClick={e => e.stopPropagation()}>
                    {(dn.status === 'pending_invoice' || dn.status === 'quoted') && (
                      <input type="checkbox"
                        checked={checkedIds.includes(dn.id)}
                        onChange={() => toggleCheck(dn.id)} />
                    )}
                  </td>
                  <td style={{ color:'var(--teal)', fontWeight:600 }}>{dn.dn_no}</td>
                  <td>{fmtDate(dn.dn_date)}</td>
                  <td>{dn.customer_name}</td>
                  <td style={{ color:'var(--gray-dark)', fontStyle:'italic' }}>{dn.project_ref || '—'}</td>
                  <td className="right">{dn.item_count}</td>
                  <td className="right" style={{ fontWeight:600 }}>{fmtBhd(dn.net_value)}</td>
                  <td>
                    {dn.status !== 'cancelled'
                      ? <span className="badge badge-invoiced">Deducted</span>
                      : <span className="badge badge-cancelled">Reversed</span>}
                  </td>
                  <td>
                    {dn.status === 'pending_invoice' && <span className="badge badge-pending">Pending Invoice</span>}
                    {dn.status === 'quoted'          && (
                      <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:8,
                                     background:'#ede7f6', color:'#4a148c', border:'1px solid #ce93d8' }}>
                        Quoted — Awaiting LPO
                      </span>
                    )}
                    {dn.status === 'invoiced'        && <span className="badge badge-invoiced">Invoiced</span>}
                    {dn.status === 'cancelled'       && <span className="badge badge-cancelled">Cancelled</span>}
                  </td>
                  <td>
                    {dn.linked_invoice_no
                      ? <span className="dn-chip">{dn.linked_invoice_no}</span>
                      : '—'}
                  </td>
                  <td>
                    {dn.linked_quotation_no
                      ? <span
                          className="dn-chip"
                          style={{ background:'#ede7f6', color:'#4a148c', borderColor:'#ce93d8', cursor:'pointer' }}
                          title={`Open quotation ${dn.linked_quotation_no}`}
                          onClick={e => { e.stopPropagation(); openModal('invoice', { id: dn.linked_quotation_id }) }}>
                          {dn.linked_quotation_no}
                        </span>
                      : <span style={{ color:'#ccc' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="status-bar">
          <span>{rows.length} delivery notes</span>
          <span>|</span>
          <span style={{ color:'var(--purple)', fontWeight:600 }}>{pending.length} pending invoice</span>
          {quoted.length > 0 && <>
            <span>|</span>
            <span style={{ color:'#6a1b9a', fontWeight:600 }}>{quoted.length} awaiting LPO</span>
          </>}
          <span>|</span>
          <span>Pending value: <strong style={{ color:'var(--purple)' }}>BHD {fmtBhd(pendingValue)}</strong></span>
          <span>|</span>
          <span>{rows.filter(r=>r.status==='cancelled').length} cancelled (stock reversed)</span>
        </div>
      </>}

      {/* ── SI HISTORICAL DNs TAB ──────────────────────── */}
      {activeTab === 'historical' && <>

        <div style={{ padding:'6px 12px', background:'#fff8e1', borderBottom:'1px solid #ffe082', fontSize:11, color:'#5d4037', flexShrink:0 }}>
          📋 Read-only records imported from Simple Invoice. These delivery notes (DN/YYYY/N) are stored for reference only and do not affect stock or AR.
          Double-click any row to view full details including line items.
        </div>

        <div className="toolbar">
          <button className="btn" disabled={!hSelectedId}
            onClick={() => window.open(invoiceApi.getPdfUrl(hSelectedId), '_blank')}>
            📄 PDF
          </button>
          <button className="btn" disabled={!hSelectedId}
            onClick={() => window.open(invoiceApi.getPrintUrl(hSelectedId), '_blank')}>
            🖨 Print
          </button>
          <button className="btn" disabled={!hSelectedId}
            onClick={() => openModal('invoice', { id: hSelectedId })}>
            🔍 View Details
          </button>
          <div className="toolbar-sep" />
          <input type="date" value={hFilters.from} title="From date"
            onChange={e => setHFiltersAndReset(f => ({ ...f, from: e.target.value }))}
            style={{ height:26, fontSize:11, padding:'2px 6px', borderRadius:3, border:'1px solid #ccc' }} />
          <span style={{ fontSize:11, color:'#888' }}>–</span>
          <input type="date" value={hFilters.to} title="To date"
            onChange={e => setHFiltersAndReset(f => ({ ...f, to: e.target.value }))}
            style={{ height:26, fontSize:11, padding:'2px 6px', borderRadius:3, border:'1px solid #ccc' }} />
          {(hFilters.from || hFilters.to) && (
            <button className="btn" title="Clear dates"
              onClick={() => setHFiltersAndReset(f => ({ ...f, from:'', to:'' }))}>✕</button>
          )}
          <div className="toolbar-search">
            <input type="text" placeholder="Search DN no. / customer..."
              value={hFilters.q} onChange={e => setHFiltersAndReset(f => ({ ...f, q: e.target.value }))} />
            <button className="btn">🔍</button>
          </div>
        </div>

        <div className="grid-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width:28 }}></th>
                <th>DN No.</th><th>Date</th><th>Customer</th>
                <th>Notes / Ref</th><th>PO Ref</th>
                <th className="right">Net BHD</th><th className="right">VAT BHD</th>
                <th className="right">Total BHD</th><th>Linked Invoice</th>
              </tr>
            </thead>
            <tbody>
              {hLoading && <tr className="empty-row"><td colSpan={10}>Loading...</td></tr>}
              {!hLoading && hRows.length === 0 && <tr className="empty-row"><td colSpan={10}>No records found</td></tr>}
              {hRows.map(r => {
                const linkedInv = r.conversions_out?.find(c => c.to_type === 'tax_invoice')
                return (
                  <tr key={r.id}
                    className={hSelectedId === r.id ? 'selected' : ''}
                    onClick={() => setHSelectedId(r.id)}
                    onDoubleClick={() => openModal('invoice', { id: r.id })}>
                    <td><input type="checkbox" checked={hSelectedId === r.id} onChange={() => setHSelectedId(r.id)} /></td>
                    <td style={{ color:'var(--teal)', fontWeight:600 }}>{r.invoice_no}</td>
                    <td>{fmtDate(r.invoice_date)}</td>
                    <td>{r.customer_name}</td>
                    <td style={{ fontSize:11, color:'#666', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {r.notes || '—'}
                    </td>
                    <td style={{ fontSize:11, color:'#666' }}>{r.po_reference || '—'}</td>
                    <td className="right">{fmtBhd(r.subtotal)}</td>
                    <td className="right">{fmtBhd(r.total_vat)}</td>
                    <td className="right" style={{ fontWeight:600 }}>{fmtBhd(r.grand_total)}</td>
                    <td>
                      {linkedInv
                        ? <span className="dn-chip" style={{ cursor:'pointer' }}
                            onClick={e => { e.stopPropagation(); openModal('invoice', { id: linkedInv.to_id }) }}>
                            {linkedInv.to_no}
                          </span>
                        : <span style={{ fontSize:11, color:'#aaa' }}>—</span>
                      }
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Status bar + pagination */}
        <div className="status-bar" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
          <span style={{ color:'#555' }}>{hTotal.toLocaleString()} records</span>
          <span>|</span>
          <span>Page total: <strong>BHD {fmtBhd(hRows.reduce((s, r) => s + parseFloat(r.grand_total || 0), 0))}</strong></span>
          <div style={{ flex:1 }} />
          <span style={{ fontSize:11, color:'#888' }}>Rows:</span>
          {PAGE_SIZES.map(n => (
            <button key={n} onClick={() => setHPageSizeAndReset(n)}
              style={{
                padding:'2px 8px', fontSize:11, borderRadius:3, border:'1px solid #ccc',
                background: hPageSize === n ? 'var(--blue)' : '#f5f5f5',
                color:      hPageSize === n ? '#fff' : '#444',
                cursor:'pointer', fontWeight: hPageSize === n ? 700 : 400,
              }}>{n}</button>
          ))}
          <button className="btn" style={{ padding:'1px 7px', fontSize:11 }}
            onClick={() => setHPage(p => Math.max(1, p - 1))} disabled={hPage <= 1}>‹</button>
          <span style={{ fontSize:11, fontWeight:600, minWidth:70, textAlign:'center' }}>
            {hPage} / {hTotalPages}
          </span>
          <button className="btn" style={{ padding:'1px 7px', fontSize:11 }}
            onClick={() => setHPage(p => Math.min(hTotalPages, p + 1))} disabled={hPage >= hTotalPages}>›</button>
        </div>
      </>}

      {getModal('dn').open          && <DNModal />}
      {getModal('consolidate').open && <ConsolidateModal />}
      {getModal('invoice').open     && <InvoiceModal />}
      {showQuoteModal && (
        <CreateQuotationModal
          checkedIds={checkedIds}
          rows={rows}
          onClose={() => { setShowQuoteModal(false); setCheckedIds([]) }}
        />
      )}
    </div>
  )
}
