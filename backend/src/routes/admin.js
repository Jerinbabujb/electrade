/**
 * Admin routes — demo reset & data management
 * ADMIN ONLY — all endpoints require admin role
 */
const router  = require('express').Router();
const db      = require('../db');
const { v4: uuid } = require('uuid');
const { authenticate, authorize } = require('../middleware/auth');
const bcrypt  = require('bcryptjs');

router.use(authenticate);
router.use(authorize('admin'));

// ── GET /api/v1/admin/status ─────────────────────────────────
router.get('/status', async (req, res, next) => {
  try {
    const co = req.user.company_id;
    const counts = await Promise.all([
      db.query(`SELECT COUNT(*) FROM customers      WHERE company_id=$1`, [co]),
      db.query(`SELECT COUNT(*) FROM products       WHERE company_id=$1`, [co]),
      db.query(`SELECT COUNT(*) FROM invoices       WHERE company_id=$1`, [co]),
      db.query(`SELECT COUNT(*) FROM purchases      WHERE company_id=$1`, [co]),
      db.query(`SELECT COUNT(*) FROM employees      WHERE company_id=$1`, [co]),
      db.query(`SELECT COUNT(*) FROM cheques        WHERE company_id=$1`, [co]),
      db.query(`SELECT COUNT(*) FROM expenses       WHERE company_id=$1`, [co]),
    ]);
    res.json({ data: {
      customers: parseInt(counts[0].rows[0].count),
      products:  parseInt(counts[1].rows[0].count),
      invoices:  parseInt(counts[2].rows[0].count),
      purchases: parseInt(counts[3].rows[0].count),
      employees: parseInt(counts[4].rows[0].count),
      cheques:   parseInt(counts[5].rows[0].count),
      expenses:  parseInt(counts[6].rows[0].count),
    }});
  } catch (err) { next(err); }
});

