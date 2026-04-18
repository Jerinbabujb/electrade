const nodemailer = require('nodemailer')
const pdfSvc     = require('./pdfService')
const db         = require('../db')

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST   || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_PORT === '465',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

// Fetch company data for email rendering
async function getCompany(company_id) {
  const { rows: [co] } = await db.query(
    `SELECT name, name_ar, address, tel, email, vat_number, cr_number,
            bank_name, bank_acct_name, bank_iban, bank_swift, logo, theme_color
     FROM companies WHERE id = $1`, [company_id])
  return co || {}
}

function fromAddr(co) {
  return `"${co.name || 'ElecTrade'}" <${process.env.SMTP_USER}>`
}

function brandColor(co) {
  return (co.theme_color && /^#[0-9a-fA-F]{6}$/.test(co.theme_color)) ? co.theme_color : '#1a5fa8'
}

function fmtDate(val) {
  if (!val) return '—'
  const d = new Date(val)
  return isNaN(d) ? String(val) : d.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })
}

function emailHeader(co) {
  const brand = brandColor(co)
  return `
  <div style="background:${brand};color:#fff;padding:16px 20px;display:flex;align-items:center;gap:14px">
    ${co.logo ? `<img src="${co.logo}" alt="logo" style="height:44px;max-width:130px;object-fit:contain;background:#fff;border-radius:3px;padding:3px">` : ''}
    <div>
      <h2 style="margin:0;font-size:16px">${co.name || ''}</h2>
      ${co.address ? `<p style="margin:4px 0 0;font-size:11px;opacity:.85">${co.address}</p>` : ''}
    </div>
  </div>`
}

function emailFooter(co) {
  const brand = brandColor(co)
  return `
  <div style="background:${brand};color:#cce0ff;padding:8px 20px;font-size:10px;text-align:center;margin-top:0">
    ${co.name || ''}
    ${co.vat_number ? ` | VAT Reg: ${co.vat_number}` : ''}
    ${co.cr_number  ? ` | CR: ${co.cr_number}` : ''}
    ${co.tel        ? ` | Tel: ${co.tel}` : ''}
  </div>`
}

function bankBlock(co) {
  if (!co.bank_iban && !co.bank_name) return ''
  return `
  <div style="margin-top:16px;padding:10px;background:#f8f8f8;border-left:4px solid ${brandColor(co)};font-size:11px;color:#555">
    <strong>Bank Transfer Details:</strong><br>
    ${co.bank_name      ? `Bank: ${co.bank_name}<br>` : ''}
    ${co.bank_acct_name ? `Account Name: ${co.bank_acct_name}<br>` : ''}
    ${co.bank_iban      ? `IBAN: ${co.bank_iban}<br>` : ''}
    ${co.bank_swift     ? `SWIFT: ${co.bank_swift}` : ''}
  </div>`
}

