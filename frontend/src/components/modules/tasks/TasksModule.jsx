import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { taskApi } from '../../../services/api'
import { useAuthStore } from '../../../store'
import toast from 'react-hot-toast'

// ── Constants ───────────────────────────────────────────────
const STATUS_TABS = [
  { id: '',            label: 'All',         color: '#555' },
  { id: 'open',        label: 'Open',        color: 'var(--blue)' },
  { id: 'in_progress', label: 'In Progress', color: '#e65100' },
  { id: 'on_hold',     label: 'On Hold',     color: '#6a1b9a' },
  { id: 'completed',   label: 'Completed',   color: '#2e7d32' },
  { id: 'cancelled',   label: 'Cancelled',   color: '#757575' },
]

const PRIORITY_META = {
  urgent: { label: 'Urgent', color: '#fff',    bg: '#c62828',  border: '#c62828' },
  high:   { label: 'High',   color: '#c62828', bg: '#fdecea',  border: '#ef9a9a' },
  medium: { label: 'Medium', color: '#e65100', bg: '#fff3e0',  border: '#ffcc80' },
  low:    { label: 'Low',    color: '#2e7d32', bg: '#e8f5e9',  border: '#a5d6a7' },
}

const STATUS_META = {
  open:        { label: 'Open',        color: 'var(--blue)', bg: 'var(--blue-light)' },
  in_progress: { label: 'In Progress', color: '#e65100', bg: '#fff3e0' },
  on_hold:     { label: 'On Hold',     color: '#6a1b9a', bg: '#f3e5f5' },
  completed:   { label: 'Completed',   color: '#2e7d32', bg: '#e8f5e9' },
  cancelled:   { label: 'Cancelled',   color: '#757575', bg: '#f5f5f5' },
}

