import axios from 'axios'
import toast from 'react-hot-toast'


const API_BASE_URL = import.meta.env.VITE_API_URL 
  ? `${import.meta.env.VITE_API_URL}/api/v1` 
  : '/api/v1';
  
const api = axios.create({
  baseURL: 'API_BASE_URL',
  timeout: 30000,
})

// Attach JWT on every request
api.interceptors.request.use(config => {
  const token = localStorage.getItem('et_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

// Handle 401 globally — redirect to login
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('et_token')
      localStorage.removeItem('et_user')
      window.location.href = '/login'
    } else if (err.response?.status !== 404) {
      const msg = err.response?.data?.error?.message || 'An error occurred'
      toast.error(msg)
    }
    return Promise.reject(err)
  }
)

// ── Invoices ───────────────────────────────────
export const invoiceApi = {
  list:          (params)    => api.get('/invoices', { params }),
  get:           (id)        => api.get(`/invoices/${id}`),
  create:        (data)      => api.post('/invoices', data),
  update:        (id, data)  => api.put(`/invoices/${id}`, data),
  void:          (id)        => api.delete(`/invoices/${id}`),
  addPayment:    (id, data)  => api.post(`/invoices/${id}/payments`, data),
  getPayments:   (id)        => api.get(`/invoices/${id}/payments`),
  updatePayment: (id, pid, data) => api.put(`/invoices/${id}/payments/${pid}`, data),
  deletePayment: (id, pid)   => api.delete(`/invoices/${id}/payments/${pid}`),
  getPdfUrl:     (id)        => `/api/v1/invoices/${id}/pdf?token=${localStorage.getItem('et_token')}`,
  getPrintUrl:   (id)        => `/api/v1/invoices/${id}/print?token=${localStorage.getItem('et_token')}`,
  sendEmail:     (id, data)  => api.post(`/invoices/${id}/email`, data),
  sendReminder:  (id, data)  => api.post(`/invoices/${id}/reminder`, data),
  fromDNs:       (data)      => api.post('/invoices/from-dns', data),
  issue:         (id)        => api.patch(`/invoices/${id}/issue`),
  bulkPayment:   (data)      => api.post('/invoices/bulk-payment', data),
  writeOff:      (id, data)  => api.post(`/invoices/${id}/write-off`, data),
  reverseWriteOff:(id)       => api.delete(`/invoices/${id}/write-off`),
  clone:          (id)       => api.post(`/invoices/${id}/clone`),
  exportCsvUrl:  (params)    => {
    const qs = new URLSearchParams({ ...params, token: localStorage.getItem('et_token') }).toString()
    return `/api/v1/invoices/export/csv?${qs}`
  },
}

// ── Delivery Notes ─────────────────────────────
export const dnApi = {
  list:         (params)   => api.get('/delivery-notes', { params }),
  get:          (id)       => api.get(`/delivery-notes/${id}`),
  create:       (data)     => api.post('/delivery-notes', data),
  cancel:       (id)       => api.put(`/delivery-notes/${id}/cancel`),
  toInvoice:    (id, data) => api.post(`/delivery-notes/${id}/to-invoice`, data),
  quoteFromDNs: (data)     => api.post('/delivery-notes/quote-from-dns', data),
  getPdfUrl:    (id)       => `/api/v1/delivery-notes/${id}/pdf?token=${localStorage.getItem('et_token')}`,
  getPrintUrl:  (id)       => `/api/v1/delivery-notes/${id}/print?token=${localStorage.getItem('et_token')}`,
}

// ── Customers ──────────────────────────────────
export const customerApi = {
  list:          (params)  => api.get('/customers', { params }),
  get:           (id)      => api.get(`/customers/${id}`),
  create:        (data)    => api.post('/customers', data),
  update:        (id, d)   => api.put(`/customers/${id}`, d),
  delete:        (id)      => api.delete(`/customers/${id}`),
  generatePortal:(id)      => api.post(`/portal/generate/${id}`),
}

