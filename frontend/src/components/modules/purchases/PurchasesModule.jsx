import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { purchaseApi } from '../../../services/api'
import CustomerTypeahead from '../shared/CustomerTypeahead'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const PAGE_SIZES = [25, 50, 100, 500]

export default function PurchasesModule() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [showForm,    setShowForm]    = useState(false)
  const [showDetail,  setShowDetail]  = useState(false)
  const [showPayment, setShowPayment] = useState(false)

  // Filters
  const [filters, setFilters] = useState({ q: '', status: '', supplier_id: '', from: '', to: '' })
  const [supplierName, setSupplierName] = useState('')
  const [page,     setPage]     = useState(1)
  const [pageSize, setPageSize] = useState(50)

  const setFiltersAndReset = upd => { setFilters(upd); setPage(1) }
  const setPageSizeAndReset = n  => { setPageSize(n);  setPage(1) }

  const offset = (page - 1) * pageSize
  const { data, isLoading } = useQuery({
    queryKey: ['purchases', filters, page, pageSize],
    queryFn:  () => purchaseApi.list({ ...filters, limit: pageSize, offset }).then(r => r.data),
    keepPreviousData: true,
  })
  const rows       = data?.data  || []
  const total      = data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const selected   = rows.find(r => r.id === selectedId)

  const { data: detail } = useQuery({
    queryKey: ['purchase-detail', selectedId],
    queryFn:  () => purchaseApi.get(selectedId).then(r => r.data.data),
    enabled:  !!selectedId && showDetail,
  })
  const { data: payments } = useQuery({
    queryKey: ['purchase-payments', selectedId],
    queryFn:  () => purchaseApi.getPayments(selectedId).then(r => r.data.data),
    enabled:  !!selectedId && showDetail,
  })

  const deleteMut = useMutation({
    mutationFn: () => purchaseApi.delete(selectedId),
    onSuccess: (r) => { toast.success(r.data.message); qc.invalidateQueries(['purchases']); setSelectedId(null) },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Delete failed'),
  })

  const confirmDelete = () => {
    if (!selected) return
    if (window.confirm(`Delete ${selected.purchase_no}? This cannot be undone.`)) deleteMut.mutate()
  }

  const clearFilters = () => {
    setFiltersAndReset({ q: '', status: '', supplier_id: '', from: '', to: '' })
    setSupplierName('')
  }
  const hasFilters = filters.q || filters.status || filters.supplier_id || filters.from || filters.to

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Purchases — Supplier Invoices</div>

      <div className="toolbar">
        <button className="btn primary" onClick={()=>setShowForm(true)}>＋ New Purchase</button>
        <button className="btn" disabled={!selectedId} onClick={()=>setShowDetail(true)}>👁 View / Pay</button>
        <button className="btn danger" disabled={!selectedId||selected?.payment_status==='paid'} onClick={confirmDelete}>🗑 Delete</button>
        <div className="toolbar-sep"/>

        {/* Status filter */}
        <select className="btn" style={{height:26,cursor:'default'}}
          value={filters.status}
          onChange={e => setFiltersAndReset(f => ({...f, status: e.target.value}))}>
          <option value="">All Status</option>
          <option value="unpaid">Unpaid</option>
          <option value="partial">Partial</option>
          <option value="paid">Paid</option>
        </select>

        {/* Date range */}
        <input type="date" value={filters.from} title="From date"
          onChange={e => setFiltersAndReset(f => ({...f, from: e.target.value}))}
          style={{height:26,fontSize:11,padding:'2px 6px',borderRadius:3,border:'1px solid #ccc'}}/>
        <span style={{fontSize:11,color:'#888'}}>–</span>
        <input type="date" value={filters.to} title="To date"
          onChange={e => setFiltersAndReset(f => ({...f, to: e.target.value}))}
          style={{height:26,fontSize:11,padding:'2px 6px',borderRadius:3,border:'1px solid #ccc'}}/>

        {/* Supplier filter */}
        <div style={{minWidth:180}}>
          <CustomerTypeahead
            value={filters.supplier_id}
            displayName={supplierName}
            onChange={s => { setFiltersAndReset(f => ({...f, supplier_id: s.id})); setSupplierName(s.name) }}
            onClear={() => { setFiltersAndReset(f => ({...f, supplier_id: ''})); setSupplierName('') }}
            filterType="supplier"
            placeholder="Filter by supplier..."
          />
        </div>

        {hasFilters && (
          <button className="btn" onClick={clearFilters} title="Clear all filters">✕ Clear</button>
        )}

        <div className="toolbar-search">
          <input type="text" placeholder="Search purchase no. / supplier / inv no..."
            value={filters.q}
            onChange={e => setFiltersAndReset(f => ({...f, q: e.target.value}))}/>
          <button className="btn">🔍</button>
        </div>
      </div>

      <div style={{background:'var(--blue-light)',borderBottom:'1px solid #b0c8f0',padding:'5px 12px',fontSize:12,color:'#1a3a6c',flexShrink:0}}>
        ℹ Stock is updated automatically when a purchase is saved.
      </div>

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th>Purchase No.</th><th>Date</th><th>Due Date</th><th>Supplier</th><th>Supplier Inv. No.</th>
            <th className="right">Net BHD</th><th className="right">VAT BHD</th>
            <th className="right">Total BHD</th><th className="right">Paid BHD</th>
            <th className="right">Balance BHD</th><th>Status</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={11}>Loading...</td></tr>}
            {!isLoading && !rows.length && <tr className="empty-row"><td colSpan={11}>No purchases found</td></tr>}
            {rows.map(p => {
              const balance  = parseFloat(p.grand_total) - parseFloat(p.amount_paid)
              const isOverdue = p.due_date && new Date(p.due_date) < new Date() && balance > 0.001
              return (
                <tr key={p.id}
                  className={selectedId===p.id?'selected':''}
                  onClick={()=>setSelectedId(p.id)}
                  onDoubleClick={()=>{setSelectedId(p.id);setShowDetail(true)}}>
                  <td style={{color:'var(--blue)',fontWeight:600}}>{p.purchase_no}</td>
                  <td>{fmtDate(p.purchase_date)}</td>
                  <td style={{color: isOverdue ? 'var(--red)' : '#555', fontWeight: isOverdue ? 600 : 400}}>
                    {p.due_date ? fmtDate(p.due_date) : '—'}
                    {isOverdue && <span style={{fontSize:10,marginLeft:4}}>⚠</span>}
                  </td>
                  <td>{p.supplier_name}</td>
                  <td>{p.supplier_invoice_no||'—'}</td>
                  <td className="right">{fmtBhd(p.subtotal)}</td>
                  <td className="right">{fmtBhd(p.total_vat)}</td>
                  <td className="right" style={{fontWeight:600}}>{fmtBhd(p.grand_total)}</td>
                  <td className="right" style={{color:'var(--green)'}}>{fmtBhd(p.amount_paid)}</td>
                  <td className="right" style={{color:balance>0.001?'var(--red)':'var(--green)',fontWeight:600}}>
                    {fmtBhd(balance)}
                  </td>
                  <td><span className={`badge badge-${p.payment_status}`}>{p.payment_status}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Status bar + pagination */}
      <div className="status-bar" style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
        <span>{total.toLocaleString()} purchases</span>
        <span>|</span>
        <span>Page total: <strong>BHD {fmtBhd(rows.reduce((s,r)=>s+parseFloat(r.grand_total||0),0))}</strong></span>
        <span>|</span>
        <span>Outstanding: <strong style={{color:'var(--red)'}}>BHD {fmtBhd(rows.reduce((s,r)=>s+Math.max(0,parseFloat(r.grand_total||0)-parseFloat(r.amount_paid||0)),0))}</strong></span>
        <div style={{flex:1}}/>
        <span style={{fontSize:11,color:'#888'}}>Rows:</span>
        {PAGE_SIZES.map(n => (
          <button key={n} onClick={() => setPageSizeAndReset(n)}
            style={{
              padding:'2px 8px',fontSize:11,borderRadius:3,border:'1px solid #ccc',
              background: pageSize===n ? 'var(--blue)' : '#f5f5f5',
              color:      pageSize===n ? '#fff' : '#444',
              cursor:'pointer', fontWeight: pageSize===n ? 700 : 400,
            }}>{n}</button>
        ))}
        <button className="btn" style={{padding:'1px 7px',fontSize:11}}
          onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page<=1}>‹</button>
        <span style={{fontSize:11,fontWeight:600,minWidth:70,textAlign:'center'}}>
          {page} / {totalPages}
        </span>
        <button className="btn" style={{padding:'1px 7px',fontSize:11}}
          onClick={()=>setPage(p=>Math.min(totalPages,p+1))} disabled={page>=totalPages}>›</button>
      </div>

      {showForm && <PurchaseForm onClose={()=>setShowForm(false)} onSaved={()=>{qc.invalidateQueries(['purchases']);qc.invalidateQueries(['products'])}} />}
      {showDetail && selectedId && (
        <PurchaseDetail
          id={selectedId}
          detail={detail}
          payments={payments||[]}
          onClose={()=>setShowDetail(false)}
          onPayment={()=>setShowPayment(true)}
          qc={qc}
        />
      )}
      {showPayment && selectedId && (
        <PaymentModal
          purchase={selected}
          onClose={()=>setShowPayment(false)}
          onSaved={()=>{ qc.invalidateQueries(['purchases']); qc.invalidateQueries(['purchase-payments',selectedId]); setShowPayment(false) }}
        />
      )}
    </div>
  )
}

