import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { contraApi, customerApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

// ── Helper: colour a net position number ──────────────────────────────────────
function NetBadge({ val }) {
  const n = parseFloat(val)
  const colour = n > 0.005 ? '#1b5e20' : n < -0.005 ? '#b71c1c' : '#555'
  const bg     = n > 0.005 ? '#e8f5e9' : n < -0.005 ? '#ffebee' : '#f5f5f5'
  return (
    <span style={{ background:bg, color:colour, fontWeight:700,
                   padding:'2px 8px', borderRadius:10, fontSize:11 }}>
      {n >= 0 ? '+' : ''}{fmtBhd(n)}
    </span>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  MAIN MODULE
// ═════════════════════════════════════════════════════════════════════════════
export default function ContraModule() {
  const qc = useQueryClient()
  const [selectedId,   setSelectedId]   = useState(null)
  const [showApply,    setShowApply]    = useState(false)
  const [showLink,     setShowLink]     = useState(false)
  const [q,            setQ]            = useState('')
  const [netFilter,    setNetFilter]    = useState('all')   // all | ar_heavy | ap_heavy | balanced
  const [actionable,   setActionable]   = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['contra-accounts'],
    queryFn:  () => contraApi.list().then(r => r.data.data),
  })
  const pairs = data || []

  const filteredPairs = pairs.filter(p => {
    if (q) {
      const term = q.toLowerCase()
      if (!p.customer_name?.toLowerCase().includes(term) &&
          !p.supplier_name?.toLowerCase().includes(term)) return false
    }
    if (actionable && (parseFloat(p.ar_balance) <= 0 || parseFloat(p.ap_balance) <= 0)) return false
    const net = parseFloat(p.net_position)
    if (netFilter === 'ar_heavy'  && net <= 0.005)  return false
    if (netFilter === 'ap_heavy'  && net >= -0.005) return false
    if (netFilter === 'balanced'  && Math.abs(net) > 0.005) return false
    return true
  })

  const selected = pairs.find(p => p.customer_id === selectedId)

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Contra Accounts</div>
      <div className="toolbar">
        <button className="btn primary" onClick={() => setShowLink(true)}>🔗 Link Customer ↔ Supplier</button>
        <button className="btn" disabled={!selectedId}
          onClick={() => setShowApply(true)}>⚖️ Apply Contra Entry</button>
        <div style={{ flex:1 }}/>
        <input
          placeholder="Search name…"
          value={q} onChange={e => setQ(e.target.value)}
          style={{ width:160, fontSize:12, padding:'3px 8px', border:'1px solid #ccc', borderRadius:4 }}
        />
        <select value={netFilter} onChange={e => setNetFilter(e.target.value)}
          style={{ fontSize:12, padding:'3px 6px', border:'1px solid #ccc', borderRadius:4 }}>
          <option value="all">All positions</option>
          <option value="ar_heavy">AR-heavy (we are owed more)</option>
          <option value="ap_heavy">AP-heavy (we owe more)</option>
          <option value="balanced">Balanced</option>
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, cursor:'pointer', whiteSpace:'nowrap' }}>
          <input type="checkbox" checked={actionable} onChange={e => setActionable(e.target.checked)}/>
          Actionable only
        </label>
        <span style={{ fontSize:11, color:'#888', padding:'0 4px', whiteSpace:'nowrap' }}>
          {filteredPairs.length}{filteredPairs.length !== pairs.length ? `/${pairs.length}` : ''} pair{pairs.length!==1?'s':''}
        </span>
      </div>

      {/* Split view */}
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Left: pairs list */}
        <div style={{ flex:1, overflow:'auto' }}>
          <table className="data-table">
            <thead><tr>
              <th>Customer</th>
              <th>Supplier</th>
              <th className="right">AR (owed to us)</th>
              <th className="right">AP (we owe)</th>
              <th className="right">Net Position</th>
              <th className="center">Open Inv.</th>
              <th className="center">Open Pur.</th>
            </tr></thead>
            <tbody>
              {isLoading && <tr className="empty-row"><td colSpan={7}>Loading...</td></tr>}
              {!isLoading && !pairs.length && (
                <tr className="empty-row">
                  <td colSpan={7}>No linked pairs yet — click "Link Customer ↔ Supplier" to set one up</td>
                </tr>
              )}
              {!isLoading && pairs.length > 0 && !filteredPairs.length && (
                <tr className="empty-row">
                  <td colSpan={7}>No pairs match the current filters</td>
                </tr>
              )}
              {filteredPairs.map(p => (
                <tr key={p.customer_id}
                  className={selectedId === p.customer_id ? 'selected' : ''}
                  onClick={() => setSelectedId(p.customer_id)}>
                  <td>
                    <div style={{ fontWeight:600 }}>{p.customer_name}</div>
                    <div style={{ fontSize:11, color:'#888' }}>
                      {p.customer_code}
                      {p.record_type === 'single_record' && (
                        <span style={{ marginLeft:6, fontSize:10, background:'#fff3e0',
                          color:'#e65100', padding:'1px 5px', borderRadius:8 }}>
                          single record
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {p.record_type === 'single_record'
                      ? <span style={{ fontSize:11, color:'#888', fontStyle:'italic' }}>same record</span>
                      : <><div style={{ fontWeight:600 }}>{p.supplier_name}</div>
                          <div style={{ fontSize:11, color:'#888' }}>{p.supplier_code}</div></>
                    }
                  </td>
                  <td className="right" style={{ color:'#1565c0', fontWeight:600 }}>{fmtBhd(p.ar_balance)}</td>
                  <td className="right" style={{ color:'#c62828', fontWeight:600 }}>{fmtBhd(p.ap_balance)}</td>
                  <td className="right"><NetBadge val={p.net_position}/></td>
                  <td className="center">{p.open_invoices}</td>
                  <td className="center">{p.open_purchases}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Right: detail panel */}
        {selected && (
          <div style={{ width:400, borderLeft:'1px solid #e0e0e0', display:'flex',
                        flexDirection:'column', background:'#fafafa', flexShrink:0 }}>
            <PairDetail pair={selected} onApply={() => setShowApply(true)} />
          </div>
        )}
      </div>

      <div className="status-bar">
        <span>{pairs.length} linked pairs</span>
        {selected && <span style={{ marginLeft:8, color:'var(--blue)' }}>· {selected.customer_name} selected</span>}
      </div>

      {/* Modals */}
      {showApply && selected && (
        <ApplyContraModal
          pair={selected}
          onClose={() => { setShowApply(false); qc.invalidateQueries(['contra-accounts']) }}
        />
      )}
      {showLink && (
        <LinkSupplierModal
          onClose={() => { setShowLink(false); qc.invalidateQueries(['contra-accounts']) }}
        />
      )}
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  PAIR DETAIL PANEL
// ═════════════════════════════════════════════════════════════════════════════
function PairDetail({ pair, onApply }) {
  const qc = useQueryClient()
  const [tab, setTab] = useState('history')

  const { data: entries, isLoading: loadingEntries } = useQuery({
    queryKey: ['contra-entries', pair.customer_id],
    queryFn:  () => contraApi.entries(pair.customer_id).then(r => r.data.data),
    enabled:  !!pair.customer_id,
  })

  const reverseMut = useMutation({
    mutationFn: (id) => contraApi.reverse(id),
    onSuccess: () => {
      toast.success('Contra entry reversed')
      qc.invalidateQueries(['contra-entries', pair.customer_id])
      qc.invalidateQueries(['contra-accounts'])
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Reversal failed'),
  })

  const net = parseFloat(pair.net_position)

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      {/* Header */}
      <div style={{ padding:'10px 14px', background:'var(--blue)', color:'#fff' }}>
        <div style={{ fontWeight:700, fontSize:13 }}>{pair.customer_name}</div>
        <div style={{ fontSize:11, opacity:.85 }}>
          {pair.record_type === 'single_record'
            ? 'Single record — acts as both customer (AR) and supplier (AP)'
            : `also trading as supplier: ${pair.supplier_name}`}
        </div>
        <div style={{ marginTop:6, display:'flex', gap:16, fontSize:12 }}>
          <span>AR <strong>{fmtBhd(pair.ar_balance)}</strong></span>
          <span>AP <strong>{fmtBhd(pair.ap_balance)}</strong></span>
          <span>Net <strong>{net >= 0 ? '+' : ''}{fmtBhd(net)}</strong></span>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ padding:'8px 10px', borderBottom:'1px solid #e0e0e0', display:'flex', gap:6 }}>
        <button className="btn primary" style={{ fontSize:11 }}
          disabled={parseFloat(pair.ar_balance) <= 0 || parseFloat(pair.ap_balance) <= 0}
          onClick={onApply}>
          ⚖️ Apply Contra
        </button>
        {parseFloat(pair.ar_balance) <= 0 && parseFloat(pair.ap_balance) <= 0 && (
          <span style={{ fontSize:11, color:'#888', alignSelf:'center' }}>No open balances on either side</span>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid #e0e0e0', background:'#fff' }}>
        {[['history','Entry History'],['invoices','Open Invoices'],['purchases','Open Purchases']].map(([t,l])=>(
          <button key={t} onClick={() => setTab(t)} style={{
            flex:1, background:'none', border:'none', fontSize:11, cursor:'pointer', padding:'6px 0',
            borderBottom: tab===t ? '2px solid var(--blue)' : '2px solid transparent',
            color: tab===t ? 'var(--blue)' : '#555', fontWeight: tab===t ? 700 : 400,
          }}>{l}</button>
        ))}
      </div>

      <div style={{ flex:1, overflow:'auto', padding:10 }}>
        {tab === 'history' && (
          loadingEntries
            ? <div style={{ color:'#888', fontSize:12 }}>Loading...</div>
            : !entries?.length
              ? <div style={{ color:'#bbb', fontSize:12, textAlign:'center', padding:20 }}>No contra entries yet</div>
              : entries.map(e => (
                  <div key={e.id} style={{ background:'#fff', border:'1px solid #e8e8e8',
                       borderRadius:4, padding:'8px 10px', marginBottom:6 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                      <div>
                        <div style={{ fontSize:12, fontWeight:700, color:'var(--blue)' }}>
                          BHD {fmtBhd(e.amount)} · {fmtDate(e.entry_date)}
                        </div>
                        <div style={{ fontSize:11, color:'#555', marginTop:2 }}>
                          Inv: {e.invoice_no} ↔ Pur: {e.purchase_no || e.supplier_invoice_no || '—'}
                        </div>
                        {e.notes && <div style={{ fontSize:11, color:'#888' }}>{e.notes.replace(/^contra:\S+\s?/,'')}</div>}
                        <div style={{ fontSize:10, color:'#aaa', marginTop:2 }}>by {e.created_by_name || 'system'}</div>
                      </div>
                      <button className="btn" style={{ fontSize:10, padding:'2px 7px', color:'#c62828' }}
                        onClick={() => { if(confirm('Reverse this contra entry?')) reverseMut.mutate(e.id) }}
                        disabled={reverseMut.isPending}>
                        ↩ Reverse
                      </button>
                    </div>
                  </div>
                ))
        )}
        {tab === 'invoices'  && <OpenInvoicesList  customerId={pair.customer_id} />}
        {tab === 'purchases' && <OpenPurchasesList customerId={pair.customer_id} />}
      </div>
    </div>
  )
}

// ── Open invoices sub-list ─────────────────────────────────────────────────
function OpenInvoicesList({ customerId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['contra-invoices', customerId],
    queryFn:  () => contraApi.invoices(customerId).then(r => r.data.data),
    enabled:  !!customerId,
  })
  const rows = data || []
  if (isLoading) return <div style={{ color:'#888', fontSize:12 }}>Loading...</div>
  if (!rows.length) return <div style={{ color:'#bbb', fontSize:12, textAlign:'center', padding:20 }}>No open invoices</div>
  return (
    <table className="data-table" style={{ fontSize:11 }}>
      <thead><tr><th>Invoice No</th><th>Date</th><th className="right">Total</th><th className="right">Balance</th><th>Status</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td style={{ color:'var(--blue)', fontWeight:600 }}>{r.invoice_no}</td>
            <td>{fmtDate(r.invoice_date)}</td>
            <td className="right">{fmtBhd(r.grand_total)}</td>
            <td className="right" style={{ fontWeight:600 }}>{fmtBhd(r.balance_due)}</td>
            <td><span className={`badge badge-${r.payment_status}`}>{r.payment_status}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Open purchases sub-list ────────────────────────────────────────────────
function OpenPurchasesList({ customerId }) {
  const { data, isLoading } = useQuery({
    queryKey: ['contra-purchases', customerId],
    queryFn:  () => contraApi.purchases(customerId).then(r => r.data.data),
    enabled:  !!customerId,
  })
  const rows = data || []
  if (isLoading) return <div style={{ color:'#888', fontSize:12 }}>Loading...</div>
  if (!rows.length) return <div style={{ color:'#bbb', fontSize:12, textAlign:'center', padding:20 }}>No open purchases</div>
  return (
    <table className="data-table" style={{ fontSize:11 }}>
      <thead><tr><th>Purchase No</th><th>Supplier Inv</th><th>Date</th><th className="right">Total</th><th className="right">Balance</th></tr></thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.id}>
            <td style={{ color:'var(--blue)', fontWeight:600 }}>{r.purchase_no}</td>
            <td style={{ color:'#555' }}>{r.supplier_invoice_no || '—'}</td>
            <td>{fmtDate(r.purchase_date)}</td>
            <td className="right">{fmtBhd(r.grand_total)}</td>
            <td className="right" style={{ fontWeight:600 }}>{fmtBhd(r.balance_due)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  APPLY CONTRA MODAL
// ═════════════════════════════════════════════════════════════════════════════
function ApplyContraModal({ pair, onClose }) {
  const qc = useQueryClient()
  const [invoiceId,  setInvoiceId]  = useState('')
  const [purchaseId, setPurchaseId] = useState('')
  const [amount,     setAmount]     = useState('')
  const [entryDate,  setEntryDate]  = useState(new Date().toISOString().slice(0,10))
  const [notes,      setNotes]      = useState('')

  const { data: invData } = useQuery({
    queryKey: ['contra-invoices', pair.customer_id],
    queryFn:  () => contraApi.invoices(pair.customer_id).then(r => r.data.data),
  })
  const { data: purData } = useQuery({
    queryKey: ['contra-purchases', pair.customer_id],
    queryFn:  () => contraApi.purchases(pair.customer_id).then(r => r.data.data),
  })

  const invoices  = invData || []
  const purchases = purData || []

  const selInv = invoices.find(i => i.id === invoiceId)
  const selPur = purchases.find(p => p.id === purchaseId)
  const maxAmt = selInv && selPur
    ? Math.min(parseFloat(selInv.balance_due), parseFloat(selPur.balance_due)).toFixed(3)
    : ''

  // Auto-fill amount when both sides selected
  const handleInvChange = (id) => {
    setInvoiceId(id)
    if (id && purchaseId) {
      const inv = invoices.find(i => i.id === id)
      const pur = purchases.find(p => p.id === purchaseId)
      if (inv && pur) setAmount(Math.min(parseFloat(inv.balance_due), parseFloat(pur.balance_due)).toFixed(3))
    }
  }
  const handlePurChange = (id) => {
    setPurchaseId(id)
    if (invoiceId && id) {
      const inv = invoices.find(i => i.id === invoiceId)
      const pur = purchases.find(p => p.id === id)
      if (inv && pur) setAmount(Math.min(parseFloat(inv.balance_due), parseFloat(pur.balance_due)).toFixed(3))
    }
  }

  const applyMut = useMutation({
    mutationFn: () => contraApi.apply(pair.customer_id, {
      invoice_id: invoiceId, purchase_id: purchaseId,
      amount: parseFloat(amount), entry_date: entryDate, notes,
    }),
    onSuccess: (res) => {
      toast.success(res.data.message || 'Contra entry applied')
      qc.invalidateQueries(['contra-entries', pair.customer_id])
      qc.invalidateQueries(['contra-invoices',  pair.customer_id])
      qc.invalidateQueries(['contra-purchases', pair.customer_id])
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed to apply contra'),
  })

  const valid = invoiceId && purchaseId && amount && parseFloat(amount) > 0

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:520 }}>
        <div className="modal-header">
          <h3>Apply Contra Entry — {pair.customer_name}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" disabled={!valid || applyMut.isPending}
            onClick={() => applyMut.mutate()}>
            ⚖️ {applyMut.isPending ? 'Applying…' : 'Apply Contra'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>

        {/* Explanation banner */}
        <div style={{ margin:'0 14px 4px', padding:'8px 10px', background:'#e3f2fd',
                      borderRadius:4, fontSize:11, color:'#1565c0' }}>
          A contra entry reduces <strong>both</strong> the selected invoice (AR) and the selected purchase (AP)
          by the same amount — no cash changes hands.
        </div>

        <div className="modal-body" style={{ padding:14 }}>
          {/* Two-column: invoice side | purchase side */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#1565c0', marginBottom:4 }}>
                AR Side — {pair.customer_name}
              </div>
              <div className="field">
                <label>Select Open Invoice *</label>
                <select value={invoiceId} onChange={e => handleInvChange(e.target.value)}>
                  <option value="">— choose —</option>
                  {invoices.map(i => (
                    <option key={i.id} value={i.id}>
                      {i.invoice_no} · {fmtDate(i.invoice_date)} · BHD {fmtBhd(i.balance_due)}
                    </option>
                  ))}
                </select>
              </div>
              {selInv && (
                <div style={{ fontSize:11, color:'#555', marginTop:4, padding:'6px 8px',
                              background:'#f5f5f5', borderRadius:4 }}>
                  Balance due: <strong>BHD {fmtBhd(selInv.balance_due)}</strong>
                  <span className={`badge badge-${selInv.payment_status}`} style={{ marginLeft:6 }}>{selInv.payment_status}</span>
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#c62828', marginBottom:4 }}>
                AP Side — {pair.supplier_name}
              </div>
              <div className="field">
                <label>Select Open Purchase *</label>
                <select value={purchaseId} onChange={e => handlePurChange(e.target.value)}>
                  <option value="">— choose —</option>
                  {purchases.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.purchase_no || p.supplier_invoice_no} · {fmtDate(p.purchase_date)} · BHD {fmtBhd(p.balance_due)}
                    </option>
                  ))}
                </select>
              </div>
              {selPur && (
                <div style={{ fontSize:11, color:'#555', marginTop:4, padding:'6px 8px',
                              background:'#f5f5f5', borderRadius:4 }}>
                  Balance due: <strong>BHD {fmtBhd(selPur.balance_due)}</strong>
                  <span className={`badge badge-${selPur.payment_status}`} style={{ marginLeft:6 }}>{selPur.payment_status}</span>
                </div>
              )}
            </div>
          </div>

          {/* Amount + date */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12 }}>
            <div className="field">
              <label>Amount BHD * {maxAmt && <span style={{ color:'#888', fontWeight:400 }}>(max {maxAmt})</span>}</label>
              <input type="number" step="0.001" min="0.001" max={maxAmt || undefined}
                value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.000"/>
              {maxAmt && <button className="btn" style={{ marginTop:4, fontSize:10, padding:'2px 8px' }}
                onClick={() => setAmount(maxAmt)}>Use max</button>}
            </div>
            <div className="field">
              <label>Entry Date *</label>
              <input type="date" value={entryDate} onChange={e => setEntryDate(e.target.value)}/>
            </div>
          </div>

          <div className="field">
            <label>Notes (optional)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Mutual balance offset — Mar 2026"/>
          </div>

          {/* Preview */}
          {valid && (
            <div style={{ marginTop:10, padding:'10px 12px', background:'#f1f8e9',
                          border:'1px solid #c5e1a5', borderRadius:4, fontSize:12 }}>
              <div style={{ fontWeight:700, marginBottom:4 }}>Entry Preview</div>
              <div>Invoice <strong>{selInv?.invoice_no}</strong> balance: {fmtBhd(selInv?.balance_due)} → <strong>{fmtBhd(parseFloat(selInv?.balance_due) - parseFloat(amount))}</strong></div>
              <div>Purchase <strong>{selPur?.purchase_no || selPur?.supplier_invoice_no}</strong> balance: {fmtBhd(selPur?.balance_due)} → <strong>{fmtBhd(parseFloat(selPur?.balance_due) - parseFloat(amount))}</strong></div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ═════════════════════════════════════════════════════════════════════════════
//  LINK SUPPLIER MODAL  (set/clear linked_supplier_id on a customer)
// ═════════════════════════════════════════════════════════════════════════════
function LinkSupplierModal({ onClose }) {
  const qc = useQueryClient()
  const [custId,   setCustId]   = useState('')
  const [suppId,   setSuppId]   = useState('')
  const [custQ,    setCustQ]    = useState('')
  const [suppQ,    setSuppQ]    = useState('')

  const { data: custData } = useQuery({
    queryKey: ['customers', { q: custQ, role: 'customer' }],
    queryFn:  () => customerApi.list({ q: custQ, role: 'customer' }).then(r => r.data.data),
  })
  const { data: suppData } = useQuery({
    queryKey: ['customers', { q: suppQ, role: 'supplier' }],
    queryFn:  () => customerApi.list({ q: suppQ, role: 'supplier' }).then(r => r.data.data),
  })

  const customers  = custData || []
  const suppliers  = suppData || []
  const selCust    = customers.find(c => c.id === custId)
  const selSupp    = suppliers.find(s => s.id === suppId)

  const linkMut = useMutation({
    mutationFn: () => customerApi.update(custId, { ...selCust, linked_supplier_id: suppId || null }),
    onSuccess: () => {
      toast.success(suppId ? `${selCust?.name} linked to ${selSupp?.name}` : 'Link removed')
      qc.invalidateQueries(['contra-accounts'])
      qc.invalidateQueries(['customers'])
      onClose()
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth:500 }}>
        <div className="modal-header">
          <h3>Link Customer ↔ Supplier</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" disabled={!custId || linkMut.isPending}
            onClick={() => linkMut.mutate()}>
            🔗 {linkMut.isPending ? 'Saving…' : suppId ? 'Save Link' : 'Remove Link'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>

        <div className="modal-body" style={{ padding:14 }}>
          <div style={{ fontSize:12, color:'#555', marginBottom:12, padding:'8px 10px',
                        background:'#f5f5f5', borderRadius:4 }}>
            Select a <strong>customer</strong> and the <strong>supplier</strong> record that represents the
            same real-world company. Leave the supplier blank to remove an existing link.
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#1565c0', marginBottom:6 }}>Customer Record</div>
              <div className="field">
                <label>Search customer</label>
                <input value={custQ} onChange={e => { setCustQ(e.target.value); setCustId('') }}
                  placeholder="Type to search…"/>
              </div>
              <div className="field">
                <label>Select *</label>
                <select value={custId} onChange={e => setCustId(e.target.value)} size={6}
                  style={{ height:'auto' }}>
                  <option value="">— none —</option>
                  {customers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.code} · {c.name}
                      {c.linked_supplier_id ? ' 🔗' : ''}
                    </option>
                  ))}
                </select>
              </div>
              {selCust?.linked_supplier_id && (
                <div style={{ fontSize:11, color:'#e65100', marginTop:4 }}>
                  ⚠ Already linked — selecting a new supplier will replace it
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize:11, fontWeight:700, color:'#c62828', marginBottom:6 }}>Supplier Record</div>
              <div className="field">
                <label>Search supplier</label>
                <input value={suppQ} onChange={e => { setSuppQ(e.target.value); setSuppId('') }}
                  placeholder="Type to search…"/>
              </div>
              <div className="field">
                <label>Select (blank = remove link)</label>
                <select value={suppId} onChange={e => setSuppId(e.target.value)} size={6}
                  style={{ height:'auto' }}>
                  <option value="">— remove link —</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.code} · {s.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {custId && (
            <div style={{ marginTop:10, padding:'8px 10px', background:'#e8f5e9',
                          borderRadius:4, fontSize:12 }}>
              {suppId
                ? <><strong>{selCust?.name}</strong> will be linked to supplier <strong>{selSupp?.name}</strong></>
                : <><strong>{selCust?.name}</strong> — existing link will be removed</>
              }
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
