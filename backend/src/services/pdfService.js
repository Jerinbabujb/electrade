// PDF Service — generates HTML that the browser prints as PDF
// No Puppeteer / Chromium needed. The /pdf endpoints return
// a full HTML page with print CSS. User clicks Print → Save as PDF.

const TYPE_META = {
  tax_invoice:  { en:'TAX INVOICE',      ar:'فاتورة ضريبية',   refLabel:'Invoice No.',     footer:'Computer-generated tax invoice · فاتورة ضريبية معتمدة' },
  quotation:    { en:'QUOTATION',         ar:'عرض سعر',          refLabel:'Quotation No.',   footer:'This quotation is not a tax invoice · عرض سعر' },
  proforma:     { en:'PROFORMA INVOICE',  ar:'فاتورة مبدئية',   refLabel:'Proforma No.',    footer:'Proforma invoice — not a tax invoice · فاتورة مبدئية' },
  credit_note:  { en:'CREDIT NOTE',       ar:'إشعار دائن',       refLabel:'Credit Note No.', footer:'Computer-generated credit note · إشعار دائن' },
  receipt:      { en:'RECEIPT',           ar:'إيصال',             refLabel:'Receipt No.',     footer:'Computer-generated receipt · إيصال' },
}

function fmtDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  if (isNaN(d)) return String(val)
  return d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function invoiceHtml(inv) {
  const co    = inv.company || {}
  const items = inv.items   || []
  const meta  = TYPE_META[inv.type] || TYPE_META.tax_invoice
  const brand = (co.theme_color && /^#[0-9a-fA-F]{6}$/.test(co.theme_color)) ? co.theme_color : '#1a5fa8'

  const subtotal   = items.reduce((s,i) => s + parseFloat(i.net_amount  || 0), 0)
  const totalVat   = items.reduce((s,i) => s + parseFloat(i.vat_amount  || 0), 0)
  const grandTotal = subtotal + totalVat + parseFloat(inv.shipping || 0)
  const balance    = parseFloat(inv.balance_due ?? grandTotal)

  const hasDiscount = items.some(it => parseFloat(it.discount || 0) > 0)

  const rows = items.map((it,i) => `
    <tr class="${i%2?'s':''}">
      <td>${i+1}</td>
      <td>${esc(it.part_no||'')}</td>
      <td>${esc(it.description||'')}</td>
      <td class="r">${parseFloat(it.qty||0).toFixed(3)}</td>
      <td>${esc(it.unit||'')}</td>
      <td class="r">${parseFloat(it.unit_price||0).toFixed(3)}</td>
      ${hasDiscount ? `<td class="r">${parseFloat(it.discount||0).toFixed(3)}</td>` : ''}
      <td class="r">${parseFloat(it.vat_rate||10).toFixed(0)}%</td>
      <td class="r">${parseFloat(it.line_total||0).toFixed(3)}</td>
    </tr>`).join('')

  const linkedDns = (inv.linked_dns||[]).filter(Boolean)
    .map(d => `<span class="chip">${esc(d.dn_no||d)}</span>`).join(' ')

  const statusColor = { paid:'#2e7d32', unpaid:'#e65100', overdue:'#c62828', partial:'#1565c0' }
  const sc = statusColor[inv.payment_status] || '#e65100'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${esc(inv.invoice_no||'Invoice')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#1a1a1a;background:#fff}
  .hdr{background:${brand};color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start}
  .co-name{font-size:15px;font-weight:700}
  .co-ar{font-size:12px;margin-top:3px;opacity:.85}
  .co-meta{font-size:9.5px;margin-top:5px;opacity:.8;line-height:1.6}
  .inv-box{background:#fff;color:${brand};padding:8px 14px;border-radius:4px;text-align:center;min-width:140px}
  .inv-box-title{font-size:13px;font-weight:700}
  .inv-box-ar{font-size:9px;color:#888;margin-top:2px}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 18px;background:#f8f8f8;border-bottom:1px solid #e0e0e0}
  .box{background:#fff;border:1px solid #e0e0e0}
  .box-hd{background:${brand};color:#fff;padding:3px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
  .box-body{padding:8px}
  .cname{font-size:12px;font-weight:700;margin-bottom:4px}
  .cmeta{font-size:10px;color:#666;line-height:1.6}
  .meta-tbl{width:100%;font-size:10.5px;border-collapse:collapse}
  .meta-tbl td{padding:2px 0}
  .meta-tbl td:last-child{text-align:right;font-weight:600}
  table.items{width:100%;border-collapse:collapse;font-size:11px;margin:0 18px;width:calc(100% - 36px)}
  table.items th{background:${brand};color:#fff;padding:5px 5px;text-align:left;font-size:10.5px}
  table.items th.r, table.items td.r{text-align:right}
  table.items td{padding:4px 5px;border-bottom:1px solid #e8e8e8}
  table.items tr.s{background:#f7f7f7}
  .totals{display:flex;justify-content:flex-end;padding:8px 18px}
  .tot-tbl{width:240px;font-size:11.5px;border-collapse:collapse}
  .tot-tbl td{padding:3px 5px}
  .tot-tbl .grand{font-size:13px;font-weight:700;color:${brand};border-top:2px solid ${brand}}
  .tot-tbl .grand td{padding:5px 5px}
  .balance{padding:3px 8px;border-radius:3px;font-weight:700;font-size:11px;display:inline-block}
  .dns{padding:7px 18px;background:#e8f0fb;border-top:1px solid #b0c8f0;font-size:10.5px;color:${brand}}
  .chip{display:inline-block;padding:1px 7px;background:#fff;border:1px solid #b0c8f0;border-radius:10px;margin:1px;font-size:10px}
  .notes{padding:8px 18px;background:#f8f8f8;border-top:1px solid #e0e0e0;font-size:10.5px}
  .bank{padding:7px 18px;font-size:10px;color:#555;border-top:1px solid #e0e0e0}
  .ftr{background:${brand};color:#cce0ff;padding:6px 18px;font-size:9.5px;text-align:center;margin-top:8px}
  .print-btn{position:fixed;top:12px;right:12px;padding:8px 16px;background:${brand};color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;z-index:999}
  @media print{.print-btn{display:none}body{font-size:10.5px}@page{margin:10mm;size:A4}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>

<div class="hdr">
  <div style="display:flex;align-items:center;gap:12px">
    ${co.logo ? `<img src="${co.logo}" alt="logo" style="height:54px;max-width:160px;object-fit:contain;background:#fff;border-radius:3px;padding:3px">` : ''}
    <div>
      <div class="co-name">${esc(co.name||'Al Manama Electrical Trading Co. W.L.L')}</div>
      <div class="co-ar">${esc(co.name_ar||'شركة المنامة لتجارة الكهربائيات')}</div>
      <div class="co-meta">
        ${esc(co.address||'Salmaniya Industrial Area, Manama, Bahrain')}<br>
        Tel: ${esc(co.tel||'+973 1711 2233')} &nbsp;|&nbsp;
        VAT Reg: ${esc(co.vat_number||'')} &nbsp;|&nbsp;
        CR: ${esc(co.cr_number||'')}
      </div>
    </div>
  </div>
  <div class="inv-box">
    <div class="inv-box-title">${meta.en}</div>
    <div class="inv-box-ar">${meta.ar}</div>
  </div>
</div>

<div class="info">
  <div class="box">
    <div class="box-hd">Bill To</div>
    <div class="box-body">
      <div class="cname">${esc(inv.customer_name||'')}</div>
      <div class="cmeta">
        VAT: ${esc(inv.customer_vat||'—')}<br>
        CR: ${esc(inv.customer_cr||'—')}
      </div>
    </div>
  </div>
  <div class="box">
    <div class="box-hd">Document Details</div>
    <div class="box-body">
      <table class="meta-tbl">
        <tr><td>${meta.refLabel}</td><td>${esc(inv.invoice_no||'')}</td></tr>
        <tr><td>Date</td><td>${fmtDate(inv.invoice_date)}</td></tr>
        ${(inv.type === 'quotation' || inv.type === 'proforma') && inv.valid_until
          ? `<tr><td>Valid Until</td><td>${fmtDate(inv.valid_until)}</td></tr>`
          : inv.due_date ? `<tr><td>Due Date</td><td>${fmtDate(inv.due_date)}</td></tr>` : ''}
        ${(inv.type !== 'quotation' && inv.type !== 'proforma') ? `<tr><td>PO Reference</td><td>${esc(inv.po_reference||'—')}</td></tr>` : ''}
        ${inv.po_reference && (inv.type === 'quotation' || inv.type === 'proforma') ? `<tr><td>Client Ref</td><td>${esc(inv.po_reference)}</td></tr>` : ''}
      </table>
    </div>
  </div>
</div>

<div style="padding:10px 18px">
<table class="items">
  <thead><tr>
    <th>#</th><th>Part No.</th><th>Description</th>
    <th class="r">Qty</th><th>Unit</th><th class="r">Unit Price</th>
    ${hasDiscount ? '<th class="r">Discount</th>' : ''}
    <th class="r">VAT%</th><th class="r">Amount BHD</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>
</div>

<div class="totals">
  <table class="tot-tbl">
    <tr><td>Subtotal:</td><td style="text-align:right">BHD ${subtotal.toFixed(3)}</td></tr>
    <tr><td>VAT (10%):</td><td style="text-align:right;color:#c62828">BHD ${totalVat.toFixed(3)}</td></tr>
    <tr><td>Shipping:</td><td style="text-align:right">BHD ${parseFloat(inv.shipping||0).toFixed(3)}</td></tr>
    <tr class="grand">
      <td>GRAND TOTAL:</td>
      <td style="text-align:right">BHD ${grandTotal.toFixed(3)}</td>
    </tr>
    <tr>
      <td style="font-size:10px;color:#888">Balance Due:</td>
      <td style="text-align:right">
        <span class="balance" style="background:${balance>0?'#fff8e1':'#e8f5e9'};color:${sc}">
          BHD ${balance.toFixed(3)}
        </span>
      </td>
    </tr>
  </table>
</div>

${linkedDns ? `<div class="dns">📦 This invoice covers Delivery Notes: ${linkedDns}</div>` : ''}
${inv.notes ? `<div class="notes"><strong>Notes:</strong> ${esc(inv.notes)}</div>` : ''}

<div class="bank">
  <strong>Payment:</strong>
  ${esc(co.bank_name||'Bank of Bahrain and Kuwait (BBK)')} &nbsp;|&nbsp;
  IBAN: ${esc(co.bank_iban||'—')} &nbsp;|&nbsp;
  SWIFT: ${esc(co.bank_swift||'—')}
</div>

<div class="ftr">
  ${esc(co.name||'Al Manama Electrical Trading Co. W.L.L')} &nbsp;|&nbsp;
  VAT: ${esc(co.vat_number||'')} &nbsp;|&nbsp; CR: ${esc(co.cr_number||'')} <br>
  ${meta.footer}
</div>
</body></html>`
}

function dnHtml(dn) {
  const co    = dn.company || {}
  const items = dn.items   || []
  const brand = (co.theme_color && /^#[0-9a-fA-F]{6}$/.test(co.theme_color)) ? co.theme_color : '#00695c'

  const rows = items.map((it,i) => `
    <tr class="${i%2?'s':''}">
      <td>${i+1}</td>
      <td>${esc(it.part_no||'')}</td>
      <td>${esc(it.description||it.product_name||'')}</td>
      <td class="r">${parseFloat(it.qty_ordered||0).toFixed(3)}</td>
      <td class="r">${parseFloat(it.qty_delivered||0).toFixed(3)}</td>
      <td>${esc(it.unit||'')}</td>
    </tr>`).join('')

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Delivery Note ${esc(dn.dn_no||'')}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:'Segoe UI',Arial,sans-serif;font-size:11.5px;color:#1a1a1a;background:#fff}
  .hdr{background:${brand};color:#fff;padding:14px 18px;display:flex;justify-content:space-between;align-items:flex-start}
  .co-name{font-size:15px;font-weight:700}
  .co-ar{font-size:12px;margin-top:3px;opacity:.85}
  .co-meta{font-size:9.5px;margin-top:5px;opacity:.8;line-height:1.6}
  .dn-box{background:#fff;color:${brand};padding:8px 14px;border-radius:4px;text-align:center;min-width:140px}
  .dn-box-title{font-size:13px;font-weight:700}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:10px 18px;background:#f8f8f8;border-bottom:1px solid #e0e0e0}
  .box{background:#fff;border:1px solid #e0e0e0}
  .box-hd{background:${brand};color:#fff;padding:3px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.3px}
  .box-body{padding:8px}
  .meta-tbl{width:100%;font-size:10.5px;border-collapse:collapse}
  .meta-tbl td{padding:2px 0}
  .meta-tbl td:last-child{text-align:right;font-weight:600}
  table.items{width:calc(100% - 36px);border-collapse:collapse;font-size:11px;margin:10px 18px}
  table.items th{background:${brand};color:#fff;padding:5px;text-align:left;font-size:10.5px}
  table.items th.r,table.items td.r{text-align:right}
  table.items td{padding:4px 5px;border-bottom:1px solid #e8e8e8}
  table.items tr.s{background:#f7f7f7}
  .notice{margin:10px 18px;padding:8px 12px;background:#fff8e1;border-left:4px solid #f57c00;font-size:10.5px;color:#5d4037}
  .sigs{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin:12px 18px}
  .sig-box{border:1px solid #ddd;padding:10px;background:#f8f8f8}
  .sig-lbl{font-size:10px;font-weight:700;color:#555;margin-bottom:20px}
  .sig-line{border-top:1px solid #bbb;margin-top:16px;padding-top:4px;font-size:9px;color:#888}
  .ftr{background:${brand};color:#cce8e0;padding:6px 18px;font-size:9.5px;text-align:center;margin-top:10px}
  .print-btn{position:fixed;top:12px;right:12px;padding:8px 16px;background:${brand};color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:600;z-index:999}
  @media print{.print-btn{display:none}@page{margin:10mm;size:A4}}
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>

<div class="hdr">
  <div style="display:flex;align-items:center;gap:12px">
    ${co.logo ? `<img src="${co.logo}" alt="logo" style="height:54px;max-width:160px;object-fit:contain;background:#fff;border-radius:3px;padding:3px">` : ''}
    <div>
      <div class="co-name">${esc(co.name||'')}</div>
      ${co.name_ar ? `<div class="co-ar">${esc(co.name_ar)}</div>` : ''}
      <div class="co-meta">
        ${esc(co.address||'')}${co.tel ? ` &nbsp;|&nbsp; Tel: ${esc(co.tel)}` : ''}
        ${co.vat_number ? ` &nbsp;|&nbsp; VAT: ${esc(co.vat_number)}` : ''}
        ${co.cr_number  ? ` &nbsp;|&nbsp; CR: ${esc(co.cr_number)}`  : ''}
      </div>
    </div>
  </div>
  <div class="dn-box">
    <div class="dn-box-title">DELIVERY NOTE</div>
    <div style="font-size:9px;color:#888;margin-top:2px">مذكرة تسليم</div>
  </div>
</div>

<div class="info">
  <div class="box">
    <div class="box-hd">Deliver To</div>
    <div class="box-body">
      <div style="font-size:12px;font-weight:700;margin-bottom:4px">${esc(dn.customer_name||'')}</div>
      <div style="font-size:10px;color:#666;line-height:1.7">
        ${esc(dn.delivery_address||dn.customer_address||'—')}<br>
        Project: ${esc(dn.project_ref||'—')}
      </div>
    </div>
  </div>
  <div class="box">
    <div class="box-hd">Delivery Details</div>
    <div class="box-body">
      <table class="meta-tbl">
        <tr><td>DN No.</td><td>${esc(dn.dn_no||'')}</td></tr>
        <tr><td>Date</td><td>${fmtDate(dn.dn_date)}</td></tr>
        <tr><td>PO Reference</td><td>${esc(dn.po_reference||'Pending')}</td></tr>
        <tr><td>Delivered By</td><td>${esc(dn.delivered_by||'—')}</td></tr>
      </table>
    </div>
  </div>
</div>

<table class="items">
  <thead><tr>
    <th>#</th><th>Part No.</th><th>Description</th>
    <th class="r">Qty Ordered</th><th class="r">Qty Delivered</th><th>Unit</th>
  </tr></thead>
  <tbody>${rows}</tbody>
</table>

<div class="notice">
  <strong>This is not a tax invoice.</strong> Invoice will be raised upon receipt of client PO.
  ${dn.linked_invoice_no ? `&nbsp;|&nbsp; Invoiced under: <strong>${esc(dn.linked_invoice_no)}</strong>` : ''}
</div>

<div class="sigs">
  <div class="sig-box">
    <div class="sig-lbl">Prepared By</div>
    <div class="sig-line">Signature / Date</div>
  </div>
  <div class="sig-box">
    <div class="sig-lbl">Delivered By / Driver</div>
    <div style="font-size:10px;margin-bottom:12px">${esc(dn.delivered_by||'')}</div>
    <div class="sig-line">Signature / Date</div>
  </div>
  <div class="sig-box">
    <div class="sig-lbl">Received By (Client)</div>
    <div class="sig-line">Name / Signature / Date</div>
  </div>
</div>

<div class="ftr">
  ${esc(co.name||'')} &nbsp;|&nbsp;
  ${co.vat_number ? `VAT: ${esc(co.vat_number)} &nbsp;|&nbsp;` : ''}
  This delivery note does not constitute a tax invoice &nbsp;|&nbsp; هذا ليس فاتورة ضريبية
</div>
</body></html>`
}

function esc(str) {
  return String(str||'')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// Public API — return HTML buffer (browser opens and user prints to PDF)
exports.generateInvoicePdf = async (inv) => Buffer.from(invoiceHtml(inv))
exports.generateDnPdf      = async (dn)  => Buffer.from(dnHtml(dn))

// Content type for routes
exports.contentType = 'text/html; charset=utf-8'
