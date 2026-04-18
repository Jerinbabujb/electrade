import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { shipmentApi, productApi } from '../../../services/api'
import toast from 'react-hot-toast'

// ── Constants ─────────────────────────────────────────────────
const CURRENCIES = ['USD','EUR','GBP','CNY','AED','SAR','INR','JPY','BHD']

// Approximate rates to BHD — user overrides with actual rate
const HINT_RATES = {
  USD:'0.376900', EUR:'0.415000', GBP:'0.485000', CNY:'0.052000',
  AED:'0.102600', SAR:'0.100400', INR:'0.004520', JPY:'0.002530', BHD:'1.000000',
}

const ALLOC_METHODS = [
  { value:'value',  label:'By Value — proportional to item cost × qty (recommended)' },
  { value:'qty',    label:'By Quantity — equal additional cost per unit' },
  { value:'weight', label:'By Weight — proportional to kg (enter weights per item)' },
]

const STATUS_STYLE = {
  draft:      { bg:'#f5f5f5', color:'#888',    label:'Draft' },
  calculated: { bg:'#e3f2fd', color:'#1565c0', label:'Calculated' },
  applied:    { bg:'#e8f5e9', color:'#2e7d32', label:'Applied' },
}

const fmt    = (v, d=3) => parseFloat(v||0).toFixed(d)
const fmtBhd = v       => parseFloat(v||0).toFixed(3)        // BHD always 3 dp (fils)
const fmtFC  = v       => parseFloat(v||0).toFixed(2)        // foreign currency totals — 2 dp (cents)
const fmtAmt = (v, cur) => cur === 'BHD' ? fmtBhd(v) : fmtFC(v)  // pick by currency
const pf     = v       => parseFloat(v||0)

// ── CurrencyRate input group ──────────────────────────────────
function CurrencyRate({ label, cur, xrate, onCur, onRate, disabled }) {
  return (
    <div style={{display:'flex',gap:6,alignItems:'flex-end'}}>
      <div className="field" style={{margin:0,width:90}}>
        {label && <label style={{fontSize:10}}>{label}</label>}
        <select value={cur} onChange={e=>{onCur(e.target.value); if(HINT_RATES[e.target.value]&&!xrate) onRate(HINT_RATES[e.target.value])}} disabled={disabled}>
          {CURRENCIES.map(c=><option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="field" style={{margin:0,flex:1}}>
        <label style={{fontSize:10}}>
          1 {cur} = ? BHD
          {HINT_RATES[cur] && !xrate && <span onClick={()=>onRate(HINT_RATES[cur])} style={{color:'var(--blue)',cursor:'pointer',marginLeft:4,fontSize:9}}>(use ~{HINT_RATES[cur]})</span>}
        </label>
        <input type="number" step="0.000001" min="0" value={xrate} onChange={e=>onRate(e.target.value)} placeholder={HINT_RATES[cur]||'0.376900'} disabled={disabled}/>
      </div>
    </div>
  )
}

// ── Section header ─────────────────────────────────────────────
const SectionHead = ({label, total, cur='BHD'}) => (
  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',
    gridColumn:'span 2',fontSize:11,fontWeight:700,color:'#333',
    padding:'6px 0 4px',borderBottom:'2px solid #e0e0e0',marginTop:6}}>
    <span>{label}</span>
    {total!=null && <span style={{color:'var(--blue)',fontWeight:600,fontSize:12}}>≈ BHD {fmtBhd(total)}</span>}
  </div>
)

// ── Shipment Form ─────────────────────────────────────────────
const EMPTY = {
  description:'', supplier:'', origin_country:'', shipment_date:'', arrival_date:'',
  product_currency:'USD', product_xrate:'',
  freight_amount:'', freight_prepaid:true, freight_currency:'USD', freight_xrate:'',
  insurance:'', insurance_currency:'USD', insurance_xrate:'',
  customs_duty:'', import_vat:'', clearing_fee:'', local_transport:'',
  apmt_charges:'', demurrage:'', delivery_order:'', other_local:'',
  allocation_method:'value', notes:'',
}

