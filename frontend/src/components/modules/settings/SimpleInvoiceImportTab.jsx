import { useState, useRef, useEffect } from 'react'

// ── Small helpers ─────────────────────────────────────────────
const SummaryChip = ({ label, value, color = '#555', bg = '#f5f5f5' }) => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    padding: '8px 14px', background: bg, border: `1px solid ${color}25`,
    borderRadius: 4, minWidth: 80,
  }}>
    <span style={{ fontSize: 22, fontWeight: 700, color, lineHeight: 1.2 }}>{
      typeof value === 'number' ? value.toLocaleString() : value
    }</span>
    <span style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap', marginTop: 2 }}>{label}</span>
  </div>
)

const STAGE_ORDER = [
  'Categories', 'Customers & Suppliers', 'Products',
  'Invoices', 'Invoice Items', 'Customer Payments',
  'Purchases', 'Purchase Items', 'Purchase Payments',
  'Expenses', 'Post-import Fixes',
]

// ── Main component ────────────────────────────────────────────
export default function SimpleInvoiceImportTab() {
  const [file, setFile]     = useState(null)
  const [mode, setMode]     = useState('skip')
  const [status, setStatus] = useState('idle') // idle | running | done | error
  const [logs, setLogs]     = useState([])
  const [stage, setStage]   = useState(null)
  const [summary, setSummary] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const fileRef  = useRef()
  const logRef   = useRef()
  const abortRef = useRef(null)

  // Auto-scroll log to bottom
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs])

  const appendLog = (msg, level = 'info') => {
    setLogs(prev => [...prev, { msg, level, ts: new Date().toLocaleTimeString() }])
  }

  const reset = () => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
    setFile(null); setStatus('idle'); setLogs([]); setStage(null)
    setSummary(null); setErrorMsg(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const handleFile = e => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.name.toLowerCase().endsWith('.zip')) {
      appendLog('Please select a .zip file', 'error')
      return
    }
    setFile(f)
    setStatus('idle')
    setLogs([])
    setSummary(null)
    setErrorMsg(null)
  }

  const startImport = async () => {
    if (!file) return
    setStatus('running')
    setLogs([])
    setStage(null)
    setSummary(null)
    setErrorMsg(null)

    const token = localStorage.getItem('et_token')
    const formData = new FormData()
    formData.append('backup', file)
    formData.append('mode', mode)

    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/v1/admin/import-sinvoice', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`Server error ${response.status}: ${text}`)
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        // SSE format: "data: {...}\n\n"
        const parts = buf.split('\n\n')
        buf = parts.pop() // keep incomplete chunk
        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          try {
            const evt = JSON.parse(line.slice(5).trim())
            handleEvent(evt)
          } catch (_) {}
        }
      }
      // Process any remaining buffer
      if (buf.trim().startsWith('data:')) {
        try {
          const evt = JSON.parse(buf.trim().slice(5).trim())
          handleEvent(evt)
        } catch (_) {}
      }

    } catch (err) {
      if (err.name !== 'AbortError') {
        setStatus('error')
        setErrorMsg(err.message)
        appendLog(err.message, 'error')
      }
    } finally {
      abortRef.current = null
    }
  }

  const handleEvent = (evt) => {
    switch (evt.type) {
      case 'log':
        appendLog(evt.msg, evt.level || 'info')
        break
      case 'stage':
        setStage(evt.name)
        appendLog(`── ${evt.name} ──`, 'stage')
        break
      case 'done':
        setSummary(evt.summary)
        setStatus('done')
        appendLog('All done!', 'success')
        break
      case 'error':
        setErrorMsg(evt.msg)
        setStatus('error')
        appendLog(evt.msg, 'error')
        break
    }
  }

  const stageIndex = STAGE_ORDER.indexOf(stage)

  const SUMMARY_FIELDS = [
    { key: 'categories',        label: 'Categories',   color: '#555' },
    { key: 'customers',         label: 'Customers',    color: '#1565c0' },
    { key: 'products',          label: 'Products',     color: '#2e7d32' },
    { key: 'invoices',          label: 'Invoices',     color: '#6a1b9a' },
    { key: 'invoice_items',     label: 'Inv. Lines',   color: '#4527a0' },
    { key: 'payments',          label: 'Payments',     color: '#00695c' },
    { key: 'purchases',         label: 'Purchases',    color: '#e65100' },
    { key: 'purchase_items',    label: 'Purch. Lines', color: '#bf360c' },
    { key: 'purchase_payments', label: 'Pur. Pmts',   color: '#4e342e' },
    { key: 'expenses',          label: 'Expenses',     color: '#827717' },
    { key: 'stock_movements',   label: 'Stock Mvmts',  color: '#37474f' },
  ]

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: '#333' }}>
        Simple Invoice Backup Import
      </div>
      <div style={{ fontSize: 11, color: '#666', marginBottom: 16 }}>
        Upload your <code>sinvoice_bak.zip</code> to import all historical data — customers, products,
        invoices, purchases, payments and expenses — directly from Simple Invoice.
      </div>

      {status === 'idle' && (
        <>
          {/* File picker */}
          <div style={{
            border: '2px dashed #ccc', borderRadius: 6, padding: '20px 24px',
            background: file ? '#f0f7ff' : '#fafafa',
            borderColor: file ? 'var(--blue)' : '#ccc',
            marginBottom: 14, cursor: 'pointer',
          }}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" accept=".zip"
              style={{ display: 'none' }} onChange={handleFile} />
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📦</div>
              {file ? (
                <>
                  <div style={{ fontWeight: 700, color: 'var(--blue)', fontSize: 13 }}>{file.name}</div>
                  <div style={{ color: '#888', fontSize: 11, marginTop: 2 }}>
                    {(file.size / 1024 / 1024).toFixed(1)} MB — click to change
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontWeight: 600, color: '#555', fontSize: 13 }}>
                    Click to select sinvoice_bak.zip
                  </div>
                  <div style={{ color: '#999', fontSize: 11, marginTop: 2 }}>
                    ZIP file containing Simple Invoice XML backup (up to 200 MB)
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Mode selector */}
          <div className="field" style={{ marginBottom: 14 }}>
            <label>If records already exist in the database</label>
            <select value={mode} onChange={e => setMode(e.target.value)}>
              <option value="skip">
                Skip — keep existing records, only import new ones
              </option>
              <option value="replace">
                Replace — clear invoices, purchases and expenses, re-import everything
              </option>
            </select>
          </div>

          {mode === 'replace' && (
            <div style={{
              background: '#fff3e0', border: '1px solid #ffb74d', borderRadius: 4,
              padding: '8px 12px', fontSize: 11, color: '#e65100', marginBottom: 14,
            }}>
              <strong>Warning:</strong> Replace mode will permanently delete all existing invoices,
              purchases, payments and expenses before importing. Customers and products are never deleted.
            </div>
          )}

          <button
            className="btn primary"
            onClick={startImport}
            disabled={!file}
            style={{ minWidth: 160 }}
          >
            ⬆ Start Import
          </button>
        </>
      )}

      {/* Progress panel */}
      {(status === 'running' || status === 'done' || status === 'error') && (
        <div style={{ marginTop: status === 'idle' ? 20 : 0 }}>

          {/* Stage progress bar */}
          {status === 'running' && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {STAGE_ORDER.map((s, i) => {
                  const isDone    = i < stageIndex
                  const isCurrent = i === stageIndex
                  return (
                    <div key={s} style={{
                      padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600,
                      background: isDone ? '#e8f5e9' : isCurrent ? 'var(--blue)' : '#f5f5f5',
                      color: isDone ? '#2e7d32' : isCurrent ? '#fff' : '#bbb',
                      border: `1px solid ${isDone ? '#a5d6a7' : isCurrent ? 'var(--blue)' : '#e0e0e0'}`,
                      transition: 'all 0.3s',
                    }}>
                      {isDone ? '✓ ' : isCurrent ? '⏳ ' : ''}{s}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Log panel */}
          <div ref={logRef} style={{
            background: '#1a1a2e', borderRadius: 4, padding: '10px 14px',
            height: 280, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11,
            marginBottom: 14,
          }}>
            {logs.map((l, i) => (
              <div key={i} style={{
                padding: '1px 0',
                color: l.level === 'error'   ? '#ff6b6b'
                     : l.level === 'success' ? '#69db7c'
                     : l.level === 'warn'    ? '#ffa94d'
                     : l.level === 'stage'   ? '#74c0fc'
                     : '#c9d1d9',
              }}>
                <span style={{ color: '#555', marginRight: 8 }}>{l.ts}</span>
                {l.msg}
              </div>
            ))}
            {status === 'running' && (
              <div style={{ color: '#555', animation: 'pulse 1s infinite' }}>▌</div>
            )}
          </div>

          {/* Summary cards */}
          {summary && (
            <div style={{
              border: '2px solid #2e7d32', borderRadius: 4, overflow: 'hidden', marginBottom: 14,
            }}>
              <div style={{
                background: '#2e7d32', padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 13,
              }}>
                ✓ Import Complete
              </div>
              <div style={{ padding: 14 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {SUMMARY_FIELDS.map(f => (
                    <SummaryChip key={f.key}
                      label={f.label}
                      value={summary[f.key] ?? 0}
                      color={f.color}
                      bg={`${f.color}10`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error banner */}
          {status === 'error' && errorMsg && (
            <div style={{
              background: '#ffebee', border: '1px solid #ef9a9a', borderRadius: 4,
              padding: '8px 14px', color: '#c62828', fontSize: 12, marginBottom: 14,
            }}>
              <strong>Import failed:</strong> {errorMsg}
            </div>
          )}

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8 }}>
            {status === 'running' && (
              <button className="btn danger" onClick={() => {
                if (abortRef.current) abortRef.current.abort()
                setStatus('error')
                setErrorMsg('Import cancelled by user')
                appendLog('Import cancelled by user', 'error')
              }}>
                ✕ Cancel
              </button>
            )}
            {(status === 'done' || status === 'error') && (
              <button className="btn" onClick={reset}>
                ← Import another file
              </button>
            )}
            {status === 'done' && (
              <button className="btn primary" onClick={() => window.location.reload()}>
                ↺ Reload app to see data
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