// ── Products ───────────────────────────────────
export const productApi = {
  list:        (params)  => api.get('/products', { params }),
  get:         (id)      => api.get(`/products/${id}`),
  lookup:      (params)  => api.get('/products/lookup', { params }),
  create:      (data)    => api.post('/products', data),
  update:      (id, d)   => api.put(`/products/${id}`, d),
  delete:      (id)      => api.delete(`/products/${id}`),
  stockHistory:(id)      => api.get(`/products/${id}/stock-history`),
  stockCount:  (data)    => api.post('/products/stock-count', data),
  // Cycle count sessions
  listSessions:       ()         => api.get('/products/count-sessions'),
  createSession:      (data)     => api.post('/products/count-sessions', data),
  getSession:         (id)       => api.get(`/products/count-sessions/${id}`),
  saveSessionDraft:   (id, data) => api.put(`/products/count-sessions/${id}`, data),
  applySession:       (id)       => api.post(`/products/count-sessions/${id}/apply`),
  deleteSession:      (id)       => api.delete(`/products/count-sessions/${id}`),
}

// ── Categories ─────────────────────────────────
export const categoryApi = {
  list:   (type)   => api.get('/categories', { params: { type } }),
  create: (data)   => api.post('/categories', data),
  update: (id, d)  => api.put(`/categories/${id}`, d),
  delete: (id)     => api.delete(`/categories/${id}`),
}

// ── Purchases ──────────────────────────────────
export const purchaseApi = {
  list:        (params) => api.get('/purchases', { params }),
  get:         (id)     => api.get(`/purchases/${id}`),
  create:      (data)   => api.post('/purchases', data),
  delete:      (id)     => api.delete(`/purchases/${id}`),
  addPayment:  (id, d)  => api.post(`/purchases/${id}/payments`, d),
  getPayments: (id)     => api.get(`/purchases/${id}/payments`),
}

// ── Purchase Orders ────────────────────────────────────────
export const poApi = {
  list:      (params) => api.get('/purchase-orders', { params }),
  get:       (id)     => api.get(`/purchase-orders/${id}`),
  create:    (data)   => api.post('/purchase-orders', data),
  update:    (id, d)  => api.put(`/purchase-orders/${id}`, d),
  delete:    (id)     => api.delete(`/purchase-orders/${id}`),
  setStatus: (id, s)  => api.patch(`/purchase-orders/${id}/status`, { status: s }),
  toInvoice: (id, d)  => api.post(`/purchase-orders/${id}/to-invoice`, d),
}

// ── Expenses ───────────────────────────────────
export const expenseApi = {
  list:   (params) => api.get('/expenses', { params }),
  create: (data)   => api.post('/expenses', data),
  update: (id, d)  => api.put(`/expenses/${id}`, d),
  delete: (id)     => api.delete(`/expenses/${id}`),
}

export const recurringExpenseApi = {
  list:           ()           => api.get('/recurring-expenses'),
  create:         (data)       => api.post('/recurring-expenses', data),
  update:         (id, data)   => api.put(`/recurring-expenses/${id}`, data),
  toggle:         (id)         => api.patch(`/recurring-expenses/${id}/toggle`),
  delete:         (id)         => api.delete(`/recurring-expenses/${id}`),
  generate:       (id, data)   => api.post(`/recurring-expenses/${id}/generate`, data || {}),
  confirmPayment: (id, data)   => api.post(`/recurring-expenses/${id}/confirm-payment`, data),
}

// ── Bank ───────────────────────────────────────
export const bankApi = {
  accounts:       ()           => api.get('/bank/accounts'),
  createAccount:  (data)       => api.post('/bank/accounts', data),
  updateAccount:  (id, data)   => api.put(`/bank/accounts/${id}`, data),
  deleteAccount:  (id)         => api.delete(`/bank/accounts/${id}`),
  transactions:   (id, p)      => api.get(`/bank/accounts/${id}/transactions`, { params: p }),
  import:         (id, f)      => api.post(`/bank/accounts/${id}/import`, f),
  autoMatch:      (id)         => api.post(`/bank/accounts/${id}/auto-match`),
  manualMatch:    (txId, d)    => api.put(`/bank/transactions/${txId}/match`, d),
}

