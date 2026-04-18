import { useState } from 'react'
import EmployeesTab from './EmployeesTab'
import PayrollTab   from './PayrollTab'
import LeaveTab     from './LeaveTab'

const TABS = [
  { id: 'employees', label: 'Employees' },
  { id: 'leave',     label: 'Leave Management' },
  { id: 'payroll',   label: 'Payroll Runs' },
]

export default function HRModule() {
  const [tab, setTab] = useState('employees')

  return (
    <div style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden' }}>
      <div className="module-title">Human Resources</div>

      {/* Tab bar */}
      <div style={{ display:'flex', gap:0, borderBottom:'2px solid #d0d0d0', background:'#f7f7f7', flexShrink:0, paddingLeft:12 }}>
        {TABS.map(t => (
          <div key={t.id} onClick={() => setTab(t.id)} style={{
            padding:'7px 20px', fontSize:12, fontWeight:600, cursor:'pointer',
            borderBottom: tab===t.id ? '2px solid var(--blue)' : '2px solid transparent',
            marginBottom:-2, color: tab===t.id ? 'var(--blue)' : '#555',
            background: tab===t.id ? '#fff' : 'transparent',
          }}>{t.label}</div>
        ))}
      </div>

      {tab === 'employees' && <EmployeesTab />}
      {tab === 'leave'     && <LeaveTab />}
      {tab === 'payroll'   && <PayrollTab />}
    </div>
  )
}
