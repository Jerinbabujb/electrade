import { useUIStore, useAuthStore } from '../../store'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import api from '../../services/api'
import { Toaster } from 'react-hot-toast'
import { applyTheme } from '../../utils/theme.js'

import Dashboard from '../modules/dashboard/Dashboard'
import InvoicesModule from '../modules/invoices/InvoicesModule'
import DNModule from '../modules/delivery-notes/DNModule'
import ProductsModule from '../modules/products/ProductsModule'
import CustomersModule from '../modules/customers/CustomersModule'
import ReportsModule from '../modules/reports/ReportsModule'
import PurchasesModule from '../modules/purchases/PurchasesModule'
import ShipmentsModule from '../modules/shipments/ShipmentsModule'
import ExpensesModule from '../modules/expenses/ExpensesModule'
import BankModule from '../modules/bank/BankModule'
import SettingsModule from '../modules/settings/SettingsModule'
import QuotationsModule from '../modules/quotations/QuotationsModule'
import ChequesModule from '../modules/cheques/ChequesModule'
import FinanceModule from '../modules/finance/FinanceModule'
import HRModule from '../modules/hr/HRModule'
import TasksModule from '../modules/tasks/TasksModule'
import CRMModule from '../modules/crm/CRMModule'
import POModule from '../modules/purchases/POModule'
import SuppliersModule from '../modules/suppliers/SuppliersModule'
import ContraModule from '../modules/contra/ContraModule'
import AnalyticsModule from '../modules/analytics/AnalyticsModule'