// ── Send invoice by email ──────────────────────────────────
exports.sendInvoice = async (inv, toEmail) => {
  const co    = await getCompany(inv.company_id)
  const brand = brandColor(co)
  const pdf   = await pdfSvc.generateInvoicePdf({ ...inv, company: co })

  const subject = `${inv.type === 'quotation' ? 'Quotation' : inv.type === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice'} ${inv.invoice_no} — ${co.name || ''}`

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;max-width:600px">
    ${emailHeader(co)}
    <div style="padding:20px">
      <p>Dear ${inv.customer_name},</p>
      <p style="margin-top:10px">Please find attached
        <strong>${inv.type === 'quotation' ? 'Quotation' : inv.type === 'proforma' ? 'Proforma Invoice' : 'Tax Invoice'} ${inv.invoice_no}</strong>
        dated ${fmtDate(inv.invoice_date)} for <strong>BHD ${parseFloat(inv.grand_total).toFixed(3)}</strong>.</p>
      <table style="margin:16px 0;border-collapse:collapse;width:100%;font-size:12px">
        <tr style="background:#e8f0fb">
          <td style="padding:6px 10px;border:1px solid #b0c8f0"><strong>Reference No.</strong></td>
          <td style="padding:6px 10px;border:1px solid #b0c8f0;font-weight:700">${inv.invoice_no}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">Date</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${fmtDate(inv.invoice_date)}</td>
        </tr>
        ${inv.due_date ? `
        <tr style="background:#f8f8f8">
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${inv.type === 'quotation' ? 'Valid Until' : 'Due Date'}</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${fmtDate(inv.due_date)}</td>
        </tr>` : ''}
        ${inv.po_reference && inv.type === 'tax_invoice' ? `
        <tr>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">PO Reference</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${inv.po_reference}</td>
        </tr>` : ''}
        <tr style="background:#e8f0fb">
          <td style="padding:6px 10px;border:1px solid #b0c8f0"><strong>Grand Total (BHD)</strong></td>
          <td style="padding:6px 10px;border:1px solid #b0c8f0;font-weight:700;color:${brand};font-size:14px">
            BHD ${parseFloat(inv.grand_total).toFixed(3)}</td>
        </tr>
      </table>
      ${inv.type === 'tax_invoice' ? `
      <p style="font-size:11px;color:#555">
        Payment due by <strong>${fmtDate(inv.due_date) || '30 days from invoice date'}</strong>.
        Please use <strong>${inv.invoice_no}</strong> as payment reference.
      </p>
      ${bankBlock(co)}` : ''}
      ${co.tel || co.email ? `
      <p style="margin-top:16px;font-size:11px;color:#888">
        For queries, contact us${co.tel ? ` at ${co.tel}` : ''}${co.email ? ` or ${co.email}` : ''}.
      </p>` : ''}
    </div>
    ${emailFooter(co)}
  </div>`

  await transporter.sendMail({
    from:        fromAddr(co),
    to:          toEmail,
    subject,
    html,
    attachments: [{ filename: `${inv.invoice_no}.pdf`, content: pdf, contentType: 'application/pdf' }],
  })
}

// ── Send Delivery Note by email ────────────────────────────
exports.sendDeliveryNote = async (dn, toEmail) => {
  const co  = await getCompany(dn.company_id)
  const pdf = await pdfSvc.generateDnPdf({ ...dn, company: co })

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;max-width:600px">
    ${emailHeader(co)}
    <div style="padding:20px">
      <p>Dear ${dn.customer_name},</p>
      <p style="margin-top:10px">Please find attached <strong>Delivery Note ${dn.dn_no}</strong> dated ${fmtDate(dn.dn_date)}.</p>
      <table style="margin:16px 0;border-collapse:collapse;width:100%;font-size:12px">
        <tr style="background:#e8f5e9">
          <td style="padding:6px 10px;border:1px solid #a5d6a7"><strong>DN No.</strong></td>
          <td style="padding:6px 10px;border:1px solid #a5d6a7;font-weight:700">${dn.dn_no}</td>
        </tr>
        <tr>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">Date</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${fmtDate(dn.dn_date)}</td>
        </tr>
        ${dn.project_ref ? `
        <tr style="background:#f8f8f8">
          <td style="padding:6px 10px;border:1px solid #e0e0e0">Project / Reference</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${dn.project_ref}</td>
        </tr>` : ''}
        <tr>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">PO Reference</td>
          <td style="padding:6px 10px;border:1px solid #e0e0e0">${dn.po_reference || 'Pending'}</td>
        </tr>
      </table>
      <p style="font-size:11px;color:#888;margin-top:8px">
        <strong>Note:</strong> This delivery note is not a tax invoice.
        An invoice will be raised upon receipt of your Purchase Order.
      </p>
      ${co.tel || co.email ? `
      <p style="margin-top:12px;font-size:11px;color:#888">
        For queries, contact us${co.tel ? ` at ${co.tel}` : ''}${co.email ? ` or ${co.email}` : ''}.
      </p>` : ''}
    </div>
    ${emailFooter(co)}
  </div>`

  await transporter.sendMail({
    from:        fromAddr(co),
    to:          toEmail,
    subject:     `Delivery Note ${dn.dn_no} — ${co.name || ''}`,
    html,
    attachments: [{ filename: `${dn.dn_no}.pdf`, content: pdf, contentType: 'application/pdf' }],
  })
}

