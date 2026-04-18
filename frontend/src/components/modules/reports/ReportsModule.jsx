import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { reportApi, invoiceApi } from '../../../services/api'
import { useUIStore, useAuthStore } from '../../../store'
import { fmtBhd, fmtDate } from '../../../utils/format'
import StatementOfAccounts from './StatementOfAccounts'
import InvoiceModal from '../invoices/InvoiceModal'
import toast from 'react-hot-toast'

const REPORT_NAV = [
  { section: 'VAT & Tax' },
  { id: 'vat',          label: 'VAT Report (NBR)' },
  { section: 'Receivables (AR)' },
  { id: 'ar_aging',     label: 'AR Aging' },
  { id: 'overdue',      label: 'Overdue Invoices' },
  { id: 'bad_debt',     label: 'Bad Debt Candidates' },
  { id: 'statement',    label: 'Statement of Accounts' },
  { section: 'Payables (AP)' },
  { id: 'ap_aging',     label: 'AP Aging' },
  { section: 'Sales' },
  { id: 'sales',        label: 'Sales by Period' },
  { id: 'customer',     label: 'Sales by Customer' },
  { id: 'dn_pending',   label: 'DN Pending Invoice' },
  { id: 'sales_product',label: 'Sales by Product' },
  { section: 'Procurement' },
  { id: 'purchase_analysis', label: 'Purchase Analysis' },
  { section: 'Financial' },
  { id: 'pl',           label: 'Profit & Loss' },
  { id: 'bs',           label: 'Balance Sheet' },
  { id: 'bank',         label: 'Bank Reconciliation' },
  { section: 'Inventory' },
  { id: 'stock',        label: 'Stock Valuation' },
  { id: 'lowstock',     label: 'Low Stock Alert' },
  { id: 'inventory_date', label: 'Inventory at Date' },
]

// ── Print helper ───────────────────────────────────────────
function printReport(containerId) {
  const el = document.getElementById(containerId)
  if (!el) { alert('No report data to print. Click Run first.'); return }
  const win = window.open('', '_blank', 'width=900,height=700')
  win.document.write(`<!DOCTYPE html><html><head><title>Report</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 12px; color: #1a1a1a; padding: 20px; }
      table { border-collapse: collapse; width: 100%; margin-bottom: 14px; }
      th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
      th { background: #e8f0fb; font-weight: 700; }
      .right, td:last-child { text-align: right; }
      h3, h4 { color: #1a5fa8; margin: 10px 0 6px; }
      @media print { button { display: none; } }
    </style></head><body>`)
  win.document.write(el.innerHTML)
  win.document.write('</body></html>')
  win.document.close()
  win.focus()
  setTimeout(() => win.print(), 400)
}

