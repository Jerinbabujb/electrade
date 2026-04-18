import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrApi } from '../../../services/api'
import { fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const STATUS_STYLE = {
  active:     { bg:'#e8f5e9', color:'#2e7d32', label:'Active' },
  on_leave:   { bg:'#fff8e1', color:'#f57c00', label:'On Leave' },
  terminated: { bg:'#fdecea', color:'#c62828', label:'Terminated' },
}

const emptyEmp = {
  emp_no:'', full_name:'', nationality:'', id_number:'', position:'', department:'',
  join_date:'', status:'active',
  basic_salary:'', housing_allow:'', transport_allow:'', other_allow:'',
  gosi_eligible:true, is_bahraini:false, employer_covers_gosi:false,
  annual_leave_days:30, bank_name:'', bank_iban:'', notes:'',
}

const LEAVE_TYPE_LABELS = {
  annual:'Annual Leave', sick:'Sick Leave', unpaid:'Unpaid Leave',
  emergency:'Emergency', maternity:'Maternity', paternity:'Paternity', other:'Other'
}

const emptyLeave = {
  leave_type:'annual', start_date:'', end_date:'', days_requested:'', notes:''
}

function fmtBhd(v) {
  const n = parseFloat(v || 0)
  return isNaN(n) ? '0.000' : n.toFixed(3)
}

function gosiRates(f) {
  if (!f.gosi_eligible) return { emp: 0, er: 0, label: 'Not eligible' }
  if (f.is_bahraini) return { emp: 0.07, er: 0.12, label: 'Bahraini: 7% emp / 12% er' }
  const empRate = f.employer_covers_gosi ? 0 : 0.01
  return { emp: empRate, er: 0.03, label: `Expat: ${f.employer_covers_gosi ? '0% (employer covered)' : '1%'} emp / 3% er` }
}

function eosbRate(f) {
  if (!f.gosi_eligible || f.is_bahraini || !f.join_date) return { rate: 0, label: '' }
  const years = (Date.now() - new Date(f.join_date)) / (1000 * 60 * 60 * 24 * 365.25)
  const rate  = years > 3 ? 8.4 : 4.2
  return { rate, label: `${rate}% EOSB (${years > 3 ? '>3 yrs service' : '≤3 yrs service'})` }
}

export default function EmployeesTab() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ status:'active', q:'' })
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState(emptyEmp)
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data, isLoading } = useQuery({
    queryKey: ['employees', filters],
    queryFn:  () => hrApi.listEmployees(filters).then(r => r.data.data),
  })
  const rows = data || []
  const sel  = rows.find(r => r.id === selectedId)

  const gross = (f) => {
    const b = parseFloat(f.basic_salary)||0
    const h = parseFloat(f.housing_allow)||0
    const t = parseFloat(f.transport_allow)||0
    const o = parseFloat(f.other_allow)||0
    return b + h + t + o
  }

  const [showLeave,  setShowLeave]  = useState(false)
  const [leaveForm,  setLeaveForm]  = useState(emptyLeave)
  const [showResume, setShowResume] = useState(null) // leaveId
  const [resumeForm, setResumeForm] = useState({ resume_date:'', days_taken:'', notes:'' })
  const LF = (k,v) => setLeaveForm(f => ({ ...f, [k]:v }))

  // Fetch leaves + balance for selected employee
  const { data: empLeaves } = useQuery({
    queryKey: ['emp-leaves', selectedId],
    queryFn:  () => hrApi.empLeaves(selectedId).then(r => r.data.data),
    enabled:  !!selectedId,
  })
  const { data: leaveBalance } = useQuery({
    queryKey: ['leave-balance', selectedId],
    queryFn:  () => hrApi.leaveBalance(selectedId).then(r => r.data.data),
    enabled:  !!selectedId,
  })

  const startLeaveMut = useMutation({
    mutationFn: () => hrApi.startLeave(selectedId, leaveForm),
    onSuccess: () => {
      toast.success('Leave recorded — employee marked On Leave')
      qc.invalidateQueries(['employees'])
      qc.invalidateQueries(['emp-leaves', selectedId])
      qc.invalidateQueries(['leave-balance', selectedId])
      setShowLeave(false)
      setLeaveForm(emptyLeave)
    },
  })

  const resumeMut = useMutation({
    mutationFn: () => hrApi.resumeLeave(showResume, resumeForm),
    onSuccess: () => {
      toast.success('Employee resumed duty — status set to Active')
      qc.invalidateQueries(['employees'])
      qc.invalidateQueries(['emp-leaves', selectedId])
      qc.invalidateQueries(['leave-balance', selectedId])
      setShowResume(null)
    },
  })

  const cancelLeaveMut = useMutation({
    mutationFn: (id) => hrApi.cancelLeave(id),
    onSuccess: () => {
      toast.success('Leave cancelled')
      qc.invalidateQueries(['employees'])
      qc.invalidateQueries(['emp-leaves', selectedId])
      qc.invalidateQueries(['leave-balance', selectedId])
    },
  })

  const createMut = useMutation({
    mutationFn: () => hrApi.createEmployee(form),
    onSuccess: () => { toast.success('Employee added'); qc.invalidateQueries(['employees']); setShowForm(false); setForm(emptyEmp) },
  })

  const updateMut = useMutation({
    mutationFn: () => hrApi.updateEmployee(form.id, form),
    onSuccess: () => { toast.success('Employee updated'); qc.invalidateQueries(['employees']); setShowForm(false); setForm(emptyEmp) },
  })

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => hrApi.setEmpStatus(id, status),
    onSuccess: (_, v) => { toast.success(`Employee marked ${v.status}`); qc.invalidateQueries(['employees']) },
  })

  function openEdit(emp) {
    setForm({ ...emp,
      basic_salary:    emp.basic_salary    || '',
      housing_allow:   emp.housing_allow   || '',
      transport_allow: emp.transport_allow || '',
      other_allow:     emp.other_allow     || '',
    })
    setEditMode(true)
    setShowForm(true)
  }

  function openNew() {
    setForm(emptyEmp)
    setEditMode(false)
    setShowForm(true)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="toolbar">
        <button className="btn primary" onClick={openNew}>+ Add Employee</button>
        <button className="btn" disabled={!sel} onClick={() => sel && openEdit(sel)}>Edit</button>
        <button className="btn"
          disabled={!sel || sel.status !== 'active'}
          onClick={() => { setLeaveForm({ ...emptyLeave, start_date: new Date().toISOString().split('T')[0] }); setShowLeave(true) }}>
          Mark On Leave
        </button>
        {sel?.status === 'on_leave' && !(empLeaves||[]).some(l => l.status==='active') && (
          <button className="btn" style={{ background:'#e8f5e9', borderColor:'#a5d6a7', color:'#2e7d32' }}
            onClick={() => statusMut.mutate({ id:sel.id, status:'active' })}>
            Set Active (no leave record)
          </button>
        )}
        <button className="btn danger"
          disabled={!sel || sel.status === 'terminated'}
          onClick={() => sel && window.confirm('Terminate this employee?') && statusMut.mutate({ id:sel.id, status:'terminated' })}>
          Terminate
        </button>
        <div className="toolbar-sep" />
        <select className="btn" style={{ height:26 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status:e.target.value }))}>
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="on_leave">On Leave</option>
          <option value="terminated">Terminated</option>
        </select>
        <div className="toolbar-search">
          <input placeholder="Search name, position..." value={filters.q} onChange={e => setFilters(f => ({ ...f, q:e.target.value }))} />
          <button className="btn">🔍</button>
        </div>
      </div>

      {sel && (
        <div style={{ background:'var(--blue-light)', borderBottom:'1px solid #b0c8f0', padding:'5px 12px', fontSize:12, color:'#1a3a6c', flexShrink:0 }}>
          Selected: <strong>{sel.full_name}</strong> — {sel.position||'—'} — Basic: BHD {fmtBhd(sel.basic_salary)} — Gross: BHD {fmtBhd(parseFloat(sel.basic_salary||0)+parseFloat(sel.housing_allow||0)+parseFloat(sel.transport_allow||0)+parseFloat(sel.other_allow||0))}
        </div>
      )}

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th style={{ width:28 }}></th>
            <th>Emp No.</th><th>Name</th><th>Position</th><th>Department</th>
            <th>Nationality</th><th>Join Date</th>
            <th className="right">Basic BHD</th><th className="right">Gross BHD</th>
            <th>GOSI</th><th>Status</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={11}>Loading...</td></tr>}
            {!isLoading && !rows.length && <tr className="empty-row"><td colSpan={11}>No employees found</td></tr>}
            {rows.map(r => {
              const totalGross = parseFloat(r.basic_salary||0)+parseFloat(r.housing_allow||0)+parseFloat(r.transport_allow||0)+parseFloat(r.other_allow||0)
              const ss = STATUS_STYLE[r.status] || STATUS_STYLE.active
              return (
                <tr key={r.id} className={selectedId===r.id ? 'selected' : ''} onClick={() => setSelectedId(r.id)}>
                  <td><input type="checkbox" checked={selectedId===r.id} onChange={() => setSelectedId(r.id)} /></td>
                  <td style={{ fontWeight:600, color:'var(--blue)' }}>{r.emp_no}</td>
                  <td style={{ fontWeight:600 }}>{r.full_name}</td>
                  <td>{r.position||'—'}</td>
                  <td>{r.department||'—'}</td>
                  <td>{r.nationality||'—'}</td>
                  <td>{r.join_date ? fmtDate(r.join_date) : '—'}</td>
                  <td className="right">{fmtBhd(r.basic_salary)}</td>
                  <td className="right" style={{ fontWeight:700 }}>{fmtBhd(totalGross)}</td>
                  <td style={{ fontSize:11 }}>{r.gosi_eligible ? <span style={{ color:'#2e7d32' }}>Yes</span> : <span style={{ color:'#888' }}>No</span>}</td>
                  <td><span style={{ fontSize:11, padding:'2px 7px', borderRadius:10, background:ss.bg, color:ss.color, fontWeight:600 }}>{ss.label}</span></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="status-bar">
        <span>{rows.length} employees</span><span>|</span>
        <span>Total Gross: <strong>BHD {fmtBhd(rows.reduce((s,r) => s + parseFloat(r.basic_salary||0)+parseFloat(r.housing_allow||0)+parseFloat(r.transport_allow||0)+parseFloat(r.other_allow||0), 0))}</strong></span>
      </div>

      {/* Leave history panel — shown when employee selected */}
      {selectedId && sel && (
        <div style={{ borderTop:'2px solid #e8e8e8', background:'#fafafa', flexShrink:0, maxHeight:220, overflow:'auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, padding:'6px 12px', borderBottom:'1px solid #e0e0e0', background:'#f0f0f0' }}>
            <span style={{ fontWeight:600, fontSize:12 }}>Leave — {sel.full_name}</span>
            {/* Annual leave balance pill */}
            {leaveBalance && (
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:'var(--blue-light)', color:'var(--blue)', border:'1px solid #b0c8f0' }}>
                Annual leave: <strong>{leaveBalance.taken}</strong> taken &nbsp;|&nbsp;
                <strong style={{ color: leaveBalance.remaining < 5 ? '#c62828':'#2e7d32' }}>{leaveBalance.remaining}</strong> remaining of {leaveBalance.entitlement} days
              </span>
            )}
            <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
              {sel.status === 'active' && (
                <button className="btn" style={{ fontSize:11, padding:'2px 10px', background:'#fff8e1', borderColor:'#ffe082', color:'#f57c00' }}
                  onClick={() => { setLeaveForm({ ...emptyLeave, start_date: new Date().toISOString().split('T')[0] }); setShowLeave(true) }}>
                  + Mark on Leave
                </button>
              )}
              {sel.status === 'on_leave' && !(empLeaves||[]).some(l => l.status==='active') && (
                <button className="btn" style={{ fontSize:11, padding:'2px 10px', background:'#e8f5e9', borderColor:'#a5d6a7', color:'#2e7d32' }}
                  onClick={() => statusMut.mutate({ id:sel.id, status:'active' })}>
                  Set Active (no leave record)
                </button>
              )}
              {sel.status === 'on_leave' && (empLeaves||[]).some(l => l.status==='active') && (
                <button className="btn" style={{ fontSize:11, padding:'2px 10px', background:'#e8f5e9', borderColor:'#a5d6a7', color:'#2e7d32' }}
                  onClick={() => {
                    const active = (empLeaves||[]).find(l => l.status==='active')
                    if (active) { setShowResume(active.id); setResumeForm({ resume_date: new Date().toISOString().split('T')[0], days_taken:'', notes:'' }) }
                  }}>
                  Resume Duty
                </button>
              )}
            </div>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
            <thead><tr style={{ background:'#f5f5f5' }}>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>Type</th>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>Start</th>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>End / Expected</th>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>Resume Date</th>
              <th style={{ padding:'4px 10px', textAlign:'right' }}>Req. Days</th>
              <th style={{ padding:'4px 10px', textAlign:'right' }}>Taken</th>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>Status</th>
              <th style={{ padding:'4px 10px', textAlign:'left' }}>Notes</th>
              <th style={{ padding:'4px 10px' }}></th>
            </tr></thead>
            <tbody>
              {!(empLeaves||[]).length && <tr><td colSpan={9} style={{ padding:'8px 10px', color:'#aaa' }}>No leave records</td></tr>}
              {(empLeaves||[]).map(l => {
                const isActive = l.status === 'active'
                const typeLabel = LEAVE_TYPE_LABELS[l.leave_type] || l.leave_type
                const statusStyle = isActive
                  ? { bg:'#fff8e1', color:'#f57c00', label:'On Leave' }
                  : l.status === 'resumed'
                  ? { bg:'#e8f5e9', color:'#2e7d32', label:'Resumed' }
                  : { bg:'#f5f5f5', color:'#888', label:'Cancelled' }
                return (
                  <tr key={l.id} style={{ borderBottom:'1px solid #f0f0f0' }}>
                    <td style={{ padding:'4px 10px', fontWeight:600 }}>{typeLabel}</td>
                    <td style={{ padding:'4px 10px' }}>{fmtDate(l.start_date)}</td>
                    <td style={{ padding:'4px 10px', color: isActive?'#f57c00':'#555' }}>{l.end_date ? fmtDate(l.end_date) : '—'}</td>
                    <td style={{ padding:'4px 10px', color:'#2e7d32' }}>{l.resume_date ? fmtDate(l.resume_date) : '—'}</td>
                    <td style={{ padding:'4px 10px', textAlign:'right' }}>{l.days_requested}</td>
                    <td style={{ padding:'4px 10px', textAlign:'right', fontWeight: l.days_taken?600:'normal' }}>{l.days_taken ?? '—'}</td>
                    <td style={{ padding:'4px 10px' }}>
                      <span style={{ padding:'1px 6px', borderRadius:8, fontSize:10, fontWeight:600, background:statusStyle.bg, color:statusStyle.color }}>{statusStyle.label}</span>
                    </td>
                    <td style={{ padding:'4px 10px', color:'#888', maxWidth:180, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l.notes||'—'}</td>
                    <td style={{ padding:'4px 10px', whiteSpace:'nowrap' }}>
                      {isActive && <>
                        <button className="btn" style={{ fontSize:10, padding:'1px 7px', background:'#e8f5e9', borderColor:'#a5d6a7', color:'#2e7d32' }}
                          onClick={() => { setShowResume(l.id); setResumeForm({ resume_date: new Date().toISOString().split('T')[0], days_taken:'', notes:'' }) }}>
                          Resume
                        </button>
                        <button className="btn" style={{ fontSize:10, padding:'1px 7px', marginLeft:4 }}
                          onClick={() => window.confirm('Cancel this leave?') && cancelLeaveMut.mutate(l.id)}>
                          Cancel
                        </button>
                      </>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="modal" style={{ maxWidth:680 }}>
            <div className="modal-header">
              <h3>{editMode ? 'Edit Employee' : 'New Employee'}</h3>
              <button className="close-btn" onClick={() => setShowForm(false)}>✕</button>
            </div>
            <div className="modal-toolbar">
              <button className="btn primary"
                onClick={() => editMode ? updateMut.mutate() : createMut.mutate()}
                disabled={createMut.isPending || updateMut.isPending || !form.emp_no || !form.full_name || !form.basic_salary}>
                {(createMut.isPending || updateMut.isPending) ? '⏳ Saving...' : '💾 Save'}
              </button>
              <button className="btn" style={{ marginLeft:'auto' }} onClick={() => setShowForm(false)}>✕ Cancel</button>
            </div>
            <div className="modal-body" style={{ padding:14 }}>

              {/* Personal */}
              <div style={{ fontWeight:600, fontSize:11, color:'var(--blue)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Personal Info</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                <div className="field"><label>Emp No. *</label><input value={form.emp_no} onChange={e => F('emp_no', e.target.value)} placeholder="EMP-001" /></div>
                <div className="field"><label>Full Name *</label><input value={form.full_name} onChange={e => F('full_name', e.target.value)} /></div>
                <div className="field"><label>Nationality</label><input value={form.nationality} onChange={e => F('nationality', e.target.value)} placeholder="Bahraini / Indian / ..." /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                <div className="field"><label>CPR / ID No.</label><input value={form.id_number} onChange={e => F('id_number', e.target.value)} /></div>
                <div className="field"><label>Position</label><input value={form.position} onChange={e => F('position', e.target.value)} /></div>
                <div className="field"><label>Department</label><input value={form.department} onChange={e => F('department', e.target.value)} /></div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:14 }}>
                <div className="field"><label>Join Date</label><input type="date" value={form.join_date} onChange={e => F('join_date', e.target.value)} /></div>
                <div className="field"><label>Status</label>
                  <select value={form.status} onChange={e => F('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="on_leave">On Leave</option>
                    <option value="terminated">Terminated</option>
                  </select>
                </div>
                <div className="field"><label>Bahraini National</label>
                  <select value={form.is_bahraini ? 'true' : 'false'} onChange={e => F('is_bahraini', e.target.value === 'true')}>
                    <option value="false">No (Expatriate)</option>
                    <option value="true">Yes (Bahraini)</option>
                  </select>
                </div>
                <div className="field"><label>GOSI Eligible</label>
                  <select value={form.gosi_eligible ? 'true' : 'false'} onChange={e => F('gosi_eligible', e.target.value === 'true')}>
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
                {!form.is_bahraini && form.gosi_eligible && (
                  <div className="field">
                    <label>Employer covers 1% (expat)</label>
                    <select value={form.employer_covers_gosi ? 'true' : 'false'} onChange={e => F('employer_covers_gosi', e.target.value === 'true')}>
                      <option value="false">No — deduct from employee</option>
                      <option value="true">Yes — employer absorbs</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Salary */}
              <div style={{ fontWeight:600, fontSize:11, color:'var(--blue)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Monthly Salary (BHD)</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8, marginBottom:6 }}>
                <div className="field"><label>Basic Salary *</label><input type="number" step="0.001" min="0" value={form.basic_salary} onChange={e => F('basic_salary', e.target.value)} /></div>
                <div className="field"><label>Housing Allow.</label><input type="number" step="0.001" min="0" value={form.housing_allow} onChange={e => F('housing_allow', e.target.value)} /></div>
                <div className="field"><label>Transport Allow.</label><input type="number" step="0.001" min="0" value={form.transport_allow} onChange={e => F('transport_allow', e.target.value)} /></div>
                <div className="field"><label>Other Allow.</label><input type="number" step="0.001" min="0" value={form.other_allow} onChange={e => F('other_allow', e.target.value)} /></div>
              </div>
              {(() => {
                const rates  = gosiRates(form)
                const eosb   = eosbRate(form)
                const basic  = parseFloat(form.basic_salary||0)
                const g      = gross(form)
                const gosiEmpAmt = basic * rates.emp
                const gosiErAmt  = basic * rates.er
                const eosbAmt    = basic * eosb.rate / 100
                const totalErCost = gosiErAmt + eosbAmt + (form.employer_covers_gosi ? basic * 0.01 : 0)
                return (
                  <div style={{ background:'#f0f9f6', border:'1px solid #b2dfdb', borderRadius:3, padding:'8px 10px', fontSize:12, marginBottom:12 }}>
                    <div style={{ display:'flex', gap:20, flexWrap:'wrap' }}>
                      <span>Gross: <strong>BHD {fmtBhd(g)}</strong></span>
                      {form.gosi_eligible && <>
                        <span>Emp GOSI deduction: <strong style={{ color:'#c62828' }}>BHD {fmtBhd(gosiEmpAmt)}</strong></span>
                        <span>Net pay: <strong style={{ color:'#2e7d32' }}>BHD {fmtBhd(g - gosiEmpAmt)}</strong></span>
                      </>}
                    </div>
                    {form.gosi_eligible && (
                      <div style={{ marginTop:4, color:'#e65100' }}>
                        Employer monthly cost — GOSI: BHD {fmtBhd(gosiErAmt)}
                        {!form.is_bahraini && form.employer_covers_gosi && <> + covers emp 1%: BHD {fmtBhd(basic*0.01)}</>}
                        {eosb.rate > 0 && <> + EOSB ({eosb.label}): BHD {fmtBhd(eosbAmt)}</>}
                        {' '}= <strong>BHD {fmtBhd(totalErCost)}</strong>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Leave entitlement */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 3fr', gap:8, marginBottom:12 }}>
                <div className="field">
                  <label>Annual Leave (days/yr)</label>
                  <input type="number" min="0" max="90" value={form.annual_leave_days} onChange={e => F('annual_leave_days', e.target.value)} />
                </div>
              </div>

              {/* Bank */}
              <div style={{ fontWeight:600, fontSize:11, color:'var(--blue)', marginBottom:6, textTransform:'uppercase', letterSpacing:'.5px' }}>Bank Details</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                <div className="field"><label>Bank Name</label><input value={form.bank_name} onChange={e => F('bank_name', e.target.value)} /></div>
                <div className="field"><label>IBAN</label><input value={form.bank_iban} onChange={e => F('bank_iban', e.target.value)} placeholder="BH..." /></div>
              </div>

              <div className="field"><label>Notes</label><input value={form.notes} onChange={e => F('notes', e.target.value)} /></div>
            </div>
          </div>
        </div>
      )}
      {/* Start Leave modal */}
      {showLeave && sel && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowLeave(false)}>
          <div className="modal" style={{ maxWidth:460 }}>
            <div className="modal-header">
              <h3>Mark on Leave — {sel.full_name}</h3>
              <button className="close-btn" onClick={() => setShowLeave(false)}>✕</button>
            </div>
            <div className="modal-toolbar">
              <button className="btn primary"
                onClick={() => startLeaveMut.mutate()}
                disabled={startLeaveMut.isPending || !leaveForm.start_date || !leaveForm.days_requested}>
                {startLeaveMut.isPending ? '⏳ Saving...' : 'Confirm Leave'}
              </button>
              <button className="btn" style={{ marginLeft:'auto' }} onClick={() => setShowLeave(false)}>Cancel</button>
            </div>
            <div className="modal-body" style={{ padding:14 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div className="field">
                  <label>Leave Type</label>
                  <select value={leaveForm.leave_type} onChange={e => LF('leave_type', e.target.value)}>
                    {Object.entries(LEAVE_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Days Requested</label>
                  <input type="number" step="0.5" min="0.5" value={leaveForm.days_requested} onChange={e => LF('days_requested', e.target.value)} />
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div className="field">
                  <label>Start Date *</label>
                  <input type="date" value={leaveForm.start_date} onChange={e => LF('start_date', e.target.value)} />
                </div>
                <div className="field">
                  <label>Expected Return Date</label>
                  <input type="date" value={leaveForm.end_date} onChange={e => LF('end_date', e.target.value)} />
                </div>
              </div>
              <div className="field"><label>Notes</label><input value={leaveForm.notes} onChange={e => LF('notes', e.target.value)} placeholder="e.g. Annual leave — family vacation" /></div>
              {leaveBalance && leaveForm.leave_type === 'annual' && (
                <div style={{ marginTop:8, background:'var(--blue-light)', borderRadius:3, padding:'6px 10px', fontSize:11, color:'#1a3a6c' }}>
                  Annual balance: <strong>{leaveBalance.taken}</strong> taken, <strong style={{ color: leaveBalance.remaining < parseFloat(leaveForm.days_requested||0) ? '#c62828':'#2e7d32' }}>{leaveBalance.remaining}</strong> remaining
                  {parseFloat(leaveForm.days_requested||0) > leaveBalance.remaining && (
                    <span style={{ color:'#c62828', marginLeft:6 }}>⚠ Exceeds balance by {parseFloat(leaveForm.days_requested) - leaveBalance.remaining} days</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Resume Duty modal */}
      {showResume && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowResume(null)}>
          <div className="modal" style={{ maxWidth:400 }}>
            <div className="modal-header">
              <h3>Resume Duty</h3>
              <button className="close-btn" onClick={() => setShowResume(null)}>✕</button>
            </div>
            <div className="modal-toolbar">
              <button className="btn primary"
                onClick={() => resumeMut.mutate()}
                disabled={resumeMut.isPending || !resumeForm.resume_date}>
                {resumeMut.isPending ? '⏳ Saving...' : 'Confirm Resume'}
              </button>
              <button className="btn" style={{ marginLeft:'auto' }} onClick={() => setShowResume(null)}>Cancel</button>
            </div>
            <div className="modal-body" style={{ padding:14 }}>
              <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:3, padding:'7px 10px', fontSize:12, color:'#1b5e20', marginBottom:10 }}>
                Employee will be set back to <strong>Active</strong> and leave closed.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div className="field">
                  <label>Resume Date *</label>
                  <input type="date" value={resumeForm.resume_date} onChange={e => setResumeForm(f => ({ ...f, resume_date:e.target.value }))} />
                </div>
                <div className="field">
                  <label>Actual Days Taken (auto if blank)</label>
                  <input type="number" step="0.5" min="0" value={resumeForm.days_taken} onChange={e => setResumeForm(f => ({ ...f, days_taken:e.target.value }))} placeholder="Leave blank to auto-calc" />
                </div>
              </div>
              <div className="field"><label>Notes</label><input value={resumeForm.notes} onChange={e => setResumeForm(f => ({ ...f, notes:e.target.value }))} /></div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