const FREQ_LABELS = { none: 'None', daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly' }

const today = () => new Date().toISOString().split('T')[0]

function fmtDate(d) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function isOverdue(task) {
  return task.due_date && task.status !== 'completed' && task.status !== 'cancelled'
    && new Date(task.due_date) < new Date(today())
}

// ── Empty form ──────────────────────────────────────────────
const EMPTY = {
  title:'', description:'', category:'', priority:'medium', status:'open',
  assigned_to:'', due_date:'', notes:'',
  is_recurring:false, recur_freq:'daily', recur_interval:1,
  recur_end_date:'', recur_next_date:'',
}

// ── Main component ──────────────────────────────────────────
export default function TasksModule() {
  const { user }  = useAuthStore()
  const qc        = useQueryClient()
  const [tab,     setTab]     = useState('')
  const [mine,    setMine]    = useState(false)
  const [search,  setSearch]  = useState('')
  const [selId,   setSelId]   = useState(null)
  const [showForm,setShowForm]= useState(false)
  const [editTask,setEditTask]= useState(null) // null=create, obj=edit

  const params = { ...(tab ? { status: tab } : {}), ...(mine ? { mine: '1' } : {}), ...(search ? { search } : {}) }

  const { data, isLoading } = useQuery({
    queryKey: ['tasks', params],
    queryFn:  () => taskApi.list(params).then(r => r.data),
    refetchInterval: 30000,
  })

  const { data: usersData } = useQuery({
    queryKey: ['task-users'],
    queryFn:  () => taskApi.users().then(r => r.data.data),
  })

  const { data: detail } = useQuery({
    queryKey: ['task-detail', selId],
    queryFn:  () => taskApi.get(selId).then(r => r.data.data),
    enabled:  !!selId,
  })

  const tasks    = data?.data    || []
  const summary  = data?.summary || {}
  const users    = usersData     || []

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => taskApi.setStatus(id, status),
    onSuccess: () => { qc.invalidateQueries(['tasks']); qc.invalidateQueries(['task-detail', selId]) },
  })

  const deleteMut = useMutation({
    mutationFn: (id) => taskApi.delete(id),
    onSuccess: () => { toast.success('Task deleted'); qc.invalidateQueries(['tasks']); setSelId(null) },
  })

  const openCreate = () => { setEditTask(null); setShowForm(true) }
  const openEdit   = (t) => { setEditTask(t);   setShowForm(true) }

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Tasks & Tickets</div>

      {/* ── Toolbar ── */}
      <div style={{ display:'flex', gap:8, alignItems:'center', padding:'8px 12px', borderBottom:'1px solid #e0e0e0', flexWrap:'wrap', background:'#fafafa' }}>
        <button className="btn primary" onClick={openCreate} style={{ fontWeight:700 }}>+ New Task</button>

        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search tasks..."
          style={{ padding:'5px 10px', border:'1px solid #d0d0d0', borderRadius:3, fontSize:12, width:200 }}
        />

        <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer' }}>
          <input type="checkbox" checked={mine} onChange={e=>setMine(e.target.checked)} />
          My Tasks
        </label>

        {/* Summary chips */}
        <div style={{ marginLeft:'auto', display:'flex', gap:6 }}>
          {Object.entries(summary).map(([s, n]) => n > 0 && (
            <span key={s}
              onClick={() => setTab(s === tab ? '' : s)}
              style={{
                padding:'2px 9px', borderRadius:10, fontSize:11, cursor:'pointer', fontWeight:600,
                background: tab===s ? (STATUS_META[s]?.bg||'#eee') : '#f0f0f0',
                color: STATUS_META[s]?.color||'#555',
                border:`1px solid ${tab===s?(STATUS_META[s]?.color||'#ccc'):'transparent'}`,
              }}>
              {s.replace('_',' ')} {n}
            </span>
          ))}
        </div>
      </div>

      {/* ── Status tabs ── */}
      <div className="tab-bar" style={{ borderBottom:'1px solid #e0e0e0' }}>
        {STATUS_TABS.map(t => (
          <div key={t.id} className={`tab ${tab===t.id?'active':''}`}
            onClick={() => setTab(t.id)}
            style={{ color: tab===t.id ? t.color : undefined }}>
            {t.label}
          </div>
        ))}
      </div>

      {/* ── Body: list + detail panel ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Task list */}
        <div style={{ flex:1, overflowY:'auto', padding:12 }}>
          {isLoading && <div style={{ color:'#aaa', textAlign:'center', padding:24 }}>Loading...</div>}

          {!isLoading && tasks.length === 0 && (
            <div style={{ textAlign:'center', color:'#aaa', padding:40 }}>
              <div style={{ fontSize:32, marginBottom:8 }}>✅</div>
              <div>No tasks found</div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {tasks.map(task => (
              <TaskCard key={task.id} task={task} users={users}
                selected={selId === task.id}
                onSelect={() => setSelId(selId===task.id ? null : task.id)}
                onEdit={() => openEdit(task)}
                onStatusChange={(s) => statusMut.mutate({ id: task.id, status: s })}
                onDelete={() => { if (window.confirm('Delete this task?')) deleteMut.mutate(task.id) }}
              />
            ))}
          </div>
        </div>

        {/* Detail panel */}
        {selId && detail && (
          <TaskDetail
            task={detail}
            users={users}
            onEdit={() => openEdit(detail)}
            onClose={() => setSelId(null)}
            onStatusChange={(s) => statusMut.mutate({ id: selId, status: s })}
            onDelete={() => { if (window.confirm('Delete this task?')) deleteMut.mutate(selId) }}
          />
        )}
      </div>

      {/* Create/Edit modal */}
      {showForm && (
        <TaskForm
          task={editTask}
          users={users}
          onClose={() => setShowForm(false)}
          onSaved={(t) => { setShowForm(false); setSelId(t.id); qc.invalidateQueries(['tasks']) }}
        />
      )}
    </div>
  )
}

