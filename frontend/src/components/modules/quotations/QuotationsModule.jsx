import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoiceApi, convertApi, customerApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import { useUIStore } from '../../../store'
import InvoiceModal from '../invoices/InvoiceModal'
import DNModal      from '../delivery-notes/DNModal'
import toast from 'react-hot-toast'

const PAGE_SIZES = [25, 50, 100, 500]

const today = new Date().toISOString().split('T')[0]

function ConversionChips({ conversions, onOpen }) {
  if (!conversions?.length) return null
  return (
    <span style={{ display:'inline-flex', gap:3, flexWrap:'wrap', marginLeft:4 }}>
      {conversions.map((c, i) => (
        <span key={i}
          onClick={e => { e.stopPropagation(); onOpen(c.to_type, c.to_id) }}
          title={`Open ${c.to_type.replace('_',' ')} ${c.to_no}`}
          style={{
            fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:8,
            background: c.to_type === 'delivery_note' ? '#e8f5e9' : '#e3f2fd',
            color:      c.to_type === 'delivery_note' ? '#1b5e20' : '#1565c0',
            border:     `1px solid ${c.to_type === 'delivery_note' ? '#a5d6a7' : '#90caf9'}`,
            cursor: 'pointer',
          }}>
          → {c.to_type === 'delivery_note' ? '🚚' : '🧾'} {c.to_no}
        </span>
      ))}
    </span>
  )
}

function ExpiryBadge({ validUntil }) {
  if (!validUntil) return null
  const expDate  = validUntil.split('T')[0]
  const daysLeft = Math.ceil((new Date(expDate) - new Date(today)) / 86400000)
  if (daysLeft > 7)  return <span style={{ fontSize:10, color:'#2e7d32' }}>{fmtDate(expDate)}</span>
  if (daysLeft >= 0) return (
    <span style={{ fontSize:10, fontWeight:700, color:'#e65100', background:'#fff3e0', padding:'1px 5px', borderRadius:8 }}>
      ⚠ {daysLeft === 0 ? 'Expires today' : `${daysLeft}d left`}
    </span>
  )
  return (
    <span style={{ fontSize:10, fontWeight:700, color:'#c62828', background:'#ffebee', padding:'1px 5px', borderRadius:8 }}>
      ✕ Expired {fmtDate(expDate)}
    </span>
  )
}

function EmailQuotationModal({ quotation, onClose }) {
  const [toEmail, setToEmail] = useState('')
  const [sending, setSending] = useState(false)

  const { data: custData } = useQuery({
    queryKey: ['customer', quotation.customer_id],
    queryFn:  () => customerApi.get(quotation.customer_id).then(r => r.data.data),
    enabled:  !!quotation.customer_id,
    onSuccess: (c) => { if (c.email && !toEmail) setToEmail(c.email) },
  })

  const email = toEmail || custData?.email || ''

  const send = async () => {
    if (!email) { toast.error('Enter recipient email'); return }
    setSending(true)
    try {
      await invoiceApi.sendEmail(quotation.id, { to_email: email })
      toast.success(`Quotation emailed to ${email}`)
      onClose()
    } catch { /* toast shown by interceptor */ }
    finally { setSending(false) }
  }

  const typeLabel = quotation.type === 'proforma' ? 'Proforma Invoice' : 'Quotation'
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>✉️ Email {typeLabel}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding:16 }}>
          <div style={{ fontSize:12, color:'#555', marginBottom:12 }}>
            Sending <strong>{quotation.invoice_no}</strong> to <strong>{quotation.customer_name}</strong>.
          </div>
          <div className="field" style={{ marginBottom:12 }}>
            <label>Recipient Email *</label>
            <input type="email" value={email} onChange={e => setToEmail(e.target.value)}
              placeholder="customer@example.com" autoFocus />
          </div>
        </div>
        <div style={{ padding:'10px 16px', borderTop:'1px solid #e0e0e0', display:'flex', gap:8 }}>
          <button className="btn primary" onClick={send} disabled={sending || !email}>
            {sending ? '⏳ Sending…' : '✉️ Send Email'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

// ── LPO Number Modal ──────────────────────────────────────
function LpoModal({ quotation, onConfirm, onClose }) {
  const [lpoNumber, setLpoNumber] = useState('')
  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h3>🧾 Convert to Tax Invoice</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 16 }}>
          <div style={{ fontSize: 12, color: '#555', marginBottom: 14 }}>
            Converting <strong>{quotation?.invoice_no}</strong> for{' '}
            <strong>{quotation?.customer_name}</strong> to a Tax Invoice.
          </div>
          <div className="field">
            <label>LPO / Purchase Order Number</label>
            <input
              value={lpoNumber}
              onChange={e => setLpoNumber(e.target.value)}
              placeholder="e.g. LPO-2025-001"
              autoFocus
              onKeyDown={e => e.key === 'Enter' && onConfirm(lpoNumber)}
            />
            <div style={{ fontSize: 10, color: '#888', marginTop: 3 }}>
              The customer's LPO reference. Will appear as PO reference on the invoice.
              Leave blank if not yet received.
            </div>
          </div>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #e0e0e0', display: 'flex', gap: 8 }}>
          <button className="btn primary" onClick={() => onConfirm(lpoNumber)}>
            🧾 Create Invoice
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}

