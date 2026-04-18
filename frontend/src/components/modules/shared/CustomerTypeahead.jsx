/**
 * CustomerTypeahead
 * Inline searchable customer/supplier picker with live API search,
 * keyboard navigation, and optional inline-create.
 *
 * Props:
 *   value        {string}   — selected customer ID
 *   displayName  {string}   — display name for the selected customer (controlled)
 *   onChange     {fn}       — called with full customer object on select
 *   onClear      {fn}       — called when user clears the selection
 *   filterType   {string}   — 'customer' | 'supplier' | '' (all) — filters API results
 *   allowCreate  {bool}     — show "+ New" option when no results (default true for customers)
 *   placeholder  {string}
 *   disabled     {bool}
 *   style        {object}   — extra styles on the wrapper
 */
import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { customerApi } from '../../../services/api'
import toast from 'react-hot-toast'

const emptyForm = {
  code:'', name:'', customer_category:'retail', vat_number:'', cr_number:'',
  tel:'', email:'', address:'', payment_terms_days:30, price_tier:1, credit_limit:0
}

export default function CustomerTypeahead({
  value        = '',
  displayName  = '',
  onChange,
  onClear,
  filterType   = 'customer',
  allowCreate  = true,
  placeholder  = 'Search customer...',
  disabled     = false,
  style        = {},
}) {
  const [inputVal, setInputVal]     = useState('')
  const [open, setOpen]             = useState(false)
  const [activeIdx, setActiveIdx]   = useState(-1)
  const [showCreate, setShowCreate] = useState(false)
  const [createForm, setCreateForm] = useState(emptyForm)

  const inputRef   = useRef(null)
  const dropRef    = useRef(null)
  const wrapRef    = useRef(null)
  const portalRef  = useRef(null)
  const qc         = useQueryClient()

  // When value is set externally (edit mode), show the display name in the input
  useEffect(() => {
    if (value && displayName) setInputVal(displayName)
    else if (!value)          setInputVal('')
  }, [value, displayName])

  // Close dropdown on outside click — but not when interacting with the portal
  useEffect(() => {
    function handler(e) {
      if (portalRef.current && portalRef.current.contains(e.target)) return
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false)
        setShowCreate(false)
        if (value && displayName) setInputVal(displayName)
        else if (!value) setInputVal('')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [value, displayName])

  const { data, isFetching } = useQuery({
    queryKey: ['typeahead-customers', inputVal, filterType],
    queryFn: () => {
      const params = { q: inputVal }
      if (filterType === 'customer') params.role = 'customer'
      if (filterType === 'supplier') params.role = 'supplier'
      return customerApi.list(params).then(r => r.data.data)
    },
    enabled: open,
    staleTime: 10000,
  })
  const results = data || []

  const createMut = useMutation({
    mutationFn: d => customerApi.create(d),
    onSuccess: (res) => {
      const c = res.data.data
      toast.success(`"${c.name}" created`)
      qc.invalidateQueries(['customers'])
      qc.invalidateQueries(['typeahead-customers'])
      pick(c)
      setShowCreate(false)
    },
    onError: e => toast.error(e.response?.data?.error?.message || 'Create failed'),
  })

  const pick = useCallback((customer) => {
    setInputVal(customer.name)
    setOpen(false)
    setActiveIdx(-1)
    onChange && onChange(customer)
  }, [onChange])

  const clear = (e) => {
    e.stopPropagation()
    setInputVal('')
    setOpen(false)
    onClear && onClear()
    inputRef.current?.focus()
  }

  const handleInputChange = (e) => {
    setInputVal(e.target.value)
    setOpen(true)
    setActiveIdx(-1)
    // If user starts typing after a selection, clear the selection
    if (value) onClear && onClear()
  }

  const handleFocus = () => {
    setOpen(true)
    if (value && displayName) {
      // Select all text so user can immediately type to replace
      inputRef.current?.select()
    }
  }

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === 'ArrowDown' || e.key === 'Enter') setOpen(true); return }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, -1))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && results[activeIdx]) pick(results[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
      if (value && displayName) setInputVal(displayName)
      else setInputVal('')
    }
  }

  const isSelected = !!value

  return (
    <div ref={wrapRef} style={{ position: 'relative', ...style }}>
      {/* Input row */}
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={inputVal}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          style={{
            width: '100%',
            padding: '4px 28px 4px 7px',
            border: `1px solid ${open ? 'var(--blue)' : 'var(--gray-border)'}`,
            borderRadius: 'var(--radius)',
            fontSize: 12,
            outline: 'none',
            background: disabled ? '#f5f5f5' : '#fff',
            boxSizing: 'border-box',
          }}
        />
        {/* Clear button */}
        {isSelected && !disabled && (
          <button
            type="button"
            onClick={clear}
            tabIndex={-1}
            style={{
              position: 'absolute', right: 5, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#999', fontSize: 13, lineHeight: 1, padding: 0,
            }}>✕</button>
        )}
        {/* Search indicator */}
        {!isSelected && (
          <span style={{
            position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
            color: '#bbb', fontSize: 11, pointerEvents: 'none',
          }}>🔍</span>
        )}
      </div>

      {/* Dropdown */}
      {open && !showCreate && (
        <div
          ref={dropRef}
          style={{
            position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 9999,
            background: '#fff', border: '1px solid #ccc',
            borderTop: 'none', borderRadius: '0 0 3px 3px',
            boxShadow: '0 4px 12px rgba(0,0,0,.15)',
            maxHeight: 260, overflowY: 'auto',
          }}
        >
          {isFetching && results.length === 0 && (
            <div style={{ padding: '8px 12px', color: '#888', fontSize: 12 }}>Searching…</div>
          )}

          {!isFetching && results.length === 0 && (
            <div style={{ padding: '8px 12px', fontSize: 12, color: '#888' }}>
              {inputVal.trim() ? `No results for "${inputVal}"` : 'Start typing to search…'}
            </div>
          )}

          {results.map((c, idx) => (
            <div
              key={c.id}
              onMouseDown={e => { e.preventDefault(); pick(c) }}
              style={{
                padding: '7px 12px',
                background: idx === activeIdx ? '#e8f0fe' : c.id === value ? '#f0f7ff' : '#fff',
                cursor: 'pointer',
                borderBottom: '1px solid #f0f0f0',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={() => setActiveIdx(idx)}
            >
              <span style={{ fontWeight: 600, color: 'var(--blue)', minWidth: 52, fontSize: 11 }}>{c.code}</span>
              <span style={{ fontWeight: 600, fontSize: 12, flex: 1 }}>{c.name}</span>
              <span style={{ fontSize: 10, color: '#888', background: '#f0f0f0', borderRadius: 8, padding: '1px 6px' }}>{c.customer_category || c.type}</span>
              {c.vat_number && <span style={{ fontSize: 10, color: '#aaa' }}>{c.vat_number}</span>}
              {c.id === value && <span style={{ fontSize: 10, color: 'var(--blue)' }}>✓</span>}
            </div>
          ))}

          {/* Always-visible New Customer button at the bottom */}
          {allowCreate && filterType !== 'supplier' && (
            <div
              onClick={() => {
                setCreateForm({ ...emptyForm, name: inputVal.trim(), customer_category: 'retail' })
                setShowCreate(true)
              }}
              style={{
                padding: '7px 12px', fontSize: 11, fontWeight: 600,
                color: 'var(--blue)', cursor: 'pointer',
                borderTop: '1px solid #e0e0e0', background: '#f0f7ff',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ＋ New Customer
              {inputVal.trim() && (
                <span style={{ fontWeight: 400, color: '#555' }}>— "{inputVal.trim()}"</span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Inline create form — rendered in a portal to escape modal overflow clipping */}
      {showCreate && createPortal(
        <div ref={portalRef} style={{
          position: 'fixed', inset: 0, zIndex: 99999,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
          onClick={e => { if (e.target === e.currentTarget) { setShowCreate(false); setOpen(false) } }}
        >
          <div style={{
            background: '#fff', border: '1px solid var(--blue)',
            borderRadius: 6, boxShadow: '0 8px 32px rgba(0,0,0,.22)',
            width: 460, padding: 16,
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--blue)', marginBottom: 12 }}>
              ＋ New {filterType === 'supplier' ? 'Supplier' : 'Customer'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr 90px', gap: 6, marginBottom: 6 }}>
              <div className="field"><label>Code</label><input value={createForm.code} onChange={e=>setCreateForm(f=>({...f,code:e.target.value}))} placeholder="Auto"/></div>
              <div className="field"><label>Name *</label><input value={createForm.name} onChange={e=>setCreateForm(f=>({...f,name:e.target.value}))} autoFocus/></div>
              <div className="field"><label>Category</label>
                <select value={createForm.customer_category || 'retail'} onChange={e=>setCreateForm(f=>({...f,customer_category:e.target.value}))}>
                  {filterType === 'supplier'
                    ? <option value="retail">Retail</option>
                    : ['retail','wholesale','contractor','government'].map(t=><option key={t}>{t}</option>)
                  }
                </select>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginBottom: 6 }}>
              <div className="field"><label>VAT No.</label><input value={createForm.vat_number} onChange={e=>setCreateForm(f=>({...f,vat_number:e.target.value}))} placeholder="BH-VAT-..."/></div>
              <div className="field"><label>CR No.</label><input value={createForm.cr_number} onChange={e=>setCreateForm(f=>({...f,cr_number:e.target.value}))}/></div>
              <div className="field"><label>Tel</label><input value={createForm.tel} onChange={e=>setCreateForm(f=>({...f,tel:e.target.value}))}/></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              <div className="field"><label>Email</label><input type="email" value={createForm.email} onChange={e=>setCreateForm(f=>({...f,email:e.target.value}))}/></div>
              <div className="field"><label>Address</label><input value={createForm.address} onChange={e=>setCreateForm(f=>({...f,address:e.target.value}))}/></div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn primary" style={{ fontSize: 11 }}
                disabled={createMut.isPending || !createForm.name.trim()}
                onClick={() => createMut.mutate(createForm)}>
                {createMut.isPending ? '⏳ Saving…' : '💾 Save & Select'}
              </button>
              <button className="btn" style={{ fontSize: 11 }} onClick={() => { setShowCreate(false) }}>
                ← Back
              </button>
              <button className="btn" style={{ fontSize: 11 }} onClick={() => { setShowCreate(false); setOpen(false) }}>
                Cancel
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}
