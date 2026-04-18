import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invoiceApi } from '../../../services/api'
import { useUIStore } from '../../../store'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

export default function BulkPaymentModal() {
  const { closeModal, getModal } = useUIStore()
  const modal    = getModal('bulkPayment')
  const invoices = modal.data?.invoices || []   // array of invoice row objects
  const qc       = useQueryClient()

  const [form, setForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    method:       'bank_transfer',
    reference_no: '',
    notes:        '',
  })
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  // Per-invoice amounts — initialised to each invoice's balance_due
  const [amounts, setAmounts] = useState(() =>
    Object.fromEntries(invoices.map(inv => [inv.id, fmtBhd(inv.balance_due || 0)]))
  )

  const payable = invoices.filter(inv => parseFloat(inv.balance_due || 0) > 0)
  const totalAllocated = payable.reduce((s, inv) => s + (parseFloat(amounts[inv.id]) || 0), 0)

  const saveMut = useMutation({
    mutationFn: () => invoiceApi.bulkPayment({
      ...form,
      payments: payable
        .map(inv => ({ invoice_id: inv.id, amount: parseFloat(amounts[inv.id]) || 0 }))
        .filter(p => p.amount > 0),
    }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Payments recorded')
      qc.invalidateQueries(['invoices'])
      closeModal('bulkPayment')
    },
  })

  const canSave = payable.some(inv => parseFloat(amounts[inv.id]) > 0) && !saveMut.isPending

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && closeModal('bulkPayment')}>
      <div className="modal" style={{ width: 620, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div className="modal-header">
          <h3>💳 Bulk Payment — {payable.length} Invoice{payable.length !== 1 ? 's' : ''}</h3>
          <button className="close-btn" onClick={() => closeModal('bulkPayment')}>✕</button>
        </div>

        <div className="modal-body" style={{ padding: 12, overflowY: 'auto', flex: 1 }}>

          {/* Payment metadata */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
            <div className="field">
              <label>Payment Date *</label>
              <input type="date" value={form.payment_date} onChange={e => F('payment_date', e.target.value)} />
            </div>
            <div className="field">
              <label>Method</label>
              <select value={form.method} onChange={e => F('method', e.target.value)}>
                <option value="bank_transfer">Bank Transfer</option>
                <option value="cash">Cash</option>
                <option value="cheque">Cheque</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="field">
              <label>Reference No.</label>
              <input value={form.reference_no} onChange={e => F('reference_no', e.target.value)}
                placeholder="Bank ref / cheque no." />
            </div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Notes</label>
            <input value={form.notes} onChange={e => F('notes', e.target.value)} placeholder="Optional notes applied to all payments" />
          </div>

          {/* Invoice allocation table */}
          <div style={{ fontSize: 12, fontWeight: 700, color: '#333', marginBottom: 6 }}>
            Allocate Amounts
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ background: '#e4e8ee' }}>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Invoice</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Customer</th>
                <th style={{ padding: '5px 8px', textAlign: 'left' }}>Date</th>
                <th style={{ padding: '5px 8px', textAlign: 'right' }}>Total BHD</th>
                <th style={{ padding: '5px 8px', textAlign: 'right' }}>Balance BHD</th>
                <th style={{ padding: '5px 8px', textAlign: 'right', width: 120 }}>Pay BHD</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => {
                const balance = parseFloat(inv.balance_due || 0)
                const alreadyPaid = balance <= 0
                return (
                  <tr key={inv.id} style={{ borderBottom: '1px solid #f0f0f0', background: alreadyPaid ? '#f9f9f9' : (i % 2 ? '#fafafa' : '#fff') }}>
                    <td style={{ padding: '4px 8px', color: 'var(--blue)', fontWeight: 600 }}>{inv.invoice_no}</td>
                    <td style={{ padding: '4px 8px' }}>{inv.customer_name}</td>
                    <td style={{ padding: '4px 8px', color: '#666' }}>{fmtDate(inv.invoice_date)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right' }}>{fmtBhd(inv.grand_total)}</td>
                    <td style={{ padding: '4px 8px', textAlign: 'right', color: alreadyPaid ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                      {alreadyPaid ? '—' : fmtBhd(balance)}
                    </td>
                    <td style={{ padding: '2px 8px', textAlign: 'right' }}>
                      {alreadyPaid ? (
                        <span style={{ color: '#aaa', fontSize: 11 }}>Fully paid</span>
                      ) : (
                        <input
                          type="number" step="0.001" min="0" max={balance}
                          value={amounts[inv.id] ?? ''}
                          onChange={e => setAmounts(a => ({ ...a, [inv.id]: e.target.value }))}
                          style={{ width: 90, textAlign: 'right', fontSize: 12, padding: '2px 5px',
                                   borderRadius: 3, border: '1px solid #ccc' }}
                        />
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Totals summary */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 24, marginTop: 12,
                        padding: '10px 12px', background: '#f0f4fa', borderRadius: 3,
                        border: '1px solid #b0c8f0', fontSize: 13 }}>
            <span style={{ color: '#555' }}>
              Total Outstanding: <strong style={{ color: '#c62828' }}>
                BHD {fmtBhd(payable.reduce((s, inv) => s + parseFloat(inv.balance_due || 0), 0))}
              </strong>
            </span>
            <span style={{ color: '#555' }}>
              Total Allocating: <strong style={{ color: totalAllocated > 0 ? '#2e7d32' : '#888' }}>
                BHD {fmtBhd(totalAllocated)}
              </strong>
            </span>
          </div>

        </div>

        <div className="modal-footer" style={{ padding: '10px 12px', borderTop: '1px solid #e0e0e0', display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button className="btn" onClick={() => closeModal('bulkPayment')}>Cancel</button>
          <button className="btn primary" style={{ minWidth: 160 }}
            onClick={() => saveMut.mutate()} disabled={!canSave}>
            {saveMut.isPending ? '⏳ Recording…' : `✓ Record ${payable.filter(inv => parseFloat(amounts[inv.id]) > 0).length} Payment(s)`}
          </button>
        </div>
      </div>
    </div>
  )
}
