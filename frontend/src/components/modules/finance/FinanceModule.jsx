import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { chequeApi, reportApi, invoiceApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import { useUIStore } from '../../../store'

// ── VAT Return Panel ──────────────────────────────────────────
function VatReturnPanel() {
  const curYear = new Date().getFullYear()
  const curQ    = Math.ceil((new Date().getMonth() + 1) / 3)
  const [quarter, setQuarter] = useState(`Q${curQ}-${curYear}`)
  const [expanded, setExpanded] = useState(null)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['vat-report', quarter],
    queryFn:  () => reportApi.vat({ quarter }).then(r => r.data.data),
    enabled:  !!quarter,
  })

  const quarters = []
  for (let y = curYear; y >= curYear - 2; y--) {
    for (let q = 4; q >= 1; q--) {
      if (y === curYear && q > curQ) continue
      quarters.push(`Q${q}-${y}`)
    }
  }

  const Row = ({ label, value, sub, color }) => (
    <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'6px 0',borderBottom:'1px solid #f0f0f0'}}>
      <span style={{fontSize:12,color:'#555'}}>{label}</span>
      <div style={{textAlign:'right'}}>
        <span style={{fontSize:14,fontWeight:700,color:color||'#333'}}>BHD {fmtBhd(value||0)}</span>
        {sub && <div style={{fontSize:10,color:'#aaa'}}>{sub}</div>}
      </div>
    </div>
  )

  return (
    <div style={{padding:'0 12px 12px'}}>
      <div style={{background:'#fff',border:'1px solid #d0d0d0',borderRadius:3,padding:14}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,paddingBottom:8,borderBottom:'1px solid #eee'}}>
          <div style={{fontWeight:700,fontSize:13,color:'#333'}}>VAT Return</div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:11,color:'#888'}}>Quarter:</span>
            <select value={quarter} onChange={e=>setQuarter(e.target.value)}
              style={{fontSize:12,padding:'2px 6px',border:'1px solid #ccc',borderRadius:3,height:26}}>
              {quarters.map(q=><option key={q} value={q}>{q}</option>)}
            </select>
            {isFetching && <span style={{fontSize:11,color:'#aaa'}}>Loading…</span>}
          </div>
        </div>

        {data && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
            {/* Summary */}
            <div style={{background:'#f9f9f9',border:'1px solid #eee',borderRadius:3,padding:12}}>
              <div style={{fontSize:11,fontWeight:700,color:'#888',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:8}}>Summary</div>
              <Row label="Output VAT (Sales)" value={data.output_vat?.total_vat} color="#c62828"/>
              <Row label="Credit Notes VAT" value={data.credit_notes?.total_vat} sub="reduces output" color="#e65100"/>
              <Row label="Input VAT (Purchases)" value={data.input_vat?.total_vat} color="#2e7d32"/>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',padding:'10px 0 4px',borderTop:'2px solid #333',marginTop:4}}>
                <span style={{fontSize:13,fontWeight:700}}>Net VAT Payable</span>
                <span style={{fontSize:18,fontWeight:700,color: parseFloat(data.summary?.net_vat_payable||0)>0?'#c62828':'#2e7d32'}}>
                  BHD {fmtBhd(data.summary?.net_vat_payable||0)}
                </span>
              </div>
              <div style={{fontSize:10,color:'#888',marginTop:4}}>
                Period: {data.period?.from} – {data.period?.to}
              </div>
              <div style={{marginTop:8,padding:'6px 8px',background:'#fff8e1',border:'1px solid #ffe082',borderRadius:3,fontSize:11,color:'#5d4037'}}>
                ⚠ NBR filing due within 30 days of quarter end.
              </div>
            </div>

            {/* Output VAT detail */}
            <div style={{background:'#fff',border:'1px solid #eee',borderRadius:3,padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:700,color:'#c62828',textTransform:'uppercase',letterSpacing:'.5px'}}>
                  Output VAT — {(data.output_vat?.rows||[]).length} invoices
                </div>
                <button style={{background:'none',border:'none',fontSize:11,color:'var(--blue)',cursor:'pointer'}}
                  onClick={()=>setExpanded(expanded==='output'?null:'output')}>
                  {expanded==='output'?'▲ Hide':'▼ Show'}
                </button>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
                <span style={{color:'#555'}}>Taxable net</span>
                <span style={{fontWeight:600}}>BHD {fmtBhd(data.output_vat?.total_net||0)}</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                <span style={{color:'#555'}}>VAT collected</span>
                <span style={{fontWeight:700,color:'#c62828'}}>BHD {fmtBhd(data.output_vat?.total_vat||0)}</span>
              </div>
              {expanded==='output' && (
                <div style={{marginTop:8,maxHeight:220,overflowY:'auto',border:'1px solid #e0e0e0',borderRadius:3}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                    <thead><tr style={{background:'#f5f5f5',position:'sticky',top:0}}>
                      <th style={{padding:'3px 6px',textAlign:'left'}}>Invoice</th>
                      <th style={{padding:'3px 6px',textAlign:'left'}}>Customer</th>
                      <th style={{padding:'3px 6px',textAlign:'right'}}>Net</th>
                      <th style={{padding:'3px 6px',textAlign:'right'}}>VAT</th>
                    </tr></thead>
                    <tbody>
                      {(data.output_vat?.rows||[]).map((r,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #f5f5f5',background:i%2?'#fafafa':'#fff'}}>
                          <td style={{padding:'3px 6px',color:'var(--blue)',fontWeight:600,whiteSpace:'nowrap'}}>{r.invoice_no}</td>
                          <td style={{padding:'3px 6px',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.customer_name}</td>
                          <td style={{padding:'3px 6px',textAlign:'right'}}>{fmtBhd(r.taxable_amount||r.net_amount)}</td>
                          <td style={{padding:'3px 6px',textAlign:'right',fontWeight:600}}>{fmtBhd(r.vat_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Input VAT detail */}
            <div style={{background:'#fff',border:'1px solid #eee',borderRadius:3,padding:12}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <div style={{fontSize:11,fontWeight:700,color:'#2e7d32',textTransform:'uppercase',letterSpacing:'.5px'}}>
                  Input VAT — {(data.input_vat?.rows||[]).length} transactions
                </div>
                <button style={{background:'none',border:'none',fontSize:11,color:'var(--blue)',cursor:'pointer'}}
                  onClick={()=>setExpanded(expanded==='input'?null:'input')}>
                  {expanded==='input'?'▲ Hide':'▼ Show'}
                </button>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:6}}>
                <span style={{color:'#555'}}>Purchases &amp; expenses</span>
                <span style={{fontWeight:600}}>{(data.input_vat?.rows||[]).length} items</span>
              </div>
              <div style={{display:'flex',justifyContent:'space-between',fontSize:12}}>
                <span style={{color:'#555'}}>VAT reclaimable</span>
                <span style={{fontWeight:700,color:'#2e7d32'}}>BHD {fmtBhd(data.input_vat?.total_vat||0)}</span>
              </div>
              {expanded==='input' && (
                <div style={{marginTop:8,maxHeight:220,overflowY:'auto',border:'1px solid #e0e0e0',borderRadius:3}}>
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:10}}>
                    <thead><tr style={{background:'#f5f5f5',position:'sticky',top:0}}>
                      <th style={{padding:'3px 6px',textAlign:'left'}}>Ref</th>
                      <th style={{padding:'3px 6px',textAlign:'left'}}>Supplier</th>
                      <th style={{padding:'3px 6px',textAlign:'right'}}>Net</th>
                      <th style={{padding:'3px 6px',textAlign:'right'}}>VAT</th>
                    </tr></thead>
                    <tbody>
                      {(data.input_vat?.rows||[]).map((r,i)=>(
                        <tr key={i} style={{borderBottom:'1px solid #f5f5f5',background:i%2?'#fafafa':'#fff'}}>
                          <td style={{padding:'3px 6px',color:'var(--blue)',fontWeight:600,whiteSpace:'nowrap'}}>{r.ref_no}</td>
                          <td style={{padding:'3px 6px',maxWidth:100,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.supplier_name}</td>
                          <td style={{padding:'3px 6px',textAlign:'right'}}>{fmtBhd(r.net_amount)}</td>
                          <td style={{padding:'3px 6px',textAlign:'right',fontWeight:600}}>{fmtBhd(r.vat_amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        {isLoading && <div style={{textAlign:'center',padding:30,color:'#aaa'}}>Loading VAT data…</div>}
      </div>
    </div>
  )
}

const Card = ({ label, value, sub, color, onClick }) => (
  <div onClick={onClick} style={{
    background:'#fff', border:'1px solid #d0d0d0', borderTop:`3px solid ${color}`,
    borderRadius:3, padding:'12px 14px', cursor: onClick?'pointer':'default',
  }}
    onMouseEnter={e=>onClick&&(e.currentTarget.style.boxShadow='0 2px 8px rgba(0,0,0,.12)')}
    onMouseLeave={e=>onClick&&(e.currentTarget.style.boxShadow='none')}>
    <div style={{fontSize:10,color:'#888',textTransform:'uppercase',letterSpacing:'.5px',marginBottom:5}}>{label}</div>
    <div style={{fontSize:20,fontWeight:700,color}}>{value}</div>
    {sub && <div style={{fontSize:11,color:'#888',marginTop:3}}>{sub}</div>}
  </div>
)

const AgeBar = ({ label, amount, total, color, onClick, selected }) => {
  const pct = total > 0 ? Math.min(100, (amount/total)*100) : 0
  return (
    <div onClick={onClick} style={{
      marginBottom:10, padding:'4px 6px', borderRadius:4, cursor: onClick?'pointer':'default',
      background: selected ? '#f0f7ff' : 'transparent',
      border: selected ? '1px solid #90caf9' : '1px solid transparent',
      transition:'background .15s',
    }}
      onMouseEnter={e=>onClick&&!selected&&(e.currentTarget.style.background='#f9f9f9')}
      onMouseLeave={e=>onClick&&!selected&&(e.currentTarget.style.background='transparent')}
    >
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,marginBottom:3}}>
        <span style={{color: selected?'var(--blue)':'#555',fontWeight: selected?700:400}}>{label}</span>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          <span style={{fontWeight:600,color}}>{fmtBhd(amount)} BHD</span>
          {onClick && <span style={{fontSize:10,color:'#aaa'}}>{selected?'▲':'▼'}</span>}
        </div>
      </div>
      <div style={{height:6,background:'#e0e0e0',borderRadius:3,overflow:'hidden'}}>
        <div style={{height:'100%',width:`${pct}%`,background:color,borderRadius:3,transition:'width .3s'}}/>
      </div>
    </div>
  )
}

const CF_FILTERS = [
  { key:'week',  label:'This Week' },
  { key:'month', label:'This Month' },
  { key:'30',    label:'30 Days' },
  { key:'60',    label:'60 Days' },
  { key:'90',    label:'90 Days' },
  { key:'all',   label:'All Pending' },
  { key:'custom',label:'Custom' },
]

export default function FinanceModule() {
  const { setModule } = useUIStore()
  const today = new Date().toISOString().split('T')[0]
  const in30  = new Date(Date.now()+30*864e5).toISOString().split('T')[0]
  const in60  = new Date(Date.now()+60*864e5).toISOString().split('T')[0]
  const in90  = new Date(Date.now()+90*864e5).toISOString().split('T')[0]

  const [cfFilter,           setCfFilter]           = useState('30')
  const [cfCustomFrom,       setCfCustomFrom]       = useState('')
  const [cfCustomTo,         setCfCustomTo]         = useState('')
  const [selectedAgingBucket, setSelectedAgingBucket] = useState(null)
  const [apExpanded,         setApExpanded]         = useState(null)

  // Due-date ranges for aging drill-down
  const daysAgo = n => new Date(Date.now() - n*864e5).toISOString().split('T')[0]
  const ageDates = {
    current:  { due_from: today },
    '30':     { due_from: daysAgo(30), due_to: daysAgo(1) },
    '60':     { due_from: daysAgo(60), due_to: daysAgo(31) },
    '90plus': { due_to: daysAgo(61) },
  }

  const { data: sumData } = useQuery({ queryKey:['fin-summary'], queryFn:()=>chequeApi.summary().then(r=>r.data.data) })
  const { data: chqData } = useQuery({ queryKey:['cheques-upcoming'], queryFn:()=>chequeApi.list({direction:'issued',status:'pending'}).then(r=>r.data.data) })
  const { data: overdueData } = useQuery({ queryKey:['overdue-rpt'], queryFn:()=>reportApi.overdue().then(r=>r.data) })
  const { data: apAgingData } = useQuery({ queryKey:['ap-aging'], queryFn:()=>reportApi.apAging().then(r=>r.data.data) })

  const ageDrillParams = selectedAgingBucket ? { ...ageDates[selectedAgingBucket], type:'tax_invoice', status:'unpaid,partial,overdue', limit:100 } : null
  const { data: ageDrillData, isLoading: ageDrillLoading } = useQuery({
    queryKey: ['age-drill', selectedAgingBucket, today],
    queryFn:  () => invoiceApi.list(ageDrillParams).then(r => r.data),
    enabled:  !!selectedAgingBucket,
    keepPreviousData: true,
  })
  const ageDrillRows = ageDrillData?.data || []

  const sum      = sumData || {}
  const ar       = sum.receivables || {}
  const ap       = sum.payables    || {}
  const ci       = sum.cheques_issued   || {}
  const cr       = sum.cheques_received || {}
  const bankAccs  = sum.bank_accounts   || []
  const bankTotal = parseFloat(sum.bank_total || 0)
  const aging     = sum.ar_aging        || {}
  const writeOffsYtd = sum.write_offs_ytd || {}
  const cheques = (chqData||[]).sort((a,b)=>new Date(a.cheque_date)-new Date(b.cheque_date))

  const cfCheques = useMemo(() => {
    if (!cheques.length) return []
    if (cfFilter === 'all') return cheques
    const t = new Date(today); t.setHours(0,0,0,0)
    let from = t, to = null
    if (cfFilter === 'week') {
      to = new Date(t); to.setDate(to.getDate() + 6)
    } else if (cfFilter === 'month') {
      to = new Date(t.getFullYear(), t.getMonth() + 1, 0)
    } else if (cfFilter === '30') {
      to = new Date(t); to.setDate(to.getDate() + 29)
    } else if (cfFilter === '60') {
      to = new Date(t); to.setDate(to.getDate() + 59)
    } else if (cfFilter === '90') {
      to = new Date(t); to.setDate(to.getDate() + 89)
    } else if (cfFilter === 'custom') {
      from = cfCustomFrom ? new Date(cfCustomFrom) : null
      to   = cfCustomTo   ? new Date(cfCustomTo)   : null
    }
    return cheques.filter(ch => {
      const d = new Date(ch.cheque_date); d.setHours(0,0,0,0)
      if (from && d < from) return false
      if (to   && d > to)   return false
      return true
    })
  }, [cheques, cfFilter, cfCustomFrom, cfCustomTo, today])

  const cfTotal = cfCheques.reduce((s, ch) => s + parseFloat(ch.amount || 0), 0)
  const overdueInvs = (overdueData?.data||[]).slice(0,8)

  const totalAging = parseFloat(aging.current_amt||0) + parseFloat(aging.overdue_30||0) +
                     parseFloat(aging.overdue_60||0) + parseFloat(aging.overdue_90plus||0)

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'auto',background:'#f0f0f0'}}>
      <div className="module-title">Financial Overview</div>

      {/* KPI row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:9,padding:12,paddingBottom:0}}>
        <Card label="Bank &amp; Cash Balance" value={`BHD ${fmtBhd(bankTotal)}`}
          sub={`${bankAccs.length} account${bankAccs.length!==1?'s':''}`} color="#00695c" onClick={()=>setModule('bank')}/>
        <Card label="Accounts Receivable" value={`BHD ${fmtBhd(ar.total)}`}
          sub={`${ar.overdue_count||0} invoices overdue`} color="var(--blue)" onClick={()=>setModule('invoices')}/>
        <Card label="Accounts Payable" value={`BHD ${fmtBhd(ap.total)}`}
          sub="Unpaid purchases" color="#e65100" onClick={()=>setModule('purchases')}/>
        <Card label="Cheques Out (Pending)" value={`BHD ${fmtBhd(ci.total)}`}
          sub={`${ci.count||0} cheques to clear`} color="#c62828" onClick={()=>setModule('cheques')}/>
        <Card label="Cheques In (Pending)" value={`BHD ${fmtBhd(cr.total)}`}
          sub={`${cr.count||0} cheques to collect`} color="#2e7d32" onClick={()=>setModule('cheques')}/>
        <Card label="Bad Debt Written Off (YTD)" value={`BHD ${fmtBhd(writeOffsYtd.total)}`}
          sub={`${writeOffsYtd.count||0} invoice${writeOffsYtd.count!==1?'s':''} this year`} color="#7b1fa2" onClick={()=>setModule('invoices')}/>
      </div>

      {/* Bank accounts breakdown */}
      {bankAccs.length > 0 && (
        <div style={{padding:'9px 12px 0'}}>
          <div style={{background:'#fff',border:'1px solid #d0d0d0',borderRadius:3,padding:'10px 14px'}}>
            <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:'#00695c'}}>Bank &amp; Cash Accounts</div>
            <div style={{display:'flex',gap:16,flexWrap:'wrap'}}>
              {bankAccs.map(b => (
                <div key={b.id} style={{display:'flex',flexDirection:'column',padding:'6px 14px',background:'#f0f9f6',border:'1px solid #b2dfdb',borderRadius:3,minWidth:180}}>
                  <div style={{fontSize:11,color:'#555',marginBottom:2}}>{b.bank_name}</div>
                  <div style={{fontSize:11,color:'#888',marginBottom:4}}>{b.account_name}</div>
                  <div style={{fontSize:16,fontWeight:700,color:'#00695c'}}>{b.currency} {fmtBhd(b.current_balance)}</div>
                </div>
              ))}
              <div style={{display:'flex',flexDirection:'column',justifyContent:'center',padding:'6px 14px',background:'var(--blue-light)',border:'1px solid #b0c8f0',borderRadius:3,minWidth:180}}>
                <div style={{fontSize:11,color:'#555',marginBottom:2}}>Total Cash Position</div>
                <div style={{fontSize:16,fontWeight:700,color:'var(--blue)'}}>BHD {fmtBhd(bankTotal)}</div>
                <div style={{fontSize:10,color:'#888',marginTop:2}}>Less pending cheques out: BHD {fmtBhd(ci.total||0)}</div>
                <div style={{fontSize:11,fontWeight:700,color: (bankTotal - parseFloat(ci.total||0)) >= 0 ? '#2e7d32' : '#c62828',marginTop:1}}>
                  Net: BHD {fmtBhd(bankTotal - parseFloat(ci.total||0))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {bankAccs.length === 0 && (
        <div style={{padding:'9px 12px 0'}}>
          <div style={{background:'#fff8e1',border:'1px solid #ffe082',borderRadius:3,padding:'10px 14px',fontSize:12,color:'#5d4037'}}>
            ⚠ No bank accounts configured yet. Add accounts in the <span style={{color:'var(--blue)',cursor:'pointer',textDecoration:'underline'}} onClick={()=>setModule('bank')}>Bank Recon.</span> module to see your cash position here.
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:9,padding:12}}>

        {/* AR Aging */}
        <div style={{background:'#fff',border:'1px solid #d0d0d0',borderRadius:3,padding:14,display:'flex',flexDirection:'column'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:8,paddingBottom:6,borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between'}}>
            <span>Accounts Receivable Aging</span>
            <span style={{fontWeight:400,fontSize:11,color:'#aaa'}}>Click a row to drill down</span>
          </div>
          {[
            { key:'current',  label:'Current (not yet due)',   amount:parseFloat(aging.current_amt||0),    color:'#2e7d32' },
            { key:'30',       label:'1–30 days overdue',       amount:parseFloat(aging.overdue_30||0),     color:'#f57c00' },
            { key:'60',       label:'31–60 days overdue',      amount:parseFloat(aging.overdue_60||0),     color:'#e65100' },
            { key:'90plus',   label:'60+ days overdue',        amount:parseFloat(aging.overdue_90plus||0), color:'#c62828' },
          ].map(({ key, label, amount, color }) => (
            <AgeBar key={key} label={label} amount={amount} total={totalAging} color={color}
              selected={selectedAgingBucket === key}
              onClick={() => setSelectedAgingBucket(prev => prev === key ? null : key)}
            />
          ))}
          <div style={{borderTop:'1px solid #eee',marginTop:6,paddingTop:8,display:'flex',justifyContent:'space-between',fontSize:12,fontWeight:700}}>
            <span>Total Outstanding</span><span style={{color:'var(--blue)'}}>BHD {fmtBhd(totalAging)}</span>
          </div>

          {/* Drill-down panel */}
          {selectedAgingBucket && (
            <div style={{marginTop:10,borderTop:'2px solid #e3f2fd',paddingTop:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                <span style={{fontSize:11,fontWeight:700,color:'var(--blue)'}}>
                  {ageDrillLoading ? 'Loading…' : `${ageDrillRows.length} invoice${ageDrillRows.length!==1?'s':''}`}
                </span>
                <span style={{fontSize:11,color:'var(--blue)',cursor:'pointer',textDecoration:'underline'}}
                  onClick={()=>setModule('invoices')}>View all in Invoices →</span>
              </div>
              <div style={{overflow:'auto',maxHeight:220,border:'1px solid #e0e0e0',borderRadius:3}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead>
                    <tr style={{background:'#f5f5f5',position:'sticky',top:0}}>
                      <th style={{padding:'4px 8px',textAlign:'left',fontWeight:600,whiteSpace:'nowrap'}}>Invoice</th>
                      <th style={{padding:'4px 8px',textAlign:'left',fontWeight:600}}>Customer</th>
                      <th style={{padding:'4px 8px',textAlign:'left',fontWeight:600,whiteSpace:'nowrap'}}>Due Date</th>
                      <th style={{padding:'4px 8px',textAlign:'right',fontWeight:600,whiteSpace:'nowrap'}}>Days</th>
                      <th style={{padding:'4px 8px',textAlign:'right',fontWeight:600,whiteSpace:'nowrap'}}>Balance BHD</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ageDrillLoading && (
                      <tr><td colSpan={5} style={{padding:'10px',color:'#aaa',textAlign:'center'}}>Loading…</td></tr>
                    )}
                    {!ageDrillLoading && ageDrillRows.length === 0 && (
                      <tr><td colSpan={5} style={{padding:'10px',color:'#aaa',textAlign:'center'}}>No invoices found</td></tr>
                    )}
                    {ageDrillRows.map((inv, i) => {
                      const daysOv = inv.due_date ? Math.floor((Date.now() - new Date(inv.due_date)) / 864e5) : null
                      const urgent = daysOv !== null && daysOv > 60
                      return (
                        <tr key={inv.id} style={{borderBottom:'1px solid #f0f0f0',background:i%2?'#fafafa':'#fff'}}>
                          <td style={{padding:'4px 8px',color:'var(--blue)',fontWeight:600,whiteSpace:'nowrap'}}>{inv.invoice_no}</td>
                          <td style={{padding:'4px 8px',maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{inv.customer_name}</td>
                          <td style={{padding:'4px 8px',color:'#c62828',whiteSpace:'nowrap'}}>{fmtDate(inv.due_date)}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',fontWeight:600,color: urgent?'#c62828':'#e65100'}}>
                            {daysOv !== null ? (daysOv <= 0 ? '—' : `${daysOv}d`) : '—'}
                          </td>
                          <td style={{padding:'4px 8px',textAlign:'right',fontWeight:700}}>{fmtBhd(inv.balance_due)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {ageDrillRows.length > 0 && (
                <div style={{marginTop:5,display:'flex',justifyContent:'flex-end',fontSize:11,fontWeight:700,color:'var(--blue)'}}>
                  Subtotal: BHD {fmtBhd(ageDrillRows.reduce((s,r)=>s+parseFloat(r.balance_due||0),0))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Cheque cash flow */}
        <div style={{background:'#fff',border:'1px solid #d0d0d0',borderRadius:3,padding:14,display:'flex',flexDirection:'column'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:8,paddingBottom:6,borderBottom:'1px solid #eee'}}>
            Cheque Cash Flow (Issued — Outgoing)
          </div>

          {/* Filter pills */}
          <div style={{display:'flex',gap:4,flexWrap:'wrap',marginBottom:8}}>
            {CF_FILTERS.map(f => (
              <button key={f.key} onClick={() => setCfFilter(f.key)}
                style={{
                  padding:'2px 8px', fontSize:11, borderRadius:10, border:'1px solid',
                  borderColor: cfFilter === f.key ? '#e65100' : '#ddd',
                  background:  cfFilter === f.key ? '#e65100' : '#f5f5f5',
                  color:       cfFilter === f.key ? '#fff' : '#555',
                  cursor:'pointer', fontWeight: cfFilter === f.key ? 700 : 400,
                }}>{f.label}</button>
            ))}
          </div>

          {/* Custom date range */}
          {cfFilter === 'custom' && (
            <div style={{display:'flex',gap:6,alignItems:'center',marginBottom:8}}>
              <input type="date" value={cfCustomFrom} onChange={e => setCfCustomFrom(e.target.value)}
                style={{fontSize:11,padding:'2px 6px',borderRadius:3,border:'1px solid #ccc',height:24}} />
              <span style={{fontSize:11,color:'#888'}}>–</span>
              <input type="date" value={cfCustomTo} onChange={e => setCfCustomTo(e.target.value)}
                style={{fontSize:11,padding:'2px 6px',borderRadius:3,border:'1px solid #ccc',height:24}} />
            </div>
          )}

          {/* Total */}
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'8px 0',borderBottom:'2px solid #f0f0f0',marginBottom:6}}>
            <span style={{fontSize:12,color:'#555'}}>{cfCheques.length} cheque{cfCheques.length!==1?'s':''}</span>
            <span style={{fontSize:16,fontWeight:700,color: cfTotal > 0 ? '#c62828' : '#2e7d32'}}>
              BHD {fmtBhd(cfTotal)}
            </span>
          </div>

          {/* Cheque list */}
          <div style={{overflow:'auto',flex:1,maxHeight:200}}>
            {cfCheques.length === 0 && (
              <div style={{color:'#aaa',fontSize:12,padding:'8px 0'}}>No cheques in this period</div>
            )}
            {cfCheques.map(ch => {
              const due  = new Date(ch.cheque_date)
              const diff = Math.ceil((due - new Date()) / 864e5)
              const urgent = diff <= 7
              return (
                <div key={ch.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'4px 0',borderBottom:'1px solid #f5f5f5',fontSize:11}}>
                  <div style={{overflow:'hidden'}}>
                    <span style={{fontWeight:600,color:'var(--blue)'}}>{ch.cheque_no}</span>
                    <span style={{color:'#888',marginLeft:6,fontSize:10}}>{ch.party_name}</span>
                    {ch.bank_name && <span style={{color:'#aaa',marginLeft:4,fontSize:10}}>({ch.bank_name})</span>}
                  </div>
                  <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                    <div style={{fontWeight:700,color: urgent?'#c62828':'#333'}}>BHD {fmtBhd(ch.amount)}</div>
                    <div style={{fontSize:10,color: urgent?'#c62828':'#888'}}>
                      {fmtDate(ch.cheque_date)}{diff<=0?' OVERDUE':diff<=7?` (${diff}d)`:''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{marginTop:8,fontSize:11,color:'#888',background:'#fff8e1',padding:'5px 8px',borderRadius:3,borderLeft:'3px solid #f57c00'}}>
            ⚠ Ensure sufficient bank balance to honour post-dated cheques as they fall due.
          </div>
        </div>

        {/* Upcoming cheques detail */}
        <div style={{background:'#fff',border:'1px solid #d0d0d0',borderRadius:3,padding:14,display:'flex',flexDirection:'column'}}>
          <div style={{fontWeight:600,fontSize:12,marginBottom:8,paddingBottom:6,borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between'}}>
            Upcoming Cheques <span style={{fontWeight:400,fontSize:11,color:'var(--blue)',cursor:'pointer'}} onClick={()=>setModule('cheques')}>View all →</span>
          </div>
          <div style={{overflow:'auto',flex:1}}>
            {!cheques.length && <div style={{color:'#aaa',fontSize:12,padding:8}}>No pending issued cheques</div>}
            {cheques.slice(0,10).map(ch => {
              const due  = new Date(ch.cheque_date)
              const diff = Math.ceil((due - new Date()) / 864e5)
              const urgent = diff <= 7
              return (
                <div key={ch.id} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'5px 0',borderBottom:'1px solid #f5f5f5',fontSize:11}}>
                  <div>
                    <span style={{fontWeight:600,color:'var(--blue)'}}>{ch.cheque_no}</span>
                    <span style={{color:'#888',marginLeft:6}}>{ch.party_name}</span>
                    {ch.bank_name && <span style={{color:'#aaa',marginLeft:4,fontSize:10}}>({ch.bank_name})</span>}
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{fontWeight:700,color: urgent?'#c62828':'#333'}}>BHD {fmtBhd(ch.amount)}</div>
                    <div style={{fontSize:10,color: urgent?'#c62828':'#888'}}>
                      {fmtDate(ch.cheque_date)}{diff<=0?' OVERDUE':diff<=7?` (${diff}d)`:diff<=30?` (${diff}d)`:''}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* AP Aging */}
      {apAgingData && (
        <div style={{padding:'0 12px 9px'}}>
          <div style={{background:'#fff',border:'1px solid #d0d0d0',borderRadius:3,padding:14}}>
            <div style={{fontWeight:600,fontSize:12,marginBottom:10,paddingBottom:6,borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span>Accounts Payable Aging</span>
              <span style={{fontSize:11,color:'#aaa',fontWeight:400}}>Unpaid &amp; partial purchases by supplier</span>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:6,marginBottom:10}}>
              {[
                { label:'Current',       key:'current',  color:'#2e7d32' },
                { label:'1–30d overdue', key:'b1_30',    color:'#f57c00' },
                { label:'31–60d',        key:'b31_60',   color:'#e65100' },
                { label:'61–90d',        key:'b61_90',   color:'#c62828' },
                { label:'90d+',          key:'b90plus',  color:'#7b1fa2' },
              ].map(({label,key,color})=>(
                <div key={key} style={{background:'#f9f9f9',border:`2px solid ${color}22`,borderTop:`3px solid ${color}`,borderRadius:3,padding:'6px 10px',textAlign:'center'}}>
                  <div style={{fontSize:10,color:'#888',marginBottom:3}}>{label}</div>
                  <div style={{fontSize:14,fontWeight:700,color}}>BHD {fmtBhd(apAgingData.summary?.[key]||0)}</div>
                </div>
              ))}
            </div>
            <div style={{display:'flex',justifyContent:'flex-end',fontSize:12,fontWeight:700,color:'#e65100',marginBottom:8}}>
              Total AP: BHD {fmtBhd(apAgingData.summary?.total||0)}
            </div>
            {(apAgingData.suppliers||[]).length > 0 && (
              <div style={{border:'1px solid #e0e0e0',borderRadius:3,overflow:'auto',maxHeight:200}}>
                <table style={{width:'100%',borderCollapse:'collapse',fontSize:11}}>
                  <thead><tr style={{background:'#f5f5f5',position:'sticky',top:0}}>
                    <th style={{padding:'4px 8px',textAlign:'left'}}>Supplier</th>
                    <th style={{padding:'4px 8px',textAlign:'right'}}>Current</th>
                    <th style={{padding:'4px 8px',textAlign:'right',color:'#f57c00'}}>1–30d</th>
                    <th style={{padding:'4px 8px',textAlign:'right',color:'#e65100'}}>31–60d</th>
                    <th style={{padding:'4px 8px',textAlign:'right',color:'#c62828'}}>61–90d</th>
                    <th style={{padding:'4px 8px',textAlign:'right',color:'#7b1fa2'}}>90d+</th>
                    <th style={{padding:'4px 8px',textAlign:'right',fontWeight:700}}>Total</th>
                    <th style={{padding:'4px 8px',textAlign:'center'}}></th>
                  </tr></thead>
                  <tbody>
                    {(apAgingData.suppliers||[]).map((s,i)=>(
                      <>
                        <tr key={s.supplier_id} style={{borderBottom:'1px solid #f0f0f0',background:i%2?'#fafafa':'#fff',cursor:'pointer'}}
                          onClick={()=>setApExpanded(apExpanded===s.supplier_id?null:s.supplier_id)}>
                          <td style={{padding:'4px 8px',fontWeight:600}}>{s.supplier_name}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',color:'#2e7d32'}}>{s.current>0?fmtBhd(s.current):'—'}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',color:'#f57c00'}}>{s.b1_30>0?fmtBhd(s.b1_30):'—'}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',color:'#e65100'}}>{s.b31_60>0?fmtBhd(s.b31_60):'—'}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',color:'#c62828'}}>{s.b61_90>0?fmtBhd(s.b61_90):'—'}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',color:'#7b1fa2'}}>{s.b90plus>0?fmtBhd(s.b90plus):'—'}</td>
                          <td style={{padding:'4px 8px',textAlign:'right',fontWeight:700}}>{fmtBhd(s.total)}</td>
                          <td style={{padding:'4px 8px',textAlign:'center',color:'var(--blue)',fontSize:10}}>{apExpanded===s.supplier_id?'▲':'▼'}</td>
                        </tr>
                        {apExpanded===s.supplier_id && (s.purchases||[]).map(p=>(
                          <tr key={p.id} style={{background:'#f0f7ff',borderBottom:'1px solid #e0e0e0'}}>
                            <td style={{padding:'3px 8px 3px 20px',fontSize:10,color:'var(--blue)'}}>{p.purchase_no}</td>
                            <td colSpan={5} style={{padding:'3px 8px',fontSize:10,color:'#666'}}>
                              Due: {fmtDate(p.due_date)}
                              {p.supplier_invoice_no && ` · Supplier Inv: ${p.supplier_invoice_no}`}
                              {p.days_overdue > 0 && <span style={{color:'#c62828',marginLeft:6}}>{p.days_overdue}d overdue</span>}
                            </td>
                            <td style={{padding:'3px 8px',textAlign:'right',fontSize:10,fontWeight:600}}>{fmtBhd(p.balance_due)}</td>
                            <td/>
                          </tr>
                        ))}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(apAgingData.suppliers||[]).length === 0 && (
              <div style={{textAlign:'center',padding:'12px 0',color:'#aaa',fontSize:12}}>No outstanding payables</div>
            )}
          </div>
        </div>
      )}

      {/* VAT Return */}
      <VatReturnPanel />

      {/* Overdue invoices */}
      <div style={{padding:'0 12px 12px'}}>
        <div style={{background:'#fff',border:'1px solid #d0d0d0',borderRadius:3}}>
          <div style={{padding:'8px 12px',fontWeight:600,fontSize:12,borderBottom:'1px solid #eee',display:'flex',justifyContent:'space-between',color:'#c62828'}}>
            Overdue Invoices
            <span style={{fontWeight:400,fontSize:11,color:'var(--blue)',cursor:'pointer'}} onClick={()=>setModule('invoices')}>View all →</span>
          </div>
          {!overdueInvs.length
            ? <div style={{padding:14,color:'#aaa',fontSize:12}}>No overdue invoices — great!</div>
            : (
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'#f5f5f5'}}>
                  <th style={{padding:'5px 10px',textAlign:'left'}}>Invoice</th>
                  <th style={{padding:'5px 10px',textAlign:'left'}}>Customer</th>
                  <th style={{padding:'5px 10px',textAlign:'left'}}>Due Date</th>
                  <th style={{padding:'5px 10px',textAlign:'right'}}>Days Overdue</th>
                  <th style={{padding:'5px 10px',textAlign:'right'}}>Balance BHD</th>
                </tr></thead>
                <tbody>
                  {overdueInvs.map((inv,i) => (
                    <tr key={inv.id} style={{borderBottom:'1px solid #f0f0f0',background:i%2?'#fafafa':'#fff'}}>
                      <td style={{padding:'5px 10px',color:'var(--blue)',fontWeight:600}}>{inv.invoice_no}</td>
                      <td style={{padding:'5px 10px'}}>{inv.customer_name}</td>
                      <td style={{padding:'5px 10px',color:'#c62828'}}>{fmtDate(inv.due_date)}</td>
                      <td style={{padding:'5px 10px',textAlign:'right',color:'#c62828',fontWeight:700}}>{inv.days_overdue}d</td>
                      <td style={{padding:'5px 10px',textAlign:'right',fontWeight:700}}>{fmtBhd(inv.balance_due)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )
          }
        </div>
      </div>
    </div>
  )
}