// roles: which roles can see this item (omit = all roles)
// toggleable: whether admin can hide it per-company (core items are always shown)
const NAV = [
  { section: 'Sales' },
  { id: 'quotations', label: 'Quotations', icon: '📋', roles: ['admin', 'sales'], toggleable: true },
  { id: 'dns', label: 'Delivery Notes', icon: '🚚', roles: ['admin', 'sales', 'storekeeper'], toggleable: false },
  { id: 'invoices', label: 'Invoices', icon: '🧾', roles: ['admin', 'sales', 'accountant'], toggleable: false },
  { section: 'Procurement' },
  { id: 'suppliers', label: 'Suppliers', icon: '🏭', roles: ['admin', 'accountant', 'storekeeper'], toggleable: true },
  { id: 'purchase-orders', label: 'Purchase Orders', icon: '📝', roles: ['admin', 'storekeeper'], toggleable: true },
  { id: 'purchases', label: 'Purchase Invoices', icon: '📥', roles: ['admin', 'accountant', 'storekeeper'], toggleable: true },
  { id: 'shipments', label: 'Landed Costs', icon: '🚢', roles: ['admin', 'storekeeper'], toggleable: true },
  { id: 'products', label: 'Products', icon: '📦', roles: ['admin', 'sales', 'storekeeper'], toggleable: false },
  { section: 'CRM' },
  { id: 'crm', label: 'Pipeline', icon: '🎯', roles: ['admin', 'sales'], toggleable: true },
  { id: 'customers', label: 'Customers', icon: '👥', roles: ['admin', 'sales', 'accountant'], toggleable: false },
  { section: 'HR' },
  { id: 'hr', label: 'HR & Payroll', icon: '👤', roles: ['admin'], toggleable: true },
  { id: 'tasks', label: 'Tasks', icon: '✅', roles: ['admin', 'sales', 'accountant', 'storekeeper'], toggleable: true },
  { section: 'Finance' },
  { id: 'contra', label: 'Contra Accounts', icon: '⚖️', roles: ['admin', 'accountant'], toggleable: true },
  { id: 'finance', label: 'Fin. Overview', icon: '📈', roles: ['admin', 'accountant'], toggleable: true },
  { id: 'cheques', label: 'Cheque Register', icon: '🏷', roles: ['admin', 'accountant'], toggleable: true },
  { id: 'expenses', label: 'Expenses', icon: '💸', roles: ['admin', 'accountant'], toggleable: true },
  { id: 'bank', label: 'Bank Recon.', icon: '🏦', roles: ['admin', 'accountant'], toggleable: true },
  { section: 'Reports' },
  { id: 'analytics', label: 'Analytics', icon: '🔍', roles: ['admin', 'sales', 'accountant'], toggleable: true },
  { id: 'reports', label: 'Reports', icon: '📊', roles: ['admin', 'sales', 'accountant', 'storekeeper'], toggleable: true },
  { section: null },
  { id: 'dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'settings', label: 'Settings', icon: '⚙️', roles: ['admin'] },
]

const MODULES = {
  dashboard: <Dashboard />,
  invoices: <InvoicesModule />,
  dns: <DNModule />,
  quotations: <QuotationsModule />,
  products: <ProductsModule />,
  customers: <CustomersModule />,
  suppliers: <SuppliersModule />,
  'purchase-orders': <POModule />,
  purchases: <PurchasesModule />,
  shipments: <ShipmentsModule />,
  expenses: <ExpensesModule />,
  bank: <BankModule />,
  reports: <ReportsModule />,
  settings: <SettingsModule />,
  cheques: <ChequesModule />,
  contra: <ContraModule />,
  analytics: <AnalyticsModule />,
  finance: <FinanceModule />,
  hr: <HRModule />,
  tasks: <TasksModule />,
  crm: <CRMModule />,
}

export default function AppShell() {
  const { activeModule, setModule } = useUIStore()
  const { user, logout, switchCompany, switching } = useAuthStore()
  const queryClient = useQueryClient()
  const { data: coData } = useQuery({ queryKey: ['company-settings'], queryFn: () => api.get('/companies').then(r => r.data.data) })
  const co = coData || {}

  const companies = user?.companies || []
  const multiCompany = companies.length > 1

  useEffect(() => {
    if (coData?.theme_color) applyTheme(coData.theme_color)
  }, [coData?.theme_color])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Toaster position="top-right" toastOptions={{ duration: 3000, style: { fontSize: '12.5px' } }} />
      {/* Title bar */}
      <div style={{
        height: '26px', background: 'var(--blue)',
        display: 'flex', alignItems: 'center', padding: '0 10px', gap: 8, flexShrink: 0,
      }}>
        <div style={{
          width: 16, height: 16, background: '#fff', borderRadius: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, fontWeight: 900, color: 'var(--blue)', flexShrink: 0,
        }}>E</div>
        <span style={{ color: '#fff', fontSize: 12, fontWeight: 600 }}>
          ElecTrade Pro
          &nbsp;|&nbsp; VAT: {co.vat_number || 'BH-VAT-20241234'}
          &nbsp;|&nbsp; CR: {co.cr_number || '98765-1'}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          {multiCompany && (
            <select
              disabled={switching}
              value={user?.company_id || ''}
              onChange={e => switchCompany(e.target.value, queryClient)}
              style={{
                fontSize: 10, padding: '1px 4px', borderRadius: 2, border: '1px solid #cce0ff',
                background: '#1a4a8a', color: '#fff', cursor: 'pointer', maxWidth: 160,
              }}
            >
              {companies.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          <span style={{ color: '#cce0ff', fontSize: 11 }}>
            {user?.name} ({user?.role})
          </span>
          <button onClick={logout} style={{
            background: 'none', border: '1px solid #cce0ff', color: '#cce0ff',
            fontSize: 10, padding: '1px 6px', borderRadius: 2, cursor: 'pointer',
          }}>Sign out</button>
        </span>
      </div>

      {/* Body */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* Sidebar */}
        <nav style={{
          width: '172px', background: '#2c2c2c',
          display: 'flex', flexDirection: 'column', flexShrink: 0, overflowY: 'auto',
        }}>
          <div style={{ padding: '10px', borderBottom: '1px solid #444', background: '#222', textAlign: 'center' }}>
            <div style={{ color: '#fff', fontSize: 11, fontWeight: 700, lineHeight: 1.4 }}>
              {co.name}
            </div>
            {co.logo && (
              <img
                src={co.logo}
                alt="Company logo"
                style={{ marginTop: 8, maxWidth: '100%', maxHeight: 48, objectFit: 'contain', display: 'inline-block' }}
              />
            )}
          </div>

          <div style={{ padding: '5px 0', flex: 1 }}>
            {(() => {
              const role = user?.role || ''
              const hiddenModules = co?.hidden_modules || []

              // Filter items: skip if role not allowed, or admin has hidden it
              const visible = NAV.filter(item => {
                if (item.section !== undefined) return true   // sections handled below
                if (item.roles && !item.roles.includes(role)) return false
                if (hiddenModules.includes(item.id)) return false
                return true
              })

              // Remove section headers that have no visible children
              const visibleIds = new Set(visible.filter(i => i.id).map(i => i.id))
              const filtered = visible.filter((item, idx) => {
                if (item.section === undefined) return true           // regular item
                if (item.section === null) return true           // separator
                // section header: keep only if at least one following item (until next section) is visible
                for (let j = idx + 1; j < visible.length; j++) {
                  if (visible[j].section !== undefined) break        // hit next section
                  if (visibleIds.has(visible[j].id)) return true
                }
                return false
              })

              return filtered.map((item, i) => {
                if (item.section !== undefined) {
                  return item.section
                    ? <div key={i} style={{ padding: '4px 11px 2px', fontSize: 10, color: '#777', textTransform: 'uppercase', letterSpacing: '.5px', background: 'transparent', borderBottom: '1px solid #444' }}>{item.section}</div>
                    : <div key={i} style={{ height: 1, background: '#444', margin: '3px 0' }} />
                }
                const active = activeModule === item.id
                return (
                  <div key={item.id}
                    onClick={() => setModule(item.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      padding: '8px 11px', cursor: 'pointer', fontSize: 12,
                      color: active ? '#fff' : '#c8c8c8',
                      background: active ? 'var(--blue)' : 'transparent',
                      borderLeft: `3px solid ${active ? '#7eb8f0' : 'transparent'}`,
                    }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#3a3a3a' }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                  >
                    <span style={{ fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 }}>{item.icon}</span>
                    {item.label}
                  </div>
                )
              })
            })()}
          </div>


          {/* Powered by */}
          <div style={{ padding: '8px 10px', borderTop: '1px solid #444', background: '#1a1a1a', textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 10, color: '#666', fontWeight: 700, letterSpacing: '0.3px' }}>ElecTrade Pro v1.0</div>
            <div style={{ fontSize: 9, color: '#555', marginTop: 2 }}>Powered by Haspex Co. W.L.L</div>
          </div>
        </nav>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {MODULES[activeModule] || (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 8, color: '#888' }}>
              <div style={{ fontSize: 32 }}>🔧</div>
              <div>Module not found</div>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
