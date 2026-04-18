# ElecTrade Pro
### Al Manama Electrical Trading Co. W.L.L — Bahrain

Full-stack invoicing, delivery note management, inventory, and financial reporting system.

---

## Quick Start (Development)

### Prerequisites
- Node.js 20+
- PostgreSQL 16+
- npm 10+

### 1. Clone & configure

```bash
git clone <repo>
cd electrade
cp .env.example .env
# Edit .env — fill in DB_PASSWORD, JWT_SECRET, SMTP settings
```

### 2. Database setup

```bash
# Create the database
psql -U postgres -c "CREATE DATABASE electrade;"
psql -U postgres -c "CREATE USER electrade WITH PASSWORD 'yourpassword';"
psql -U postgres -c "GRANT ALL ON DATABASE electrade TO electrade;"

# Run migrations
cd backend
npm install
DATABASE_URL=postgres://electrade:yourpassword@localhost:5432/electrade npm run db:migrate

# Seed demo data (creates company, admin user, products, customers)
DATABASE_URL=postgres://electrade:yourpassword@localhost:5432/electrade npm run db:seed
```

### 3. Start backend

```bash
cd backend
npm run dev
# API running on http://localhost:3001
```

### 4. Start frontend

```bash
cd frontend
npm install
npm run dev
# App running on http://localhost:5173
```

### Default login

| User        | Email                     | Password    | Role  |
|-------------|---------------------------|-------------|-------|
| Admin       | admin@almanama.com        | Admin@1234  | admin |
| Sales staff | sales@almanama.com        | Sales@1234  | sales |

---

## Production Deployment (Docker)

```bash
# Build and start all services
docker compose up -d --build

# View logs
docker compose logs -f api

# Run seed (first time only)
docker compose exec api node src/db/seed.js
```

Configure SSL by placing your certificate files in `docker/ssl/`:
- `docker/ssl/fullchain.pem`
- `docker/ssl/privkey.pem`

Or use Certbot: `certbot certonly --nginx -d yourdomain.com`

---

## Project Structure

```
electrade/
├── backend/
│   ├── src/
│   │   ├── server.js               # Express entry point
│   │   ├── db/
│   │   │   ├── index.js            # PostgreSQL pool + helpers
│   │   │   ├── schema.sql          # Full DB schema + triggers
│   │   │   └── seed.js             # Demo data seeder
│   │   ├── middleware/
│   │   │   └── auth.js             # JWT authentication + role guards
│   │   ├── controllers/
│   │   │   ├── authController.js   # Login, users
│   │   │   ├── invoicesController.js    # Invoices + DN consolidation
│   │   │   ├── deliveryNotesController.js # DNs + stock management
│   │   │   └── reportsController.js # VAT, P&L, BS, Bank recon
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── invoices.js
│   │   │   ├── deliveryNotes.js
│   │   │   ├── reports.js
│   │   │   ├── documentConversions.js
│   │   │   └── allRoutes.js        # Customers, products, purchases, expenses, bank
│   │   └── services/
│   │       ├── pdfService.js       # Invoice + DN PDF generation (Puppeteer)
│   │       └── emailService.js     # Invoice/DN email with PDF attachment
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx                 # Root component
│   │   ├── main.jsx                # Vite entry
│   │   ├── index.css               # Global styles (Simple Invoice aesthetic)
│   │   ├── store/index.js          # Zustand: auth, UI, invoice form state
│   │   ├── services/api.js         # Axios API client (all endpoints)
│   │   ├── utils/format.js         # BHD formatting, dates, amount-in-words
│   │   └── components/
│   │       ├── layout/
│   │       │   ├── AppShell.jsx    # Titlebar + sidebar nav + content area
│   │       │   └── LoginPage.jsx
│   │       └── modules/
│   │           ├── invoices/       # InvoicesModule, InvoiceModal, ConsolidateModal, PaymentModal
│   │           ├── delivery-notes/ # DNModule, DNModal
│   │           ├── reports/        # ReportsModule (VAT, P&L, BS, Bank, Stock)
│   │           ├── products/       # ProductsModule (stub — Phase 2)
│   │           ├── customers/      # CustomersModule (stub — Phase 2)
│   │           ├── purchases/      # PurchasesModule (stub — Phase 2)
│   │           ├── expenses/       # ExpensesModule (stub — Phase 2)
│   │           ├── bank/           # BankModule (stub — Phase 2)
│   │           ├── dashboard/      # Dashboard (stub — Phase 2)
│   │           ├── quotations/     # QuotationsModule (stub — Phase 2)
│   │           ├── settings/       # SettingsModule (stub — Phase 2)
│   │           └── shared/         # CustomerPickerModal, ProductPickerModal
│   ├── Dockerfile
│   ├── nginx-spa.conf
│   └── package.json
│
├── docker/
│   └── nginx.conf                  # Reverse proxy config
├── docker-compose.yml
└── .env.example
```