export default function QuotationsModule() {
  const qc = useQueryClient()
  const { openModal, getModal } = useUIStore()

  const [filters, setFilters] = useState({ type: 'quotation,proforma', q: '', from: '', to: '' })
  const [pageSize, setPageSize] = useState(50)
  const [page,     setPage]     = useState(1)
  const [selectedId, setSelectedId] = useState(null)
  const [showEmail,  setShowEmail]  = useState(false)
  const [showLpoModal, setShowLpoModal] = useState(false)

  const setFiltersAndReset = (updater) => { setFilters(updater); setPage(1) }
  const setPageSizeAndReset = (n) => { setPageSize(n); setPage(1) }

  const offset = (page - 1) * pageSize

  const { data: resp, isLoading } = useQuery({
    queryKey: ['quotations', filters, pageSize, page],
    queryFn:  () => invoiceApi.list({ ...filters, limit: pageSize, offset }).then(r => r.data),
    keepPreviousData: true,
  })

  const rows       = resp?.data  || []
  const totalRows  = resp?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const convertMut = useMutation({
    mutationFn: ({ id, toType, overrides }) =>
      convertApi.convert({ from_id: id, from_type:'invoice', to_type: toType, overrides }),
    onSuccess: (res, vars) => {
      const label = vars.toType === 'delivery_note' ? 'Delivery Note' : 'Invoice'
      toast.success(`${label} ${res.data.data?.invoice_no || res.data.data?.dn_no} created`)
      qc.invalidateQueries(['quotations'])
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['dns'])
    },
  })

  const handleConvertToDN = () => {
    if (!selectedId) return
    openModal('dn', { from_invoice_id: selectedId })
  }

  const issueMut = useMutation({
    mutationFn: (id) => invoiceApi.issue(id),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['quotations'])
    },
  })

  const sel            = rows.find(r => r.id === selectedId)
  const selIsDraft     = sel?.payment_status === 'draft'
  const selIsConverted = !!sel?.converted_at

  const handleExportCsv = () => {
    const params = { type: filters.type }
    if (filters.from) params.from = filters.from
    if (filters.to)   params.to   = filters.to
    if (filters.q)    params.q    = filters.q
    window.open(invoiceApi.exportCsvUrl(params), '_blank')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Quotations &amp; Proforma Invoices</div>

      <div className="toolbar">
        <button className="btn primary" onClick={() => openModal('invoice', { type:'quotation' })}>＋ New Quotation</button>
        <button className="btn"         onClick={() => openModal('invoice', { type:'proforma'  })}>＋ New Proforma</button>
        <button className="btn" disabled={!selectedId} onClick={() => openModal('invoice', { id: selectedId })}>✏️ Edit</button>
        {selIsDraft && (
          <button className="btn" style={{ background:'#e65100', color:'#fff', borderColor:'#bf360c' }}
            onClick={() => { if (window.confirm(`Issue ${sel.invoice_no}? It will become active.`)) issueMut.mutate(selectedId) }}
            disabled={issueMut.isPending}>
            ⚡ Issue
          </button>
        )}
        <div className="toolbar-sep" />
        <button className="btn teal"
          disabled={!selectedId || selIsDraft || selIsConverted}
          title={selIsConverted ? 'Already converted' : selIsDraft ? 'Issue the document first' : 'Convert to Tax Invoice — you will be prompted for the LPO number'}
          onClick={() => { if (selectedId) setShowLpoModal(true) }}>
          🧾 Convert → Invoice
        </button>
        <button className="btn"
          style={{ background: selIsConverted||selIsDraft ? undefined : '#00695c', color: selIsConverted||selIsDraft ? undefined : '#fff', borderColor: selIsConverted||selIsDraft ? undefined : '#004d40' }}
          disabled={!selectedId || selIsDraft || selIsConverted}
          title={selIsConverted ? 'Already converted' : selIsDraft ? 'Issue the document first' : 'Convert to Delivery Note'}
          onClick={handleConvertToDN}>
          🚚 Convert → DN
        </button>
        <div className="toolbar-sep" />
        <button className="btn" disabled={!selectedId} onClick={() => window.open(invoiceApi.getPdfUrl(selectedId), '_blank')}>📄 PDF</button>
        <button className="btn" disabled={!selectedId} onClick={() => window.open(invoiceApi.getPrintUrl(selectedId), '_blank')}>🖨 Print</button>
        <button className="btn" disabled={!selectedId} onClick={() => setShowEmail(true)}>✉️ Email</button>
        <button className="btn" onClick={handleExportCsv} title="Export current filter to CSV">⬇ Export CSV</button>
        <div className="toolbar-sep" />
        {/* Type filter */}
        <select className="btn" style={{ height:26, cursor:'default' }}
          value={filters.type} onChange={e => setFiltersAndReset(f => ({ ...f, type: e.target.value }))}>
          <option value="quotation,proforma">All Types</option>
          <option value="quotation">Quotation</option>
          <option value="proforma">Proforma</option>
        </select>
        <input type="date" value={filters.from} title="From date"
          onChange={e => setFiltersAndReset(f => ({ ...f, from: e.target.value }))}
          style={{ height:26, fontSize:11, padding:'2px 6px', borderRadius:3, border:'1px solid #ccc' }} />
        <span style={{ fontSize:11, color:'#888' }}>–</span>
        <input type="date" value={filters.to} title="To date"
          onChange={e => setFiltersAndReset(f => ({ ...f, to: e.target.value }))}
          style={{ height:26, fontSize:11, padding:'2px 6px', borderRadius:3, border:'1px solid #ccc' }} />
        {(filters.from || filters.to) && (
          <button className="btn" title="Clear dates"
            onClick={() => setFiltersAndReset(f => ({ ...f, from:'', to:'' }))}>✕</button>
        )}
        <div className="toolbar-search">
          <input type="text" placeholder="Search..." value={filters.q}
            onChange={e => setFiltersAndReset(f => ({ ...f, q: e.target.value }))} />
          <button className="btn">🔍</button>
        </div>
      </div>

      {sel && (
        <div style={{ background:'var(--blue-light)', borderBottom:'1px solid #b0c8f0', padding:'5px 12px', fontSize:12, color:'#1a3a6c', flexShrink:0, display:'flex', alignItems:'center', gap:16 }}>
          Selected: <strong>{sel.invoice_no}</strong> — {sel.customer_name} — BHD {fmtBhd(sel.grand_total)}
          <span style={{ marginLeft:'auto', color:'#888' }}>Double-click to edit · Use Convert buttons to progress this document</span>
        </div>
      )}

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th style={{ width:28 }}><input type="checkbox" /></th>
            <th>Ref No.</th><th>Type</th><th>Date</th><th>Valid Until</th>
            <th>Customer</th><th className="right">Net BHD</th><th className="right">VAT BHD</th>
            <th className="right">Total BHD</th><th>Status</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={10}>Loading...</td></tr>}
            {!isLoading && !rows.length && <tr className="empty-row"><td colSpan={10}>No documents found</td></tr>}
            {rows.map(q => (
              <tr key={q.id} className={selectedId === q.id ? 'selected' : ''}
                onClick={() => setSelectedId(q.id)}
                onDoubleClick={() => openModal('invoice', { id: q.id })}>
                <td><input type="checkbox" checked={selectedId === q.id} onChange={() => setSelectedId(q.id)} /></td>
                <td style={{ color:'var(--blue)', fontWeight:600 }}>
                  {q.invoice_no}
                  <ConversionChips
                    conversions={q.conversions_out}
                    onOpen={(type, id) => type === 'delivery_note' ? openModal('dn', { id }) : openModal('invoice', { id })}
                  />
                </td>
                <td><span style={{ fontSize:11, padding:'1px 6px', background:'#e8e8e8', borderRadius:10 }}>{q.type === 'proforma' ? 'Proforma' : 'Quotation'}</span></td>
                <td>{fmtDate(q.invoice_date)}</td>
                <td><ExpiryBadge validUntil={q.valid_until} /></td>
                <td>{q.customer_name}</td>
                <td className="right">{fmtBhd(q.subtotal)}</td>
                <td className="right">{fmtBhd(q.total_vat)}</td>
                <td className="right" style={{ fontWeight:600 }}>{fmtBhd(q.grand_total)}</td>
                <td>
                  {q.converted_at
                    ? <span style={{ fontSize:11, padding:'1px 8px', background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7', borderRadius:10, fontWeight:700 }}>Converted</span>
                    : q.payment_status === 'void'
                    ? <span style={{ fontSize:11, padding:'1px 8px', background:'#f5f5f5', color:'#888', border:'1px solid #e0e0e0', borderRadius:10, fontWeight:700 }}>Void</span>
                    : q.valid_until && new Date(q.valid_until) < new Date()
                    ? <span style={{ fontSize:11, padding:'1px 8px', background:'#fdecea', color:'#c62828', border:'1px solid #ef9a9a', borderRadius:10, fontWeight:700 }}>Expired</span>
                    : q.payment_status === 'draft'
                    ? <span style={{ fontSize:11, padding:'1px 8px', background:'#fff3e0', color:'#e65100', border:'1px solid #ffcc80', borderRadius:10, fontWeight:700 }}>Draft</span>
                    : <span style={{ fontSize:11, padding:'1px 8px', background:'#e3f2fd', color:'#1565c0', border:'1px solid #90caf9', borderRadius:10, fontWeight:700 }}>Open</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar + pagination */}
      <div className="status-bar" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
        <span style={{ color:'#555' }}>{totalRows.toLocaleString()} documents</span>
        <span>|</span>
        <span>Page total: <strong>BHD {fmtBhd(rows.reduce((s, r) => s + parseFloat(r.grand_total || 0), 0))}</strong></span>
        <span style={{ marginLeft:'auto', color:'#888', fontSize:11 }}>Issue a draft to enable conversion. Converted documents are locked.</span>

        {/* Page size */}
        <span style={{ fontSize:11, color:'#888' }}>Rows:</span>
        {PAGE_SIZES.map(n => (
          <button key={n} onClick={() => setPageSizeAndReset(n)}
            style={{
              padding:'2px 8px', fontSize:11, borderRadius:3, border:'1px solid #ccc',
              background: pageSize === n ? 'var(--blue)' : '#f5f5f5',
              color:      pageSize === n ? '#fff' : '#444',
              cursor:'pointer', fontWeight: pageSize === n ? 700 : 400,
            }}>{n}</button>
        ))}

        {/* Pagination */}
        <button className="btn" style={{ padding:'1px 7px', fontSize:11 }}
          onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
        <span style={{ fontSize:11, fontWeight:600, minWidth:70, textAlign:'center' }}>
          {page} / {totalPages}
        </span>
        <button className="btn" style={{ padding:'1px 7px', fontSize:11 }}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
      </div>

      {getModal('invoice').open && <InvoiceModal />}
      {getModal('dn').open      && <DNModal />}
      {showEmail && sel && <EmailQuotationModal quotation={sel} onClose={() => setShowEmail(false)} />}
      {showLpoModal && sel && (
        <LpoModal
          quotation={sel}
          onConfirm={(lpoNumber) => {
            setShowLpoModal(false)
            convertMut.mutate({
              id: selectedId,
              toType: 'tax_invoice',
              overrides: lpoNumber.trim() ? { po_reference: lpoNumber.trim() } : {},
            })
          }}
          onClose={() => setShowLpoModal(false)}
        />
      )}
    </div>
  )
}