// ── Reports ────────────────────────────────────
export const reportApi = {
  dashboard:    (params) => api.get('/reports/dashboard', { params }),
  vat:          (params) => api.get('/reports/vat', { params }),
  profitLoss:   (params) => api.get('/reports/profit-loss', { params }),
  balanceSheet: (params) => api.get('/reports/balance-sheet', { params }),
  overdue:      ()       => api.get('/reports/overdue'),
  badDebt:      ()       => api.get('/reports/bad-debt'),
  arAging:      ()       => api.get('/reports/ar-aging'),
  apAging:      ()       => api.get('/reports/ap-aging'),
  stock:              ()       => api.get('/reports/stock'),
  statement:            (params) => api.get('/reports/statement', { params }),
  statementPdfUrl:      (params) => `/api/v1/reports/statement/pdf?${new URLSearchParams({ ...params, token: localStorage.getItem('et_token') })}`,
  statementPrintUrl:    (params) => `/api/v1/reports/statement/print?${new URLSearchParams({ ...params, token: localStorage.getItem('et_token') })}`,
  salesByProduct:     (params) => api.get('/reports/sales-by-product',  { params }),
  purchaseAnalysis:   (params) => api.get('/reports/purchase-analysis', { params }),
  inventoryAtDate:    (params) => api.get('/reports/inventory-at-date', { params }),
  dailyClosing:       (params) => api.get('/reports/daily-closing',     { params }),
  dailyClosingPrintUrl: (date) => `/api/v1/reports/daily-closing/print?date=${date}&token=${localStorage.getItem('et_token')}`,
}

// ── Public portal (no auth token) ──────────────
const publicApi = axios.create({ baseURL: '/api/v1' })
export const portalApi = {
  get:        (token)            => publicApi.get(`/portal/${token}`),
  getPdfUrl:  (token, invoiceId) => `/api/v1/portal/${token}/invoices/${invoiceId}/pdf`,
}
export const inviteApi = {
  get:    (token) => publicApi.get(`/auth/accept-invite/${token}`),
  accept: (token, data) => publicApi.post(`/auth/accept-invite/${token}`, data),
  send:   (companyId, data) => api.post(`/companies/${companyId}/invite`, data),
}

// ── Cheques ────────────────────────────────────
export const chequeApi = {
  list:      (params)     => api.get('/cheques', { params }),
  summary:   ()           => api.get('/cheques/summary'),
  create:    (data)       => api.post('/cheques', data),
  setStatus: (id, data)   => api.patch(`/cheques/${id}/status`, data),
  delete:    (id)         => api.delete(`/cheques/${id}`),
  preview:   (file)       => { const fd = new FormData(); fd.append('file', file); return api.post('/cheques/import?preview=1', fd) },
  import:    (file)       => { const fd = new FormData(); fd.append('file', file); return api.post('/cheques/import', fd) },
  templateUrl:    ()     => `/api/v1/cheques/import-template?token=${localStorage.getItem('et_token')}`,
  voucherUrl:     (id)  => `/api/v1/cheques/${id}/voucher?token=${localStorage.getItem('et_token')}`,
  printChequeUrl: (id, bank='nbb') => `/api/v1/cheques/${id}/print-cheque?bank=${bank}&token=${localStorage.getItem('et_token')}`,
}

// ── HR ─────────────────────────────────────────
export const hrApi = {
  // Employees
  listEmployees:  (params)        => api.get('/hr/employees', { params }),
  getEmployee:    (id)            => api.get(`/hr/employees/${id}`),
  createEmployee: (data)          => api.post('/hr/employees', data),
  updateEmployee: (id, data)      => api.put(`/hr/employees/${id}`, data),
  setEmpStatus:   (id, status)    => api.patch(`/hr/employees/${id}/status`, { status }),
  // Payroll
  listPayroll:    ()              => api.get('/hr/payroll'),
  getPayroll:     (id)            => api.get(`/hr/payroll/${id}`),
  createPayroll:  (data)          => api.post('/hr/payroll', data),
  updatePayslip:  (runId, slipId, data) => api.put(`/hr/payroll/${runId}/payslips/${slipId}`, data),
  approvePayroll: (id)            => api.patch(`/hr/payroll/${id}/approve`),
  paidPayroll:    (id)            => api.patch(`/hr/payroll/${id}/paid`),
  deletePayroll:  (id)            => api.delete(`/hr/payroll/${id}`),
  summary:        ()              => api.get('/hr/summary'),
  // Leave
  listLeaves:     (params)        => api.get('/hr/leaves', { params }),
  empLeaves:      (empId)         => api.get(`/hr/employees/${empId}/leaves`),
  leaveBalance:   (empId)         => api.get(`/hr/employees/${empId}/leave-balance`),
  startLeave:     (empId, data)   => api.post(`/hr/employees/${empId}/leaves`, data),
  resumeLeave:    (leaveId, data) => api.patch(`/hr/leaves/${leaveId}/resume`, data),
  cancelLeave:    (leaveId)       => api.patch(`/hr/leaves/${leaveId}/cancel`),
}

