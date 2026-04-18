import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { productApi, categoryApi } from '../../../services/api'
import { fmtBhd } from '../../../utils/format'
import toast from 'react-hot-toast'

const UNITS = ['pcs','mtr','box','reel','kg','set','pack','ltr','roll','mtr²','pair']

const emptyForm = {
  sku:'', name:'', brand:'', category_id:'', unit:'pcs',
  cost_price:'', price_1:'', price_2:'', vat_rate:10, stock_min:10,
  is_stock_tracked:true, is_sales_item:true, is_purchase_item:true,
}

export default function ProductPickerModal({ onSelect, onClose }) {
  const qc = useQueryClient()
  const [q, setQ]           = useState('')
  const [catId, setCatId]   = useState('')
  const [showNew, setShowNew] = useState(false)
  const [form, setForm]     = useState(emptyForm)
  const F = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data, isLoading } = useQuery({
    queryKey: ['prod-pick', q, catId],
    queryFn:  () => productApi.list({ q, category_id: catId, is_sales_item: true }).then(r => r.data.data),
  })
  const rows = data || []

  const { data: cats } = useQuery({
    queryKey: ['cats-product'],
    queryFn:  () => categoryApi.list('product').then(r => r.data.data),
  })

  const createMut = useMutation({
    mutationFn: d => productApi.create(d),
    onSuccess: (res) => {
      const newProd = res.data.data
      toast.success(`Product "${newProd.name}" created`)
      qc.invalidateQueries(['products'])
      qc.invalidateQueries(['prod-pick'])
      onSelect(newProd)
    },
  })

  const handleKey = (e) => {
    if (e.key === 'Enter' && q.length > 4) {
      const match = rows.find(p => p.barcode === q || p.sku === q)
      if (match) onSelect(match)
    }
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxHeight:'80vh' }}>
        <div className="modal-header">
          <h3>📦 {showNew ? 'New Product' : 'Select Product'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {!showNew ? (
          <>
            <div style={{ padding:'8px 12px', borderBottom:'1px solid #ddd', background:'#f8f8f8',
              display:'flex', gap:8, flexShrink:0 }}>
              <input type="text" value={q} onChange={e => setQ(e.target.value)} onKeyDown={handleKey}
                placeholder="Search by name, SKU, or scan barcode..." autoFocus
                style={{ flex:1, padding:'5px 8px', border:'1px solid #bbb', borderRadius:2, fontSize:13 }}/>
              <button className="btn primary" style={{ flexShrink:0, fontSize:11 }}
                onClick={() => { setForm({ ...emptyForm, name: q }); setShowNew(true) }}>
                ＋ New Product
              </button>
            </div>
            <div style={{ overflow:'auto', flex:1 }}>
              <table className="data-table" style={{ fontSize:12 }}>
                <thead>
                  <tr>
                    <th>SKU</th><th>Description</th><th>Brand</th><th>Unit</th>
                    <th className="right">Price 1</th><th className="right">Price 2</th><th className="right">Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && <tr className="empty-row"><td colSpan={7}>Searching...</td></tr>}
                  {!isLoading && !rows.length && (
                    <tr className="empty-row">
                      <td colSpan={7}>
                        No products found —{' '}
                        <span style={{ color:'var(--blue)', cursor:'pointer', textDecoration:'underline' }}
                          onClick={() => { setForm({ ...emptyForm, name: q }); setShowNew(true) }}>
                          + Create "{q || 'new product'}"
                        </span>
                      </td>
                    </tr>
                  )}
                  {rows.map(p => {
                    const isOut = parseFloat(p.stock_qty) <= 0
                    return (
                      <tr key={p.id} style={{ cursor:'pointer', opacity: isOut ? .5 : 1 }}
                        onClick={() => !isOut && onSelect(p)}
                        onMouseEnter={e => { if (!isOut) e.currentTarget.style.background = '#eef4fc' }}
                        onMouseLeave={e => e.currentTarget.style.background = ''}>
                        <td style={{ color:'var(--blue)', fontWeight:600 }}>{p.sku}</td>
                        <td>{p.name}</td>
                        <td style={{ color:'#888' }}>{p.brand || '—'}</td>
                        <td>{p.unit}</td>
                        <td className="right">{fmtBhd(p.price_1)}</td>
                        <td className="right">{fmtBhd(p.price_2)}</td>
                        <td className="right" style={{ fontWeight:600,
                          color: isOut ? '#c62828' : parseFloat(p.stock_qty) <= parseFloat(p.stock_min) ? '#e65100' : '#2e7d32' }}>
                          {p.stock_qty} {isOut && <span style={{ fontSize:10 }}>(Out)</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding:'6px 12px', background:'#f8f8f8', borderTop:'1px solid #ddd', fontSize:11, color:'#888' }}>
              Click a row to add. Barcode scanner: scan directly into the search box.
            </div>
          </>
        ) : (
          <div style={{ padding:12, overflow:'auto', flex:1 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 2fr 1fr', gap:8, marginBottom:8 }}>
              <div className="field">
                <label>SKU / Part No. *</label>
                <input value={form.sku} onChange={e => F('sku', e.target.value)}
                  placeholder="e.g. CBL-6MM-3C" autoFocus/>
              </div>
              <div className="field">
                <label>Product Name *</label>
                <input value={form.name} onChange={e => F('name', e.target.value)}/>
              </div>
              <div className="field">
                <label>Brand</label>
                <input value={form.brand} onChange={e => F('brand', e.target.value)} placeholder="e.g. Prysmian"/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:8, marginBottom:8 }}>
              <div className="field">
                <label>Category</label>
                <select value={form.category_id} onChange={e => F('category_id', e.target.value)}>
                  <option value="">— None —</option>
                  {(cats || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="field">
                <label>Unit</label>
                <select value={form.unit} onChange={e => F('unit', e.target.value)}>
                  {UNITS.map(u => <option key={u}>{u}</option>)}
                </select>
              </div>
              <div className="field">
                <label>VAT Rate %</label>
                <input type="number" value={form.vat_rate} onChange={e => F('vat_rate', e.target.value)}/>
              </div>
              <div className="field">
                <label>Min Stock</label>
                <input type="number" value={form.stock_min} onChange={e => F('stock_min', e.target.value)}/>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
              <div className="field">
                <label>Cost Price (BHD)</label>
                <input type="number" step="0.001" min="0" value={form.cost_price}
                  onChange={e => F('cost_price', e.target.value)} placeholder="0.000"/>
              </div>
              <div className="field">
                <label>Selling Price 1 (BHD)</label>
                <input type="number" step="0.001" min="0" value={form.price_1}
                  onChange={e => F('price_1', e.target.value)} placeholder="0.000"/>
              </div>
              <div className="field">
                <label>Selling Price 2 (BHD)</label>
                <input type="number" step="0.001" min="0" value={form.price_2}
                  onChange={e => F('price_2', e.target.value)} placeholder="0.000"/>
              </div>
            </div>
            <div style={{ display:'flex', gap:16, marginBottom:10, fontSize:12 }}>
              <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_stock_tracked} onChange={e => F('is_stock_tracked', e.target.checked)}/>
                Track Stock
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_sales_item} onChange={e => F('is_sales_item', e.target.checked)}/>
                Sales Item
              </label>
              <label style={{ display:'flex', alignItems:'center', gap:5, cursor:'pointer' }}>
                <input type="checkbox" checked={form.is_purchase_item} onChange={e => F('is_purchase_item', e.target.checked)}/>
                Purchase Item
              </label>
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button className="btn primary"
                disabled={createMut.isPending || !form.sku.trim() || !form.name.trim()}
                onClick={() => createMut.mutate(form)}>
                {createMut.isPending ? '⏳ Saving...' : '💾 Save & Add to Line'}
              </button>
              <button className="btn" onClick={() => setShowNew(false)}>← Back to Search</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
