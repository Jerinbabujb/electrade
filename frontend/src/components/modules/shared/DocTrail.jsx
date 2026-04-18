/**
 * DocTrail
 * Shows a compact document conversion trail below a modal header.
 * - Chips on the left: documents this was created FROM (← source)
 * - Chips on the right: documents created FROM this (→ derived)
 * Clicking a chip opens the linked document in the appropriate modal.
 *
 * Props:
 *   docId  {string}  — current document UUID
 */
import { useQuery } from '@tanstack/react-query'
import { convertApi } from '../../../services/api'
import { useUIStore } from '../../../store'

const TYPE_COLORS = {
  invoice:       { bg: '#e3f2fd', border: '#90caf9', text: '#1565c0' },
  delivery_note: { bg: '#e8f5e9', border: '#a5d6a7', text: '#1b5e20' },
}

function typeColors(type) {
  return TYPE_COLORS[type] || { bg: '#f3e5f5', border: '#ce93d8', text: '#6a1b9a' }
}

function typeIcon(type) {
  if (type === 'delivery_note') return '🚚'
  return '🧾'
}

export default function DocTrail({ docId }) {
  const { openModal } = useUIStore()

  const { data: trail = [] } = useQuery({
    queryKey: ['doc-trail', docId],
    queryFn:  () => convertApi.history(docId).then(r => r.data.data),
    enabled:  !!docId,
    staleTime: 30000,
  })

  if (!trail.length) return null

  // records where this doc is the TARGET (this was created from something)
  const sources = trail.filter(d => d.to_id === docId)
  // records where this doc is the SOURCE (something was created from this)
  const derived = trail.filter(d => d.from_id === docId)

  if (!sources.length && !derived.length) return null

  const openDoc = (type, id) => {
    if (type === 'delivery_note') openModal('dn', { id })
    else openModal('invoice', { id })
  }

  const chip = (key, label, type, id, dir, title) => {
    const { bg, border, text } = typeColors(type)
    return (
      <span
        key={key}
        onClick={() => openDoc(type, id)}
        title={title}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '2px 9px', borderRadius: 10,
          fontSize: 11, fontWeight: 700,
          background: bg, border: `1px solid ${border}`, color: text,
          cursor: 'pointer', userSelect: 'none',
          transition: 'filter 0.1s',
        }}
        onMouseEnter={e => e.currentTarget.style.filter = 'brightness(0.93)'}
        onMouseLeave={e => e.currentTarget.style.filter = ''}
      >
        {dir === 'from' ? '←' : '→'} {typeIcon(type)} {label}
      </span>
    )
  }

  return (
    <div style={{
      background: '#f0f7ff',
      borderBottom: '1px solid #b8d4f0',
      padding: '5px 14px',
      display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
      fontSize: 11,
    }}>
      <span style={{ color: '#5577aa', fontWeight: 600, flexShrink: 0 }}>📎 Trail:</span>

      {sources.map(s =>
        chip(s.id, s.from_no, s.from_type, s.from_id, 'from',
          `Created from ${s.from_type.replace('_',' ')} — click to open`)
      )}

      {sources.length > 0 && derived.length > 0 && (
        <span style={{ color: '#aaa', fontWeight: 700 }}>·</span>
      )}

      {derived.map(d =>
        chip(d.id, d.to_no, d.to_type, d.to_id, 'to',
          `Converted to ${d.to_type.replace('_',' ')} by ${d.converted_by_name || '?'} on ${new Date(d.converted_at).toLocaleDateString()} — click to open`)
      )}
    </div>
  )
}
