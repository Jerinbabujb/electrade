import { useQuery } from '@tanstack/react-query'
import api from '../../../services/api'

const MONTH_NAMES = ['','January','February','March','April','May','June',
                     'July','August','September','October','November','December']

function fmtBhd(v) {
  const n = parseFloat(v || 0)
  return isNaN(n) ? '0.000' : n.toFixed(3)
}

function Row({ label, value, bold, color }) {
  return (
    <tr>
      <td style={{ padding:'4px 8px', fontSize:12, color:'#555', width:'60%' }}>{label}</td>
      <td style={{ padding:'4px 8px', fontSize:12, textAlign:'right', fontWeight: bold?700:'normal', color: color||'#222' }}>
        BHD {fmtBhd(value)}
      </td>
    </tr>
  )
}

export default function PayslipPrint({ slip, onClose }) {
  const { data: coData } = useQuery({
    queryKey: ['company-settings'],
    queryFn: () => api.get('/companies').then(r => r.data.data),
  })
  const co = coData || {}

  function doPrint() {
    const el = document.getElementById('payslip-print-area')
    const w = window.open('', '_blank', 'width=700,height=900')
    w.document.write(`
      <html><head><title>Payslip</title>
      <style>
        body { font-family: Arial, sans-serif; margin:0; padding:20px; color:#222; }
        table { width:100%; border-collapse:collapse; }
        td, th { padding:5px 8px; }
        .section-header { background:var(--blue); color:#fff; padding:5px 10px; font-size:11px; font-weight:bold; letter-spacing:.5px; text-transform:uppercase; }
        .row-label { color:#555; font-size:12px; }
        .row-value { text-align:right; font-size:12px; }
        .total-row { background:#f5f5f5; font-weight:bold; }
        .net-row { background:var(--blue); color:#fff; font-weight:bold; font-size:14px; }
        .net-row td { color:#fff !important; }
        hr { border:none; border-top:1px solid #ddd; margin:8px 0; }
      </style></head><body>
      ${el.innerHTML}
      </body></html>
    `)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print(); w.close() }, 400)
  }

  const run = slip.run || {}
  const monthLabel = `${MONTH_NAMES[run.run_month] || ''} ${run.run_year || ''}`
  const gosiEmp = parseFloat(slip.gosi_employee || 0)
  const absD    = parseFloat(slip.absence_deduct || 0)
  const loanD   = parseFloat(slip.loan_deduct || 0)
  const othD    = parseFloat(slip.other_deduct || 0)
  const otPay   = parseFloat(slip.overtime_pay || 0)
  const bonus   = parseFloat(slip.bonus || 0)
  const eosbAmt = parseFloat(slip.eosb_contribution || 0)
  const eosbRate = parseFloat(slip.eosb_rate || 0)

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:600, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>
        <div className="modal-header">
          <h3>Payslip — {slip.full_name} — {monthLabel}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={doPrint}>Print / Save PDF</button>
          <button className="btn" style={{ marginLeft:'auto' }} onClick={onClose}>Close</button>
        </div>

        <div style={{ flex:1, overflow:'auto', padding:16 }}>
          <div id="payslip-print-area">

            {/* Header */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:16, color:'var(--blue)' }}>{co.name || 'Company Name'}</div>
                {co.cr_number && <div style={{ fontSize:11, color:'#666' }}>CR: {co.cr_number}</div>}
                {co.vat_number && <div style={{ fontSize:11, color:'#666' }}>VAT: {co.vat_number}</div>}
                {co.address && <div style={{ fontSize:11, color:'#666' }}>{co.address}</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontWeight:700, fontSize:15, color:'var(--blue)' }}>PAYSLIP</div>
                <div style={{ fontSize:12, marginTop:4 }}>Period: <strong>{monthLabel}</strong></div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>Generated: {new Date().toLocaleDateString('en-BH')}</div>
              </div>
            </div>

            <hr />

            {/* Employee info */}
            <div style={{ background:'#f5f5f5', borderRadius:3, padding:'8px 12px', marginBottom:12 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:4 }}>
                {[
                  ['Employee No.',  slip.emp_no],
                  ['Name',          slip.full_name],
                  ['Position',      slip.position  || '—'],
                  ['Department',    slip.department || '—'],
                  ['Bank',          slip.bank_name  || '—'],
                  ['IBAN',          slip.bank_iban   || '—'],
                ].map(([label, val]) => (
                  <div key={label} style={{ display:'flex', gap:6, fontSize:12 }}>
                    <span style={{ color:'#777', minWidth:90 }}>{label}:</span>
                    <span style={{ fontWeight:600 }}>{val}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Earnings */}
            <div style={{ marginBottom:10 }}>
              <div className="section-header" style={{ background:'var(--blue)', color:'#fff', padding:'5px 10px', fontSize:11, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', marginBottom:2 }}>
                Earnings
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <tbody>
                  <Row label="Basic Salary"        value={slip.basic_salary} />
                  <Row label="Housing Allowance"   value={slip.housing_allow} />
                  <Row label="Transport Allowance" value={slip.transport_allow} />
                  {parseFloat(slip.other_allow||0) > 0 && <Row label="Other Allowance" value={slip.other_allow} />}
                  {otPay > 0 && <Row label="Overtime Pay" value={otPay} color="#2e7d32" />}
                  {bonus > 0 && <Row label="Bonus"        value={bonus} color="#2e7d32" />}
                  <tr style={{ background:'var(--blue-light)' }}>
                    <td style={{ padding:'5px 8px', fontSize:12, fontWeight:700 }}>Gross Pay</td>
                    <td style={{ padding:'5px 8px', fontSize:13, fontWeight:700, textAlign:'right' }}>BHD {fmtBhd(slip.gross_pay)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div style={{ marginBottom:10 }}>
              <div className="section-header" style={{ background:'#c62828', color:'#fff', padding:'5px 10px', fontSize:11, fontWeight:700, letterSpacing:'.5px', textTransform:'uppercase', marginBottom:2 }}>
                Deductions
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <tbody>
                  {gosiEmp > 0 && (
                    <Row
                      label={slip.is_bahraini
                        ? 'GOSI — Employee Contribution (7% of Basic)'
                        : 'Unemployment Insurance — Employee Contribution (1% of Basic)'}
                      value={gosiEmp} color="#c62828"
                    />
                  )}
                  {absD > 0    && <Row label="Absence Deduction"  value={absD} color="#c62828" />}
                  {loanD > 0   && <Row label="Loan Repayment"     value={loanD} color="#c62828" />}
                  {othD > 0    && <Row label="Other Deduction"    value={othD} color="#c62828" />}
                  {parseFloat(slip.total_deductions||0) === 0 && (
                    <tr><td style={{ padding:'4px 8px', fontSize:12, color:'#aaa' }} colSpan={2}>No deductions</td></tr>
                  )}
                  <tr style={{ background:'#fdecea' }}>
                    <td style={{ padding:'5px 8px', fontSize:12, fontWeight:700, color:'#c62828' }}>Total Deductions</td>
                    <td style={{ padding:'5px 8px', fontSize:13, fontWeight:700, textAlign:'right', color:'#c62828' }}>BHD {fmtBhd(slip.total_deductions)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Net Pay */}
            <div style={{ background:'var(--blue)', borderRadius:3, padding:'10px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
              <span style={{ color:'#fff', fontWeight:700, fontSize:15 }}>NET PAY</span>
              <span style={{ color:'#fff', fontWeight:900, fontSize:20 }}>BHD {fmtBhd(slip.net_pay)}</span>
            </div>

            {/* Employer cost summary note */}
            {parseFloat(slip.gosi_employer || 0) > 0 && (
              <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:3, padding:'8px 10px', fontSize:11, color:'#5d4037' }}>
                {slip.is_bahraini ? (
                  <>Employer GOSI contribution (12% of Basic): <strong>BHD {fmtBhd(slip.gosi_employer)}</strong> — borne by the company, not deducted from salary.</>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:3 }}>
                    <span>Employer obligations (not deducted from employee):</span>
                    <span>• Work injury insurance (GOSI 3% of Basic): <strong>BHD {fmtBhd(slip.gosi_employer)}</strong></span>
                    {gosiEmp === 0 && <span>• Unemployment insurance (1% of Basic): <strong>BHD {fmtBhd(parseFloat(slip.basic_salary||0)*0.01)}</strong> — covered by employer</span>}
                    {eosbAmt > 0 && <span>• EOSB provision ({eosbRate}% of Basic): <strong>BHD {fmtBhd(eosbAmt)}</strong></span>}
                    <span style={{ fontWeight:700, color:'#e65100', marginTop:2 }}>
                      Total employer cost this month: BHD {fmtBhd(
                        parseFloat(slip.gross_pay||0) +
                        parseFloat(slip.gosi_employer||0) +
                        (gosiEmp === 0 ? parseFloat(slip.basic_salary||0)*0.01 : 0) +
                        eosbAmt
                      )}
                    </span>
                  </div>
                )}
              </div>
            )}

            {slip.notes && (
              <div style={{ marginTop:8, fontSize:11, color:'#555' }}>Remarks: {slip.notes}</div>
            )}

            {/* Signature row */}
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:28, paddingTop:16, borderTop:'1px solid #ddd' }}>
              <div style={{ textAlign:'center', minWidth:160 }}>
                <div style={{ borderTop:'1px solid #333', paddingTop:4, fontSize:11, color:'#555' }}>Employee Signature</div>
              </div>
              <div style={{ textAlign:'center', minWidth:160 }}>
                <div style={{ borderTop:'1px solid #333', paddingTop:4, fontSize:11, color:'#555' }}>Authorised Signatory</div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
