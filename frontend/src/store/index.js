import { create } from 'zustand'
import { authApi } from '../services/api'

// ── Auth store ─────────────────────────────────
export const useAuthStore = create((set) => ({
  user:       JSON.parse(localStorage.getItem('et_user') || 'null'),
  token:      localStorage.getItem('et_token') || null,
  isAuth:     !!localStorage.getItem('et_token'),
  switching:  false,

  login: (user, token) => {
    localStorage.setItem('et_token', token)
    localStorage.setItem('et_user', JSON.stringify(user))
    set({ user, token, isAuth: true })
  },

  logout: () => {
    localStorage.removeItem('et_token')
    localStorage.removeItem('et_user')
    set({ user: null, token: null, isAuth: false })
  },

  switchCompany: async (companyId, queryClient) => {
    set({ switching: true })
    try {
      const { data } = await authApi.switchCompany(companyId)
      localStorage.setItem('et_token', data.token)
      localStorage.setItem('et_user', JSON.stringify(data.user))
      set({ user: data.user, token: data.token, switching: false })
      // Flush all cached data so the new company's data loads fresh
      if (queryClient) queryClient.clear()
    } catch {
      set({ switching: false })
    }
  },
}))

// ── UI store — active module, selected rows, modals ───────
export const useUIStore = create((set, get) => ({
  activeModule:  'dashboard',
  moduleParams:  {},        // optional params passed when navigating to a module
  selectedIds:   [],
  modals:        {},        // { modalName: { open, data } }
  sidebarOpen:   true,

  setModule:          (mod, params = {}) => set({ activeModule: mod, moduleParams: params, selectedIds: [], modals: {} }),
  clearModuleParams:  ()                 => set({ moduleParams: {} }),
  setSelected:  (ids)  => set({ selectedIds: ids }),
  toggleSelect: (id)   => {
    const cur = get().selectedIds
    set({ selectedIds: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  },

  openModal:  (name, data = {}) => set(s => ({ modals: { ...s.modals, [name]: { open: true, data } } })),
  closeModal: (name)            => set(s => ({ modals: { ...s.modals, [name]: { open: false, data: {} } } })),
  getModal:   (name)            => get().modals[name] || { open: false, data: {} },
}))

// ── Invoice form store — manages new/edit invoice state ───
const emptyInvoice = () => ({
  type:           'tax_invoice',
  customer_id:    '',
  customer_name:  '',
  customer_vat:   '',
  customer_cr:    '',
  invoice_date:   new Date().toISOString().split('T')[0],
  due_date:       new Date().toISOString().split('T')[0],
  po_reference:   '',
  notes:          '',
  internal_notes: '',
  items: [],
  linked_dn_ids:  [],
  shipping:          0,
  invoice_discount:  0,
})

export const useInvoiceFormStore = create((set, get) => ({
  form:    emptyInvoice(),
  errors:  {},
  saving:  false,

  reset:       ()       => set({ form: emptyInvoice(), errors: {} }),
  setForm:     (data)   => set(s => ({ form: { ...s.form, ...data } })),
  setCustomer: (cust)   => set(s => {
    const base  = new Date(s.form.invoice_date || new Date().toISOString().split('T')[0])
    const terms = parseInt(cust.payment_terms_days || 30)
    base.setDate(base.getDate() + terms)
    return { form: { ...s.form,
      customer_id:   cust.id,
      customer_name: cust.name,
      customer_vat:  cust.vat_number || '',
      customer_cr:   cust.cr_number  || '',
      due_date:      base.toISOString().split('T')[0],
    }}
  }),

  addItem: () => set(s => ({ form: { ...s.form, items: [...s.form.items, {
    _id: Date.now(), product_id: '', part_no: '', description: '',
    qty: 1, unit: 'pcs', unit_price: 0, discount: 0, vat_rate: 10,
  }]}})),

  updateItem: (idx, field, value) => set(s => {
    const items = [...s.form.items]
    items[idx] = { ...items[idx], [field]: value }
    return { form: { ...s.form, items } }
  }),

  removeItem: (idx) => set(s => ({ form: { ...s.form,
    items: s.form.items.filter((_, i) => i !== idx)
  }})),

  // Computed totals — VAT-compliant (Bahrain NBR Article 27)
  // Overall/invoice discount is apportioned proportionally across lines,
  // reducing the VAT base for each line before VAT is calculated.
  totals: () => {
    const { items, shipping, invoice_discount } = get().form
    const invDisc   = Number(invoice_discount || 0)

    // Step 1: gross and line-discount per item
    const subtotal  = items.reduce((s, i) => s + (Number(i.qty) * Number(i.unit_price)), 0)
    const totalDisc = items.reduce((s, i) => s + Number(i.discount || 0), 0)
    const netAfterLineDisc = subtotal - totalDisc   // taxable base before overall discount

    // Step 2: apportion overall discount proportionally by each line's net value,
    // then calculate VAT on the reduced taxable amount per line.
    // This correctly handles mixed VAT rates.
    let totalVat = 0
    for (const i of items) {
      const lineNet  = Number(i.qty) * Number(i.unit_price) - Number(i.discount || 0)
      // share of the overall discount attributed to this line
      const lineDiscShare = netAfterLineDisc > 0 ? invDisc * (lineNet / netAfterLineDisc) : 0
      const lineTaxable   = lineNet - lineDiscShare
      totalVat += lineTaxable * Number(i.vat_rate) / 100
    }

    const grandTotal = netAfterLineDisc - invDisc + totalVat + Number(shipping || 0)
    return { subtotal, totalDisc, totalVat, grandTotal }
  },
}))

