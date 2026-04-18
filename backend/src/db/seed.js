require('dotenv').config()
const { Pool } = require('pg')
const bcrypt   = require('bcryptjs')
const { v4: uuid } = require('uuid')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    console.log('Seeding ElecTrade Pro demo data...')

    // ── Company ──────────────────────────────────────────
    const coId = uuid()
    await client.query(`
      INSERT INTO companies (id,name,name_ar,cr_number,vat_number,address,tel,email,
        default_vat_rate,invoice_prefix,dn_prefix,po_prefix,
        bank_name,bank_acct_name,bank_iban,bank_swift)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'INV','DN','PUR',$10,$11,$12,$13)
      ON CONFLICT DO NOTHING`,
      [coId,
       'Al Manama Electrical Trading Co. W.L.L',
       'شركة المنامة لتجارة الكهربائيات',
       '98765-1', 'BH-VAT-20241234',
       'Shop 12, Salmaniya Industrial Area, P.O. Box 12345, Manama, Kingdom of Bahrain',
       '+973 1711 2233', 'sales@almanama-electrical.com', 10,
       'Bank of Bahrain and Kuwait (BBK)',
       'Al Manama Electrical Trading Co. W.L.L',
       'BH29 BBKU 0000 0112 3456 78', 'BBKUBHBM'])

    // ── Admin user ────────────────────────────────────────
    const adminPw = await bcrypt.hash('Admin@1234', 12)
    await client.query(`
      INSERT INTO users (id,company_id,name,email,password_hash,role)
      VALUES ($1,$2,'Admin User','admin@company.com',$3,'admin')
      ON CONFLICT (email) DO UPDATE SET password_hash=$3, role='admin'`,
      [uuid(), coId, adminPw])

    // ── Sales user ────────────────────────────────────────
    const salesPw = await bcrypt.hash('Sales@1234', 12)
    await client.query(`
      INSERT INTO users (id,company_id,name,email,password_hash,role)
      VALUES ($1,$2,'Sales User','sales@company.com',$3,'sales')
      ON CONFLICT (email) DO UPDATE SET password_hash=$3, role='sales'`,
      [uuid(), coId, salesPw])

    // ── Accounts user ─────────────────────────────────────
    const accountsPw = await bcrypt.hash('Accounts@1234', 12)
    await client.query(`
      INSERT INTO users (id,company_id,name,email,password_hash,role)
      VALUES ($1,$2,'Accounts User','accounts@company.com',$3,'accountant')
      ON CONFLICT (email) DO UPDATE SET password_hash=$3, role='accountant'`,
      [uuid(), coId, accountsPw])

    // ── Product categories ────────────────────────────────
    const cats = [
      'Cables & Wires','Switchgear & MCBs','Lighting & Fixtures',
      'Conduits & Fittings','Sockets & Switches','Distribution Panels',
      'Tools & Equipment','Safety & PPE','Transformers','Accessories & Sundries'
    ]
    const catIds = {}
    for (let i = 0; i < cats.length; i++) {
      const id = uuid()
      catIds[cats[i]] = id
      await client.query(`
        INSERT INTO categories (id,company_id,name,type,sort_order)
        VALUES ($1,$2,$3,'product',$4) ON CONFLICT DO NOTHING`,
        [id, coId, cats[i], i+1])
    }

    // Expense categories
    for (const cat of ['Rent','Salaries','Utilities','Transport','Office Supplies','Maintenance']) {
      await client.query(`
        INSERT INTO categories (id,company_id,name,type)
        VALUES ($1,$2,$3,'expense') ON CONFLICT DO NOTHING`,
        [uuid(), coId, cat])
    }

    // ── Sample products ───────────────────────────────────
    const products = [
      { sku:'CBL-6MM-3C', name:'6mm 3-Core Copper Cable (Nexans)',  cat:'Cables & Wires',       brand:'Nexans',    unit:'mtr',  cost:1.250, p1:1.800, p2:1.600, vr:'450V', stock:2400 },
      { sku:'CBL-2.5MM-3C',name:'2.5mm 3-Core Copper Cable',        cat:'Cables & Wires',       brand:'Nexans',    unit:'mtr',  cost:0.650, p1:0.950, p2:0.850, vr:'450V', stock:3800 },
      { sku:'MCB-32A-SP',  name:'32A Single Pole MCB (Schneider)',   cat:'Switchgear & MCBs',    brand:'Schneider', unit:'pcs',  cost:2.100, p1:3.500, p2:3.000, vr:'240V', stock:180  },
      { sku:'MCB-63A-DP',  name:'63A Double Pole MCB (ABB)',         cat:'Switchgear & MCBs',    brand:'ABB',       unit:'pcs',  cost:4.500, p1:7.500, p2:6.800, vr:'240V', stock:95   },
      { sku:'LED-18W-PNL', name:'18W LED Panel 600x600mm (Philips)', cat:'Lighting & Fixtures',  brand:'Philips',   unit:'pcs',  cost:3.800, p1:6.500, p2:5.800, vr:'220V', stock:120  },
      { sku:'CDT-25MM-GRY',name:'25mm Grey PVC Conduit 3m',          cat:'Conduits & Fittings',  brand:'Atkore',    unit:'pcs',  cost:0.450, p1:0.800, p2:0.700, vr:null,   stock:650  },
      { sku:'SKT-13A-DP',  name:'13A Double Pole Socket (MK)',       cat:'Sockets & Switches',   brand:'MK Electric',unit:'pcs', cost:0.850, p1:1.500, p2:1.300, vr:'240V', stock:320  },
      { sku:'DBX-8WAY',    name:'8-Way Distribution Board 100A',     cat:'Distribution Panels',  brand:'ABB',       unit:'pcs',  cost:18.500,p1:32.000,p2:28.000,vr:'415V', stock:12   },
    ]
    for (const p of products) {
      const pid = uuid()
      await client.query(`
        INSERT INTO products (id,company_id,sku,name,category_id,brand,unit,cost_price,price_1,price_2,
          vat_rate,voltage_rating,stock_qty,stock_min,is_stock_tracked)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,10,$11,$12,10,true) ON CONFLICT DO NOTHING`,
        [pid,coId,p.sku,p.name,catIds[p.cat]||null,p.brand,p.unit,p.cost,p.p1,p.p2,p.vr,p.stock])
    }

    // ── Sample customers ──────────────────────────────────
    const customers = [
      { code:'C001', name:'Gulf Power Systems W.L.L',    type:'wholesale',  cr:'12345-1', vat:'BH-VAT-001234', tel:'+973 1711 0001', email:'orders@gulfpower.com',   limit:5000,  terms:30 },
      { code:'C002', name:'Al Noor Contracting Co.',     type:'contractor', cr:'67890-2', vat:'BH-VAT-005678', tel:'+973 1722 0002', email:'purchasing@alnoor.com',  limit:10000, terms:45 },
      { code:'C003', name:'Ministry of Works',           type:'government', cr:'GOV-0012',vat:'BH-VAT-GOV012', tel:'+973 1733 0003', email:'procurement@mow.gov.bh',limit:50000, terms:60 },
      { code:'C004', name:'Rashid Al Dosari Trading',    type:'retail',     cr:'11111-4', vat:null,             tel:'+973 3600 1111', email:'rashid@aldosari.com',   limit:500,   terms:0  },
      { code:'S001', name:'Nexans Gulf FZE',             type:'supplier',   cr:'SUP-001', vat:'BH-VAT-SUP001', tel:'+971 4 123 4567',email:'sales@nexans-gulf.com', limit:0,     terms:30 },
      { code:'S002', name:'Schneider Electric Bahrain',  type:'supplier',   cr:'SUP-002', vat:'BH-VAT-SUP002', tel:'+973 1755 0002', email:'info@se-bahrain.com',   limit:0,     terms:30 },
    ]
    for (const c of customers) {
      await client.query(`
        INSERT INTO customers (id,company_id,code,name,type,cr_number,vat_number,tel,email,credit_limit,payment_terms_days)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT DO NOTHING`,
        [uuid(),coId,c.code,c.name,c.type,c.cr,c.vat,c.tel,c.email,c.limit,c.terms])
    }

    // ── Bank account ──────────────────────────────────────
    await client.query(`
      INSERT INTO bank_accounts (id,company_id,bank_name,account_name,iban,currency,current_balance)
      VALUES ($1,$2,'Bank of Bahrain and Kuwait (BBK)','Al Manama Electrical Trading Co. W.L.L',
              'BH29 BBKU 0000 0112 3456 78','BHD',4800.000) ON CONFLICT DO NOTHING`,
      [uuid(), coId])

    await client.query('COMMIT')
    console.log('✅ Seed complete!')
    console.log('')
    console.log('Login credentials:')
    console.log('  Admin:    admin@company.com    / Admin@1234')
    console.log('  Sales:    sales@company.com    / Sales@1234')
    console.log('  Accounts: accounts@company.com / Accounts@1234')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Seed failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    pool.end()
  }
}

seed()