// ── Task card ───────────────────────────────────────────────
function TaskCard({ task, users, selected, onSelect, onEdit, onStatusChange, onDelete }) {
  const pri  = PRIORITY_META[task.priority] || PRIORITY_META.medium
  const stat = STATUS_META[task.status]     || STATUS_META.open
  const due  = isOverdue(task)

  return (
    <div onClick={onSelect} style={{
      border:`1px solid ${selected ? 'var(--blue)' : due ? '#ffab91' : '#e0e0e0'}`,
      borderLeft:`4px solid ${pri.bg === '#fdecea' ? '#c62828' : pri.bg === '#fff3e0' ? '#e65100' : pri.bg === '#e8f5e9' ? '#2e7d32' : '#c62828'}`,
      borderRadius:3, padding:'8px 12px', cursor:'pointer',
      background: selected ? 'var(--blue-light)' : due ? '#fff8f6' : '#fff',
      display:'flex', alignItems:'center', gap:10,
    }}>
      {/* Status quick-change dot */}
      <div style={{ position:'relative', flexShrink:0 }}>
        <div style={{
          width:12, height:12, borderRadius:'50%',
          background: stat.color, flexShrink:0,
          border:`2px solid ${stat.color}`,
        }} title={stat.label} />
      </div>

      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:2 }}>
          <span style={{ fontSize:10, color:'#888', fontFamily:'monospace' }}>{task.task_no}</span>
          {task.is_recurring && <span style={{ fontSize:9, background:'var(--blue-light)', color:'var(--blue)', padding:'0 5px', borderRadius:8, fontWeight:700 }}>↻ RECURRING</span>}
          {task.recur_parent_id && <span style={{ fontSize:9, background:'#f3e5f5', color:'#6a1b9a', padding:'0 5px', borderRadius:8 }}>↳ instance</span>}
          {due && <span style={{ fontSize:9, background:'#fdecea', color:'#c62828', padding:'0 5px', borderRadius:8, fontWeight:700 }}>OVERDUE</span>}
        </div>
        <div style={{ fontWeight:600, fontSize:13, color:'#222', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>
          {task.title}
        </div>
        <div style={{ display:'flex', gap:8, marginTop:3, flexWrap:'wrap' }}>
          {task.category && <span style={{ fontSize:11, color:'#888' }}>{task.category}</span>}
          {task.assigned_to_name && <span style={{ fontSize:11, color:'#555' }}>👤 {task.assigned_to_name}</span>}
          {task.due_date && (
            <span style={{ fontSize:11, color: due ? '#c62828' : '#555' }}>
              📅 {fmtDate(task.due_date)}
            </span>
          )}
        </div>
      </div>

      <div style={{ display:'flex', gap:4, flexShrink:0, alignItems:'center' }}>
        {/* Priority badge */}
        <span style={{
          padding:'2px 7px', borderRadius:10, fontSize:10, fontWeight:700,
          color:pri.color, background:pri.bg, border:`1px solid ${pri.border}`,
        }}>{pri.label}</span>

        {/* Status badge */}
        <span style={{
          padding:'2px 7px', borderRadius:10, fontSize:10,
          color:stat.color, background:stat.bg,
        }}>{stat.label}</span>

        {/* Quick actions */}
        <div onClick={e=>e.stopPropagation()} style={{ display:'flex', gap:3 }}>
          {task.status !== 'completed' && (
            <button className="btn" title="Mark Complete"
              style={{ fontSize:11, padding:'2px 6px', background:'#e8f5e9', color:'#2e7d32', border:'1px solid #a5d6a7' }}
              onClick={() => onStatusChange('completed')}>✓</button>
          )}
          <button className="btn" title="Edit"
            style={{ fontSize:11, padding:'2px 6px' }}
            onClick={onEdit}>✎</button>
          <button className="btn" title="Delete"
            style={{ fontSize:11, padding:'2px 6px', background:'#fdecea', color:'#c62828', border:'1px solid #ef9a9a' }}
            onClick={onDelete}>✕</button>
        </div>
      </div>
    </div>
  )
}