function ShipmentForm({ initial, onSave, onCancel, saving }) {
  const [f, setF] = useState(() => {
    if (!initial) return { ...EMPTY }
    return {
      description:       initial.description       || '',
      supplier:          initial.supplier          || '',
      origin_country:    initial.origin_country    || '',
      shipment_date:     initial.shipment_date?.split('T')[0] || '',
      arrival_date:      initial.arrival_date?.split('T')[0]  || '',
      product_currency:  initial.product_currency  || 'USD',
      product_xrate:     initial.product_xrate     || '',
      freight_amount:    initial.freight_amount    || '',
      freight_prepaid:   initial.freight_prepaid   !== false,
      freight_currency:  initial.freight_currency  || 'USD',
      freight_xrate:     initial.freight_xrate     || '',
      insurance:         initial.insurance         || '',
      insurance_currency:initial.insurance_currency|| 'USD',
      insurance_xrate:   initial.insurance_xrate   || '',
      customs_duty:      initial.customs_duty      || '',
      import_vat:        initial.import_vat        || '',
      clearing_fee:      initial.clearing_fee      || '',
      local_transport:   initial.local_transport   || '',
      apmt_charges:      initial.apmt_charges      || '',
      demurrage:         initial.demurrage         || '',
      delivery_order:    initial.delivery_order    || '',
      other_local:       initial.other_local       || '',
      allocation_method: initial.allocation_method || 'value',
      notes:             initial.notes             || '',
    }
  })

  const F = (k, v) => setF(p => ({ ...p, [k]: v }))

  // Live BHD totals
  const prodXr     = pf(f.product_xrate)   || pf(HINT_RATES[f.product_currency])
  const frtXr      = f.freight_prepaid ? (pf(f.freight_xrate) || pf(HINT_RATES[f.freight_currency])) : 1
  const insXr      = pf(f.insurance_xrate) || pf(HINT_RATES[f.insurance_currency])
  const freightBhd = pf(f.freight_amount)  * frtXr
  const insureBhd  = pf(f.insurance)       * insXr
  const localBhd   = pf(f.customs_duty) + pf(f.import_vat) + pf(f.clearing_fee) + pf(f.local_transport)
                   + pf(f.apmt_charges) + pf(f.demurrage)  + pf(f.delivery_order) + pf(f.other_local)
  const grandAddBhd = freightBhd + insureBhd + localBhd

  const numField = (key, placeholder='0.000') => (
    <input type="number" step="0.001" min="0" value={f[key]}
      onChange={e=>F(key,e.target.value)} placeholder={placeholder}/>
  )

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'4px 12px'}}>

      {/* ── Details ── */}
      <SectionHead label="Shipment Details" />
      <div className="field" style={{gridColumn:'span 2'}}><label>Description / Reference</label>
        <input value={f.description} onChange={e=>F('description',e.target.value)} placeholder="e.g. Spring 2026 — China cables order"/></div>
      <div className="field"><label>Supplier / Seller</label>
        <input value={f.supplier} onChange={e=>F('supplier',e.target.value)} placeholder="Supplier name"/></div>
      <div className="field"><label>Origin Country</label>
        <input value={f.origin_country} onChange={e=>F('origin_country',e.target.value)} placeholder="e.g. China"/></div>
      <div className="field"><label>Shipment / Invoice Date</label>
        <input type="date" value={f.shipment_date} onChange={e=>F('shipment_date',e.target.value)}/></div>
      <div className="field"><label>Arrival Date (Expected / Actual)</label>
        <input type="date" value={f.arrival_date} onChange={e=>F('arrival_date',e.target.value)}/></div>

      {/* ── Product cost currency ── */}
      <SectionHead label="① Product Cost Currency" />
      <div style={{gridColumn:'span 2'}}>
        <CurrencyRate label="Currency of supplier invoice"
          cur={f.product_currency} xrate={f.product_xrate}
          onCur={v=>F('product_currency',v)} onRate={v=>F('product_xrate',v)}/>
      </div>

      {/* ── Freight ── */}
      <SectionHead label="② Freight / Shipping" total={freightBhd} />
      <div style={{gridColumn:'span 2',display:'flex',gap:12,marginBottom:4}}>
        {[['true','Prepaid — paid to foreign shipping line (USD or foreign currency)'],
          ['false','Collect — paid locally to Bahrain shipping agent (BHD)']].map(([val,lbl])=>(
          <label key={val} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer'}}>
            <input type="radio" name="freight_prepaid" checked={f.freight_prepaid===(val==='true')}
              onChange={()=>{ F('freight_prepaid',val==='true'); if(val==='false'){F('freight_currency','BHD');F('freight_xrate','1')} else {F('freight_currency','USD');F('freight_xrate','')} }}/>
            {lbl}
          </label>
        ))}
      </div>
      <div className="field"><label>Freight Amount</label>{numField('freight_amount')}</div>
      {f.freight_prepaid ? (
        <CurrencyRate label="Freight currency"
          cur={f.freight_currency} xrate={f.freight_xrate}
          onCur={v=>F('freight_currency',v)} onRate={v=>F('freight_xrate',v)}/>
      ) : (
        <div style={{display:'flex',alignItems:'center',padding:'0 0 4px',fontSize:12,color:'#2e7d32',fontWeight:600}}>
          BHD — paid to local agent (no conversion)
        </div>
      )}

      {/* ── Insurance ── */}
      <SectionHead label="③ Insurance (optional)" total={insureBhd}/>
      <div className="field"><label>Insurance Amount</label>{numField('insurance')}</div>
      <CurrencyRate label="Insurance currency"
        cur={f.insurance_currency} xrate={f.insurance_xrate}
        onCur={v=>F('insurance_currency',v)} onRate={v=>F('insurance_xrate',v)}/>

      {/* ── Local charges ── */}
      <SectionHead label="④ Local Charges — all in BHD" total={localBhd}/>
      <div className="field"><label>Customs Duty</label>{numField('customs_duty')}</div>
      <div className="field"><label>Import VAT (on CIF value)</label>{numField('import_vat')}</div>
      <div className="field"><label>Clearing Agent Fee</label>{numField('clearing_fee')}</div>
      <div className="field"><label>Bahrain Local Transportation</label>{numField('local_transport')}</div>
      <div className="field"><label>APMT / Port Terminal Charges</label>{numField('apmt_charges')}</div>
      <div className="field"><label>Demurrage</label>{numField('demurrage')}</div>
      <div className="field"><label>Delivery Order (DO)</label>{numField('delivery_order')}</div>
      <div className="field"><label>Other Local</label>{numField('other_local')}</div>

      {/* ── Grand total ── */}
      <div style={{gridColumn:'span 2',display:'flex',gap:10,background:'#f0f7ff',border:'1px solid #b0c8f0',borderRadius:3,padding:'8px 14px',marginTop:4}}>
        {[
          ['Freight (BHD)',   freightBhd],
          ['Insurance (BHD)', insureBhd],
          ['Local (BHD)',     localBhd],
          ['Total Additional',grandAddBhd],
        ].map(([l,v])=>(
          <div key={l} style={{flex:1,textAlign:'center'}}>
            <div style={{fontSize:10,color:'#888'}}>{l}</div>
            <div style={{fontWeight:700,color: l.startsWith('Total')?'var(--blue)':'#333'}}>{fmtBhd(v)}</div>
          </div>
        ))}
      </div>

      {/* ── Allocation ── */}
      <SectionHead label="⑤ Cost Allocation Method"/>
      <div className="field" style={{gridColumn:'span 2'}}>
        <label>How to distribute additional costs across products</label>
        <select value={f.allocation_method} onChange={e=>F('allocation_method',e.target.value)}>
          {ALLOC_METHODS.map(m=><option key={m.value} value={m.value}>{m.label}</option>)}
        </select>
      </div>
      <div className="field" style={{gridColumn:'span 2'}}><label>Notes</label>
        <textarea rows={2} value={f.notes} onChange={e=>F('notes',e.target.value)}/></div>

      <div style={{gridColumn:'span 2',display:'flex',gap:8,paddingTop:8}}>
        <button className="btn primary" onClick={()=>onSave(f)} disabled={saving}>
          {saving ? 'Saving…' : initial ? 'Update Shipment' : 'Create Shipment'}
        </button>
        <button className="btn" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )
}

