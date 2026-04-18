import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { backupApi } from '../../../services/api'
import toast from 'react-hot-toast'

const fmtSize = bytes => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1048576) return `${(bytes/1024).toFixed(1)} KB`
  return `${(bytes/1048576).toFixed(1)} MB`
}

export default function BackupTab() {
  const qc = useQueryClient()
  const [restoreTarget, setRestoreTarget] = useState(null)
  const [restoreConfirm, setRestoreConfirm] = useState('')

  const { data: listData, isLoading } = useQuery({
    queryKey: ['backup-list'],
    queryFn: () => backupApi.list().then(r => r.data.data),
    refetchInterval: false,
  })

  const { data: scheduleData } = useQuery({
    queryKey: ['backup-schedule'],
    queryFn: () => backupApi.getSchedule().then(r => r.data.data),
  })

  const [sched, setSched] = useState(null)
  const cfg = sched || scheduleData || { enabled: false, frequency: 'daily', time: '02:00', type: 'full', keep: 7 }
  const S = (k, v) => setSched(c => ({ ...(c || scheduleData || {}), [k]: v }))

  const createMut = useMutation({
    mutationFn: (type) => backupApi.create(type),
    onSuccess: (r) => {
      toast.success(`Backup created: ${r.data.data.filename}`)
      qc.invalidateQueries(['backup-list'])
    },
  })

  const deleteMut = useMutation({
    mutationFn: (filename) => backupApi.delete(filename),
    onSuccess: () => { toast.success('Backup deleted'); qc.invalidateQueries(['backup-list']) },
  })

  const restoreMut = useMutation({
    mutationFn: (filename) => backupApi.restore(filename),
    onSuccess: (_, filename) => {
      toast.success(`Restored from ${filename}`)
      setRestoreTarget(null)
      setRestoreConfirm('')
      qc.invalidateQueries()
    },
    onError: () => { setRestoreTarget(null); setRestoreConfirm('') },
  })

  const scheduleMut = useMutation({
    mutationFn: (data) => backupApi.saveSchedule(data),
    onSuccess: () => { toast.success('Schedule saved'); qc.invalidateQueries(['backup-schedule']) },
  })

  const backups = listData || []

  return (
    <div style={{ maxWidth: 860 }}>

      {/* ── Create backup ── */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10, color: '#333' }}>Create Backup</div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
        <button className="btn primary" onClick={() => createMut.mutate('full')} disabled={createMut.isPending}>
          {createMut.isPending && createMut.variables === 'full' ? '⏳ Creating...' : '+ Full Backup'}
        </button>
        <button className="btn" onClick={() => createMut.mutate('partial')} disabled={createMut.isPending}>
          {createMut.isPending && createMut.variables === 'partial' ? '⏳ Creating...' : '+ Partial Backup'}
        </button>
        <div style={{ fontSize: 11, color: '#888', alignSelf: 'center', lineHeight: 1.4 }}>
          <strong>Full:</strong> all tables &nbsp;|&nbsp; <strong>Partial:</strong> business data only (no users/auth)
        </div>
      </div>

      {/* ── Backup list ── */}
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, color: '#333' }}>
        Backups
        <button className="btn" onClick={() => qc.invalidateQueries(['backup-list'])}
          style={{ marginLeft: 10, fontSize: 11, padding: '2px 8px' }}>Refresh</button>
      </div>

      {isLoading ? (
        <div style={{ color: '#888', fontSize: 13 }}>Loading...</div>
      ) : backups.length === 0 ? (
        <div style={{ color: '#aaa', fontSize: 13, padding: '20px 0' }}>No backups yet. Create one above.</div>
      ) : (
        <table className="data-table" style={{ marginBottom: 20, fontSize: 12 }}>
          <thead>
            <tr>
              <th>Filename</th>
              <th>Type</th>
              <th>Trigger</th>
              <th>Size</th>
              <th>Created</th>
              <th style={{ width: 160 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {backups.map(b => (
              <tr key={b.filename}>
                <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{b.filename}</td>
                <td>
                  <span style={{
                    padding: '1px 7px', borderRadius: 10, fontSize: 11,
                    background: b.type === 'full' ? 'var(--blue-light)' : '#fff8e1',
                    color: b.type === 'full' ? 'var(--blue)' : '#7b5800',
                  }}>{b.type}</span>
                </td>
                <td>
                  <span style={{
                    padding: '1px 7px', borderRadius: 10, fontSize: 11,
                    background: b.trigger === 'auto' ? '#e8f5e9' : '#f3e5f5',
                    color: b.trigger === 'auto' ? '#2e7d32' : '#6a1b9a',
                  }}>{b.trigger}</span>
                </td>
                <td style={{ color: '#555' }}>{fmtSize(b.size)}</td>
                <td style={{ color: '#555' }}>{new Date(b.created).toLocaleString()}</td>
                <td>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <a
                      href={backupApi.download(b.filename)}
                      download={b.filename}
                      className="btn"
                      style={{ fontSize: 11, padding: '2px 8px', textDecoration: 'none', display: 'inline-block' }}
                    >Download</a>
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '2px 8px', background: '#fff3e0', color: '#e65100', border: '1px solid #ffcc80' }}
                      onClick={() => { setRestoreTarget(b.filename); setRestoreConfirm('') }}
                    >Restore</button>
                    <button
                      className="btn"
                      style={{ fontSize: 11, padding: '2px 8px', background: '#fbe9e7', color: '#c62828', border: '1px solid #ffab91' }}
                      onClick={() => { if (window.confirm(`Delete ${b.filename}?`)) deleteMut.mutate(b.filename) }}
                    >Del</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Restore confirmation modal ── */}
      {restoreTarget && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ background: '#fff', borderRadius: 6, padding: 24, maxWidth: 440, width: '90%' }}>
            <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: '#c62828' }}>Restore Database</div>
            <div style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 12 }}>
              This will run <code style={{ background: '#f5f5f5', padding: '1px 5px', borderRadius: 3 }}>psql</code> against your live database using:<br />
              <strong style={{ fontFamily: 'monospace', fontSize: 11 }}>{restoreTarget}</strong>
              <br /><br />
              Existing data may be overwritten or duplicated. It is recommended to <strong>take a full backup first</strong> before restoring.
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 6, color: '#555' }}>
              Type <code style={{ background: '#f0f0f0', padding: '1px 5px', borderRadius: 3, letterSpacing: 1 }}>RESTORE</code> to confirm:
            </div>
            <input
              value={restoreConfirm}
              onChange={e => setRestoreConfirm(e.target.value)}
              placeholder="Type RESTORE"
              style={{
                width: '100%', padding: '6px 10px', marginBottom: 12,
                border: `2px solid ${restoreConfirm === 'RESTORE' ? '#c62828' : '#d0d0d0'}`,
                borderRadius: 3, fontSize: 13, fontFamily: 'monospace', letterSpacing: 2, boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn" onClick={() => { setRestoreTarget(null); setRestoreConfirm('') }}>Cancel</button>
              <button
                className="btn"
                onClick={() => restoreMut.mutate(restoreTarget)}
                disabled={restoreConfirm !== 'RESTORE' || restoreMut.isPending}
                style={{
                  background: restoreConfirm === 'RESTORE' ? '#c62828' : '#e0e0e0',
                  color: restoreConfirm === 'RESTORE' ? '#fff' : '#aaa',
                  fontWeight: 700, border: 'none',
                }}
              >
                {restoreMut.isPending ? '⏳ Restoring...' : 'Restore Now'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Scheduled backups ── */}
      <div style={{ borderTop: '1px solid #e0e0e0', paddingTop: 16, marginTop: 4 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#333' }}>Scheduled Backups</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, auto)', gap: 12, alignItems: 'end', flexWrap: 'wrap', marginBottom: 14 }}>

          <div className="field" style={{ margin: 0 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input type="checkbox" checked={cfg.enabled} onChange={e => S('enabled', e.target.checked)} />
              Enable Auto Backup
            </label>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Frequency</label>
            <select value={cfg.frequency} onChange={e => S('frequency', e.target.value)} disabled={!cfg.enabled}>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Time (24h)</label>
            <input type="time" value={cfg.time} onChange={e => S('time', e.target.value)} disabled={!cfg.enabled} style={{ width: 110 }} />
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Backup Type</label>
            <select value={cfg.type} onChange={e => S('type', e.target.value)} disabled={!cfg.enabled}>
              <option value="full">Full</option>
              <option value="partial">Partial</option>
            </select>
          </div>

          <div className="field" style={{ margin: 0 }}>
            <label>Keep (count)</label>
            <input type="number" min={1} max={30} value={cfg.keep} onChange={e => S('keep', parseInt(e.target.value) || 7)} disabled={!cfg.enabled} style={{ width: 70 }} />
          </div>

        </div>

        {cfg.enabled && (
          <div style={{ fontSize: 11, color: '#888', marginBottom: 12 }}>
            Next run: {cfg.frequency} at {cfg.time} — keeps latest {cfg.keep} auto backups
          </div>
        )}

        <button
          className="btn primary"
          onClick={() => scheduleMut.mutate(cfg)}
          disabled={scheduleMut.isPending}
        >
          {scheduleMut.isPending ? 'Saving...' : 'Save Schedule'}
        </button>
      </div>

    </div>
  )
}
