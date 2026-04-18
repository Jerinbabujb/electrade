import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../../../services/api'
import CustomerTypeahead from '../shared/CustomerTypeahead'
import { fmtBhd, fmtDate } from '../../../utils/format'

const TXN_LABELS = {
  invoice:     { label: 'Invoice',      color: 'var(--blue)', bg: 'var(--blue-light)' },
  credit_note: { label: 'Credit Note',  color: '#6a1b9a', bg: '#f3e5f5' },
  payment:     { label: 'Payment',      color: '#2e7d32', bg: '#e8f5e9' },
}

const METHOD_LABELS = {
  cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', card: 'Card', other: 'Other',
}

export default function StatementOfAccounts({ preselectedCustomerId = '' }) {
  const today   = new Date().toISOString().split('T')[0]
  const firstOfYear = `${new Date().getFullYear()}-01-01`

  const [customerId,   setCustomerId]   = useState(preselectedCustomerId)
  const [customerName, setCustomerName] = useState('')
  const [from,       setFrom]       = useState(firstOfYear)
  const [to,         setTo]         = useState(today)
  const [runParams,  setRunParams]  = useState(null)
  const printRef = useRef()


  const { data, isFetching, error } = useQuery({
    queryKey: ['statement', runParams],
    queryFn:  () => reportApi.statement(runParams).then(r => r.data.data),
    enabled:  !!runParams,
  })

  const handleRun = () => {
    if (!customerId) return
    setRunParams({ customer_id: customerId, from, to })
  }

  const handlePrint = () => {
    const printContent = printRef.current.innerHTML
    const w = window.open('', '_blank')
    w.document.write(`<!DOCTYPE html><html><head>
      <title>Statement of Accounts</title>
      <style>
        * { margin:0; padding:0; box-sizing:border-box; }
        body { font-family: Arial, sans-serif; font-size: 11pt; color: #222; padding: 20px; }
        .header { display:flex; justify-content:space-between; margin-bottom:16px; border-bottom:2px solid var(--blue); padding-bottom:10px; }
        .co-name { font-size:15pt; font-weight:bold; color:var(--blue); }
        .co-sub  { font-size:9pt; color:#666; margin-top:2px; }
        .title-block { text-align:right; }
        .title-block .doc-title { font-size:14pt; font-weight:bold; color:#333; }
        .meta { display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-bottom:14px; }
        .meta-box { background:#f8f8f8; border:1px solid #ddd; border-radius:3px; padding:8px 12px; }
        .meta-box h4 { font-size:9pt; color:#888; font-weight:600; margin-bottom:4px; text-transform:uppercase; letter-spacing:0.5px; }
        .meta-box p  { font-size:10pt; margin:1px 0; }
        table { width:100%; border-collapse:collapse; font-size:10pt; }
        thead tr { background:var(--blue); color:#fff; }
        th { padding:6px 8px; text-align:left; font-weight:600; }
        th.r, td.r { text-align:right; }
        td { padding:5px 8px; border-bottom:1px solid #eee; }
        tr:nth-child(even) td { background:#f9f9f9; }
        .ob-row td { background:#fff8e1 !important; font-style:italic; color:#5d4037; }
        .badge { display:inline-block; padding:1px 7px; border-radius:10px; font-size:9pt; }
        .tfoot td { font-weight:700; border-top:2px solid var(--blue); background:#fff !important; }
        .balance-neg { color:#c62828; }
        .balance-pos { color:#2e7d32; }
        .footer { margin-top:16px; padding-top:8px; border-top:1px solid #ddd; font-size:8pt; color:#888; text-align:center; }
        @media print { body { padding:0; } }
      </style>
    </head><body>${printContent}</body></html>`)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 300)
  }

  return (
    <div>
      {/* ── Filter bar ── */}
      <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:16, flexWrap:'wrap' }}>
        <div className="field" style={{ margin:0, minWidth:240 }}>
          <label>Customer</label>
          <CustomerTypeahead
            value={customerId}
            displayName={customerName}
            onChange={c => { setCustomerId(c.id); setCustomerName(c.name) }}
            onClear={() => { setCustomerId(''); setCustomerName('') }}
            placeholder="Search customer..."
            allowCreate={false}
          />
        </div>
        <div className="field" style={{ margin:0 }}>
          <label>From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width:140 }} />
        </div>
        <div className="field" style={{ margin:0 }}>
          <label>To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width:140 }} />
        </div>
        <button className="btn primary" onClick={handleRun} disabled={!customerId || isFetching}>
          {isFetching ? '⏳ Loading...' : 'Generate Statement'}
        </button>
        {data && (
          <button className="btn" onClick={handlePrint} style={{ marginLeft:'auto' }}>
            🖨 Print / PDF
          </button>
        )}
      </div>

      {error && (
        <div style={{ color:'#c62828', fontSize:13, padding:'8px 12px', background:'#fbe9e7', borderRadius:3 }}>
          {error.response?.data?.error?.message || 'Failed to load statement'}
        </div>
      )}

      {data && (
        <div ref={printRef}>
          {/* ── Letterhead ── */}
          <div className="header" style={{ display:'flex', justifyContent:'space-between', borderBottom:'2px solid var(--blue)', paddingBottom:10, marginBottom:14 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:'var(--blue)' }}>{data.company.name}</div>
              {data.company.name_ar && <div style={{ fontSize:12, color:'#555', direction:'rtl' }}>{data.company.name_ar}</div>}
              <div style={{ fontSize:11, color:'#666', marginTop:3 }}>
                {[data.company.address, data.company.tel, data.company.email].filter(Boolean).join(' | ')}
              </div>
              <div style={{ fontSize:11, color:'#666' }}>
                {data.company.vat_number && `VAT Reg: ${data.company.vat_number}`}
                {data.company.cr_number  && ` | CR: ${data.company.cr_number}`}
              </div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontSize:16, fontWeight:700, color:'#333' }}>STATEMENT OF ACCOUNT</div>
              <div style={{ fontSize:12, color:'#666', marginTop:4 }}>
                Period: {fmtDate(data.period.from)} – {fmtDate(data.period.to)}
              </div>
              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                Printed: {fmtDate(new Date().toISOString())}
              </div>
            </div>
          </div>

          {/* ── Customer details ── */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:14 }}>
            <div style={{ background:'#f8f8f8', border:'1px solid #e0e0e0', borderRadius:3, padding:'8px 12px' }}>
              <div style={{ fontSize:10, color:'#888', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:4 }}>Bill To</div>
              <div style={{ fontWeight:700, fontSize:13 }}>{data.customer.name}</div>
              <div style={{ fontSize:12, color:'#555' }}>Code: {data.customer.code}</div>
              {data.customer.address   && <div style={{ fontSize:11, color:'#555' }}>{data.customer.address}</div>}
              {data.customer.tel       && <div style={{ fontSize:11, color:'#555' }}>Tel: {data.customer.tel}</div>}
              {data.customer.email     && <div style={{ fontSize:11, color:'#555' }}>{data.customer.email}</div>}
              {data.customer.vat_number && <div style={{ fontSize:11, color:'#555' }}>VAT: {data.customer.vat_number}</div>}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {[
                ['Opening Balance',  fmtBhd(data.opening_balance),  data.opening_balance > 0 ? '#c62828' : data.opening_balance < 0 ? '#2e7d32' : '#333'],
                ['Total Invoiced',   fmtBhd(data.totals.debit),     'var(--blue)'],
                ['Total Received',   fmtBhd(data.totals.credit),    '#2e7d32'],
                ['Closing Balance',  fmtBhd(data.closing_balance),  data.closing_balance > 0 ? '#c62828' : data.closing_balance < 0 ? '#2e7d32' : '#333'],
              ].map(([label, value, color]) => (
                <div key={label} style={{ background:'#f8f8f8', border:'1px solid #e0e0e0', borderRadius:3, padding:'8px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:9, color:'#888', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:2 }}>{label}</div>
                  <div style={{ fontSize:14, fontWeight:700, color }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* ── Transactions table ── */}
          <table className="data-table" style={{ fontSize:12 }}>
            <thead>
              <tr>
                <th style={{ width:90 }}>Date</th>
                <th style={{ width:100 }}>Type</th>
                <th>Reference</th>
                <th>Method / Doc</th>
                <th style={{ width:110, textAlign:'right' }}>Debit (BHD)</th>
                <th style={{ width:110, textAlign:'right' }}>Credit (BHD)</th>
                <th style={{ width:120, textAlign:'right' }}>Balance (BHD)</th>
              </tr>
            </thead>
            <tbody>
              {/* Opening balance row */}
              <tr style={{ background:'#fff8e1', fontStyle:'italic' }}>
                <td style={{ color:'#5d4037' }}>{fmtDate(data.period.from)}</td>
                <td colSpan={3} style={{ color:'#5d4037' }}>Opening Balance</td>
                <td className="r" style={{ color:'#5d4037' }}>—</td>
                <td className="r" style={{ color:'#5d4037' }}>—</td>
                <td className="r" style={{ fontWeight:700, color: data.opening_balance > 0 ? '#c62828' : data.opening_balance < 0 ? '#2e7d32' : '#333' }}>
                  {fmtBhd(data.opening_balance)}
                </td>
              </tr>

              {data.rows.length === 0 && (
                <tr><td colSpan={7} style={{ textAlign:'center', color:'#aaa', padding:'20px 0' }}>No transactions in this period</td></tr>
              )}

              {data.rows.map((r, i) => {
                const meta = TXN_LABELS[r.txn_type] || TXN_LABELS.invoice
                return (
                  <tr key={i}>
                    <td>{fmtDate(r.txn_date)}</td>
                    <td>
                      <span style={{ padding:'1px 7px', borderRadius:10, fontSize:10, background:meta.bg, color:meta.color, fontWeight:600 }}>
                        {meta.label}
                      </span>
                    </td>
                    <td style={{ fontFamily:'monospace', fontSize:11 }}>{r.ref_no}</td>
                    <td style={{ color:'#555', fontSize:11 }}>
                      {r.txn_type === 'payment'
                        ? (METHOD_LABELS[r.doc_type] || r.doc_type)
                        : (r.doc_type === 'tax_invoice' ? 'Tax Invoice' : r.doc_type === 'credit_note' ? 'Credit Note' : r.doc_type)}
                      {r.notes && <span style={{ color:'#aaa', marginLeft:6 }}>— {r.notes}</span>}
                    </td>
                    <td style={{ textAlign:'right', color: parseFloat(r.debit)  > 0 ? '#c62828' : '#bbb' }}>
                      {parseFloat(r.debit)  > 0 ? fmtBhd(r.debit)  : '—'}
                    </td>
                    <td style={{ textAlign:'right', color: parseFloat(r.credit) > 0 ? '#2e7d32' : '#bbb' }}>
                      {parseFloat(r.credit) > 0 ? fmtBhd(r.credit) : '—'}
                    </td>
                    <td style={{ textAlign:'right', fontWeight:600, color: r.balance > 0 ? '#c62828' : r.balance < 0 ? '#2e7d32' : '#333' }}>
                      {fmtBhd(r.balance)}
                    </td>
                  </tr>
                )
              })}

              {/* Closing balance row */}
              <tr style={{ borderTop:'2px solid var(--blue)', background:'var(--blue-light)' }}>
                <td colSpan={4} style={{ fontWeight:700, color:'var(--blue)', fontSize:12 }}>Closing Balance — {fmtDate(data.period.to)}</td>
                <td style={{ textAlign:'right', fontWeight:700 }}>{fmtBhd(data.totals.debit)}</td>
                <td style={{ textAlign:'right', fontWeight:700 }}>{fmtBhd(data.totals.credit)}</td>
                <td style={{ textAlign:'right', fontWeight:800, fontSize:13, color: data.closing_balance > 0 ? '#c62828' : data.closing_balance < 0 ? '#2e7d32' : '#333' }}>
                  {fmtBhd(data.closing_balance)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Balance legend */}
          <div style={{ marginTop:8, fontSize:11, color:'#888' }}>
            <span style={{ color:'#c62828', marginRight:12 }}>▲ Red balance = amount owed to us</span>
            <span style={{ color:'#2e7d32' }}>▼ Green balance = credit in customer's favour</span>
          </div>

          {/* Bank details for payment */}
          {(data.company.bank_iban || data.company.bank_name) && (
            <div style={{ marginTop:14, padding:'8px 12px', background:'#f5f5f5', border:'1px solid #e0e0e0', borderRadius:3, fontSize:11 }}>
              <div style={{ fontWeight:700, marginBottom:4 }}>Payment Details:</div>
              <div style={{ display:'flex', gap:24, flexWrap:'wrap' }}>
                {data.company.bank_name     && <span><strong>Bank:</strong> {data.company.bank_name}</span>}
                {data.company.bank_acct_name && <span><strong>Account:</strong> {data.company.bank_acct_name}</span>}
                {data.company.bank_iban      && <span><strong>IBAN:</strong> {data.company.bank_iban}</span>}
                {data.company.bank_swift     && <span><strong>SWIFT:</strong> {data.company.bank_swift}</span>}
              </div>
            </div>
          )}

          <div style={{ marginTop:12, fontSize:10, color:'#aaa', textAlign:'center', borderTop:'1px solid #eee', paddingTop:8 }}>
            This statement is computer generated and does not require a signature.
            Please contact us if you have any queries regarding this statement.
          </div>
        </div>
      )}
    </div>
  )
}