// ── Add Item Row ──────────────────────────────────────────────
function AddItemRow({ shipmentId, currency, onAdded }) {
  const qc = useQueryClient()
  const [f, setF] = useState({ product_id:'', sku:'', product_name:'', qty:'', unit_cost:'', weight_kg:'' })
  const [search, setSearch] = useState('')
  const F = (k, v) => setF(p => ({ ...p, [k]: v }))

  const { data: prodData } = useQuery({
    queryKey: ['products-search', search],
    queryFn: () => search.length > 1
      ? productApi.list({ search, limit: 12 }).then(r => r.data.data)
      : Promise.resolve([]),
    enabled: search.length > 1,
  })
  const products = prodData || []

  const selectProduct = p => {
    F('product_id', p.id); F('sku', p.sku); F('product_name', p.name)
    F('unit_cost', p.cost_price || '')
    setSearch(p.name)
  }

  const addMut = useMutation({
    mutationFn: () => shipmentApi.addItem(shipmentId, {
      product_id: f.product_id || null,
      sku: f.sku, product_name: f.product_name,
      qty: f.qty, unit_cost: f.unit_cost,
      weight_kg: f.weight_kg || null,
    }),
    onSuccess: () => {
      qc.invalidateQueries(['shipment', shipmentId])
      setF({ product_id:'', sku:'', product_name:'', qty:'', unit_cost:'', weight_kg:'' })
      setSearch('')
      onAdded?.()
    },
  })

  return (
    <tr style={{ background: '#f8fbff' }}>
      <td style={{ padding:'3px 5px', position:'relative' }}>
        <input value={search}
          onChange={e => { setSearch(e.target.value); F('product_id',''); F('sku',''); F('product_name','') }}
          placeholder="Search product…" style={{ width:'100%', fontSize:11 }}/>
        {products.length > 0 && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, zIndex:200,
            background:'#fff', border:'1px solid #ccc', boxShadow:'0 4px 12px rgba(0,0,0,.12)',
            maxHeight:160, overflowY:'auto' }}>
            {products.map(p => (
              <div key={p.id} onClick={() => selectProduct(p)} style={{ padding:'5px 8px', cursor:'pointer', fontSize:11, borderBottom:'1px solid #f0f0f0' }}
                onMouseEnter={e=>e.currentTarget.style.background='var(--blue-light)'}
                onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
                <span style={{ fontWeight:600, color:'var(--blue)' }}>{p.sku}</span>
                <span style={{ color:'#555', marginLeft:8 }}>{p.name}</span>
                {p.cost_price > 0 && <span style={{ color:'#888', marginLeft:8, fontSize:10 }}>cost: {fmt(p.cost_price)}</span>}
              </div>
            ))}
          </div>
        )}
      </td>
      <td style={{ padding:'3px 5px' }}>
        <input value={f.sku} onChange={e=>F('sku',e.target.value)} placeholder="SKU" style={{ width:'100%', fontSize:11 }}/>
      </td>
      <td style={{ padding:'3px 5px' }}>
        <input type="number" value={f.qty} onChange={e=>F('qty',e.target.value)} placeholder="0" style={{ width:70, fontSize:11 }}/>
      </td>
      <td style={{ padding:'3px 5px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:3 }}>
          <span style={{ fontSize:10, color:'#888', whiteSpace:'nowrap' }}>{currency}</span>
          <input type="number" step="0.00001" value={f.unit_cost} onChange={e=>F('unit_cost',e.target.value)} placeholder="0.00000" style={{ width:'100%', fontSize:11 }}/>
        </div>
      </td>
      <td style={{ padding:'3px 5px' }}>
        <input type="number" step="0.001" value={f.weight_kg} onChange={e=>F('weight_kg',e.target.value)} placeholder="kg" style={{ width:56, fontSize:11 }}/>
      </td>
      <td colSpan={6} style={{ padding:'3px 5px' }}>
        <button className="btn primary" style={{ fontSize:11, padding:'3px 10px' }}
          onClick={() => addMut.mutate()} disabled={addMut.isPending || !f.qty}>
          + Add
        </button>
      </td>
    </tr>
  )
}

