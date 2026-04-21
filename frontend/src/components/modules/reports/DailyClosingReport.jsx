import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { reportApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'

const METHOD_LABEL = { cash:'Cash', bank_transfer:'Bank Transfer', cheque:'Cheque', card:'Card', other:'Other' }

function KpiCard({ label, value, color, sub }) {
  return (
    <div style={{
      border:'1px solid #e0e0e0', borderRadius:6, padding:'10px 14px',
      background:'#fafafa', minWidth:0,
    }}>
      <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>{label}</div>
      <div style={{ fontSize:18, fontWeight:700, color: color||'#1a3a6c' }}>BHD {fmtBhd(value)}</div>
      {sub && <div style={{ fontSize:11, color:'#aaa', marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div style={{ marginBottom:18 }}>
      <div style={{ fontSize:12, fontWeight:700, color:'#1a3a6c', borderBottom:'2px solid #e0e0e0',
                    paddingBottom:4, marginBottom:8 }}>{title}</div>
      {children}
    </div>
  )
}

export default function DailyClosingReport() {
  const today = new Date().toISOString().split('T')[0]
  const [date, setDate] = useState(today)

  const { data: resp, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['daily-closing', date],
    queryFn:  () => reportApi.dailyClosing({ date }).then(r => r.data.data),
    enabled:  true,
  })

  const d = resp
  const s = d?.summary

  const statusBadge = (st) => {
    const cfg = { unpaid:{bg:'#fff3e0',c:'#e65100'}, partial:{bg:'#e8f5e9',c:'#2e7d32'},
                  paid:{bg:'#e8f5e9',c:'#2e7d32'}, overdue:{bg:'#fdecea',c:'#c62828'} }[st] || {bg:'#f5f5f5',c:'#888'}
    return <span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:cfg.bg, color:cfg.c, fontWeight:600 }}>{st}</span>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {/* Toolbar */}
      <div className="toolbar" style={{ gap:10, flexWrap:'wrap' }}>
        <label style={{ fontSize:12, fontWeight:600, color:'#333' }}>Date:</label>
        <input type="date" value={date} max={today}
          onChange={e => setDate(e.target.value)}
          style={{ height:28, fontSize:12, padding:'2px 8px', borderRadius:3, border:'1px solid #ccc' }} />
        <button className="btn primary" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? '⏳ Loading…' : '▶ Run'}
        </button>
        <button className="btn" onClick={() => setDate(today)} disabled={date === today}>Today</button>
        <div className="toolbar-sep"/>
        <a href={reportApi.dailyClosingPrintUrl(date)} target="_blank" rel="noreferrer"
          className="btn" style={{ textDecoration:'none' }}>
          🖨 Print / PDF
        </a>
      </div>

      {isLoading && <div style={{ padding:30, textAlign:'center', color:'#888' }}>Loading…</div>}

      {d && (
        <div style={{ flex:1, overflowY:'auto', padding:'14px 16px' }}>

          {/* Date heading */}
          <div style={{ fontSize:14, fontWeight:700, color:'#1a3a6c', marginBottom:14 }}>
            Daily Closing — {fmtDate(date)}
            {date === today && <span style={{ marginLeft:8, fontSize:11, background:'#e8f5e9', color:'#2e7d32',
              padding:'2px 8px', borderRadius:10, fontWeight:600 }}>Today</span>}
          </div>

          {/* KPI cards */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, marginBottom:18 }}>
            <KpiCard label="Invoiced Today"   value={s.total_invoiced}   color="#1a3a6c" />
            <KpiCard label="Collections"      value={s.total_collected}  color="#2e7d32"
              sub={Object.entries(s.collections_by_method).map(([m,v])=>`${METHOD_LABEL[m]||m}: ${fmtBhd(v)}`).join(' · ')||null} />
            <KpiCard label="Expenses"         value={s.total_expenses}   color="#c62828" />
            <KpiCard label="Net Cash In"      value={s.net_cash_in}      color={parseFloat(s.net_cash_in)>=0?'#2e7d32':'#c62828'} />
            <KpiCard label="AR Outstanding"   value={s.ar_outstanding}   color="#e65100" sub="All open invoices" />
            <KpiCard label="Cheques Issued"   value={s.cheques_issued}   color="#c62828" sub={`${d.chequesIssued.length} cheque(s) due`} />
            <KpiCard label="Cheques Received" value={s.cheques_received} color="#2e7d32" sub={`${d.chequesReceived.length} cheque(s)`} />
            <div style={{ border:'1px solid #e0e0e0', borderRadius:6, padding:'10px 14px', background:'#fafafa' }}>
              <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:4 }}>DNs Issued</div>
              <div style={{ fontSize:24, fontWeight:700, color:'#1a3a6c' }}>{d.dns.length}</div>
            </div>
          </div>

          {/* Invoices */}
          <Section title={`Invoices Raised Today (${d.invoices.length})`}>
            {d.invoices.length === 0
              ? <div style={{ color:'#aaa', fontSize:12, padding:'8px 0' }}>No invoices raised today</div>
              : <table className="data-table" style={{ fontSize:11 }}>
                  <thead><tr>
                    <th>Invoice No.</th><th>Customer</th>
                    <th className="right">Subtotal BHD</th><th className="right">VAT BHD</th>
                    <th className="right">Total BHD</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {d.invoices.map((r,i) => (
                      <tr key={i}>
                        <td style={{ fontWeight:600, color:'var(--blue)' }}>{r.invoice_no}</td>
                        <td>{r.customer_name}</td>
                        <td className="right">{fmtBhd(r.subtotal)}</td>
                        <td className="right">{fmtBhd(r.total_vat)}</td>
                        <td className="right" style={{ fontWeight:700 }}>{fmtBhd(r.grand_total)}</td>
                        <td>{statusBadge(r.payment_status)}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'#f0f4fa', fontWeight:700 }}>
                      <td colSpan={4} style={{ textAlign:'right', fontSize:11 }}>Total Invoiced:</td>
                      <td className="right">BHD {fmtBhd(s.total_invoiced)}</td>
                      <td></td>
                    </tr>
                  </tbody>
                </table>}
          </Section>

          {/* Collections */}
          <Section title={`Collections Received Today (${d.collections.length})`}>
            {d.collections.length === 0
              ? <div style={{ color:'#aaa', fontSize:12, padding:'8px 0' }}>No collections today</div>
              : <>
                  <table className="data-table" style={{ fontSize:11 }}>
                    <thead><tr>
                      <th>Invoice No.</th><th>Customer</th>
                      <th className="right">Amount BHD</th><th>Method</th><th>Reference</th>
                    </tr></thead>
                    <tbody>
                      {d.collections.map((r,i) => (
                        <tr key={i}>
                          <td style={{ color:'var(--blue)', fontWeight:600 }}>{r.invoice_no}</td>
                          <td>{r.customer_name}</td>
                          <td className="right" style={{ fontWeight:700, color:'#2e7d32' }}>{fmtBhd(r.amount)}</td>
                          <td><span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:'#e3f2fd', color:'#1565c0', fontWeight:600 }}>{METHOD_LABEL[r.method]||r.method}</span></td>
                          <td style={{ fontSize:11, color:'#666' }}>{r.reference_no||'—'}</td>
                        </tr>
                      ))}
                      <tr style={{ background:'#f0f4fa', fontWeight:700 }}>
                        <td colSpan={2} style={{ textAlign:'right', fontSize:11 }}>Total Collected:</td>
                        <td className="right" style={{ color:'#2e7d32' }}>BHD {fmtBhd(s.total_collected)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
                  </table>
                  {Object.keys(s.collections_by_method).length > 1 && (
                    <div style={{ marginTop:6, fontSize:11, color:'#555' }}>
                      <strong>Breakdown: </strong>
                      {Object.entries(s.collections_by_method).map(([m,v]) =>
                        <span key={m} style={{ marginRight:16 }}>{METHOD_LABEL[m]||m}: <strong>BHD {fmtBhd(v)}</strong></span>
                      )}
                    </div>
                  )}
                </>}
          </Section>

          {/* Expenses */}
          <Section title={`Expenses Today (${d.expenses.length})`}>
            {d.expenses.length === 0
              ? <div style={{ color:'#aaa', fontSize:12, padding:'8px 0' }}>No expenses recorded today</div>
              : <table className="data-table" style={{ fontSize:11 }}>
                  <thead><tr>
                    <th>Expense No.</th><th>Category</th><th>Description</th>
                    <th className="right">Net BHD</th><th className="right">VAT BHD</th><th className="right">Total BHD</th>
                  </tr></thead>
                  <tbody>
                    {d.expenses.map((r,i) => (
                      <tr key={i}>
                        <td style={{ color:'var(--blue)', fontWeight:600 }}>{r.expense_no}</td>
                        <td style={{ fontSize:11, color:'#555' }}>{r.category_name||'—'}</td>
                        <td>{r.description}</td>
                        <td className="right">{fmtBhd(r.net_amount)}</td>
                        <td className="right" style={{ color:'#c62828' }}>{fmtBhd(r.vat_amount)}</td>
                        <td className="right" style={{ fontWeight:700, color:'#c62828' }}>{fmtBhd(r.total_amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ background:'#f0f4fa', fontWeight:700 }}>
                      <td colSpan={5} style={{ textAlign:'right', fontSize:11 }}>Total Expenses:</td>
                      <td className="right" style={{ color:'#c62828' }}>BHD {fmtBhd(s.total_expenses)}</td>
                    </tr>
                  </tbody>
                </table>}
          </Section>

          {/* DNs */}
          <Section title={`Delivery Notes Issued Today (${d.dns.length})`}>
            {d.dns.length === 0
              ? <div style={{ color:'#aaa', fontSize:12, padding:'8px 0' }}>No delivery notes today</div>
              : <table className="data-table" style={{ fontSize:11 }}>
                  <thead><tr>
                    <th>DN No.</th><th>Customer</th><th>Project / Ref</th>
                    <th className="right">Net Value BHD</th><th>Status</th>
                  </tr></thead>
                  <tbody>
                    {d.dns.map((r,i) => (
                      <tr key={i}>
                        <td style={{ color:'var(--teal)', fontWeight:600 }}>{r.dn_no}</td>
                        <td>{r.customer_name}</td>
                        <td style={{ color:'#666', fontSize:11 }}>{r.project_ref||'—'}</td>
                        <td className="right" style={{ fontWeight:600 }}>{fmtBhd(r.net_value)}</td>
                        <td><span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:'#e8f5e9', color:'#2e7d32', fontWeight:600 }}>{r.status}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>}
          </Section>

          {/* Cheques due */}
          {(d.chequesIssued.length > 0 || d.chequesReceived.length > 0) && (
            <Section title="Cheques Due Today">
              {d.chequesIssued.length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:'#c62828', marginBottom:4 }}>
                    ↑ Issued (outgoing) — BHD {fmtBhd(s.cheques_issued)}
                  </div>
                  <table className="data-table" style={{ fontSize:11, marginBottom:10 }}>
                    <thead><tr><th>Cheque No.</th><th>Bank</th><th>Party</th><th className="right">Amount BHD</th><th>Status</th></tr></thead>
                    <tbody>
                      {d.chequesIssued.map((r,i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600, color:'var(--blue)' }}>{r.cheque_no}</td>
                          <td>{r.bank_name||'—'}</td><td>{r.party_name||'—'}</td>
                          <td className="right" style={{ fontWeight:700 }}>{fmtBhd(r.amount)}</td>
                          <td><span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:'#fdecea', color:'#c62828', fontWeight:600 }}>{r.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
              {d.chequesReceived.length > 0 && (
                <>
                  <div style={{ fontSize:11, fontWeight:700, color:'#2e7d32', marginBottom:4 }}>
                    ↓ Received (incoming) — BHD {fmtBhd(s.cheques_received)}
                  </div>
                  <table className="data-table" style={{ fontSize:11 }}>
                    <thead><tr><th>Cheque No.</th><th>Bank</th><th>Party</th><th className="right">Amount BHD</th><th>Status</th></tr></thead>
                    <tbody>
                      {d.chequesReceived.map((r,i) => (
                        <tr key={i}>
                          <td style={{ fontWeight:600, color:'var(--blue)' }}>{r.cheque_no}</td>
                          <td>{r.bank_name||'—'}</td><td>{r.party_name||'—'}</td>
                          <td className="right" style={{ fontWeight:700 }}>{fmtBhd(r.amount)}</td>
                          <td><span style={{ fontSize:10, padding:'1px 6px', borderRadius:8, background:'#e8f5e9', color:'#2e7d32', fontWeight:600 }}>{r.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
              )}
            </Section>
          )}

          {/* Net summary */}
          <div style={{ border:'1px solid #e0e0e0', borderRadius:6, padding:'12px 16px',
                        background:'#f0f4fa', display:'flex', gap:32, flexWrap:'wrap', fontSize:12 }}>
            <span>Collections: <strong style={{ color:'#2e7d32' }}>BHD {fmtBhd(s.total_collected)}</strong></span>
            <span>Expenses: <strong style={{ color:'#c62828' }}>− BHD {fmtBhd(s.total_expenses)}</strong></span>
            <span style={{ fontWeight:700, fontSize:13 }}>
              Net Cash: <strong style={{ color: parseFloat(s.net_cash_in)>=0?'#2e7d32':'#c62828' }}>
                BHD {fmtBhd(s.net_cash_in)}
              </strong>
            </span>
          </div>

        </div>
      )}
    </div>
  )
}