// ── Tasks ──────────────────────────────────────
export const taskApi = {
  list:        (params)         => api.get('/tasks', { params }),
  users:       ()               => api.get('/tasks/users'),
  get:         (id)             => api.get(`/tasks/${id}`),
  create:      (data)           => api.post('/tasks', data),
  update:      (id, data)       => api.put(`/tasks/${id}`, data),
  setStatus:   (id, status)     => api.patch(`/tasks/${id}/status`, { status }),
  delete:      (id)             => api.delete(`/tasks/${id}`),
  addComment:  (id, comment)    => api.post(`/tasks/${id}/comments`, { comment }),
  delComment:  (commentId)      => api.delete(`/tasks/comments/${commentId}`),
}

// ── Shipments / Landed Cost ────────────────────
export const shipmentApi = {
  list:          ()                      => api.get('/shipments'),
  get:           (id)                    => api.get(`/shipments/${id}`),
  create:        (data)                  => api.post('/shipments', data),
  update:        (id, data)              => api.put(`/shipments/${id}`, data),
  delete:        (id)                    => api.delete(`/shipments/${id}`),
  addItem:       (id, data)              => api.post(`/shipments/${id}/items`, data),
  updateItem:    (id, itemId, d)         => api.put(`/shipments/${id}/items/${itemId}`, d),
  deleteItem:    (id, itemId)            => api.delete(`/shipments/${id}/items/${itemId}`),
  calculate:     (id)                    => api.post(`/shipments/${id}/calculate`),
  apply:         (id)                    => api.post(`/shipments/${id}/apply`),
  addPayment:    (id, data)              => api.post(`/shipments/${id}/payments`, data),
  deletePayment: (id, paymentId)         => api.delete(`/shipments/${id}/payments/${paymentId}`),
}

// ── Import ─────────────────────────────────────
export const importApi = {
  preview:   (data) => api.post('/import/preview', data),
  products:  (data) => api.post('/import/products', data),
  customers: (data) => api.post('/import/customers', data),
}

// ── Backup ─────────────────────────────────────
export const backupApi = {
  list:           ()           => api.get('/backup/list'),
  create:         (type)       => api.post('/backup/create', { type }),
  download:       (filename)   => `/api/v1/backup/download/${encodeURIComponent(filename)}?token=${localStorage.getItem('et_token')}`,
  restore:        (filename)   => api.post('/backup/restore', { filename }),
  delete:         (filename)   => api.delete(`/backup/${encodeURIComponent(filename)}`),
  getSchedule:    ()           => api.get('/backup/schedule'),
  saveSchedule:   (cfg)        => api.put('/backup/schedule', cfg),
}

// ── CRM ────────────────────────────────────────
export const crmApi = {
  // Contacts
  listContacts:       (customer_id)   => api.get('/crm/contacts', { params: { customer_id } }),
  createContact:      (data)          => api.post('/crm/contacts', data),
  updateContact:      (id, data)      => api.put(`/crm/contacts/${id}`, data),
  deleteContact:      (id)            => api.delete(`/crm/contacts/${id}`),
  // Interactions
  listInteractions:   (customer_id)   => api.get('/crm/interactions', { params: { customer_id } }),
  createInteraction:  (data)          => api.post('/crm/interactions', data),
  doneInteraction:    (id)            => api.patch(`/crm/interactions/${id}/done`),
  deleteInteraction:  (id)            => api.delete(`/crm/interactions/${id}`),
  // Opportunities
  listOpportunities:  (params)        => api.get('/crm/opportunities', { params }),
  createOpportunity:  (data)          => api.post('/crm/opportunities', data),
  updateOpportunity:  (id, data)      => api.put(`/crm/opportunities/${id}`, data),
  deleteOpportunity:  (id)            => api.delete(`/crm/opportunities/${id}`),
  // Dashboard
  dashboard:          ()              => api.get('/crm/dashboard'),
}