// ── Payment Panel ─────────────────────────────────────────────
function PaymentPanel({ shipment }) {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const resetPay = () => ({
    payment_date:  new Date().toISOString().split('T')[0],
    payment_type:  'advance',
    amount:        '',
    currency:      shipment.product_currency || 'USD',
    exchange_rate: shipment.product_xrate || HINT_RATES[shipment.product_currency || 'USD'] || '',
    bank_charges:  '',
    reference_no:  '',
    notes:         '',
  })
  const [pay, setPay] = useState(resetPay)
  const P = (k, v) => setPay(prev => ({ ...prev, [k]: v }))

  const payments   = shipment.payments || []
  const items      = shipment.items    || []
  const prodXr     = pf(shipment.product_xrate) || 1
  const totalPaid  = payments.reduce((t, p) => t + pf(p.amount_bhd),    0)
  const totalBank  = payments.reduce((t, p) => t + pf(p.bank_charges),   0)
  const supplierPayable = items.reduce((t, i) => t + pf(i.qty) * pf(i.unit_cost) * prodXr, 0)
  const outstanding     = supplierPayable - totalPaid

  const addMut = useMutation({
    mutationFn: d => shipmentApi.addPayment(shipment.id, d),
    onSuccess: () => {
      toast.success('Payment recorded')
      qc.invalidateQueries(['shipment', shipment.id])
      qc.invalidateQueries(['shipments'])
      setShowForm(false)
      setPay(resetPay())
    },
  })
  const delMut = useMutation({
    mutationFn: paymentId => shipmentApi.deletePayment(shipment.id, paymentId),
    onSuccess: () => {
      qc.invalidateQueries(['shipment', shipment.id])
      qc.invalidateQueries(['shipments'])
    },
  })

  const amtBhd = pay.currency === 'BHD'
    ? pf(pay.amount)
    : pf(pay.amount) * pf(pay.exchange_rate)

  return (
    <div style={{ marginTop:16, borderTop:'2px solid #e0e0e0', paddingTop:12 }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
        <div style={{ fontWeight:700, fontSize:13, color:'#333' }}>Payments</div>
        {!showForm && (
          <button className="btn primary" style={{ fontSize:11, padding:'3px 10px' }} onClick={() => setShowForm(true)}>
            + Add Payment
          </button>
        )}
      </div>

      {/* Summary bar */}
      <div style={{ display:'flex', gap:8, marginBottom:10, flexWrap:'wrap' }}>
        {[
          { label:'Supplier Payable (BHD)',  value: fmtBhd(supplierPayable),            color:'#555' },
          { label:'Total Paid (BHD)',         value: fmtBhd(totalPaid),                  color:'#1565c0' },
          { label:'Outstanding (BHD)',        value: fmtBhd(Math.max(0, outstanding)),    color: outstanding > 0.001 ? '#c62828' : '#2e7d32' },
          { label:'Bank Charges (BHD)',       value: fmtBhd(totalBank),                  color:'#e65100' },
        ].map(t => (
          <div key={t.label} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:3, padding:'5px 12px', minWidth:140 }}>
            <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', marginBottom:2 }}>{t.label}</div>
            <div style={{ fontSize:13, fontWeight:700, color:t.color }}>{t.value}</div>
          </div>
        ))}
      </div>

      {/* Payment history */}
      {payments.length > 0 && (
        <div style={{ overflowX:'auto', marginBottom:10 }}>
          <table className="data-table" style={{ fontSize:11, minWidth:760 }}>
            <thead>
              <tr>
                <th>Date</th><th>Type</th>
                <th style={{ textAlign:'right' }}>Amount</th>
                <th>Currency</th>
                <th style={{ textAlign:'right' }}>Rate</th>
                <th style={{ textAlign:'right', color:'#1565c0' }}>BHD Equiv.</th>
                <th style={{ textAlign:'right', color:'#e65100' }}>Bank Charges</th>
                <th>Reference</th><th></th>
              </tr>
            </thead>
            <tbody>
              {payments.map(p => (
                <tr key={p.id}>
                  <td>{new Date(p.payment_date).toLocaleDateString()}</td>
                  <td style={{ textTransform:'capitalize' }}>{p.payment_type}</td>
                  <td style={{ textAlign:'right', fontWeight:600 }}>{fmtAmt(p.amount, p.currency)}</td>
                  <td>{p.currency}</td>
                  <td style={{ textAlign:'right', color:'#888', fontSize:10 }}>{fmt(p.exchange_rate, 6)}</td>
                  <td style={{ textAlign:'right', fontWeight:700, color:'#1565c0' }}>BHD {fmtBhd(p.amount_bhd)}</td>
                  <td style={{ textAlign:'right', color:'#e65100' }}>
                    {pf(p.bank_charges) > 0 ? `BHD ${fmtBhd(p.bank_charges)}` : '—'}
                  </td>
                  <td style={{ color:'#888', fontSize:11 }}>{p.reference_no || '—'}</td>
                  <td>
                    <button
                      onClick={() => { if (window.confirm('Delete this payment?')) delMut.mutate(p.id) }}
                      style={{ background:'none', border:'none', color:'#c62828', cursor:'pointer', fontSize:14, padding:'0 4px' }}>
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {payments.length === 0 && !showForm && (
        <div style={{ color:'#aaa', fontSize:12, fontStyle:'italic', marginBottom:8 }}>No payments recorded yet.</div>
      )}

      {/* Add payment form */}
      {showForm && (
        <div style={{ background:'#f8fbff', border:'1px solid #c5d8f6', borderRadius:4, padding:12, marginBottom:10 }}>
          <div style={{ fontWeight:600, fontSize:12, marginBottom:8, color:'var(--blue)' }}>New Payment</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'4px 12px' }}>
            <div className="field"><label>Date</label>
              <input type="date" value={pay.payment_date} onChange={e=>P('payment_date',e.target.value)}/></div>
            <div className="field"><label>Payment Type</label>
              <select value={pay.payment_type} onChange={e=>P('payment_type',e.target.value)}>
                <option value="advance">Advance</option>
                <option value="balance">Balance</option>
                <option value="full">Full Payment</option>
                <option value="other">Other</option>
              </select></div>
            <div className="field"><label>Reference No. (TT / Bank Ref)</label>
              <input value={pay.reference_no} onChange={e=>P('reference_no',e.target.value)} placeholder="e.g. TT-20260409"/></div>

            <div className="field"><label>Amount</label>
              <input type="number" step="0.001" min="0" value={pay.amount}
                onChange={e=>P('amount',e.target.value)} placeholder="0.000"/></div>
            <div className="field"><label>Currency</label>
              <select value={pay.currency}
                onChange={e=>{ P('currency',e.target.value); P('exchange_rate', e.target.value==='BHD' ? '1' : HINT_RATES[e.target.value]||'') }}>
                {CURRENCIES.map(c=><option key={c}>{c}</option>)}
              </select></div>
            <div className="field">
              <label>
                Exchange Rate (1 {pay.currency} = ? BHD)
                {pay.currency !== 'BHD' && HINT_RATES[pay.currency] && (
                  <span onClick={()=>P('exchange_rate',HINT_RATES[pay.currency])}
                    style={{ color:'var(--blue)', cursor:'pointer', marginLeft:4, fontSize:9 }}>
                    (use ~{HINT_RATES[pay.currency]})
                  </span>
                )}
              </label>
              <input type="number" step="0.000001" min="0" value={pay.exchange_rate}
                onChange={e=>P('exchange_rate',e.target.value)}
                placeholder={HINT_RATES[pay.currency]||'1.000000'}
                disabled={pay.currency==='BHD'}/></div>

            <div className="field"><label>Bank Charges (BHD)</label>
              <input type="number" step="0.001" min="0" value={pay.bank_charges}
                onChange={e=>P('bank_charges',e.target.value)} placeholder="0.000"/></div>
            <div className="field" style={{ gridColumn:'span 2' }}><label>Notes</label>
              <input value={pay.notes} onChange={e=>P('notes',e.target.value)} placeholder="Optional notes"/></div>
          </div>

          {pf(pay.amount) > 0 && (
            <div style={{ fontSize:11, color:'var(--blue)', margin:'6px 0', fontWeight:600 }}>
              ≈ BHD {fmtBhd(amtBhd)} equivalent
              {pf(pay.bank_charges) > 0 && ` + BHD ${fmtBhd(pf(pay.bank_charges))} bank charges = BHD ${fmtBhd(amtBhd + pf(pay.bank_charges))} total outflow`}
            </div>
          )}

          <div style={{ display:'flex', gap:8, marginTop:6 }}>
            <button className="btn primary" style={{ fontSize:11 }}
              onClick={() => addMut.mutate(pay)} disabled={addMut.isPending || !pay.amount || !pay.payment_date}>
              {addMut.isPending ? 'Saving…' : 'Record Payment'}
            </button>
            <button className="btn" style={{ fontSize:11 }} onClick={() => setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Shipment Detail ───────────────────────────────────────────
function ShipmentDetail({ shipmentId, onClose }) {
  const qc = useQueryClient()
  const [editing, setEditing]         = useState(false)
  const [applyConfirm, setApplyConfirm] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['shipment', shipmentId],
    queryFn:  () => shipmentApi.get(shipmentId).then(r => r.data.data),
  })

  const updateMut = useMutation({
    mutationFn: d => shipmentApi.update(shipmentId, d),
    onSuccess: () => { toast.success('Updated'); setEditing(false); qc.invalidateQueries(['shipment',shipmentId]); qc.invalidateQueries(['shipments']) },
  })
  const calcMut = useMutation({
    mutationFn: () => shipmentApi.calculate(shipmentId),
    onSuccess: () => { toast.success('Landed costs calculated'); qc.invalidateQueries(['shipment',shipmentId]) },
  })
  const applyMut = useMutation({
    mutationFn: () => shipmentApi.apply(shipmentId),
    onSuccess: r => { toast.success(r.data.message); setApplyConfirm(false); qc.invalidateQueries(['shipment',shipmentId]); qc.invalidateQueries(['shipments']) },
  })
  const delItemMut = useMutation({
    mutationFn: itemId => shipmentApi.deleteItem(shipmentId, itemId),
    onSuccess: () => qc.invalidateQueries(['shipment', shipmentId]),
  })

  if (isLoading) return <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#aaa' }}>Loading…</div>
  if (!data) return null

  const s     = data
  const items = s.items || []
  const pc    = s.product_currency || 'USD'
  const prodXr = pf(s.product_xrate) || 1
  const frtXr  = s.freight_prepaid ? (pf(s.freight_xrate)||1) : 1
  const insXr  = pf(s.insurance_xrate) || 1

  const freightBhd    = pf(s.freight_amount) * frtXr
  const insuranceBhd  = pf(s.insurance)      * insXr
  const customsBhd    = pf(s.customs_duty)   + pf(s.import_vat)
  const localOtherBhd = pf(s.clearing_fee)  + pf(s.local_transport) + pf(s.apmt_charges)
                      + pf(s.demurrage)      + pf(s.delivery_order)  + pf(s.other_local)
  const totalAdditionalBhd = freightBhd + insuranceBhd + customsBhd + localOtherBhd
  const productCostBhd     = items.reduce((t,i) => t + pf(i.qty)*pf(i.unit_cost)*prodXr, 0)
  const landedTotal        = items.reduce((t,i) => t + pf(i.total_landed_cost), 0)
  const st = STATUS_STYLE[s.status] || STATUS_STYLE.draft

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {/* Header bar */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px', borderBottom:'2px solid var(--blue)', background:'#f0f4fb', flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:16, cursor:'pointer', color:'#555' }}>←</button>
        <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)' }}>{s.shipment_no}</div>
        <span style={{ padding:'2px 10px', borderRadius:10, fontSize:11, fontWeight:600, background:st.bg, color:st.color }}>{st.label}</span>
        <span style={{ color:'#888', fontSize:12, flex:1 }}>
          {s.supplier}{s.origin_country ? ` · ${s.origin_country}` : ''}
          {s.shipment_date ? ` · ${new Date(s.shipment_date).toLocaleDateString()}` : ''}
        </span>
        {!editing && s.status !== 'applied' && (
          <button className="btn" style={{ fontSize:11 }} onClick={() => setEditing(true)}>✎ Edit</button>
        )}
      </div>

      <div style={{ flex:1, overflow:'auto', padding:14 }}>
        {editing ? (
          <ShipmentForm initial={s} saving={updateMut.isPending}
            onSave={d => updateMut.mutate(d)} onCancel={() => setEditing(false)}/>
        ) : (
          <>
            {/* Cost summary tiles */}
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              {[
                { label:`Product Cost (${pc})`,   value:`${pc} ${fmtFC(items.reduce((t,i)=>t+pf(i.qty)*pf(i.unit_cost),0))}`, sub:`≈ BHD ${fmtBhd(productCostBhd)}`,  color:'#555' },
                { label:`Freight`,  value:s.freight_prepaid ? `${s.freight_currency} ${fmtAmt(s.freight_amount, s.freight_currency)}` : `BHD ${fmtBhd(s.freight_amount)}`, sub:`≈ BHD ${fmtBhd(freightBhd)}`, color:'#e65100' },
                { label:'Insurance',value:`${s.insurance_currency} ${fmtAmt(s.insurance, s.insurance_currency)}`, sub:`≈ BHD ${fmtBhd(insuranceBhd)}`, color:'#e65100' },
                { label:'Local Charges (BHD)', value:`BHD ${fmtBhd(customsBhd+localOtherBhd)}`, sub:'duty+VAT+clearing+port…', color:'#c62828' },
                { label:'Total Additional (BHD)', value:`BHD ${fmtBhd(totalAdditionalBhd)}`, sub:'all add. costs', color:'#1565c0' },
                { label:'Total Landed (BHD)', value:`BHD ${fmtBhd(landedTotal)}`, sub:`${items.length} product lines`, color:'#2e7d32' },
              ].map(t => (
                <div key={t.label} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:3, padding:'6px 12px', minWidth:148 }}>
                  <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', marginBottom:2 }}>{t.label}</div>
                  <div style={{ fontSize:13, fontWeight:700, color:t.color }}>{t.value}</div>
                  <div style={{ fontSize:10, color:'#aaa' }}>{t.sub}</div>
                </div>
              ))}
            </div>

            {/* Local charges breakdown */}
            {(customsBhd + localOtherBhd) > 0 && (
              <div style={{ background:'#fff8f0', border:'1px solid #ffe0b2', borderRadius:3, padding:'7px 12px', marginBottom:12, fontSize:11 }}>
                <div style={{ fontWeight:700, color:'#e65100', marginBottom:5, fontSize:11 }}>Local Charges Breakdown (BHD)</div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 20px' }}>
                  {[
                    ['Customs Duty', s.customs_duty], ['Import VAT', s.import_vat],
                    ['Clearing Fee', s.clearing_fee], ['Local Transport', s.local_transport],
                    ['APMT Charges', s.apmt_charges], ['Demurrage', s.demurrage],
                    ['Delivery Order', s.delivery_order], ['Other Local', s.other_local],
                  ].filter(([,v])=>pf(v)>0).map(([l,v])=>(
                    <div key={l} style={{ fontSize:11 }}>
                      <span style={{ color:'#888' }}>{l}: </span>
                      <span style={{ fontWeight:600, color:'#c62828' }}>BHD {fmt(v)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Items table */}
            <div style={{ fontSize:12, fontWeight:700, color:'#333', marginBottom:6 }}>
              Product Lines ({items.length})
              <span style={{ fontSize:10, color:'#888', fontWeight:400, marginLeft:8 }}>
                Cost currency: {pc} @ {fmt(s.product_xrate,6)} BHD · Alloc: {ALLOC_METHODS.find(m=>m.value===s.allocation_method)?.label.split(' — ')[0]}
              </span>
            </div>
            <div style={{ overflowX:'auto', marginBottom:14 }}>
              <table className="data-table" style={{ fontSize:11, minWidth:950 }}>
                <thead>
                  <tr>
                    <th style={{ minWidth:170 }}>Product</th>
                    <th>SKU</th>
                    <th style={{ textAlign:'right' }}>Qty</th>
                    <th style={{ textAlign:'right' }}>Unit Cost ({pc})</th>
                    <th style={{ textAlign:'right' }}>Total ({pc})</th>
                    <th style={{ textAlign:'right' }}>Unit Cost (BHD)</th>
                    <th style={{ textAlign:'right', color:'#e65100' }}>+ Freight</th>
                    <th style={{ textAlign:'right', color:'#e65100' }}>+ Insurance</th>
                    <th style={{ textAlign:'right', color:'#c62828' }}>+ Local</th>
                    <th style={{ textAlign:'right', fontWeight:700, color:'#1565c0' }}>Unit Landed</th>
                    <th style={{ textAlign:'right', fontWeight:700, color:'#2e7d32' }}>Total Landed</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(item => {
                    const unitBhd = pf(item.unit_cost) * prodXr
                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight:600 }}>{item.product_name || '—'}</td>
                        <td style={{ color:'var(--blue)' }}>{item.sku || '—'}</td>
                        <td style={{ textAlign:'right' }}>{fmt(item.qty,0)}</td>
                        <td style={{ textAlign:'right' }}>{fmt(item.unit_cost,2)}</td>
                        <td style={{ textAlign:'right' }}>{fmtFC(pf(item.qty)*pf(item.unit_cost))}</td>
                        <td style={{ textAlign:'right', color:'#555' }}>BHD {fmtBhd(unitBhd)}</td>
                        <td style={{ textAlign:'right', color:'#e65100' }}>{s.status==='draft'?'—':fmtBhd(item.alloc_freight)}</td>
                        <td style={{ textAlign:'right', color:'#e65100' }}>{s.status==='draft'?'—':fmtBhd(item.alloc_insurance)}</td>
                        <td style={{ textAlign:'right', color:'#c62828' }}>{s.status==='draft'?'—':fmtBhd(pf(item.alloc_customs)+pf(item.alloc_local_other))}</td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'#1565c0' }}>
                          {s.status==='draft'
                            ? <span style={{ color:'#bbb', fontSize:10 }}>calc first</span>
                            : `BHD ${fmtBhd(item.unit_landed_cost)}`}
                        </td>
                        <td style={{ textAlign:'right', fontWeight:700, color:'#2e7d32' }}>
                          {s.status==='draft' ? '—' : `BHD ${fmtBhd(item.total_landed_cost)}`}
                        </td>
                        <td>
                          {s.status !== 'applied' && (
                            <button onClick={() => delItemMut.mutate(item.id)}
                              style={{ background:'none', border:'none', color:'#c62828', cursor:'pointer', fontSize:14, padding:'0 4px' }}>✕</button>
                          )}
                          {item.current_cost != null && s.status !== 'draft' && (
                            <div style={{ fontSize:9, color:'#aaa' }}>was {fmt(item.current_cost,3)}</div>
                          )}
                        </td>
                      </tr>
                    )
                  })}

                  {s.status !== 'applied' && (
                    <AddItemRow shipmentId={shipmentId} currency={pc}/>
                  )}

                  {items.length > 0 && s.status !== 'draft' && (
                    <tr style={{ background:'#e8f5e9', fontWeight:700 }}>
                      <td colSpan={5} style={{ padding:'5px 8px', textAlign:'right', color:'#555' }}>TOTALS</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'#555' }}>—</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'#e65100' }}>{fmtBhd(freightBhd)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'#e65100' }}>{fmtBhd(insuranceBhd)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'#c62828' }}>{fmtBhd(customsBhd+localOtherBhd)}</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'#1565c0' }}>—</td>
                      <td style={{ padding:'5px 8px', textAlign:'right', color:'#2e7d32' }}>BHD {fmtBhd(landedTotal)}</td>
                      <td/>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Actions */}
            {s.status !== 'applied' && (
              <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
                <button className="btn primary" onClick={() => calcMut.mutate()}
                  disabled={calcMut.isPending || !items.length}>
                  {calcMut.isPending ? '⏳ Calculating…' : '⚙ Calculate Landed Costs'}
                </button>

                {s.status === 'calculated' && !applyConfirm && (
                  <button className="btn" onClick={() => setApplyConfirm(true)}
                    style={{ background:'#2e7d32', color:'#fff', border:'none' }}>
                    ✓ Apply to Product Cost Prices
                  </button>
                )}

                {applyConfirm && (
                  <div style={{ display:'flex', gap:8, alignItems:'center', background:'#fff8e1', border:'1px solid #ffe082', borderRadius:3, padding:'6px 12px' }}>
                    <span style={{ fontSize:12, color:'#5d4037' }}>
                      ⚠ This will update cost_price for {items.filter(i=>i.product_id).length} products. Continue?
                    </span>
                    <button className="btn primary" onClick={() => applyMut.mutate()} disabled={applyMut.isPending}
                      style={{ background:'#2e7d32', border:'none' }}>
                      {applyMut.isPending ? 'Applying…' : 'Yes, Apply'}
                    </button>
                    <button className="btn" onClick={() => setApplyConfirm(false)}>Cancel</button>
                  </div>
                )}
              </div>
            )}

            {s.status === 'applied' && (
              <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:3, padding:'8px 14px', fontSize:12, color:'#2e7d32', fontWeight:600 }}>
                ✓ Applied — product cost prices updated with landed costs from this shipment.
              </div>
            )}

            {/* Payment tracking — always visible */}
            <PaymentPanel shipment={s} />
          </>
        )}
      </div>
    </div>
  )
}

