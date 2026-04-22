import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { bankApi, invoiceApi, purchaseApi } from '../../../services/api'
import { fmtBhd, fmtDate } from '../../../utils/format'
import toast from 'react-hot-toast'

export default function BankModule() {
  const qc = useQueryClient()
  const [accountId, setAccountId] = useState(null)
  const [dates, setDates] = useState({ from:'', to:'' })
  const [showImport, setShowImport] = useState(false)
  const [matchingTx, setMatchingTx] = useState(null)
  const [showAcctForm, setShowAcctForm] = useState(false)
  const [editingAcct, setEditingAcct] = useState(null)

  const { data: accsData } = useQuery({ queryKey:['bank-accounts'], queryFn:()=>bankApi.accounts().then(r=>r.data.data) })
  const accounts = accsData || []
  const selAcc = accounts[0]
  const activeId = accountId || selAcc?.id

  const deleteAcctMut = useMutation({
    mutationFn: (id) => bankApi.deleteAccount(id),
    onSuccess: (r) => {
      toast.success(r.data.message)
      setAccountId(null)
      qc.invalidateQueries(['bank-accounts'])
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Failed'),
  })

  const { data: txData, isLoading } = useQuery({
    queryKey: ['bank-txns', activeId, dates],
    queryFn:  () => bankApi.transactions(activeId, dates).then(r=>r.data.data),
    enabled:  !!activeId,
  })
  const txns = txData || []

  const matched   = txns.filter(t => t.match_status === 'matched' || t.match_status === 'manually_matched')
  const unmatched = txns.filter(t => t.match_status === 'unmatched')
  const totalDebit  = txns.reduce((s,t) => s + parseFloat(t.debit  || 0), 0)
  const totalCredit = txns.reduce((s,t) => s + parseFloat(t.credit || 0), 0)

  const autoMatchMut = useMutation({
    mutationFn: () => bankApi.autoMatch(activeId),
    onSuccess: (r) => { toast.success(r.data.message); qc.invalidateQueries(['bank-txns']) },
  })

  const printRecon = () => {
    const w = window.open('', '_blank')
    const rows = txns.map(t => `
      <tr>
        <td>${fmtDate(t.transaction_date)}</td>
        <td>${t.description}</td>
        <td style="text-align:right;color:#2e7d32">${parseFloat(t.debit)>0 ? fmtBhd(t.debit) : '—'}</td>
        <td style="text-align:right;color:#c62828">${parseFloat(t.credit)>0 ? fmtBhd(t.credit) : '—'}</td>
        <td>${t.ref_no || '—'}</td>
        <td style="color:${t.match_status==='unmatched'?'#e65100':'#2e7d32'}">${t.match_status==='manually_matched'?'Manual':t.match_status}</td>
      </tr>`).join('')
    w.document.write(`<!DOCTYPE html><html><head><title>Bank Reconciliation</title>
      <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:Arial;font-size:11pt;padding:20px}
      h2{margin-bottom:12px}table{width:100%;border-collapse:collapse}th{background:#1a5fa8;color:#fff;padding:6px 8px;text-align:left}
      td{padding:5px 8px;border-bottom:1px solid #eee}tr:nth-child(even)td{background:#f9f9f9}
      .sum{display:flex;gap:20px;margin-bottom:16px;font-size:12pt}
      .sum span{padding:8px 14px;background:#f5f5f5;border-radius:3px}</style></head>
      <body><h2>Bank Reconciliation — ${accounts.find(a=>a.id===activeId)?.bank_name||''}</h2>
      <div class="sum">
        <span>Receipts: <strong style="color:#2e7d32">BHD ${fmtBhd(totalDebit)}</strong></span>
        <span>Payments: <strong style="color:#c62828">BHD ${fmtBhd(totalCredit)}</strong></span>
        <span>Matched: <strong>${matched.length}</strong></span>
        <span>Unmatched: <strong style="color:#e65100">${unmatched.length}</strong></span>
      </div>
      <table><thead><tr><th>Date</th><th>Description</th><th>Debit BHD</th><th>Credit BHD</th><th>Matched To</th><th>Status</th></tr></thead>
      <tbody>${rows}</tbody></table></body></html>`)
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close() }, 300)
  }

  const statusColor = { matched:'#2e7d32', manually_matched:'#1565c0', unmatched:'#e65100' }

  return (
    <div style={{display:'flex',flexDirection:'column',flex:1,overflow:'hidden'}}>
      <div className="module-title">Bank Reconciliation</div>
      <div className="toolbar">
        {accounts.length > 0 ? (
          <select className="btn" style={{height:26,cursor:'default'}} value={activeId||''} onChange={e=>setAccountId(e.target.value)}>
            {accounts.map(a=><option key={a.id} value={a.id}>{a.bank_name} — {a.iban||a.account_number||a.account_name}</option>)}
          </select>
        ) : (
          <span style={{fontSize:12,color:'#888',padding:'0 4px'}}>No bank accounts</span>
        )}
        <button className="btn" onClick={()=>{ setEditingAcct(null); setShowAcctForm(true) }}>＋ Add Account</button>
        {activeId && <>
          <button className="btn" style={{fontSize:11}} onClick={()=>{ setEditingAcct(accounts.find(a=>a.id===activeId)); setShowAcctForm(true) }}>✏ Edit</button>
          <button className="btn danger" style={{fontSize:11}} onClick={()=>{ if(window.confirm('Remove this bank account?')) deleteAcctMut.mutate(activeId) }}>🗑</button>
        </>}
        <div className="toolbar-sep"/>
        <div style={{display:'flex',alignItems:'center',gap:4,fontSize:12}}>
          <span style={{color:'#666'}}>From:</span>
          <input type="date" style={{padding:'3px 6px',border:'1px solid #bbb',borderRadius:2,fontSize:12}} value={dates.from} onChange={e=>setDates(d=>({...d,from:e.target.value}))}/>
          <span style={{color:'#666'}}>To:</span>
          <input type="date" style={{padding:'3px 6px',border:'1px solid #bbb',borderRadius:2,fontSize:12}} value={dates.to} onChange={e=>setDates(d=>({...d,to:e.target.value}))}/>
        </div>
        <div className="toolbar-sep"/>
        <button className="btn primary" disabled={!activeId} onClick={()=>setShowImport(true)}>📥 Import Statement</button>
        <button className="btn teal" onClick={()=>autoMatchMut.mutate()} disabled={autoMatchMut.isPending||!activeId}>
          {autoMatchMut.isPending ? '⏳ Matching...' : '⚡ Auto-Match'}
        </button>
        <button className="btn" onClick={printRecon} disabled={!txns.length}>🖨 Print</button>
      </div>

      {/* Summary KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:8,padding:'10px 12px',background:'#f8f8f8',borderBottom:'1px solid #ddd',flexShrink:0}}>
        {[
          {label:'Bank Balance',    value:`BHD ${fmtBhd(accounts.find(a=>a.id===activeId)?.current_balance)}`, color:'var(--blue)'},
          {label:'Total Receipts',  value:`BHD ${fmtBhd(totalDebit)}`,   color:'#2e7d32'},
          {label:'Total Payments',  value:`BHD ${fmtBhd(totalCredit)}`,  color:'#c62828'},
          {label:'Matched',         value:`${matched.length} txns`,       color:'#2e7d32'},
          {label:'Unmatched',       value:`${unmatched.length} txns`,     color: unmatched.length ? '#c62828' : '#2e7d32'},
        ].map(k=>(
          <div key={k.label} style={{background:'#fff',border:'1px solid #d0d0d0',borderTop:`3px solid ${k.color}`,padding:'8px 10px',borderRadius:3}}>
            <div style={{fontSize:10,color:'#888',textTransform:'uppercase',marginBottom:3}}>{k.label}</div>
            <div style={{fontSize:15,fontWeight:700,color:k.color}}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid-wrap">
        <table className="data-table">
          <thead><tr>
            <th>Date</th><th>Description</th>
            <th className="right">Debit BHD</th><th className="right">Credit BHD</th>
            <th>Matched To</th><th>Status</th><th>Action</th>
          </tr></thead>
          <tbody>
            {isLoading && <tr className="empty-row"><td colSpan={7}>Loading transactions...</td></tr>}
            {!isLoading && !activeId && <tr className="empty-row"><td colSpan={7}>
        No bank accounts set up. Click <strong>＋ Add Account</strong> in the toolbar to add your first bank account.
      </td></tr>}
      {!isLoading && activeId && !txns.length && <tr className="empty-row"><td colSpan={7}>No transactions. Import a bank statement to begin reconciliation.</td></tr>}
            {txns.map(t => (
              <tr key={t.id} style={{background:t.match_status==='unmatched'?'#fff8f0':'#fff'}}>
                <td>{fmtDate(t.transaction_date)}</td>
                <td style={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{t.description}</td>
                <td className="right" style={{color:'#2e7d32',fontWeight:parseFloat(t.debit)>0?600:400}}>
                  {parseFloat(t.debit)>0 ? fmtBhd(t.debit) : '—'}
                </td>
                <td className="right" style={{color:'#c62828',fontWeight:parseFloat(t.credit)>0?600:400}}>
                  {parseFloat(t.credit)>0 ? fmtBhd(t.credit) : '—'}
                </td>
                <td>{t.ref_no ? <span className="dn-chip">{t.ref_no}</span> : '—'}</td>
                <td>
                  <span style={{display:'inline-block',padding:'1px 8px',borderRadius:10,fontSize:11,fontWeight:600,
                    background: t.match_status==='matched'?'#e8f5e9':t.match_status==='manually_matched'?'#e3f2fd':'#fff3e0',
                    color: statusColor[t.match_status]||'#e65100'}}>
                    {t.match_status==='manually_matched' ? 'Manual' : t.match_status==='matched' ? 'Matched' : 'Unmatched'}
                  </span>
                </td>
                <td>
                  {t.match_status==='unmatched' && (
                    <button className="btn" style={{fontSize:11,padding:'2px 6px'}} onClick={()=>setMatchingTx(t)}>
                      🔗 Match
                    </button>
                  )}
                  {t.match_status!=='unmatched' && (
                    <button className="btn" style={{fontSize:11,padding:'2px 6px',color:'#888'}}
                      onClick={()=>{ if(window.confirm('Unmatch this transaction?'))
                        bankApi.manualMatch(t.id,{ref_type:null,ref_id:null,ref_no:null}).then(()=>{
                          toast.success('Unmatched'); qc.invalidateQueries(['bank-txns'])
                        })
                      }}>✕ Unmatch</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="status-bar">
        <span>{txns.length} transactions</span><span>|</span>
        <span style={{color:'#2e7d32'}}>Matched: {matched.length}</span><span>|</span>
        <span style={{color:unmatched.length?'#c62828':'#2e7d32'}}>Unmatched: {unmatched.length}</span>
      </div>

      {showAcctForm && (
        <BankAccountForm
          editing={editingAcct}
          onClose={()=>{ setShowAcctForm(false); setEditingAcct(null) }}
          onSaved={(id)=>{
            qc.invalidateQueries(['bank-accounts'])
            if (id) setAccountId(id)
            setShowAcctForm(false); setEditingAcct(null)
          }}
        />
      )}

      {showImport && activeId && (
        <ImportModal
          accountId={activeId}
          onClose={()=>setShowImport(false)}
          onDone={()=>{ qc.invalidateQueries(['bank-txns']); setShowImport(false) }}
        />
      )}

      {matchingTx && (
        <ManualMatchModal
          tx={matchingTx}
          onClose={()=>setMatchingTx(null)}
          onDone={()=>{ qc.invalidateQueries(['bank-txns']); setMatchingTx(null) }}
        />
      )}
    </div>
  )
}

// ── Bank Account Form ──────────────────────────────────────
function BankAccountForm({ editing, onClose, onSaved }) {
  const empty = { bank_name:'', account_name:'', account_number:'', iban:'', currency:'BHD', current_balance:'0' }
  const [form, setForm] = useState(editing ? {
    bank_name:       editing.bank_name       || '',
    account_name:    editing.account_name    || '',
    account_number:  editing.account_number  || '',
    iban:            editing.iban            || '',
    currency:        editing.currency        || 'BHD',
    current_balance: editing.current_balance || '0',
  } : empty)
  const F = (k,v) => setForm(f=>({...f,[k]:v}))

  const saveMut = useMutation({
    mutationFn: () => editing
      ? bankApi.updateAccount(editing.id, form)
      : bankApi.createAccount(form),
    onSuccess: (r) => {
      toast.success(editing ? 'Account updated' : 'Bank account added')
      onSaved(editing ? editing.id : r.data.data.id)
    },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Save failed'),
  })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <h3>{editing ? '✏ Edit Bank Account' : '🏦 Add Bank Account'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" onClick={()=>saveMut.mutate()}
            disabled={saveMut.isPending||!form.bank_name||!form.account_name}>
            💾 {saveMut.isPending ? 'Saving...' : 'Save'}
          </button>
          <button className="btn" onClick={onClose}>✕ Cancel</button>
        </div>
        <div className="modal-body" style={{padding:12}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div className="field">
              <label>Bank Name *</label>
              <input value={form.bank_name} onChange={e=>F('bank_name',e.target.value)}
                placeholder="e.g. NBB, BBK, Ahli United" autoFocus/>
            </div>
            <div className="field">
              <label>Account Name *</label>
              <input value={form.account_name} onChange={e=>F('account_name',e.target.value)}
                placeholder="e.g. Al Manama Electrical Trading"/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:8}}>
            <div className="field">
              <label>Account Number</label>
              <input value={form.account_number} onChange={e=>F('account_number',e.target.value)}
                placeholder="e.g. 12345678"/>
            </div>
            <div className="field">
              <label>IBAN</label>
              <input value={form.iban} onChange={e=>F('iban',e.target.value)}
                placeholder="e.g. BH29NBOB99999999999999"/>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
            <div className="field">
              <label>Currency</label>
              <select value={form.currency} onChange={e=>F('currency',e.target.value)}>
                <option value="BHD">BHD — Bahraini Dinar</option>
                <option value="USD">USD — US Dollar</option>
                <option value="EUR">EUR — Euro</option>
                <option value="GBP">GBP — British Pound</option>
                <option value="AED">AED — UAE Dirham</option>
                <option value="SAR">SAR — Saudi Riyal</option>
              </select>
            </div>
            <div className="field">
              <label>Opening Balance</label>
              <input type="number" step="0.001" value={form.current_balance}
                onChange={e=>F('current_balance',e.target.value)} placeholder="0.000"/>
              <span style={{fontSize:10,color:'#888',marginTop:2}}>Current balance as of today</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── CSV Import Modal ───────────────────────────────────────
function ImportModal({ accountId, onClose, onDone }) {
  const [preview, setPreview] = useState(null)  // parsed rows
  const [error, setError]     = useState('')
  const fileRef = useRef()

  const importMut = useMutation({
    mutationFn: () => bankApi.import(accountId, { transactions: preview }),
    onSuccess: (r) => { toast.success(r.data.message); onDone() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Import failed'),
  })

  const parseCSV = (text) => {
    // Detect delimiter
    const firstLine = text.split('\n')[0]
    const delim = firstLine.includes('\t') ? '\t' : ','
    const lines = text.trim().split('\n').map(l => l.split(delim).map(c => c.replace(/^"|"$/g,'').trim()))
    const header = lines[0].map(h => h.toLowerCase().replace(/\s+/g,'_'))

    // Try to map common bank CSV column names
    const col = (names) => {
      for (const n of names) {
        const idx = header.findIndex(h => h.includes(n))
        if (idx >= 0) return idx
      }
      return -1
    }
    const dateCol  = col(['date','txn_date','transaction_date','value_date'])
    const descCol  = col(['description','narration','details','particulars','remarks','memo'])
    const debitCol = col(['debit','withdrawal','dr','amount_dr','money_out'])
    const creditCol= col(['credit','deposit','cr','amount_cr','money_in'])
    const amtCol   = col(['amount'])
    const balCol   = col(['balance','running_balance','closing_balance'])

    if (dateCol < 0 || descCol < 0) {
      setError('Could not detect Date and Description columns. Please ensure your CSV has headers.')
      return
    }

    const rows = []
    for (let i = 1; i < lines.length; i++) {
      const l = lines[i]
      if (!l || l.length < 2 || !l[dateCol]) continue
      const rawDate = l[dateCol]
      // Parse DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
      let dateObj
      if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) dateObj = new Date(rawDate)
      else if (/^\d{2}\/\d{2}\/\d{4}$/.test(rawDate)) {
        const [d,m,y] = rawDate.split('/')
        dateObj = new Date(`${y}-${m}-${d}`)
      } else dateObj = new Date(rawDate)
      if (isNaN(dateObj)) continue
      const date = dateObj.toISOString().split('T')[0]

      let debit = 0, credit = 0
      if (debitCol >= 0)  debit  = parseFloat((l[debitCol]  || '').replace(/,/g,'')) || 0
      if (creditCol >= 0) credit = parseFloat((l[creditCol] || '').replace(/,/g,'')) || 0
      if (amtCol >= 0 && debit === 0 && credit === 0) {
        const amt = parseFloat((l[amtCol]||'').replace(/,/g,'')) || 0
        if (amt >= 0) debit = amt; else credit = Math.abs(amt)
      }
      const balance = balCol >= 0 ? (parseFloat((l[balCol]||'').replace(/,/g,''))||null) : null
      rows.push({ date, description: l[descCol] || '', debit, credit, balance })
    }

    if (!rows.length) { setError('No valid rows found in file.'); return }
    setError(''); setPreview(rows)
  }

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => parseCSV(ev.target.result)
    reader.readAsText(file)
  }

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Import Bank Statement</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          {preview && (
            <button className="btn primary" onClick={()=>importMut.mutate()} disabled={importMut.isPending}>
              💾 {importMut.isPending ? 'Importing...' : `Import ${preview.length} Transactions`}
            </button>
          )}
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-body" style={{padding:14}}>
          <div style={{background:'var(--blue-light)',border:'1px solid #b0c8f0',borderRadius:3,padding:'10px 14px',marginBottom:14,fontSize:12}}>
            <strong>Accepted formats:</strong> CSV or TSV exported from your online banking portal.<br/>
            Required columns: <strong>Date</strong>, <strong>Description</strong>, plus at least one of <strong>Debit/Credit</strong> or <strong>Amount</strong>.<br/>
            Duplicate transactions (same date + description + amount) are automatically skipped.
          </div>
          <div style={{marginBottom:12}}>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFile}
              style={{display:'none'}} id="csv-upload"/>
            <label htmlFor="csv-upload" className="btn primary" style={{cursor:'pointer',display:'inline-block'}}>
              📂 Choose CSV File
            </label>
          </div>
          {error && <div style={{color:'#c62828',background:'#fdecea',padding:'8px 12px',borderRadius:3,marginBottom:10,fontSize:12}}>{error}</div>}
          {preview && (
            <>
              <div style={{fontSize:12,fontWeight:600,marginBottom:6,color:'#333'}}>
                Preview — {preview.length} rows detected
              </div>
              <div style={{maxHeight:300,overflowY:'auto'}}>
                <table className="data-table" style={{fontSize:11}}>
                  <thead><tr>
                    <th>Date</th><th>Description</th>
                    <th className="right">Debit BHD</th><th className="right">Credit BHD</th>
                    <th className="right">Balance BHD</th>
                  </tr></thead>
                  <tbody>
                    {preview.slice(0,50).map((r,i) => (
                      <tr key={i}>
                        <td>{r.date}</td>
                        <td style={{maxWidth:240,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{r.description}</td>
                        <td className="right" style={{color:'#2e7d32'}}>{r.debit > 0 ? fmtBhd(r.debit) : '—'}</td>
                        <td className="right" style={{color:'#c62828'}}>{r.credit > 0 ? fmtBhd(r.credit) : '—'}</td>
                        <td className="right">{r.balance != null ? fmtBhd(r.balance) : '—'}</td>
                      </tr>
                    ))}
                    {preview.length > 50 && (
                      <tr><td colSpan={5} style={{textAlign:'center',color:'#888',padding:8}}>
                        … and {preview.length - 50} more rows
                      </td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Manual Match Modal ─────────────────────────────────────
function ManualMatchModal({ tx, onClose, onDone }) {
  const amount = parseFloat(tx.debit) > 0 ? parseFloat(tx.debit) : parseFloat(tx.credit)
  const isReceipt = parseFloat(tx.debit) > 0

  const { data: invoices } = useQuery({
    queryKey: ['invoices-match'],
    queryFn: () => invoiceApi.list({ status: 'unpaid,partial,overdue', limit: 200 }).then(r => r.data.data),
    enabled: isReceipt,
  })
  const { data: purchases } = useQuery({
    queryKey: ['purchases-match'],
    queryFn: () => purchaseApi.list({}).then(r => r.data.data),
    enabled: !isReceipt,
  })

  const [search, setSearch] = useState('')
  const [selectedRef, setSelectedRef] = useState(null)  // { ref_type, ref_id, ref_no }

  const items = isReceipt
    ? (invoices || []).filter(i => {
        const bal = parseFloat(i.balance_due || 0)
        const s = search.toLowerCase()
        return (!s || i.invoice_no.toLowerCase().includes(s) || i.customer_name.toLowerCase().includes(s))
      })
    : (purchases || []).filter(p => {
        const s = search.toLowerCase()
        return (!s || p.purchase_no.toLowerCase().includes(s) || p.supplier_name.toLowerCase().includes(s))
      })

  const matchMut = useMutation({
    mutationFn: () => bankApi.manualMatch(tx.id, selectedRef),
    onSuccess: () => { toast.success('Transaction matched'); onDone() },
    onError: (e) => toast.error(e.response?.data?.error?.message || 'Match failed'),
  })

  return (
    <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal modal-lg">
        <div className="modal-header">
          <h3>Match Transaction</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-toolbar">
          <button className="btn primary" disabled={!selectedRef || matchMut.isPending} onClick={()=>matchMut.mutate()}>
            🔗 {matchMut.isPending ? 'Matching...' : 'Confirm Match'}
          </button>
          <button className="btn" onClick={onClose}>Cancel</button>
        </div>
        <div className="modal-body" style={{padding:14}}>
          {/* Transaction summary */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:14}}>
            <div style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:3,padding:'8px 12px'}}>
              <div style={{fontSize:10,color:'#888',textTransform:'uppercase'}}>Date</div>
              <div style={{fontWeight:600}}>{fmtDate(tx.transaction_date)}</div>
            </div>
            <div style={{background:'#f8f8f8',border:'1px solid #ddd',borderRadius:3,padding:'8px 12px',gridColumn:'span 1'}}>
              <div style={{fontSize:10,color:'#888',textTransform:'uppercase'}}>Description</div>
              <div style={{fontWeight:600,fontSize:12}}>{tx.description}</div>
            </div>
            <div style={{background: isReceipt ? 'var(--green-light)' : '#fdecea', border:`1px solid ${isReceipt?'#a5d6a7':'#ef9a9a'}`,borderRadius:3,padding:'8px 12px'}}>
              <div style={{fontSize:10,color:'#888',textTransform:'uppercase'}}>{isReceipt ? 'Received (Debit)' : 'Payment (Credit)'}</div>
              <div style={{fontWeight:700,fontSize:15,color: isReceipt ? 'var(--green)' : 'var(--red)'}}>BHD {fmtBhd(amount)}</div>
            </div>
          </div>

          <div style={{fontSize:12,fontWeight:600,marginBottom:6}}>
            {isReceipt ? 'Match to Invoice (Customer Receipt)' : 'Match to Purchase (Supplier Payment)'}
          </div>

          <input type="text" placeholder={isReceipt ? 'Search invoice no. or customer...' : 'Search purchase no. or supplier...'}
            value={search} onChange={e=>setSearch(e.target.value)}
            style={{width:'100%',marginBottom:8,padding:'5px 8px',border:'1px solid #bbb',borderRadius:2,fontSize:12}}/>

          <div style={{maxHeight:280,overflowY:'auto',border:'1px solid #e0e0e0',borderRadius:3}}>
            <table className="data-table" style={{fontSize:12}}>
              <thead><tr>
                {isReceipt
                  ? <><th></th><th>Invoice No.</th><th>Customer</th><th>Date</th><th className="right">Total BHD</th><th className="right">Balance BHD</th></>
                  : <><th></th><th>Purchase No.</th><th>Supplier</th><th>Date</th><th className="right">Total BHD</th><th className="right">Balance BHD</th></>
                }
              </tr></thead>
              <tbody>
                {items.length === 0 && <tr className="empty-row"><td colSpan={6}>No results</td></tr>}
                {items.map(item => {
                  const ref = isReceipt
                    ? { ref_type: 'invoice', ref_id: item.id, ref_no: item.invoice_no }
                    : { ref_type: 'purchase', ref_id: item.id, ref_no: item.purchase_no }
                  const isSel = selectedRef?.ref_id === item.id
                  const bal = isReceipt
                    ? parseFloat(item.balance_due || 0)
                    : parseFloat(item.grand_total || 0) - parseFloat(item.amount_paid || 0)
                  const closeMatch = Math.abs(bal - amount) < 0.01
                  return (
                    <tr key={item.id} onClick={()=>setSelectedRef(isSel ? null : ref)}
                      style={{cursor:'pointer', background: isSel ? 'var(--blue-light)' : closeMatch ? '#f0fff4' : '#fff'}}>
                      <td style={{width:24}}>
                        <input type="radio" readOnly checked={isSel} style={{cursor:'pointer'}}/>
                      </td>
                      <td style={{color:'var(--blue)',fontWeight:600}}>
                        {isReceipt ? item.invoice_no : item.purchase_no}
                        {closeMatch && <span style={{marginLeft:6,fontSize:10,color:'#2e7d32',fontWeight:700}}>✓ Amount match</span>}
                      </td>
                      <td>{isReceipt ? item.customer_name : item.supplier_name}</td>
                      <td>{fmtDate(isReceipt ? item.invoice_date : item.purchase_date)}</td>
                      <td className="right">{fmtBhd(item.grand_total)}</td>
                      <td className="right" style={{fontWeight:600,color: bal > 0 ? 'var(--red)' : 'var(--green)'}}>
                        {fmtBhd(bal)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {selectedRef && (
            <div style={{marginTop:10,padding:'8px 12px',background:'#e3f2fd',border:'1px solid #90caf9',borderRadius:3,fontSize:12}}>
              Selected: <strong>{selectedRef.ref_no}</strong> — click Confirm Match to save.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
