import { useState, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { invoiceApi } from '../../../services/api'
import { useUIStore } from '../../../store'
import { fmtBhd, fmtDate } from '../../../utils/format'
import InvoiceModal     from './InvoiceModal'
import ConsolidateModal from './ConsolidateModal'
import PaymentModal     from './PaymentModal'
import BulkPaymentModal from './BulkPaymentModal'
import toast from 'react-hot-toast'

const PAGE_SIZES = [25, 50, 100, 500]

export default function InvoicesModule() {
  const { openModal, getModal, closeModal, moduleParams, clearModuleParams } = useUIStore()
  const qc = useQueryClient()

  const [filters, setFilters] = useState(() => ({
    status: '', type: 'tax_invoice,credit_note', q: '',
    from: moduleParams?.from || '',
    to:   moduleParams?.to   || '',
  }))

  useEffect(() => {
    if (moduleParams?.from || moduleParams?.to) clearModuleParams()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const [pageSize, setPageSize] = useState(50)
  const [page,     setPage]     = useState(1)
  const [selectedIds, setSelectedIds] = useState([])

  // Reset to page 1 whenever filters or page size change
  const setFiltersAndReset = (updater) => { setFilters(updater); setPage(1) }
  const setPageSizeAndReset = (n) => { setPageSize(n); setPage(1) }

  const offset = (page - 1) * pageSize

  const { data: resp, isLoading } = useQuery({
    queryKey: ['invoices', filters, pageSize, page],
    queryFn:  () => invoiceApi.list({ ...filters, limit: pageSize, offset }).then(r => r.data),
    keepPreviousData: true,
  })

  const voidMut = useMutation({
    mutationFn: (id) => invoiceApi.void(id),
    onSuccess:  () => { toast.success('Invoice voided'); qc.invalidateQueries(['invoices']) },
  })

  const cloneMut = useMutation({
    mutationFn: (id) => invoiceApi.clone(id),
    onSuccess: (res) => {
      const newId = res.data.data?.id
      toast.success('Invoice cloned as draft')
      qc.invalidateQueries(['invoices'])
      if (newId) openModal('invoice', { id: newId })
    },
  })

  const reminderMut = useMutation({
    mutationFn: async (ids) => {
      const results = await Promise.allSettled(ids.map(id => invoiceApi.sendReminder(id)))
      const sent = results.filter(r => r.status === 'fulfilled').length
      return sent
    },
    onSuccess: (sent) => {
      toast.success(`Reminder sent for ${sent} invoice(s)`)
      setSelectedIds([])
    },
  })

  // Ctrl+N / Cmd+N → new invoice
  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
      e.preventDefault()
      openModal('invoice', {})
    }
  }, [openModal])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  const rows      = resp?.data  || []

  const overdueSelected = rows.filter(r =>
    selectedIds.includes(r.id) && ['unpaid', 'partial', 'overdue'].includes(r.payment_status) && r.due_date && new Date(r.due_date) < new Date()
  )
  const totalRows = resp?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize))

  const totals = {
    total:   rows.reduce((s, r) => s + parseFloat(r.grand_total || 0), 0),
    balance: rows.reduce((s, r) => s + parseFloat(r.balance_due || 0), 0),
    vat:     rows.reduce((s, r) => s + parseFloat(r.total_vat   || 0), 0),
  }

  // Selection helpers
  const primaryId    = selectedIds.length === 1 ? selectedIds[0] : null
  const allSelected  = rows.length > 0 && rows.every(r => selectedIds.includes(r.id))

  const toggleRow    = (id) => setSelectedIds(p => p.includes(id) ? p.filter(x => x !== id) : [...p, id])
  const toggleAll    = ()   => setSelectedIds(allSelected ? [] : rows.map(r => r.id))
  const selectOnly   = (id) => setSelectedIds([id])

  const bulkInvoices = selectedIds.length >= 2
    ? rows.filter(r => selectedIds.includes(r.id) && ['unpaid','partial','overdue'].includes(r.payment_status))
    : []

  // CSV export — build URL with current filters and open
  const handleExportCsv = () => {
    const params = {}
    if (filters.status) params.status = filters.status
    if (filters.type)   params.type   = filters.type
    if (filters.from)   params.from   = filters.from
    if (filters.to)     params.to     = filters.to
    if (filters.q)      params.q      = filters.q
    window.open(invoiceApi.exportCsvUrl(params), '_blank')
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Sales — Tax Invoices</div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="btn primary" onClick={() => openModal('invoice', {})}>
          <span className="btn-icon">＋</span> New Invoice
        </button>
        <button className="btn teal" onClick={() => openModal('consolidate', {})}>
          <span className="btn-icon">🔗</span> Consolidate DNs
        </button>
        <button className="btn" onClick={() => primaryId && openModal('invoice', { id: primaryId })}
          disabled={!primaryId}>
          <span className="btn-icon">✏️</span> Edit
        </button>
        <button className="btn" onClick={() => primaryId && window.open(invoiceApi.getPdfUrl(primaryId), '_blank')}
          disabled={!primaryId}>
          <span className="btn-icon">📄</span> PDF
        </button>
        <button className="btn" onClick={() => primaryId && window.open(invoiceApi.getPrintUrl(primaryId), '_blank')}
          disabled={!primaryId}>
          <span className="btn-icon">🖨</span> Print
        </button>
        <button className="btn" onClick={() => primaryId && openModal('payment', { invoiceId: primaryId })}
          disabled={!primaryId}>
          <span className="btn-icon">💳</span> Payment
        </button>
        <button className="btn teal"
          onClick={() => openModal('bulkPayment', { invoices: rows.filter(r => selectedIds.includes(r.id)) })}
          disabled={bulkInvoices.length < 2}
          title={bulkInvoices.length < 2 ? 'Select 2+ unpaid invoices' : `Pay ${bulkInvoices.length} invoices`}>
          <span className="btn-icon">💳</span> Bulk Pay ({selectedIds.length})
        </button>
        <button className="btn"
          onClick={() => primaryId && cloneMut.mutate(primaryId)}
          disabled={!primaryId || cloneMut.isPending}
          title="Clone invoice as new draft">
          <span className="btn-icon">📋</span> Clone
        </button>
        <button className="btn danger"
          onClick={() => { if (primaryId && window.confirm('Void this invoice?')) voidMut.mutate(primaryId) }}
          disabled={!primaryId}>
          <span className="btn-icon">🗑</span> Void
        </button>
        <button className="btn"
          onClick={() => overdueSelected.length > 0 && window.confirm(`Send overdue reminders to ${overdueSelected.length} customer(s)?`) && reminderMut.mutate(overdueSelected.map(r => r.id))}
          disabled={overdueSelected.length === 0 || reminderMut.isPending}
          title={overdueSelected.length === 0 ? 'Select overdue invoices to send reminders' : `Send reminders for ${overdueSelected.length} overdue invoice(s)`}>
          <span className="btn-icon">🔔</span> Remind ({overdueSelected.length})
        </button>
        <button className="btn" onClick={handleExportCsv} title="Export current filter to CSV">
          <span className="btn-icon">⬇</span> Export CSV
        </button>
        <div className="toolbar-sep" />
        <select className="btn" style={{ height:26, cursor:'default' }}
          value={filters.type} onChange={e => setFiltersAndReset(f => ({ ...f, type: e.target.value }))}>
          <option value="tax_invoice,credit_note">All Invoices</option>
          <option value="tax_invoice">Tax Invoice</option>
          <option value="credit_note">Credit Note</option>
        </select>
        <select className="btn" style={{ height:26, cursor:'default' }}
          value={filters.status} onChange={e => setFiltersAndReset(f => ({ ...f, status: e.target.value }))}>
          <option value="">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="paid">Paid</option>
          <option value="overdue">Overdue</option>
          <option value="partial">Partial</option>
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
          <input type="text" placeholder="Search invoices..." value={filters.q}
            onChange={e => setFiltersAndReset(f => ({ ...f, q: e.target.value }))} />
          <button className="btn">🔍</button>
        </div>
      </div>

      {/* Grid */}
      <div className="grid-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width:30 }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
              </th>
              <th>Invoice No.</th><th>Date</th><th>Due Date</th>
              <th>Customer</th><th>Linked DNs</th>
              <th className="right">Net BHD</th><th className="right">VAT BHD</th>
              <th className="right">Total BHD</th><th>Status</th><th className="right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={11}>Loading...</td></tr>}
            {!isLoading && rows.length === 0 && <tr className="empty-row"><td colSpan={11}>No invoices found</td></tr>}
            {rows.map(inv => (
              <tr key={inv.id}
                className={selectedIds.includes(inv.id) ? 'selected' : ''}
                onClick={() => selectOnly(inv.id)}
                onDoubleClick={() => openModal('invoice', { id: inv.id })}
              >
                <td onClick={e => { e.stopPropagation(); toggleRow(inv.id) }}>
                  <input type="checkbox" checked={selectedIds.includes(inv.id)} onChange={() => toggleRow(inv.id)} />
                </td>
                <td style={{ color:'var(--blue)', fontWeight:600 }}>{inv.invoice_no}</td>
                <td>{fmtDate(inv.invoice_date)}</td>
                <td style={{ color: inv.payment_status === 'overdue' ? 'var(--red)' : undefined }}>
                  {fmtDate(inv.due_date) || '—'}
                </td>
                <td>{inv.customer_name}</td>
                <td>
                  {(inv.linked_dns || []).filter(Boolean).map(dn => (
                    <span key={dn} className="dn-chip">{dn}</span>
                  ))}
                  {(!inv.linked_dns || inv.linked_dns.filter(Boolean).length === 0) && '—'}
                </td>
                <td className="right">{fmtBhd(inv.subtotal)}</td>
                <td className="right">{fmtBhd(inv.total_vat)}</td>
                <td className="right" style={{ fontWeight:600 }}>{fmtBhd(inv.grand_total)}</td>
                <td>
                  {inv.write_off_date
                    ? <span className="badge" style={{ background:'#fdecea', color:'#b71c1c', border:'1px solid #ef9a9a' }}>written off</span>
                    : <span className={`badge badge-${inv.payment_status}`}>{inv.payment_status}</span>
                  }
                </td>
                <td className="right">
                  {parseFloat(inv.balance_due) > 0
                    ? <span style={{ color:'var(--red)', fontWeight:600 }}>{fmtBhd(inv.balance_due)}</span>
                    : <span style={{ color:'var(--green)' }}>—</span>
                  }
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Status bar + pagination */}
      <div className="status-bar" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>

        {/* Totals */}
        <span style={{ color:'#555' }}>{totalRows.toLocaleString()} invoices</span>
        {selectedIds.length > 0 && <span style={{ color:'var(--blue)' }}>| {selectedIds.length} selected</span>}
        <span>|</span>
        <span>Page total: <strong>{fmtBhd(totals.total)} BHD</strong></span>
        <span>|</span>
        <span>Outstanding: <strong style={{ color:'var(--red)' }}>{fmtBhd(totals.balance)} BHD</strong></span>
        <span>|</span>
        <span>VAT: <strong>{fmtBhd(totals.vat)} BHD</strong></span>

        {/* Spacer */}
        <div style={{ flex:1 }} />

        {/* Page size */}
        <span style={{ fontSize:11, color:'#888' }}>Rows:</span>
        {PAGE_SIZES.map(n => (
          <button key={n}
            onClick={() => setPageSizeAndReset(n)}
            style={{
              padding:'2px 8px', fontSize:11, borderRadius:3, border:'1px solid #ccc',
              background: pageSize === n ? 'var(--blue)' : '#f5f5f5',
              color:      pageSize === n ? '#fff' : '#444',
              cursor:'pointer', fontWeight: pageSize === n ? 700 : 400,
            }}>
            {n}
          </button>
        ))}

        {/* Pagination controls */}
        <span style={{ fontSize:11, color:'#666', marginLeft:4 }}>
          Page
        </span>
        <button className="btn" style={{ padding:'1px 7px', fontSize:11 }}
          onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>‹</button>
        <span style={{ fontSize:11, fontWeight:600, minWidth:70, textAlign:'center' }}>
          {page} / {totalPages}
        </span>
        <button className="btn" style={{ padding:'1px 7px', fontSize:11 }}
          onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>›</button>
      </div>

      {/* Modals */}
      {getModal('invoice').open      && <InvoiceModal />}
      {getModal('consolidate').open  && <ConsolidateModal />}
      {getModal('payment').open      && <PaymentModal />}
      {getModal('bulkPayment').open  && <BulkPaymentModal />}
    </div>
  )
}
