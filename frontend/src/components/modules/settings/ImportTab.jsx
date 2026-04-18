import { useState, useRef } from 'react'
import { useMutation } from '@tanstack/react-query'
import { importApi } from '../../../services/api'
import toast from 'react-hot-toast'

const TYPES = [
  { id: 'products',  label: 'Products',  icon: '📦',
    hint: 'Semicolon-delimited CSV. Expected columns: code, name, category, units, price, price2, price3, price4, cost, taxrate, stock, description' },
  { id: 'customers', label: 'Customers', icon: '👥',
    hint: 'Semicolon-delimited CSV. Expected columns: name, phone, mobile, email, address, town, country, tax_number' },
]
const CUST_TYPES = ['wholesale', 'retail', 'contractor', 'government']

// ── small helpers ─────────────────────────────────────────────
const Chip = ({ label, value, color = '#555', bg = '#f0f0f0', onClick }) => (
  <div onClick={onClick} style={{
    display: 'inline-flex', flexDirection: 'column', alignItems: 'center',
    padding: '6px 14px', background: bg, border: `1px solid ${color}20`,
    borderRadius: 4, minWidth: 72, cursor: onClick ? 'pointer' : 'default',
  }}>
    <span style={{ fontSize: 20, fontWeight: 700, color }}>{value}</span>
    <span style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{label}</span>
  </div>
)

const Section = ({ title, color = '#555', count, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ border: `1px solid ${color}30`, borderRadius: 3, marginBottom: 8, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px',
        background: `${color}10`, cursor: 'pointer', userSelect: 'none',
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color, flex: 1 }}>{title}</span>
        {count != null && <span style={{ fontSize: 11, background: color, color: '#fff', borderRadius: 10, padding: '0 7px' }}>{count}</span>}
        <span style={{ fontSize: 10, color }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '8px 12px', fontSize: 11 }}>{children}</div>}
    </div>
  )
}

// ── Customer audit panel ──────────────────────────────────────
function CustomerAudit({ preview }) {
  const {
    total, valid_count, excluded_count,
    excluded_sample = [], duplicates = [], near_duplicates = [], warnings = [],
  } = preview

  const issueCount = (duplicates.length > 0 ? 1 : 0) +
                     (near_duplicates.length > 0 ? 1 : 0) +
                     warnings.length

  return (
    <div>
      {/* Summary chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip label="Total rows"       value={total}         color="#555"    bg="#f5f5f5" />
        <Chip label="Will be imported" value={valid_count}   color="#2e7d32" bg="#e8f5e9" />
        <Chip label="Will be excluded" value={excluded_count} color={excluded_count > 0 ? '#c62828' : '#888'} bg={excluded_count > 0 ? '#ffebee' : '#f5f5f5'} />
        <Chip label="Issues found"     value={issueCount}    color={issueCount > 0 ? '#e65100' : '#888'} bg={issueCount > 0 ? '#fff3e0' : '#f5f5f5'} />
      </div>

      {/* Excluded rows */}
      {excluded_count > 0 && (
        <Section title={`Excluded rows — address fragments, noise & garbage (${excluded_count} rows will NOT be imported)`}
          color="#c62828" count={excluded_count} defaultOpen={excluded_count > 0}>
          <div style={{ color: '#666', marginBottom: 6 }}>
            These rows have been automatically detected as multiline address fragments or noise from your source software's export.
            They will be silently skipped during import.
          </div>
          <div style={{ maxHeight: 200, overflowY: 'auto', background: '#fff8f8', border: '1px solid #ffcdd2', borderRadius: 3, padding: '4px 8px' }}>
            {excluded_sample.map((ex, i) => (
              <div key={i} style={{ padding: '3px 0', borderBottom: '1px solid #ffecec', display: 'flex', gap: 10 }}>
                <span style={{ color: '#c62828', fontFamily: 'monospace', flex: '0 0 220px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ex.name}
                </span>
                <span style={{ color: '#888' }}>{ex.reason}</span>
              </div>
            ))}
            {excluded_count > excluded_sample.length && (
              <div style={{ padding: '4px 0', color: '#888', fontStyle: 'italic' }}>
                … and {excluded_count - excluded_sample.length} more (all will be excluded)
              </div>
            )}
          </div>
        </Section>
      )}

      {/* Exact duplicates */}
      {duplicates.length > 0 && (
        <Section title="Duplicate customer names" color="#e65100" count={duplicates.length}>
          <div style={{ color: '#666', marginBottom: 6 }}>
            These names appear more than once after filtering. On import, duplicates are handled by your selected mode (skip or update).
          </div>
          {duplicates.map((d, i) => (
            <div key={i} style={{ fontFamily: 'monospace', fontSize: 11, padding: '2px 0', color: '#333' }}>
              {d.names.join(' ↔ ')}
            </div>
          ))}
        </Section>
      )}

      {/* Near-duplicates */}
      {near_duplicates.length > 0 && (
        <Section title="Possible near-duplicates (same company, slightly different name)" color="#1565c0" count={near_duplicates.length}>
          <div style={{ color: '#666', marginBottom: 6 }}>
            Review these before import — they may be the same company recorded with different name formats.
            Both will be imported as separate customers unless you merge them in the CSV first.
          </div>
          {near_duplicates.map((group, i) => (
            <div key={i} style={{ marginBottom: 4, background: 'var(--blue-light)', borderRadius: 3, padding: '4px 8px' }}>
              {group.map((n, j) => (
                <div key={j} style={{ fontFamily: 'monospace', fontSize: 11, color: '#333' }}>{n}</div>
              ))}
            </div>
          ))}
        </Section>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <Section title="Data quality warnings" color="#f57f17" count={warnings.length} defaultOpen>
          {warnings.map((w, i) => (
            <div key={i} style={{ padding: '3px 0', color: '#5d4037' }}>⚠ {w}</div>
          ))}
        </Section>
      )}

      {excluded_count === 0 && duplicates.length === 0 && near_duplicates.length === 0 && warnings.length === 0 && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 3, padding: '8px 12px', color: '#2e7d32', fontWeight: 600 }}>
          ✓ No issues detected — data looks clean
        </div>
      )}
    </div>
  )
}