// ── Task detail panel ────────────────────────────────────────
function TaskDetail({ task, users, onEdit, onClose, onStatusChange, onDelete }) {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const [newComment, setNewComment] = useState('')
  const commentRef = useRef()

  const addComment = useMutation({
    mutationFn: () => taskApi.addComment(task.id, newComment),
    onSuccess: () => {
      setNewComment('')
      qc.invalidateQueries(['task-detail', task.id])
    },
  })

  const delComment = useMutation({
    mutationFn: (cid) => taskApi.delComment(cid),
    onSuccess: () => qc.invalidateQueries(['task-detail', task.id]),
  })

  const pri  = PRIORITY_META[task.priority] || PRIORITY_META.medium
  const stat = STATUS_META[task.status]     || STATUS_META.open
  const due  = isOverdue(task)

  return (
    <div style={{
      width:360, borderLeft:'1px solid #e0e0e0', display:'flex', flexDirection:'column',
      background:'#fafafa', flexShrink:0,
    }}>
      {/* Header */}
      <div style={{ padding:'10px 14px', borderBottom:'1px solid #e0e0e0', background:'#fff', display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div style={{ flex:1, minWidth:0, paddingRight:8 }}>
          <div style={{ fontSize:10, color:'#888', fontFamily:'monospace', marginBottom:2 }}>
            {task.task_no}
            {task.is_recurring && <span style={{ marginLeft:6, color:'var(--blue)' }}>↻ recurring template</span>}
            {task.recur_parent_id && <span style={{ marginLeft:6, color:'#6a1b9a' }}>↳ recurring instance</span>}
          </div>
          <div style={{ fontWeight:700, fontSize:13, lineHeight:1.4 }}>{task.title}</div>
        </div>
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          <button className="btn" style={{ fontSize:11, padding:'2px 7px' }} onClick={onEdit}>Edit</button>
          <button className="btn" style={{ fontSize:11, padding:'2px 7px' }} onClick={onClose}>✕</button>
        </div>
      </div>

      <div style={{ flex:1, overflowY:'auto', padding:14 }}>

        {/* Status + Priority */}
        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap' }}>
          <span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, color:stat.color, background:stat.bg }}>
            {stat.label}
          </span>
          <span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, color:pri.color, background:pri.bg, border:`1px solid ${pri.border}` }}>
            {pri.label}
          </span>
          {due && <span style={{ padding:'3px 10px', borderRadius:10, fontSize:11, fontWeight:700, color:'#c62828', background:'#fdecea' }}>OVERDUE</span>}
        </div>

        {/* Status change buttons */}
        <div style={{ display:'flex', gap:4, marginBottom:14, flexWrap:'wrap' }}>
          {['open','in_progress','on_hold','completed','cancelled']
            .filter(s => s !== task.status)
            .map(s => (
              <button key={s} className="btn"
                style={{ fontSize:10, padding:'2px 8px', color:STATUS_META[s].color, background:STATUS_META[s].bg }}
                onClick={() => onStatusChange(s)}>
                → {STATUS_META[s].label}
              </button>
            ))}
        </div>

        {/* Meta fields */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px 12px', fontSize:12, marginBottom:14 }}>
          <InfoRow label="Assigned To"   value={task.assigned_to_name || '—'} />
          <InfoRow label="Created By"    value={task.created_by_name  || '—'} />
          <InfoRow label="Due Date"      value={<span style={{color:due?'#c62828':undefined}}>{fmtDate(task.due_date)}</span>} />
          <InfoRow label="Category"      value={task.category || '—'} />
          {task.completed_at && <InfoRow label="Completed" value={fmtDate(task.completed_at)} />}
        </div>

        {/* Description */}
        {task.description && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', marginBottom:4 }}>Description</div>
            <div style={{ fontSize:12, color:'#333', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{task.description}</div>
          </div>
        )}

        {/* Notes */}
        {task.notes && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', marginBottom:4 }}>Notes</div>
            <div style={{ fontSize:12, color:'#555', whiteSpace:'pre-wrap', lineHeight:1.6 }}>{task.notes}</div>
          </div>
        )}

        {/* Recurring info */}
        {task.is_recurring && (
          <div style={{ background:'var(--blue-light)', border:'1px solid #b0c8f0', borderRadius:3, padding:'8px 10px', marginBottom:14, fontSize:12 }}>
            <div style={{ fontWeight:700, color:'var(--blue)', marginBottom:4 }}>↻ Recurring Template</div>
            <div>Frequency: every {task.recur_interval > 1 ? task.recur_interval + ' ' : ''}{task.recur_freq}</div>
            {task.recur_next_date && <div>Next instance: {fmtDate(task.recur_next_date)}</div>}
            {task.recur_end_date  && <div>Ends: {fmtDate(task.recur_end_date)}</div>}
          </div>
        )}

        {/* Recurring instances */}
        {task.instances?.length > 0 && (
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', marginBottom:6 }}>Recent Instances</div>
            {task.instances.map(i => (
              <div key={i.id} style={{ display:'flex', justifyContent:'space-between', padding:'3px 0', borderBottom:'1px solid #eee', fontSize:11 }}>
                <span style={{ fontFamily:'monospace', color:'#888' }}>{i.task_no}</span>
                <span style={{ color:'#333' }}>{fmtDate(i.due_date)}</span>
                <span style={{ color:STATUS_META[i.status]?.color||'#555' }}>{STATUS_META[i.status]?.label||i.status}</span>
              </div>
            ))}
          </div>
        )}

        {/* Comments */}
        <div style={{ borderTop:'1px solid #e0e0e0', paddingTop:12 }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#888', textTransform:'uppercase', marginBottom:8 }}>
            Comments ({(task.comments||[]).length})
          </div>
          {(task.comments||[]).map(c => (
            <div key={c.id} style={{ marginBottom:10, padding:'7px 10px', background:'#fff', border:'1px solid #e8e8e8', borderRadius:3 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:3 }}>
                <span style={{ fontSize:11, fontWeight:600, color:'var(--blue)' }}>{c.author_name || 'User'}</span>
                <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                  <span style={{ fontSize:10, color:'#aaa' }}>{new Date(c.created_at).toLocaleString('en-GB',{day:'2-digit',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                  {(user?.role === 'admin' || user?.id === c.created_by) && (
                    <button className="btn" style={{ fontSize:10, padding:'0 5px', color:'#c62828' }}
                      onClick={() => delComment.mutate(c.id)}>✕</button>
                  )}
                </div>
              </div>
              <div style={{ fontSize:12, color:'#333', whiteSpace:'pre-wrap' }}>{c.comment}</div>
            </div>
          ))}

          {/* Add comment */}
          <textarea
            ref={commentRef}
            value={newComment}
            onChange={e => setNewComment(e.target.value)}
            placeholder="Add a comment..."
            rows={2}
            style={{ width:'100%', padding:'6px 8px', fontSize:12, border:'1px solid #d0d0d0', borderRadius:3, resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }}
            onKeyDown={e => { if (e.key === 'Enter' && e.ctrlKey && newComment.trim()) addComment.mutate() }}
          />
          <button className="btn primary" style={{ marginTop:4, fontSize:11 }}
            onClick={() => addComment.mutate()}
            disabled={!newComment.trim() || addComment.isPending}>
            {addComment.isPending ? 'Posting...' : 'Post Comment'}
          </button>
          <span style={{ fontSize:10, color:'#aaa', marginLeft:8 }}>Ctrl+Enter</span>
        </div>

      </div>
    </div>
  )
}

// ── Task form (create / edit) ────────────────────────────────
function TaskForm({ task, users, onClose, onSaved }) {
  const isEdit = !!task
  const [form, setForm] = useState(task ? {
    title:         task.title,
    description:   task.description  || '',
    category:      task.category     || '',
    priority:      task.priority,
    status:        task.status,
    assigned_to:   task.assigned_to  || '',
    due_date:      task.due_date?.slice(0,10) || '',
    notes:         task.notes        || '',
    is_recurring:  task.is_recurring,
    recur_freq:    task.recur_freq   || 'daily',
    recur_interval:task.recur_interval|| 1,
    recur_end_date:task.recur_end_date?.slice(0,10) || '',
    recur_next_date:task.recur_next_date?.slice(0,10) || '',
  } : { ...EMPTY })

  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const saveMut = useMutation({
    mutationFn: () => isEdit ? taskApi.update(task.id, form) : taskApi.create(form),
    onSuccess: (r) => { toast.success(isEdit ? 'Task updated' : 'Task created'); onSaved(r.data.data) },
  })

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'#fff', borderRadius:6, padding:24, width:560, maxHeight:'90vh', overflowY:'auto', boxShadow:'0 8px 40px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize:15, fontWeight:700, marginBottom:16, color:'#333' }}>
          {isEdit ? `Edit Task — ${task.task_no}` : 'New Task'}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
          <div className="field" style={{ gridColumn:'span 2' }}>
            <label>Title *</label>
            <input value={form.title} onChange={e=>F('title',e.target.value)} placeholder="Task title..." autoFocus />
          </div>

          <div className="field">
            <label>Priority</label>
            <select value={form.priority} onChange={e=>F('priority',e.target.value)}>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          <div className="field">
            <label>Status</label>
            <select value={form.status} onChange={e=>F('status',e.target.value)}>
              <option value="open">Open</option>
              <option value="in_progress">In Progress</option>
              <option value="on_hold">On Hold</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="field">
            <label>Assign To</label>
            <select value={form.assigned_to} onChange={e=>F('assigned_to',e.target.value)}>
              <option value="">— unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role})</option>)}
            </select>
          </div>

          <div className="field">
            <label>Category</label>
            <input value={form.category} onChange={e=>F('category',e.target.value)} placeholder="e.g. Maintenance, Admin..." />
          </div>

          <div className="field">
            <label>Due Date</label>
            <input type="date" value={form.due_date} onChange={e=>F('due_date',e.target.value)} />
          </div>

          <div className="field" style={{ gridColumn:'span 2' }}>
            <label>Description</label>
            <textarea value={form.description} onChange={e=>F('description',e.target.value)} rows={3} placeholder="Detailed description..." />
          </div>

          <div className="field" style={{ gridColumn:'span 2' }}>
            <label>Notes (internal)</label>
            <textarea value={form.notes} onChange={e=>F('notes',e.target.value)} rows={2} />
          </div>
        </div>

        {/* Recurring section */}
        <div style={{ border:'1px solid #e0e0e0', borderRadius:4, padding:'10px 14px', marginBottom:14 }}>
          <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', fontWeight:600, fontSize:12, marginBottom: form.is_recurring ? 10 : 0 }}>
            <input type="checkbox" checked={form.is_recurring} onChange={e=>F('is_recurring',e.target.checked)} />
            ↻ Recurring Task
          </label>

          {form.is_recurring && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
              <div className="field" style={{ margin:0 }}>
                <label>Frequency</label>
                <select value={form.recur_freq} onChange={e=>F('recur_freq',e.target.value)}>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div className="field" style={{ margin:0 }}>
                <label>Every N {form.recur_freq === 'daily' ? 'days' : form.recur_freq === 'weekly' ? 'weeks' : 'months'}</label>
                <input type="number" min={1} max={12} value={form.recur_interval} onChange={e=>F('recur_interval',parseInt(e.target.value)||1)} />
              </div>
              <div className="field" style={{ margin:0 }}>
                <label>First occurrence</label>
                <input type="date" value={form.recur_next_date} onChange={e=>F('recur_next_date',e.target.value)} />
              </div>
              <div className="field" style={{ margin:0, gridColumn:'span 3' }}>
                <label>Recur until (optional)</label>
                <input type="date" value={form.recur_end_date} onChange={e=>F('recur_end_date',e.target.value)} style={{ width:180 }} />
              </div>
              <div style={{ gridColumn:'span 3', fontSize:11, color:'#888' }}>
                An instance will be auto-spawned on each due date. The template stays active and generates the next instance automatically.
              </div>
            </div>
          )}
        </div>

        <div style={{ display:'flex', justifyContent:'flex-end', gap:8 }}>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={()=>saveMut.mutate()} disabled={!form.title || saveMut.isPending}>
            {saveMut.isPending ? 'Saving...' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Info row helper ──────────────────────────────────────────
function InfoRow({ label, value }) {
  return (
    <div>
      <div style={{ fontSize:9, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:1 }}>{label}</div>
      <div style={{ fontSize:12, color:'#333', fontWeight:500 }}>{value}</div>
    </div>
  )
}
