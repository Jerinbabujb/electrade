import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi, categoryApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'

// ── Shared helpers ────────────────────────────────────────────────────────────
const thisYear = new Date().getFullYear()
const today    = new Date().toISOString().slice(0, 10)
const yearStart = `${thisYear}-01-01`

function KpiCard({ label, value, sub, color = 'var(--blue)' }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6,
                  padding: '10px 14px', minWidth: 130, flex: 1 }}>
      <div style={{ fontSize: 11, color: '#888', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#aaa', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}

function MarginBar({ pct }) {
  const n = parseFloat(pct) || 0
  const color = n >= 30 ? '#2e7d32' : n >= 15 ? '#f57f17' : '#c62828'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, background: '#f0f0f0', borderRadius: 3, height: 6 }}>
        <div style={{ width: `${Math.min(100, Math.max(0, n))}%`, height: 6,
                      background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 38, textAlign: 'right' }}>
        {n.toFixed(1)}%
      </span>
    </div>
  )
}

function VelocityBadge({ cls }) {
  const map = {
    fast:    { bg: '#e8f5e9', color: '#2e7d32', label: 'Fast' },
    normal:  { bg: '#e3f2fd', color: '#1565c0', label: 'Normal' },
    slow:    { bg: '#fff8e1', color: '#f57f17', label: 'Slow' },
    dormant: { bg: '#ffebee', color: '#c62828', label: 'Dormant' },
  }
  const s = map[cls] || map.dormant
  return (
    <span style={{ background: s.bg, color: s.color, fontSize: 10, fontWeight: 700,
                   padding: '2px 7px', borderRadius: 10 }}>
      {s.label}
    </span>
  )
}