// ── Send payment reminder ──────────────────────────────────
exports.sendPaymentReminder = async (inv, toEmail) => {
  const co       = await getCompany(inv.company_id)
  const brand    = brandColor(co)
  const isOverdue = inv.due_date && new Date(inv.due_date) < new Date()
  const headerColor = isOverdue ? '#c62828' : '#e65100'

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;max-width:600px">
    <div style="background:${headerColor};color:#fff;padding:12px 20px;display:flex;align-items:center;gap:12px">
      ${co.logo ? `<img src="${co.logo}" alt="logo" style="height:36px;max-width:100px;object-fit:contain;background:#fff;border-radius:2px;padding:2px">` : ''}
      <h2 style="margin:0;font-size:15px">${isOverdue ? 'OVERDUE INVOICE' : 'Payment Reminder'} — ${co.name || ''}</h2>
    </div>
    <div style="padding:20px">
      <p>Dear ${inv.customer_name},</p>
      <p style="margin-top:10px">
        ${isOverdue
          ? `Invoice <strong>${inv.invoice_no}</strong> was due on <strong>${fmtDate(inv.due_date)}</strong> and is now <strong style="color:#c62828">overdue</strong>.`
          : `This is a friendly reminder that Invoice <strong>${inv.invoice_no}</strong> is due on <strong>${fmtDate(inv.due_date)}</strong>.`
        }
      </p>
      <div style="margin:16px 0;padding:12px 16px;background:${isOverdue?'#fdecea':'#fff8e1'};border-left:4px solid ${headerColor};font-size:14px">
        Outstanding balance: <strong style="color:${headerColor};font-size:16px">BHD ${parseFloat(inv.balance_due||inv.grand_total).toFixed(3)}</strong>
      </div>
      <table style="margin:0 0 16px;border-collapse:collapse;width:100%;font-size:12px">
        <tr><td style="padding:5px 10px;border:1px solid #e0e0e0;background:#f8f8f8">Invoice No.</td>
            <td style="padding:5px 10px;border:1px solid #e0e0e0;font-weight:700">${inv.invoice_no}</td></tr>
        ${inv.po_reference ? `
        <tr><td style="padding:5px 10px;border:1px solid #e0e0e0;background:#f8f8f8">PO Reference</td>
            <td style="padding:5px 10px;border:1px solid #e0e0e0">${inv.po_reference}</td></tr>` : ''}
        <tr><td style="padding:5px 10px;border:1px solid #e0e0e0;background:#f8f8f8">Invoice Date</td>
            <td style="padding:5px 10px;border:1px solid #e0e0e0">${fmtDate(inv.invoice_date)}</td></tr>
        <tr><td style="padding:5px 10px;border:1px solid #e0e0e0;background:#f8f8f8">Due Date</td>
            <td style="padding:5px 10px;border:1px solid #e0e0e0;color:${isOverdue?'#c62828':'inherit'};font-weight:${isOverdue?'700':'400'}">${fmtDate(inv.due_date)}</td></tr>
      </table>
      ${bankBlock(co)}
      <p style="margin-top:16px;font-size:11px;color:#555">
        Please arrange payment at your earliest convenience and quote the invoice number as payment reference.
        ${co.tel || co.email ? `For queries, contact us${co.tel ? ` at ${co.tel}` : ''}${co.email ? ` or ${co.email}` : ''}.` : ''}
      </p>
    </div>
    ${emailFooter(co)}
  </div>`

  await transporter.sendMail({
    from:    fromAddr(co),
    to:      toEmail,
    subject: `${isOverdue ? 'OVERDUE: ' : 'Payment Reminder: '}Invoice ${inv.invoice_no} — BHD ${parseFloat(inv.balance_due||inv.grand_total).toFixed(3)} outstanding`,
    html,
  })
}
