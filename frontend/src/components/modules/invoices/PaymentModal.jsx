import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { invoiceApi } from '../../../services/api'
import { useUIStore } from '../../../store'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

export default function PaymentModal() {
  const { closeModal, getModal } = useUIStore()
  const modal   = getModal('payment')
  const invId   = modal.data?.invoiceId
  const qc      = useQueryClient()

  const { data: invData } = useQuery({
    queryKey: ['invoice-pay', invId],
    queryFn:  ()=>invoiceApi.get(invId).then(r=>r.data.data),
    enabled:  !!invId
  })
  const inv  = invData || {}
  const pays = inv.payments || []

  const [form, setForm] = useState({
    payment_date: new Date().toISOString().split('T')[0],
    amount: '',
    method: 'bank_transfer',
    reference_no: '',
    notes: ''
  })
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const saveMut = useMutation({
    mutationFn: ()=>invoiceApi.addPayment(invId, form),
    onSuccess: ()=>{
      toast.success('Payment recorded')
      qc.invalidateQueries(['invoices'])
      qc.invalidateQueries(['invoice-pay', invId])
      setForm(f=>({...f, amount:'', reference_no:'', notes:''}))
    }
  })

  const balance = parseFloat(inv.balance_due ?? inv.grand_total ?? 0)
  const isFullyPaid = balance <= 0

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&closeModal('payment')}>
      <div className="modal modal-sm">
        <div className="modal-header"><h3>💳 Record Payment — {inv.invoice_no}</h3><button className="close-btn" onClick={()=>closeModal('payment')}>✕</button></div>

        <div className="modal-body" style={{padding:12}}>
          {/* Invoice summary */}
          <div style={{background:'#f0f4fa',border:'1px solid #b0c8f0',borderRadius:3,padding:'8px 12px',marginBottom:12,fontSize:12}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:'#555'}}>Customer:</span>
              <span style={{fontWeight:600}}>{inv.customer_name}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:'#555'}}>Invoice Total:</span>
              <span style={{fontWeight:600}}>BHD {fmtBhd(inv.grand_total)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{color:'#555'}}>Paid So Far:</span>
              <span style={{fontWeight:600,color:'#2e7d32'}}>BHD {fmtBhd(parseFloat(inv.grand_total||0)-balance)}</span>
            </div>
            <div style={{display:'flex',justifyContent:'space-between',borderTop:'1px solid #b0c8f0',paddingTop:4,marginTop:4}}>
              <span style={{fontWeight:700,color:isFullyPaid?'#2e7d32':'#c62828'}}>Balance Due:</span>
              <span style={{fontWeight:700,fontSize:14,color:isFullyPaid?'#2e7d32':'#c62828'}}>BHD {fmtBhd(balance)}</span>
            </div>
          </div>

          {isFullyPaid ? (
            <div style={{background:'#e8f5e9',border:'1px solid #a5d6a7',borderRadius:3,padding:'10px 12px',textAlign:'center',color:'#2e7d32',fontWeight:600}}>
              ✓ This invoice is fully paid
            </div>
          ) : (
            <>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div className="field"><label>Payment Date *</label><input type="date" value={form.payment_date} onChange={e=>F('payment_date',e.target.value)}/></div>
                <div className="field"><label>Amount BHD *</label>
                  <input type="number" step="0.001" value={form.amount} onChange={e=>F('amount',e.target.value)} placeholder={fmtBhd(balance)}/>
                  <span style={{fontSize:10,color:'#888',marginTop:2}}>Balance due: BHD {fmtBhd(balance)}</span>
                </div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div className="field"><label>Payment Method</label>
                  <select value={form.method} onChange={e=>F('method',e.target.value)}>
                    <option value="bank_transfer">Bank Transfer</option>
                    <option value="cash">Cash</option>
                    <option value="cheque">Cheque</option>
                    <option value="card">Card</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div className="field"><label>Reference No.</label>
                  <input value={form.reference_no} onChange={e=>F('reference_no',e.target.value)} placeholder="Bank ref / cheque no."/>
                </div>
              </div>
              <div className="field" style={{marginBottom:10}}><label>Notes</label><input value={form.notes} onChange={e=>F('notes',e.target.value)}/></div>
              <button className="btn primary" style={{width:'100%',height:34,fontSize:13}}
                onClick={()=>saveMut.mutate()} disabled={saveMut.isPending||!form.amount}>
                {saveMut.isPending?'⏳ Recording...':'✓ Record Payment'}
              </button>
            </>
          )}

          {/* Payment history */}
          {pays.length>0&&(
            <div style={{marginTop:14}}>
              <div style={{fontSize:12,fontWeight:700,color:'#333',marginBottom:6,paddingBottom:4,borderBottom:'1px solid #eee'}}>Payment History</div>
              <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
                <thead><tr style={{background:'#e4e8ee'}}>
                  <th style={{padding:'4px 8px',textAlign:'left'}}>Date</th>
                  <th style={{padding:'4px 8px',textAlign:'left'}}>Method</th>
                  <th style={{padding:'4px 8px',textAlign:'right'}}>Amount BHD</th>
                  <th style={{padding:'4px 8px',textAlign:'left'}}>Ref</th>
                </tr></thead>
                <tbody>
                  {pays.map((p,i)=>(
                    <tr key={p.id} style={{borderBottom:'1px solid #f0f0f0',background:i%2?'#fafafa':'#fff'}}>
                      <td style={{padding:'3px 8px'}}>{fmtDate(p.payment_date)}</td>
                      <td style={{padding:'3px 8px'}}>{p.method}</td>
                      <td style={{padding:'3px 8px',textAlign:'right',fontWeight:600,color:'#2e7d32'}}>BHD {fmtBhd(p.amount)}</td>
                      <td style={{padding:'3px 8px',color:'#888'}}>{p.reference_no||'—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
