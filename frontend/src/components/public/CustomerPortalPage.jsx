import { useQuery } from '@tanstack/react-query'
import { portalApi } from '../../services/api'

function fmtBhd(v) { return parseFloat(v || 0).toLocaleString('en-BH', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) }
function fmtDate(v) {
  if (!v) return '—'
  return new Date(v).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

const STATUS_STYLE = {
  paid:       { bg: '#e8f5e9', color: '#2e7d32', label: 'Paid' },
  unpaid:     { bg: '#fff8e1', color: '#e65100', label: 'Unpaid' },
  partial:    { bg: '#e3f2fd', color: '#1565c0', label: 'Partial' },
  overdue:    { bg: '#ffebee', color: '#c62828', label: 'Overdue' },
}

function StatusBadge({ status, dueDate }) {
  const isOverdue = status === 'unpaid' && dueDate && new Date(dueDate) < new Date()
  const s = STATUS_STYLE[isOverdue ? 'overdue' : status] || STATUS_STYLE.unpaid
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
                   background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

export default function CustomerPortalPage({ token }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['portal', token],
    queryFn:  () => portalApi.get(token).then(r => r.data),
    retry: false,
  })

  if (isLoading) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f5f7fa', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ color: '#888', fontSize: 14 }}>Loading your account…</div>
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  background: '#f5f7fa', fontFamily: 'Arial, sans-serif' }}>
      <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, padding: 32,
                    textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🔗</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#c62828', marginBottom: 8 }}>
          Invalid or expired link
        </div>
        <div style={{ fontSize: 13, color: '#888' }}>
          Please contact your supplier for a fresh portal link.
        </div>
      </div>
    </div>
  )

  const { customer, company, invoices, totals } = data
  const brand = (company.theme_color && /^#[0-9a-fA-F]{6}$/.test(company.theme_color))
    ? company.theme_color : '#1a5fa8'

  return (
    <div style={{ minHeight: '100vh', background: '#f5f7fa', fontFamily: 'Arial, sans-serif',
                  fontSize: 13, color: '#1a1a1a' }}>
      {/* Header */}
      <div style={{ background: brand, color: '#fff', padding: '12px 24px',
                    display: 'flex', alignItems: 'center', gap: 16 }}>
        {company.logo && (
          <img src={company.logo} alt="logo"
            style={{ height: 40, maxWidth: 120, objectFit: 'contain',
                     background: '#fff', borderRadius: 3, padding: 3 }} />
        )}
        <div>
          <div style={{ fontWeight: 700, fontSize: 16 }}>{company.name}</div>
          {company.address && <div style={{ fontSize: 11, opacity: 0.85 }}>{company.address}</div>}
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right', fontSize: 11, opacity: 0.85 }}>
          {company.tel && <div>Tel: {company.tel}</div>}
          {company.email && <div>{company.email}</div>}
        </div>
      </div>

      <div style={{ maxWidth: 900, margin: '24px auto', padding: '0 16px' }}>
        {/* Customer banner */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8,
                      padding: '16px 20px', marginBottom: 16 }}>
          <div style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>
            {customer.name}
          </div>
          <div style={{ fontSize: 12, color: '#888' }}>Account Statement Portal</div>
        </div>

        {/* KPI cards */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { label: 'Total Billed',      value: `BHD ${fmtBhd(totals.total_billed)}`,      color: '#555' },
            { label: 'Total Paid',        value: `BHD ${fmtBhd(totals.total_paid)}`,         color: '#2e7d32' },
            { label: 'Outstanding',       value: `BHD ${fmtBhd(totals.total_outstanding)}`,  color: totals.total_outstanding > 0 ? '#c62828' : '#2e7d32' },
          ].map(k => (
            <div key={k.label} style={{ background: '#fff', border: '1px solid #e0e0e0',
                                        borderRadius: 6, padding: '10px 16px', flex: 1, minWidth: 160 }}>
              <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{k.label}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* Bank details */}
        {(company.bank_iban || company.bank_name) && totals.total_outstanding > 0 && (
          <div style={{ background: '#f8f9ff', border: `1px solid ${brand}33`,
                        borderLeft: `4px solid ${brand}`, borderRadius: 6,
                        padding: '10px 16px', marginBottom: 16, fontSize: 12, color: '#555' }}>
            <strong>Bank Transfer Details:</strong>
            {company.bank_name && <span style={{ marginLeft: 12 }}>Bank: {company.bank_name}</span>}
            {company.bank_acct_name && <span style={{ marginLeft: 12 }}>Account: {company.bank_acct_name}</span>}
            {company.bank_iban && <span style={{ marginLeft: 12 }}>IBAN: {company.bank_iban}</span>}
            {company.bank_swift && <span style={{ marginLeft: 12 }}>SWIFT: {company.bank_swift}</span>}
          </div>
        )}

        {/* Invoice table */}
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #e0e0e0',
                        fontWeight: 700, fontSize: 14 }}>
            Invoices
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ background: '#f5f7fa' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Invoice No</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', borderBottom: '1px solid #e0e0e0' }}>Due Date</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Total</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', borderBottom: '1px solid #e0e0e0' }}>Balance Due</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>Status</th>
                  <th style={{ padding: '8px 12px', textAlign: 'center', borderBottom: '1px solid #e0e0e0' }}>PDF</th>
                </tr>
              </thead>
              <tbody>
                {invoices.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', color: '#aaa' }}>
                    No invoices found
                  </td></tr>
                )}
                {invoices.map((inv, i) => (
                  <tr key={inv.id}
                    style={{ background: i % 2 === 0 ? '#fff' : '#fafafa',
                             borderBottom: '1px solid #f0f0f0' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{inv.invoice_no}</td>
                    <td style={{ padding: '8px 12px', color: '#666' }}>{fmtDate(inv.invoice_date)}</td>
                    <td style={{ padding: '8px 12px', color: '#666' }}>{fmtDate(inv.due_date)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right' }}>BHD {fmtBhd(inv.grand_total)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right',
                                 fontWeight: parseFloat(inv.balance_due) > 0 ? 700 : 400,
                                 color: parseFloat(inv.balance_due) > 0 ? '#c62828' : '#2e7d32' }}>
                      {parseFloat(inv.balance_due) > 0 ? `BHD ${fmtBhd(inv.balance_due)}` : '✓ Paid'}
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <StatusBadge status={inv.payment_status} dueDate={inv.due_date} />
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                      <a href={portalApi.getPdfUrl(token, inv.id)} target="_blank" rel="noreferrer"
                        style={{ color: brand, fontWeight: 700, textDecoration: 'none', fontSize: 11 }}>
                        ↓ PDF
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ textAlign: 'center', color: '#bbb', fontSize: 11, marginTop: 20, paddingBottom: 32 }}>
          Powered by ElecTrade · For queries contact {company.email || company.tel || company.name}
        </div>
      </div>
    </div>
  )
}
