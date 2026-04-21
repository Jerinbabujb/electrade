import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { invoiceApi, dnApi, productApi, reportApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import { useUIStore } from '../../../store'

const CAT_COLORS = ['var(--blue)','#2e7d32','#f57c00','#6a1b9a','#00695c','#c62828','#888']

const PERIODS = [
  { id: 'month',     label: 'This Month' },
  { id: 'quarter',   label: 'This Quarter' },
  { id: 'ytd',       label: 'YTD' },
  { id: 'year',      label: 'This Year' },
  { id: 'last_year', label: 'Last Year' },
  { id: 'custom',    label: 'Custom' },
]

export default function Dashboard() {
  const { setModule } = useUIStore()

  const [period,    setPeriod]    = useState('quarter')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState('')

  // Only fire the custom query when both dates are set
  const params = period === 'custom'
    ? (customFrom && customTo ? { period, from: customFrom, to: customTo } : null)
    : { period }

  const { data: invData }   = useQuery({ queryKey: ['invoices-dash'],  queryFn: () => invoiceApi.list({ limit: 8, type: 'tax_invoice' }).then(r => r.data.data), initialData: [] })
  const { data: dnData }    = useQuery({ queryKey: ['dns-dash'],       queryFn: () => dnApi.list({ status: 'pending_invoice' }).then(r => r.data.data), initialData: [] })
  const { data: stockData } = useQuery({ queryKey: ['stock-low'],      queryFn: () => productApi.list({ low_stock: 'true' }).then(r => r.data.data),    initialData: [] })
  const { data: dash, isFetching } = useQuery({
    queryKey:  ['dash-summary', period, customFrom, customTo],
    queryFn:   () => params ? reportApi.dashboard(params).then(r => r.data.data) : Promise.resolve(null),
    enabled:   !!params,
    staleTime: 2 * 60 * 1000,
  })

  const invoices   = invData   || []
  const pendingDns = dnData    || []
  const lowStock   = stockData || []
  const kd         = dash      || {}

  // Use backend-computed AR totals (full dataset, not limited to 8)
  const totalOutstand = parseFloat(kd.ar_outstanding  || 0)
  const totalOverdue  = parseFloat(kd.ar_overdue_amount || 0)
  const overdueCount  = parseInt(kd.ar_overdue_count  || 0)
  const pendingValue  = pendingDns.reduce((s, r) => s + parseFloat(r.net_value || 0), 0)

  // Chart data from backend
  const chartData    = kd.sales_chart || []
  const maxBar       = chartData.length ? Math.max(...chartData.map(m => m.total), 1) : 1
  const catSales     = kd.sales_by_category || []
  const periodInfo   = kd.period || {}
  const periodLabel  = periodInfo.label || ''
  const isDaily      = periodInfo.groupBy === 'day'

  // Compute date range for a clicked chart bar
  const barDateRange = (m) => {
    if (isDaily) {
      // m.date is an ISO date string like "2025-04-15"
      const d = typeof m.date === 'string' ? m.date.slice(0, 10) : ''
      return { from: d, to: d }
    } else {
      // m.yr / m.mo — first and last day of that month
      const from = `${m.yr}-${String(m.mo).padStart(2, '0')}-01`
      const to   = new Date(m.yr, m.mo, 0).toISOString().split('T')[0]
      return { from, to }
    }
  }

  const kpis = [
    {
      label: `Sales (${periodLabel || '…'})`,
      value: `BHD ${fmtBhd(kd.total_sales || 0)}`,
      color: 'var(--blue)',
      sub: `${kd.invoice_count ?? 0} tax invoices`,
      mod: 'invoices',
    },
    {
      label: 'Outstanding',
      value: `BHD ${fmtBhd(totalOutstand)}`,
      color: '#e65100',
      sub: 'unpaid + partial',
      mod: 'invoices',
    },
    {
      label: 'Overdue',
      value: `BHD ${fmtBhd(totalOverdue)}`,
      color: '#c62828',
      sub: `${overdueCount} invoices`,
      mod: 'invoices',
    },
    {
      label: 'DNs Pending Invoice',
      value: `${pendingDns.length} DNs`,
      color: '#6a1b9a',
      sub: `BHD ${fmtBhd(pendingValue)}`,
      mod: 'dns',
    },
    {
      label: 'Low Stock Alerts',
      value: `${lowStock.length} items`,
      color: '#c62828',
      sub: 'below minimum',
      mod: 'products',
    },
    {
      label: `VAT Payable (${periodLabel || '…'})`,
      value: `BHD ${fmtBhd(kd.vat_payable || 0)}`,
      color: '#00695c',
      sub: 'output VAT – input VAT',
      mod: 'reports',
    },
    {
      label: `Net Profit (${periodLabel || '…'})`,
      value: `BHD ${fmtBhd(kd.net_profit || 0)}`,
      color: parseFloat(kd.net_profit || 0) >= 0 ? '#2e7d32' : '#c62828',
      sub: kd.margin_pct != null ? `${kd.margin_pct}% margin` : '—',
      mod: 'reports',
    },
    {
      label: 'Stock Value',
      value: `BHD ${fmtBhd(kd.stock_value || 0)}`,
      color: 'var(--blue)',
      sub: `${kd.stock_product_count ?? 0} products with stock`,
      mod: 'products',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'auto', background: '#f0f0f0' }}>

      {/* Header + period selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 12px', flexWrap: 'wrap' }}>
        <div className="module-title" style={{ margin: 0, flex: '0 0 auto' }}>Dashboard</div>

        {/* Period pills */}
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', padding: '8px 0' }}>
          {PERIODS.map(p => (
            <button key={p.id}
              onClick={() => setPeriod(p.id)}
              style={{
                padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                cursor: 'pointer', border: 'none', outline: 'none',
                background: period === p.id ? 'var(--blue)' : '#e0e0e0',
                color:      period === p.id ? '#fff' : '#555',
                transition: 'background .15s',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Custom date inputs */}
        {period === 'custom' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 3, border: '1px solid #ccc' }} />
            <span style={{ color: '#888' }}>to</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              style={{ fontSize: 11, padding: '3px 6px', borderRadius: 3, border: '1px solid #ccc' }} />
          </div>
        )}

        {/* Loading indicator */}
        {isFetching && (
          <span style={{ fontSize: 11, color: '#888', marginLeft: 4 }}>Refreshing…</span>
        )}
      </div>

      {/* KPI tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 9, padding: '0 12px 12px' }}>
        {kpis.map(k => (
          <div key={k.label} onClick={() => setModule(k.mod)}
            style={{
              background: '#fff', border: '1px solid #d0d0d0',
              borderTop: `3px solid ${k.color}`, borderRadius: 3,
              padding: '11px 13px', cursor: 'pointer',
            }}
            onMouseEnter={e => e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,.12)'}
            onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}
          >
            <div style={{ fontSize: 11, color: '#888', textTransform: 'uppercase', letterSpacing: '.4px', marginBottom: 5 }}>{k.label}</div>
            <div style={{ fontSize: 19, fontWeight: 700, color: k.color }}>{k.value}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 9, padding: '0 12px 12px' }}>

        {/* Sales bar chart */}
        <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 3, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>{isDaily ? 'Daily Sales' : 'Monthly Sales'}</span>
            {periodLabel && <span style={{ fontSize: 11, color: '#888', fontWeight: 400 }}>{periodLabel}</span>}
          </div>
          {chartData.length === 0 ? (
            <div style={{ height: 110, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#bbb', fontSize: 12 }}>
              No sales data for this period
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: isDaily && chartData.length > 15 ? 3 : 8, height: 110, overflowX: 'auto' }}>
              {chartData.map((m, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flex: isDaily && chartData.length > 15 ? '0 0 auto' : 1, minWidth: isDaily && chartData.length > 15 ? 18 : undefined }}>
                  <span style={{ fontSize: 9, color: 'var(--blue)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : fmtBhd(m.total)}
                  </span>
                  <div
                    style={{
                      background: 'var(--blue)', borderRadius: '2px 2px 0 0', width: '100%',
                      height: Math.max(4, Math.round(m.total / maxBar * 80)) + 'px',
                      opacity: m.total === 0 ? 0.15 : 1,
                      cursor: m.total > 0 ? 'pointer' : 'default',
                    }}
                    onClick={() => { if (m.total > 0) { const r = barDateRange(m); setModule('invoices', r) } }}
                    onMouseEnter={e => { e.currentTarget.style.opacity = '.6' }}
                    onMouseLeave={e => { e.currentTarget.style.opacity = m.total === 0 ? '0.15' : '1' }}
                  />
                  <span style={{ fontSize: 9, color: '#888', whiteSpace: 'nowrap' }}>{m.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Sales by category */}
        <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 3, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#444', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span>Sales by Category</span>
            {periodLabel && <span style={{ fontSize: 10, color: '#888', fontWeight: 400 }}>{periodLabel}</span>}
          </div>
          {catSales.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, color: '#bbb', fontSize: 12 }}>
              No sales this period
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {catSales.map((c, i) => (
                <div key={c.category} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: CAT_COLORS[i] || '#888', flexShrink: 0 }} />
                  <span style={{ flex: 1, color: '#444', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.category}</span>
                  <div style={{ width: 55, height: 5, background: '#e0e0e0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${c.pct}%`, height: '100%', background: CAT_COLORS[i] || '#888', borderRadius: 3 }} />
                  </div>
                  <span style={{ fontWeight: 600, minWidth: 28, textAlign: 'right' }}>{c.pct}%</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tables */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, padding: '0 12px 12px' }}>
        <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 3 }}>
          <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
            Recent Invoices <span style={{ fontSize: 11, color: 'var(--blue)', cursor: 'pointer', fontWeight: 400 }} onClick={() => setModule('invoices')}>View all →</span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead><tr style={{ background: '#e4e8ee' }}>
              <th style={{ padding: '5px 9px', textAlign: 'left' }}>Invoice</th>
              <th style={{ padding: '5px 9px', textAlign: 'left' }}>Customer</th>
              <th style={{ padding: '5px 9px', textAlign: 'right' }}>Total BHD</th>
              <th style={{ padding: '5px 9px' }}>Status</th>
            </tr></thead>
            <tbody>
              {invoices.slice(0, 6).map((inv, i) => (
                <tr key={inv.id} style={{ borderBottom: '1px solid #f0f0f0', background: i % 2 ? '#fafafa' : '#fff' }}>
                  <td style={{ padding: '4px 9px', color: 'var(--blue)', fontWeight: 600 }}>{inv.invoice_no}</td>
                  <td style={{ padding: '4px 9px' }}>{inv.customer_name}</td>
                  <td style={{ padding: '4px 9px', textAlign: 'right', fontWeight: 600 }}>{fmtBhd(inv.grand_total)}</td>
                  <td style={{ padding: '4px 9px' }}><span className={`badge badge-${inv.payment_status}`}>{inv.payment_status}</span></td>
                </tr>
              ))}
              {!invoices.length && <tr><td colSpan={4} style={{ padding: 16, textAlign: 'center', color: '#aaa' }}>No invoices yet</td></tr>}
            </tbody>
          </table>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 3, flex: 1 }}>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: '#6a1b9a', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              DNs Pending Invoice ({pendingDns.length}) <span style={{ fontSize: 11, color: 'var(--blue)', cursor: 'pointer', fontWeight: 400 }} onClick={() => setModule('dns')}>View all →</span>
            </div>
            {!pendingDns.length
              ? <div style={{ padding: 12, color: '#aaa', fontSize: 12 }}>No pending delivery notes</div>
              : pendingDns.slice(0, 4).map(dn => (
                <div key={dn.id} style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span><span style={{ color: '#00695c', fontWeight: 600 }}>{dn.dn_no}</span><span style={{ color: '#888', marginLeft: 6 }}>{dn.customer_name}</span></span>
                  <span style={{ fontWeight: 600 }}>BHD {fmtBhd(dn.net_value)}</span>
                </div>
              ))
            }
          </div>
          <div style={{ background: '#fff', border: '1px solid #d0d0d0', borderRadius: 3, flex: 1 }}>
            <div style={{ padding: '8px 12px', fontWeight: 600, fontSize: 12, color: '#c62828', borderBottom: '1px solid #eee', display: 'flex', justifyContent: 'space-between' }}>
              Low Stock Alerts ({lowStock.length}) <span style={{ fontSize: 11, color: 'var(--blue)', cursor: 'pointer', fontWeight: 400 }} onClick={() => setModule('products')}>View all →</span>
            </div>
            {!lowStock.length
              ? <div style={{ padding: 12, color: '#aaa', fontSize: 12 }}>All stock levels healthy</div>
              : lowStock.slice(0, 4).map(p => (
                <div key={p.id} style={{ padding: '6px 12px', borderBottom: '1px solid #f0f0f0', fontSize: 12, display: 'flex', justifyContent: 'space-between' }}>
                  <span><span style={{ color: 'var(--blue)', fontWeight: 600 }}>{p.sku}</span><span style={{ color: '#888', marginLeft: 6, fontSize: 11 }}>{p.name}</span></span>
                  <span style={{ color: '#c62828', fontWeight: 600 }}>{p.stock_qty} left</span>
                </div>
              ))
            }
          </div>
        </div>
      </div>
    </div>
  )
}
