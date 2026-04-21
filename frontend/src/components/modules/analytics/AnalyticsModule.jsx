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
  const [expanded, setExpanded] = useState(null)   // { id: uuid|null, name: string }

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-margin', from, to],
    queryFn:  () => analyticsApi.grossMargin({ from, to }).then(r => r.data),
  })

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ['analytics-margin-detail', expanded?.id, from, to],
    queryFn:  () => analyticsApi.grossMarginDetail({ category_id: expanded?.id ?? 'null', from, to }).then(r => r.data),
    enabled:  !!expanded,
  })

  const rows       = data?.data       || []
  const totals     = data?.totals     || {}
  const detailRows = detailData?.data || []

  const toggleExpand = (r) => setExpanded(prev =>
    prev?.id === r.category_id ? null : { id: r.category_id, name: r.category }
  )

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
              const isOpen = expanded?.id === r.category_id
              return [
                /* Category row */
                <tr key={r.category}
                  onClick={() => toggleExpand(r)}
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
        Margin is estimated using cost price snapshotted at invoice time · Revenue = net (excl. VAT)
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
            <th className="right">Spread %</th>
            <th className="right">Orders</th>
            <th className="right">Last Purchase</th>
            <th className="center">Rank</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={10}>Loading…</td></tr>}
            {!isLoading && !products.length && (
              <tr className="empty-row"><td colSpan={10}>No purchase data in this period</td></tr>
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
                  <td className="right">
                    {parseFloat(row.avg_unit_price) > 0 ? (() => {
                      const spread = ((parseFloat(row.max_unit_price) - parseFloat(row.min_unit_price)) / parseFloat(row.avg_unit_price) * 100)
                      return <span style={{ color: spread > 20 ? '#c62828' : spread > 10 ? '#f57f17' : '#2e7d32', fontWeight: spread > 10 ? 700 : 400 }}>
                        {spread.toFixed(1)}%
                      </span>
                    })() : '—'}
                  </td>
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
//  TAB 5 — Top Products
// ═════════════════════════════════════════════════════════════════════════════
function TopProductsTab() {
  const [from,  setFrom]  = useState(yearStart)
  const [to,    setTo]    = useState(today)
  const [limit, setLimit] = useState(20)
  const [sort,  setSort]  = useState('revenue')
  const [catId, setCatId] = useState('')

  const { data: catData } = useQuery({
    queryKey: ['categories', 'product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-top-products', from, to, limit, sort, catId],
    queryFn:  () => analyticsApi.topProducts({
      from, to, limit, sort, category_id: catId || undefined
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const rows = data?.data || []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <DateRangePicker from={from} to={to} onFrom={setFrom} onTo={setTo} />
        <select value={catId} onChange={e => setCatId(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All Categories</option>
          {(catData || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>Sort:</span>
        {[['revenue','Revenue'],['qty','Qty Sold'],['profit','Profit'],['margin_asc','⚠ Low Margin']].map(([v, label]) => (
          <button key={v} className="btn"
            style={{ fontSize: 11, padding: '2px 8px',
                     background: sort === v ? (v === 'margin_asc' ? '#c62828' : 'var(--blue)') : '',
                     color:      sort === v ? '#fff' : '' }}
            onClick={() => setSort(v)}>
            {label}
          </button>
        ))}
        <span style={{ fontSize: 11, color: '#888', marginLeft: 8 }}>Top:</span>
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
        <KpiCard label="Products Shown" value={rows.length} />
        <KpiCard label="Total Revenue"
          value={`BHD ${fmtBhd(rows.reduce((s, r) => s + parseFloat(r.net_revenue || 0), 0))}`}
          color="#1565c0" />
        <KpiCard label="Total COGS"
          value={`BHD ${fmtBhd(rows.reduce((s, r) => s + parseFloat(r.total_cogs || 0), 0))}`}
          color="#888" />
        <KpiCard label="Gross Profit"
          value={`BHD ${fmtBhd(rows.reduce((s, r) => s + parseFloat(r.gross_profit || 0), 0))}`}
          color="#2e7d32" />
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th className="center">#</th>
            <th>Product</th>
            <th>Category</th>
            <th className="right">Invoices</th>
            <th className="right">Qty Sold</th>
            <th className="right">Revenue</th>
            <th className="right">COGS</th>
            <th className="right">Gross Profit</th>
            <th style={{ minWidth: 120 }}>Margin</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={9}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={9}>No sales in this period</td></tr>
            )}
            {rows.map((r, i) => (
              <tr key={r.product_id}>
                <td className="center" style={{ color: '#aaa', fontWeight: 700 }}>
                  {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1}
                </td>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.product_name}</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{r.sku}</div>
                </td>
                <td>
                  <span style={{ fontSize: 11, background: '#f0f4ff', color: '#1565c0',
                                 padding: '1px 6px', borderRadius: 8 }}>
                    {r.category}
                  </span>
                </td>
                <td className="right">{r.invoice_count}</td>
                <td className="right">{parseFloat(r.qty_sold).toFixed(3)}</td>
                <td className="right" style={{ fontWeight: 600 }}>{fmtBhd(r.net_revenue)}</td>
                <td className="right" style={{ color: '#888' }}>{fmtBhd(r.total_cogs)}</td>
                <td className="right"
                  style={{ color: parseFloat(r.gross_profit) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                  {fmtBhd(r.gross_profit)}
                </td>
                <td><MarginBar pct={r.margin_pct} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Margin is estimated using cost price snapshotted at invoice time · Revenue = net (excl. VAT)
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 6 — Sales Trend
// ═════════════════════════════════════════════════════════════════════════════
function SalesTrendTab() {
  const lastYearStart = `${thisYear - 1}-01-01`
  const [from, setFrom] = useState(lastYearStart)
  const [to,   setTo]   = useState(today)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-sales-trend', from, to],
    queryFn:  () => analyticsApi.salesTrend({ from, to }).then(r => r.data),
    keepPreviousData: true,
  })

  const rows = data?.data || []
  const maxRevenue = Math.max(...rows.map(r => parseFloat(r.net_revenue || 0)), 1)

  const totals = rows.reduce((acc, r) => {
    acc.revenue += parseFloat(r.net_revenue || 0)
    acc.cogs    += parseFloat(r.total_cogs  || 0)
    acc.profit  += parseFloat(r.gross_profit || 0)
    acc.invoices += r.invoice_count || 0
    return acc
  }, { revenue: 0, cogs: 0, profit: 0, invoices: 0 })
  totals.margin_pct = totals.revenue > 0
    ? ((totals.profit / totals.revenue) * 100).toFixed(1)
    : '0.0'

  const presets = [
    { label: 'Last 12M', from: new Date(Date.now() - 365 * 86400000).toISOString().slice(0, 10), to: today },
    { label: 'Last 24M', from: `${thisYear - 2}-01-01`, to: today },
    { label: 'This Year', from: yearStart, to: today },
    { label: 'Last Year', from: `${thisYear - 1}-01-01`, to: `${thisYear - 1}-12-31` },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
        <span style={{ fontSize: 11, color: '#888' }}>to</span>
        <input type="date" value={to} onChange={e => setTo(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }} />
        {presets.map(p => (
          <button key={p.label} className="btn"
            style={{ fontSize: 11, padding: '2px 8px',
                     background: from === p.from && to === p.to ? 'var(--blue)' : '',
                     color:      from === p.from && to === p.to ? '#fff' : '' }}
            onClick={() => { setFrom(p.from); setTo(p.to) }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Months"         value={rows.length} />
        <KpiCard label="Total Revenue"  value={`BHD ${fmtBhd(totals.revenue)}`}  color="#1565c0" />
        <KpiCard label="Gross Profit"   value={`BHD ${fmtBhd(totals.profit)}`}   color="#2e7d32" />
        <KpiCard label="Avg Margin"     value={`${totals.margin_pct}%`}           color={parseFloat(totals.margin_pct) >= 20 ? '#2e7d32' : '#f57f17'} />
        <KpiCard label="Total Invoices" value={totals.invoices} />
      </div>

      {/* Bar chart */}
      {rows.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' }}>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Monthly Revenue vs Gross Profit</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 100, overflowX: 'auto' }}>
            {rows.map(r => {
              const revH    = (parseFloat(r.net_revenue  || 0) / maxRevenue) * 90
              const profitH = (parseFloat(r.gross_profit || 0) / maxRevenue) * 90
              return (
                <div key={r.period_label}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                           gap: 2, minWidth: 28, flex: 1, maxWidth: 48 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 90 }}>
                    <div title={`Revenue: BHD ${fmtBhd(r.net_revenue)}`}
                      style={{ width: 10, height: Math.max(2, revH),
                               background: '#1565c0', borderRadius: '2px 2px 0 0' }} />
                    <div title={`Profit: BHD ${fmtBhd(r.gross_profit)}`}
                      style={{ width: 10, height: Math.max(2, profitH),
                               background: parseFloat(r.gross_profit) >= 0 ? '#2e7d32' : '#c62828',
                               borderRadius: '2px 2px 0 0' }} />
                  </div>
                  <div style={{ fontSize: 9, color: '#aaa', transform: 'rotate(-45deg)',
                                transformOrigin: 'center', whiteSpace: 'nowrap', marginTop: 6 }}>
                    {r.period_label}
                  </div>
                </div>
              )
            })}
          </div>
          <div style={{ display: 'flex', gap: 14, marginTop: 24, fontSize: 11, color: '#888' }}>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#1565c0', borderRadius: 2, marginRight: 4 }} />Revenue</span>
            <span><span style={{ display: 'inline-block', width: 10, height: 10, background: '#2e7d32', borderRadius: 2, marginRight: 4 }} />Gross Profit</span>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th>Month</th>
            <th className="right">Invoices</th>
            <th className="right">Qty Sold</th>
            <th className="right">Revenue</th>
            <th className="right">COGS</th>
            <th className="right">Gross Profit</th>
            <th style={{ minWidth: 120 }}>Margin</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={7}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={7}>No data in this period</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.period_label}>
                <td style={{ fontWeight: 600 }}>{r.period_label}</td>
                <td className="right">{r.invoice_count}</td>
                <td className="right">{parseFloat(r.qty_sold || 0).toFixed(0)}</td>
                <td className="right" style={{ fontWeight: 600 }}>{fmtBhd(r.net_revenue)}</td>
                <td className="right" style={{ color: '#888' }}>{fmtBhd(r.total_cogs)}</td>
                <td className="right"
                  style={{ color: parseFloat(r.gross_profit) >= 0 ? '#2e7d32' : '#c62828', fontWeight: 600 }}>
                  {fmtBhd(r.gross_profit)}
                </td>
                <td><MarginBar pct={r.margin_pct} /></td>
              </tr>
            ))}
            {rows.length > 1 && (
              <tr style={{ fontWeight: 700, background: '#f8f8f8', borderTop: '2px solid #ddd' }}>
                <td>Total</td>
                <td className="right">{totals.invoices}</td>
                <td className="right">{rows.reduce((s, r) => s + parseFloat(r.qty_sold || 0), 0).toFixed(0)}</td>
                <td className="right">{fmtBhd(totals.revenue)}</td>
                <td className="right" style={{ color: '#888' }}>{fmtBhd(totals.cogs)}</td>
                <td className="right" style={{ color: totals.profit >= 0 ? '#2e7d32' : '#c62828' }}>
                  {fmtBhd(totals.profit)}
                </td>
                <td><MarginBar pct={totals.margin_pct} /></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Monthly buckets · Revenue = net (excl. VAT) · COGS uses cost snapshotted at invoice time
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 7 — Dead Stock
// ═════════════════════════════════════════════════════════════════════════════
function DeadStockTab() {
  const [days,  setDays]  = useState(90)
  const [catId, setCatId] = useState('')

  const { data: catData } = useQuery({
    queryKey: ['categories', 'product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-dead-stock', days, catId],
    queryFn:  () => analyticsApi.deadStock({ days, category_id: catId || undefined }).then(r => r.data),
  })

  const rows    = data?.data    || []
  const summary = data?.summary || {}

  const dayOptions = [30, 60, 90, 180, 365]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#555', fontWeight: 600 }}>No sales in last:</span>
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
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4, marginLeft: 8 }}>
          <option value="">All Categories</option>
          {(catData || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Dead Stock Products" value={summary.total_products || 0} color="#c62828" />
        <KpiCard label="Never Sold"         value={summary.never_sold     || 0} color="#b71c1c" />
        <KpiCard label="No Recent Sale"     value={summary.no_recent_sale || 0} color="#e53935" />
        <KpiCard label="Capital Tied Up"
          value={`BHD ${fmtBhd(summary.total_stock_value || 0)}`}
          color="#f57f17"
          sub={`across ${summary.total_products || 0} products`} />
      </div>

      {/* Table */}
      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th>Product</th>
            <th>Category</th>
            <th className="right">Stock Qty</th>
            <th className="right">Cost Price</th>
            <th className="right">Stock Value</th>
            <th className="right">Last Sale</th>
            <th className="right">Days Idle</th>
            <th>Status</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={8}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={8}>No dead stock found for this threshold</td></tr>
            )}
            {rows.map(r => {
              const isNever = r.dead_reason === 'never_sold'
              return (
                <tr key={r.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>{r.sku}</div>
                  </td>
                  <td>
                    <span style={{ fontSize: 11, background: '#f0f4ff', color: '#1565c0',
                                   padding: '1px 6px', borderRadius: 8 }}>
                      {r.category}
                    </span>
                  </td>
                  <td className="right">{parseFloat(r.stock_qty).toFixed(3)}</td>
                  <td className="right" style={{ color: '#888' }}>{fmtBhd(r.cost_price)}</td>
                  <td className="right" style={{ fontWeight: 600, color: '#f57f17' }}>
                    {fmtBhd(r.stock_value)}
                  </td>
                  <td className="right" style={{ color: '#888' }}>
                    {r.last_sale_date ? fmtDate(r.last_sale_date) : '—'}
                  </td>
                  <td className="right" style={{ color: '#c62828', fontWeight: 600 }}>
                    {r.days_since_last_sale != null ? `${r.days_since_last_sale}d` : '∞'}
                  </td>
                  <td>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10,
                      background: isNever ? '#ffebee' : '#fff8e1',
                      color:      isNever ? '#b71c1c' : '#e65100',
                    }}>
                      {isNever ? 'Never Sold' : 'No Recent Sale'}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Only stock-tracked products with stock qty &gt; 0 · Sorted by capital tied up (highest first)
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  Shared: product selector for trend tabs
// ═════════════════════════════════════════════════════════════════════════════
function ProductPicker({ products, value, onChange, placeholder }) {
  const [q, setQ] = useState('')
  const filtered = useMemo(() => {
    if (!q) return products.slice(0, 40)
    const t = q.toLowerCase()
    return products.filter(p =>
      p.name.toLowerCase().includes(t) || (p.sku || '').toLowerCase().includes(t)
    ).slice(0, 40)
  }, [products, q])

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <input
        placeholder="Type to filter products…"
        value={q}
        onChange={e => setQ(e.target.value)}
        style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4, width: 220 }}
      />
      <select
        value={value || ''}
        onChange={e => onChange(e.target.value || null)}
        style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4, minWidth: 260 }}
      >
        <option value="">{placeholder || 'Select a product…'}</option>
        {filtered.map(p => (
          <option key={p.id} value={p.id}>{p.name}{p.sku ? ` [${p.sku}]` : ''}</option>
        ))}
      </select>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 8 — Avg Selling Price Trend
// ═════════════════════════════════════════════════════════════════════════════
function AvgPriceTrendTab() {
  const [from,      setFrom]      = useState(`${thisYear - 1}-01-01`)
  const [to,        setTo]        = useState(today)
  const [productId, setProductId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-avg-price-trend', productId, from, to],
    queryFn:  () => analyticsApi.avgPriceTrend({ product_id: productId || undefined, from, to }).then(r => r.data),
    keepPreviousData: true,
  })

  const products = data?.products || []
  const product  = data?.product  || null
  const rows     = data?.data     || []
  const maxPrice = Math.max(...rows.map(r => parseFloat(r.max_sell_price || 0)), 1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <DateRangePicker from={from} to={to} onFrom={setFrom} onTo={setTo} />
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <ProductPicker products={products} value={productId} onChange={setProductId}
          placeholder="Select product to view price trend…" />
        {product && (
          <span style={{ fontSize: 11, color: '#888' }}>
            List: <strong>BHD {fmtBhd(product.list_price)}</strong> ·
            Cost: <strong>BHD {fmtBhd(product.cost_price)}</strong>
          </span>
        )}
      </div>

      {!productId && (
        <div className="empty-state">
          <div className="icon">📈</div>
          <div>Select a product to view its average selling price trend over time</div>
        </div>
      )}

      {productId && isLoading && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading…</div>}

      {productId && !isLoading && rows.length === 0 && (
        <div className="empty-state">
          <div className="icon">📭</div>
          <div>No sales found for this product in the selected period</div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <KpiCard label="Months w/ Sales" value={rows.length} />
            <KpiCard label="Avg Sell Price"
              value={`BHD ${fmtBhd(rows.reduce((s,r)=>s+parseFloat(r.avg_sell_price),0)/rows.length)}`}
              color="#1565c0" />
            <KpiCard label="Lowest Month"
              value={`BHD ${fmtBhd(Math.min(...rows.map(r=>parseFloat(r.avg_sell_price))))}`}
              color="#c62828" />
            <KpiCard label="Highest Month"
              value={`BHD ${fmtBhd(Math.max(...rows.map(r=>parseFloat(r.avg_sell_price))))}`}
              color="#2e7d32" />
            <KpiCard label="Total Qty Sold"
              value={rows.reduce((s,r)=>s+parseFloat(r.qty_sold||0),0).toFixed(0)} />
          </div>

          {/* Mini chart */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Avg Sell Price per Month (BHD)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 80, overflowX: 'auto' }}>
              {rows.map(r => {
                const h = (parseFloat(r.avg_sell_price) / maxPrice) * 70
                return (
                  <div key={r.period_label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 32, flex: 1, maxWidth: 52 }}>
                    <div title={`BHD ${fmtBhd(r.avg_sell_price)} · ${r.qty_sold} units`}
                      style={{ width: 14, height: Math.max(3, h), background: '#1565c0', borderRadius: '2px 2px 0 0' }} />
                    {product?.list_price > 0 && (
                      <div title={`Range: ${fmtBhd(r.min_sell_price)}–${fmtBhd(r.max_sell_price)}`}
                        style={{ width: 14, height: 2, background: '#c62828', marginTop: 1 }} />
                    )}
                    <div style={{ fontSize: 9, color: '#aaa', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap', marginTop: 6 }}>
                      {r.period_label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ overflow: 'auto', flex: 1 }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead><tr>
                <th>Month</th>
                <th className="right">Invoices</th>
                <th className="right">Qty Sold</th>
                <th className="right">Avg Price</th>
                <th className="right">Min Price</th>
                <th className="right">Max Price</th>
                {product?.list_price > 0 && <th className="right">vs List Price</th>}
              </tr></thead>
              <tbody>
                {rows.map(r => {
                  const driftPct = product?.list_price > 0
                    ? ((parseFloat(r.avg_sell_price) - parseFloat(product.list_price)) / parseFloat(product.list_price) * 100).toFixed(1)
                    : null
                  return (
                    <tr key={r.period_label}>
                      <td style={{ fontWeight: 600 }}>{r.period_label}</td>
                      <td className="right">{r.invoice_count}</td>
                      <td className="right">{parseFloat(r.qty_sold).toFixed(0)}</td>
                      <td className="right" style={{ fontWeight: 700, color: '#1565c0' }}>BHD {fmtBhd(r.avg_sell_price)}</td>
                      <td className="right" style={{ color: '#888' }}>BHD {fmtBhd(r.min_sell_price)}</td>
                      <td className="right" style={{ color: '#888' }}>BHD {fmtBhd(r.max_sell_price)}</td>
                      {driftPct !== null && (
                        <td className="right" style={{ color: parseFloat(driftPct) < -5 ? '#c62828' : parseFloat(driftPct) > 5 ? '#2e7d32' : '#888', fontWeight: 600 }}>
                          {parseFloat(driftPct) > 0 ? '+' : ''}{driftPct}%
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            Avg price = average unit_price across all invoice lines for this product in the month · excl. voided invoices
          </div>
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 9 — Reorder Candidates
// ═════════════════════════════════════════════════════════════════════════════
function ReorderTab() {
  const [days,     setDays]     = useState(30)
  const [leadTime, setLeadTime] = useState(14)
  const [catId,    setCatId]    = useState('')

  const { data: catData } = useQuery({
    queryKey: ['categories', 'product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-reorder', days, leadTime, catId],
    queryFn:  () => analyticsApi.reorderCandidates({
      days, lead_time: leadTime, category_id: catId || undefined
    }).then(r => r.data),
  })

  const rows = data?.data || []
  const totalReorderValue = rows.reduce((s, r) => s + parseFloat(r.suggested_reorder_qty || 0) * parseFloat(r.cost_price || 0), 0)
  const dayOptions  = [14, 30, 60, 90]
  const leadOptions = [7, 14, 21, 30]

  const urgencyColor = (days_of_supply) => {
    if (days_of_supply == null || days_of_supply <= 0) return '#b71c1c'
    if (days_of_supply <= 7)  return '#c62828'
    if (days_of_supply <= 14) return '#e65100'
    return '#f57f17'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#555' }}>Velocity window:</span>
        {dayOptions.map(d => (
          <button key={d} className="btn"
            style={{ fontSize: 11, padding: '2px 8px', background: days === d ? 'var(--blue)' : '', color: days === d ? '#fff' : '' }}
            onClick={() => setDays(d)}>{d}d</button>
        ))}
        <span style={{ fontSize: 12, color: '#555', marginLeft: 8 }}>Lead time:</span>
        {leadOptions.map(d => (
          <button key={d} className="btn"
            style={{ fontSize: 11, padding: '2px 8px', background: leadTime === d ? '#e65100' : '', color: leadTime === d ? '#fff' : '' }}
            onClick={() => setLeadTime(d)}>{d}d</button>
        ))}
        <select value={catId} onChange={e => setCatId(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All categories</option>
          {(catData || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Candidates" value={rows.length} color="#e65100" />
        <KpiCard label="Critical (≤7d)" value={rows.filter(r => r.days_of_supply != null && r.days_of_supply <= 7).length} color="#c62828" />
        <KpiCard label="Est. Reorder Cost" value={`BHD ${fmtBhd(totalReorderValue)}`} color="#1565c0"
          sub="suggested qty × cost price" />
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th>Product</th>
            <th>Category</th>
            <th className="right">Stock</th>
            <th className="right">Min</th>
            <th className="right">Sold ({days}d)</th>
            <th className="right">Velocity/day</th>
            <th className="right">Days Supply</th>
            <th className="right">Suggest Reorder</th>
            <th className="right">Est. Cost</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={9}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={9}>No reorder candidates — all products have adequate stock</td></tr>
            )}
            {rows.map(r => (
              <tr key={r.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>{r.name}</div>
                  <div style={{ fontSize: 10, color: '#aaa' }}>{r.sku}</div>
                </td>
                <td style={{ color: '#666' }}>{r.category}</td>
                <td className="right"
                  style={{ color: parseFloat(r.stock_qty) <= parseFloat(r.stock_min) ? '#c62828' : 'inherit',
                           fontWeight: parseFloat(r.stock_qty) <= parseFloat(r.stock_min) ? 700 : 400 }}>
                  {parseFloat(r.stock_qty).toFixed(0)}
                  {parseFloat(r.stock_qty) <= parseFloat(r.stock_min) && <span style={{ fontSize: 10, marginLeft: 3 }}>⚠</span>}
                </td>
                <td className="right" style={{ color: '#888' }}>{parseFloat(r.stock_min).toFixed(0)}</td>
                <td className="right">{parseFloat(r.qty_sold).toFixed(0)}</td>
                <td className="right" style={{ color: '#555' }}>{parseFloat(r.velocity_per_day).toFixed(2)}</td>
                <td className="right" style={{ fontWeight: 700, color: urgencyColor(r.days_of_supply) }}>
                  {r.days_of_supply != null ? `${r.days_of_supply}d` : '—'}
                </td>
                <td className="right" style={{ fontWeight: 700, color: '#1565c0' }}>
                  {parseFloat(r.suggested_reorder_qty || 0).toFixed(0)}
                </td>
                <td className="right" style={{ color: '#888' }}>
                  BHD {fmtBhd(parseFloat(r.suggested_reorder_qty || 0) * parseFloat(r.cost_price || 0))}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr style={{ fontWeight: 700, background: '#f0f4ff', fontSize: 12 }}>
                <td colSpan={8} style={{ padding: '5px 8px' }}>Total estimated reorder cost ({rows.length} products)</td>
                <td className="right" style={{ padding: '5px 8px' }}>BHD {fmtBhd(totalReorderValue)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Candidates = products where days of supply &lt; lead time, or stock &lt; minimum · Suggested qty covers lead time + 14-day safety buffer
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 10 — Buy Price Comparison
// ═════════════════════════════════════════════════════════════════════════════
function BuyPriceTab() {
  const [months, setMonths] = useState(12)
  const [catId,  setCatId]  = useState('')
  const [q,      setQ]      = useState('')

  const { data: catData } = useQuery({
    queryKey: ['categories', 'product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })
  const { data, isLoading } = useQuery({
    queryKey: ['analytics-buy-price', months, catId, q],
    queryFn:  () => analyticsApi.buyPriceComparison({
      months, category_id: catId || undefined, q: q || undefined
    }).then(r => r.data),
    keepPreviousData: true,
  })

  const rows         = data?.data || []
  const rising       = rows.filter(r => parseFloat(r.drift_from_avg_pct) > 5).length
  const falling      = rows.filter(r => parseFloat(r.drift_from_avg_pct) < -5).length
  const monthOptions = [3, 6, 12, 24]

  const driftColor = (pct) => {
    const n = parseFloat(pct)
    if (n > 20)  return '#b71c1c'
    if (n > 5)   return '#c62828'
    if (n < -20) return '#1b5e20'
    if (n < -5)  return '#2e7d32'
    return '#888'
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#555' }}>Avg over:</span>
        {monthOptions.map(m => (
          <button key={m} className="btn"
            style={{ fontSize: 11, padding: '2px 8px', background: months === m ? 'var(--blue)' : '', color: months === m ? '#fff' : '' }}
            onClick={() => setMonths(m)}>{m}m</button>
        ))}
        <select value={catId} onChange={e => setCatId(e.target.value)}
          style={{ fontSize: 12, padding: '3px 6px', border: '1px solid #ccc', borderRadius: 4 }}>
          <option value="">All categories</option>
          {(catData || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Search product / SKU…" value={q} onChange={e => setQ(e.target.value)}
          style={{ fontSize: 12, padding: '3px 8px', border: '1px solid #ccc', borderRadius: 4, width: 180 }} />
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <KpiCard label="Products" value={rows.length} />
        <KpiCard label="Price Rising (>5%)" value={rising}  color="#c62828"  sub="last buy > avg buy" />
        <KpiCard label="Price Falling (>5%)" value={falling} color="#2e7d32" sub="last buy < avg buy" />
        <KpiCard label="Stable" value={rows.length - rising - falling} color="#888" />
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <table className="data-table" style={{ fontSize: 12 }}>
          <thead><tr>
            <th>Product</th>
            <th>Category</th>
            <th className="right">Master Cost</th>
            <th className="right">Avg Buy ({months}m)</th>
            <th className="right">Last Buy</th>
            <th className="right">Last Buy Date</th>
            <th>Last Supplier</th>
            <th className="right">Min Buy</th>
            <th className="right">Max Buy</th>
            <th className="right">Drift vs Avg</th>
            <th className="right">Drift vs Master</th>
            <th className="right">Buys</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={12}>Loading…</td></tr>}
            {!isLoading && !rows.length && (
              <tr className="empty-row"><td colSpan={12}>No purchase data found</td></tr>
            )}
            {rows.map(r => {
              const driftAvg    = parseFloat(r.drift_from_avg_pct    || 0)
              const driftMaster = parseFloat(r.drift_from_master_pct || 0)
              return (
                <tr key={r.product_id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{r.product_name}</div>
                    <div style={{ fontSize: 10, color: '#aaa' }}>{r.sku}</div>
                  </td>
                  <td style={{ color: '#666' }}>{r.category}</td>
                  <td className="right" style={{ color: '#888' }}>BHD {fmtBhd(r.current_cost_price)}</td>
                  <td className="right" style={{ fontWeight: 600 }}>BHD {fmtBhd(r.avg_buy_price)}</td>
                  <td className="right" style={{ fontWeight: 700, color: driftColor(driftAvg) }}>
                    BHD {fmtBhd(r.last_buy_price)}
                  </td>
                  <td className="right" style={{ color: '#888', fontSize: 11 }}>
                    {fmtDate(r.last_buy_date)}
                  </td>
                  <td style={{ color: '#666', fontSize: 11 }}>{r.last_supplier}</td>
                  <td className="right" style={{ color: '#888', fontSize: 11 }}>BHD {fmtBhd(r.min_buy_price)}</td>
                  <td className="right" style={{ color: '#888', fontSize: 11 }}>BHD {fmtBhd(r.max_buy_price)}</td>
                  <td className="right" style={{ fontWeight: Math.abs(driftAvg) > 5 ? 700 : 400, color: driftColor(driftAvg) }}>
                    {driftAvg > 0 ? '+' : ''}{driftAvg.toFixed(1)}%
                  </td>
                  <td className="right" style={{ fontWeight: Math.abs(driftMaster) > 5 ? 700 : 400, color: driftColor(driftMaster) }}>
                    {driftMaster > 0 ? '+' : ''}{driftMaster.toFixed(1)}%
                  </td>
                  <td className="right" style={{ color: '#888' }}>{r.buy_count}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div style={{ fontSize: 11, color: '#aaa' }}>
        Sorted by largest price drift (absolute) · Drift vs avg = (last buy − avg buy) / avg buy · Red = price rising, Green = price falling
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  TAB 11 — Cost Inflation Trend
// ═════════════════════════════════════════════════════════════════════════════
function CostInflationTab() {
  const [months,    setMonths]    = useState(24)
  const [productId, setProductId] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics-cost-inflation', productId, months],
    queryFn:  () => analyticsApi.costInflation({ product_id: productId || undefined, months }).then(r => r.data),
    keepPreviousData: true,
  })

  const products = data?.products || []
  const product  = data?.product  || null
  const rows     = data?.data     || []

  const maxPrice = Math.max(...rows.map(r => parseFloat(r.max_buy_price || 0)), 1)
  const monthOptions = [12, 24, 36]

  // Compute inflation: (last month avg - first month avg) / first month avg * 100
  const inflation = rows.length >= 2
    ? ((parseFloat(rows[rows.length - 1].avg_buy_price) - parseFloat(rows[0].avg_buy_price)) / parseFloat(rows[0].avg_buy_price) * 100).toFixed(1)
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: '#555' }}>Lookback:</span>
        {monthOptions.map(m => (
          <button key={m} className="btn"
            style={{ fontSize: 11, padding: '2px 8px', background: months === m ? 'var(--blue)' : '', color: months === m ? '#fff' : '' }}
            onClick={() => setMonths(m)}>{m}m</button>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <ProductPicker products={products} value={productId} onChange={setProductId}
          placeholder="Select product to view cost inflation…" />
        {product && (
          <span style={{ fontSize: 11, color: '#888' }}>
            Current master cost: <strong>BHD {fmtBhd(product.cost_price)}</strong>
          </span>
        )}
      </div>

      {!productId && (
        <div className="empty-state">
          <div className="icon">📊</div>
          <div>Select a product to view its buy price trend over time (only products with purchase history shown)</div>
        </div>
      )}

      {productId && isLoading && <div style={{ padding: 40, textAlign: 'center', color: '#888' }}>Loading…</div>}

      {productId && !isLoading && rows.length === 0 && (
        <div className="empty-state">
          <div className="icon">📭</div>
          <div>No purchase history found for this product in the selected period</div>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div style={{ display: 'flex', gap: 8 }}>
            <KpiCard label="Months with Data" value={rows.length} />
            <KpiCard label="First Buy Price" value={`BHD ${fmtBhd(rows[0].avg_buy_price)}`} color="#888" sub={rows[0].period_label} />
            <KpiCard label="Latest Buy Price" value={`BHD ${fmtBhd(rows[rows.length-1].avg_buy_price)}`}
              color={inflation !== null && parseFloat(inflation) > 0 ? '#c62828' : '#2e7d32'}
              sub={rows[rows.length-1].period_label} />
            {inflation !== null && (
              <KpiCard
                label={`Total Inflation (${rows.length}m)`}
                value={`${parseFloat(inflation) > 0 ? '+' : ''}${inflation}%`}
                color={parseFloat(inflation) > 10 ? '#c62828' : parseFloat(inflation) > 0 ? '#e65100' : '#2e7d32'}
              />
            )}
          </div>

          {/* Line chart approximation with bars */}
          <div style={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, padding: '10px 14px' }}>
            <div style={{ fontSize: 11, color: '#888', marginBottom: 8 }}>Avg Buy Price per Month (BHD)</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80, overflowX: 'auto' }}>
              {rows.map((r, i) => {
                const h = (parseFloat(r.avg_buy_price) / maxPrice) * 70
                const isFirst = i === 0
                const isLast  = i === rows.length - 1
                const barColor = isFirst ? '#888' : isLast ? (parseFloat(inflation) > 0 ? '#c62828' : '#2e7d32') : '#1565c0'
                return (
                  <div key={r.period_label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 28, flex: 1, maxWidth: 48 }}>
                    <div title={`${r.period_label}: BHD ${fmtBhd(r.avg_buy_price)} · ${r.buy_count} buys · ${r.suppliers}`}
                      style={{ width: 12, height: Math.max(3, h), background: barColor, borderRadius: '2px 2px 0 0' }} />
                    <div style={{ fontSize: 9, color: '#aaa', transform: 'rotate(-45deg)', transformOrigin: 'center', whiteSpace: 'nowrap', marginTop: 6 }}>
                      {r.period_label}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div style={{ overflow: 'auto', flex: 1 }}>
            <table className="data-table" style={{ fontSize: 12 }}>
              <thead><tr>
                <th>Month</th>
                <th className="right">Buys</th>
                <th className="right">Avg Buy Price</th>
                <th className="right">Min Price</th>
                <th className="right">Max Price</th>
                <th>Suppliers</th>
                <th className="right">MoM Change</th>
                <th className="right">vs First</th>
              </tr></thead>
              <tbody>
                {rows.map((r, i) => {
                  const prevAvg = i > 0 ? parseFloat(rows[i-1].avg_buy_price) : null
                  const momPct  = prevAvg && prevAvg > 0
                    ? ((parseFloat(r.avg_buy_price) - prevAvg) / prevAvg * 100).toFixed(1)
                    : null
                  const firstPct = parseFloat(rows[0].avg_buy_price) > 0
                    ? ((parseFloat(r.avg_buy_price) - parseFloat(rows[0].avg_buy_price)) / parseFloat(rows[0].avg_buy_price) * 100).toFixed(1)
                    : null
                  return (
                    <tr key={r.period_label}>
                      <td style={{ fontWeight: 600 }}>{r.period_label}</td>
                      <td className="right" style={{ color: '#888' }}>{r.buy_count}</td>
                      <td className="right" style={{ fontWeight: 700 }}>BHD {fmtBhd(r.avg_buy_price)}</td>
                      <td className="right" style={{ color: '#2e7d32', fontSize: 11 }}>BHD {fmtBhd(r.min_buy_price)}</td>
                      <td className="right" style={{ color: '#c62828', fontSize: 11 }}>BHD {fmtBhd(r.max_buy_price)}</td>
                      <td style={{ color: '#666', fontSize: 11 }}>{r.suppliers}</td>
                      <td className="right" style={{ color: momPct === null ? '#aaa' : parseFloat(momPct) > 0 ? '#c62828' : parseFloat(momPct) < 0 ? '#2e7d32' : '#888', fontWeight: momPct !== null ? 600 : 400 }}>
                        {momPct === null ? '—' : `${parseFloat(momPct) > 0 ? '+' : ''}${momPct}%`}
                      </td>
                      <td className="right" style={{ color: firstPct === null ? '#aaa' : parseFloat(firstPct) > 0 ? '#c62828' : parseFloat(firstPct) < 0 ? '#2e7d32' : '#888' }}>
                        {firstPct === null ? '—' : `${parseFloat(firstPct) > 0 ? '+' : ''}${firstPct}%`}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div style={{ fontSize: 11, color: '#aaa' }}>
            Avg buy price per month across all purchase orders for this product · MoM = month-over-month change
          </div>
        </>
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN MODULE
// ═════════════════════════════════════════════════════════════════════════════
const TABS = [
  { id: 'velocity',   label: '📦 Stock Velocity'    },
  { id: 'margin',     label: '💰 Gross Margin'       },
  { id: 'customers',  label: '👥 Top Customers'      },
  { id: 'suppliers',  label: '🏭 Supplier Pricing'   },
  { id: 'products',   label: '🏆 Top Products'       },
  { id: 'trend',      label: '📈 Sales Trend'        },
  { id: 'deadstock',  label: '🪦 Dead Stock'         },
  { id: 'price_trend',label: '🏷 Avg Price Trend'    },
  { id: 'reorder',    label: '🔄 Reorder Candidates' },
  { id: 'buy_price',  label: '🛒 Buy Price Compare'  },
  { id: 'inflation',  label: '📉 Cost Inflation'     },
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
        {tab === 'velocity'    && <StockVelocityTab />}
        {tab === 'margin'      && <GrossMarginTab />}
        {tab === 'customers'   && <TopCustomersTab />}
        {tab === 'suppliers'   && <SupplierPricingTab />}
        {tab === 'products'    && <TopProductsTab />}
        {tab === 'trend'       && <SalesTrendTab />}
        {tab === 'deadstock'   && <DeadStockTab />}
        {tab === 'price_trend' && <AvgPriceTrendTab />}
        {tab === 'reorder'     && <ReorderTab />}
        {tab === 'buy_price'   && <BuyPriceTab />}
        {tab === 'inflation'   && <CostInflationTab />}
      </div>

      <div className="status-bar">
        <span>Analytics · {TABS.find(t => t.id === tab)?.label}</span>
      </div>
    </div>
  )
}