// ── CSV export helper ──────────────────────────────────────
function exportCsv(active, { vatData, plData, bsData, overdueData, stockData }) {
  let rows = [], filename = 'report.csv'

  if (active === 'vat' && vatData) {
    filename = 'vat-report.csv'
    rows = [['Invoice No','Date','Customer','Net BHD','VAT BHD','Total BHD'],
      ...(vatData.output_vat?.rows || []).map(r => [r.invoice_no, r.invoice_date?.split('T')[0], r.customer_name, r.net_amount, r.vat_amount, r.grand_total]),
    ]
  } else if (active === 'pl' && plData) {
    filename = 'profit-loss.csv'
    rows = [['Category','Amount BHD'],
      ['Revenue', plData.revenue?.total || 0],
      ['Cost of Goods', plData.cogs?.total || 0],
      ['Gross Profit', plData.gross_profit || 0],
      ['Expenses', plData.expenses?.total || 0],
      ['Net Profit', plData.net_profit || 0],
    ]
  } else if (active === 'overdue' && overdueData) {
    filename = 'overdue-invoices.csv'
    const list = overdueData.data || overdueData
    rows = [['Invoice No','Customer','Invoice Date','Due Date','Grand Total','Balance Due','Days Overdue'],
      ...(list || []).map(r => [r.invoice_no, r.customer_name, r.invoice_date?.split('T')[0], r.due_date?.split('T')[0], r.grand_total, r.balance_due, r.days_overdue]),
    ]
  } else if ((active === 'stock' || active === 'lowstock') && stockData) {
    filename = 'stock-report.csv'
    const list = (stockData.data || stockData || []).filter(r => active === 'lowstock' ? parseFloat(r.stock_qty) <= parseFloat(r.stock_min) : true)
    rows = [['SKU','Name','Category','Unit','Stock Qty','Min Qty','Cost Price','Stock Value'],
      ...list.map(r => [r.sku, r.name, r.category_name || '', r.unit, r.stock_qty, r.stock_min, r.cost_price, (parseFloat(r.stock_qty) * parseFloat(r.cost_price || 0)).toFixed(3)]),
    ]
  } else {
    alert('Run the report first before exporting.')
    return
  }

  const csv = rows.map(r => r.map(v => `"${String(v ?? '').replace(/"/g,'""')}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
}

export default function ReportsModule() {
  const [active,  setActive]  = useState('vat')
  const [from,    setFrom]    = useState(() => `${new Date().getFullYear()}-01-01`)
  const [to,      setTo]      = useState(() => new Date().toISOString().slice(0, 10))
  const [spSortBy, setSpSortBy] = useState('revenue')
  const [paMode,   setPaMode]   = useState('supplier')
  const [invDate,  setInvDate]  = useState(() => new Date().toISOString().slice(0, 10))

  const { data: vatData, refetch: runVat } = useQuery({
    queryKey: ['report-vat', from, to],
    queryFn:  () => reportApi.vat({ from, to }).then(r => r.data.data),
    enabled:  false,
  })
  const { data: plData, refetch: runPl } = useQuery({
    queryKey: ['report-pl', from, to],
    queryFn:  () => reportApi.profitLoss({ from, to }).then(r => r.data.data),
    enabled:  false,
  })
  const { data: bsData, refetch: runBs } = useQuery({
    queryKey: ['report-bs', to],
    queryFn:  () => reportApi.balanceSheet({ as_at: to }).then(r => r.data.data),
    enabled:  false,
  })
  const { data: overdueData, refetch: runOverdue } = useQuery({
    queryKey: ['report-overdue'],
    queryFn:  () => reportApi.overdue().then(r => r.data),
    enabled:  false,
  })
  const { data: arAgingData, refetch: runArAging } = useQuery({
    queryKey: ['report-ar-aging'],
    queryFn:  () => reportApi.arAging().then(r => r.data.data),
    enabled:  false,
  })
  const { data: apAgingData, refetch: runApAging } = useQuery({
    queryKey: ['report-ap-aging'],
    queryFn:  () => reportApi.apAging().then(r => r.data.data),
    enabled:  false,
  })
  const { data: stockData, refetch: runStock } = useQuery({
    queryKey: ['report-stock'],
    queryFn:  () => reportApi.stock().then(r => r.data),
    enabled:  false,
  })
  const { data: badDebtData, refetch: runBadDebt, isFetching: bdLoading } = useQuery({
    queryKey: ['report-bad-debt'],
    queryFn:  () => reportApi.badDebt().then(r => r.data),
    enabled:  false,
  })
  const { data: salesProductData, refetch: runSalesProduct, isFetching: spLoading } = useQuery({
    queryKey: ['report-sales-product', from, to, spSortBy],
    queryFn:  () => reportApi.salesByProduct({ from, to, sort_by: spSortBy }).then(r => r.data.data),
    enabled:  false,
  })
  const { data: purchaseAnalysisData, refetch: runPurchaseAnalysis, isFetching: paLoading } = useQuery({
    queryKey: ['report-purchase-analysis', from, to, paMode],
    queryFn:  () => reportApi.purchaseAnalysis({ from, to, group_by: paMode }).then(r => r.data.data),
    enabled:  false,
  })
  const { data: inventoryDateData, refetch: runInventoryDate, isFetching: idLoading } = useQuery({
    queryKey: ['report-inventory-date', invDate],
    queryFn:  () => reportApi.inventoryAtDate({ as_at: invDate }).then(r => r.data.data),
    enabled:  false,
  })

  const handleRun = () => {
    if (active === 'vat')      runVat()
    if (active === 'pl')       runPl()
    if (active === 'bs')       runBs()
    if (active === 'overdue')  runOverdue()
    if (active === 'ar_aging') runArAging()
    if (active === 'ap_aging') runApAging()
    if (active === 'stock' || active === 'lowstock') runStock()
    if (active === 'bad_debt') runBadDebt()
    if (active === 'sales_product')    runSalesProduct()
    if (active === 'purchase_analysis') runPurchaseAnalysis()
    if (active === 'inventory_date')   runInventoryDate()
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Reports & Financial Statements</div>
      <div className="report-layout">

        {/* Sidebar */}
        <div className="report-sidebar">
          {REPORT_NAV.map((item, i) => {
            if (item.section) return <div key={i} className="section-head">{item.section}</div>
            return (
              <div key={item.id}
                className={`report-item ${active === item.id ? 'active' : ''}`}
                onClick={() => setActive(item.id)}>
                {item.label}
              </div>
            )
          })}
        </div>

        {/* Content */}
        <div className="report-content">
          {/* Filters — hidden for Statement (has its own), aging, and bad_debt (point-in-time) */}
          {active !== 'statement' && active !== 'ar_aging' && active !== 'ap_aging' && active !== 'bad_debt' && (
            <div style={{ display:'flex', gap:8, alignItems:'flex-end', marginBottom:14, flexWrap:'wrap' }}>
              {active === 'inventory_date' ? (
                <div className="field">
                  <label>As At Date</label>
                  <input type="date" value={invDate} onChange={e => setInvDate(e.target.value)} style={{ width:140 }} />
                </div>
              ) : (
                <>
                  <div className="field">
                    <label>From Date</label>
                    <input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ width:140 }} />
                  </div>
                  <div className="field">
                    <label>To Date</label>
                    <input type="date" value={to} onChange={e => setTo(e.target.value)} style={{ width:140 }} />
                  </div>
                </>
              )}
              {active === 'sales_product' && (
                <div className="field">
                  <label>Sort By</label>
                  <select value={spSortBy} onChange={e => setSpSortBy(e.target.value)} style={{ width:120 }}>
                    <option value="revenue">Revenue</option>
                    <option value="qty">Qty Sold</option>
                    <option value="profit">Profit</option>
                  </select>
                </div>
              )}
              {active === 'purchase_analysis' && (
                <div className="field">
                  <label>Group By</label>
                  <select value={paMode} onChange={e => setPaMode(e.target.value)} style={{ width:130 }}>
                    <option value="supplier">Supplier</option>
                    <option value="category">Category</option>
                  </select>
                </div>
              )}
              <button className="btn primary" onClick={handleRun}>▶ Run Report</button>
              <button className="btn" onClick={() => printReport('report-content-area')}>🖨 Print</button>
              <button className="btn" onClick={() => exportCsv(active, { vatData, plData, bsData, overdueData, stockData })}>📤 Export CSV</button>
            </div>
          )}

          <div id="report-content-area">
          {active === 'statement' && <StatementOfAccounts />}
          {active === 'vat'      && <VatReport    data={vatData}    from={from} to={to} />}
          {active === 'pl'       && <PLReport     data={plData}     from={from} to={to} />}
          {active === 'bs'       && <BSReport     data={bsData}     asAt={to} />}
          {active === 'overdue'  && <OverdueReport data={overdueData} />}
          {active === 'ar_aging' && <AgingReport  data={arAgingData} type="ar" onRun={runArAging} />}
          {active === 'ap_aging' && <AgingReport  data={apAgingData} type="ap" onRun={runApAging} />}
          {active === 'stock'    && <StockReport   data={stockData} />}
          {active === 'lowstock' && <StockReport   data={stockData} lowOnly />}
          {active === 'bad_debt'          && <BadDebtReport data={badDebtData} loading={bdLoading} onRun={runBadDebt} />}
          {active === 'sales_product'     && <SalesProductReport data={salesProductData} loading={spLoading} sortBy={spSortBy} from={from} to={to} />}
          {active === 'purchase_analysis' && <PurchaseAnalysisReport data={purchaseAnalysisData} loading={paLoading} mode={paMode} from={from} to={to} />}
          {active === 'inventory_date'    && <InventoryAtDateReport data={inventoryDateData} loading={idLoading} asAt={invDate} />}
          {!['vat','pl','bs','overdue','ar_aging','ap_aging','stock','lowstock','statement','bad_debt','sales_product','purchase_analysis','inventory_date'].includes(active) && (
            <div className="empty-state">
              <div className="icon">📊</div>
              <div>Select date range and click Run to generate this report</div>
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── VAT Report ─────────────────────────────────────────────
function VatReport({ data, from, to }) {
  if (!data) return <div className="empty-state"><div className="icon">🧾</div><div>Click Run to generate the VAT report</div></div>
  const { output_vat, input_vat, summary, nbr_filing } = data

  return (
    <div>
      {/* NBR Summary boxes */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:14 }}>
        <div style={{ background:'#fdecea', border:'1px solid #ef9a9a', borderRadius:3, padding:'10px 14px' }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:4, textTransform:'uppercase' }}>Output VAT (Collected)</div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--red)' }}>BHD {fmtBhd(summary.output_vat)}</div>
        </div>
        <div style={{ background:'var(--green-light)', border:'1px solid #a5d6a7', borderRadius:3, padding:'10px 14px' }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:4, textTransform:'uppercase' }}>Input VAT (Reclaimable)</div>
          <div style={{ fontSize:20, fontWeight:700, color:'var(--green)' }}>BHD {fmtBhd(summary.input_vat)}</div>
        </div>
        <div style={{ background:'var(--amber-light)', border:'2px solid #ffb74d', borderRadius:3, padding:'10px 14px' }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:4, textTransform:'uppercase', fontWeight:700 }}>Net VAT Payable to NBR</div>
          <div style={{ fontSize:22, fontWeight:700, color:'var(--red)' }}>BHD {fmtBhd(summary.net_vat_payable)}</div>
        </div>
      </div>

      {/* NBR Box mapping */}
      <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'10px 14px', marginBottom:14 }}>
        <div style={{ fontSize:12, fontWeight:700, color:'var(--blue)', marginBottom:8 }}>NBR FILING REFERENCE — VAT RETURN BOXES</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:12 }}>
          <div><strong style={{ color:'var(--blue)' }}>Box 1</strong> — Taxable Supplies: BHD {fmtBhd(nbr_filing?.box_1_taxable_supplies)}</div>
          <div><strong style={{ color:'var(--red)' }}>Box 2</strong> — Output VAT: BHD {fmtBhd(nbr_filing?.box_2_output_vat)}</div>
          <div><strong style={{ color:'var(--green)' }}>Box 3</strong> — Input VAT: BHD {fmtBhd(nbr_filing?.box_3_input_vat)}</div>
          <div><strong style={{ color:'var(--amber)' }}>Box 4</strong> — Net Payable: BHD {fmtBhd(nbr_filing?.box_4_net_vat_payable)}</div>
        </div>
        <div style={{ fontSize:11, color:'#555', marginTop:6 }}>{nbr_filing?.note}</div>
      </div>

      {/* Output detail */}
      <SectionHead>Output VAT — Sales Invoices</SectionHead>
      <ReportTable
        cols={['Invoice No.','Date','Customer','Customer VAT','Net BHD','VAT 10%','Total BHD']}
        rows={(output_vat?.rows || []).map(r => [r.invoice_no, fmtDate(r.invoice_date), r.customer_name, r.customer_vat || '—', fmtBhd(r.net_amount), fmtBhd(r.vat_amount), fmtBhd(r.grand_total)])}
        totals={['','','','Total:', fmtBhd(output_vat?.total_net), fmtBhd(output_vat?.total_vat), '']}
      />

      <div style={{ marginTop:14 }} />
      <SectionHead>Input VAT — Purchases & Expenses</SectionHead>
      <ReportTable
        cols={['Reference','Date','Supplier / Description','Source','Net BHD','VAT BHD']}
        rows={(input_vat?.rows || []).map(r => [r.ref_no, fmtDate(r.txn_date), r.supplier_name, r.source, fmtBhd(r.net_amount), fmtBhd(r.vat_amount)])}
        totals={['','','','Total:',fmtBhd(input_vat?.rows?.reduce((s,r)=>s+parseFloat(r.net_amount||0),0)), fmtBhd(input_vat?.total_vat)]}
      />
    </div>
  )
}

// ── P&L ────────────────────────────────────────────────────
function PLReport({ data, from, to }) {
  if (!data) return <div className="empty-state"><div className="icon">📈</div><div>Click Run to generate P&L</div></div>
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:12, paddingBottom:6, borderBottom:'1px solid #ddd' }}>
        Profit & Loss Statement — {fmtDate(from)} to {fmtDate(to)}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <AccountBox title="Revenue" color="var(--green)">
          {(data.revenue?.rows || []).map(r => <AccRow key={r.category} label={r.category || 'General'} value={fmtBhd(r.net_sales)} />)}
          <AccTotal label="Total Revenue" value={fmtBhd(data.revenue?.total)} />
        </AccountBox>
        <AccountBox title="Cost of Goods Sold" color="var(--red)">
          <AccRow label="Direct cost of sales" value={fmtBhd(data.cogs?.direct_cost)} />
          <AccRow label="Purchases"             value={fmtBhd(data.cogs?.purchases)} />
          <AccTotal label="Total COGS"          value={fmtBhd(data.cogs?.total)} />
        </AccountBox>
      </div>
      <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'8px 14px', margin:'10px 0', display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontWeight:700, color:'var(--blue)' }}>Gross Profit</span>
        <span style={{ fontWeight:700, color:'var(--blue)', fontSize:16 }}>BHD {fmtBhd(data.gross_profit)}</span>
      </div>
      <AccountBox title="Operating Expenses" color="var(--amber)">
        {(data.expenses?.rows || []).map(r => <AccRow key={r.category} label={r.category || 'General'} value={fmtBhd(r.total)} />)}
        <AccTotal label="Total Expenses" value={fmtBhd(data.expenses?.total)} />
      </AccountBox>
      <div style={{ background:parseFloat(data.net_profit)>=0?'var(--green-light)':'var(--red-light)', border:`2px solid ${parseFloat(data.net_profit)>=0?'#66bb6a':'#ef5350'}`, borderRadius:3, padding:'10px 14px', marginTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
        <span style={{ fontSize:13, fontWeight:700, color: parseFloat(data.net_profit)>=0?'var(--green)':'var(--red)' }}>NET PROFIT — {data.margin_pct}% margin</span>
        <span style={{ fontSize:18, fontWeight:700, color: parseFloat(data.net_profit)>=0?'var(--green)':'var(--red)' }}>BHD {fmtBhd(data.net_profit)}</span>
      </div>
    </div>
  )
}

// ── Balance Sheet ──────────────────────────────────────────
function BSReport({ data, asAt }) {
  if (!data) return <div className="empty-state"><div className="icon">⚖️</div><div>Click Run to generate Balance Sheet</div></div>
  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:12, paddingBottom:6, borderBottom:'1px solid #ddd' }}>
        Balance Sheet — as at {fmtDate(asAt)}
        {!data.check?.balanced && <span style={{ marginLeft:12, color:'var(--red)', fontSize:11 }}>⚠️ Not balanced — check manual entries</span>}
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
        <AccountBox title="Assets" color="var(--blue)">
          <div style={{ fontSize:11, fontWeight:700, color:'#555', padding:'3px 0', textTransform:'uppercase' }}>Current Assets</div>
          <AccRow label="Cash at bank"        value={fmtBhd(data.assets?.cash_at_bank)} sub />
          <AccRow label="Accounts receivable" value={fmtBhd(data.assets?.accounts_receivable)} sub />
          <AccRow label="Inventory (stock)"   value={fmtBhd(data.assets?.inventory)} sub />
          <AccRow label="VAT receivable"      value={fmtBhd(data.assets?.vat_receivable)} sub />
          <AccTotal label="Total Assets"      value={fmtBhd(data.assets?.total)} />
        </AccountBox>
        <AccountBox title="Liabilities & Equity" color="var(--red)">
          <div style={{ fontSize:11, fontWeight:700, color:'#555', padding:'3px 0', textTransform:'uppercase' }}>Current Liabilities</div>
          <AccRow label="Accounts payable"    value={fmtBhd(data.liabilities?.accounts_payable)} sub />
          <AccRow label="VAT payable (NBR)"   value={fmtBhd(data.liabilities?.vat_payable)} sub />
          <AccTotal label="Total Liabilities" value={fmtBhd(data.liabilities?.total)} />
          <div style={{ height:8 }} />
          <div style={{ fontSize:11, fontWeight:700, color:'#555', padding:'3px 0', textTransform:'uppercase' }}>Equity</div>
          <AccRow label="Total Equity"        value={fmtBhd(data.equity?.total)} sub />
        </AccountBox>
      </div>
    </div>
  )
}

// ── Overdue ────────────────────────────────────────────────
function OverdueReport({ data }) {
  if (!data) return <div className="empty-state"><div className="icon">⏰</div><div>Click Run to view overdue invoices</div></div>
  return (
    <div>
      <div style={{ background:'var(--red-light)', border:'1px solid #ef9a9a', borderRadius:3, padding:'8px 14px', marginBottom:12, display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontWeight:700, color:'var(--red)' }}>Total Overdue</span>
        <span style={{ fontWeight:700, color:'var(--red)', fontSize:16 }}>BHD {fmtBhd(data.total_overdue)}</span>
      </div>
      <ReportTable
        cols={['Invoice No.','Date','Due Date','Customer','Tel','Total BHD','Balance BHD','Days Overdue']}
        rows={(data.data || []).map(r => [r.invoice_no, fmtDate(r.invoice_date), fmtDate(r.due_date), r.customer_name, r.customer_tel, fmtBhd(r.grand_total), fmtBhd(r.balance_due), r.days_overdue + ' days'])}
      />
    </div>
  )
}

// ── Stock ──────────────────────────────────────────────────
function StockReport({ data, lowOnly }) {
  if (!data) return <div className="empty-state"><div className="icon">📦</div><div>Click Run to view stock report</div></div>
  const rows = (data.data || []).filter(r => !lowOnly || r.is_low_stock)
  return (
    <div>
      <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'8px 14px', marginBottom:12, display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontWeight:700, color:'var(--blue)' }}>Total Stock Value</span>
        <span style={{ fontWeight:700, color:'var(--blue)', fontSize:16 }}>BHD {fmtBhd(data.total_value)}</span>
      </div>
      <ReportTable
        cols={['SKU','Product','Category','Brand','Stock Qty','Cost BHD','Stock Value','Price 1','Status']}
        rows={rows.map(r => [r.sku, r.name, r.category || '—', r.brand || '—', r.stock_qty, fmtBhd(r.cost_price), fmtBhd(r.stock_value), fmtBhd(r.price_1), r.is_low_stock ? '⚠️ Low' : '✓ OK'])}
      />
    </div>
  )
}

// ── AR / AP Aging ──────────────────────────────────────────
function AgingReport({ data, type, onRun }) {
  const [expanded, setExpanded] = useState(null)
  const isAR = type === 'ar'

  if (!data) return (
    <div className="empty-state">
      <div className="icon">{isAR ? '📥' : '📤'}</div>
      <div>Click Run to generate the {isAR ? 'Accounts Receivable' : 'Accounts Payable'} Aging report</div>
      <button className="btn primary" style={{ marginTop:12 }} onClick={onRun}>▶ Run Report</button>
    </div>
  )

  const { summary } = data
  const entities = isAR ? data.customers : data.suppliers
  const buckets = isAR
    ? [['current','Current (not due)'],['b1_30','1–30 days'],['b31_60','31–60 days'],['b61_90','61–90 days'],['b90plus','90+ days']]
    : [['b1_30','1–30 days'],['b31_60','31–60 days'],['b61_90','61–90 days'],['b90plus','90+ days']]

  const bktColor = (k) =>
    k === 'current' ? 'var(--green)' :
    k === 'b1_30'   ? 'var(--blue)'  :
    k === 'b31_60'  ? 'var(--amber)' :
    k === 'b61_90'  ? '#e65100'      : 'var(--red)'

  return (
    <div>
      {/* Title */}
      <div style={{ fontSize:13, fontWeight:700, marginBottom:12, paddingBottom:6, borderBottom:'1px solid #ddd' }}>
        {isAR ? 'Accounts Receivable Aging' : 'Accounts Payable Aging'} — as at {new Date().toLocaleDateString('en-BH',{day:'2-digit',month:'short',year:'numeric'})}
      </div>

      {/* Summary buckets */}
      <div style={{ display:'grid', gridTemplateColumns: isAR ? 'repeat(6,1fr)' : 'repeat(5,1fr)', gap:8, marginBottom:14 }}>
        {buckets.map(([k, label]) => (
          <div key={k} style={{ background:'#f8f8f8', border:`2px solid ${bktColor(k)}`, borderRadius:3, padding:'8px 10px', textAlign:'center' }}>
            <div style={{ fontSize:10, color:'#555', marginBottom:3 }}>{label}</div>
            <div style={{ fontSize:15, fontWeight:700, color: bktColor(k) }}>BHD {fmtBhd(summary[k])}</div>
          </div>
        ))}
        <div style={{ background:'#222', border:'2px solid #222', borderRadius:3, padding:'8px 10px', textAlign:'center' }}>
          <div style={{ fontSize:10, color:'#aaa', marginBottom:3 }}>Total Outstanding</div>
          <div style={{ fontSize:15, fontWeight:700, color:'#fff' }}>BHD {fmtBhd(summary.total)}</div>
        </div>
      </div>

      {/* Per-entity aging table */}
      <table className="data-table" style={{ fontSize:12 }}>
        <thead>
          <tr>
            <th>{isAR ? 'Customer' : 'Supplier'}</th>
            {isAR && <th className="right">Current</th>}
            <th className="right">1–30 days</th>
            <th className="right">31–60 days</th>
            <th className="right">61–90 days</th>
            <th className="right">90+ days</th>
            <th className="right">Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {entities.length === 0 && <tr className="empty-row"><td colSpan={8}>No outstanding {isAR ? 'receivables' : 'payables'}</td></tr>}
          {entities.map(e => {
            const id = isAR ? e.customer_id : e.supplier_id
            const name = isAR ? e.customer_name : e.supplier_name
            const isOpen = expanded === id
            const rows = isAR ? e.invoices : e.purchases
            return [
              <tr key={id} style={{ cursor:'pointer', background: isOpen ? 'var(--blue-light)' : undefined }}
                  onClick={() => setExpanded(isOpen ? null : id)}>
                <td><strong>{name}</strong></td>
                {isAR && <td className="right" style={{ color:'var(--green)' }}>{e.current > 0 ? `BHD ${fmtBhd(e.current)}` : '—'}</td>}
                <td className="right" style={{ color: e.b1_30  > 0 ? 'var(--blue)'  : '#999' }}>{e.b1_30  > 0 ? `BHD ${fmtBhd(e.b1_30)}`  : '—'}</td>
                <td className="right" style={{ color: e.b31_60 > 0 ? 'var(--amber)' : '#999' }}>{e.b31_60 > 0 ? `BHD ${fmtBhd(e.b31_60)}` : '—'}</td>
                <td className="right" style={{ color: e.b61_90 > 0 ? '#e65100'      : '#999' }}>{e.b61_90 > 0 ? `BHD ${fmtBhd(e.b61_90)}` : '—'}</td>
                <td className="right" style={{ color: e.b90plus> 0 ? 'var(--red)'   : '#999' }}>{e.b90plus> 0 ? `BHD ${fmtBhd(e.b90plus)}`:'—'}</td>
                <td className="right"><strong>BHD {fmtBhd(e.total)}</strong></td>
                <td style={{ color:'var(--blue)', fontSize:10 }}>{isOpen ? '▲ Hide' : '▼ Detail'}</td>
              </tr>,
              isOpen && (
                <tr key={`${id}-detail`}>
                  <td colSpan={isAR ? 8 : 7} style={{ padding:0 }}>
                    <table style={{ width:'100%', fontSize:11, background:'#f8f9fb' }}>
                      <thead>
                        <tr style={{ background:'#e4e8ee' }}>
                          <th style={{ padding:'4px 10px', textAlign:'left' }}>{isAR ? 'Invoice No.' : 'Purchase No.'}</th>
                          <th style={{ padding:'4px 10px', textAlign:'left' }}>Date</th>
                          {isAR && <th style={{ padding:'4px 10px', textAlign:'left' }}>Due Date</th>}
                          <th style={{ padding:'4px 10px', textAlign:'left' }}>Bucket</th>
                          <th style={{ padding:'4px 10px', textAlign:'right' }}>Total</th>
                          <th style={{ padding:'4px 10px', textAlign:'right' }}>Paid</th>
                          <th style={{ padding:'4px 10px', textAlign:'right' }}>Balance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map(r => (
                          <tr key={r.id}>
                            <td style={{ padding:'3px 10px' }}>{isAR ? r.invoice_no : r.purchase_no}</td>
                            <td style={{ padding:'3px 10px' }}>{fmtDate(isAR ? r.invoice_date : r.purchase_date)}</td>
                            {isAR && <td style={{ padding:'3px 10px' }}>{r.due_date ? fmtDate(r.due_date) : '—'}</td>}
                            <td style={{ padding:'3px 10px', color: bktColor(r.bucket), fontWeight:600 }}>
                              {r.bucket === 'current' ? 'Current' : r.bucket === 'b1_30' ? '1–30 days' : r.bucket === 'b31_60' ? '31–60 days' : r.bucket === 'b61_90' ? '61–90 days' : '90+ days'}
                            </td>
                            <td style={{ padding:'3px 10px', textAlign:'right' }}>BHD {fmtBhd(r.grand_total)}</td>
                            <td style={{ padding:'3px 10px', textAlign:'right' }}>BHD {fmtBhd(r.amount_paid)}</td>
                            <td style={{ padding:'3px 10px', textAlign:'right', fontWeight:700 }}>BHD {fmtBhd(r.balance_due)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </td>
                </tr>
              )
            ]
          })}
          <tr style={{ fontWeight:700, background:'#f0f0f0', borderTop:'2px solid #bbb' }}>
            <td>TOTAL</td>
            {isAR && <td className="right">BHD {fmtBhd(summary.current)}</td>}
            <td className="right">BHD {fmtBhd(summary.b1_30)}</td>
            <td className="right">BHD {fmtBhd(summary.b31_60)}</td>
            <td className="right">BHD {fmtBhd(summary.b61_90)}</td>
            <td className="right">BHD {fmtBhd(summary.b90plus)}</td>
            <td className="right">BHD {fmtBhd(summary.total)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ── Shared sub-components ──────────────────────────────────
function SectionHead({ children }) {
  return <div style={{ background:'#e4e8ee', padding:'4px 10px', fontWeight:700, fontSize:12, color:'#333', marginBottom:4 }}>{children}</div>
}

function ReportTable({ cols, rows, totals }) {
  return (
    <table className="data-table" style={{ fontSize:12 }}>
      <thead><tr>{cols.map((c,i) => <th key={i} className={i >= cols.length-3 ? 'right' : ''}>{c}</th>)}</tr></thead>
      <tbody>
        {rows.length === 0 && <tr className="empty-row"><td colSpan={cols.length}>No data</td></tr>}
        {rows.map((row, i) => (
          <tr key={i}>{row.map((cell, j) => <td key={j} className={j >= cols.length-3 ? 'right' : ''}>{cell}</td>)}</tr>
        ))}
        {totals && (
          <tr style={{ fontWeight:700, background:'#f5f5f5', borderTop:'2px solid #bbb' }}>
            {totals.map((c, i) => <td key={i} className={i >= cols.length-3 ? 'right' : ''} style={{ padding:'5px 9px' }}>{c}</td>)}
          </tr>
        )}
      </tbody>
    </table>
  )
}

function AccountBox({ title, color, children }) {
  return (
    <div style={{ background:'#f8f8f8', border:'1px solid #d0d0d0', borderRadius:3, padding:'10px 12px' }}>
      <div style={{ fontSize:12, fontWeight:700, marginBottom:8, color, paddingBottom:5, borderBottom:`2px solid ${color}` }}>{title}</div>
      {children}
    </div>
  )
}

function AccRow({ label, value, sub }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'2px 0', paddingLeft: sub ? 14 : 0, fontSize:12 }}>
      <span style={{ color: sub ? '#555' : '#333' }}>{label}</span>
      <span>{value}</span>
    </div>
  )
}

function AccTotal({ label, value }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', marginTop:4, fontWeight:700, borderTop:'2px solid #bbb', fontSize:12.5, background:'#f0f0f0', paddingLeft:4 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  )
}

// ── Bad Debt Candidates Report ─────────────────────────────
const RISK_META = {
  candidate: { label:'Bad Debt Candidate',   color:'#b71c1c', bg:'#fdecea', border:'#ef9a9a', desc:'1yr+ overdue, no recent activity — recommend write-off review' },
  watchlist:  { label:'Watchlist',           color:'#e65100', bg:'#fff3e0', border:'#ffcc80', desc:'90d–1yr overdue, gone quiet — send demand letter now' },
  trading:    { label:'Still Trading',       color:'#f57c00', bg:'#fff8e1', border:'#ffe082', desc:'Has recent invoices but an old unpaid balance — chase specifically' },
  active:     { label:'Active (< 90d)',      color:'#2e7d32', bg:'#e8f5e9', border:'#a5d6a7', desc:'Normal credit terms — no action needed yet' },
  cash:       { label:'Cash Customer (POS)', color:'#555',    bg:'#f5f5f5', border:'#ccc',    desc:'Walk-in cash sales not collected at point of sale' },
}

const WO_REASONS = [
  'Customer unresponsive / untraceable',
  'Customer business closed',
  'Customer declared bankruptcy / insolvent',
  'Debt too small to pursue legally',
  'Dispute settled at reduced amount',
  'Bad debt — legally time-barred',
  'Other',
]

function BadDebtReport({ data, loading, onRun }) {
  const qc      = useQueryClient()
  const isAdmin = useAuthStore(s => s.user?.role === 'admin')
  const { openModal, getModal } = useUIStore()

  const [filter,       setFilter]       = useState('all')
  const [expandedCust, setExpandedCust] = useState(null)
  const [woTarget,     setWoTarget]     = useState(null)   // { customer, invoice }
  const [woReason,     setWoReason]     = useState(WO_REASONS[0])
  const [woNotes,      setWoNotes]      = useState('')
  const [woAmount,     setWoAmount]     = useState('')

  const writeOffMut = useMutation({
    mutationFn: () => invoiceApi.writeOff(woTarget.invoice.id, { reason: woReason, notes: woNotes, amount: woAmount }),
    onSuccess: (res) => {
      toast.success(res.data.message)
      qc.invalidateQueries(['report-bad-debt'])
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['fin-summary'])
      setWoTarget(null); setWoNotes(''); setWoReason(WO_REASONS[0])
    },
  })

  if (!data && !loading) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flex:1, gap:12, padding:40 }}>
      <div style={{ fontSize:40 }}>🔍</div>
      <div style={{ fontSize:16, fontWeight:600, color:'#555' }}>Bad Debt Candidates Analysis</div>
      <div style={{ fontSize:12, color:'#888', maxWidth:420, textAlign:'center' }}>
        Analyses all outstanding AR invoices and segments customers by collection risk.
        Helps you identify which balances to chase, watch, or write off.
      </div>
      <button className="btn primary" onClick={onRun}>▶ Run Analysis</button>
    </div>
  )

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Analysing AR…</div>

  const rows     = data?.data     || []
  const segments = data?.segments || {}

  const filtered = filter === 'all' ? rows : rows.filter(r => r.risk_category === filter)
  const grandTotal = filtered.reduce((s, r) => s + parseFloat(r.balance_due), 0)

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
        <div>
          <div style={{ fontWeight:700, fontSize:15 }}>Bad Debt Candidates Analysis</div>
          <div style={{ fontSize:11, color:'#888' }}>As at {new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })} — outstanding tax invoices only (excludes already written off)</div>
        </div>
        <button className="btn" onClick={onRun}>↻ Refresh</button>
      </div>

      {/* Segment summary cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:8, marginBottom:14 }}>
        {Object.entries(RISK_META).map(([key, meta]) => {
          const seg = segments[key] || {}
          const isActive = filter === key
          return (
            <div key={key} onClick={() => setFilter(f => f === key ? 'all' : key)}
              style={{
                border: `2px solid ${isActive ? meta.color : meta.border}`,
                background: isActive ? meta.bg : '#fff',
                borderRadius:4, padding:'10px 12px', cursor:'pointer',
                boxShadow: isActive ? `0 0 0 2px ${meta.color}33` : 'none',
                transition:'all .15s',
              }}>
              <div style={{ fontSize:11, fontWeight:700, color: meta.color, marginBottom:4 }}>{meta.label}</div>
              <div style={{ fontSize:18, fontWeight:700, color: meta.color }}>BHD {fmtBhd(seg.balance||0)}</div>
              <div style={{ fontSize:11, color:'#888', marginTop:2 }}>{seg.customers||0} customer{seg.customers!==1?'s':''} · {seg.invoices||0} inv.</div>
            </div>
          )
        })}
      </div>

      {/* Filter pill label */}
      {filter !== 'all' && (
        <div style={{ marginBottom:10, padding:'6px 12px', background: RISK_META[filter].bg, border:`1px solid ${RISK_META[filter].border}`, borderRadius:4, fontSize:12, color: RISK_META[filter].color, display:'flex', justifyContent:'space-between' }}>
          <span><strong>{RISK_META[filter].label}:</strong> {RISK_META[filter].desc}</span>
          <span style={{ cursor:'pointer', fontWeight:700 }} onClick={() => setFilter('all')}>✕ Show all</span>
        </div>
      )}

      {/* Customer table */}
      <table className="data-table" style={{ fontSize:12 }}>
        <thead>
          <tr>
            <th style={{ width:28 }}></th>
            <th>Customer</th>
            <th>Risk</th>
            <th className="right">Invoices</th>
            <th className="right">Balance BHD</th>
            <th>Oldest Invoice</th>
            <th>Last Activity</th>
            <th className="right">Days Overdue</th>
            {isAdmin && <th style={{ width:90 }}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {!filtered.length && <tr className="empty-row"><td colSpan={isAdmin?9:8}>No customers in this category</td></tr>}
          {filtered.map(cust => {
            const meta      = RISK_META[cust.risk_category]
            const isExpanded = expandedCust === cust.customer_id
            const invoices  = cust.invoices || []
            const isCandidate = cust.risk_category === 'candidate'
            return [
              <tr key={cust.customer_id}
                style={{ background: isExpanded ? '#f0f7ff' : undefined, cursor:'pointer' }}
                onClick={() => setExpandedCust(v => v === cust.customer_id ? null : cust.customer_id)}>
                <td style={{ textAlign:'center', color:'#aaa', fontSize:11 }}>{isExpanded ? '▼' : '▶'}</td>
                <td style={{ fontWeight:600 }}>{cust.customer_name}</td>
                <td>
                  <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:10,
                    background: meta.bg, color: meta.color, border:`1px solid ${meta.border}` }}>
                    {meta.label}
                  </span>
                </td>
                <td className="right">{cust.invoice_count}</td>
                <td className="right" style={{ fontWeight:700, color: isCandidate ? '#b71c1c' : undefined }}>
                  {fmtBhd(cust.balance_due)}
                </td>
                <td>{fmtDate(cust.oldest_invoice)}</td>
                <td style={{ color: cust.last_invoice_ever < new Date(Date.now()-180*864e5).toISOString().split('T')[0] ? '#b71c1c' : '#2e7d32' }}>
                  {fmtDate(cust.last_invoice_ever)}
                </td>
                <td className="right" style={{ color: cust.max_days_overdue > 365 ? '#b71c1c' : cust.max_days_overdue > 90 ? '#e65100' : '#555', fontWeight:600 }}>
                  {cust.max_days_overdue}d
                </td>
                {isAdmin && (
                  <td onClick={e => e.stopPropagation()}>
                    {isCandidate && (
                      <button className="btn" style={{ fontSize:10, padding:'2px 6px', background:'#7b1fa2', color:'#fff', borderColor:'#6a1b9a' }}
                        onClick={() => {
                          const biggest = [...invoices].sort((a,b) => parseFloat(b.balance_due) - parseFloat(a.balance_due))[0]
                          setWoTarget({ customer: cust, invoice: biggest })
                          setWoAmount(parseFloat(biggest.balance_due).toFixed(3))
                          setWoReason(WO_REASONS[0])
                          setWoNotes('')
                        }}>
                        ✗ Write Off
                      </button>
                    )}
                  </td>
                )}
              </tr>,
              isExpanded && (
                <tr key={`${cust.customer_id}-detail`}>
                  <td colSpan={isAdmin?9:8} style={{ padding:0, background:'#f8fbff' }}>
                    <div style={{ padding:'8px 32px 12px' }}>
                      {cust.customer_tel  && <div style={{ fontSize:11, color:'#666', marginBottom:4 }}>Tel: {cust.customer_tel}</div>}
                      {cust.customer_email && <div style={{ fontSize:11, color:'#666', marginBottom:8 }}>Email: {cust.customer_email}</div>}
                      <table className="data-table" style={{ fontSize:11 }}>
                        <thead>
                          <tr>
                            <th>Invoice No.</th><th>Invoice Date</th><th>Due Date</th>
                            <th className="right">Total BHD</th><th className="right">Balance BHD</th>
                            <th className="right">Days Overdue</th><th>Status</th>
                            {isAdmin && <th></th>}
                          </tr>
                        </thead>
                        <tbody>
                          {invoices.map(inv => (
                            <tr key={inv.id}
                              style={{ cursor:'pointer' }}
                              onClick={() => openModal('invoice', { id: inv.id })}>
                              <td style={{ color:'var(--blue)', fontWeight:600 }}>{inv.invoice_no}</td>
                              <td>{fmtDate(inv.invoice_date)}</td>
                              <td style={{ color: inv.days_overdue > 0 ? '#c62828' : '#555' }}>{fmtDate(inv.due_date)}</td>
                              <td className="right">{fmtBhd(inv.grand_total)}</td>
                              <td className="right" style={{ fontWeight:700, color:'#c62828' }}>{fmtBhd(inv.balance_due)}</td>
                              <td className="right" style={{ color: inv.days_overdue > 365 ? '#b71c1c' : inv.days_overdue > 90 ? '#e65100' : '#888', fontWeight:600 }}>
                                {inv.days_overdue > 0 ? `${inv.days_overdue}d` : 'Current'}
                              </td>
                              <td><span className={`badge badge-${inv.payment_status}`}>{inv.payment_status}</span></td>
                              {isAdmin && (
                                <td onClick={e => e.stopPropagation()}>
                                  <button className="btn" style={{ fontSize:10, padding:'1px 6px', background:'#7b1fa2', color:'#fff', borderColor:'#6a1b9a' }}
                                    onClick={() => {
                                      setWoTarget({ customer: cust, invoice: inv })
                                      setWoAmount(parseFloat(inv.balance_due).toFixed(3))
                                      setWoReason(WO_REASONS[0])
                                      setWoNotes('')
                                    }}>
                                    ✗ Write Off
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )
            ]
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight:700, background:'#f0f4ff', fontSize:12 }}>
            <td colSpan={4} style={{ padding:'6px 8px' }}>Total ({filtered.length} customers)</td>
            <td className="right" style={{ padding:'6px 8px' }}>BHD {fmtBhd(grandTotal)}</td>
            <td colSpan={isAdmin?4:3}></td>
          </tr>
        </tfoot>
      </table>

      {/* Write-off dialog */}
      {woTarget && (
        <div className="modal-overlay" style={{ zIndex:1200 }} onClick={e => e.target===e.currentTarget && setWoTarget(null)}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <h3>Write Off — {woTarget.invoice.invoice_no}</h3>
              <button className="close-btn" onClick={() => setWoTarget(null)}>✕</button>
            </div>
            <div className="modal-toolbar">
              <button className="btn" style={{ background:'#c62828', color:'#fff', borderColor:'#b71c1c' }}
                onClick={() => writeOffMut.mutate()} disabled={writeOffMut.isPending || !woReason}>
                {writeOffMut.isPending ? '⏳ Processing…' : '✓ Confirm Write-Off'}
              </button>
              <button className="btn" onClick={() => setWoTarget(null)}>Cancel</button>
            </div>
            <div className="modal-body" style={{ padding:14 }}>
              <div style={{ background:'#fff3e0', border:'1px solid #ffcc80', borderRadius:4, padding:'8px 12px', marginBottom:12, fontSize:12 }}>
                <strong>{woTarget.customer.customer_name}</strong><br/>
                Invoice: <strong>{woTarget.invoice.invoice_no}</strong> &nbsp;|&nbsp;
                Balance: <strong style={{ color:'#c62828' }}>BHD {parseFloat(woTarget.invoice.balance_due).toFixed(3)}</strong> &nbsp;|&nbsp;
                Overdue: <strong>{woTarget.invoice.days_overdue}d</strong>
              </div>
              <div className="field" style={{ marginBottom:10 }}>
                <label style={{ fontWeight:600 }}>Write-Off Amount BHD *</label>
                <input type="number" step="0.001" value={woAmount} onChange={e => setWoAmount(e.target.value)}
                  style={{ fontWeight:700, fontSize:14 }}/>
              </div>
              <div className="field" style={{ marginBottom:10 }}>
                <label style={{ fontWeight:600 }}>Reason *</label>
                <select value={woReason} onChange={e => setWoReason(e.target.value)}>
                  {WO_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Notes</label>
                <textarea value={woNotes} onChange={e => setWoNotes(e.target.value)} rows={2}
                  placeholder="Collection attempts made, correspondence history…"/>
              </div>
              <div style={{ background:'#fdecea', border:'1px solid #ef9a9a', borderRadius:4, padding:'7px 10px', marginTop:10, fontSize:11, color:'#b71c1c' }}>
                ⚠ This will mark the invoice as paid (bad debt) and remove it from AR. Reversible by admin.
              </div>
            </div>
          </div>
        </div>
      )}

      {getModal('invoice')?.open && <InvoiceModal />}
    </div>
  )
}

// ── Sales by Product ───────────────────────────────────────
function SalesProductReport({ data, loading, sortBy, from, to }) {
  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Loading…</div>
  if (!data) return (
    <div className="empty-state">
      <div className="icon">🏆</div>
      <div>Click Run to view sales by product</div>
    </div>
  )
  const totalRevenue = data.reduce((s, r) => s + parseFloat(r.revenue || 0), 0)
  const totalProfit  = data.reduce((s, r) => s + parseFloat(r.profit  || 0), 0)
  const totalQty     = data.reduce((s, r) => s + parseFloat(r.qty_sold || 0), 0)
  const MEDALS = ['🥇','🥈','🥉']

  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:12, paddingBottom:6, borderBottom:'1px solid #ddd' }}>
        Sales by Product — {fmtDate(from)} to {fmtDate(to)}
        <span style={{ fontSize:11, fontWeight:400, color:'#888', marginLeft:8 }}>sorted by {sortBy}</span>
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10, marginBottom:14 }}>
        <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'8px 14px' }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:3 }}>Total Revenue</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--blue)' }}>BHD {fmtBhd(totalRevenue)}</div>
        </div>
        <div style={{ background:'var(--green-light)', border:'1px solid #a5d6a7', borderRadius:3, padding:'8px 14px' }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:3 }}>Total Profit</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--green)' }}>BHD {fmtBhd(totalProfit)}</div>
        </div>
        <div style={{ background:'#f8f8f8', border:'1px solid #ddd', borderRadius:3, padding:'8px 14px' }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:3 }}>Total Units Sold</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#333' }}>{parseFloat(totalQty).toLocaleString()}</div>
        </div>
      </div>
      <table className="data-table" style={{ fontSize:12 }}>
        <thead>
          <tr>
            <th style={{ width:32 }}>#</th>
            <th>Product</th>
            <th>SKU</th>
            <th>Category</th>
            <th className="right">Qty Sold</th>
            <th className="right">Revenue BHD</th>
            <th className="right">COGS BHD</th>
            <th className="right">Profit BHD</th>
            <th className="right">Margin %</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && <tr className="empty-row"><td colSpan={9}>No sales in this period</td></tr>}
          {data.map((r, i) => {
            const margin = parseFloat(r.revenue) > 0
              ? ((parseFloat(r.profit) / parseFloat(r.revenue)) * 100).toFixed(1)
              : '0.0'
            return (
              <tr key={r.product_id}>
                <td style={{ textAlign:'center', fontWeight:600, color:'#888' }}>
                  {MEDALS[i] || (i + 1)}
                </td>
                <td style={{ fontWeight:600 }}>{r.product_name}</td>
                <td style={{ color:'#888', fontFamily:'monospace' }}>{r.sku || '—'}</td>
                <td>{r.category_name || '—'}</td>
                <td className="right">{parseFloat(r.qty_sold).toLocaleString()}</td>
                <td className="right" style={{ fontWeight:600, color:'var(--blue)' }}>BHD {fmtBhd(r.revenue)}</td>
                <td className="right" style={{ color:'#888' }}>BHD {fmtBhd(r.cogs)}</td>
                <td className="right" style={{ color: parseFloat(r.profit) >= 0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>
                  BHD {fmtBhd(r.profit)}
                </td>
                <td className="right" style={{ color: parseFloat(margin) >= 20 ? 'var(--green)' : parseFloat(margin) >= 10 ? 'var(--amber)' : 'var(--red)' }}>
                  {margin}%
                </td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight:700, background:'#f0f4ff', fontSize:12 }}>
            <td colSpan={4} style={{ padding:'6px 8px' }}>Total ({data.length} products)</td>
            <td className="right" style={{ padding:'6px 8px' }}>{parseFloat(totalQty).toLocaleString()}</td>
            <td className="right" style={{ padding:'6px 8px' }}>BHD {fmtBhd(totalRevenue)}</td>
            <td className="right" style={{ padding:'6px 8px' }}>BHD {fmtBhd(data.reduce((s,r)=>s+parseFloat(r.cogs||0),0))}</td>
            <td className="right" style={{ padding:'6px 8px' }}>BHD {fmtBhd(totalProfit)}</td>
            <td className="right" style={{ padding:'6px 8px' }}>
              {totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0.0'}%
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Purchase Analysis ──────────────────────────────────────
function PurchaseAnalysisReport({ data, loading, mode, from, to }) {
  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Loading…</div>
  if (!data) return (
    <div className="empty-state">
      <div className="icon">🛒</div>
      <div>Click Run to view purchase analysis</div>
    </div>
  )
  const totalAmt = data.reduce((s, r) => s + parseFloat(r.total_amount || 0), 0)
  const labelKey = mode === 'supplier' ? 'supplier_name' : 'category_name'

  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:12, paddingBottom:6, borderBottom:'1px solid #ddd' }}>
        Purchase Analysis by {mode === 'supplier' ? 'Supplier' : 'Category'} — {fmtDate(from)} to {fmtDate(to)}
      </div>
      <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'8px 14px', marginBottom:14, display:'flex', justifyContent:'space-between' }}>
        <span style={{ fontWeight:700, color:'var(--blue)' }}>Total Purchases</span>
        <span style={{ fontWeight:700, color:'var(--blue)', fontSize:16 }}>BHD {fmtBhd(totalAmt)}</span>
      </div>
      <table className="data-table" style={{ fontSize:12 }}>
        <thead>
          <tr>
            <th>{mode === 'supplier' ? 'Supplier' : 'Category'}</th>
            <th className="right">Orders</th>
            <th className="right">Total BHD</th>
            <th className="right">% of Spend</th>
            {mode === 'supplier' && <th className="right">Avg Order BHD</th>}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 && <tr className="empty-row"><td colSpan={mode==='supplier'?5:4}>No purchases in this period</td></tr>}
          {data.map((r, i) => {
            const pct = totalAmt > 0 ? ((parseFloat(r.total_amount) / totalAmt) * 100).toFixed(1) : '0.0'
            return (
              <tr key={i}>
                <td style={{ fontWeight:600 }}>{r[labelKey] || '— Uncategorised —'}</td>
                <td className="right">{r.order_count}</td>
                <td className="right" style={{ fontWeight:600 }}>BHD {fmtBhd(r.total_amount)}</td>
                <td className="right">
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:6 }}>
                    <div style={{ width:60, height:6, background:'#eee', borderRadius:3, overflow:'hidden' }}>
                      <div style={{ width:`${pct}%`, height:'100%', background:'var(--blue)', borderRadius:3 }} />
                    </div>
                    <span>{pct}%</span>
                  </div>
                </td>
                {mode === 'supplier' && (
                  <td className="right">BHD {fmtBhd(r.order_count > 0 ? parseFloat(r.total_amount) / parseFloat(r.order_count) : 0)}</td>
                )}
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight:700, background:'#f0f4ff', fontSize:12 }}>
            <td style={{ padding:'6px 8px' }}>Total ({data.length} {mode === 'supplier' ? 'suppliers' : 'categories'})</td>
            <td className="right" style={{ padding:'6px 8px' }}>{data.reduce((s,r)=>s+parseInt(r.order_count||0),0)}</td>
            <td className="right" style={{ padding:'6px 8px' }}>BHD {fmtBhd(totalAmt)}</td>
            <td colSpan={mode === 'supplier' ? 2 : 1}></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

// ── Inventory at Date ──────────────────────────────────────
function InventoryAtDateReport({ data, loading, asAt }) {
  const [catFilter, setCatFilter] = useState('')
  if (loading) return <div style={{ padding:40, textAlign:'center', color:'#888' }}>Reconstructing inventory…</div>
  if (!data) return (
    <div className="empty-state">
      <div className="icon">📅</div>
      <div>Select a date and click Run to view historical inventory levels</div>
    </div>
  )
  const cats = [...new Set(data.map(r => r.category_name).filter(Boolean))].sort()
  const rows = catFilter ? data.filter(r => r.category_name === catFilter) : data
  const totalValue = rows.reduce((s, r) => s + parseFloat(r.stock_value || 0), 0)

  return (
    <div>
      <div style={{ fontSize:13, fontWeight:700, marginBottom:12, paddingBottom:6, borderBottom:'1px solid #ddd' }}>
        Inventory at Date — {fmtDate(asAt)}
        <span style={{ fontSize:11, fontWeight:400, color:'#888', marginLeft:8 }}>
          (reconstructed from stock movements)
        </span>
      </div>
      <div style={{ display:'flex', gap:10, alignItems:'flex-end', marginBottom:12, flexWrap:'wrap' }}>
        <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'8px 14px', flex:1, minWidth:160 }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:3 }}>Total Value</div>
          <div style={{ fontSize:18, fontWeight:700, color:'var(--blue)' }}>BHD {fmtBhd(totalValue)}</div>
        </div>
        <div style={{ background:'#f8f8f8', border:'1px solid #ddd', borderRadius:3, padding:'8px 14px', flex:1, minWidth:160 }}>
          <div style={{ fontSize:11, color:'#555', marginBottom:3 }}>Total Products</div>
          <div style={{ fontSize:18, fontWeight:700, color:'#333' }}>{rows.length}</div>
        </div>
        <div className="field" style={{ marginBottom:0 }}>
          <label>Category</label>
          <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ width:160 }}>
            <option value="">All categories</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <table className="data-table" style={{ fontSize:12 }}>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Category</th>
            <th className="right">Qty at Date</th>
            <th className="right">Cost BHD</th>
            <th className="right">Stock Value BHD</th>
            <th>Source</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && <tr className="empty-row"><td colSpan={7}>No products</td></tr>}
          {rows.map(r => (
            <tr key={r.product_id}>
              <td style={{ fontFamily:'monospace', color:'#888' }}>{r.sku || '—'}</td>
              <td style={{ fontWeight:600 }}>{r.product_name}</td>
              <td>{r.category_name || '—'}</td>
              <td className="right" style={{ fontWeight:600, color: parseFloat(r.qty_at_date) <= 0 ? 'var(--red)' : undefined }}>
                {parseFloat(r.qty_at_date).toLocaleString()}
              </td>
              <td className="right">BHD {fmtBhd(r.cost_price)}</td>
              <td className="right" style={{ fontWeight:600 }}>BHD {fmtBhd(r.stock_value)}</td>
              <td style={{ fontSize:11, color:'#888' }}>
                {r.source === 'movements' ? '📊 Movements' : '📦 Current'}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ fontWeight:700, background:'#f0f4ff', fontSize:12 }}>
            <td colSpan={5} style={{ padding:'6px 8px' }}>Total ({rows.length} products)</td>
            <td className="right" style={{ padding:'6px 8px' }}>BHD {fmtBhd(totalValue)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
