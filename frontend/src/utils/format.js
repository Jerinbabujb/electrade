import { format, parseISO, isValid } from 'date-fns'

export const fmtBhd = (val) => {
  const n = parseFloat(val || 0)
  return isNaN(n) ? '0.000' : n.toFixed(3)
}

export const fmtDate = (val) => {
  if (!val) return '—'
  try {
    const d = typeof val === 'string' ? parseISO(val) : val
    return isValid(d) ? format(d, 'dd/MM/yyyy') : val
  } catch { return val }
}

export const fmtDateTime = (val) => {
  if (!val) return '—'
  try {
    const d = typeof val === 'string' ? parseISO(val) : val
    return isValid(d) ? format(d, 'dd/MM/yyyy HH:mm') : val
  } catch { return val }
}

export const statusBadge = (status) => {
  const map = {
    paid:      'badge-paid',
    unpaid:    'badge-unpaid',
    overdue:   'badge-overdue',
    partial:   'badge-partial',
    draft:     'badge-draft',
    void:      'badge-cancelled',
    pending_invoice: 'badge-pending',
    invoiced:  'badge-invoiced',
    cancelled: 'badge-cancelled',
  }
  return map[status] || 'badge-draft'
}

export const typeLabel = (type) => {
  const map = {
    tax_invoice:  'Tax Invoice',
    quotation:    'Quotation',
    proforma:     'Proforma',
    credit_note:  'Credit Note',
    receipt:      'Receipt',
    delivery_note:'Delivery Note',
  }
  return map[type] || type
}

export const amountInWords = (amount) => {
  // Simple English amount-in-words for BHD
  const n = parseFloat(amount)
  if (isNaN(n)) return ''
  const f = n.toFixed(3)
  const [dinars, fils] = f.split('.')
  const d = parseInt(dinars)
  const fi = parseInt(fils)
  if (d === 0 && fi === 0) return 'Zero Bahraini Dinars Only'
  let words = `Bahraini Dinars ${numberToWords(d)}`
  if (fi > 0) words += ` and ${numberToWords(fi)} Fils`
  return words + ' Only'
}

const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
              'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
              'Seventeen','Eighteen','Nineteen']
const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

function numberToWords(n) {
  if (n === 0) return 'Zero'
  if (n < 20) return ones[n]
  if (n < 100) return tens[Math.floor(n/10)] + (n%10 ? ' '+ones[n%10] : '')
  if (n < 1000) return ones[Math.floor(n/100)] + ' Hundred' + (n%100 ? ' '+numberToWords(n%100) : '')
  if (n < 1000000) return numberToWords(Math.floor(n/1000)) + ' Thousand' + (n%1000 ? ' '+numberToWords(n%1000) : '')
  return numberToWords(Math.floor(n/1000000)) + ' Million' + (n%1000000 ? ' '+numberToWords(n%1000000) : '')
}
