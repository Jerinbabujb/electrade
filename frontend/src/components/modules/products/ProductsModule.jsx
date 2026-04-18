import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi, categoryApi, importApi } from '../../../services/api'
import { fmtBhd } from '../../../utils/format'
import { useUIStore } from '../../../store'
import toast from 'react-hot-toast'

// ── CSV Export ────────────────────────────────────────────────
function exportProductsCsv(rows) {
  const headers = ['code','name','category','brand','units','price','price2','price3','cost','taxrate','stock','voltage_rating','ampere_rating','wattage','description']
  const lines = [headers.join(';')]
  for (const p of rows) {
    lines.push([
      p.sku, p.name, p.category_name||'', p.brand||'', p.unit,
      p.price_1||0, p.price_2||0, p.price_3||0, p.cost_price||0,
      p.vat_rate||10, p.stock_qty||0,
      p.voltage_rating||'', p.ampere_rating||'', p.wattage||'',
      (p.description||'').replace(/;/g,','),
    ].map(v => String(v ?? '')).join(';'))
  }
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `products-export-${new Date().toISOString().split('T')[0]}.csv`
  a.click()
}

// ── Product Import Modal ──────────────────────────────────────
function ProductImportModal({ onClose, onDone }) {
  const qc = useQueryClient()
  const fileRef = useRef()
  const [csv, setCsv]       = useState('')
  const [filename, setFilename] = useState('')
  const [preview, setPreview] = useState(null)
  const [mode, setMode]     = useState('skip')   // skip | update
  const [result, setResult] = useState(null)

  const previewMut = useMutation({
    mutationFn: () => importApi.preview({ csv, type: 'products' }),
    onSuccess: r => setPreview(r.data.data),
  })

  const importMut = useMutation({
    mutationFn: () => importApi.products({ csv, mode }),
    onSuccess: r => {
      const d = r.data.data
      setResult(d)
      toast.success(`Imported: ${d.inserted} new, ${d.updated} updated, ${d.skipped} skipped`)
      qc.invalidateQueries(['products'])
    },
  })

  const handleFile = e => {
    const file = e.target.files[0]
    if (!file) return
    setFilename(file.name)
    setPreview(null); setResult(null)
    const reader = new FileReader()
    reader.onload = ev => setCsv(ev.target.result)
    reader.readAsText(file, 'utf-8')
    e.target.value = ''
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal modal-lg" style={{ maxWidth: 620 }}>
        <div className="modal-header">
          <h3>📥 Import Products from CSV</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 16 }}>
          <div style={{ background:'#fff8e1', border:'1px solid #ffe082', borderRadius:4, padding:'8px 12px', fontSize:12, marginBottom:12 }}>
            <strong>Format:</strong> Semicolon-delimited CSV. Columns: <code>code; name; category; units; price; price2; price3; cost; taxrate; stock; description</code>
          </div>

          <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
            <input ref={fileRef} type="file" accept=".csv,.txt" style={{ display:'none' }} onChange={handleFile} />
            <button className="btn" onClick={() => fileRef.current.click()}>📁 Choose CSV File</button>
            {filename && <span style={{ fontSize:12, color:'#555' }}>📄 {filename} ({Math.round(csv.length/1024)} KB, ~{csv.split('\n').length-1} rows)</span>}
          </div>

          {csv && !preview && !result && (
            <div style={{ display:'flex', gap:8, alignItems:'center', marginBottom:12 }}>
              <button className="btn primary" onClick={() => previewMut.mutate()} disabled={previewMut.isPending}>
                {previewMut.isPending ? '⏳ Analysing…' : '🔍 Preview / Analyse'}
              </button>
            </div>
          )}

          {preview && !result && (
            <div style={{ marginBottom:12 }}>
              <div style={{ display:'flex', gap:10, marginBottom:10, flexWrap:'wrap' }}>
                {[
                  ['Total rows', preview.total, '#555', '#f5f5f5'],
                  ['Will import', preview.valid_count, '#1565c0', '#e3f2fd'],
                  ['No SKU (skipped)', preview.issues?.no_sku, '#c62828', '#fdecea'],
                  ['Zero price', preview.issues?.zero_price, '#e65100', '#fff8e1'],
                  ['Dup SKUs', preview.issues?.dup_skus?.length, '#7b1fa2', '#f3e5f5'],
                ].map(([label, val, color, bg]) => val > 0 || label === 'Will import' ? (
                  <div key={label} style={{ background:bg, border:`1px solid ${color}40`, borderRadius:4, padding:'6px 12px', textAlign:'center', fontSize:12 }}>
                    <div style={{ fontSize:18, fontWeight:700, color }}>{val}</div>
                    <div style={{ fontSize:10, color:'#888' }}>{label}</div>
                  </div>
                ) : null)}
              </div>
              {preview.issues?.dup_skus?.length > 0 && (
                <div style={{ fontSize:11, color:'#7b1fa2', marginBottom:8 }}>
                  Duplicate SKUs: {preview.issues.dup_skus.slice(0,5).map(d=>`${d.sku}(×${d.count})`).join(', ')}
                </div>
              )}
              <div style={{ display:'flex', gap:10, alignItems:'center' }}>
                <label style={{ fontSize:12 }}>On duplicate SKU:</label>
                <label style={{ fontSize:12, cursor:'pointer' }}><input type="radio" value="skip" checked={mode==='skip'} onChange={()=>setMode('skip')}/> Skip (keep existing)</label>
                <label style={{ fontSize:12, cursor:'pointer' }}><input type="radio" value="update" checked={mode==='update'} onChange={()=>setMode('update')}/> Update (overwrite)</label>
              </div>
            </div>
          )}

          {result && (
            <div style={{ background:'#e8f5e9', border:'1px solid #a5d6a7', borderRadius:4, padding:12, fontSize:12 }}>
              <div style={{ fontWeight:700, marginBottom:6 }}>✅ Import Complete</div>
              <div>Inserted: <strong>{result.inserted}</strong> &nbsp;|&nbsp; Updated: <strong>{result.updated}</strong> &nbsp;|&nbsp; Skipped: <strong>{result.skipped}</strong></div>
              {result.errors?.length > 0 && (
                <div style={{ marginTop:8, color:'#c62828' }}>
                  Errors ({result.errors.length}): {result.errors.slice(0,3).join(' | ')}
                </div>
              )}
            </div>
          )}
        </div>
        <div style={{ padding:'10px 16px', borderTop:'1px solid #e0e0e0', display:'flex', gap:8 }}>
          {preview && !result && (
            <button className="btn primary" onClick={() => importMut.mutate()} disabled={importMut.isPending}>
              {importMut.isPending ? '⏳ Importing…' : `▶ Import ${preview.valid_count} Products`}
            </button>
          )}
          <button className="btn" onClick={onClose}>{result ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Barcode Scanner Modal ─────────────────────────────────────
function BarcodeScannerModal({ onClose, onProductFound }) {
  const [mode, setMode]           = useState('usb')   // 'usb' | 'camera'
  const [inputVal, setInputVal]   = useState('')
  const [result, setResult]       = useState(null)    // found product
  const [notFound, setNotFound]   = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [scanning, setScanning]   = useState(false)
  const [history, setHistory]     = useState([])      // [{barcode, product}]
  const inputRef  = useRef(null)
  const videoRef  = useRef(null)
  const streamRef = useRef(null)
  const rafRef    = useRef(null)
  const lastScan  = useRef(0)

  // Auto-focus the text input when switching to USB mode
  useEffect(() => {
    if (mode === 'usb') {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [mode])

  // Stop camera when modal closes or mode changes away from camera
  useEffect(() => {
    if (mode !== 'camera') stopCamera()
  }, [mode])

  useEffect(() => () => stopCamera(), [])

  function stopCamera() {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null }
    setScanning(false)
  }

  async function startCamera() {
    setCameraError('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanning(true)

      if (!('BarcodeDetector' in window)) {
        setCameraError('Camera scanning requires Chrome or Edge. Use USB scanner mode instead.')
        stopCamera()
        return
      }
      const detector = new window.BarcodeDetector({
        formats: ['code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_39', 'code_93', 'qr_code', 'data_matrix', 'itf']
      })

      async function tick() {
        if (!streamRef.current) return
        try {
          const barcodes = await detector.detect(videoRef.current)
          if (barcodes.length > 0) {
            const val = barcodes[0].rawValue
            const now = Date.now()
            if (now - lastScan.current > 2000) {   // debounce 2s between scans
              lastScan.current = now
              await handleBarcode(val)
            }
          }
        } catch {}
        rafRef.current = requestAnimationFrame(tick)
      }
      rafRef.current = requestAnimationFrame(tick)
    } catch (err) {
      setCameraError('Camera access denied. Check browser permissions.')
    }
  }

  async function handleBarcode(raw) {
    const barcode = raw.trim()
    if (!barcode) return
    setInputVal(barcode)
    setNotFound(false)
    setResult(null)
    try {
      const res = await productApi.lookup({ barcode })
      const product = res.data.data
      setResult(product)
      setHistory(prev => [{ barcode, product }, ...prev.slice(0, 9)])
      toast.success(`Found: ${product.name}`, { duration: 2000 })
    } catch (err) {
      if (err.response?.status === 404) {
        // Try by SKU as fallback
        try {
          const res2 = await productApi.lookup({ sku: barcode })
          const product = res2.data.data
          setResult(product)
          setHistory(prev => [{ barcode, product }, ...prev.slice(0, 9)])
          toast.success(`Found: ${product.name}`, { duration: 2000 })
          return
        } catch {}
        setNotFound(true)
        setHistory(prev => [{ barcode, product: null }, ...prev.slice(0, 9)])
      }
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleBarcode(inputVal)
    }
  }

  const brand = '#1a5fa8'

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ width: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div className="modal-header" style={{ background: brand, color: '#fff', borderRadius: '4px 4px 0 0' }}>
          <h3 style={{ margin: 0, fontSize: 15 }}>📷 Barcode Scanner</h3>
          <button className="close-btn" onClick={onClose} style={{ color: '#fff' }}>✕</button>
        </div>

        {/* Mode tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid #e0e0e0', background: '#f5f5f5' }}>
          {[['usb', '🔌 USB / Manual'], ['camera', '📷 Camera']].map(([m, label]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ flex: 1, padding: '8px 0', border: 'none', borderBottom: mode === m ? `3px solid ${brand}` : '3px solid transparent',
                background: mode === m ? '#fff' : 'transparent', fontWeight: mode === m ? 700 : 400,
                color: mode === m ? brand : '#666', cursor: 'pointer', fontSize: 12 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 16 }}>

          {/* USB / Manual mode */}
          {mode === 'usb' && (
            <div>
              <div style={{ fontSize: 12, color: '#555', marginBottom: 10, background: '#fffde7', padding: '8px 10px', borderRadius: 4, border: '1px solid #fff176' }}>
                💡 Point your USB barcode scanner at this window and scan, or type the barcode manually and press <strong>Enter</strong>.
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input ref={inputRef} value={inputVal}
                  onChange={e => { setInputVal(e.target.value); setNotFound(false); setResult(null) }}
                  onKeyDown={onKeyDown}
                  placeholder="Scan barcode or enter manually…"
                  style={{ flex: 1, height: 36, padding: '0 10px', border: `2px solid ${brand}`, borderRadius: 4, fontSize: 14, fontFamily: 'monospace', letterSpacing: 1 }}
                  autoComplete="off"
                />
                <button className="btn primary" onClick={() => handleBarcode(inputVal)}
                  style={{ height: 36, background: brand }}>
                  Look up
                </button>
                <button className="btn" onClick={() => { setInputVal(''); setResult(null); setNotFound(false); inputRef.current?.focus() }}
                  style={{ height: 36 }}>
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Camera mode */}
          {mode === 'camera' && (
            <div>
              <div style={{ position: 'relative', background: '#000', borderRadius: 6, overflow: 'hidden', marginBottom: 10 }}>
                <video ref={videoRef} style={{ width: '100%', maxHeight: 260, display: 'block' }} muted playsInline />
                {scanning && (
                  <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                    width: 200, height: 80, border: '2px solid #4caf50', borderRadius: 4, pointerEvents: 'none' }}>
                    <div style={{ position: 'absolute', top: -1, left: -1, width: 20, height: 20, borderTop: '4px solid #4caf50', borderLeft: '4px solid #4caf50' }}/>
                    <div style={{ position: 'absolute', top: -1, right: -1, width: 20, height: 20, borderTop: '4px solid #4caf50', borderRight: '4px solid #4caf50' }}/>
                    <div style={{ position: 'absolute', bottom: -1, left: -1, width: 20, height: 20, borderBottom: '4px solid #4caf50', borderLeft: '4px solid #4caf50' }}/>
                    <div style={{ position: 'absolute', bottom: -1, right: -1, width: 20, height: 20, borderBottom: '4px solid #4caf50', borderRight: '4px solid #4caf50' }}/>
                  </div>
                )}
                {!scanning && (
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
                    <div style={{ fontSize: 28 }}>📷</div>
                    <button className="btn primary" onClick={startCamera} style={{ background: brand }}>
                      Start Camera
                    </button>
                  </div>
                )}
              </div>
              {cameraError && (
                <div style={{ background: '#fdecea', border: '1px solid #ef9a9a', borderRadius: 4, padding: '8px 12px', fontSize: 12, color: '#c62828', marginBottom: 10 }}>
                  ⚠ {cameraError}
                </div>
              )}
              {scanning && (
                <div style={{ textAlign: 'center', fontSize: 12, color: '#2e7d32', marginBottom: 10 }}>
                  🟢 Camera active — point barcode at the green frame above
                  <button className="btn" onClick={stopCamera} style={{ marginLeft: 10, height: 26, fontSize: 11 }}>Stop</button>
                </div>
              )}
            </div>
          )}

          {/* Result card */}
          {result && (
            <div style={{ marginTop: 12, background: '#e8f5e9', border: '2px solid #4caf50', borderRadius: 6, padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 18 }}>✅</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{result.name}</div>
                  <div style={{ fontSize: 11, color: '#555' }}>
                    SKU: <strong>{result.sku}</strong>
                    {result.barcode ? ` · Barcode: ${result.barcode}` : ''}
                    {result.brand ? ` · ${result.brand}` : ''}
                  </div>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, fontSize: 12 }}>
                <div style={{ background: '#fff', borderRadius: 4, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ color: '#888', fontSize: 10 }}>Stock Qty</div>
                  <div style={{ fontWeight: 700, fontSize: 15,
                    color: result.stock_qty <= 0 ? '#c62828' : result.stock_qty <= result.stock_min ? '#e65100' : '#2e7d32' }}>
                    {result.stock_qty}
                  </div>
                </div>
                <div style={{ background: '#fff', borderRadius: 4, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ color: '#888', fontSize: 10 }}>Cost Price</div>
                  <div style={{ fontWeight: 700 }}>BHD {fmtBhd(result.cost_price)}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 4, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ color: '#888', fontSize: 10 }}>Price 1</div>
                  <div style={{ fontWeight: 700 }}>BHD {fmtBhd(result.price_1)}</div>
                </div>
                <div style={{ background: '#fff', borderRadius: 4, padding: '6px 8px', textAlign: 'center' }}>
                  <div style={{ color: '#888', fontSize: 10 }}>Category</div>
                  <div style={{ fontWeight: 700, fontSize: 11 }}>{result.category_name || '—'}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                <button className="btn primary" onClick={() => { onProductFound(result); onClose() }}
                  style={{ background: brand, fontSize: 12, height: 30 }}>
                  📋 Select & View in List
                </button>
                <button className="btn" onClick={() => { setResult(null); setInputVal(''); if (mode === 'usb') inputRef.current?.focus() }}
                  style={{ fontSize: 12, height: 30 }}>
                  🔄 Scan Next
                </button>
              </div>
            </div>
          )}

          {notFound && (
            <div style={{ marginTop: 12, background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 6, padding: '10px 14px', fontSize: 13 }}>
              ⚠ No product found for <strong style={{ fontFamily: 'monospace' }}>{inputVal}</strong>.
              Check the barcode or <a href="#" style={{ color: brand }} onClick={e => { e.preventDefault(); onClose() }}>add a new product</a>.
            </div>
          )}

          {/* Scan history */}
          {history.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#888', textTransform: 'uppercase', letterSpacing: '.5px', marginBottom: 6 }}>Scan History</div>
              {history.map((h, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid #f0f0f0', fontSize: 12 }}>
                  <span style={{ fontFamily: 'monospace', color: '#555', fontSize: 11, minWidth: 120 }}>{h.barcode}</span>
                  {h.product
                    ? <span style={{ color: '#2e7d32', flex: 1 }}>✓ {h.product.name} ({h.product.sku})</span>
                    : <span style={{ color: '#c62828', flex: 1 }}>✗ Not found</span>}
                  {h.product && (
                    <button className="btn" onClick={() => { onProductFound(h.product); onClose() }}
                      style={{ height: 22, fontSize: 10, padding: '0 6px' }}>Select</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Stock Count Panel ─────────────────────────────────────────
function StockCountPanel({ onClose }) {
  const qc = useQueryClient()
  const [search, setSearch]         = useState('')
  const [catFilter, setCatFilter]   = useState('')
  const [counts, setCounts]         = useState({})   // { [productId]: string }
  const [countNotes, setCountNotes] = useState(`Physical stock count — ${new Date().toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}`)
  const [onlyVariance, setOnlyVariance] = useState(false)

  const { data: allProducts, isLoading } = useQuery({
    queryKey: ['products', {}],
    queryFn:  () => productApi.list({}).then(r => r.data.data),
  })
  const { data: cats } = useQuery({
    queryKey: ['cats-product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })

  const products = useMemo(() => {
    let rows = (allProducts || []).filter(p => p.is_stock_tracked)
    if (catFilter) rows = rows.filter(p => p.category_id === catFilter)
    if (search)    rows = rows.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.sku || '').toLowerCase().includes(search.toLowerCase()))
    if (onlyVariance) rows = rows.filter(p => {
      const entered = counts[p.id]
      if (entered === '' || entered === undefined) return false
      return parseFloat(entered) !== parseFloat(p.stock_qty)
    })
    return rows
  }, [allProducts, catFilter, search, onlyVariance, counts])

  const variances = useMemo(() => (allProducts || []).filter(p => {
    const entered = counts[p.id]
    if (entered === '' || entered === undefined) return false
    return Math.abs(parseFloat(entered) - parseFloat(p.stock_qty)) >= 0.001
  }), [allProducts, counts])

  const submitMut = useMutation({
    mutationFn: () => {
      const adjustments = variances.map(p => ({
        product_id:   p.id,
        physical_qty: parseFloat(counts[p.id]),
      }))
      return productApi.stockCount({ adjustments, count_notes: countNotes })
    },
    onSuccess: r => {
      toast.success(r.data.message)
      qc.invalidateQueries(['products'])
      onClose()
    },
  })

  const setCount = (id, val) => setCounts(prev => ({ ...prev, [id]: val }))

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 14px',
        borderBottom:'2px solid var(--blue)', background:'#f0f4fb', flexShrink:0 }}>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:16, cursor:'pointer', color:'#555' }}>←</button>
        <div style={{ fontWeight:700, fontSize:14, color:'var(--blue)' }}>Physical Stock Count</div>
        <div style={{ flex:1 }}/>
        {variances.length > 0 && (
          <span style={{ fontSize:12, color:'#e65100', fontWeight:600 }}>
            {variances.length} product{variances.length !== 1 ? 's' : ''} with variance
          </span>
        )}
      </div>

      {/* Toolbar */}
      <div style={{ display:'flex', gap:8, alignItems:'center', padding:'7px 14px',
        borderBottom:'1px solid #e0e0e0', flexShrink:0, flexWrap:'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search SKU / name…"
          style={{ height:26, padding:'0 8px', border:'1px solid #ccc', borderRadius:2, fontSize:12, width:200 }}/>
        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          style={{ height:26, padding:'0 6px', border:'1px solid #ccc', borderRadius:2, fontSize:12 }}>
          <option value="">All Categories</option>
          {(cats||[]).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label style={{ display:'flex', alignItems:'center', gap:5, fontSize:12, cursor:'pointer' }}>
          <input type="checkbox" checked={onlyVariance} onChange={e => setOnlyVariance(e.target.checked)}/>
          Show variances only
        </label>
        <div style={{ flex:1 }}/>
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <label style={{ fontSize:11, color:'#555', whiteSpace:'nowrap' }}>Count Notes:</label>
          <input value={countNotes} onChange={e => setCountNotes(e.target.value)}
            style={{ height:26, padding:'0 8px', border:'1px solid #ccc', borderRadius:2, fontSize:12, width:280 }}/>
        </div>
        <button className="btn primary"
          disabled={submitMut.isPending || variances.length === 0}
          onClick={() => submitMut.mutate()}
          style={{ background: variances.length > 0 ? 'var(--blue)' : undefined }}>
          {submitMut.isPending ? '⏳ Applying…' : `✓ Apply Count (${variances.length} changes)`}
        </button>
        <button className="btn" onClick={onClose}>Cancel</button>
      </div>

      {/* Instruction */}
      <div style={{ padding:'5px 14px', background:'#fffde7', borderBottom:'1px solid #fff176',
        fontSize:11, color:'#5d4037', flexShrink:0 }}>
        Enter the <strong>actual physical count</strong> in the "Physical Qty" column for each product.
        Leave blank to skip. Only products where the count differs from system stock will be adjusted.
      </div>

      {/* Table */}
      <div style={{ flex:1, overflowY:'auto' }}>
        <table className="data-table" style={{ fontSize:12 }}>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product Name</th>
              <th>Category</th>
              <th>Unit</th>
              <th style={{ textAlign:'right' }}>System Qty</th>
              <th style={{ textAlign:'center', background:'var(--blue-light)', minWidth:130 }}>Physical Qty</th>
              <th style={{ textAlign:'right' }}>Variance</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={8} style={{ textAlign:'center', padding:20, color:'#aaa' }}>Loading…</td></tr>}
            {!isLoading && products.length === 0 && (
              <tr><td colSpan={8} style={{ textAlign:'center', padding:20, color:'#aaa' }}>No products found</td></tr>
            )}
            {products.map(p => {
              const sysQty   = parseFloat(p.stock_qty)
              const entered  = counts[p.id]
              const hasEntry = entered !== '' && entered !== undefined
              const physQty  = hasEntry ? parseFloat(entered) : null
              const variance = hasEntry ? physQty - sysQty : null
              const hasVar   = variance !== null && Math.abs(variance) >= 0.001
              const isLow    = sysQty <= parseFloat(p.stock_min)
              const isOut    = sysQty <= 0

              let rowBg = 'transparent'
              if (hasVar && variance > 0)  rowBg = '#f1f8e9'
              if (hasVar && variance < 0)  rowBg = '#fff5f5'
              if (hasEntry && !hasVar)     rowBg = '#f5f5f5'

              return (
                <tr key={p.id} style={{ background: rowBg }}>
                  <td style={{ color:'var(--blue)', fontWeight:600 }}>{p.sku}</td>
                  <td>{p.name}</td>
                  <td style={{ color:'#888', fontSize:11 }}>{p.category_name || '—'}</td>
                  <td>{p.unit}</td>
                  <td style={{ textAlign:'right', fontWeight:600,
                    color: isOut ? '#c62828' : isLow ? '#e65100' : '#333' }}>
                    {sysQty % 1 === 0 ? sysQty : parseFloat(sysQty).toFixed(3)}
                  </td>
                  <td style={{ textAlign:'center', background:'#f0f7ff', padding:'2px 6px' }}>
                    <input
                      type="number" step="1" min="0"
                      value={entered ?? ''}
                      onChange={e => setCount(p.id, e.target.value)}
                      placeholder="—"
                      style={{
                        width:90, textAlign:'right', fontSize:12,
                        border: hasVar ? '2px solid var(--blue)' : '1px solid #ccc',
                        borderRadius:2, padding:'2px 6px',
                        background: hasVar ? '#fff' : '#fafafa',
                      }}
                    />
                  </td>
                  <td style={{ textAlign:'right', fontWeight: hasVar ? 700 : 400,
                    color: variance === null ? '#ccc'
                         : !hasVar          ? '#999'
                         : variance > 0     ? '#2e7d32'
                         :                   '#c62828' }}>
                    {variance === null ? '—'
                     : !hasVar         ? '±0'
                     : variance > 0    ? `+${variance % 1 === 0 ? variance : variance.toFixed(3)}`
                     :                  `${variance % 1 === 0 ? variance : variance.toFixed(3)}`}
                  </td>
                  <td>
                    {hasVar && variance > 0 && <span style={{ fontSize:10, color:'#2e7d32', fontWeight:600 }}>↑ Surplus</span>}
                    {hasVar && variance < 0 && <span style={{ fontSize:10, color:'#c62828', fontWeight:600 }}>↓ Shortfall</span>}
                    {hasEntry && !hasVar     && <span style={{ fontSize:10, color:'#888' }}>✓ No change</span>}
                    {!hasEntry && isOut      && <span style={{ fontSize:10, color:'#c62828' }}>Out of stock</span>}
                    {!hasEntry && !isOut && isLow && <span style={{ fontSize:10, color:'#e65100' }}>Low stock</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Summary footer */}
      <div style={{ padding:'6px 14px', borderTop:'1px solid #e0e0e0', background:'#fafafa',
        fontSize:11, color:'#555', display:'flex', gap:16, flexShrink:0 }}>
        <span>Showing {products.length} of {(allProducts||[]).filter(p=>p.is_stock_tracked).length} stock-tracked products</span>
        <span>|</span>
        <span style={{ color: variances.filter(p=>parseFloat(counts[p.id])-parseFloat(p.stock_qty)>0).length>0?'#2e7d32':'#888' }}>
          ↑ Surplus: {variances.filter(p=>parseFloat(counts[p.id])-parseFloat(p.stock_qty)>0).length}
        </span>
        <span style={{ color: variances.filter(p=>parseFloat(counts[p.id])-parseFloat(p.stock_qty)<0).length>0?'#c62828':'#888' }}>
          ↓ Shortfall: {variances.filter(p=>parseFloat(counts[p.id])-parseFloat(p.stock_qty)<0).length}
        </span>
      </div>
    </div>
  )
}

// ── Category Manager Modal ────────────────────────────────────
function CategoryManager({ onClose }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data } = useQuery({ queryKey:['cats-product'], queryFn:()=>categoryApi.list('product').then(r=>r.data.data) })
  const cats = data || []

  const createMut = useMutation({
    mutationFn: () => categoryApi.create({ name: name.trim(), type: 'product' }),
    onSuccess: () => { toast.success('Category added'); qc.invalidateQueries(['cats-product']); setName('') },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })
  const deleteMut = useMutation({
    mutationFn: (id) => categoryApi.delete(id),
    onSuccess: () => { toast.success('Category deleted'); qc.invalidateQueries(['cats-product']) },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Cannot delete — may be in use'),
  })

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <h3>📂 Product Categories</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body" style={{ padding: 16 }}>
          <div style={{ display:'flex', gap:8, marginBottom:14 }}>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="New category name…"
              style={{ flex:1 }}
              onKeyDown={e=>{ if(e.key==='Enter' && name.trim()) createMut.mutate() }}
              autoFocus />
            <button className="btn primary" onClick={()=>createMut.mutate()} disabled={!name.trim()||createMut.isPending}>
              ＋ Add
            </button>
          </div>
          <div style={{ maxHeight:300, overflowY:'auto' }}>
            {cats.length === 0 && <div style={{ color:'#aaa', fontSize:12, textAlign:'center', padding:16 }}>No categories yet</div>}
            {cats.map(c => (
              <div key={c.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'6px 8px', borderBottom:'1px solid #f0f0f0' }}>
                <span style={{ fontSize:13 }}>📂 {c.name}</span>
                <button onClick={()=>{ if(window.confirm(`Delete "${c.name}"?`)) deleteMut.mutate(c.id) }}
                  style={{ background:'none', border:'none', color:'#c62828', cursor:'pointer', fontSize:13, padding:'0 4px' }}
                  title="Delete category">✕</button>
              </div>
            ))}
          </div>
        </div>
        <div style={{ padding:'10px 16px', borderTop:'1px solid #e0e0e0', textAlign:'right' }}>
          <button className="btn" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  )
}

export default function ProductsModule() {
  const qc = useQueryClient()
  const { openModal, getModal, closeModal } = useUIStore()
  const [filters, setFilters] = useState({ q:'', category_id:'', low_stock:'' })
  const [selectedId, setSelectedId] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [showStockCount, setShowStockCount] = useState(false)
  const [showScanner, setShowScanner] = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [showCatMgr, setShowCatMgr]   = useState(false)

  const { data, isLoading } = useQuery({ queryKey:['products',filters], queryFn:()=>productApi.list(filters).then(r=>r.data.data) })
  const { data: cats } = useQuery({ queryKey:['cats-product'], queryFn:()=>categoryApi.list('product').then(r=>r.data.data) })
  const rows = data || []
  const totalValue = rows.reduce((s,r)=>s+parseFloat(r.cost_price||0)*parseFloat(r.stock_qty||0),0)
  const lowCount = rows.filter(r=>parseFloat(r.stock_qty)<=parseFloat(r.stock_min)).length

  const saveMut = useMutation({
    mutationFn: (d) => editing ? productApi.update(editing.id, d) : productApi.create(d),
    onSuccess: () => { toast.success(editing?'Product updated':'Product created'); qc.invalidateQueries(['products']); setShowForm(false); setEditing(null) }
  })

  const empty = { sku:'',barcode:'',name:'',category_id:'',brand:'',unit:'pcs',cost_price:'',price_1:'',price_2:'',price_3:'',vat_rate:10,voltage_rating:'',ampere_rating:'',wattage:'',stock_min:10,is_stock_tracked:true,is_sales_item:true,is_purchase_item:true }
  const [form, setForm] = useState(empty)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const openNew = () => { setForm(empty); setEditing(null); setShowForm(true) }
  const openEdit = () => {
    const r = rows.find(x=>x.id===selectedId)
    if (!r) return
    setForm({...empty,...r}); setEditing(r); setShowForm(true)
  }

  if (showStockCount) return <StockCountPanel onClose={() => setShowStockCount(false)} />

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Products & Inventory</div>
      <div className="toolbar">
        <button className="btn primary" onClick={openNew}>＋ New Product</button>
        <button className="btn" disabled={!selectedId} onClick={openEdit}>✏️ Edit</button>
        <button className="btn" disabled={!selectedId} onClick={()=>window.open(`/api/v1/products/${selectedId}/stock-history`,'_blank')}>📋 Stock History</button>
        <button className="btn" onClick={() => setShowStockCount(true)} style={{ color:'#1565c0', fontWeight:600 }}>📦 Stock Count</button>
        <button className="btn" onClick={() => setShowScanner(true)} style={{ color:'#1a5fa8', fontWeight:600 }}>📷 Scan Barcode</button>
        <button className="btn" onClick={() => setShowImport(true)}>📥 Import CSV</button>
        <button className="btn" onClick={() => exportProductsCsv(rows)} disabled={!rows.length}>📤 Export CSV</button>
        <button className="btn" onClick={() => setShowCatMgr(true)}>📂 Categories</button>
        <div className="toolbar-sep"/>
        <select className="btn" style={{height:26,cursor:'default'}} value={filters.category_id} onChange={e=>setFilters(f=>({...f,category_id:e.target.value}))}>
          <option value="">All Categories</option>
          {(cats||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="btn" style={{height:26,cursor:'default'}} value={filters.low_stock} onChange={e=>setFilters(f=>({...f,low_stock:e.target.value}))}>
          <option value="">All Stock</option>
          <option value="true">Low Stock Only</option>
        </select>
        <div className="toolbar-search">
          <input type="text" placeholder="Search name, SKU, barcode..." value={filters.q} onChange={e=>setFilters(f=>({...f,q:e.target.value}))}/>
          <button className="btn">🔍</button>
        </div>
      </div>

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th style={{width:28}}><input type="checkbox"/></th>
            <th>SKU / Part No.</th><th>Description</th><th>Brand</th><th>Category</th>
            <th>Unit</th><th>Voltage</th>
            <th className="right">Cost BHD</th><th className="right">Price 1</th><th className="right">Price 2</th>
            <th className="right">Stock</th><th>Status</th>
          </tr></thead>
          <tbody>
            {isLoading&&<tr className="empty-row"><td colSpan={12}>Loading...</td></tr>}
            {!isLoading&&!rows.length&&<tr className="empty-row"><td colSpan={12}>No products found</td></tr>}
            {rows.map(p=>{
              const isLow = parseFloat(p.stock_qty)<=parseFloat(p.stock_min)
              const isOut = parseFloat(p.stock_qty)<=0
              return (
                <tr key={p.id} className={selectedId===p.id?'selected':''} onClick={()=>setSelectedId(p.id)} onDoubleClick={()=>{setSelectedId(p.id);openEdit()}}>
                  <td><input type="checkbox" checked={selectedId===p.id} onChange={()=>setSelectedId(p.id)}/></td>
                  <td style={{color:'var(--blue)',fontWeight:600}}>{p.sku}</td>
                  <td>{p.name}</td>
                  <td>{p.brand||'—'}</td>
                  <td>{p.category_name||'—'}</td>
                  <td>{p.unit}</td>
                  <td>{p.voltage_rating||'—'}</td>
                  <td className="right">{fmtBhd(p.cost_price)}</td>
                  <td className="right">{fmtBhd(p.price_1)}</td>
                  <td className="right">{fmtBhd(p.price_2)}</td>
                  <td className="right" style={{fontWeight:600,color:isOut?'#c62828':isLow?'#e65100':'#2e7d32'}}>{p.stock_qty}</td>
                  <td>{isOut?<span className="badge badge-overdue">Out of Stock</span>:isLow?<span className="badge badge-unpaid">Low Stock</span>:<span className="badge badge-paid">In Stock</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="status-bar">
        <span>{rows.length} products</span><span>|</span>
        <span>Stock value: <strong>BHD {fmtBhd(totalValue)}</strong></span><span>|</span>
        {lowCount>0&&<span style={{color:'#c62828'}}>⚠ {lowCount} low/out of stock</span>}
      </div>

      {showImport && (
        <ProductImportModal onClose={() => setShowImport(false)} onDone={() => setShowImport(false)} />
      )}

      {showScanner && (
        <BarcodeScannerModal
          onClose={() => setShowScanner(false)}
          onProductFound={product => {
            setSelectedId(product.id)
            // Scroll into view after a tick
            setTimeout(() => document.querySelector(`tr.selected`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 100)
          }}
        />
      )}

      {showForm&&(
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowForm(false)}>
          <div className="modal modal-lg">
            <div className="modal-header"><h3>{editing?`Edit — ${editing.sku}`:'New Product'}</h3><button className="close-btn" onClick={()=>setShowForm(false)}>✕</button></div>
            <div className="modal-toolbar">
              <button className="btn primary" onClick={()=>saveMut.mutate(form)} disabled={saveMut.isPending}>💾 {saveMut.isPending?'Saving...':'Save'}</button>
              <button className="btn" onClick={()=>setShowForm(false)}>✕ Cancel</button>
            </div>
            <div className="modal-body" style={{padding:12}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>SKU / Part No. *</label><input value={form.sku} onChange={e=>F('sku',e.target.value)} placeholder="e.g. CBL-6MM-3C"/></div>
                <div className="field"><label>Barcode</label><input value={form.barcode||''} onChange={e=>F('barcode',e.target.value)}/></div>
                <div className="field" style={{gridColumn:'span 2'}}><label>Product Name *</label><input value={form.name} onChange={e=>F('name',e.target.value)}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>Category</label>
                  <div style={{ display:'flex', gap:4 }}>
                    <select value={form.category_id||''} onChange={e=>F('category_id',e.target.value)} style={{ flex:1 }}>
                      <option value="">— None —</option>
                      {(cats||[]).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                    <button type="button" title="Manage categories" onClick={()=>setShowCatMgr(true)}
                      style={{ padding:'0 8px', background:'#f5f5f5', border:'1px solid #ccc', borderRadius:3, cursor:'pointer', fontSize:14, color:'#555', flexShrink:0 }}>
                      ＋
                    </button>
                  </div>
                </div>
                <div className="field"><label>Brand</label><input value={form.brand||''} onChange={e=>F('brand',e.target.value)}/></div>
                <div className="field"><label>Unit</label>
                  <select value={form.unit} onChange={e=>F('unit',e.target.value)}>
                    {['pcs','mtr','box','reel','kg','set','pack','ltr'].map(u=><option key={u}>{u}</option>)}
                  </select>
                </div>
                <div className="field"><label>VAT Rate %</label><input type="number" value={form.vat_rate} onChange={e=>F('vat_rate',e.target.value)}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>Voltage Rating</label><input value={form.voltage_rating||''} onChange={e=>F('voltage_rating',e.target.value)} placeholder="e.g. 240V, 415V"/></div>
                <div className="field"><label>Ampere Rating</label><input value={form.ampere_rating||''} onChange={e=>F('ampere_rating',e.target.value)} placeholder="e.g. 32A"/></div>
                <div className="field"><label>Wattage</label><input value={form.wattage||''} onChange={e=>F('wattage',e.target.value)} placeholder="e.g. 18W"/></div>
              </div>
              <div style={{background:'#e4e8ee',padding:'4px 8px',fontWeight:700,fontSize:11,marginBottom:8,textTransform:'uppercase',letterSpacing:'.3px'}}>Pricing (BHD excl. VAT)</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>Cost Price *</label><input type="number" step="0.001" value={form.cost_price} onChange={e=>F('cost_price',e.target.value)}/></div>
                <div className="field"><label>Price 1 — Retail</label><input type="number" step="0.001" value={form.price_1} onChange={e=>F('price_1',e.target.value)}/></div>
                <div className="field"><label>Price 2 — Wholesale</label><input type="number" step="0.001" value={form.price_2||''} onChange={e=>F('price_2',e.target.value)}/></div>
                <div className="field"><label>Price 3 — Contractor</label><input type="number" step="0.001" value={form.price_3||''} onChange={e=>F('price_3',e.target.value)}/></div>
              </div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:10}}>
                <div className="field"><label>Low Stock Alert (min qty)</label><input type="number" value={form.stock_min} onChange={e=>F('stock_min',e.target.value)}/></div>
                <div className="field" style={{justifyContent:'center'}}>
                  <label>Track Stock</label>
                  <label style={{display:'flex',alignItems:'center',gap:6,marginTop:6,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!form.is_stock_tracked} onChange={e=>F('is_stock_tracked',e.target.checked)}/> Yes
                  </label>
                </div>
                <div className="field" style={{justifyContent:'center'}}>
                  <label>Sales Item</label>
                  <label style={{display:'flex',alignItems:'center',gap:6,marginTop:6,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!form.is_sales_item} onChange={e=>F('is_sales_item',e.target.checked)}/> Yes
                  </label>
                </div>
                <div className="field" style={{justifyContent:'center'}}>
                  <label>Purchase Item</label>
                  <label style={{display:'flex',alignItems:'center',gap:6,marginTop:6,cursor:'pointer'}}>
                    <input type="checkbox" checked={!!form.is_purchase_item} onChange={e=>F('is_purchase_item',e.target.checked)}/> Yes
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {showCatMgr && <CategoryManager onClose={() => { setShowCatMgr(false); qc.invalidateQueries(['cats-product']) }} />}
    </div>
  )
}