// ── Shared helper: wipe all business data ────────────────────
async function wipeAllData(client, co) {
  await client.query(`DELETE FROM payslips        WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM payroll_runs    WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM employee_leaves WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM employees       WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM payments        WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM document_conversions WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM delivery_notes  WHERE company_id=$1`, [co]); // cascades to delivery_note_items
  await client.query(`DELETE FROM invoices        WHERE company_id=$1`, [co]); // cascades to invoice_items
  await client.query(`DELETE FROM purchases       WHERE company_id=$1`, [co]); // cascades to purchase_items
  await client.query(`DELETE FROM stock_movements WHERE company_id=$1`, [co]);
  // Purchase orders reference products via purchase_order_items — must go before products
  await client.query(`DELETE FROM purchase_orders   WHERE company_id=$1`, [co]); // cascades to purchase_order_items
  // Shipments first — cascades to shipment_items which references products
  await client.query(`DELETE FROM shipments       WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM products        WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM expenses        WHERE company_id=$1`, [co]); // before categories (FK expenses.category_id)
  await client.query(`DELETE FROM categories      WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM bank_transactions WHERE bank_account_id IN (SELECT id FROM bank_accounts WHERE company_id=$1)`, [co]);
  await client.query(`DELETE FROM bank_accounts   WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM cheques         WHERE company_id=$1`, [co]);
  // Tasks cascade to task_comments via task_id
  await client.query(`DELETE FROM tasks           WHERE company_id=$1`, [co]);
  // CRM tables all reference customers — must go before customers
  await client.query(`DELETE FROM crm_opportunities WHERE company_id=$1`, [co]);
  // crm_contacts and crm_interactions: delete only if the table exists (added later)
  const { rows: crmTables } = await client.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema='public' AND table_name IN ('crm_contacts','crm_interactions')`);
  const crmTableNames = crmTables.map(r => r.table_name);
  if (crmTableNames.includes('crm_interactions'))
    await client.query(`DELETE FROM crm_interactions WHERE company_id=$1`, [co]);
  if (crmTableNames.includes('crm_contacts'))
    await client.query(`DELETE FROM crm_contacts WHERE company_id=$1`, [co]);
  await client.query(`DELETE FROM customers         WHERE company_id=$1`, [co]);
  // Reset document sequences
  await client.query(`UPDATE companies SET next_invoice_seq=1, next_dn_seq=1, next_pur_seq=1,
    next_quotation_seq=1, next_proforma_seq=1, next_po_order_seq=1 WHERE id=$1`, [co]);
}

// ── POST /api/v1/admin/clear ─────────────────────────────────
// Clear all business data only — leaves company settings & users intact
router.post('/clear', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await wipeAllData(client, req.user.company_id);
    await client.query('COMMIT');
    res.json({ message: 'All business data cleared successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

// ── POST /api/v1/admin/load-demo ─────────────────────────────
router.post('/load-demo', async (req, res, next) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    const co  = req.user.company_id;
    const uid = req.user.id;
    const yr  = new Date().getFullYear();
    const today = new Date();
    const ymd     = (d) => (d instanceof Date ? d : new Date(d)).toISOString().split('T')[0];
    const daysAgo = (n) => ymd(new Date(today - n * 864e5));
    const daysAhead = (n) => ymd(new Date(+today + n * 864e5));

    // ── 1. Categories ─────────────────────────────────────────
    const cats = ['Cables & Wires','Switchgear & MCBs','Lighting & Fixtures','Conduits & Fittings',
                  'Sockets & Switches','Distribution Panels','Tools & Equipment','Safety & PPE',
                  'Transformers','Accessories & Sundries'];
    const catIds = {};
    for (let i = 0; i < cats.length; i++) {
      const id = uuid();
      await client.query(`INSERT INTO categories (id,company_id,name,type,sort_order) VALUES ($1,$2,$3,'product',$4)`, [id,co,cats[i],i+1]);
      catIds[cats[i]] = id;
    }
    const expCats = ['Transport & Fuel','Office Supplies','Maintenance','Utilities','Marketing','Rent'];
    const expCatIds = {};
    for (let i = 0; i < expCats.length; i++) {
      const id = uuid();
      await client.query(`INSERT INTO categories (id,company_id,name,type,sort_order) VALUES ($1,$2,$3,'expense',$4)`, [id,co,expCats[i],i+1]);
      expCatIds[expCats[i]] = id;
    }

    // ── 2. Customers & Suppliers ──────────────────────────────
    const custData = [
      { code:'C001', name:'Gulf Contracting W.L.L',         type:'wholesale', vat:'BH-VAT-20240011', tel:'+973 1712 3456', email:'orders@gulfcontracting.bh',        addr:'Seef District, Manama',           terms:30  },
      { code:'C002', name:'Bahrain National Electrics Co.',  type:'wholesale', vat:'BH-VAT-20240022', tel:'+973 1723 4567', email:'procurement@bne.bh',               addr:'Sitra Industrial Area, Bahrain',  terms:45  },
      { code:'C003', name:'Al Fateh Engineering',            type:'contractor',vat:'BH-VAT-20240033', tel:'+973 1734 5678', email:'info@alfateh-eng.bh',              addr:'Hidd Industrial Area, Bahrain',   terms:30  },
      { code:'C004', name:'Riyadh Trading Est.',             type:'wholesale', vat:'SA-VAT-30001234', tel:'+966 11 234 5678',email:'buy@riyadhtrading.com',           addr:'Riyadh, Saudi Arabia',            terms:30  },
      { code:'C005', name:'Ahmed Khalid Al Dosari',          type:'retail',    vat:'',               tel:'+973 3900 1111', email:'ahmed.dosari@gmail.com',            addr:'Isa Town, Bahrain',               terms:0   },
      { code:'C006', name:'Mohammed Hassan Electricals',     type:'retail',    vat:'',               tel:'+973 3900 2222', email:'mhelectrical@hotmail.com',          addr:'Muharraq, Bahrain',               terms:0   },
      { code:'C007', name:'Al Noor Building Contracting',    type:'contractor',vat:'BH-VAT-20240077', tel:'+973 1745 6789', email:'procurement@alnoor-bc.bh',         addr:'Manama, Bahrain',                 terms:60  },
      { code:'S001', name:'Pacific Cable Manufacturers LLC', type:'supplier',  vat:'',               tel:'+971 4 234 5678',email:'sales@pacificcable.ae',            addr:'Jebel Ali Free Zone, Dubai, UAE', terms:30  },
      { code:'S002', name:'Schneider Electric Gulf',         type:'supplier',  vat:'',               tel:'+971 4 345 6789',email:'gulf.sales@schneider-electric.com',addr:'Dubai, UAE',                      terms:30  },
      { code:'S003', name:'Prysmian Group MENA',             type:'supplier',  vat:'',               tel:'+971 2 456 7890',email:'mena@prysmian.com',                addr:'Abu Dhabi, UAE',                  terms:45  },
    ];
    const custIds = {};
    for (const c of custData) {
      const id = uuid();
      await client.query(
        `INSERT INTO customers (id,company_id,code,name,type,vat_number,tel,email,address,credit_limit,payment_terms_days,is_active)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,10000,$10,true)`,
        [id,co,c.code,c.name,c.type,c.vat||null,c.tel||null,c.email||null,c.addr||null,c.terms]
      );
      custIds[c.name] = id;
    }

    // ── 3. Products ───────────────────────────────────────────
    const prodData = [
      { sku:'CAB-001', name:'2.5mm² Twin & Earth Cable (per mtr)', cat:'Cables & Wires',          unit:'mtr',  cost:0.280, p1:0.420, p2:0.400, p3:0.390, stock:2000, min:200 },
      { sku:'CAB-002', name:'6mm² Single Core PVC Cable (per mtr)',cat:'Cables & Wires',          unit:'mtr',  cost:0.480, p1:0.720, p2:0.680, p3:0.660, stock:1500, min:150 },
      { sku:'CAB-003', name:'16mm² Armoured Cable SWA (per mtr)',  cat:'Cables & Wires',          unit:'mtr',  cost:1.850, p1:2.800, p2:2.650, p3:2.500, stock:800,  min:100 },
      { sku:'CAB-004', name:'4mm² Single Core PVC Cable (per mtr)',cat:'Cables & Wires',          unit:'mtr',  cost:0.380, p1:0.580, p2:0.550, p3:0.530, stock:1200, min:100 },
      { sku:'MCB-001', name:'Schneider 16A SP MCB C-Curve',        cat:'Switchgear & MCBs',       unit:'pcs',  cost:1.200, p1:1.900, p2:1.800, p3:1.700, stock:300,  min:50  },
      { sku:'MCB-002', name:'Schneider 32A DP MCB C-Curve',        cat:'Switchgear & MCBs',       unit:'pcs',  cost:2.800, p1:4.200, p2:4.000, p3:3.800, stock:200,  min:30  },
      { sku:'MCB-003', name:'63A 4P MCCB Moulded Case',            cat:'Switchgear & MCBs',       unit:'pcs',  cost:18.50, p1:28.00, p2:26.00, p3:24.00, stock:50,   min:10  },
      { sku:'LTG-001', name:'LED Downlight 12W Warm White',        cat:'Lighting & Fixtures',     unit:'pcs',  cost:1.800, p1:2.800, p2:2.650, p3:2.500, stock:500,  min:50  },
      { sku:'LTG-002', name:'LED Batten 36W 4ft Twin',             cat:'Lighting & Fixtures',     unit:'pcs',  cost:4.500, p1:6.800, p2:6.400, p3:6.000, stock:200,  min:20  },
      { sku:'LTG-003', name:'LED Flood Light 100W IP65',           cat:'Lighting & Fixtures',     unit:'pcs',  cost:8.500, p1:13.00, p2:12.00, p3:11.50, stock:80,   min:10  },
      { sku:'CON-001', name:'20mm PVC Conduit 3m',                 cat:'Conduits & Fittings',     unit:'pcs',  cost:0.350, p1:0.550, p2:0.520, p3:0.500, stock:600,  min:50  },
      { sku:'CON-002', name:'32mm PVC Conduit 3m',                 cat:'Conduits & Fittings',     unit:'pcs',  cost:0.520, p1:0.800, p2:0.760, p3:0.730, stock:400,  min:50  },
      { sku:'SCK-001', name:'13A Single Socket Outlet (white)',    cat:'Sockets & Switches',      unit:'pcs',  cost:0.450, p1:0.700, p2:0.660, p3:0.640, stock:400,  min:50  },
      { sku:'SCK-002', name:'13A Twin Socket with USB',            cat:'Sockets & Switches',      unit:'pcs',  cost:1.200, p1:1.900, p2:1.800, p3:1.700, stock:250,  min:30  },
      { sku:'PNL-001', name:'18-Way Consumer Unit with RCD',       cat:'Distribution Panels',     unit:'pcs',  cost:22.00, p1:34.00, p2:32.00, p3:30.00, stock:30,   min:5   },
      { sku:'PNL-002', name:'12-Way Distribution Board',           cat:'Distribution Panels',     unit:'pcs',  cost:14.50, p1:22.00, p2:20.50, p3:19.00, stock:25,   min:5   },
      { sku:'PPE-001', name:'Electrical Safety Gloves (Class 00)', cat:'Safety & PPE',            unit:'pcs',  cost:3.500, p1:5.500, p2:5.200, p3:5.000, stock:60,   min:10  },
      { sku:'ACC-001', name:'Cable Ties 300mm (pack of 100)',      cat:'Accessories & Sundries',  unit:'pack', cost:0.600, p1:0.950, p2:0.900, p3:0.850, stock:200,  min:20  },
      { sku:'ACC-002', name:'Junction Box 100x100mm IP55',         cat:'Accessories & Sundries',  unit:'pcs',  cost:0.800, p1:1.250, p2:1.200, p3:1.150, stock:150,  min:20  },
      { sku:'TRF-001', name:'15KVA Step-Down Transformer 415/240V',cat:'Transformers',            unit:'pcs',  cost:280.0, p1:420.0, p2:400.0, p3:380.0, stock:5,    min:1   },
    ];
    const prodIds = {};
    for (const p of prodData) {
      const id = uuid();
      await client.query(
        `INSERT INTO products (id,company_id,sku,name,category_id,unit,cost_price,price_1,price_2,price_3,vat_rate,is_active,is_stock_tracked,stock_qty,stock_min)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,10,true,true,$11,$12)`,
        [id,co,p.sku,p.name,catIds[p.cat],p.unit,p.cost,p.p1,p.p2,p.p3,p.stock,p.min]
      );
      await client.query(
        `INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,notes) VALUES ($1,$2,$3,'opening',$4,'manual','Opening stock')`,
        [uuid(),co,id,p.stock]
      );
      prodIds[p.sku] = { id, ...p };
    }

    // ── 4. Employees ──────────────────────────────────────────
    const empData = [
      { no:'EMP-001', name:'Khalid Ali Al Mansoori',  nat:'Bahraini', cpr:'880412345',  pos:'Sales Manager',        dept:'Sales',     join:'2019-03-01', basic:450, housing:150, transport:60,  bahraini:true,  gosi:true,  ecg:false, al:30 },
      { no:'EMP-002', name:'Rajan Pillai',             nat:'Indian',   cpr:'20212345',   pos:'Senior Salesman',      dept:'Sales',     join:'2021-06-15', basic:280, housing:80,  transport:40,  bahraini:false, gosi:true,  ecg:true,  al:30 },
      { no:'EMP-003', name:'Mohammed Yusuf Al Sayed',  nat:'Bahraini', cpr:'910312345',  pos:'Accountant',           dept:'Finance',   join:'2020-01-10', basic:380, housing:120, transport:50,  bahraini:true,  gosi:true,  ecg:false, al:30 },
      { no:'EMP-004', name:'Suresh Kumar',             nat:'Indian',   cpr:'19678901',   pos:'Warehouse Supervisor', dept:'Warehouse', join:'2018-09-01', basic:260, housing:80,  transport:40,  bahraini:false, gosi:true,  ecg:true,  al:30 },
      { no:'EMP-005', name:'Fatima Hassan Al Qassim',  nat:'Bahraini', cpr:'950612345',  pos:'Admin Assistant',      dept:'Admin',     join:'2022-04-20', basic:320, housing:100, transport:50,  bahraini:true,  gosi:true,  ecg:false, al:30 },
      { no:'EMP-006', name:'Priya Nair',               nat:'Indian',   cpr:'20156789',   pos:'Storekeeper',          dept:'Warehouse', join:'2023-02-01', basic:220, housing:70,  transport:30,  bahraini:false, gosi:true,  ecg:false, al:30 },
    ];
    const empIds = {};
    for (const e of empData) {
      const id = uuid();
      await client.query(
        `INSERT INTO employees (id,company_id,emp_no,full_name,nationality,id_number,position,department,
           join_date,status,basic_salary,housing_allow,transport_allow,other_allow,
           gosi_eligible,is_bahraini,employer_covers_gosi,annual_leave_days,bank_name,bank_iban)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'active',$10,$11,$12,0,$13,$14,$15,$16,'BBK',NULL)`,
        [id,co,e.no,e.name,e.nat,e.cpr,e.pos,e.dept,e.join,e.basic,e.housing,e.transport,e.gosi,e.bahraini,e.ecg,e.al]
      );
      empIds[e.no] = id;
    }

    // Leave records
    await client.query(
      `INSERT INTO employee_leaves (id,company_id,employee_id,leave_type,start_date,end_date,days_requested,status,notes)
       VALUES ($1,$2,$3,'annual',$4,$5,20,'active','Annual leave — approved')`,
      [uuid(),co,empIds['EMP-002'],daysAhead(5),daysAhead(24)]
    );
    await client.query(
      `INSERT INTO employee_leaves (id,company_id,employee_id,leave_type,start_date,end_date,resume_date,days_requested,days_taken,status,notes)
       VALUES ($1,$2,$3,'sick',$4,$5,$5,3,3,'resumed','Sick leave — returned to work')`,
      [uuid(),co,empIds['EMP-005'],daysAgo(20),daysAgo(18)]
    );

    // ── 5. Bank accounts ─────────────────────────────────────
    const bankBBK  = uuid();
    const bankCash = uuid();
    await client.query(
      `INSERT INTO bank_accounts (id,company_id,bank_name,account_name,account_number,iban,currency,current_balance,is_active)
       VALUES ($1,$2,'Bank of Bahrain and Kuwait (BBK)','Al Noor - Current Account','1234567890','BH29BBKU1012345678BHD','BHD',18750.500,true)`,
      [bankBBK,co]
    );
    await client.query(
      `INSERT INTO bank_accounts (id,company_id,bank_name,account_name,account_number,iban,currency,current_balance,is_active)
       VALUES ($1,$2,'Petty Cash','Office Cash Float','CASH-001',NULL,'BHD',450.000,true)`,
      [bankCash,co]
    );

    // Bank transactions
    const bankTxns = [
      { desc:'Customer payment — Gulf Contracting INV-0001',  credit:1162.500, debit:0,        date:daysAgo(52) },
      { desc:'Supplier payment — Pacific Cable PUR-0001',     credit:0,        debit:2587.200, date:daysAgo(48) },
      { desc:'Customer payment — Al Fateh Engineering',       credit:853.710,  debit:0,        date:daysAgo(33) },
      { desc:'Supplier payment — Schneider Electric',         credit:0,        debit:1540.200, date:daysAgo(28) },
      { desc:'Customer payment — Riyadh Trading Est.',        credit:1024.650, debit:0,        date:daysAgo(18) },
      { desc:'Electricity bill payment',                      credit:0,        debit:132.000,  date:daysAgo(14) },
      { desc:'Salary transfer — March payroll',               credit:0,        debit:2530.000, date:daysAgo(10) },
      { desc:'Rent — warehouse',                              credit:0,        debit:350.000,  date:daysAgo(7)  },
      { desc:'Customer payment — BNE Co.',                    credit:2965.680, debit:0,        date:daysAgo(5)  },
      { desc:'Customer payment — Al Noor Building',           credit:1845.000, debit:0,        date:daysAgo(2)  },
    ];
    for (const t of bankTxns) {
      await client.query(
        `INSERT INTO bank_transactions (id,bank_account_id,transaction_date,description,debit,credit,match_status)
         VALUES ($1,$2,$3,$4,$5,$6,'unmatched')`,
        [uuid(),bankBBK,t.date,t.desc,t.debit,t.credit]
      );
    }

    // ── 6. Purchases ──────────────────────────────────────────
    const purRows = [
      { sup:'Pacific Cable Manufacturers LLC', date:daysAgo(75), no:`PUR-${yr}-0001`, status:'paid',    lines:[{sku:'CAB-001',qty:5000,cost:0.260},{sku:'CAB-002',qty:2000,cost:0.460},{sku:'CAB-004',qty:3000,cost:0.360}] },
      { sup:'Schneider Electric Gulf',          date:daysAgo(55), no:`PUR-${yr}-0002`, status:'paid',    lines:[{sku:'MCB-001',qty:500,cost:1.150},{sku:'MCB-002',qty:300,cost:2.700}] },
      { sup:'Prysmian Group MENA',             date:daysAgo(40), no:`PUR-${yr}-0003`, status:'partial', lines:[{sku:'CAB-003',qty:1000,cost:1.800},{sku:'LTG-001',qty:500,cost:1.750}] },
      { sup:'Schneider Electric Gulf',          date:daysAgo(25), no:`PUR-${yr}-0004`, status:'unpaid',  lines:[{sku:'MCB-003',qty:80,cost:18.00},{sku:'PNL-001',qty:25,cost:21.50},{sku:'PNL-002',qty:30,cost:14.00}] },
      { sup:'Pacific Cable Manufacturers LLC', date:daysAgo(10), no:`PUR-${yr}-0005`, status:'unpaid',  lines:[{sku:'CON-001',qty:500,cost:0.330},{sku:'CON-002',qty:400,cost:0.500},{sku:'ACC-001',qty:200,cost:0.580}] },
    ];
    for (const p of purRows) {
      const pid = uuid();
      const sub = parseFloat(p.lines.reduce((s,l)=>s+l.qty*l.cost,0).toFixed(3));
      const vat = parseFloat((sub*0.10).toFixed(3));
      const grand = parseFloat((sub+vat).toFixed(3));
      const paid = p.status==='paid' ? grand : p.status==='partial' ? parseFloat((grand*0.5).toFixed(3)) : 0;
      await client.query(
        `INSERT INTO purchases (id,company_id,purchase_no,supplier_id,purchase_date,subtotal,total_vat,grand_total,amount_paid,payment_status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [pid,co,p.no,custIds[p.sup],p.date,sub,vat,grand,paid,p.status,uid]
      );
      for (let li=0;li<p.lines.length;li++) {
        const l = p.lines[li];
        await client.query(
          `INSERT INTO purchase_items (id,purchase_id,product_id,line_no,description,qty,unit_price) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
          [uuid(),pid,prodIds[l.sku].id,li+1,prodIds[l.sku].name,l.qty,l.cost]
        );
        await client.query(
          `INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,ref_id,notes) VALUES ($1,$2,$3,'purchase_in',$4,'purchase',$5,'Purchase receipt')`,
          [uuid(),co,prodIds[l.sku].id,l.qty,pid]
        );
      }
      if (paid>0) {
        await client.query(
          `INSERT INTO payments (id,company_id,reference_type,reference_id,amount,method,payment_date,notes) VALUES ($1,$2,'purchase',$3,$4,'bank_transfer',$5,'Purchase payment')`,
          [uuid(),co,pid,paid,p.date]
        );
      }
    }

    // ── 7. Shipment (landed cost) ─────────────────────────────
    const shipId = uuid();
    const xrate = 0.377;  // USD to BHD
    const freightUSD = 1850.00, insuranceUSD = 120.00, localBHD = 85.000;
    await client.query(
      `INSERT INTO shipments (id,company_id,shipment_no,description,supplier,origin_country,shipment_date,arrival_date,
         status,product_currency,product_xrate,freight_amount,freight_currency,freight_xrate,
         insurance,insurance_currency,insurance_xrate,local_transport,notes,created_by)
       VALUES ($1,$2,'SHIP-${yr}-0001','Container shipment — cables & conduits','Pacific Cable Manufacturers LLC',
         'China',$3,$4,'applied','USD',$5,$6,'USD',$5,$7,'USD',$5,$8,$9,$10)`,
      [shipId,co,daysAgo(70),daysAgo(55),xrate,freightUSD,insuranceUSD,localBHD,
       'Cables & conduits — Q1 shipment from China',uid]
    );
    const shipItems = [
      {sku:'CAB-001',qty:5000,cost:0.260},
      {sku:'CAB-002',qty:2000,cost:0.460},
      {sku:'CAB-003',qty:1000,cost:1.800},
    ];
    const totalCostUSD = shipItems.reduce((s,i)=>s+i.qty*i.cost,0);
    for (const si of shipItems) {
      const share = (si.qty*si.cost)/totalCostUSD;
      const allocFreight  = parseFloat((freightUSD * share * xrate).toFixed(6));
      const allocInsurance= parseFloat((insuranceUSD * share * xrate).toFixed(6));
      const allocLocal    = parseFloat((localBHD * share).toFixed(6));
      const unitProdCost  = parseFloat((si.cost * xrate).toFixed(5));
      const totalLanded   = parseFloat((si.qty*unitProdCost + allocFreight + allocInsurance + allocLocal).toFixed(3));
      const unitLanded    = parseFloat((totalLanded / si.qty).toFixed(5));
      await client.query(
        `INSERT INTO shipment_items (id,shipment_id,company_id,product_id,sku,product_name,qty,unit_cost,
           alloc_freight,alloc_insurance,alloc_local_other,unit_product_cost,unit_landed_cost,total_landed_cost)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [uuid(),shipId,co,prodIds[si.sku].id,si.sku,prodIds[si.sku].name,si.qty,si.cost,
         allocFreight,allocInsurance,allocLocal,unitProdCost,unitLanded,totalLanded]
      );
    }
    await client.query(
      `INSERT INTO shipment_payments (id,shipment_id,company_id,payment_date,payment_type,amount,currency,exchange_rate,amount_bhd,notes,created_by)
       VALUES ($1,$2,$3,$4,'advance',3184.650,'USD',$5,1200.000,'Freight advance payment',$6)`,
      [uuid(),shipId,co,daysAgo(72),xrate,uid]
    );

    // ── 8. Quotations (3) ─────────────────────────────────────
    // Reset sequences for clean numbering
    await client.query(`UPDATE companies SET next_invoice_seq=1, next_dn_seq=1, next_pur_seq=6, next_quotation_seq=1, next_proforma_seq=1, next_po_order_seq=1 WHERE id=$1`,[co]);

    // validUntil replaces due_date for quotations
    const Q = async (custName, lines, dDate, validUntil, status='unpaid', poRef='') => {
      const { rows:[co2] } = await client.query(
        `UPDATE companies SET next_quotation_seq=next_quotation_seq+1 WHERE id=$1 RETURNING quotation_prefix,next_quotation_seq-1 AS seq`,[co]);
      const no = `${co2.quotation_prefix}-${yr}-${String(co2.seq).padStart(4,'0')}`;
      const sub = parseFloat(lines.reduce((s,l)=>s+l.qty*l.p,0).toFixed(3));
      const vat = parseFloat((sub*0.10).toFixed(3));
      const grand = parseFloat((sub+vat).toFixed(3));
      const id = uuid();
      await client.query(
        `INSERT INTO invoices (id,company_id,invoice_no,type,customer_id,invoice_date,valid_until,po_reference,subtotal,total_vat,grand_total,payment_status,created_by)
         VALUES ($1,$2,$3,'quotation',$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id,co,no,custIds[custName],dDate,validUntil,poRef,sub,vat,grand,status,uid]
      );
      for (let li=0;li<lines.length;li++) {
        const l=lines[li];
        await client.query(
          `INSERT INTO invoice_items (id,invoice_id,product_id,line_no,part_no,description,qty,unit,unit_price,discount,vat_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,10)`,
          [uuid(),id,prodIds[l.sku].id,li+1,l.sku,prodIds[l.sku].name,l.qty,prodIds[l.sku].unit,l.p]
        );
      }
      return { id, no };
    };

    // QT-0001: Draft quotation — not yet issued to customer
    const qt1 = await Q('Al Noor Building Contracting',
      [{sku:'LTG-001',qty:200,p:2.800},{sku:'LTG-002',qty:80,p:6.800},{sku:'CON-001',qty:300,p:0.550}],
      daysAgo(2), daysAhead(5), 'draft');

    // QT-0002: Issued quotation — converted to DN (stamped below)
    const qt2 = await Q('Gulf Contracting W.L.L',
      [{sku:'CAB-001',qty:500,p:0.420},{sku:'MCB-001',qty:50,p:1.900},{sku:'SCK-001',qty:100,p:0.700}],
      daysAgo(20), daysAhead(10));

    // QT-0003: Issued quotation — converted to Invoice (stamped below)
    const qt3 = await Q('Al Fateh Engineering',
      [{sku:'MCB-002',qty:40,p:4.200},{sku:'PNL-001',qty:5,p:34.00},{sku:'MCB-003',qty:6,p:28.00}],
      daysAgo(30), daysAhead(0));

    // QT-0004: Open quotation — awaiting customer decision (expiring soon)
    await Q('Bahrain National Electrics Co.',
      [{sku:'CAB-003',qty:200,p:2.800},{sku:'MCB-002',qty:30,p:4.200},{sku:'ACC-002',qty:50,p:1.250}],
      daysAgo(5), daysAhead(2));

    // ── 9. Proforma invoices (2) ──────────────────────────────
    const PF = async (custName, lines, dDate, dueDate) => {
      const { rows:[co2] } = await client.query(
        `UPDATE companies SET next_proforma_seq=next_proforma_seq+1 WHERE id=$1 RETURNING proforma_prefix,next_proforma_seq-1 AS seq`,[co]);
      const no = `${co2.proforma_prefix}-${yr}-${String(co2.seq).padStart(4,'0')}`;
      const sub = parseFloat(lines.reduce((s,l)=>s+l.qty*l.p,0).toFixed(3));
      const vat = parseFloat((sub*0.10).toFixed(3));
      const grand = parseFloat((sub+vat).toFixed(3));
      const id = uuid();
      await client.query(
        `INSERT INTO invoices (id,company_id,invoice_no,type,customer_id,invoice_date,due_date,subtotal,total_vat,grand_total,payment_status,created_by)
         VALUES ($1,$2,$3,'proforma',$4,$5,$6,$7,$8,$9,'unpaid',$10)`,
        [id,co,no,custIds[custName],dDate,dueDate,sub,vat,grand,uid]
      );
      for (let li=0;li<lines.length;li++) {
        const l=lines[li];
        await client.query(
          `INSERT INTO invoice_items (id,invoice_id,product_id,line_no,part_no,description,qty,unit,unit_price,discount,vat_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,10)`,
          [uuid(),id,prodIds[l.sku].id,li+1,l.sku,prodIds[l.sku].name,l.qty,prodIds[l.sku].unit,l.p]
        );
      }
      return { id, no };
    };

    await PF('Riyadh Trading Est.',
      [{sku:'TRF-001',qty:2,p:420.0},{sku:'MCB-003',qty:10,p:28.00}],
      daysAgo(15), daysAhead(15));
    await PF('Bahrain National Electrics Co.',
      [{sku:'CAB-001',qty:1000,p:0.400},{sku:'CAB-002',qty:500,p:0.680}],
      daysAgo(5), daysAhead(25));

    // ── 10. Delivery Notes ────────────────────────────────────
    // DN from QT-0002 — pending invoice
    const dn1id = uuid();
    const { rows:[co3] } = await client.query(
      `UPDATE companies SET next_dn_seq=next_dn_seq+1 WHERE id=$1 RETURNING dn_prefix,next_dn_seq-1 AS seq`,[co]);
    const dn1no = `${co3.dn_prefix}-${yr}-${String(co3.seq).padStart(4,'0')}`;
    const dn1Lines = [{sku:'CAB-001',qty:500,p:0.420},{sku:'MCB-001',qty:50,p:1.900},{sku:'SCK-001',qty:100,p:0.700}];
    await client.query(
      `INSERT INTO delivery_notes (id,company_id,dn_no,customer_id,dn_date,po_reference,delivery_address,project_ref,status,created_by)
       VALUES ($1,$2,$3,$4,$5,'PO-2026-0092','Seef District, Manama','Seef Tower Fitout Phase 2','pending_invoice',$6)`,
      [dn1id,co,dn1no,custIds['Gulf Contracting W.L.L'],daysAgo(12),uid]
    );
    for (let li=0;li<dn1Lines.length;li++) {
      const l=dn1Lines[li];
      await client.query(
        `INSERT INTO delivery_note_items (id,dn_id,product_id,line_no,part_no,description,qty_ordered,qty_delivered,unit,unit_price)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)`,
        [uuid(),dn1id,prodIds[l.sku].id,li+1,l.sku,prodIds[l.sku].name,l.qty,prodIds[l.sku].unit,l.p]
      );
      await client.query(
        `INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,ref_id,notes) VALUES ($1,$2,$3,'dn_out',$4,'delivery_note',$5,'DN delivery')`,
        [uuid(),co,prodIds[l.sku].id,l.qty,dn1id]
      );
    }
    await client.query(
      `INSERT INTO document_conversions (id,company_id,from_type,from_id,from_no,to_type,to_id,to_no,converted_by) VALUES ($1,$2,'invoice',$3,$4,'delivery_note',$5,$6,$7)`,
      [uuid(),co,qt2.id,qt2.no,dn1id,dn1no,uid]
    );

    // DN-0002: standalone DN — also pending invoice
    const dn2id = uuid();
    const { rows:[co4] } = await client.query(
      `UPDATE companies SET next_dn_seq=next_dn_seq+1 WHERE id=$1 RETURNING dn_prefix,next_dn_seq-1 AS seq`,[co]);
    const dn2no = `${co4.dn_prefix}-${yr}-${String(co4.seq).padStart(4,'0')}`;
    const dn2Lines = [{sku:'LTG-003',qty:10,p:13.00},{sku:'PPE-001',qty:10,p:5.500}];
    await client.query(
      `INSERT INTO delivery_notes (id,company_id,dn_no,customer_id,dn_date,po_reference,delivery_address,project_ref,status,created_by)
       VALUES ($1,$2,$3,$4,$5,'PO-2026-0085','Muharraq, Bahrain','Muharraq Housing Project','pending_invoice',$6)`,
      [dn2id,co,dn2no,custIds['Mohammed Hassan Electricals'],daysAgo(6),uid]
    );
    for (let li=0;li<dn2Lines.length;li++) {
      const l=dn2Lines[li];
      await client.query(
        `INSERT INTO delivery_note_items (id,dn_id,product_id,line_no,part_no,description,qty_ordered,qty_delivered,unit,unit_price) VALUES ($1,$2,$3,$4,$5,$6,$7,$7,$8,$9)`,
        [uuid(),dn2id,prodIds[l.sku].id,li+1,l.sku,prodIds[l.sku].name,l.qty,prodIds[l.sku].unit,l.p]
      );
      await client.query(
        `INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,ref_id,notes) VALUES ($1,$2,$3,'dn_out',$4,'delivery_note',$5,'DN delivery')`,
        [uuid(),co,prodIds[l.sku].id,l.qty,dn2id]
      );
    }

    // ── 10b. Invoice consolidated from DN-1 (demonstrates DN→Invoice flow) ──
    // DN-1 (from Gulf Contracting) gets consolidated into a tax invoice
    const { rows:[coDNINV] } = await client.query(
      `UPDATE companies SET next_invoice_seq=next_invoice_seq+1 WHERE id=$1 RETURNING invoice_prefix,next_invoice_seq-1 AS seq`,[co]);
    const dnInvNo = `${coDNINV.invoice_prefix}-${yr}-${String(coDNINV.seq).padStart(4,'0')}`;
    const dnInvSub  = parseFloat(dn1Lines.reduce((s,l)=>s+l.qty*l.p,0).toFixed(3));
    const dnInvVat  = parseFloat((dnInvSub*0.10).toFixed(3));
    const dnInvGrand = parseFloat((dnInvSub+dnInvVat).toFixed(3));
    const dnInvId = uuid();
    await client.query(
      `INSERT INTO invoices (id,company_id,invoice_no,type,customer_id,invoice_date,due_date,po_reference,subtotal,total_discount,total_vat,grand_total,amount_paid,payment_status,created_by)
       VALUES ($1,$2,$3,'tax_invoice',$4,$5,$5,'PO-2026-0092',$6,0,$7,$8,0,'unpaid',$9)`,
      [dnInvId,co,dnInvNo,custIds['Gulf Contracting W.L.L'],daysAgo(8),dnInvSub,dnInvVat,dnInvGrand,uid]
    );
    for (let li=0;li<dn1Lines.length;li++) {
      const l=dn1Lines[li];
      await client.query(
        `INSERT INTO invoice_items (id,invoice_id,product_id,line_no,part_no,description,qty,unit,unit_price,discount,vat_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,10)`,
        [uuid(),dnInvId,prodIds[l.sku].id,li+1,l.sku,prodIds[l.sku].name,l.qty,prodIds[l.sku].unit,l.p]
      );
    }
    // Mark DN-1 as invoiced and link to the invoice
    await client.query(`UPDATE delivery_notes SET invoice_id=$1, status='invoiced' WHERE id=$2`,[dnInvId,dn1id]);
    // Conversion record: DN-1 → Invoice
    await client.query(
      `INSERT INTO document_conversions (id,company_id,from_type,from_id,from_no,to_type,to_id,to_no,converted_by) VALUES ($1,$2,'delivery_note',$3,$4,'invoice',$5,$6,$7)`,
      [uuid(),co,dn1id,dn1no,dnInvId,dnInvNo,uid]
    );
    // Sequence continues from 2 — regular invoices will be 0002 onward

    // ── 11. Tax Invoices ──────────────────────────────────────
    const INV = async (custName, lines, dDate, dueDate, status, poRef, shipping=0, amtPaid=null) => {
      const { rows:[co2] } = await client.query(
        `UPDATE companies SET next_invoice_seq=next_invoice_seq+1 WHERE id=$1 RETURNING invoice_prefix,next_invoice_seq-1 AS seq`,[co]);
      const no = `${co2.invoice_prefix}-${yr}-${String(co2.seq).padStart(4,'0')}`;
      const sub = parseFloat(lines.reduce((s,l)=>s+l.qty*l.p-(l.disc||0),0).toFixed(3));
      const disc = parseFloat(lines.reduce((s,l)=>s+(l.disc||0),0).toFixed(3));
      const vat = parseFloat((sub*0.10).toFixed(3));
      const grand = parseFloat((sub+vat+shipping).toFixed(3));
      const paid = amtPaid !== null ? amtPaid : (status==='paid'?grand:status==='partial'?parseFloat((grand*0.4).toFixed(3)):0);
      const id = uuid();
      await client.query(
        `INSERT INTO invoices (id,company_id,invoice_no,type,customer_id,invoice_date,due_date,po_reference,subtotal,total_discount,total_vat,shipping,grand_total,amount_paid,payment_status,created_by)
         VALUES ($1,$2,$3,'tax_invoice',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
        [id,co,no,custIds[custName],dDate,dueDate,poRef,sub,disc,vat,shipping,grand,paid,status,uid]
      );
      for (let li=0;li<lines.length;li++) {
        const l=lines[li];
        await client.query(
          `INSERT INTO invoice_items (id,invoice_id,product_id,line_no,part_no,description,qty,unit,unit_price,discount,vat_rate) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,10)`,
          [uuid(),id,prodIds[l.sku].id,li+1,l.sku,prodIds[l.sku].name,l.qty,prodIds[l.sku].unit,l.p,l.disc||0]
        );
        await client.query(
          `INSERT INTO stock_movements (id,company_id,product_id,movement_type,qty,ref_type,ref_id,notes) VALUES ($1,$2,$3,'invoice_out',$4,'invoice',$5,'Invoice issued')`,
          [uuid(),co,prodIds[l.sku].id,l.qty,id]
        );
      }
      if (paid>0) {
        await client.query(
          `INSERT INTO payments (id,company_id,reference_type,reference_id,amount,method,payment_date,notes) VALUES ($1,$2,'invoice',$3,$4,'bank_transfer',$5,'Payment received')`,
          [uuid(),co,id,paid,dDate]
        );
      }
      return { id, no };
    };

    // 8 tax invoices covering various statuses, customers, and amounts
    await INV('Gulf Contracting W.L.L',
      [{sku:'CAB-001',qty:500,p:0.420},{sku:'MCB-001',qty:50,p:1.900},{sku:'SCK-001',qty:80,p:0.700}],
      daysAgo(60), daysAgo(30), 'paid', 'PO-2026-0041');

    await INV('Bahrain National Electrics Co.',
      [{sku:'LTG-001',qty:120,p:2.800},{sku:'LTG-002',qty:40,p:6.800},{sku:'CON-001',qty:100,p:0.550}],
      daysAgo(50), daysAgo(20), 'paid', 'PO-2026-0055');

    await INV('Al Fateh Engineering',
      [{sku:'MCB-002',qty:60,p:4.200},{sku:'PNL-001',qty:8,p:34.00}],
      daysAgo(45), daysAgo(15), 'overdue', 'PO-2026-0062');

    // Invoice converted from QT-0003
    const inv4 = await INV('Al Fateh Engineering',
      [{sku:'MCB-002',qty:40,p:4.200},{sku:'PNL-001',qty:5,p:34.00},{sku:'MCB-003',qty:6,p:28.00}],
      daysAgo(25), daysAhead(5), 'unpaid', 'PO-2026-0071');
    await client.query(
      `INSERT INTO document_conversions (id,company_id,from_type,from_id,from_no,to_type,to_id,to_no,converted_by) VALUES ($1,$2,'invoice',$3,$4,'invoice',$5,$6,$7)`,
      [uuid(),co,qt3.id,qt3.no,inv4.id,inv4.no,uid]
    );

    await INV('Riyadh Trading Est.',
      [{sku:'TRF-001',qty:1,p:420.0,disc:20},{sku:'MCB-003',qty:8,p:28.00}],
      daysAgo(35), daysAgo(5), 'partial', 'PO-2026-0058', 15);

    await INV('Ahmed Khalid Al Dosari',
      [{sku:'SCK-001',qty:30,p:0.700},{sku:'SCK-002',qty:20,p:1.900},{sku:'LTG-001',qty:20,p:2.800}],
      daysAgo(15), daysAhead(15), 'unpaid', '');

    await INV('Bahrain National Electrics Co.',
      [{sku:'CAB-001',qty:800,p:0.400},{sku:'CAB-002',qty:300,p:0.680},{sku:'CON-001',qty:100,p:0.550}],
      daysAgo(10), daysAhead(20), 'unpaid', 'PO-2026-0079');

    await INV('Al Noor Building Contracting',
      [{sku:'LTG-001',qty:150,p:2.800},{sku:'LTG-002',qty:60,p:6.800},{sku:'CON-001',qty:200,p:0.550},{sku:'CON-002',qty:150,p:0.800}],
      daysAgo(5), daysAhead(25), 'unpaid', 'PO-2026-0088');

    // ── 12. Expenses ──────────────────────────────────────────
    const expRows = [
      { cat:'Rent',             desc:'Warehouse rent — Jan/Feb/Mar',      date:daysAgo(90), net:1050.000 },
      { cat:'Transport & Fuel', desc:'Delivery vehicle fuel — Q1',        date:daysAgo(65), net:145.000  },
      { cat:'Utilities',        desc:'Electricity bill — warehouse Q1',   date:daysAgo(60), net:132.000  },
      { cat:'Office Supplies',  desc:'Stationery and printer cartridges', date:daysAgo(45), net:38.500   },
      { cat:'Maintenance',      desc:'Forklift service and oil change',   date:daysAgo(35), net:85.000   },
      { cat:'Transport & Fuel', desc:'Delivery vehicle fuel — Q2',        date:daysAgo(20), net:152.000  },
      { cat:'Utilities',        desc:'Electricity bill — warehouse Q2',   date:daysAgo(15), net:118.000  },
      { cat:'Marketing',        desc:'Trade exhibition participation fee', date:daysAgo(10), net:350.000  },
      { cat:'Rent',             desc:'Warehouse rent — Apr/May/Jun',      date:daysAgo(5),  net:1050.000 },
      { cat:'Office Supplies',  desc:'Toner cartridges and paper',        date:daysAgo(3),  net:42.000   },
    ];
    for (let i=0;i<expRows.length;i++) {
      const e=expRows[i];
      const vat=parseFloat((e.net*0.10).toFixed(3));
      await client.query(
        `INSERT INTO expenses (id,company_id,expense_no,category_id,expense_date,description,net_amount,vat_amount,total_amount,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uuid(),co,`EXP-${yr}-${String(i+1).padStart(4,'0')}`,expCatIds[e.cat],e.date,e.desc,e.net.toFixed(3),vat.toFixed(3),(e.net+vat).toFixed(3),uid]
      );
    }

    // ── 13. Cheques ───────────────────────────────────────────
    const chqRows = [
      { dir:'issued',   no:'CHQ-001234', bank:'BBK',         party:'Schneider Electric Gulf',         amt:3245.800, date:daysAhead(20), status:'pending' },
      { dir:'issued',   no:'CHQ-001235', bank:'BBK',         party:'Pacific Cable Manufacturers LLC', amt:2156.400, date:daysAhead(35), status:'pending' },
      { dir:'issued',   no:'CHQ-001233', bank:'BBK',         party:'Prysmian Group MENA',             amt:1890.000, date:daysAgo(5),    status:'cleared' },
      { dir:'received', no:'CHQ-009981', bank:'BISB',        party:'Gulf Contracting W.L.L',          amt:1162.500, date:daysAhead(8),  status:'pending' },
      { dir:'received', no:'CHQ-007654', bank:'Ahli United', party:'Al Fateh Engineering',            amt:853.710,  date:daysAgo(10),   status:'cleared' },
      { dir:'received', no:'CHQ-009982', bank:'NBB',         party:'Bahrain National Electrics Co.',  amt:2965.680, date:daysAhead(15), status:'pending' },
    ];
    for (const c of chqRows) {
      await client.query(
        `INSERT INTO cheques (id,company_id,cheque_no,bank_name,direction,party_name,amount,cheque_date,issue_date,status,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE,$9,$10)`,
        [uuid(),co,c.no,c.bank,c.dir,c.party,c.amt,c.date,c.status,uid]
      );
    }

    // ── 14. Tasks ─────────────────────────────────────────────
    const taskRows = [
      { title:'Follow up on overdue invoice — Al Fateh Engineering', priority:'high',   status:'open',        due: daysAhead(2)  },
      { title:'Prepare quotation for Isa Town Housing Project',       priority:'medium', status:'in_progress', due: daysAhead(5)  },
      { title:'Stock count — cables and conduits section',            priority:'medium', status:'open',        due: daysAhead(7)  },
      { title:'Submit Q1 VAT return to NBR',                          priority:'high',   status:'in_progress', due: daysAhead(10) },
      { title:'Renew trade licence — expires next month',             priority:'high',   status:'open',        due: daysAhead(18) },
      { title:'Arrange forklift annual inspection',                   priority:'low',    status:'open',        due: daysAhead(25) },
      { title:'Review and update product price list for Q2',          priority:'medium', status:'completed',   due: daysAgo(5)    },
    ];
    for (let i=0;i<taskRows.length;i++) {
      const t = taskRows[i];
      await client.query(
        `INSERT INTO tasks (id,company_id,task_no,title,priority,status,due_date,assigned_to,created_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [uuid(),co,`TASK-${yr}-${String(i+1).padStart(4,'0')}`,t.title,t.priority,t.status,t.due,uid,uid]
      );
    }

    // ── 15. Payroll — two runs ────────────────────────────────
    const calcPayslip = (e) => {
      const basic = e.basic, gross = e.basic+e.housing+e.transport;
      const gosiEmpR = e.gosi?(e.bahraini?0.07:(e.ecg?0:0.01)):0;
      const gosiErR  = e.gosi?(e.bahraini?0.12:0.03):0;
      const gosiEmp  = parseFloat((basic*gosiEmpR).toFixed(3));
      const gosiEr   = parseFloat((basic*gosiErR).toFixed(3));
      const diffYrs  = (today-new Date(e.join))/(1000*60*60*24*365.25);
      const eosbRate = (!e.bahraini&&e.gosi)?(diffYrs>3?8.4:4.2):0;
      return { basic, gross, gosiEmp, gosiEr, totalDed:gosiEmp, netPay:parseFloat((gross-gosiEmp).toFixed(3)), eosbRate, eosbAmt:parseFloat((basic*eosbRate/100).toFixed(3)) };
    };

    // Last month — paid
    const lm = today.getMonth()===0?12:today.getMonth();
    const ly = today.getMonth()===0?today.getFullYear()-1:today.getFullYear();
    const run1 = uuid();
    await client.query(`INSERT INTO payroll_runs (id,company_id,run_month,run_year,status,created_by) VALUES ($1,$2,$3,$4,'paid',$5)`,[run1,co,lm,ly,uid]);
    for (const e of empData) {
      const p=calcPayslip(e);
      await client.query(
        `INSERT INTO payslips (id,run_id,company_id,employee_id,basic_salary,housing_allow,transport_allow,other_allow,overtime_pay,bonus,gross_pay,gosi_employee,gosi_employer,absence_deduct,loan_deduct,other_deduct,total_deductions,net_pay,eosb_rate,eosb_contribution)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,0,0,$8,$9,$10,0,0,0,$11,$12,$13,$14)`,
        [uuid(),run1,co,empIds[e.no],p.basic,e.housing,e.transport,p.gross,p.gosiEmp,p.gosiEr,p.totalDed,p.netPay,p.eosbRate,p.eosbAmt]
      );
    }

    // Current month — approved (not yet paid)
    const cm = today.getMonth()+1;
    const cy = today.getFullYear();
    const run2 = uuid();
    await client.query(`INSERT INTO payroll_runs (id,company_id,run_month,run_year,status,created_by) VALUES ($1,$2,$3,$4,'approved',$5)`,[run2,co,cm,cy,uid]);
    for (const e of empData) {
      const p=calcPayslip(e);
      // Add overtime for one employee
      const ot = e.no==='EMP-004' ? parseFloat((p.basic/26*8).toFixed(3)) : 0;
      const gross2 = parseFloat((p.gross+ot).toFixed(3));
      const net2 = parseFloat((gross2-p.totalDed).toFixed(3));
      await client.query(
        `INSERT INTO payslips (id,run_id,company_id,employee_id,basic_salary,housing_allow,transport_allow,other_allow,overtime_pay,bonus,gross_pay,gosi_employee,gosi_employer,absence_deduct,loan_deduct,other_deduct,total_deductions,net_pay,eosb_rate,eosb_contribution)
         VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,0,$9,$10,$11,0,0,0,$12,$13,$14,$15)`,
        [uuid(),run2,co,empIds[e.no],p.basic,e.housing,e.transport,ot,gross2,p.gosiEmp,p.gosiEr,p.totalDed,net2,p.eosbRate,p.eosbAmt]
      );
    }

    // Stamp converted quotations
    await client.query(`UPDATE invoices SET converted_at=now(), converted_by_user=$1 WHERE id IN ($2,$3)`, [uid, qt2.id, qt3.id]);

    // ── 16. Credit Note ───────────────────────────────────────
    // Credit note against the overdue Al Fateh invoice (inv3 — partial credit)
    const { rows:[invAF] } = await client.query(
      `SELECT id, invoice_no FROM invoices WHERE company_id=$1 AND type='tax_invoice' AND customer_id=$2 AND payment_status='overdue' LIMIT 1`,
      [co, custIds['Al Fateh Engineering']]);
    if (invAF) {
      const { rows:[coCN] } = await client.query(
        `UPDATE companies SET next_invoice_seq=next_invoice_seq+1 WHERE id=$1 RETURNING invoice_prefix,next_invoice_seq-1 AS seq`,[co]);
      const cnNo = `${coCN.invoice_prefix}-${yr}-${String(coCN.seq).padStart(4,'0')}`;
      const cnId = uuid();
      await client.query(
        `INSERT INTO invoices (id,company_id,invoice_no,type,customer_id,invoice_date,po_reference,subtotal,total_vat,grand_total,payment_status,created_by)
         VALUES ($1,$2,$3,'credit_note',$4,$5,$6,-63.000,-6.300,-69.300,'paid',$7)`,
        [cnId,co,cnNo,custIds['Al Fateh Engineering'],daysAgo(10),invAF.invoice_no,uid]
      );
      await client.query(
        `INSERT INTO invoice_items (id,invoice_id,product_id,line_no,part_no,description,qty,unit,unit_price,discount,vat_rate) VALUES ($1,$2,$3,1,'MCB-002','Schneider 32A DP MCB C-Curve (returned)',-15,'pcs',4.200,0,10)`,
        [uuid(),cnId,prodIds['MCB-002'].id]
      );
      await client.query(
        `INSERT INTO document_conversions (id,company_id,from_type,from_id,from_no,to_type,to_id,to_no,converted_by) VALUES ($1,$2,'invoice',$3,$4,'invoice',$5,$6,$7)`,
        [uuid(),co,invAF.id,invAF.invoice_no,cnId,cnNo,uid]
      );
    }

    // ── 17. Cancelled DN ──────────────────────────────────────
    const { rows:[coDN3] } = await client.query(
      `UPDATE companies SET next_dn_seq=next_dn_seq+1 WHERE id=$1 RETURNING dn_prefix,next_dn_seq-1 AS seq`,[co]);
    const dn3no = `${coDN3.dn_prefix}-${yr}-${String(coDN3.seq).padStart(4,'0')}`;
    const dn3id = uuid();
    await client.query(
      `INSERT INTO delivery_notes (id,company_id,dn_no,customer_id,dn_date,project_ref,status,created_by)
       VALUES ($1,$2,$3,$4,$5,'Test delivery — cancelled',$6,$7)`,
      [dn3id,co,dn3no,custIds['Mohammed Hassan Electricals'],daysAgo(18),'cancelled',uid]
    );
    await client.query(
      `INSERT INTO delivery_note_items (id,dn_id,product_id,line_no,part_no,description,qty_ordered,qty_delivered,unit,unit_price)
       VALUES ($1,$2,$3,1,'ACC-002','Junction Box 100x100mm IP55',5,0,'pcs',1.250)`,
      [uuid(),dn3id,prodIds['ACC-002'].id]
    );

    // ── 18. Purchase Orders ───────────────────────────────────
    const PO = async (supName, lines, poDate, expectedDate, status, notes='') => {
      const { rows:[coPO] } = await client.query(
        `UPDATE companies SET next_po_order_seq=next_po_order_seq+1 WHERE id=$1 RETURNING po_order_prefix,next_po_order_seq-1 AS seq`,[co]);
      const no = `${coPO.po_order_prefix}-${yr}-${String(coPO.seq).padStart(4,'0')}`;
      const sub   = parseFloat(lines.reduce((s,l)=>s+l.qty*l.cost,0).toFixed(3));
      const vat   = parseFloat((sub*0.10).toFixed(3));
      const grand = parseFloat((sub+vat).toFixed(3));
      const id = uuid();
      await client.query(
        `INSERT INTO purchase_orders (id,company_id,po_no,supplier_id,po_date,expected_date,status,subtotal,total_vat,grand_total,notes,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [id,co,no,custIds[supName],poDate,expectedDate,status,sub,vat,grand,notes||null,uid]
      );
      for (let li=0;li<lines.length;li++) {
        const l=lines[li];
        await client.query(
          `INSERT INTO purchase_order_items (id,po_id,product_id,line_no,part_no,description,qty,unit,unit_price,vat_rate)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,10)`,
          [uuid(),id,prodIds[l.sku].id,li+1,l.sku,prodIds[l.sku].name,l.qty,prodIds[l.sku].unit,l.cost]
        );
      }
      return { id, no };
    };

    // PO-0001: Draft — just created, not yet sent to supplier
    await PO('Pacific Cable Manufacturers LLC',
      [{sku:'CAB-001',qty:3000,cost:0.260},{sku:'CAB-004',qty:2000,cost:0.360}],
      daysAgo(1), daysAhead(21), 'draft');

    // PO-0002: Sent — awaiting delivery confirmation
    await PO('Schneider Electric Gulf',
      [{sku:'MCB-001',qty:400,cost:1.150},{sku:'MCB-002',qty:200,cost:2.700},{sku:'PNL-001',qty:20,cost:21.50}],
      daysAgo(12), daysAhead(8), 'sent');

    // PO-0003: Partially received
    await PO('Prysmian Group MENA',
      [{sku:'LTG-001',qty:300,cost:1.750},{sku:'LTG-002',qty:100,cost:4.400},{sku:'LTG-003',qty:40,cost:8.200}],
      daysAgo(25), daysAhead(5), 'partially_received', 'First batch of 200 pcs received — remainder expected shortly');

    // PO-0004: Received and converted to Purchase Invoice
    const po4 = await PO('Pacific Cable Manufacturers LLC',
      [{sku:'CON-001',qty:600,cost:0.330},{sku:'CON-002',qty:400,cost:0.500},{sku:'ACC-001',qty:300,cost:0.580}],
      daysAgo(40), daysAgo(18), 'received');
    // Convert PO-0004 to a purchase invoice
    const po4sub = parseFloat((600*0.330+400*0.500+300*0.580).toFixed(3));
    const po4vat = parseFloat((po4sub*0.10).toFixed(3));
    const po4grand = parseFloat((po4sub+po4vat).toFixed(3));
    const { rows:[coPUR] } = await client.query(
      `UPDATE companies SET next_pur_seq=next_pur_seq+1 WHERE id=$1 RETURNING po_prefix,next_pur_seq-1 AS seq`,[co]);
    const pur6no = `${coPUR.po_prefix}-${yr}-${String(coPUR.seq).padStart(4,'0')}`;
    const pur6id = uuid();
    await client.query(
      `INSERT INTO purchases (id,company_id,purchase_no,supplier_id,purchase_date,subtotal,total_vat,grand_total,amount_paid,payment_status,created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,'unpaid',$9)`,
      [pur6id,co,pur6no,custIds['Pacific Cable Manufacturers LLC'],daysAgo(18),po4sub,po4vat,po4grand,uid]
    );
    const po4items = [{sku:'CON-001',qty:600,cost:0.330},{sku:'CON-002',qty:400,cost:0.500},{sku:'ACC-001',qty:300,cost:0.580}];
    for (let li=0;li<po4items.length;li++) {
      const l=po4items[li];
      await client.query(`INSERT INTO purchase_items (id,purchase_id,product_id,line_no,description,qty,unit_price) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [uuid(),pur6id,prodIds[l.sku].id,li+1,prodIds[l.sku].name,l.qty,l.cost]);
    }
    await client.query(
      `UPDATE purchase_orders SET converted_to_purchase_id=$1, status='received' WHERE id=$2`,
      [pur6id, po4.id]
    );

    // ── 19. CRM Opportunities ─────────────────────────────────
    // opp_stage enum: lead, contacted, quoted, negotiation, won, lost
    const oppData = [
      { cust:'Gulf Contracting W.L.L',        title:'Seef Tower Phase 3 — Full Electrical Supply', stage:'quoted',      val:18500, prob:65, exp:daysAhead(30), desc:'Client requested itemised quote for Phase 3. Follow up after Phase 2 delivery.' },
      { cust:'Al Noor Building Contracting',   title:'Isa Town Villas — Wiring & Fitout',          stage:'contacted',   val:7200,  prob:40, exp:daysAhead(45), desc:'Site visit scheduled. Competing with two other suppliers.' },
      { cust:'Bahrain National Electrics Co.', title:'Annual Supply Contract 2026',                 stage:'negotiation', val:45000, prob:80, exp:daysAhead(15), desc:'Renewal of existing contract. Price negotiation ongoing.' },
      { cust:'Al Fateh Engineering',           title:'Industrial Park — Switchgear Package',        stage:'won',         val:12300, prob:100,exp:daysAgo(5),   desc:'Contract signed. PO received. First delivery scheduled.' },
      { cust:'Riyadh Trading Est.',            title:'Cross-border cable supply agreement',         stage:'lead',        val:28000, prob:20, exp:daysAhead(60), desc:'Initial contact made at Gulf Trade Show. Awaiting formal RFQ.' },
      { cust:'Ahmed Khalid Al Dosari',         title:'Villa renovation — lighting & sockets',       stage:'lost',        val:1850,  prob:0,  exp:daysAgo(20),   desc:'Lost to competitor on price. Client went with cheaper brand.' },
    ];
    for (let i=0;i<oppData.length;i++) {
      const o=oppData[i];
      await client.query(
        `INSERT INTO crm_opportunities (id,company_id,customer_id,title,stage,value,probability,expected_close,description,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [uuid(),co,custIds[o.cust],o.title,o.stage,o.val,o.prob,o.exp,o.desc,uid]
      );
    }

    await client.query('COMMIT');
    res.json({ message: `Demo data loaded — ${yr} dataset ready for full cycle testing`, data: {
      categories: cats.length + expCats.length,
      customers: custData.filter(c => c.type !== 'supplier').length,
      suppliers: custData.filter(c => c.type === 'supplier').length,
      products: prodData.length,
      employees: empData.length,
      quotations: 4, proformas: 2,
      delivery_notes: 3,
      invoices: 9,
      credit_notes: 1,
      purchase_orders: 4,
      purchases: purRows.length + 1,
      shipments: 1,
      expenses: expRows.length,
      cheques: chqRows.length,
      tasks: taskRows.length,
      payroll_runs: 2,
      crm_opportunities: oppData.length,
    }});
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally { client.release(); }
});

module.exports = router;