function DateRangePicker({ from, to, onFrom, onTo }) {
  const presets = [
    { label: 'This Year', from: yearStart, to: today },
    { label: 'Last Year', from: `${thisYear - 1}-01-01`, to: `${thisYear - 1}-12-31` },
    { label: 'Last 6M',   from: new Date(Date.now() - 182 * 86400000).toISOString().slice(0, 10), to: today },
    { label: 'Last 3M',   from: new Date(Date.now() -  91 * 86400000).toISOString().slice(0, 10), to: today },
  ]
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <input type="date" value={from} onChange={e => onFrom(e.target.value)}
        style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
      <span style={{ fontSize: 11, color: '#888' }}>to</span>
      <input type="date" value={to} onChange={e => onTo(e.target.value)}
        style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
      {presets.map(p => (
        <button key={p.label} className="btn"
          style={{ fontSize: 11, padding: '2px 8px',
                   background: from === p.from && to === p.to ? 'var(--blue)' : '',
                   color:      from === p.from && to === p.to ? '#fff' : '' }}
          onClick={() => { onFrom(p.from); onTo(p.to) }}>
          {p.label}
        </button>
      ))}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 1 — Stock Velocity
// ═════════════════════════════════════════════════════════════════════════════
function StockVelocityTab() {
  const [days,      setDays]      = useState(90)
  const [catId,     setCatId]     = useState('')
  const [clsFilter, setClsFilter] = useState('all')
  const [q,         setQ]         = useState('')

  const { data: catData } = useQuery({
    queryKey: ['categories', 'product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-velocity', days, catId],
    queryFn:  () => analyticsApi.stockVelocity({ days, category_id: catId || undefined })
                      .then(r => r.data),
  })

  const rows    = data?.data    || []
  const summary = data?.summary || {}

  const filtered = useMemo(() => rows.filter(r => {
    if (clsFilter !== 'all' && r.velocity_class !== clsFilter) return false
    if (q && !r.name.toLowerCase().includes(q.toLowerCase()) &&
             !r.sku?.toLowerCase().includes(q.toLowerCase())) return false
    return true
  }), [rows, clsFilter, q])

  const dayOptions = [30, 60, 90, 180, 365]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#555' }}>Period:</span>
        {dayOptions.map(d => (
          <button key={d} className="btn"
            style={{ fontSize: 11, padding: '2px 8px',
                     background: days === d ? 'var(--blue)' : '',
                     color:      days === d ? '#fff' : '' }}
            onClick={() => setDays(d)}>
            {d}d
          </button>
        ))}
        <select value={catId} onChange={e => setCatId(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All categories</option>
          {(catData || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={clsFilter} onChange={e => setClsFilter(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="all">All classes</option>
          <option value="fast">Fast movers</option>
          <option value="normal">Normal</option>
          <option value="slow">Slow movers</option>
          <option value="dormant">Dormant</option>
        </select>
        <input placeholder="Search product…" value={q} onChange={e => setQ(e.target.value)}
          style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4, width: 160 }} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Fast Movers"   value={summary.fast    || 0} color="#2e7d32" sub="> 1 unit/day" />
        <KpiCard label="Normal"        value={summary.normal  || 0} color="#1565c0" sub="0.1–1 unit/day" />
        <KpiCard label="Slow Movers"   value={summary.slow    || 0} color="#f57f17" sub="< 0.1 unit/day" />
        <KpiCard label="Dormant"       value={summary.dormant || 0} color="#c62828" sub="No sales in period" />
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th>SKU</th>
            <th>Product</th>
            <th>Category</th>
            <th className="right">Sold (qty)</th>
            <th className="right">Velocity/day</th>
            <th className="right">Stock</th>
            <th className="right">Days Supply</th>
            <th className="center">Class</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={8}>Loading…</td></tr>}
            {!isLoading && !filtered.length && (
              <tr className="empty-row"><td colSpan={8}>No products match</td></tr>
            )}
            {filtered.map(r => (
              <tr key={r.id}>
                <td style={{ color: '#888', fontSize: 11 }}>{r.sku || '—'}</td>
                <td style={{ fontWeight: 600 }}>{r.name}</td>
                <td style={{ color: '#666' }}>{r.category}</td>
                <td className="right">{parseFloat(r.qty_sold).toFixed(0)}</td>
                <td className="right" style={{ color: '#555' }}>
                  {parseFloat(r.velocity_per_day).toFixed(2)}
                </td>
                <td className="right"
                  style={{ color: parseFloat(r.stock_qty) <= parseFloat(r.stock_min || 0) ? '#c62828' : 'inherit',
                           fontWeight: parseFloat(r.stock_qty) <= parseFloat(r.stock_min || 0) ? 700 : 400 }}>
                  {parseFloat(r.stock_qty).toFixed(0)}
                  {parseFloat(r.stock_qty) <= parseFloat(r.stock_min || 0) &&
                    <span style={{ fontSize: 10, marginLeft: 4, color: '#c62828' }}>⚠ low</span>}
                </td>
                <td className="right" style={{ color: r.days_of_supply < 30 ? '#c62828' : '#555' }}>
                  {r.days_of_supply != null ? `${r.days_of_supply}d` : '∞'}
                </td>
                <td className="center"><VelocityBadge cls={r.velocity_class} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Showing {filtered.length} of {rows.length} tracked products · Period: last {days} days
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 2 — Gross Margin
// ═════════════════════════════════════════════════════════════════════════════
function GrossMarginTab() {
  const [from,     setFrom]     = useState(yearStart)
  const [to,       setTo]       = useState(today)
  const [expanded, setExpanded] = useState(null)   // category name currently drilled into

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-margin', from, to],
    queryFn:  () => analyticsApi.grossMargin({ from, to }).then(r => r.data),
  })

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['analytics-margin-detail', expanded, from, to],
    queryFn:  () => analyticsApi.grossMarginDetail({ category: expanded, from, to }).then(r => r.data),
    enabled:  !!expanded,
  })

  const rows       = data?.data       || []
  const totals     = data?.totals     || {}
  const detailRows = detailData?.data || []

  const toggleExpand = (cat) => setExpanded(prev => prev === cat ? null : cat)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <DateRangePicker from={from} to={to} onFrom={setFrom} onTo={setTo} />

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Net Revenue"    value={`BHD ${fmtBhd(totals.net_revenue)}`}  color="#1565c0" />
        <KpiCard label="Total COGS"     value={`BHD ${fmtBhd(totals.total_cogs)}`}   color="#c62828" />
        <KpiCard label="Gross Profit"   value={`BHD ${fmtBhd(totals.gross_profit)}`} color="#2e7d32" />
        <KpiCard label="Overall Margin" value={`${(totals.margin_pct || 0).toFixed(1)}%`}
          color={totals.margin_pct >= 30 ? '#2e7d32' : totals.margin_pct >= 15 ? '#f57f17' : '#c62828'} />
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th style={{ width: 24 }}></th>
            <th>Category</th>
            <th className="right">Net Revenue</th>
            <th className="right">COGS</th>
            <th className="right">Gross Profit</th>
            <th style={{ minWidth: 140 }}>Margin %</th>
            <th className="right">Discounts</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={7}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={7}>No sales data for this period</td></tr>
            )}
            {rows.map(r => {
              const isOpen = expanded === r.category
              return [
                /* Category row */
                <tr key={r.category}
                  onClick={() => toggleExpand(r.category)}
                  style={{ cursor: 'pointer', background: isOpen ? '#e8f0fe' : 'inherit' }}
                  onMouseEnter={e => { if (!isOpen) e.currentTarget.style.background = '#f5f5f5' }}
                  onMouseLeave={e => { if (!isOpen) e.currentTarget.style.background = 'inherit' }}>
                  <td className="center" style={{ color: '#888', userSelect: 'none' }}>
                    {isOpen ? '▼' : '▶'}
                  </td>
                  <td style={{ fontWeight: 600 }}>{r.category}</td>
                  <td className="right">{fmtBhd(r.net_revenue)}</td>
                  <td className="right" style={{ color: '#c62828' }}>{fmtBhd(r.total_cogs)}</td>
                  <td className="right"
                    style={{ color: parseFloat(r.gross_profit) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                    {fmtBhd(r.gross_profit)}
                  </td>
                  <td><MarginBar pct={r.margin_pct} /></td>
                  <td className="right" style={{ color: '#888' }}>{fmtBhd(r.total_discount)}</td>
                </tr>,

                /* Drill-down product rows */
                isOpen && (
                  detailLoading
                    ? <tr key={`${r.category}-loading`}>
                        <td></td>
                        <td colSpan={6} style={{ padding: '6px 12px', color: '#888', fontSize: 11,
                                                  background: '#f8f9ff' }}>Loading products…</td>
                      </tr>
                    : detailRows.length === 0
                      ? <tr key={`${r.category}-empty`}>
                          <td></td>
                          <td colSpan={6} style={{ padding: '6px 12px', color: '#bbb', fontSize: 11,
                                                    background: '#f8f9ff' }}>No products found</td>
                        </tr>
                      : detailRows.map(p => (
                          <tr key={p.product_id}
                            style={{ background: '#f8f9ff', borderLeft: '3px solid var(--blue)' }}>
                            <td></td>
                            <td style={{ paddingLeft: 24, color: '#333' }}>
                              <div style={{ fontWeight: 500 }}>{p.product_name}</div>
                              {p.sku && <div style={{ fontSize: 10, color: '#aaa' }}>{p.sku}</div>}
                            </td>
                            <td className="right" style={{ color: '#555' }}>{fmtBhd(p.net_revenue)}</td>
                            <td className="right" style={{ color: '#c62828', fontSize: 11 }}>{fmtBhd(p.total_cogs)}</td>
                            <td className="right"
                              style={{ color: parseFloat(p.gross_profit) >= 0 ? '#2e7d32' : '#c62828' }}>
                              {fmtBhd(p.gross_profit)}
                            </td>
                            <td><MarginBar pct={p.margin_pct} /></td>
                            <td className="right" style={{ color: '#bbb', fontSize: 11 }}>{fmtBhd(p.total_discount)}</td>
                          </tr>
                        ))
                ),
              ]
            })}
            {rows.length > 1 && (
              <tr style={{ fontWeight: 700, background: '#f5f5f5', borderTop: '2px solid #ccc' }}>
                <td></td>
                <td>Total</td>
                <td className="right">{fmtBhd(totals.net_revenue)}</td>
                <td className="right" style={{ color: '#c62828' }}>{fmtBhd(totals.total_cogs)}</td>
                <td className="right" style={{ color: '#2e7d32' }}>{fmtBhd(totals.gross_profit)}</td>
                <td><MarginBar pct={totals.margin_pct} /></td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Click a category row to drill down into individual products · Margin = (Revenue − COGS) / Revenue
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 3 — Top Customers
// ═════════════════════════════════════════════════════════════════════════════
function TopCustomersTab() {
  const [from,  setFrom]  = useState(yearStart)
  const [to,    setTo]    = useState(today)
  const [limit, setLimit] = useState(20)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-customers', from, to, limit],
    queryFn:  () => analyticsApi.topCustomers({ from, to, limit }).then(r => r.data),
  })

  const rows = data?.data || []
  const totalRevenue = rows.reduce((s, r) => s + parseFloat(r.total_revenue || 0), 0)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <DateRangePicker from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <span style={{ fontSize: 12, color: '#555' }}>Top:</span>
        {[10, 20, 50].map(n => (
          <button key={n} className="btn"
            style={{ fontSize: 11, padding: '2px 8px',
                     background: limit === n ? 'var(--blue)' : '',
                     color:      limit === n ? '#fff' : '' }}
            onClick={() => setLimit(n)}>
            {n}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Customers Shown" value={rows.length} />
        <KpiCard label="Total Revenue"   value={`BHD ${fmtBhd(totalRevenue)}`} color="#1565c0" />
        <KpiCard label="Est. Gross Profit"
          value={`BHD ${fmtBhd(rows.reduce((s, r) => s + parseFloat(r.est_gross_profit || 0), 0))}`}
          color="#2e7d32" />
        <KpiCard label="Outstanding"
          value={`BHD ${fmtBhd(rows.reduce((s, r) => s + parseFloat(r.outstanding || 0), 0))}`}
          color="#c62828" />
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th className="center">#</th>
            <th>Customer</th>
            <th>Category</th>
            <th className="right">Invoices</th>
            <th className="right">Revenue</th>
            <th className="right">Est. Profit</th>
            <th style={{ minWidth: 120 }}>Est. Margin</th>
            <th className="right">Outstanding</th>
            <th className="right">Last Invoice</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={9}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={9}>No invoices in this period</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.id}>
                <td className="center" style={{ color: '#aaa', fontWeight: 700 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{r.code}</div>
                </td>
                <td>
                  <span style={{ fontSize: 11, background: '#f0f4ff', color: '#1565c0',
                                 padding: '1px 6px', borderRadius: 8 }}>
                    {r.category}
                  </span>
                </td>
                <td className="right">{r.invoice_count}</td>
                <td className="right" style={{ fontWeight: 600 }}>{fmtBhd(r.total_revenue)}</td>
                <td className="right"
                  style={{ color: parseFloat(r.est_gross_profit) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                  {fmtBhd(r.est_gross_profit)}
                </td>
                <td><MarginBar pct={r.est_margin_pct} /></td>
                <td className="right"
                  style={{ color: parseFloat(r.outstanding) > 0 ? '#c62828' : '#888' }}>
                  {parseFloat(r.outstanding) > 0 ? fmtBhd(r.outstanding) : '—'}
                </td>
                <td className="right" style={{ color: '#888' }}>
                  {fmtDate(r.last_invoice_date)}
                  {r.days_since_last > 90 &&
                    <div style={{ fontSize: 10, color: '#f57f17' }}>{r.days_since_last}d ago</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Margin is estimated using product master cost price · Revenue includes VAT
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 4 — Supplier Pricing
// ═════════════════════════════════════════════════════════════════════════════
function SupplierPricingTab() {
  const [months, setMonths] = useState(12)
  const [q,      setQ]      = useState('')
  const [catId,  setCatId]  = useState('')

  const { data: catData } = useQuery({
    queryKey: ['categories', 'product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-supplier', months, catId],
    queryFn:  () => analyticsApi.supplierPricing({ months, category_id: catId || undefined })
                      .then(r => r.data),
  })

  const allRows = data?.data || []

  // Group rows by product_id, rank suppliers by avg_unit_price
  const products = useMemo(() => {
    const map = {}
    for (const row of allRows) {
      if (!map[row.product_id]) map[row.product_id] = []
      map[row.product_id].push(row)
    }
    // Sort each product's suppliers by avg_unit_price asc
    for (const pid of Object.keys(map)) {
      map[pid].sort((a, b) => parseFloat(a.avg_unit_price) - parseFloat(b.avg_unit_price))
    }
    // Filter by search
    return Object.values(map).filter(suppliers => {
      if (!q) return true
      const term = q.toLowerCase()
      return suppliers[0].product_name.toLowerCase().includes(term) ||
             suppliers[0].sku?.toLowerCase().includes(term)
    })
  }, [allRows, q])

  const monthOptions = [3, 6, 12, 24]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#555' }}>Lookback:</span>
        {monthOptions.map(m => (
          <button key={m} className="btn"
            style={{ fontSize: 11, padding: '2px 8px',
                     background: months === m ? 'var(--blue)' : '',
                     color:      months === m ? '#fff' : '' }}
            onClick={() => setMonths(m)}>
            {m}m
          </button>
        ))}
        <select value={catId} onChange={e => setCatId(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All categories</option>
          {(catData || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Search product / SKU…" value={q} onChange={e => setQ(e.target.value)}
          style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4, width: 180 }} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Products with Data" value={products.length} />
        <KpiCard label="Unique Suppliers"
          value={new Set(allRows.map(r => r.supplier_id)).size} color="#1565c0" />
        <KpiCard label="Multi-Supplier Products"
          value={products.filter(p => p.length > 1).length} color="#f57f17"
          sub="Price competition available" />
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th>Product</th>
            <th>Category</th>
            <th>Supplier</th>
            <th className="right">Avg Price</th>
            <th className="right">Min Price</th>
            <th className="right">Max Price</th>
            <th className="right">Orders</th>
            <th className="right">Last Purchase</th>
            <th className="center">Rank</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={9}>Loading…</td></tr>}
            {!isLoading && !products.length && (
              <tr className="empty-row"><td colSpan={9}>No purchase data in this period</td></tr>
            )}
            {products.map(suppliers => (
              suppliers.map((row, idx) => (
                <tr key={`${row.product_id}-${row.supplier_id}`}
                  style={{ background: idx === 0 ? '#f1f8e9' : 'inherit' }}>
                  {idx === 0 ? (
                    <td rowSpan={suppliers.length} style={{ verticalAlign: 'top', borderRight: '1px solid #e0e0e0' }}>
                      <div style={{ fontWeight: 600 }}>{row.product_name}</div>
                      <div style={{ fontSize: 10, color: '#aaa' }}>{row.sku || '—'}</div>
                      {suppliers.length > 1 && (
                        <div style={{ fontSize: 10, color: '#f57f17', marginTop: 2 }}>
                          {suppliers.length} suppliers · save {fmtBhd(
                            parseFloat(suppliers[suppliers.length - 1].avg_unit_price) -
                            parseFloat(suppliers[0].avg_unit_price)
                          )}/unit vs most expensive
                        </div>
                      )}
                    </td>
                  ) : null}
                  {idx === 0 ? (
                    <td rowSpan={suppliers.length} style={{ verticalAlign: 'top', color: '#666',
                                                            borderRight: '1px solid #e0e0e0' }}>
                      {row.category}
                    </td>
                  ) : null}
                  <td style={{ fontWeight: idx === 0 ? 600 : 400 }}>{row.supplier_name}</td>
                  <td className="right" style={{ fontWeight: idx === 0 ? 700 : 400,
                                                  color: idx === 0 ? '#2e7d32' : 'inherit' }}>
                    {fmtBhd(row.avg_unit_price)}
                  </td>
                  <td className="right" style={{ color: '#888' }}>{fmtBhd(row.min_unit_price)}</td>
                  <td className="right" style={{ color: '#888' }}>{fmtBhd(row.max_unit_price)}</td>
                  <td className="right">{row.purchase_count}</td>
                  <td className="right" style={{ color: '#888' }}>{fmtDate(row.last_purchase_date)}</td>
                  <td className="center">
                    {idx === 0
                      ? <span style={{ background: '#c8e6c9', color: '#2e7d32', fontSize: 10,
                                       fontWeight: 700, padding: '2px 7px', borderRadius: 10 }}>
                          Best Price
                        </span>
                      : <span style={{ color: '#aaa', fontSize: 11 }}>#{idx + 1}</span>
                    }
                  </td>
                </tr>
              ))
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Ranked by average unit price (lowest = best) · Green rows = cheapest supplier per product
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN MODULE
// ═════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'velocity',  label: '📦 Stock Velocity' },
  { id: 'margin',    label: '💰 Gross Margin'   },
  { id: 'customers', label: '👥 Top Customers'  },
  { id: 'suppliers', label: '🏭 Supplier Pricing' },
]

export default function AnalyticsModule() {
  const [tab, setTab] = useState('velocity')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
      <div className="module-title">Business Analytics</div>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid #e0e0e0',
                    background: '#fafafa', flexShrink: 0 }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: '9px 18px', fontSize: 12, fontWeight: tab === t.id ? 700 : 400,
            color: tab === t.id ? 'var(--blue)' : '#555',
            borderBottom: tab === t.id ? '2px solid var(--blue)' : '2px solid transparent',
            marginBottom: -2,
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto', padding: 14, display: 'flex',
                    flexDirection: 'column', gap: 0 }}>
        {tab === 'velocity'  && <StockVelocityTab />}
        {tab === 'margin'    && <GrossMarginTab />}
        {tab === 'customers' && <TopCustomersTab />}
        {tab === 'suppliers' && <SupplierPricingTab />}
      </div>

      <div className="status-bar">
        <span>Analytics · {TABS.find(t => t.id === tab)?.label}</span>
      </div>
    </div>
  )
}
