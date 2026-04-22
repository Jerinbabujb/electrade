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

// ── Send team invite ──────────────────────────────────────
// { email, company_name, role, link }
exports.sendInvite = async ({ email, company_name, role, link }) => {
  const html = `
  <div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;max-width:560px">
    <div style="background:#1a5fa8;color:#fff;padding:14px 20px">
      <h2 style="margin:0;font-size:16px">You've been invited to ${company_name}</h2>
    </div>
    <div style="padding:20px">
      <p>You've been invited to join <strong>${company_name}</strong> as a <strong>${role}</strong>.</p>
      <p style="margin-top:14px">Click the button below to set your password and access the system:</p>
      <div style="margin:20px 0;text-align:center">
        <a href="${link}" style="background:#1a5fa8;color:#fff;padding:12px 28px;border-radius:4px;
           text-decoration:none;font-weight:700;font-size:14px;display:inline-block">
          Accept Invitation
        </a>
      </div>
      <p style="font-size:11px;color:#888">
        Or copy this link: <a href="${link}" style="color:#1a5fa8">${link}</a>
      </p>
      <p style="font-size:11px;color:#aaa;margin-top:16px">
        This invite expires in 7 days. If you did not expect this email, you can ignore it.
      </p>
    </div>
  </div>`

  await transporter.sendMail({
    from:    `"${company_name}" <${process.env.SMTP_USER}>`,
    to:      email,
    subject: `You're invited to join ${company_name}`,
    html,
  })
}

