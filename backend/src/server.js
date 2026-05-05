require('dotenv').config()
const express     = require('express')
const helmet      = require('helmet')
const cors        = require('cors')
const morgan      = require('morgan')
const compression = require('compression')
const { runMigrations } = require('./db/migrate')

const {
  customersRouter, productsRouter, categoriesRouter,
  purchasesRouter, expensesRouter, bankRouter, companiesRouter,
  recurringExpensesRouter
} = require('./routes/allRoutes')

const app = express()
app.use(helmet())
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }))
const cleanOrigin = frontendUrl.replace(/\/$/, '');
app.use(cors({ 
  origin: cleanOrigin,
  credentials: true // Crucial for storing your 'et_token' in some setups
}));
app.use(compression())
// Redact Bearer tokens from logged URLs before they reach morgan
morgan.token('url-redacted', (req) =>
  (req.url || '').replace(/([?&]token=)[^&]*/gi, '$1[REDACTED]')
)
const morganFmt = process.env.NODE_ENV === 'production'
  ? ':remote-addr - :remote-user [:date[clf]] ":method :url-redacted HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
  : ':method :url-redacted :status :response-time ms'
app.use(morgan(morganFmt))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))

app.use('/api/v1/auth',              require('./routes/auth'))
app.use('/api/v1/companies',         companiesRouter)
app.use('/api/v1/customers',         customersRouter)
app.use('/api/v1/products',          productsRouter)
app.use('/api/v1/categories',        categoriesRouter)
app.use('/api/v1/invoices',          require('./routes/invoices'))
app.use('/api/v1/delivery-notes',    require('./routes/deliveryNotes'))
app.use('/api/v1/purchases',         purchasesRouter)
app.use('/api/v1/expenses',          expensesRouter)
app.use('/api/v1/recurring-expenses', recurringExpensesRouter)
app.use('/api/v1/bank',              bankRouter)
app.use('/api/v1/reports',           require('./routes/reports'))
app.use('/api/v1/cheques',           require('./routes/cheques'))
app.use('/api/v1/hr',                require('./routes/hr'))
app.use('/api/v1/tasks',             require('./routes/tasks'))
app.use('/api/v1/shipments',          require('./routes/shipments'))
app.use('/api/v1/import',            require('./routes/import'))
app.use('/api/v1/admin',             require('./routes/admin'))
app.use('/api/v1/admin/import-sinvoice', require('./routes/importSinvoice'))
app.use('/api/v1/backup',            require('./routes/backup'))
app.use('/api/v1/documents/convert', require('./routes/documentConversions'))
app.use('/api/v1/crm',               require('./routes/crm'))
app.use('/api/v1/purchase-orders',   require('./routes/purchaseOrders'))
app.use('/api/v1/contra-accounts',   require('./routes/contra'))
app.use('/api/v1/analytics',         require('./routes/analytics'))
app.use('/api/v1/audit-log',         require('./routes/auditLog'))
app.use('/api/v1/automation',        require('./routes/automation'))
app.use('/api/v1/portal',            require('./routes/portal'))

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }))
app.use((req, res) => res.status(404).json({ error: { message: `Route not found: ${req.method} ${req.path}` } }))
app.use((err, req, res, next) => {
  const status = err.status || (err.code === '23505' ? 409 : 500)
  console.error(err.message)
  res.status(status).json({ error: { message: err.message || 'Internal server error', code: err.code } })
})

const PORT = process.env.PORT || 3001
runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`ElecTrade API on port ${PORT}`)
      const sched = require('./services/scheduler')
      sched.init()
      sched.reloadAutomation()
    })
  })
  .catch(err => {
    console.error('Migration failed — aborting startup:', err.message)
    process.exit(1)
  })
module.exports = app