// ── Document conversions ───────────────────────
export const convertApi = {
  convert: (data)  => api.post('/documents/convert', data),
  history: (id)    => api.get(`/documents/convert/history/${id}`),
}

// ── Company ────────────────────────────────────
export const companyApi = {
  get:          ()           => api.get('/companies'),
  save:         (data)       => api.put('/companies', data),
  uploadLogo:   (logo)       => api.post('/companies/logo', { logo }),
  removeLogo:   ()           => api.delete('/companies/logo'),
  // Multi-company management
  listAll:      ()           => api.get('/companies/all'),
  create:       (data)       => api.post('/companies', data),
  listUsers:    (id)         => api.get(`/companies/${id}/users`),
  addUser:      (id, data)   => api.post(`/companies/${id}/users`, data),
  removeUser:   (id, userId) => api.delete(`/companies/${id}/users/${userId}`),
}

// ── Contra Accounts ────────────────────────────
export const contraApi = {
  list:          ()              => api.get('/contra-accounts'),
  invoices:      (customerId)    => api.get(`/contra-accounts/${customerId}/invoices`),
  purchases:     (customerId)    => api.get(`/contra-accounts/${customerId}/purchases`),
  entries:       (customerId)    => api.get(`/contra-accounts/${customerId}/entries`),
  apply:         (customerId, d) => api.post(`/contra-accounts/${customerId}/entries`, d),
  reverse:       (entryId)       => api.delete(`/contra-accounts/entries/${entryId}`),
}

// ── Automation ─────────────────────────────────
export const automationApi = {
  get:    ()      => api.get('/automation'),
  save:   (data)  => api.put('/automation', data),
  runNow: (job)   => api.post('/automation/run-now', { job }),
}

// ── Audit Log ──────────────────────────────────
export const auditApi = {
  list:    (params) => api.get('/audit-log',         { params }),
  actions: ()       => api.get('/audit-log/actions'),
}

// ── Analytics ──────────────────────────────────
export const analyticsApi = {
  stockVelocity:      (params) => api.get('/analytics/stock-velocity',       { params }),
  grossMargin:        (params) => api.get('/analytics/gross-margin',         { params }),
  grossMarginDetail:  (params) => api.get('/analytics/gross-margin/detail',  { params }),
  topCustomers:       (params) => api.get('/analytics/top-customers',        { params }),
  supplierPricing:    (params) => api.get('/analytics/supplier-pricing',     { params }),
  topProducts:        (params) => api.get('/analytics/top-products',         { params }),
  salesTrend:         (params) => api.get('/analytics/sales-trend',          { params }),
  deadStock:          (params) => api.get('/analytics/dead-stock',           { params }),
  avgPriceTrend:      (params) => api.get('/analytics/avg-price-trend',      { params }),
  reorderCandidates:  (params) => api.get('/analytics/reorder-candidates',   { params }),
  buyPriceComparison: (params) => api.get('/analytics/buy-price-comparison', { params }),
  costInflation:      (params) => api.get('/analytics/cost-inflation',       { params }),
}

// ── Auth ───────────────────────────────────────
export const authApi = {
  login:         (data)        => api.post('/auth/login', data),
  switchCompany: (company_id)  => api.post('/auth/switch-company', { company_id }),
  me:            ()            => api.get('/auth/me'),
  logout:        ()            => { localStorage.removeItem('et_token'); localStorage.removeItem('et_user') },
  listUsers:     ()            => api.get('/auth/users'),
  createUser:    (data)        => api.post('/auth/users', data),
  updateUser:    (id, data)    => api.put(`/auth/users/${id}`, data),
  forceLogout:   (id)          => api.post(`/auth/users/${id}/force-logout`),
}

export default api