// ── Send low-stock alert ───────────────────────────────────
// products: [{ sku, name, category, stock_qty, stock_min, cost_price }]
exports.sendLowStockAlert = async (products, toEmail, company_id) => {
  const co    = await getCompany(company_id)
  const brand = brandColor(co)

  const rows = products.map(p => `
    <tr>
      <td style="padding:6px 10px;border:1px solid #e0e0e0;font-weight:600">${p.sku || '—'}</td>
      <td style="padding:6px 10px;border:1px solid #e0e0e0">${p.name}</td>
      <td style="padding:6px 10px;border:1px solid #e0e0e0;color:#888">${p.category || 'Uncategorised'}</td>
      <td style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;color:#c62828;font-weight:700">
        ${parseFloat(p.stock_qty).toFixed(3)}
      </td>
      <td style="padding:6px 10px;border:1px solid #e0e0e0;text-align:right;color:#888">
        ${parseFloat(p.stock_min).toFixed(3)}
      </td>
    </tr>`).join('')

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;max-width:650px">
    ${emailHeader(co)}
    <div style="padding:20px">
      <div style="background:#fff8e1;border-left:4px solid #f57f17;padding:10px 14px;margin-bottom:16px;font-size:13px">
        <strong>⚠️ Low Stock Alert</strong> — ${products.length} product${products.length === 1 ? '' : 's'} at or below minimum stock level
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:${brand};color:#fff">
            <th style="padding:7px 10px;text-align:left">SKU</th>
            <th style="padding:7px 10px;text-align:left">Product</th>
            <th style="padding:7px 10px;text-align:left">Category</th>
            <th style="padding:7px 10px;text-align:right">Current Stock</th>
            <th style="padding:7px 10px;text-align:right">Min Stock</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="margin-top:16px;font-size:11px;color:#888">
        This is an automated alert from ${co.name || 'ElecTrade'}.
        Please review stock levels and place purchase orders as needed.
      </p>
    </div>
    ${emailFooter(co)}
  </div>`

  await transporter.sendMail({
    from:    fromAddr(co),
    to:      toEmail,
    subject: `[Low Stock Alert] ${products.length} product${products.length === 1 ? '' : 's'} below minimum — ${co.name || 'ElecTrade'}`,
    html,
  })
}

// ── Send recurring expense reminder ───────────────────────
// items: [{ description, next_due_date, total_amount, frequency, days_until_due, notes }]
exports.sendRecurringReminder = async (items, toEmail, company_id) => {
  const co    = await getCompany(company_id)
  const brand = brandColor(co)

  const overdue  = items.filter(i => i.days_until_due < 0)
  const dueToday = items.filter(i => i.days_until_due === 0)
  const upcoming = items.filter(i => i.days_until_due > 0)

  const urgencyColor = overdue.length ? '#c62828' : dueToday.length ? '#e65100' : '#1565c0'
  const urgencyLabel = overdue.length
    ? `${overdue.length} overdue payment${overdue.length > 1 ? 's' : ''} requiring immediate action`
    : dueToday.length
    ? `${dueToday.length} payment${dueToday.length > 1 ? 's' : ''} due today`
    : `${upcoming.length} upcoming payment${upcoming.length > 1 ? 's' : ''} — action required`

  const itemRow = (item) => {
    const daysLabel = item.days_until_due < 0
      ? `<span style="color:#c62828;font-weight:700">${Math.abs(item.days_until_due)} days OVERDUE</span>`
      : item.days_until_due === 0
      ? `<span style="color:#e65100;font-weight:700">Due TODAY</span>`
      : `<span style="color:#1565c0;font-weight:700">Due in ${item.days_until_due} days</span>`
    return `
    <tr>
      <td style="padding:8px 10px;border:1px solid #e0e0e0;font-weight:600">${item.description}</td>
      <td style="padding:8px 10px;border:1px solid #e0e0e0;text-align:right;font-weight:700">
        BHD ${parseFloat(item.total_amount).toFixed(3)}
      </td>
      <td style="padding:8px 10px;border:1px solid #e0e0e0">${fmtDate(item.next_due_date)}</td>
      <td style="padding:8px 10px;border:1px solid #e0e0e0">${daysLabel}</td>
      <td style="padding:8px 10px;border:1px solid #e0e0e0;font-size:11px;color:#888">${item.notes || '—'}</td>
    </tr>`
  }

  const totalDue = items.reduce((s, i) => s + parseFloat(i.total_amount || 0), 0)

  const html = `
  <div style="font-family:Arial,sans-serif;font-size:13px;color:#1a1a1a;max-width:680px">
    ${emailHeader(co)}
    <div style="padding:20px">
      <div style="background:${urgencyColor}18;border-left:4px solid ${urgencyColor};padding:10px 14px;margin-bottom:16px;font-size:13px">
        <strong style="color:${urgencyColor}">🔔 Payment Reminder — ${urgencyLabel}</strong>
      </div>
      <p style="margin-bottom:16px;color:#555">
        The following recurring payments require your attention.
        Please make the necessary payments and record them in the system.
      </p>
      <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:16px">
        <thead>
          <tr style="background:${brand};color:#fff">
            <th style="padding:7px 10px;text-align:left">Description</th>
            <th style="padding:7px 10px;text-align:right">Amount (BHD)</th>
            <th style="padding:7px 10px;text-align:left">Due Date</th>
            <th style="padding:7px 10px;text-align:left">Status</th>
            <th style="padding:7px 10px;text-align:left">Notes / Ref</th>
          </tr>
        </thead>
        <tbody>
          ${[...overdue, ...dueToday, ...upcoming].map(itemRow).join('')}
        </tbody>
      </table>
      <div style="background:#f8f8f8;border:1px solid #e0e0e0;padding:10px 14px;border-radius:4px;font-size:13px">
        Total due: <strong style="color:${urgencyColor};font-size:15px">BHD ${totalDue.toFixed(3)}</strong>
      </div>
      <p style="margin-top:16px;font-size:11px;color:#888">
        After making payment, log in to record the transaction: Expenses → Recurring Templates → Post Now.
        This automated reminder was sent from ${co.name || 'ElecTrade'}.
      </p>
    </div>
    ${emailFooter(co)}
  </div>`

  await transporter.sendMail({
    from:    fromAddr(co),
    to:      toEmail,
    subject: `[Payment Reminder] ${urgencyLabel} — ${co.name || 'ElecTrade'}`,
    html,
  })
}
