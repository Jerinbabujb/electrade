import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { dnApi, invoiceApi } from '../../../services/api'
import { useUIStore } from '../../../store'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

export default function ConsolidateModal() {
  const { closeModal, getModal } = useUIStore()
  const modal = getModal('consolidate')
  const qc    = useQueryClient()

  const preselected = modal.data?.dn_ids || []
  const [selectedDNs, setSelectedDNs] = useState(preselected)
  const [customerId,  setCustomerId]  = useState(modal.data?.customer_id || '')
  const [poRef,       setPoRef]       = useState('')
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0])
  const [dueDate,     setDueDate]     = useState('')
  const [notes,       setNotes]       = useState('')

  // Load pending DNs for selected customer
  const { data: allDns } = useQuery({
    queryKey: ['dns-pending', customerId],
    queryFn:  () => dnApi.list({ status: 'pending_invoice', customer_id: customerId || undefined }).then(r => r.data.data),
  })

  const rows = allDns || []

  const toggleDN = (id) => {
    setSelectedDNs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  const selectedRows = rows.filter(r => selectedDNs.includes(r.id))
  const totalNet = selectedRows.reduce((s, r) => s + parseFloat(r.net_value || 0), 0)
  const totalVat = totalNet * 0.10
  const grandTotal = totalNet + totalVat

  const createMut = useMutation({
    mutationFn: () => invoiceApi.fromDNs({
      dn_ids:       selectedDNs,
      customer_id:  customerId || (selectedRows[0]?.customer_id),
      po_reference: poRef,
      invoice_date: invoiceDate,
      due_date:     dueDate || undefined,
      notes,
    }),
    onSuccess: (res) => {
      toast.success(`Invoice ${res.data.data.invoice.invoice_no} created from ${res.data.data.dn_count} DNs`)
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['dns'])
      closeModal('consolidate')
    },
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal('consolidate')}>
      <div className="modal">
        <div className="modal-header teal">
          <h3>🔗 Consolidate Delivery Notes → Tax Invoice</h3>
          <button className="close-btn" onClick={() => closeModal('consolidate')}>✕</button>
        </div>

        <div className="modal-toolbar">
          <button className="btn teal"
            disabled={selectedDNs.length === 0 || createMut.isPending}
            onClick={() => createMut.mutate()}>
            {createMut.isPending ? '⏳ Creating...' : `✅ Create Invoice from ${selectedDNs.length} Selected DN(s)`}
          </button>
          <button className="btn" onClick={() => closeModal('consolidate')}>✕ Cancel</button>
        </div>

        <div className="modal-body" style={{ padding: 12 }}>
          <div className="field-row" style={{ marginBottom: 10 }}>
            <div className="field">
              <label>Client PO Number *</label>
              <input value={poRef} onChange={e => setPoRef(e.target.value)}
                placeholder="Enter client PO reference number" autoFocus />
            </div>
            <div className="field">
              <label>Invoice Date</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Due Date</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Notes</label>
              <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional invoice notes" />
            </div>
          </div>

          {!poRef && (
            <div className="alert-banner" style={{ marginBottom: 8 }}>
              ⚠️ Please enter the client's PO number before creating the invoice.
            </div>
          )}

          <div style={{ fontSize:12, fontWeight:700, color:'#333', marginBottom:6, textTransform:'uppercase', letterSpacing:'.3px' }}>
            Select Delivery Notes to include in this invoice:
          </div>

          <table className="data-table" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ width:30 }}>
                  <input type="checkbox"
                    checked={selectedDNs.length === rows.length && rows.length > 0}
                    onChange={e => setSelectedDNs(e.target.checked ? rows.map(r => r.id) : [])} />
                </th>
                <th>DN No.</th><th>Date</th><th>Customer</th>
                <th>Project / Ref</th><th className="right">Items</th><th className="right">Net Value BHD</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr className="empty-row"><td colSpan={7}>No pending delivery notes found</td></tr>
              )}
              {rows.map(dn => (
                <tr key={dn.id}
                  className={selectedDNs.includes(dn.id) ? 'selected' : ''}
                  onClick={() => toggleDN(dn.id)}
                  style={{ background: selectedDNs.includes(dn.id) ? '#f1f8e9' : undefined }}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedDNs.includes(dn.id)} onChange={() => toggleDN(dn.id)} />
                  </td>
                  <td style={{ color:'var(--teal)', fontWeight:600 }}>{dn.dn_no}</td>
                  <td>{fmtDate(dn.dn_date)}</td>
                  <td>{dn.customer_name}</td>
                  <td style={{ color:'var(--gray-dark)', fontStyle:'italic' }}>{dn.project_ref || '—'}</td>
                  <td className="right">{dn.item_count}</td>
                  <td className="right" style={{ fontWeight:600 }}>{fmtBhd(dn.net_value)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ background:'#f5f5f5', fontWeight:700 }}>
                <td colSpan={5} style={{ padding:'5px 9px', borderTop:'2px solid #bbb' }}>
                  Total ({selectedDNs.length} DNs selected)
                </td>
                <td></td>
                <td className="right" style={{ padding:'5px 9px', borderTop:'2px solid #bbb', color:'var(--blue)' }}>
                  BHD {fmtBhd(totalNet)}
                </td>
              </tr>
              <tr style={{ background:'#fff3e0' }}>
                <td colSpan={6} style={{ padding:'4px 9px', fontSize:12 }}>+ VAT 10%</td>
                <td className="right" style={{ padding:'4px 9px', fontWeight:700 }}>BHD {fmtBhd(totalVat)}</td>
              </tr>
              <tr style={{ background:'var(--blue-light)' }}>
                <td colSpan={6} style={{ padding:'5px 9px', fontWeight:700, fontSize:13, color:'var(--blue)' }}>INVOICE TOTAL</td>
                <td className="right" style={{ padding:'5px 9px', fontWeight:700, fontSize:14, color:'var(--blue)' }}>
                  BHD {fmtBhd(grandTotal)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  )
}
