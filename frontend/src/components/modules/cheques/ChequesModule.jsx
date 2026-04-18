import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chequeApi } from '../../../services/api'
import CustomerTypeahead from '../shared/CustomerTypeahead'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const STATUS_COLORS = {
  pending:   { bg:'#fff8e1', color:'#f57c00', label:'Pending' },
  cleared:   { bg:'#e8f5e9', color:'#2e7d32', label:'Cleared' },
  bounced:   { bg:'#fdecea', color:'#c62828', label:'Bounced' },
  cancelled: { bg:'#f5f5f5', color:'#888',    label:'Cancelled' },
}

const empty = {
  direction:'issued', cheque_no:'', bank_name:'', party_id:'', party_name:'',
  amount:'', cheque_date:'', issue_date:new Date().toISOString().split('T')[0],
  purchase_id:'', invoice_id:'', notes:'',
}

export default function ChequesModule() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ direction:'', status:'pending', q:'' })
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(empty)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const { data, isLoading } = useQuery({
    queryKey: ['cheques', filters],
    queryFn:  () => chequeApi.list(filters).then(r => r.data.data)
  })
  const rows = data || []
  const sel  = rows.find(r => r.id === selectedId)


  const createMut = useMutation({
    mutationFn: () => chequeApi.create(form),
    onSuccess: () => { toast.success('Cheque recorded'); qc.invalidateQueries(['cheques']); qc.invalidateQueries(['fin-summary']); setShowForm(false); setForm(empty) }
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => chequeApi.setStatus(id, { status }),
    onSuccess: (_, vars) => { toast.success(`Cheque marked ${vars.status}`); qc.invalidateQueries(['cheques']); qc.invalidateQueries(['fin-summary']) }
  })

  const deleteMut = useMutation({
    mutationFn: (id) => chequeApi.delete(id),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries(['cheques']); setSelectedId(null) }
  })

  const totals = {
    total:   rows.reduce((s,r) => s + parseFloat(r.amount||0), 0),
    pending: rows.filter(r=>r.status==='pending').reduce((s,r) => s + parseFloat(r.amount||0), 0),
  }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Cheque Register</div>

      <div className="toolbar">
        <button className="btn primary" onClick={()=>{ setForm({...empty,direction:'issued'}); setShowForm(true) }}>＋ Issued Cheque</button>
        <button className="btn" style={{background:'#e8f5e9',borderColor:'#a5d6a7',color:'#2e7d32'}} onClick={()=>{ setForm({...empty,direction:'received'}); setShowForm(true) }}>＋ Received Cheque</button>
        <div className="toolbar-sep"/>
        <button className="btn" style={{background:'#e8f5e9',borderColor:'#a5d6a7',color:'#2e7d32'}}
          disabled={!selectedId || sel?.status!=='pending'}
          onClick={()=>selectedId && statusMut.mutate({id:selectedId, status:'cleared'})}>✓ Mark Cleared</button>
        <button className="btn danger"
          disabled={!selectedId || sel?.status!=='pending'}
          onClick={()=>selectedId && statusMut.mutate({id:selectedId, status:'bounced'})}>✕ Mark Bounced</button>
        <button className="btn"
          disabled={!selectedId || sel?.status!=='pending'}
          onClick={()=>selectedId && statusMut.mutate({id:selectedId, status:'cancelled'})}>Cancel Cheque</button>
        <div className="toolbar-sep"/>
        <select className="btn" style={{height:26}} value={filters.direction} onChange={e=>setFilters(f=>({...f,direction:e.target.value}))}>
          <option value="">All Directions</option>
          <option value="issued">Issued (outgoing)</option>
          <option value="received">Received (incoming)</option>
        </select>
        <select className="btn" style={{height:26}} value={filters.status} onChange={e=>setFilters(f=>({...f,status:e.target.value}))}>
          <option value="">All Status</option>
          <option value="pending">Pending</option>
          <option value="cleared">Cleared</option>
          <option value="bounced">Bounced</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="toolbar-search">
          <input placeholder="Search cheque no, party..." value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value}))}/>
          <button className="btn">🔍</button>
        </div>
      </div>

      {sel && (
        <div style={{background:'var(--blue-light)',borderBottom:'1px solid #b0c8f0',padding:'5px 12px',fontSize:12,color:'#1a3a6c',flexShrink:0}}>
          Selected: <strong>{sel.cheque_no}</strong> — {sel.party_name} — BHD {fmtBhd(sel.amount)} — Due {fmtDate(sel.cheque_date)}
        </div>
      )}

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th style={{width:28}}></th>
            <th>Direction</th><th>Cheque No.</th><th>Bank</th>
            <th>Party</th><th>Issue Date</th><th>Cheque Date</th>
            <th className="right">Amount BHD</th><th>Status</th><th>Notes</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={10}>Loading...</td></tr>}
            {!isLoading && !rows.length && <tr className="empty-row"><td colSpan={10}>No cheques found</td></tr>}
            {rows.map(r => {
              const sc = STATUS_COLORS[r.status] || STATUS_COLORS.pending
              const isOverdue = r.status==='pending' && new Date(r.cheque_date) <= new Date()
              return (
                <tr key={r.id} className={selectedId===r.id?'selected':''} onClick={()=>setSelectedId(r.id)}
                  style={isOverdue ? {background:'#fff8e1'} : {}}>
                  <td><input type="checkbox" checked={selectedId===r.id} onChange={()=>setSelectedId(r.id)}/></td>
                  <td>
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,fontWeight:600,
                      background: r.direction==='issued'?'#fdecea':'#e8f5e9',
                      color:      r.direction==='issued'?'#c62828':'#2e7d32'}}>
                      {r.direction==='issued' ? '↑ Issued' : '↓ Received'}
                    </span>
                  </td>
                  <td style={{fontWeight:600,color:'var(--blue)'}}>{r.cheque_no}</td>
                  <td style={{color:'#555'}}>{r.bank_name||'—'}</td>
                  <td style={{fontWeight:500}}>{r.party_name||r.party_name_from_db||'—'}</td>
                  <td>{fmtDate(r.issue_date)}</td>
                  <td style={{color: isOverdue?'#c62828':'inherit', fontWeight: isOverdue?700:'normal'}}>
                    {fmtDate(r.cheque_date)}{isOverdue?' ⚠':''}
                  </td>
                  <td className="right" style={{fontWeight:700}}>{fmtBhd(r.amount)}</td>
                  <td><span style={{fontSize:11,padding:'2px 7px',borderRadius:10,background:sc.bg,color:sc.color,fontWeight:600}}>{sc.label}</span></td>
                  <td style={{fontSize:11,color:'#888',maxWidth:150,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.notes||'—'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="status-bar">
        <span>{rows.length} cheques</span><span>|</span>
        <span>Total: <strong>BHD {fmtBhd(totals.total)}</strong></span><span>|</span>
        <span>Pending: <strong style={{color:'#f57c00'}}>BHD {fmtBhd(totals.pending)}</strong></span>
      </div>

      {showForm && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal" style={{maxWidth:600}}>
            <div className="modal-header">
              <h3>{form.direction==='issued' ? '↑ New Issued Cheque' : '↓ New Received Cheque'}</h3>
              <button className="close-btn" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <div className="modal-toolbar">
              <button className="btn primary" onClick={()=>createMut.mutate()} disabled={createMut.isPending||!form.cheque_no||!form.amount||!form.cheque_date}>
                {createMut.isPending?'⏳ Saving...':'💾 Save'}
              </button>
              <div style={{marginLeft:8,fontSize:11,color:'#888'}}>
                {form.direction==='issued'?'Money going OUT — post-dated cheque to supplier':'Money coming IN — cheque from customer'}
              </div>
              <button className="btn" style={{marginLeft:'auto'}} onClick={()=>setShowForm(false)}>✕ Cancel</button>
            </div>
            <div className="modal-body" style={{padding:14}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div className="field">
                  <label>Direction</label>
                  <select value={form.direction} onChange={e=>F('direction',e.target.value)}>
                    <option value="issued">Issued (outgoing to supplier)</option>
                    <option value="received">Received (from customer)</option>
                  </select>
                </div>
                <div className="field"><label>Cheque No. *</label><input value={form.cheque_no} onChange={e=>F('cheque_no',e.target.value)} placeholder="e.g. 000123" autoFocus/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div className="field"><label>Bank Name</label><input value={form.bank_name} onChange={e=>F('bank_name',e.target.value)} placeholder="e.g. BBK, Ahli United"/></div>
                <div className="field"><label>Amount BHD *</label><input type="number" step="0.001" min="0" value={form.amount} onChange={e=>F('amount',e.target.value)}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div className="field"><label>Issue Date</label><input type="date" value={form.issue_date} onChange={e=>F('issue_date',e.target.value)}/></div>
                <div className="field"><label>Cheque Date (post-date) *</label><input type="date" value={form.cheque_date} onChange={e=>F('cheque_date',e.target.value)}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
                <div className="field">
                  <label>Party (Supplier / Customer)</label>
                  <CustomerTypeahead
                    value={form.party_id}
                    displayName={form.party_name}
                    onChange={c=>{ F('party_id',c.id); F('party_name',c.name) }}
                    onClear={()=>{ F('party_id',''); F('party_name','') }}
                    filterType=""
                    allowCreate={false}
                    placeholder="Search any customer or supplier..."
                  />
                </div>
                <div className="field"><label>Party Name (free text)</label><input value={form.party_name} onChange={e=>F('party_name',e.target.value)} placeholder="Override or enter manually"/></div>
              </div>
              <div className="field"><label>Notes / Reference (Purchase No., Invoice No., etc.)</label>
                <input value={form.notes} onChange={e=>F('notes',e.target.value)} placeholder="e.g. PUR-2026-0012, for March materials"/>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