// ── New Purchase Form ──────────────────────────────────────
function PurchaseForm({ onClose, onSaved }) {
  const today = new Date().toISOString().split('T')[0]
  const emptyForm = { supplier_id:'', supplier_name:'', supplier_invoice_no:'', purchase_date: today, due_date:'', notes:'', items:[] }
  const [form, setForm] = useState(emptyForm)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const addItem = () => setForm(f=>({...f, items:[...f.items,{_id:Date.now(),product_id:'',description:'',qty:1,unit:'pcs',unit_price:0,vat_rate:10}]}))
  const updItem = (idx,k,v) => setForm(f=>{ const items=[...f.items]; items[idx]={...items[idx],[k]:v}; return {...f,items} })
  const remItem = idx => setForm(f=>({...f,items:f.items.filter((_,i)=>i!==idx)}))

  const subtotal = form.items.reduce((s,i)=>s+parseFloat(i.qty||0)*parseFloat(i.unit_price||0),0)
  const vatTotal = form.items.reduce((s,i)=>s+parseFloat(i.qty||0)*parseFloat(i.unit_price||0)*parseFloat(i.vat_rate||10)/100,0)

  const saveMut = useMutation({
    mutationFn: () => purchaseApi.create(form),
    onSuccess: () => { toast.success('Purchase saved — stock updated'); onSaved(); onClose() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header"><h3>New Purchase Invoice</h3><button className="close-btn" onClick={onClose}>✕</button></div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={()=>saveMut.mutate()} disabled={saveMut.isPending||!form.supplier_id||!form.items.length}>
            💾 {saveMut.isPending?'Saving...':'Save (Updates Stock)'}
          </button>
          <button className="btn" onClick={onClose}>✕ Cancel</button>
        </div>
        <div className="modal-body" style={{padding:12}}>
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
            <div className="field" style={{gridColumn:'span 2'}}><label>Supplier *</label>
              <CustomerTypeahead
                value={form.supplier_id}
                displayName={form.supplier_name}
                onChange={s=>{
                  const terms = parseInt(s.supplier_payment_terms_days ?? s.payment_terms_days ?? 30)
                  const base  = new Date(form.purchase_date || today)
                  base.setDate(base.getDate() + terms)
                  setForm(f=>({...f, supplier_id:s.id, supplier_name:s.name, due_date:base.toISOString().split('T')[0]}))
                }}
                onClear={()=>{ F('supplier_id',''); F('supplier_name',''); F('due_date','') }}
                filterType="supplier"
                allowCreate={true}
                placeholder="Search supplier..."
              />
            </div>
            <div className="field"><label>Supplier Invoice No.</label><input value={form.supplier_invoice_no} onChange={e=>F('supplier_invoice_no',e.target.value)}/></div>
            <div className="field"><label>Purchase Date</label><input type="date" value={form.purchase_date} onChange={e=>F('purchase_date',e.target.value)}/></div>
            <div className="field"><label>Due Date</label><input type="date" value={form.due_date} onChange={e=>F('due_date',e.target.value)} placeholder="Auto from supplier terms"/></div>
          </div>
          <table className="items-grid">
            <thead><tr><th style={{width:26}}>#</th><th>Description</th><th style={{width:60}}>Qty</th><th style={{width:45}}>Unit</th><th style={{width:85}}>Unit Price</th><th style={{width:55}}>VAT%</th><th style={{width:90}}>Total BHD</th><th style={{width:24}}></th></tr></thead>
            <tbody>
              {form.items.map((it,idx)=>(
                <tr key={it._id}>
                  <td style={{textAlign:'center',color:'#888'}}>{idx+1}</td>
                  <td><input value={it.description} onChange={e=>updItem(idx,'description',e.target.value)} placeholder="Product / description" style={{width:'100%'}}/></td>
                  <td><input type="number" value={it.qty} onChange={e=>updItem(idx,'qty',e.target.value)} style={{textAlign:'right'}}/></td>
                  <td><select value={it.unit} onChange={e=>updItem(idx,'unit',e.target.value)} style={{fontSize:11}}>
                    {['pcs','mtr','box','reel','kg','set'].map(u=><option key={u}>{u}</option>)}
                  </select></td>
                  <td><input type="number" step="0.001" value={it.unit_price} onChange={e=>updItem(idx,'unit_price',e.target.value)} style={{textAlign:'right'}}/></td>
                  <td><input type="number" value={it.vat_rate} onChange={e=>updItem(idx,'vat_rate',e.target.value)} style={{textAlign:'right'}}/></td>
                  <td style={{textAlign:'right',padding:'3px 5px',fontWeight:600}}>{fmtBhd((parseFloat(it.qty||0)*parseFloat(it.unit_price||0))*(1+parseFloat(it.vat_rate||10)/100))}</td>
                  <td><button onClick={()=>remItem(idx)} style={{background:'none',border:'none',color:'#c62828',cursor:'pointer'}}>✕</button></td>
                </tr>
              ))}
              {!form.items.length&&<tr><td colSpan={8} style={{padding:12,textAlign:'center',color:'#aaa',fontStyle:'italic'}}>No items — click Add Item below</td></tr>}
            </tbody>
          </table>
          <button className="add-item-btn" onClick={addItem}>＋ Add Item</button>
          <div className="field" style={{marginTop:8}}><label>Notes</label><textarea value={form.notes} onChange={e=>F('notes',e.target.value)} rows={2}/></div>
        </div>
        <div className="modal-footer">
          <table style={{width:'100%',fontSize:12.5}}>
            <tbody>
              <tr><td style={{color:'#555'}}>Subtotal:</td><td style={{textAlign:'right',width:130}}>BHD {subtotal.toFixed(3)}</td></tr>
              <tr><td style={{color:'#c62828'}}>VAT (10%):</td><td style={{textAlign:'right',color:'#c62828'}}>BHD {vatTotal.toFixed(3)}</td></tr>
              <tr style={{borderTop:'2px solid var(--blue)'}}><td style={{fontWeight:700,fontSize:14,color:'var(--blue)'}}>TOTAL:</td><td style={{textAlign:'right',fontWeight:700,fontSize:14,color:'var(--blue)'}}>BHD {(subtotal+vatTotal).toFixed(3)}</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ── Purchase Detail / Payment history ─────────────────────
function PurchaseDetail({ id, detail, payments, onClose, onPayment, qc }) {
  if (!detail) return (
    <div className="modal-overlay"><div className="modal modal-lg" style={{padding:24,textAlign:'center'}}>Loading...</div></div>
  )
  const balance = parseFloat(detail.grand_total) - parseFloat(detail.amount_paid)

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>{detail.purchase_no} — {detail.supplier_name}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          {balance > 0 && <button className="btn primary" onClick={onPayment}>💳 Record Payment</button>}
          <button className="btn" onClick={onClose}>Close</button>
        </div>
        <div className="modal-body" style={{padding:12}}>
          {/* Summary */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:12}}>
            <div style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:3,padding:'8px 10px'}}>
              <div style={{fontSize:10,color:'#777',textTransform:'uppercase'}}>Date</div>
              <div style={{fontWeight:600}}>{fmtDate(detail.purchase_date)}</div>
            </div>
            <div style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:3,padding:'8px 10px'}}>
              <div style={{fontSize:10,color:'#777',textTransform:'uppercase'}}>Supplier Inv.</div>
              <div style={{fontWeight:600}}>{detail.supplier_invoice_no||'—'}</div>
            </div>
            <div style={{background:'var(--blue-light)',border:'1px solid #b0c8f0',borderRadius:3,padding:'8px 10px'}}>
              <div style={{fontSize:10,color:'#555',textTransform:'uppercase'}}>Total</div>
              <div style={{fontWeight:700,color:'var(--blue)'}}>BHD {fmtBhd(detail.grand_total)}</div>
            </div>
            <div style={{background: balance>0?'#fdecea':'var(--green-light)', border:`1px solid ${balance>0?'#ef9a9a':'#a5d6a7'}`, borderRadius:3, padding:'8px 10px'}}>
              <div style={{fontSize:10,color:'#555',textTransform:'uppercase'}}>Balance Due</div>
              <div style={{fontWeight:700,color:balance>0?'var(--red)':'var(--green)'}}>BHD {fmtBhd(balance)}</div>
            </div>
          </div>

          {/* Line items */}
          <div style={{fontWeight:700,fontSize:12,marginBottom:4,color:'#333'}}>Line Items</div>
          <table className="data-table" style={{fontSize:12,marginBottom:14}}>
            <thead><tr><th>#</th><th>Description</th><th>Qty</th><th>Unit</th><th className="right">Unit Price</th><th className="right">VAT%</th><th className="right">Total BHD</th></tr></thead>
            <tbody>
              {(detail.items||[]).map((it,i)=>(
                <tr key={it.id}>
                  <td>{it.line_no}</td>
                  <td>{it.description}</td>
                  <td>{it.qty} {it.unit}</td>
                  <td>{it.unit}</td>
                  <td className="right">{fmtBhd(it.unit_price)}</td>
                  <td className="right">{it.vat_rate}%</td>
                  <td className="right" style={{fontWeight:600}}>{fmtBhd(parseFloat(it.qty)*parseFloat(it.unit_price)*(1+parseFloat(it.vat_rate)/100))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Payments */}
          <div style={{fontWeight:700,fontSize:12,marginBottom:4,color:'#333'}}>Payment History</div>
          {payments.length === 0
            ? <div style={{color:'#aaa',fontSize:12,padding:'8px 0'}}>No payments recorded yet</div>
            : <table className="data-table" style={{fontSize:12}}>
                <thead><tr><th>Date</th><th>Method</th><th>Reference</th><th className="right">Amount BHD</th></tr></thead>
                <tbody>
                  {payments.map(p=>(
                    <tr key={p.id}>
                      <td>{fmtDate(p.payment_date)}</td>
                      <td>{p.method}</td>
                      <td>{p.reference_no||'—'}</td>
                      <td className="right" style={{fontWeight:600,color:'var(--green)'}}>BHD {fmtBhd(p.amount)}</td>
                    </tr>
                  ))}
                  <tr style={{fontWeight:700,background:'#f5f5f5'}}>
                    <td colSpan={3}>Total Paid</td>
                    <td className="right" style={{color:'var(--green)'}}>BHD {fmtBhd(payments.reduce((s,p)=>s+parseFloat(p.amount||0),0))}</td>
                  </tr>
                </tbody>
              </table>
          }
        </div>
      </div>
    </div>
  )
}

// ── Record Payment Modal ───────────────────────────────────
function PaymentModal({ purchase, onClose, onSaved }) {
  const balance = purchase ? parseFloat(purchase.grand_total) - parseFloat(purchase.amount_paid) : 0
  const [form, setForm] = useState({
    amount: balance.toFixed(3),
    method: 'bank_transfer',
    payment_date: new Date().toISOString().split('T')[0],
    reference_no: '',
    notes: '',
  })
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const saveMut = useMutation({
    mutationFn: () => purchaseApi.addPayment(purchase.id, form),
    onSuccess: () => { toast.success('Payment recorded'); onSaved() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>Record Payment — {purchase?.purchase_no}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={()=>saveMut.mutate()} disabled={saveMut.isPending||!form.amount}>
            💾 {saveMut.isPending?'Saving...':'Save Payment'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-body" style={{padding:12}}>
          <div style={{background:'var(--blue-light)',border:'1px solid #b0c8f0',borderRadius:3,padding:'6px 10px',marginBottom:10,fontSize:12}}>
            Balance outstanding: <strong style={{color:'var(--blue)'}}>BHD {fmtBhd(balance)}</strong>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div className="field"><label>Amount BHD *</label>
              <input type="number" step="0.001" value={form.amount} onChange={e=>F('amount',e.target.value)}/>
            </div>
            <div className="field"><label>Payment Date</label>
              <input type="date" value={form.payment_date} onChange={e=>F('payment_date',e.target.value)}/>
            </div>
            <div className="field"><label>Method</label>
              <select value={form.method} onChange={e=>F('method',e.target.value)}>
                {['bank_transfer','cheque','cash','card'].map(m=><option key={m} value={m}>{m.replace('_',' ')}</option>)}
              </select>
            </div>
            <div className="field"><label>Reference No.</label>
              <input value={form.reference_no} onChange={e=>F('reference_no',e.target.value)} placeholder="Cheque no. / transfer ref."/>
            </div>
          </div>
          <div className="field" style={{marginTop:8}}><label>Notes</label>
            <textarea value={form.notes} onChange={e=>F('notes',e.target.value)} rows={2}/>
          </div>
        </div>
      </div>
    </div>
  )
}