---

## Key Workflows

### Creating an Invoice directly
1. Sales → New Invoice → select customer → add items → Save

### Delivery Note → Invoice (Path B — DN first)
1. Delivery Notes → New Delivery Note → add items → Save (stock deducted immediately)
2. Repeat for each delivery visit
3. When client sends PO → Delivery Notes → tick all pending DNs → Create Invoice from DNs → enter PO number → Create

### Delivery Note → Invoice (Path A — PO first)
1. Invoices → New Invoice → enter PO number → Link Delivery Notes → add items → Save

### Cancelling a Delivery Note
1. Delivery Notes → select DN → Cancel DN → confirm
2. Stock is reversed automatically via database trigger

---

## API Reference (key endpoints)

| Method | Endpoint                      | Description                          |
|--------|-------------------------------|--------------------------------------|
| POST   | /api/v1/auth/login            | Login → returns JWT token            |
| GET    | /api/v1/invoices              | List invoices (filterable)           |
| POST   | /api/v1/invoices              | Create invoice                       |
| POST   | /api/v1/invoices/from-dns     | Consolidate DNs into one invoice     |
| GET    | /api/v1/invoices/:id/pdf      | Generate invoice PDF                 |
| POST   | /api/v1/delivery-notes        | Create DN (triggers stock deduction) |
| PUT    | /api/v1/delivery-notes/:id/cancel | Cancel DN (triggers stock reversal) |
| GET    | /api/v1/reports/vat           | VAT report with NBR box values       |
| GET    | /api/v1/reports/profit-loss   | P&L statement                        |
| GET    | /api/v1/reports/balance-sheet | Balance sheet                        |
| POST   | /api/v1/documents/convert     | Convert Quote → DN → Invoice         |

Full API reference in `ElecTrade_Pro_Technical_Specification.docx`

---

## Development Phases

| Phase | Scope | Status |
|-------|-------|--------|
| Phase 1 | DB schema, backend API, auth | ✅ Complete |
| Phase 2 | Invoices module, DN module, Reports (VAT/P&L/BS) | ✅ Complete |
| Phase 3 | Products, Customers, Purchases, Expenses full UI | 🔄 Stubs ready |
| Phase 4 | Dashboard, Bank reconciliation UI, Settings | 🔄 Stubs ready |
| Phase 5 | PDF templates, Email, Barcode scanner | 🔄 Services ready |
| Phase 6 | Testing, hardening, production deployment | ⏳ Pending |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Zustand + React Query |
| Backend | Node.js 20 + Express 5 |
| Database | PostgreSQL 16 |
| PDF | Puppeteer (headless Chrome) |
| Email | Nodemailer |
| Auth | JWT + bcrypt |
| Deploy | Docker Compose + Nginx |

---

*ElecTrade Pro v1.0 — Built for Al Manama Electrical Trading Co. W.L.L, Manama, Bahrain*
*VAT Reg: BH-VAT-20241234 | CR: 98765-1*
