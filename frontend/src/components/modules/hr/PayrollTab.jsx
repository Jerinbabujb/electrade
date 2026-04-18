import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrApi } from '../../../services/api'
import toast from 'react-hot-toast'
import PayslipPrint from './PayslipPrint'

const MONTH_NAMES = ['','January','February','March','April','May','June',
                     'July','August','September','October','November','December']

const RUN_STYLE = {
  draft:    { bg:'#fff8e1', color:'#f57c00', label:'Draft' },
  approved: { bg:'var(--blue-light)', color:'var(--blue)', label:'Approved' },
  paid:     { bg:'#e8f5e9', color:'#2e7d32', label:'Paid' },
}

function fmtBhd(v) {
  const n = parseFloat(v || 0)
  return isNaN(n) ? '0.000' : n.toFixed(3)
}

export default function PayrollTab() {
  const qc = useQueryClient()
  const now = new Date()
  const [showNewRun, setShowNewRun] = useState(false)
  const [newRun, setNewRun] = useState({ run_month: now.getMonth()+1, run_year: now.getFullYear(), notes:'' })
  const [selectedRunId, setSelectedRunId] = useState(null)
  const [printSlip, setPrintSlip] = useState(null)
  const [editSlip, setEditSlip] = useState(null)
  const [editForm, setEditForm] = useState({})

  const { data: runsData, isLoading } = useQuery({
    queryKey: ['payroll-runs'],
    queryFn:  () => hrApi.listPayroll().then(r => r.data.data),
  })
  const runs = runsData || []

  const { data: runDetail } = useQuery({
    queryKey: ['payroll-run', selectedRunId],
    queryFn:  () => hrApi.getPayroll(selectedRunId).then(r => r.data.data),
    enabled:  !!selectedRunId,
  })

  const createMut = useMutation({
    mutationFn: () => hrApi.createPayroll(newRun),
    onSuccess: (res) => {
      toast.success(`Payroll created — ${res.data.count} payslips generated`)
      qc.invalidateQueries(['payroll-runs'])
      setShowNewRun(false)
      setSelectedRunId(res.data.data.id)
    },
  })

  const approveMut = useMutation({
    mutationFn: (id) => hrApi.approvePayroll(id),
    onSuccess: () => { toast.success('Payroll approved'); qc.invalidateQueries(['payroll-runs']); qc.invalidateQueries(['payroll-run', selectedRunId]) },
  })

  const paidMut = useMutation({
    mutationFn: (id) => hrApi.paidPayroll(id),
    onSuccess: () => { toast.success('Payroll marked as paid'); qc.invalidateQueries(['payroll-runs']); qc.invalidateQueries(['payroll-run', selectedRunId]) },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => hrApi.deletePayroll(id),
    onSuccess: () => { toast.success('Run deleted'); qc.invalidateQueries(['payroll-runs']); setSelectedRunId(null) },
  })

  const updateSlipMut = useMutation({
    mutationFn: () => hrApi.updatePayslip(selectedRunId, editSlip.id, editForm),
    onSuccess: () => { toast.success('Payslip updated'); qc.invalidateQueries(['payroll-run', selectedRunId]); setEditSlip(null) },
  })

  function openEditSlip(slip) {
    setEditSlip(slip)
    setEditForm({
      overtime_pay:   slip.overtime_pay   || '',
      bonus:          slip.bonus          || '',
      absence_deduct: slip.absence_deduct || '',
      loan_deduct:    slip.loan_deduct    || '',
      other_deduct:   slip.other_deduct   || '',
      notes:          slip.notes          || '',
    })
  }

  const selectedRun = runs.find(r => r.id === selectedRunId)

  return (
    <div style={{ display:'flex', flex:1, overflow:'hidden', gap:0 }}>

      {/* Left: runs list */}
      <div style={{ width:280, borderRight:'1px solid #d0d0d0', display:'flex', flexDirection:'column', flexShrink:0, background:'#fafafa' }}>
        <div style={{ padding:'8px 10px', borderBottom:'1px solid #d0d0d0' }}>
          <button className="btn primary" style={{ width:'100%' }} onClick={() => setShowNewRun(true)}>+ New Payroll Run</button>
        </div>
        <div style={{ flex:1, overflow:'auto' }}>
          {isLoading && <div style={{ padding:12, color:'#aaa', fontSize:12 }}>Loading...</div>}
          {!isLoading && !runs.length && <div style={{ padding:12, color:'#aaa', fontSize:12 }}>No payroll runs yet</div>}
          {runs.map(run => {
            const rs = RUN_STYLE[run.status] || RUN_STYLE.draft
            return (
              <div key={run.id} onClick={() => setSelectedRunId(run.id)} style={{
                padding:'10px 12px', borderBottom:'1px solid #e8e8e8', cursor:'pointer',
                background: selectedRunId===run.id ? 'var(--blue-light)' : '#fff',
                borderLeft: `3px solid ${selectedRunId===run.id ? 'var(--blue)' : 'transparent'}`,
              }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:13 }}>{MONTH_NAMES[run.run_month]} {run.run_year}</span>
                  <span style={{ fontSize:10, padding:'2px 6px', borderRadius:8, background:rs.bg, color:rs.color, fontWeight:600 }}>{rs.label}</span>
                </div>
                <div style={{ fontSize:11, color:'#555', marginTop:3 }}>
                  {run.slip_count} employees — Net: BHD {fmtBhd(run.total_net)}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right: run detail */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden' }}>
        {!selectedRunId && (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#aaa', fontSize:13 }}>
            Select a payroll run to view payslips
          </div>
        )}

        {selectedRunId && runDetail && (() => {
          const rs = RUN_STYLE[runDetail.status] || RUN_STYLE.draft
          const slips = runDetail.payslips || []
          const totalNet   = slips.reduce((s,p) => s + parseFloat(p.net_pay||0), 0)
          const totalGross = slips.reduce((s,p) => s + parseFloat(p.gross_pay||0), 0)
          const totalGosi  = slips.reduce((s,p) => s + parseFloat(p.gosi_employer||0), 0)
          const totalEosb  = slips.reduce((s,p) => s + parseFloat(p.eosb_contribution||0), 0)
          const totalErCost = totalGross + totalGosi + totalEosb

          return (
            <>
              {/* Run header */}
              <div style={{ padding:'8px 12px', borderBottom:'1px solid #d0d0d0', background:'#f7f7f7', flexShrink:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontWeight:700, fontSize:14 }}>{MONTH_NAMES[runDetail.run_month]} {runDetail.run_year} Payroll</span>
                  <span style={{ fontSize:11, padding:'2px 7px', borderRadius:8, background:rs.bg, color:rs.color, fontWeight:600 }}>{rs.label}</span>
                  <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
                    {runDetail.status === 'draft' && (
                      <>
                        <button className="btn" style={{ background:'var(--blue-light)', borderColor:'#b0c8f0', color:'var(--blue)' }}
                          onClick={() => approveMut.mutate(selectedRunId)}>
                          Approve
                        </button>
                        <button className="btn danger"
                          onClick={() => window.confirm('Delete this draft run?') && deleteMut.mutate(selectedRunId)}>
                          Delete
                        </button>
                      </>
                    )}
                    {runDetail.status === 'approved' && (
                      <button className="btn" style={{ background:'#e8f5e9', borderColor:'#a5d6a7', color:'#2e7d32' }}
                        onClick={() => paidMut.mutate(selectedRunId)}>
                        Mark Paid
                      </button>
                    )}
                  </div>
                </div>
                <div style={{ display:'flex', gap:20, marginTop:6, fontSize:12, flexWrap:'wrap' }}>
                  <span>Employees: <strong>{slips.length}</strong></span>
                  <span>Gross: <strong>BHD {fmtBhd(totalGross)}</strong></span>
                  <span>Net Payable: <strong style={{ color:'#2e7d32', fontSize:13 }}>BHD {fmtBhd(totalNet)}</strong></span>
                  <span style={{ color:'#e65100' }}>Employer GOSI: <strong>BHD {fmtBhd(totalGosi)}</strong></span>
                  {totalEosb > 0 && <span style={{ color:'#e65100' }}>EOSB provision: <strong>BHD {fmtBhd(totalEosb)}</strong></span>}
                  <span style={{ color:'#c62828', fontWeight:600 }}>Total employer cost: BHD {fmtBhd(totalErCost)}</span>
                </div>
              </div>

              {/* Payslips table */}
              <div className="grid-wrap">
                <table className="data-table">
                  <thead><tr>
                    <th>Emp No.</th><th>Name</th><th>Position</th>
                    <th className="right">Basic</th>
                    <th className="right">Housing</th>
                    <th className="right">Transport</th>
                    <th className="right">OT / Bonus</th>
                    <th className="right">Gross</th>
                    <th className="right">GOSI (emp)</th>
                    <th className="right">Deductions</th>
                    <th className="right" style={{ color:'#2e7d32' }}>Net Pay</th>
                    <th className="right" style={{ color:'#e65100', fontSize:10 }}>EOSB (er)</th>
                    <th>Actions</th>
                  </tr></thead>
                  <tbody>
                    {!slips.length && <tr className="empty-row"><td colSpan={12}>No payslips</td></tr>}
                    {slips.map(p => (
                      <tr key={p.id}>
                        <td style={{ fontWeight:600, color:'var(--blue)' }}>{p.emp_no}</td>
                        <td style={{ fontWeight:600 }}>{p.full_name}</td>
                        <td style={{ color:'#555' }}>{p.position||'—'}</td>
                        <td className="right">{fmtBhd(p.basic_salary)}</td>
                        <td className="right">{fmtBhd(p.housing_allow)}</td>
                        <td className="right">{fmtBhd(p.transport_allow)}</td>
                        <td className="right" style={{ color: (parseFloat(p.overtime_pay||0)+parseFloat(p.bonus||0))>0 ? '#2e7d32':'#aaa' }}>
                          {fmtBhd(parseFloat(p.overtime_pay||0)+parseFloat(p.bonus||0))}
                        </td>
                        <td className="right" style={{ fontWeight:600 }}>{fmtBhd(p.gross_pay)}</td>
                        <td className="right" style={{ color:'#c62828' }}>{fmtBhd(p.gosi_employee)}</td>
                        <td className="right" style={{ color: parseFloat(p.total_deductions||0)>parseFloat(p.gosi_employee||0)?'#c62828':'#aaa' }}>
                          {fmtBhd(p.total_deductions)}
                        </td>
                        <td className="right" style={{ fontWeight:700, color:'#2e7d32', fontSize:13 }}>{fmtBhd(p.net_pay)}</td>
                        <td className="right" style={{ fontSize:11, color: parseFloat(p.eosb_contribution||0)>0 ? '#e65100':'#ccc' }}>
                          {parseFloat(p.eosb_contribution||0) > 0 ? fmtBhd(p.eosb_contribution) : '—'}
                          {parseFloat(p.eosb_rate||0) > 0 && <span style={{ fontSize:9, display:'block', color:'#aaa' }}>{p.eosb_rate}%</span>}
                        </td>
                        <td style={{ whiteSpace:'nowrap' }}>
                          {runDetail.status === 'draft' && (
                            <button className="btn" style={{ padding:'2px 8px', fontSize:11 }} onClick={() => openEditSlip(p)}>Edit</button>
                          )}
                          <button className="btn" style={{ padding:'2px 8px', fontSize:11, marginLeft:4 }} onClick={() => setPrintSlip({ ...p, run: runDetail })}>Print</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="status-bar">
                <span>Net Payable: <strong style={{ color:'#2e7d32' }}>BHD {fmtBhd(totalNet)}</strong></span>
                <span>|</span>
                <span>Employer GOSI: <strong style={{ color:'#e65100' }}>BHD {fmtBhd(totalGosi)}</strong></span>
                {totalEosb > 0 && <><span>|</span><span>EOSB provision: <strong style={{ color:'#e65100' }}>BHD {fmtBhd(totalEosb)}</strong></span></>}
                <span>|</span>
                <span>Total employer cost: <strong style={{ color:'#c62828' }}>BHD {fmtBhd(totalErCost)}</strong></span>
              </div>
            </>
          )
        })()}
      </div>

      {/* New Run modal */}
      {showNewRun && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowNewRun(false)}>
          <div className="modal" style={{ maxWidth:380 }}>
            <div className="modal-header">
              <h3>New Payroll Run</h3>
              <button className="close-btn" onClick={() => setShowNewRun(false)}>✕</button>
            </div>
            <div className="modal-toolbar">
              <button className="btn primary" onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                {createMut.isPending ? '⏳ Generating...' : 'Generate Payroll'}
              </button>
              <button className="btn" style={{ marginLeft:'auto' }} onClick={() => setShowNewRun(false)}>Cancel</button>
            </div>
            <div className="modal-body" style={{ padding:14 }}>
              <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'8px 10px', fontSize:12, color:'#1a3a6c', marginBottom:12 }}>
                This will auto-generate payslips for all active employees using their current salary settings.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div className="field">
                  <label>Month</label>
                  <select value={newRun.run_month} onChange={e => setNewRun(r => ({ ...r, run_month: parseInt(e.target.value) }))}>
                    {MONTH_NAMES.slice(1).map((m, i) => <option key={i+1} value={i+1}>{m}</option>)}
                  </select>
                </div>
                <div className="field">
                  <label>Year</label>
                  <input type="number" value={newRun.run_year} onChange={e => setNewRun(r => ({ ...r, run_year: parseInt(e.target.value) }))} />
                </div>
              </div>
              <div className="field"><label>Notes</label><input value={newRun.notes} onChange={e => setNewRun(r => ({ ...r, notes: e.target.value }))} /></div>
            </div>
          </div>
        </div>
      )}

      {/* Edit payslip modal */}
      {editSlip && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setEditSlip(null)}>
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <h3>Edit Payslip — {editSlip.full_name}</h3>
              <button className="close-btn" onClick={() => setEditSlip(null)}>✕</button>
            </div>
            <div className="modal-toolbar">
              <button className="btn primary" onClick={() => updateSlipMut.mutate()} disabled={updateSlipMut.isPending}>
                {updateSlipMut.isPending ? '⏳ Saving...' : '💾 Save'}
              </button>
              <button className="btn" style={{ marginLeft:'auto' }} onClick={() => setEditSlip(null)}>Cancel</button>
            </div>
            <div className="modal-body" style={{ padding:14 }}>
              <div style={{ background:'#f5f5f5', borderRadius:3, padding:'8px 10px', fontSize:12, marginBottom:10 }}>
                Basic: <strong>BHD {fmtBhd(editSlip.basic_salary)}</strong> &nbsp;|&nbsp;
                Housing: <strong>BHD {fmtBhd(editSlip.housing_allow)}</strong> &nbsp;|&nbsp;
                Transport: <strong>BHD {fmtBhd(editSlip.transport_allow)}</strong>
              </div>
              <div style={{ fontWeight:600, fontSize:11, color:'#2e7d32', marginBottom:6, textTransform:'uppercase' }}>Additional Earnings</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                <div className="field"><label>Overtime Pay BHD</label><input type="number" step="0.001" min="0" value={editForm.overtime_pay} onChange={e => setEditForm(f => ({ ...f, overtime_pay: e.target.value }))} /></div>
                <div className="field"><label>Bonus BHD</label><input type="number" step="0.001" min="0" value={editForm.bonus} onChange={e => setEditForm(f => ({ ...f, bonus: e.target.value }))} /></div>
              </div>
              <div style={{ fontWeight:600, fontSize:11, color:'#c62828', marginBottom:6, textTransform:'uppercase' }}>Additional Deductions</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                <div className="field"><label>Absence Ded.</label><input type="number" step="0.001" min="0" value={editForm.absence_deduct} onChange={e => setEditForm(f => ({ ...f, absence_deduct: e.target.value }))} /></div>
                <div className="field"><label>Loan Repay.</label><input type="number" step="0.001" min="0" value={editForm.loan_deduct} onChange={e => setEditForm(f => ({ ...f, loan_deduct: e.target.value }))} /></div>
                <div className="field"><label>Other Ded.</label><input type="number" step="0.001" min="0" value={editForm.other_deduct} onChange={e => setEditForm(f => ({ ...f, other_deduct: e.target.value }))} /></div>
              </div>
              <div className="field"><label>Notes</label><input value={editForm.notes} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} /></div>
            </div>
          </div>
        </div>
      )}

      {/* Payslip print */}
      {printSlip && <PayslipPrint slip={printSlip} onClose={() => setPrintSlip(null)} />}
    </div>
  )
}
