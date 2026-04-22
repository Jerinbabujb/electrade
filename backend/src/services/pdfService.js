// PDF Service — renders HTML via headless Chromium (puppeteer-core) to produce real PDF buffers.
const puppeteer = require('puppeteer-core')

let _browser = null
async function getBrowser() {
  if (!_browser || !_browser.connected) {
    _browser = await puppeteer.launch({
      executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium-browser',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
      headless: true,
    })
  }
  return _browser
}

async function htmlToPdf(html) {
  const browser = await getBrowser()
  const page = await browser.newPage()
  try {
    await page.setContent(html, { waitUntil: 'domcontentloaded' })
    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
    })
  } finally {
    await page.close()
  }
}

function printControls(brand) {
  return `
<div style="position:fixed;top:10px;right:12px;display:flex;gap:8px;z-index:999;background:rgba(255,255,255,.92);padding:6px 8px;border-radius:6px;box-shadow:0 2px 8px rgba(0,0,0,.15)">
  <button id="btnPrint" style="padding:6px 16px;background:${brand};color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">🖨 Print</button>
  <button id="btnClose" style="padding:6px 14px;background:#f0f0f0;color:#333;border:none;border-radius:4px;cursor:pointer;font-size:12px;font-weight:600">✕ Close</button>
</div>
<script>
  document.getElementById('btnPrint').addEventListener('click',function(){window.print()});
  document.getElementById('btnClose').addEventListener('click',function(){window.close()});
</script>`
}

// ── Settings helper ────────────────────────────────────────
function getSettings(co) {
  const s = (co && typeof co.pdf_settings === 'object' && co.pdf_settings) ? co.pdf_settings : {}
  return {
    template:     s.template         || 'clean',   // 'clean' | 'classic' | 'compact'
    bilingual:    (s.language        || 'bilingual') === 'bilingual',
    showPartNo:   s.show_part_no     !== false,
    showUnit:     s.show_unit        !== false,
    showDiscount: s.show_discount    !== false,
    showVatCol:   s.show_vat_col     !== false,
    showBank:     s.show_bank        !== false,
    showSigs:     s.show_signatures  !== false,
    showBalance:  s.show_balance_due !== false,
    footer:       s.custom_footer    || '',
  }
}

const TYPE_META = {
  tax_invoice:  { en: 'TAX INVOICE',      ar: 'فاتورة ضريبية',  refLabel: 'Invoice No.',     footer: 'Computer-generated tax invoice · فاتورة ضريبية معتمدة' },
  quotation:    { en: 'QUOTATION',         ar: 'عرض سعر',         refLabel: 'Quotation No.',   footer: 'This quotation is not a tax invoice · عرض سعر' },
  proforma:     { en: 'PROFORMA INVOICE',  ar: 'فاتورة مبدئية',  refLabel: 'Proforma No.',    footer: 'Proforma invoice — not a tax invoice · فاتورة مبدئية' },
  credit_note:  { en: 'CREDIT NOTE',       ar: 'إشعار دائن',      refLabel: 'Credit Note No.', footer: 'Computer-generated credit note · إشعار دائن' },
  receipt:      { en: 'RECEIPT',           ar: 'إيصال',            refLabel: 'Receipt No.',     footer: 'Computer-generated receipt · إيصال' },
}

function fmtDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d)) return String(val)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function esc(str) {
  return String(str || '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

// ─────────────────────────────────────────────
//  INVOICE / QUOTATION / PROFORMA / CREDIT NOTE
// ─────────────────────────────────────────────
function invoiceHtml(inv, { forPrint = false } = {}) {
  const co    = inv.company || {}
  const items = inv.items   || []
  const meta  = TYPE_META[inv.type] || TYPE_META.tax_invoice
  const brand = (co.theme_color && /^#[0-9a-fA-F]{6}$/.test(co.theme_color)) ? co.theme_color : '#1a5fa8'
  const s     = getSettings(co)

  // Template-driven sizing
  const compact  = s.template === 'compact'
  const classic  = s.template === 'classic'
  const fs       = compact ? '9.5px'   : '11px'
  const hPad     = compact ? '12px 18px' : '20px 24px'
  const sPad     = compact ? '10px 18px' : '16px 24px'
  const secPad   = compact ? '8px 18px'  : '10px 24px'
  const rowPad   = compact ? '3.5px 5px' : '5.5px 6px'
  const thPad    = compact ? '4px 5px'   : '6px 6px'

  // Totals — use stored header values (authoritative, VAT-compliant)
  const subtotal      = parseFloat(inv.subtotal      || 0)
  const totalDiscount = parseFloat(inv.total_discount || 0)
  const totalVat      = parseFloat(inv.total_vat      || 0)
  const shipping      = parseFloat(inv.shipping       || 0)
  const grandTotal    = parseFloat(inv.grand_total    || subtotal - totalDiscount + totalVat + shipping)
  const balance       = parseFloat(inv.balance_due    ?? grandTotal)

  // Break discount into line-level vs overall/invoice-level
  const lineDiscSum   = items.reduce((s, i) => s + parseFloat(i.discount || 0), 0)
  const overallDisc   = Math.max(0, totalDiscount - lineDiscSum)
  const netTaxable    = subtotal - totalDiscount   // shown when any discount exists

  const statusColor = { paid: '#2e7d32', unpaid: '#b45309', overdue: '#c62828', partial: '#1565c0' }
  const sc    = statusColor[inv.payment_status] || '#b45309'
  const scBg  = { paid: '#f0fdf4', unpaid: '#fffbeb', overdue: '#fef2f2', partial: '#eff6ff' }
  const scBgV = scBg[inv.payment_status] || '#fffbeb'

  // Column flags
  const showDisc = s.showDiscount && items.some(it => parseFloat(it.discount || 0) > 0)

  // Item rows — compute line amounts from stored qty/unit_price/discount
  const rows = items.map((it, i) => {
    const lineNet = parseFloat(it.qty || 0) * parseFloat(it.unit_price || 0) - parseFloat(it.discount || 0)
    return `
    <tr>
      <td style="color:#666;text-align:center;padding:${rowPad}">${i + 1}</td>
      ${s.showPartNo  ? `<td style="color:#444;padding:${rowPad}">${esc(it.part_no || '')}</td>` : ''}
      <td style="padding:${rowPad}">${esc(it.description || '')}</td>
      <td style="text-align:right;padding:${rowPad}">${parseFloat(it.qty || 0).toFixed(3)}</td>
      ${s.showUnit    ? `<td style="color:#555;padding:${rowPad}">${esc(it.unit || '')}</td>` : ''}
      <td style="text-align:right;padding:${rowPad}">${parseFloat(it.unit_price || 0).toFixed(3)}</td>
      ${showDisc      ? `<td style="text-align:right;padding:${rowPad};color:#2e7d32">${parseFloat(it.discount || 0) > 0 ? parseFloat(it.discount || 0).toFixed(3) : '—'}</td>` : ''}
      ${s.showVatCol  ? `<td style="text-align:right;color:#444;padding:${rowPad}">${parseFloat(it.vat_rate || 10).toFixed(0)}%</td>` : ''}
      <td style="text-align:right;font-weight:600;padding:${rowPad}">${lineNet.toFixed(3)}</td>
    </tr>`
  }).join('')

  const linkedDns = (inv.linked_dns || []).filter(Boolean)
    .map(d => `<span style="display:inline-block;padding:1px 8px;border:1px solid #c7d9f7;border-radius:10px;margin:1px 2px;font-size:9.5px;color:${brand};background:#f0f5ff">${esc(d.dn_no || d)}</span>`).join(' ')

  // ── Header HTML (differs by template) ──────────────────
  const logoImg = co.logo ? `<img src="${co.logo}" alt="" style="height:${compact?'44px':'56px'};max-width:120px;object-fit:contain">` : ''
  const coMeta  = `${esc(co.address || '')}${co.tel ? ` · Tel: ${esc(co.tel)}` : ''}<br>${co.vat_number ? `VAT Reg: ${esc(co.vat_number)}` : ''}${co.cr_number ? ` · CR: ${esc(co.cr_number)}` : ''}`

  const headerHtml = classic ? `
<div style="background:${brand};color:#fff;padding:${hPad};display:flex;justify-content:space-between;align-items:flex-start">
  <div style="display:flex;gap:12px;align-items:flex-start">
    ${co.logo ? `<img src="${co.logo}" alt="" style="height:${compact?'44px':'52px'};max-width:120px;object-fit:contain;background:rgba(255,255,255,.15);border-radius:3px;padding:3px">` : ''}
    <div>
      <div style="font-size:${compact?'13px':'15px'};font-weight:700">${esc(co.name || '')}</div>
      ${s.bilingual && co.name_ar ? `<div style="font-size:11px;margin-top:2px;opacity:.8">${esc(co.name_ar)}</div>` : ''}
      <div style="font-size:9px;margin-top:4px;opacity:.75;line-height:1.8">${coMeta}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:${compact?'17px':'21px'};font-weight:700;background:rgba(255,255,255,.15);padding:${compact?'5px 12px':'7px 16px'};border-radius:4px;display:inline-block;letter-spacing:-.5px">${meta.en}</div>
    ${s.bilingual ? `<div style="font-size:10px;opacity:.8;margin-top:4px">${meta.ar}</div>` : ''}
    <div style="font-size:13px;font-weight:700;margin-top:6px">${esc(inv.invoice_no || '')}</div>
  </div>
</div>` : `
<div style="height:4px;background:${brand}"></div>
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:${hPad};border-bottom:1px solid #ebebeb">
  <div style="display:flex;gap:14px;align-items:flex-start">
    ${logoImg}
    <div>
      <div style="font-size:${compact?'13px':'14px'};font-weight:700;color:#111;line-height:1.3">${esc(co.name || '')}</div>
      ${s.bilingual && co.name_ar ? `<div style="font-size:11px;color:#555;margin-top:2px">${esc(co.name_ar)}</div>` : ''}
      <div style="font-size:9px;color:#555;margin-top:5px;line-height:1.8">${coMeta}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:${compact?'18px':'22px'};font-weight:700;color:${brand};letter-spacing:-.5px;line-height:1.1">${meta.en}</div>
    ${s.bilingual ? `<div style="font-size:11px;color:#666;margin-top:2px">${meta.ar}</div>` : ''}
    <div style="font-size:13px;font-weight:700;color:#333;margin-top:6px">${esc(inv.invoice_no || '')}</div>
  </div>
</div>`

  const footerText = s.footer || meta.footer

  const pageSize = forPrint ? '9.5in 11in' : 'A4'
  const margin   = forPrint ? '5mm' : '0'
  const minH     = forPrint ? 'calc(11in - 10mm)' : '273mm'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(inv.invoice_no || 'Document')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:${fs};color:#222;background:#fff;display:flex;flex-direction:column;min-height:${minH}}
  table.items{width:100%;border-collapse:collapse}
  table.items thead tr{border-bottom:2px solid ${brand}}
  table.items th{text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${brand};padding:${thPad};white-space:nowrap}
  table.items th.r{text-align:right}
  table.items tbody tr:nth-child(even) td{background:#fafafa}
  table.items tbody tr td{border-bottom:1px solid #f0f0f0;vertical-align:top}
  @media print{@page{margin:${margin};size:${pageSize}}}
</style>
</head>
<body>
${forPrint ? printControls(brand) : ''}
${headerHtml}

<div style="display:grid;grid-template-columns:1fr 1fr;padding:${sPad};border-bottom:1px solid #ebebeb;background:#fafafa">
  <div>
    <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${brand};margin-bottom:5px">Bill To</div>
    <div style="font-size:${compact?'11px':'12px'};font-weight:700;color:#111;margin-bottom:3px">${esc(inv.customer_name || '')}</div>
    <div style="font-size:9.5px;color:#555;line-height:1.7">
      ${inv.customer_vat ? `VAT: ${esc(inv.customer_vat)}<br>` : ''}
      ${inv.customer_cr  ? `CR: ${esc(inv.customer_cr)}<br>`   : ''}
      ${inv.customer_tel ? `Tel: ${esc(inv.customer_tel)}`      : ''}
    </div>
  </div>
  <div style="padding-left:24px;border-left:1px solid #e4e4e4">
    <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${brand};margin-bottom:5px">Document Details</div>
    ${[
      [meta.refLabel, esc(inv.invoice_no || '')],
      ['Date', fmtDate(inv.invoice_date)],
      (inv.type === 'quotation' || inv.type === 'proforma') && inv.valid_until
        ? ['Valid Until', fmtDate(inv.valid_until)]
        : inv.due_date ? ['Due Date', fmtDate(inv.due_date)] : null,
      inv.po_reference ? [(inv.type === 'quotation' || inv.type === 'proforma') ? 'Client Ref' : 'PO Reference', esc(inv.po_reference)] : null,
      (inv.payment_status && inv.type === 'tax_invoice') ? ['Status', `<span style="color:${sc};font-weight:700">${esc(inv.payment_status.charAt(0).toUpperCase()+inv.payment_status.slice(1))}</span>`] : null,
    ].filter(Boolean).map(([lbl, val]) => `
      <div style="display:flex;justify-content:space-between;font-size:10px;padding:2.5px 0;border-bottom:1px dotted #eee">
        <span style="color:#555">${lbl}</span><span style="font-weight:600;color:#222">${val}</span>
      </div>`).join('')}
  </div>
</div>

<div style="padding:${compact?'10px 18px 0':'14px 24px 0'}">
<table class="items">
  <thead>
    <tr>
      <th style="width:24px;text-align:center">#</th>
      ${s.showPartNo  ? `<th>Part No.</th>`            : ''}
      <th>Description</th>
      <th class="r">Qty</th>
      ${s.showUnit    ? `<th>Unit</th>`                : ''}
      <th class="r">Unit Price</th>
      ${showDisc      ? `<th class="r">Discount</th>`  : ''}
      ${s.showVatCol  ? `<th class="r">VAT%</th>`      : ''}
      <th class="r">Amount (BHD)</th>
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</div>

<div style="display:flex;justify-content:flex-end;padding:${compact?'8px 18px 4px':'12px 24px 4px'}">
  <table style="width:290px;font-size:11px;border-collapse:collapse">
    <tr>
      <td style="padding:4px 6px;color:#444">Subtotal</td>
      <td style="padding:4px 6px;text-align:right">BHD ${subtotal.toFixed(3)}</td>
    </tr>
    ${lineDiscSum > 0 ? `
    <tr>
      <td style="padding:4px 6px;color:#2e7d32">Line Discounts</td>
      <td style="padding:4px 6px;text-align:right;color:#2e7d32">− BHD ${lineDiscSum.toFixed(3)}</td>
    </tr>` : ''}
    ${overallDisc > 0 ? `
    <tr>
      <td style="padding:4px 6px;color:#2e7d32">${inv.type === 'quotation' || inv.type === 'proforma' ? 'Overall Discount' : 'Invoice Discount'}</td>
      <td style="padding:4px 6px;text-align:right;color:#2e7d32">− BHD ${overallDisc.toFixed(3)}</td>
    </tr>` : ''}
    ${totalDiscount > 0 ? `
    <tr style="border-top:1px dashed #e0e0e0">
      <td style="padding:4px 6px;color:#444;font-size:10px">Net Taxable Amount</td>
      <td style="padding:4px 6px;text-align:right;font-size:10px">BHD ${netTaxable.toFixed(3)}</td>
    </tr>` : ''}
    <tr>
      <td style="padding:4px 6px;color:#c62828">VAT (10%)</td>
      <td style="padding:4px 6px;text-align:right;color:#c62828">BHD ${totalVat.toFixed(3)}</td>
    </tr>
    ${shipping > 0 ? `
    <tr>
      <td style="padding:4px 6px;color:#444">Shipping</td>
      <td style="padding:4px 6px;text-align:right">BHD ${shipping.toFixed(3)}</td>
    </tr>` : ''}
    <tr style="border-top:2px solid ${brand}">
      <td style="padding:7px 6px 4px;font-size:13px;font-weight:700;color:${brand}">Total</td>
      <td style="padding:7px 6px 4px;text-align:right;font-size:13px;font-weight:700;color:${brand}">BHD ${grandTotal.toFixed(3)}</td>
    </tr>
    ${s.showBalance && inv.type !== 'quotation' && inv.type !== 'proforma' ? `
    <tr style="border-top:1px solid #eee">
      <td style="padding:5px 6px;color:#444">Balance Due</td>
      <td style="padding:5px 6px;text-align:right">
        <span style="display:inline-block;padding:2px 12px;border-radius:20px;font-weight:700;font-size:11px;background:${scBgV};color:${sc}">BHD ${balance.toFixed(3)}</span>
      </td>
    </tr>` : ''}
  </table>
</div>

${linkedDns ? `<div style="padding:${secPad};font-size:10px;color:#666;border-top:1px solid #f0f0f0">Delivery Notes covered: ${linkedDns}</div>` : ''}
${inv.notes ? `<div style="padding:${secPad};border-top:1px solid #f0f0f0"><div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#555;margin-bottom:4px">Notes</div><div style="font-size:10.5px;color:#333">${esc(inv.notes)}</div></div>` : ''}

${s.showBank && (co.bank_name || co.bank_iban) ? `
<div style="padding:${secPad};border-top:1px solid #f0f0f0;font-size:10px;color:#444">
  <span style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#555">Payment &nbsp;</span>
  ${co.bank_name ? esc(co.bank_name) : ''}${co.bank_iban ? ` · IBAN: ${esc(co.bank_iban)}` : ''}${co.bank_swift ? ` · SWIFT: ${esc(co.bank_swift)}` : ''}
</div>` : ''}

<div style="margin-top:auto;border-top:1px solid #e4e4e4;padding:8px 24px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#444">
  <div>${esc(co.name || '')}${co.vat_number ? ` · VAT: ${esc(co.vat_number)}` : ''}${co.cr_number ? ` · CR: ${esc(co.cr_number)}` : ''}</div>
  <div style="font-style:italic;color:#555">${esc(footerText)}</div>
</div>
</body></html>`
}

// ─────────────────────────────────────────────
//  DELIVERY NOTE
// ─────────────────────────────────────────────
function dnHtml(dn, { forPrint = false } = {}) {
  const co    = dn.company || {}
  const items = dn.items   || []
  const brand = (co.theme_color && /^#[0-9a-fA-F]{6}$/.test(co.theme_color)) ? co.theme_color : '#1a5fa8'
  const s     = getSettings(co)

  const compact = s.template === 'compact'
  const classic = s.template === 'classic'
  const fs      = compact ? '9.5px'    : '11px'
  const hPad    = compact ? '12px 18px' : '20px 24px'
  const sPad    = compact ? '10px 18px' : '16px 24px'
  const secPad  = compact ? '8px 18px'  : '10px 24px'
  const rowPad  = compact ? '3.5px 5px' : '5.5px 6px'
  const thPad   = compact ? '4px 5px'   : '6px 6px'

  const rows = items.map((it, i) => `
    <tr>
      <td style="color:#666;text-align:center;padding:${rowPad}">${i + 1}</td>
      ${s.showPartNo ? `<td style="color:#444;padding:${rowPad}">${esc(it.part_no || '')}</td>` : ''}
      <td style="padding:${rowPad}">${esc(it.description || it.product_name || '')}</td>
      <td style="text-align:right;padding:${rowPad}">${parseFloat(it.qty_ordered   || 0).toFixed(3)}</td>
      <td style="text-align:right;font-weight:600;padding:${rowPad}">${parseFloat(it.qty_delivered || 0).toFixed(3)}</td>
      ${s.showUnit ? `<td style="color:#555;padding:${rowPad}">${esc(it.unit || '')}</td>` : ''}
    </tr>`).join('')

  const coMeta  = `${esc(co.address || '')}${co.tel ? ` · Tel: ${esc(co.tel)}` : ''}<br>${co.vat_number ? `VAT Reg: ${esc(co.vat_number)}` : ''}${co.cr_number ? ` · CR: ${esc(co.cr_number)}` : ''}`
  const logoImg = co.logo ? `<img src="${co.logo}" alt="" style="height:${compact?'44px':'56px'};max-width:120px;object-fit:contain">` : ''

  const headerHtml = classic ? `
<div style="background:${brand};color:#fff;padding:${hPad};display:flex;justify-content:space-between;align-items:flex-start">
  <div style="display:flex;gap:12px;align-items:flex-start">
    ${co.logo ? `<img src="${co.logo}" alt="" style="height:${compact?'44px':'52px'};max-width:120px;object-fit:contain;background:rgba(255,255,255,.15);border-radius:3px;padding:3px">` : ''}
    <div>
      <div style="font-size:${compact?'13px':'15px'};font-weight:700">${esc(co.name || '')}</div>
      ${s.bilingual && co.name_ar ? `<div style="font-size:11px;margin-top:2px;opacity:.8">${esc(co.name_ar)}</div>` : ''}
      <div style="font-size:9px;margin-top:4px;opacity:.75;line-height:1.8">${coMeta}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:${compact?'17px':'21px'};font-weight:700;background:rgba(255,255,255,.15);padding:${compact?'5px 12px':'7px 16px'};border-radius:4px;display:inline-block">DELIVERY NOTE</div>
    ${s.bilingual ? `<div style="font-size:10px;opacity:.8;margin-top:4px">مذكرة تسليم</div>` : ''}
    <div style="font-size:13px;font-weight:700;margin-top:6px">${esc(dn.dn_no || '')}</div>
  </div>
</div>` : `
<div style="height:4px;background:${brand}"></div>
<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:${hPad};border-bottom:1px solid #ebebeb">
  <div style="display:flex;gap:14px;align-items:flex-start">
    ${logoImg}
    <div>
      <div style="font-size:${compact?'13px':'14px'};font-weight:700;color:#111;line-height:1.3">${esc(co.name || '')}</div>
      ${s.bilingual && co.name_ar ? `<div style="font-size:11px;color:#555;margin-top:2px">${esc(co.name_ar)}</div>` : ''}
      <div style="font-size:9px;color:#555;margin-top:5px;line-height:1.8">${coMeta}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:${compact?'18px':'22px'};font-weight:700;color:${brand};letter-spacing:-.5px;line-height:1.1">DELIVERY NOTE</div>
    ${s.bilingual ? `<div style="font-size:11px;color:#666;margin-top:2px">مذكرة تسليم</div>` : ''}
    <div style="font-size:13px;font-weight:700;color:#333;margin-top:6px">${esc(dn.dn_no || '')}</div>
  </div>
</div>`

  const footerText = s.footer || 'This delivery note does not constitute a tax invoice · هذا ليس فاتورة ضريبية'

  const pageSize = forPrint ? '9.5in 11in' : 'A4'
  const margin   = forPrint ? '5mm' : '0'
  const minH     = forPrint ? 'calc(11in - 10mm)' : '273mm'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Delivery Note ${esc(dn.dn_no || '')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:${fs};color:#222;background:#fff;display:flex;flex-direction:column;min-height:${minH}}
  table.items{width:100%;border-collapse:collapse}
  table.items thead tr{border-bottom:2px solid ${brand}}
  table.items th{text-align:left;font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:${brand};padding:${thPad}}
  table.items th.r{text-align:right}
  table.items tbody tr:nth-child(even) td{background:#fafafa}
  table.items tbody tr td{border-bottom:1px solid #f0f0f0;vertical-align:top}
  @media print{@page{margin:${margin};size:${pageSize}}}
</style>
</head>
<body>
${forPrint ? printControls(brand) : ''}
${headerHtml}

<div style="display:grid;grid-template-columns:1fr 1fr;padding:${sPad};border-bottom:1px solid #ebebeb;background:#fafafa">
  <div>
    <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${brand};margin-bottom:5px">Deliver To</div>
    <div style="font-size:${compact?'11px':'12px'};font-weight:700;color:#111;margin-bottom:3px">${esc(dn.customer_name || '')}</div>
    <div style="font-size:9.5px;color:#555;line-height:1.7">
      ${esc(dn.delivery_address || dn.customer_address || '')}
      ${dn.project_ref ? `<br>Project: ${esc(dn.project_ref)}` : ''}
    </div>
  </div>
  <div style="padding-left:24px;border-left:1px solid #e4e4e4">
    <div style="font-size:8.5px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:${brand};margin-bottom:5px">Delivery Details</div>
    ${[
      ['DN No.',        esc(dn.dn_no || '')],
      ['Date',          fmtDate(dn.dn_date)],
      ['PO Reference',  esc(dn.po_reference || '—')],
      dn.delivered_by        ? ['Delivered By',  esc(dn.delivered_by)]        : null,
      dn.linked_invoice_no   ? ['Invoice Ref',   esc(dn.linked_invoice_no)]   : null,
    ].filter(Boolean).map(([lbl, val]) => `
      <div style="display:flex;justify-content:space-between;font-size:10px;padding:2.5px 0;border-bottom:1px dotted #eee">
        <span style="color:#555">${lbl}</span><span style="font-weight:600;color:#222">${val}</span>
      </div>`).join('')}
  </div>
</div>

<div style="padding:${compact?'10px 18px 0':'14px 24px 0'}">
<table class="items">
  <thead>
    <tr>
      <th style="width:24px;text-align:center">#</th>
      ${s.showPartNo ? `<th>Part No.</th>` : ''}
      <th>Description</th>
      <th class="r">Qty Ordered</th>
      <th class="r">Qty Delivered</th>
      ${s.showUnit ? `<th>Unit</th>` : ''}
    </tr>
  </thead>
  <tbody>${rows}</tbody>
</table>
</div>

<div style="margin:${compact?'10px 18px 0':'14px 24px 0'};padding:8px 12px;background:#fffbeb;border-left:3px solid #f59e0b;font-size:10px;color:#6b4c00;border-radius:0 4px 4px 0">
  <strong>This is not a tax invoice.</strong> &nbsp; A tax invoice will be issued upon receipt of official purchase order.
</div>

${s.showSigs ? `
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin:${compact?'12px 18px 0':'16px 24px 0'}">
  ${[
    ['Prepared By', ''],
    ['Delivered By', dn.delivered_by || ''],
    ['Received By (Client)', ''],
  ].map(([lbl, name]) => `
  <div style="border:1px solid #e4e4e4;padding:${compact?'8px':'12px'};border-radius:4px">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#555;margin-bottom:${compact?'12px':'16px'}">${lbl}</div>
    ${name ? `<div style="font-size:10px;color:#333;margin-bottom:8px">${esc(name)}</div>` : ''}
    <div style="border-top:1px solid #ccc;margin-top:${compact?'10px':'14px'};padding-top:4px;font-size:8.5px;color:#666">Name / Signature / Date</div>
  </div>`).join('')}
</div>` : ''}

<div style="margin-top:auto;border-top:1px solid #e4e4e4;padding:8px 24px;display:flex;justify-content:space-between;align-items:center;font-size:9.5px;color:#444;${s.showSigs?'':'margin-top:16px'}">
  <div>${esc(co.name || '')}${co.vat_number ? ` · VAT: ${esc(co.vat_number)}` : ''}${co.cr_number ? ` · CR: ${esc(co.cr_number)}` : ''}</div>
  <div style="font-style:italic;color:#555">${esc(footerText)}</div>
</div>
</body></html>`
}

// ─────────────────────────────────────────────
//  STATEMENT OF ACCOUNTS
// ─────────────────────────────────────────────
function statementHtml(data, { forPrint = false } = {}) {
  const co       = data.company   || {}
  const customer = data.customer  || {}
  const rows     = data.rows      || []
  const brand    = (co.theme_color && /^#[0-9a-fA-F]{6}$/.test(co.theme_color)) ? co.theme_color : '#1a5fa8'

  const ob  = parseFloat(data.opening_balance || 0)
  const cb  = parseFloat(data.closing_balance || 0)
  const td  = parseFloat(data.totals?.debit   || 0)
  const tc  = parseFloat(data.totals?.credit  || 0)

  const fmtBhd = (v) => 'BHD ' + parseFloat(v || 0).toFixed(3)
  const colorBal = (v) => v > 0.001 ? '#c62828' : v < -0.001 ? '#2e7d32' : '#333'

  const TXN_LABEL = { invoice: 'Invoice', credit_note: 'Credit Note', payment: 'Payment' }
  const METHOD_LABEL = { cash: 'Cash', bank_transfer: 'Bank Transfer', cheque: 'Cheque', card: 'Card', other: 'Other' }
  const TXN_COLOR = { invoice: brand, credit_note: '#6a1b9a', payment: '#2e7d32' }
  const TXN_BG    = { invoice: '#e8f0fb', credit_note: '#f3e5f5', payment: '#e8f5e9' }

  const txnRows = rows.map((r, i) => {
    const label  = TXN_LABEL[r.txn_type]  || r.txn_type
    const color  = TXN_COLOR[r.txn_type]  || brand
    const bg     = TXN_BG[r.txn_type]     || '#eee'
    const method = r.txn_type === 'payment'
      ? (METHOD_LABEL[r.doc_type] || r.doc_type || '')
      : (r.doc_type === 'tax_invoice' ? 'Tax Invoice' : r.doc_type === 'credit_note' ? 'Credit Note' : r.doc_type || '')
    const debit  = parseFloat(r.debit  || 0)
    const credit = parseFloat(r.credit || 0)
    const bal    = parseFloat(r.balance || 0)
    return `
    <tr style="background:${i % 2 === 0 ? '#fff' : '#fafafa'}">
      <td>${fmtDate(r.txn_date)}</td>
      <td><span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:9px;font-weight:700;background:${bg};color:${color}">${esc(label)}</span></td>
      <td style="font-family:monospace;font-size:10px">${esc(r.ref_no || '')}</td>
      <td style="color:#666;font-size:10px">${esc(method)}${r.notes ? ` <span style="color:#bbb">— ${esc(r.notes)}</span>` : ''}</td>
      <td style="text-align:right;color:${debit > 0 ? '#c62828' : '#bbb'}">${debit > 0 ? debit.toFixed(3) : '—'}</td>
      <td style="text-align:right;color:${credit > 0 ? '#2e7d32' : '#bbb'}">${credit > 0 ? credit.toFixed(3) : '—'}</td>
      <td style="text-align:right;font-weight:600;color:${colorBal(bal)}">${bal.toFixed(3)}</td>
    </tr>`
  }).join('')

  const summaryCards = [
    ['Opening Balance', fmtBhd(ob), colorBal(ob)],
    ['Total Invoiced',  fmtBhd(td), brand],
    ['Total Received',  fmtBhd(tc), '#2e7d32'],
    ['Closing Balance', fmtBhd(cb), colorBal(cb)],
  ].map(([label, value, color]) => `
    <div style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:4px;padding:8px 12px;text-align:center">
      <div style="font-size:8.5px;color:#888;text-transform:uppercase;letter-spacing:.5px;font-weight:600;margin-bottom:3px">${label}</div>
      <div style="font-size:13px;font-weight:700;color:${color}">${esc(value)}</div>
    </div>`).join('')

  const bankSection = (co.bank_iban || co.bank_name) ? `
  <div style="margin-top:14px;padding:8px 12px;background:#f5f5f5;border:1px solid #e0e0e0;border-radius:3px;font-size:10px">
    <div style="font-weight:700;margin-bottom:4px">Payment Details:</div>
    <div style="display:flex;gap:24px;flex-wrap:wrap">
      ${co.bank_name      ? `<span><strong>Bank:</strong> ${esc(co.bank_name)}</span>` : ''}
      ${co.bank_acct_name ? `<span><strong>Account:</strong> ${esc(co.bank_acct_name)}</span>` : ''}
      ${co.bank_iban      ? `<span><strong>IBAN:</strong> ${esc(co.bank_iban)}</span>` : ''}
      ${co.bank_swift     ? `<span><strong>SWIFT:</strong> ${esc(co.bank_swift)}</span>` : ''}
    </div>
  </div>` : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Statement of Account — ${esc(customer.name || '')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11px;color:#222;background:#fff;padding:20px 24px}
  table{width:100%;border-collapse:collapse;font-size:11px}
  thead tr{background:${brand};color:#fff}
  th{padding:6px 8px;text-align:left;font-weight:600;font-size:10px;text-transform:uppercase;letter-spacing:.4px}
  th.r,td.r{text-align:right}
  td{padding:5px 8px;border-bottom:1px solid #eee}
  .ob-row td{background:#fff8e1!important;font-style:italic;color:#5d4037}
  .foot-row td{font-weight:700;border-top:2px solid ${brand};background:#fff!important}
  @media print{@page{margin:12mm;size:A4}body{padding:0}}
</style>
</head>
<body>
${forPrint ? printControls(brand) : ''}

<!-- Letterhead -->
<div style="display:flex;justify-content:space-between;border-bottom:2px solid ${brand};padding-bottom:10px;margin-bottom:14px">
  <div>
    <div style="font-size:15px;font-weight:700;color:${brand}">${esc(co.name || '')}</div>
    ${co.name_ar ? `<div style="font-size:12px;color:#555;direction:rtl">${esc(co.name_ar)}</div>` : ''}
    <div style="font-size:10px;color:#444;margin-top:3px">${[co.address, co.tel, co.email].filter(Boolean).map(esc).join(' | ')}</div>
    <div style="font-size:10px;color:#444">
      ${co.vat_number ? `VAT Reg: ${esc(co.vat_number)}` : ''}
      ${co.cr_number  ? ` | CR: ${esc(co.cr_number)}`    : ''}
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:16px;font-weight:700;color:#333">STATEMENT OF ACCOUNT</div>
    <div style="font-size:11px;color:#444;margin-top:4px">Period: ${fmtDate(data.period?.from)} – ${fmtDate(data.period?.to)}</div>
    <div style="font-size:10px;color:#555;margin-top:2px">Printed: ${fmtDate(new Date().toISOString())}</div>
  </div>
</div>

<!-- Customer + summary cards -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
  <div style="background:#f8f8f8;border:1px solid #e0e0e0;border-radius:3px;padding:8px 12px">
    <div style="font-size:9px;color:#888;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px">Bill To</div>
    <div style="font-weight:700;font-size:13px">${esc(customer.name || '')}</div>
    <div style="font-size:11px;color:#555">Code: ${esc(customer.code || '')}</div>
    ${customer.address    ? `<div style="font-size:10px;color:#555">${esc(customer.address)}</div>` : ''}
    ${customer.tel        ? `<div style="font-size:10px;color:#555">Tel: ${esc(customer.tel)}</div>` : ''}
    ${customer.email      ? `<div style="font-size:10px;color:#555">${esc(customer.email)}</div>` : ''}
    ${customer.vat_number ? `<div style="font-size:10px;color:#555">VAT: ${esc(customer.vat_number)}</div>` : ''}
  </div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">${summaryCards}</div>
</div>

<!-- Transactions table -->
<table>
  <thead>
    <tr>
      <th style="width:80px">Date</th>
      <th style="width:90px">Type</th>
      <th>Reference</th>
      <th>Method / Doc</th>
      <th class="r" style="width:100px">Debit (BHD)</th>
      <th class="r" style="width:100px">Credit (BHD)</th>
      <th class="r" style="width:110px">Balance (BHD)</th>
    </tr>
  </thead>
  <tbody>
    <!-- Opening balance -->
    <tr class="ob-row">
      <td>${fmtDate(data.period?.from)}</td>
      <td colspan="3" style="color:#5d4037">Opening Balance</td>
      <td class="r" style="color:#5d4037">—</td>
      <td class="r" style="color:#5d4037">—</td>
      <td class="r" style="font-weight:700;color:${colorBal(ob)}">${ob.toFixed(3)}</td>
    </tr>
    ${rows.length === 0 ? `<tr><td colspan="7" style="text-align:center;color:#aaa;padding:20px 0">No transactions in this period</td></tr>` : txnRows}
    <!-- Closing balance -->
    <tr class="foot-row">
      <td colspan="4" style="color:${brand}">Closing Balance — ${fmtDate(data.period?.to)}</td>
      <td class="r">${td.toFixed(3)}</td>
      <td class="r">${tc.toFixed(3)}</td>
      <td class="r" style="font-size:12px;color:${colorBal(cb)}">${cb.toFixed(3)}</td>
    </tr>
  </tbody>
</table>

${bankSection}

<div style="margin-top:12px;font-size:9.5px;color:#555;text-align:center;border-top:1px solid #eee;padding-top:8px">
  This statement is computer generated and does not require a signature. Please contact us if you have any queries.
</div>
</body></html>`
}

// Public API — real PDF buffers (A4, puppeteer)
exports.generateInvoicePdf   = (inv)  => htmlToPdf(invoiceHtml(inv))
exports.generateDnPdf        = (dn)   => htmlToPdf(dnHtml(dn))
exports.generateStatementPdf = (data) => htmlToPdf(statementHtml(data))

// Browser-print HTML (9.5"×11" dot-matrix / direct print)
exports.invoicePrintHtml   = (inv)  => Buffer.from(invoiceHtml(inv,       { forPrint: true }))
exports.dnPrintHtml        = (dn)   => Buffer.from(dnHtml(dn,             { forPrint: true }))
exports.statementPrintHtml = (data) => Buffer.from(statementHtml(data,    { forPrint: true }))

// ─────────────────────────────────────────────
//  SHARED — Amount to words (BHD / Fils)
// ─────────────────────────────────────────────
function amountToWordsBhd(amount) {
  const n      = Math.round(parseFloat(amount || 0) * 1000) // work in Fils to avoid float issues
  const dinars = Math.floor(n / 1000)
  const fils   = n % 1000

  const ones = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine',
                 'Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen',
                 'Seventeen','Eighteen','Nineteen']
  const tens = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety']

  function sayBelow100(n) {
    if (n < 20) return ones[n]
    return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '')
  }
  function sayBelow1000(n) {
    if (n < 100) return sayBelow100(n)
    const h = Math.floor(n / 100)
    const r = n % 100
    return ones[h] + ' Hundred' + (r ? ' and ' + sayBelow100(r) : '')
  }
  function sayNumber(n) {
    if (n === 0) return 'Zero'
    let out = ''
    if (n >= 1000000) { out += sayBelow1000(Math.floor(n / 1000000)) + ' Million '; n %= 1000000 }
    if (n >= 1000)    { out += sayBelow1000(Math.floor(n / 1000))    + ' Thousand '; n %= 1000 }
    if (n > 0)        { out += sayBelow1000(n) }
    return out.trim()
  }

  let words = sayNumber(dinars) + (dinars === 1 ? ' Dinar' : ' Dinars')
  if (fils > 0) words += ' and ' + sayNumber(fils) + (fils === 1 ? ' Fils' : ' Fils')
  return words + ' Only'
}
exports.amountToWordsBhd = amountToWordsBhd

// ─────────────────────────────────────────────
//  CHEQUE PAYMENT VOUCHER  (Option A — A4)
// ─────────────────────────────────────────────
function chequeVoucherHtml(cheque, co) {
  const brand    = (co.theme_color && /^#[0-9a-fA-F]{6}$/.test(co.theme_color)) ? co.theme_color : '#1a5fa8'
  const amount   = parseFloat(cheque.amount || 0)
  const words    = amountToWordsBhd(amount)
  const logoImg  = co.logo ? `<img src="${co.logo}" alt="" style="height:52px;max-width:130px;object-fit:contain">` : ''
  const voucherNo = cheque.cheque_no ? `CHQ-${cheque.cheque_no}` : ''

  const row = (label, value, bold) => `
    <tr>
      <td style="width:160px;padding:7px 10px;font-size:11px;color:#555;font-weight:600;background:#f8f8f8;border:1px solid #e0e0e0">${label}</td>
      <td style="padding:7px 12px;font-size:11px;color:#222;border:1px solid #e0e0e0;${bold?'font-weight:700;':''}">${value}</td>
    </tr>`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Payment Voucher — ${esc(voucherNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#222;background:#fff;padding:24px}
  @media print{body{padding:0}@page{size:A4;margin:14mm}}
</style></head><body>

<!-- Letterhead -->
<div style="display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${brand};padding-bottom:12px;margin-bottom:18px">
  <div style="display:flex;gap:14px;align-items:center">
    ${logoImg}
    <div>
      <div style="font-size:15px;font-weight:700;color:${brand}">${esc(co.name || '')}</div>
      ${co.name_ar ? `<div style="font-size:12px;color:#555;direction:rtl">${esc(co.name_ar)}</div>` : ''}
      <div style="font-size:10px;color:#555;margin-top:3px">${[co.address,co.tel,co.email].filter(Boolean).map(esc).join(' · ')}</div>
      <div style="font-size:10px;color:#555">${co.vat_number?`VAT: ${esc(co.vat_number)}`:''}${co.cr_number?` · CR: ${esc(co.cr_number)}`:''}</div>
    </div>
  </div>
  <div style="text-align:right">
    <div style="font-size:20px;font-weight:700;color:#333;letter-spacing:-.5px">PAYMENT VOUCHER</div>
    ${voucherNo ? `<div style="font-size:12px;color:#555;margin-top:4px">Ref: <strong>${esc(voucherNo)}</strong></div>` : ''}
    <div style="font-size:11px;color:#555;margin-top:3px">Date: <strong>${fmtDate(cheque.issue_date || new Date())}</strong></div>
  </div>
</div>

<!-- Amount highlight -->
<div style="background:${brand};color:#fff;padding:12px 20px;border-radius:5px;display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
  <div style="font-size:13px;font-weight:600">Amount Paid</div>
  <div style="font-size:22px;font-weight:700;letter-spacing:-.5px">BHD ${amount.toFixed(3)}</div>
</div>

<!-- Details table -->
<table style="width:100%;border-collapse:collapse;margin-bottom:18px">
  ${row('Pay To',          esc(cheque.party_name || '—'), true)}
  ${row('Amount (Words)',  esc(words), true)}
  ${row('Payment Method', 'Cheque', false)}
  ${row('Bank',           esc(cheque.bank_name || '—'), false)}
  ${row('Cheque No.',     esc(cheque.cheque_no || '—'), false)}
  ${row('Cheque Date',    fmtDate(cheque.cheque_date), false)}
  ${cheque.invoice_no  ? row('Invoice Ref',  esc(cheque.invoice_no),  false) : ''}
  ${cheque.purchase_no ? row('Purchase Ref', esc(cheque.purchase_no), false) : ''}
  ${cheque.notes       ? row('Notes',        esc(cheque.notes),       false) : ''}
</table>

<!-- Signature boxes -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:24px">
  ${['Prepared By','Authorized By','Received By'].map(lbl => `
  <div style="border:1px solid #ccc;border-radius:4px;padding:12px">
    <div style="font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.5px;color:#555;margin-bottom:32px">${lbl}</div>
    <div style="border-top:1px solid #bbb;padding-top:5px;font-size:9px;color:#777">Name &amp; Signature</div>
  </div>`).join('')}
</div>

<!-- Footer -->
<div style="margin-top:20px;border-top:1px solid #ddd;padding-top:8px;font-size:9.5px;color:#555;display:flex;justify-content:space-between">
  <span>${esc(co.name || '')}${co.vat_number?` · VAT: ${esc(co.vat_number)}`:''}</span>
  <span>Computer generated voucher · ${new Date().toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'})}</span>
</div>

${printControls(brand)}
</body></html>`
}

// ─────────────────────────────────────────────
//  NBB CHEQUE PRINT  (Option B)
//  Calibrated for National Bank of Bahrain
//  Standard cheque: 187 mm × 84 mm (landscape)
//
//  ⚠  Positions are approximate. If fields are
//     misaligned, adjust the mm values in the
//     FIELD POSITIONS section below.
// ─────────────────────────────────────────────
function chequeNbbHtml(cheque, co) {
  const amount = parseFloat(cheque.amount || 0)
  const words  = amountToWordsBhd(amount)

  // Parse cheque date
  const dt = cheque.cheque_date ? new Date(cheque.cheque_date) : new Date()
  const dd  = String(dt.getDate()).padStart(2, '0')
  const mm  = String(dt.getMonth() + 1).padStart(2, '0')
  const yyyy = String(dt.getFullYear())

  // ── FIELD POSITIONS (mm from top-left of cheque) ──────────
  // Adjust these to match your physical NBB cheque:
  const POS = {
    chequeW:    187,   // cheque width  (mm)
    chequeH:     84,   // cheque height (mm)

    payee_x:     28,   // "Pay" line — left edge of payee name
    payee_y:     31,   // "Pay" line — top
    payee_w:    110,   // max width for payee name

    words_x:     10,   // amount-in-words line left
    words_y:     42,   // amount-in-words line top
    words_w:    150,   // max width

    amt_x:      158,   // amount figures box left
    amt_y:       27,   // amount figures box top
    amt_w:       24,   // box width

    date_dd_x:  147,   // day box centre-x
    date_mm_x:  158,   // month box centre-x
    date_yy_x:  169,   // year (last 2 digits) centre-x
    date_y:      16,   // date row top
  }
  // ─────────────────────────────────────────────────────────

  const f = (v) => `${v}mm`

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
<title>Cheque Print — ${esc(cheque.cheque_no || '')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{background:#fff;font-family:Arial,sans-serif}

  /* Screen preview wrapper */
  .preview-wrap{
    display:flex;flex-direction:column;align-items:center;
    padding:20px;background:#e8e8e8;min-height:100vh
  }
  .hint{
    background:#fff3cd;border:1px solid #ffc107;border-radius:4px;
    padding:8px 14px;font-size:11px;color:#5d4037;margin-bottom:12px;
    max-width:${POS.chequeW}mm;width:100%
  }

  /* The cheque itself — exact physical size */
  .cheque{
    width:${f(POS.chequeW)};height:${f(POS.chequeH)};
    position:relative;background:transparent;
    border:1px dashed #aaa; /* remove this line for actual printing */
  }

  .field{
    position:absolute;
    font-family:Arial,sans-serif;
    overflow:hidden;white-space:nowrap;
  }
  .field-payee{
    left:${f(POS.payee_x)};top:${f(POS.payee_y)};width:${f(POS.payee_w)};
    font-size:11pt;font-weight:700;color:#000;
    border-bottom:1px solid #000; /* underline to fill line */
    padding-bottom:1mm;
  }
  .field-words{
    left:${f(POS.words_x)};top:${f(POS.words_y)};width:${f(POS.words_w)};
    font-size:9pt;color:#000;
    white-space:normal;line-height:1.3;
  }
  .field-amount{
    left:${f(POS.amt_x)};top:${f(POS.amt_y)};width:${f(POS.amt_w)};
    font-size:11pt;font-weight:700;color:#000;text-align:right;
    letter-spacing:.5px;
  }
  .field-dd{
    left:${f(POS.date_dd_x)};top:${f(POS.date_y)};width:9mm;
    font-size:10pt;font-weight:700;text-align:center;color:#000;
  }
  .field-mm{
    left:${f(POS.date_mm_x)};top:${f(POS.date_y)};width:9mm;
    font-size:10pt;font-weight:700;text-align:center;color:#000;
  }
  .field-yy{
    left:${f(POS.date_yy_x)};top:${f(POS.date_y)};width:18mm;
    font-size:10pt;font-weight:700;text-align:center;color:#000;
  }

  /* Screen-only controls */
  .controls{
    display:flex;gap:10px;margin-bottom:10px;max-width:${POS.chequeW}mm;width:100%
  }
  .btn-print{
    padding:7px 18px;background:#1a5fa8;color:#fff;border:none;
    border-radius:4px;cursor:pointer;font-size:12px;font-weight:600
  }
  .btn-close{
    padding:7px 14px;background:#eee;color:#333;border:none;
    border-radius:4px;cursor:pointer;font-size:12px
  }

  /* Print rules — hide everything except the cheque fields */
  @media print {
    @page {
      size: ${POS.chequeW}mm ${POS.chequeH}mm;
      margin: 0;
    }
    body { background: transparent; }
    .preview-wrap { background:transparent; padding:0; }
    .controls, .hint { display: none; }
    .cheque { border: none; }
  }
</style></head><body>
<div class="preview-wrap">
  <div class="controls">
    <button class="btn-print" onclick="window.print()">🖨 Print Cheque</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>
  <div class="hint">
    ⚠ <strong>Screen preview only</strong> — the dashed border will not print.
    Load your <strong>NBB cheque</strong> into the printer, select the correct paper size
    (<strong>${POS.chequeW} × ${POS.chequeH} mm</strong>), and disable all scaling / fit-to-page options.
    Print one test sheet on plain paper first to verify alignment.
  </div>

  <!-- Cheque physical area -->
  <div class="cheque">
    <!-- Payee -->
    <div class="field field-payee">${esc(cheque.party_name || '')}</div>

    <!-- Amount in words -->
    <div class="field field-words">${esc(words)}</div>

    <!-- Amount figures -->
    <div class="field field-amount">${amount.toFixed(3)}</div>

    <!-- Date — DD / MM / YYYY -->
    <div class="field field-dd">${dd}</div>
    <div class="field field-mm">${mm}</div>
    <div class="field field-yy">${yyyy}</div>
  </div>
</div>
</body></html>`
}

exports.chequeVoucherHtml = (cheque, co) => Buffer.from(chequeVoucherHtml(cheque, co))
exports.chequeNbbHtml     = (cheque, co) => Buffer.from(chequeNbbHtml(cheque, co))