// ── Product audit panel ───────────────────────────────────────
function ProductAudit({ preview }) {
  const { total, valid_count, issues = {} } = preview
  const {
    no_sku = 0, zero_price = 0, neg_stock = 0,
    dup_skus = [], unmappable_units = [], cat_typos = [],
  } = issues

  const totalIssues = (no_sku > 0 ? 1 : 0) + (zero_price > 0 ? 1 : 0) +
    (dup_skus.length > 0 ? 1 : 0) + (unmappable_units.length > 0 ? 1 : 0) +
    (cat_typos.length > 0 ? 1 : 0)

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <Chip label="Total rows"       value={total}        color="#555"    bg="#f5f5f5" />
        <Chip label="Will be imported" value={valid_count}  color="#2e7d32" bg="#e8f5e9" />
        <Chip label="Skipped (no SKU)" value={no_sku}       color={no_sku > 0 ? '#c62828' : '#888'} bg={no_sku > 0 ? '#ffebee' : '#f5f5f5'} />
        <Chip label="Zero price"       value={zero_price}   color={zero_price > 100 ? '#e65100' : '#888'} bg={zero_price > 100 ? '#fff3e0' : '#f5f5f5'} />
        <Chip label="Negative stock→0" value={neg_stock}    color={neg_stock > 0 ? '#1565c0' : '#888'} bg={neg_stock > 0 ? '#e3f2fd' : '#f5f5f5'} />
        <Chip label="Issues"           value={totalIssues}  color={totalIssues > 0 ? '#e65100' : '#888'} bg={totalIssues > 0 ? '#fff3e0' : '#f5f5f5'} />
      </div>

      {no_sku > 0 && (
        <Section title={`${no_sku} products have no SKU code — they will be skipped`} color="#c62828" count={no_sku} defaultOpen>
          <div style={{ color: '#666' }}>
            Assign SKU codes to these products in your CSV before importing, or they will be excluded.
          </div>
        </Section>
      )}

      {dup_skus.length > 0 && (
        <Section title="Duplicate SKU codes" color="#c62828" count={dup_skus.length} defaultOpen>
          <div style={{ color: '#666', marginBottom: 6 }}>
            These SKU codes appear more than once. On import the second occurrence will be skipped (skip mode) or will overwrite (update mode). Review and fix in the CSV.
          </div>
          {dup_skus.map((d, i) => (
            <div key={i} style={{ fontFamily: 'monospace', padding: '2px 0', color: '#c62828' }}>
              {d.sku} × {d.count}
            </div>
          ))}
        </Section>
      )}

      {cat_typos.length > 0 && (
        <Section title="Category name typos — will be created misspelled in the database" color="#e65100" count={cat_typos.length} defaultOpen>
          <div style={{ color: '#666', marginBottom: 6 }}>
            Recommend fixing these in the CSV before importing to avoid creating misspelled categories.
          </div>
          {cat_typos.map((t, i) => (
            <div key={i} style={{ padding: '2px 0', fontFamily: 'monospace' }}>
              <span style={{ color: '#c62828' }}>{t.cat}</span>
              <span style={{ color: '#888', margin: '0 8px' }}>→</span>
              <span style={{ color: '#2e7d32' }}>{t.suggestion}</span>
            </div>
          ))}
        </Section>
      )}

      {unmappable_units.length > 0 && (
        <Section title="Unrecognised unit values — will default to 'pcs'" color="#e65100" count={unmappable_units.length}>
          <div style={{ color: '#666', marginBottom: 6 }}>
            These unit values are not in the normalisation map and will be imported as <strong>pcs</strong>. Fix in CSV or update after import.
          </div>
          {unmappable_units.map((u, i) => (
            <div key={i} style={{ padding: '2px 0', fontFamily: 'monospace', fontSize: 11, color: '#555' }}>
              <span style={{ color: '#e65100', minWidth: 120, display: 'inline-block' }}>{u.sku}</span>
              <span style={{ color: '#c62828', minWidth: 80, display: 'inline-block' }}>[{u.unit}]</span>
              {u.name}
            </div>
          ))}
        </Section>
      )}

      {zero_price > 0 && (
        <Section title={`${zero_price} products have no selling price — will import with price = 0`} color="#f57f17" count={zero_price}>
          <div style={{ color: '#5d4037' }}>
            These will be imported successfully but you won't be able to invoice them until prices are set. You can update prices in the Products module after import.
          </div>
        </Section>
      )}

      {neg_stock > 0 && (
        <Section title={`${neg_stock} products have negative stock — will be imported as 0`} color="#1565c0" count={neg_stock}>
          <div style={{ color: '#333' }}>
            Your old system allowed stock to go negative (overselling without tracking). These will be imported with stock_qty = 0. No action needed.
          </div>
        </Section>
      )}

      {totalIssues === 0 && no_sku === 0 && (
        <div style={{ background: '#e8f5e9', border: '1px solid #a5d6a7', borderRadius: 3, padding: '8px 12px', color: '#2e7d32', fontWeight: 600 }}>
          ✓ No critical issues detected
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────
export default function ImportTab() {
  const [type, setType]         = useState('products')
  const [csv, setCsv]           = useState('')
  const [mode, setMode]         = useState('skip')
  const [defaultType, setDType] = useState('wholesale')
  const [preview, setPreview]   = useState(null)
  const [result, setResult]     = useState(null)
  const fileRef = useRef()

  const currentType = TYPES.find(t => t.id === type)

  const handleFile = e => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => { setCsv(ev.target.result); setPreview(null); setResult(null) }
    reader.readAsText(file, 'utf-8')
  }

  const previewMut = useMutation({
    mutationFn: () => importApi.preview({ csv, type }),
    onSuccess: r => { setPreview(r.data.data); setResult(null) },
  })

  const importMut = useMutation({
    mutationFn: () => {
      const payload = { csv, mode }
      if (type === 'customers') payload.default_type = defaultType
      return importApi[type](payload)
    },
    onSuccess: r => {
      setResult(r.data.data)
      const d = r.data.data
      const parts = [`${d.inserted} inserted`, `${d.updated} updated`, `${d.skipped} skipped`]
      if (d.excluded != null) parts.push(`${d.excluded} excluded`)
      toast.success(`Done — ${parts.join(', ')}`)
    },
  })

  const reset = () => {
    setCsv(''); setPreview(null); setResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  const hasIssues = preview && type === 'customers' && (
    (preview.excluded_count > 0) ||
    (preview.duplicates?.length > 0) ||
    (preview.near_duplicates?.length > 0)
  )

  return (
    <div style={{ maxWidth: 900 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: '#333' }}>CSV Data Import</div>

      {/* Type selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {TYPES.map(t => (
          <div key={t.id} onClick={() => { setType(t.id); reset() }} style={{
            padding: '8px 18px', borderRadius: 3, cursor: 'pointer', fontSize: 13, fontWeight: 600,
            border: `2px solid ${type === t.id ? 'var(--blue)' : '#d0d0d0'}`,
            background: type === t.id ? 'var(--blue-light)' : '#fafafa',
            color: type === t.id ? 'var(--blue)' : '#555',
          }}>
            {t.icon} {t.label}
          </div>
        ))}
      </div>

      {/* Format hint */}
      <div style={{ background: '#f8f9fa', border: '1px solid #e0e0e0', borderRadius: 3, padding: '7px 12px', fontSize: 11, color: '#555', marginBottom: 12 }}>
        <strong>Format:</strong> {currentType.hint}
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="field" style={{ margin: 0, flex: '2 1 300px' }}>
          <label>If record already exists</label>
          <select value={mode} onChange={e => setMode(e.target.value)}>
            <option value="skip">Skip — leave existing records unchanged, only insert new</option>
            <option value="update">Update — overwrite details for records that already exist</option>
          </select>
        </div>
        {type === 'customers' && (
          <div className="field" style={{ margin: 0, flex: '1 1 160px' }}>
            <label>Default customer type</label>
            <select value={defaultType} onChange={e => setDType(e.target.value)}>
              {CUST_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* File upload */}
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 600, color: '#555', display: 'block', marginBottom: 4 }}>Upload CSV file</label>
        <input ref={fileRef} type="file" accept=".csv,.txt" onChange={handleFile} style={{ fontSize: 12 }} />
      </div>

      {/* Paste */}
      <div className="field" style={{ marginBottom: 10 }}>
        <label>Or paste CSV text directly</label>
        <textarea value={csv}
          onChange={e => { setCsv(e.target.value); setPreview(null); setResult(null) }}
          placeholder={type === 'products'
            ? 'code;name;category;units;price;stock\nEL-001;Cable 2.5mm;Cables;mtr;2.500;100'
            : 'name;phone;email;address\nABC TRADING;;;Manama, Bahrain'}
          rows={5} style={{ fontFamily: 'monospace', fontSize: 11 }} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <button className="btn" onClick={() => previewMut.mutate()} disabled={!csv.trim() || previewMut.isPending}>
          {previewMut.isPending ? '⏳ Analysing...' : '🔍 Analyse & Preview'}
        </button>

        {preview && !result && (
          <button className="btn primary" onClick={() => importMut.mutate()} disabled={importMut.isPending}
            style={hasIssues ? { background: '#e65100', borderColor: '#e65100' } : {}}>
            {importMut.isPending
              ? `⏳ Importing...`
              : hasIssues
                ? `⚠ Import anyway (${preview.valid_count ?? preview.total} records)`
                : `⬆ Import ${currentType.label} (${preview.valid_count ?? preview.total} records)`}
          </button>
        )}

        {(csv || preview || result) && (
          <button className="btn" onClick={reset} style={{ marginLeft: 'auto' }}>✕ Clear</button>
        )}
      </div>

      {/* Preview / Audit panel */}
      {preview && !result && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 10, color: '#333', borderBottom: '2px solid var(--blue)', paddingBottom: 6 }}>
            Pre-import Analysis
          </div>
          {type === 'customers'
            ? <CustomerAudit preview={preview} />
            : <ProductAudit preview={preview} />
          }

          {/* Sample rows */}
          {preview.sample?.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#555', marginBottom: 4 }}>
                Sample — first {preview.sample.length} valid rows:
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table className="data-table" style={{ fontSize: 10 }}>
                  <thead>
                    <tr>{preview.header.map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {preview.sample.map((row, i) => (
                      <tr key={i}>{preview.header.map(h => <td key={h}>{row[h] || ''}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Result panel */}
      {result && (
        <div style={{
          border: `2px solid ${result.errors?.length ? '#e65100' : '#2e7d32'}`,
          borderRadius: 4, overflow: 'hidden',
        }}>
          <div style={{
            background: result.errors?.length ? '#e65100' : '#2e7d32',
            padding: '8px 14px', color: '#fff', fontWeight: 700, fontSize: 13,
          }}>
            {result.errors?.length ? '⚠ Import completed with errors' : '✓ Import successful'}
          </div>
          <div style={{ padding: 14 }}>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: result.errors?.length ? 12 : 0 }}>
              {[
                { label: 'Total rows',  value: result.total,    color: '#555' },
                { label: 'Inserted',    value: result.inserted, color: '#2e7d32' },
                { label: 'Updated',     value: result.updated,  color: '#1565c0' },
                { label: 'Skipped',     value: result.skipped,  color: '#888' },
                ...(result.excluded != null ? [{ label: 'Excluded', value: result.excluded, color: '#c62828' }] : []),
              ].map(s => (
                <div key={s.label} style={{ textAlign: 'center', minWidth: 72, padding: '6px 10px', background: '#f5f5f5', borderRadius: 3 }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: '#888' }}>{s.label}</div>
                </div>
              ))}
            </div>
            {result.errors?.length > 0 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#c62828', marginBottom: 6 }}>
                  Row errors ({result.errors.length}):
                </div>
                <div style={{ maxHeight: 160, overflowY: 'auto', background: '#fff8f8', border: '1px solid #ffcdd2', borderRadius: 3, padding: '6px 10px' }}>
                  {result.errors.map((e, i) => (
                    <div key={i} style={{ fontSize: 11, fontFamily: 'monospace', color: '#c62828', padding: '2px 0', borderBottom: '1px solid #ffecec' }}>{e}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