// ── Main Module ───────────────────────────────────────────────
export default function ShipmentsModule() {
  const qc = useQueryClient()
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['shipments'],
    queryFn:  () => shipmentApi.list().then(r => r.data.data),
  })
  const shipments = data || []

  const createMut = useMutation({
    mutationFn: d => shipmentApi.create(d),
    onSuccess: r => {
      toast.success(`${r.data.data.shipment_no} created`)
      qc.invalidateQueries(['shipments'])
      setCreating(false)
      setSelected(r.data.data.id)
    },
  })

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Landed Costs — Import Shipments</div>
      <div style={{ display:'flex', flex:1, overflow:'hidden' }}>

        {/* Left list */}
        <div style={{ width:320, flexShrink:0, borderRight:'1px solid #d0d0d0', display:'flex', flexDirection:'column', overflow:'hidden', background:'#fafafa' }}>
          <div style={{ padding:'8px 10px', borderBottom:'1px solid #e0e0e0' }}>
            <button className="btn primary" style={{ width:'100%', fontSize:12 }}
              onClick={() => { setCreating(true); setSelected(null) }}>
              + New Shipment
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto' }}>
            {isLoading && <div style={{ padding:16, color:'#aaa', fontSize:12 }}>Loading…</div>}
            {!isLoading && !shipments.length && (
              <div style={{ padding:20, textAlign:'center', color:'#aaa', fontSize:12 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🚢</div>
                No shipments yet.
              </div>
            )}
            {shipments.map(s => {
              const st = STATUS_STYLE[s.status] || STATUS_STYLE.draft
              const active = selected === s.id
              return (
                <div key={s.id} onClick={() => { setSelected(s.id); setCreating(false) }}
                  style={{ padding:'9px 12px', borderBottom:'1px solid #eee', cursor:'pointer',
                    background: active ? 'var(--blue-light)' : '#fff',
                    borderLeft: `3px solid ${active ? 'var(--blue)' : 'transparent'}` }}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:2 }}>
                    <span style={{ fontWeight:700, fontSize:12, color:'var(--blue)' }}>{s.shipment_no}</span>
                    <span style={{ fontSize:10, padding:'1px 7px', borderRadius:8, background:st.bg, color:st.color, fontWeight:600 }}>{st.label}</span>
                  </div>
                  <div style={{ fontSize:11, color:'#555', marginBottom:2 }}>
                    {s.supplier || '—'}{s.origin_country ? ` · ${s.origin_country}` : ''}
                  </div>
                  <div style={{ fontSize:10, color:'#888', display:'flex', gap:10, flexWrap:'wrap' }}>
                    <span>{parseInt(s.item_count||0)} items</span>
                    {pf(s.total_landed) > 0 && <span style={{ color:'#2e7d32', fontWeight:600 }}>BHD {fmtBhd(s.total_landed)}</span>}
                    {pf(s.total_paid_bhd) > 0 && <span style={{ color:'#1565c0', fontWeight:600 }}>Paid: {fmtBhd(s.total_paid_bhd)}</span>}
                    {s.shipment_date && <span>{new Date(s.shipment_date).toLocaleDateString()}</span>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right detail/form */}
        <div style={{ flex:1, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          {creating && (
            <div style={{ flex:1, overflow:'auto', padding:16 }}>
              <div style={{ fontSize:13, fontWeight:700, marginBottom:12, color:'#333' }}>New Shipment</div>
              <ShipmentForm saving={createMut.isPending}
                onSave={d => createMut.mutate(d)} onCancel={() => setCreating(false)}/>
            </div>
          )}
          {selected && !creating && (
            <ShipmentDetail key={selected} shipmentId={selected} onClose={() => setSelected(null)}/>
          )}
          {!selected && !creating && (
            <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', color:'#aaa', gap:8 }}>
              <div style={{ fontSize:36 }}>🚢</div>
              <div style={{ fontSize:13 }}>Select a shipment or create a new one</div>
              <div style={{ fontSize:11, maxWidth:340, textAlign:'center', lineHeight:1.6, color:'#bbb' }}>
                Capture product cost (USD/CNY/etc.), prepaid or collect freight, insurance,
                and all BHD local charges — customs duty, VAT, clearing fee, APMT, demurrage,
                delivery order, local transport — then allocate to individual product lines
                to get the true landed unit cost in BHD.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
