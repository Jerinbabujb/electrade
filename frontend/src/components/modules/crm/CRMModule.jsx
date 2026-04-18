import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { crmApi } from '../../../services/api'
import CustomerTypeahead from '../shared/CustomerTypeahead'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const STAGES = [
  { id: 'lead',        label: 'Lead',        color: '#9e9e9e', bg: '#f5f5f5' },
  { id: 'contacted',   label: 'Contacted',   color: '#1976d2', bg: '#e3f2fd' },
  { id: 'quoted',      label: 'Quoted',      color: '#7b1fa2', bg: '#f3e5f5' },
  { id: 'negotiation', label: 'Negotiation', color: '#e65100', bg: '#fff3e0' },
  { id: 'won',         label: 'Won',         color: '#2e7d32', bg: '#e8f5e9' },
  { id: 'lost',        label: 'Lost',        color: '#c62828', bg: '#ffebee' },
]

const INTERACTION_ICONS = { call:'📞', email:'📧', meeting:'🤝', visit:'🚗', note:'📝', whatsapp:'💬' }

export default function CRMModule() {
  const [activeTab, setActiveTab] = useState('pipeline')
  const [showOppForm, setShowOppForm] = useState(false)
  const [editingOpp, setEditingOpp] = useState(null)
  const [filterStage, setFilterStage] = useState('')
  const qc = useQueryClient()

  const { data: oppsData, isLoading } = useQuery({
    queryKey: ['crm-opportunities', filterStage],
    queryFn: () => crmApi.listOpportunities(filterStage ? { stage: filterStage } : {}).then(r => r.data.data),
  })
  const opps = oppsData || []

  const { data: dashData } = useQuery({
    queryKey: ['crm-dashboard'],
    queryFn: () => crmApi.dashboard().then(r => r.data.data),
  })
  const dash = dashData || {}

  const deleteOppMut = useMutation({
    mutationFn: (id) => crmApi.deleteOpportunity(id),
    onSuccess: () => { toast.success('Opportunity removed'); qc.invalidateQueries(['crm-opportunities']); qc.invalidateQueries(['crm-dashboard']) },
  })

  const oppsByStage = (stageId) => opps.filter(o => o.stage === stageId)

  const pipelineValue = opps
    .filter(o => !['won','lost'].includes(o.stage))
    .reduce((s, o) => s + Number(o.value), 0)

  const weightedValue = opps
    .filter(o => !['won','lost'].includes(o.stage))
    .reduce((s, o) => s + Number(o.value) * o.probability / 100, 0)

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">CRM — Sales Pipeline</div>

      {/* Stats bar */}
      <div style={{ display:'flex', gap:8, padding:'0 10px 8px', flexShrink:0 }}>
        {[
          { label:'Pipeline Value',   val: fmtBhd(pipelineValue),              color:'#1976d2' },
          { label:'Weighted',         val: fmtBhd(weightedValue),              color:'#7b1fa2' },
          { label:'Won This Month',   val: fmtBhd(dash.won_month?.total_value||0), color:'#2e7d32' },
          { label:'Follow-ups Due',   val: dash.follow_ups_due||0,             color: (dash.follow_ups_due||0)>0?'#e65100':'#555' },
          { label:'Open Deals',       val: opps.filter(o=>!['won','lost'].includes(o.stage)).length, color:'#555' },
        ].map(s => (
          <div key={s.label} style={{ background:'#fff', border:'1px solid #e0e0e0', borderRadius:4, padding:'6px 14px', minWidth:130 }}>
            <div style={{ fontSize:10, color:'#888', textTransform:'uppercase', letterSpacing:.4 }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:700, color:s.color, marginTop:2 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="toolbar">
        <button className="btn primary" onClick={() => { setEditingOpp(null); setShowOppForm(true) }}>＋ New Opportunity</button>
        <div className="toolbar-sep"/>
        {['','lead','contacted','quoted','negotiation','won','lost'].map(s => (
          <button key={s} className={`btn${filterStage===s?' active':''}`}
            style={{ fontSize:11, padding:'3px 10px' }}
            onClick={()=>setFilterStage(s)}>
            {s ? STAGES.find(x=>x.id===s)?.label : 'All'}
          </button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #e0e0e0', padding:'0 10px', flexShrink:0 }}>
        {[['pipeline','Pipeline Board'],['list','List View'],['followups','Follow-ups']].map(([id,lbl])=>(
          <button key={id} onClick={()=>setActiveTab(id)} style={{
            background:'none', border:'none', borderBottom: activeTab===id?'2px solid var(--blue)':'2px solid transparent',
            color: activeTab===id?'var(--blue)':'#555', fontWeight: activeTab===id?700:400,
            padding:'6px 14px', cursor:'pointer', fontSize:12, marginBottom:-2,
          }}>{lbl}</button>
        ))}
      </div>

      <div style={{ flex:1, overflow:'auto', padding:10 }}>

        {/* Pipeline Board — Kanban */}
        {activeTab === 'pipeline' && (
          <div style={{ display:'flex', gap:10, height:'100%', alignItems:'flex-start' }}>
            {STAGES.map(stage => {
              const cards = oppsByStage(stage.id)
              const total = cards.reduce((s,o)=>s+Number(o.value),0)
              return (
                <div key={stage.id} style={{
                  minWidth:210, maxWidth:210, background:'#fafafa',
                  border:`1px solid ${stage.color}30`, borderTop:`3px solid ${stage.color}`,
                  borderRadius:4, display:'flex', flexDirection:'column', maxHeight:'calc(100vh - 280px)',
                }}>
                  <div style={{ padding:'7px 10px', background:stage.bg, borderBottom:`1px solid ${stage.color}20` }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <span style={{ fontSize:12, fontWeight:700, color:stage.color }}>{stage.label}</span>
                      <span style={{ fontSize:11, background:stage.color, color:'#fff', borderRadius:10, padding:'1px 7px' }}>{cards.length}</span>
                    </div>
                    {total > 0 && <div style={{ fontSize:11, color:'#666', marginTop:2 }}>BHD {fmtBhd(total)}</div>}
                  </div>
                  <div style={{ flex:1, overflowY:'auto', padding:6, display:'flex', flexDirection:'column', gap:6 }}>
                    {cards.map(opp => (
                      <OppCard key={opp.id} opp={opp} stage={stage}
                        onEdit={() => { setEditingOpp(opp); setShowOppForm(true) }}
                        onDelete={() => { if (confirm(`Delete "${opp.title}"?`)) deleteOppMut.mutate(opp.id) }}
                      />
                    ))}
                    {cards.length === 0 && (
                      <div style={{ textAlign:'center', padding:'16px 0', color:'#bbb', fontSize:11 }}>No deals</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* List View */}
        {activeTab === 'list' && (
          <table className="data-table" style={{ width:'100%' }}>
            <thead><tr>
              <th>Title</th><th>Customer</th><th>Stage</th>
              <th className="right">Value (BHD)</th><th>Prob %</th>
              <th>Expected Close</th><th>Assigned To</th><th style={{width:80}}></th>
            </tr></thead>
            <tbody>
              {isLoading && <tr className="empty-row"><td colSpan={8}>Loading...</td></tr>}
              {!isLoading && opps.length===0 && <tr className="empty-row"><td colSpan={8}>No opportunities</td></tr>}
              {opps.map(opp => {
                const stage = STAGES.find(s=>s.id===opp.stage)
                return (
                  <tr key={opp.id}>
                    <td style={{ fontWeight:600 }}>{opp.title}</td>
                    <td>{opp.customer_name}</td>
                    <td><span style={{ fontSize:11, padding:'2px 8px', borderRadius:10, background:stage?.bg, color:stage?.color, fontWeight:600 }}>{stage?.label}</span></td>
                    <td className="right">{fmtBhd(opp.value)}</td>
                    <td className="center">{opp.probability}%</td>
                    <td>{opp.expected_close ? fmtDate(opp.expected_close) : '—'}</td>
                    <td>{opp.assigned_to_name || '—'}</td>
                    <td>
                      <button className="btn" style={{fontSize:11,padding:'2px 8px'}} onClick={()=>{setEditingOpp(opp);setShowOppForm(true)}}>Edit</button>
                      {' '}
                      <button className="btn" style={{fontSize:11,padding:'2px 8px',color:'#c62828'}} onClick={()=>{if(confirm('Delete?'))deleteOppMut.mutate(opp.id)}}>✕</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}

        {/* Follow-ups */}
        {activeTab === 'followups' && (
          <FollowUpsPanel />
        )}
      </div>

      {showOppForm && (
        <OppFormModal
          opp={editingOpp}
          onClose={() => { setShowOppForm(false); setEditingOpp(null) }}
          onSaved={() => { qc.invalidateQueries(['crm-opportunities']); qc.invalidateQueries(['crm-dashboard']) }}
        />
      )}
    </div>
  )
}

// ── Opportunity Card ──────────────────────────────────────
function OppCard({ opp, stage, onEdit, onDelete }) {
  const isOverdue = opp.expected_close && new Date(opp.expected_close) < new Date() && !['won','lost'].includes(opp.stage)
  return (
    <div style={{
      background:'#fff', border:'1px solid #e0e0e0', borderRadius:4,
      padding:'8px 10px', cursor:'pointer', fontSize:12,
      boxShadow:'0 1px 3px rgba(0,0,0,.06)',
    }} onDoubleClick={onEdit}>
      <div style={{ fontWeight:600, marginBottom:4, lineHeight:1.3 }}>{opp.title}</div>
      <div style={{ color:'#555', marginBottom:3 }}>👥 {opp.customer_name}</div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:5 }}>
        <span style={{ fontWeight:700, color:'var(--blue)', fontSize:13 }}>BHD {fmtBhd(opp.value)}</span>
        <span style={{ fontSize:10, background:'#e8e8e8', borderRadius:3, padding:'1px 5px' }}>{opp.probability}%</span>
      </div>
      {opp.expected_close && (
        <div style={{ fontSize:10, marginTop:4, color: isOverdue?'#c62828':'#777' }}>
          {isOverdue ? '⚠ ' : '📅 '}{fmtDate(opp.expected_close)}
        </div>
      )}
      <div style={{ display:'flex', gap:4, marginTop:6, justifyContent:'flex-end' }}>
        <button className="btn" style={{ fontSize:10, padding:'2px 7px' }} onClick={e=>{e.stopPropagation();onEdit()}}>Edit</button>
        <button className="btn" style={{ fontSize:10, padding:'2px 7px', color:'#c62828' }} onClick={e=>{e.stopPropagation();onDelete()}}>✕</button>
      </div>
    </div>
  )
}

// ── Follow-ups Panel ──────────────────────────────────────
function FollowUpsPanel() {
  const qc = useQueryClient()
  const today = new Date().toISOString().split('T')[0]

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['crm-followups'],
    queryFn: async () => {
      // Fetch all interactions, then filter client-side for pending follow-ups
      const r = await crmApi.listInteractions(undefined)
      return r.data.data.filter(i => !i.follow_up_done && i.follow_up_date)
    },
  })
  const items = (data||[]).sort((a,b) => a.follow_up_date.localeCompare(b.follow_up_date))

  const doneMut = useMutation({
    mutationFn: (id) => crmApi.doneInteraction(id),
    onSuccess: () => { toast.success('Marked done'); refetch() },
  })

  if (isLoading) return <div style={{padding:20,color:'#888'}}>Loading...</div>
  if (items.length === 0) return (
    <div style={{ textAlign:'center', padding:'40px 0', color:'#4caf50' }}>
      <div style={{ fontSize:32 }}>✅</div>
      <div style={{ marginTop:8, fontSize:13 }}>No pending follow-ups — all clear!</div>
    </div>
  )

  return (
    <table className="data-table" style={{ width:'100%' }}>
      <thead><tr>
        <th>Follow-up Date</th><th>Type</th><th>Customer</th><th>Subject</th><th>Logged by</th><th style={{width:90}}></th>
      </tr></thead>
      <tbody>
        {items.map(i => {
          const overdue = i.follow_up_date < today
          return (
            <tr key={i.id} style={{ background: overdue ? '#fff8e1' : '#fff' }}>
              <td style={{ color: overdue?'#e65100':'inherit', fontWeight: overdue?700:400 }}>
                {overdue ? '⚠ ' : ''}{fmtDate(i.follow_up_date)}
              </td>
              <td>{INTERACTION_ICONS[i.type]} {i.type}</td>
              <td style={{ fontWeight:600 }}>{i.customer_name}</td>
              <td>{i.subject || '—'}</td>
              <td>{i.created_by_name || '—'}</td>
              <td>
                <button className="btn primary" style={{ fontSize:11, padding:'2px 10px' }}
                  onClick={() => doneMut.mutate(i.id)}>
                  ✓ Done
                </button>
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

// ── Opportunity Form Modal ────────────────────────────────
function OppFormModal({ opp, onClose, onSaved }) {
  const empty = { customer_id:'', customer_name:'', title:'', stage:'lead', value:0, probability:50, expected_close:'', description:'', assigned_to:'' }
  const [form, setForm] = useState(opp ? {
    customer_id:   opp.customer_id || '',
    customer_name: opp.customer_name || '',
    title:         opp.title || '',
    stage:         opp.stage || 'lead',
    value:         opp.value || 0,
    probability:   opp.probability || 50,
    expected_close: opp.expected_close ? opp.expected_close.split('T')[0] : '',
    description:   opp.description || '',
    lost_reason:   opp.lost_reason || '',
    assigned_to:   opp.assigned_to || '',
  } : empty)

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))


  const saveMut = useMutation({
    mutationFn: (d) => opp ? crmApi.updateOpportunity(opp.id, d) : crmApi.createOpportunity(d),
    onSuccess: () => { toast.success(opp ? 'Opportunity updated' : 'Opportunity created'); onSaved(); onClose() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <h3>{opp ? `Edit — ${opp.title}` : 'New Opportunity'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={()=>saveMut.mutate(form)} disabled={saveMut.isPending||!form.customer_id||!form.title}>
            💾 {saveMut.isPending ? 'Saving...' : 'Save'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-body" style={{ padding:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
            <div className="field" style={{ gridColumn:'span 2' }}>
              <label>Title *</label>
              <input value={form.title} onChange={e=>F('title',e.target.value)} placeholder="e.g. ABB Panel Supply — Building 12"/>
            </div>
            <div className="field" style={{ gridColumn:'span 2' }}>
              <label>Customer *</label>
              <CustomerTypeahead
                value={form.customer_id}
                displayName={form.customer_name || (opp?.customer_name)}
                onChange={c=>{ F('customer_id',c.id); F('customer_name',c.name) }}
                onClear={()=>{ F('customer_id',''); F('customer_name','') }}
                placeholder="Search customer..."
                allowCreate={false}
              />
            </div>
            <div className="field">
              <label>Stage</label>
              <select value={form.stage} onChange={e=>F('stage',e.target.value)}>
                {STAGES.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="field">
              <label>Probability (%)</label>
              <input type="number" min={0} max={100} value={form.probability} onChange={e=>F('probability',e.target.value)}/>
            </div>
            <div className="field">
              <label>Value (BHD)</label>
              <input type="number" step="0.001" min={0} value={form.value} onChange={e=>F('value',e.target.value)}/>
            </div>
            <div className="field">
              <label>Expected Close</label>
              <input type="date" value={form.expected_close} onChange={e=>F('expected_close',e.target.value)}/>
            </div>
            {form.stage === 'lost' && (
              <div className="field" style={{ gridColumn:'span 2' }}>
                <label>Lost Reason</label>
                <input value={form.lost_reason||''} onChange={e=>F('lost_reason',e.target.value)} placeholder="e.g. Price, Competitor, No budget"/>
              </div>
            )}
            <div className="field" style={{ gridColumn:'span 2' }}>
              <label>Description / Notes</label>
              <textarea value={form.description||''} onChange={e=>F('description',e.target.value)} rows={3}/>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
