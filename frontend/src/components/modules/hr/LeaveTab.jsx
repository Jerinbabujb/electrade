import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { hrApi } from '../../../services/api'
import { fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

const LEAVE_TYPE_LABELS = {
  annual:'Annual Leave', sick:'Sick Leave', unpaid:'Unpaid Leave',
  emergency:'Emergency', maternity:'Maternity', paternity:'Paternity', other:'Other'
}
const LEAVE_TYPE_COLORS = {
  annual:    'var(--blue)',
  sick:      '#e65100',
  unpaid:    '#555',
  emergency: '#c62828',
  maternity: '#7b1fa2',
  paternity: '#2e7d32',
  other:     '#888',
}

export default function LeaveTab() {
  const qc = useQueryClient()
  const [filters, setFilters] = useState({ status:'active', type:'' })
  const [showResume, setShowResume] = useState(null)
  const [resumeForm, setResumeForm] = useState({ resume_date:'', days_taken:'', notes:'' })

  const { data, isLoading } = useQuery({
    queryKey: ['all-leaves', filters],
    queryFn:  () => hrApi.listLeaves(filters).then(r => r.data.data),
  })
  const rows = data || []

  const resumeMut = useMutation({
    mutationFn: () => hrApi.resumeLeave(showResume.id, resumeForm),
    onSuccess: () => {
      toast.success(`${showResume.full_name} has resumed duty`)
      qc.invalidateQueries(['all-leaves'])
      qc.invalidateQueries(['employees'])
      setShowResume(null)
    },
  })

  const cancelMut = useMutation({
    mutationFn: (id) => hrApi.cancelLeave(id),
    onSuccess: () => { toast.success('Leave cancelled'); qc.invalidateQueries(['all-leaves']); qc.invalidateQueries(['employees']) },
  })

  // Summary counts
  const byType = rows.reduce((acc, r) => { acc[r.leave_type] = (acc[r.leave_type]||0)+1; return acc }, {})

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="toolbar">
        <select className="btn" style={{ height:26 }} value={filters.status} onChange={e => setFilters(f => ({ ...f, status:e.target.value }))}>
          <option value="">All Status</option>
          <option value="active">Currently on Leave</option>
          <option value="resumed">Resumed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select className="btn" style={{ height:26 }} value={filters.type} onChange={e => setFilters(f => ({ ...f, type:e.target.value }))}>
          <option value="">All Types</option>
          {Object.entries(LEAVE_TYPE_LABELS).map(([v,l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <div className="toolbar-sep" />
        {/* Summary badges */}
        {Object.entries(byType).map(([type, cnt]) => (
          <span key={type} style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:'#f0f0f0', color: LEAVE_TYPE_COLORS[type]||'#555', border:'1px solid #ddd', fontWeight:600 }}>
            {LEAVE_TYPE_LABELS[type]||type}: {cnt}
          </span>
        ))}
      </div>

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th>Employee</th><th>Position</th><th>Department</th>
            <th>Leave Type</th><th>Start Date</th><th>Expected Return</th>
            <th className="right">Req. Days</th><th className="right">Taken</th>
            <th>Resume Date</th><th>Status</th><th>Notes</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={12}>Loading...</td></tr>}
            {!isLoading && !rows.length && <tr className="empty-row"><td colSpan={12}>No leave records found</td></tr>}
            {rows.map(r => {
              const isActive = r.status === 'active'
              const typeColor = LEAVE_TYPE_COLORS[r.leave_type] || '#555'

              // Highlight if overdue (expected return passed and still active)
              const isOverdue = isActive && r.end_date && new Date(r.end_date) < new Date()

              return (
                <tr key={r.id} style={{ background: isOverdue ? '#fff3e0' : undefined }}>
                  <td style={{ fontWeight:600 }}>
                    <div>{r.full_name}</div>
                    <div style={{ fontSize:10, color:'#888' }}>{r.emp_no}</div>
                  </td>
                  <td style={{ fontSize:11, color:'#555' }}>{r.position||'—'}</td>
                  <td style={{ fontSize:11, color:'#555' }}>{r.department||'—'}</td>
                  <td>
                    <span style={{ fontSize:11, padding:'2px 8px', borderRadius:8, background:`${typeColor}18`, color:typeColor, fontWeight:600, border:`1px solid ${typeColor}44` }}>
                      {LEAVE_TYPE_LABELS[r.leave_type]||r.leave_type}
                    </span>
                  </td>
                  <td>{fmtDate(r.start_date)}</td>
                  <td style={{ color: isOverdue ? '#c62828':'inherit', fontWeight: isOverdue?700:'normal' }}>
                    {r.end_date ? fmtDate(r.end_date) : '—'}
                    {isOverdue && <span style={{ fontSize:10, marginLeft:4 }}>⚠ Overdue</span>}
                  </td>
                  <td className="right">{r.days_requested}</td>
                  <td className="right" style={{ fontWeight: r.days_taken?600:'normal', color: r.days_taken?'#333':'#aaa' }}>
                    {r.days_taken ?? '—'}
                  </td>
                  <td style={{ color:'#2e7d32' }}>{r.resume_date ? fmtDate(r.resume_date) : '—'}</td>
                  <td>
                    <span style={{ fontSize:11, padding:'2px 7px', borderRadius:8, fontWeight:600,
                      background: isActive?'#fff8e1': r.status==='resumed'?'#e8f5e9':'#f5f5f5',
                      color:      isActive?'#f57c00': r.status==='resumed'?'#2e7d32':'#888' }}>
                      {isActive ? 'On Leave' : r.status === 'resumed' ? 'Resumed' : 'Cancelled'}
                    </span>
                  </td>
                  <td style={{ fontSize:11, color:'#888', maxWidth:160, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.notes||'—'}</td>
                  <td style={{ whiteSpace:'nowrap' }}>
                    {isActive && <>
                      <button className="btn" style={{ fontSize:10, padding:'2px 8px', background:'#e8f5e9', borderColor:'#a5d6a7', color:'#2e7d32' }}
                        onClick={() => { setShowResume(r); setResumeForm({ resume_date: new Date().toISOString().split('T')[0], days_taken:'', notes:'' }) }}>
                        Resume Duty
                      </button>
                      <button className="btn" style={{ fontSize:10, padding:'2px 8px', marginLeft:4 }}
                        onClick={() => window.confirm(`Cancel leave for ${r.full_name}?`) && cancelMut.mutate(r.id)}>
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

      <div className="status-bar">
        <span>{rows.filter(r=>r.status==='active').length} currently on leave</span>
        <span>|</span>
        <span>{rows.length} total records</span>
        {rows.filter(r=>r.status==='active'&&r.end_date&&new Date(r.end_date)<new Date()).length > 0 && <>
          <span>|</span>
          <span style={{ color:'#c62828', fontWeight:600 }}>
            ⚠ {rows.filter(r=>r.status==='active'&&r.end_date&&new Date(r.end_date)<new Date()).length} overdue return
          </span>
        </>}
      </div>

      {/* Resume Duty modal */}
      {showResume && (
        <div className="modal-overlay" onClick={e => e.target===e.currentTarget && setShowResume(null)}>
          <div className="modal" style={{ maxWidth:420 }}>
            <div className="modal-header">
              <h3>Resume Duty — {showResume.full_name}</h3>
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
              <div style={{ background:'#f5f5f5', borderRadius:3, padding:'7px 10px', fontSize:12, marginBottom:10 }}>
                Leave started: <strong>{fmtDate(showResume.start_date)}</strong>
                {showResume.end_date && <> &nbsp;| Expected return: <strong>{fmtDate(showResume.end_date)}</strong></>}
                &nbsp;| Requested: <strong>{showResume.days_requested} days</strong>
              </div>
              <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:3, padding:'7px 10px', fontSize:12, color:'#1b5e20', marginBottom:10 }}>
                Employee status will be set back to <strong>Active</strong> and leave record closed.
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
                <div className="field">
                  <label>Actual Resume Date *</label>
                  <input type="date" value={resumeForm.resume_date}
                    onChange={e => setResumeForm(f => ({ ...f, resume_date:e.target.value }))} />
                </div>
                <div className="field">
                  <label>Actual Days Taken (auto if blank)</label>
                  <input type="number" step="0.5" min="0" value={resumeForm.days_taken}
                    onChange={e => setResumeForm(f => ({ ...f, days_taken:e.target.value }))}
                    placeholder="Auto: calendar days from start" />
                </div>
              </div>
              <div className="field">
                <label>Remarks</label>
                <input value={resumeForm.notes} onChange={e => setResumeForm(f => ({ ...f, notes:e.target.value }))} />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
