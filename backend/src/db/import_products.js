// Product Import Script — reads products_import.csv from same directory
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

function mapUnit(raw) {
  const u = (raw || '').toLowerCase().trim();
  if (['mtr','mtrs','mtr.','m'].includes(u))      return 'mtr';
  if (['roll','reel'].includes(u))                 return 'reel';
  if (['pkt','pkts','pack'].includes(u))           return 'pack';
  if (['kg','kgs'].includes(u))                    return 'kg';
  if (['set','sets'].includes(u))                  return 'set';
  if (['ltr','litre','gal','gln','drm','can'].includes(u)) return 'ltr';
  if (['box'].includes(u))                         return 'box';
  return 'pcs'; // default: each / roll / nos / pcs / strip / lot / dzn etc.
}

function num(v, def = 0) {
  const n = parseFloat(v);
  return isNaN(n) ? def : n;
}

async function run() {
  const client = await pool.connect();
  try {
    // Get company
    const { rows: [co] } = await client.query('SELECT id FROM companies LIMIT 1');
    if (!co) throw new Error('No company found');
    const cid = co.id;

    // Read CSV
    const csvPath = path.join(__dirname, 'products_import.csv');
    let raw = fs.readFileSync(csvPath, 'utf8');
    // Strip BOM variants
    raw = raw.replace(/^\uFEFF/, '').replace(/^ï»¿/, '');

    const lines = raw.split(/\r?\n/);
    // skip header
    const rows = lines.slice(1).map(l => {
      const p = l.split(';');
      return {
        code:     (p[0]  || '').trim(),
        name:     (p[1]  || '').trim(),
        desc:     (p[2]  || '').trim(),
        category: (p[3]  || '').trim(),
        unit:     (p[4]  || '').trim(),
        price1:   num(p[5]),
        price2:   num(p[6]),
        price3:   num(p[7]),
        price4:   num(p[8]),
        taxRate:  num(p[9], 10),
        stock:    num(p[10]),
        cost:     num(p[11]),
      };
    }).filter(r => r.code && r.name);

    console.log(`Parsed ${rows.length} product rows`);

    // Build / fetch category map
    const catMap = {};
    const uniqueCats = [...new Set(rows.map(r => r.category).filter(Boolean))];
    for (const catName of uniqueCats) {
      const { rows: ex } = await client.query(
        `SELECT id FROM categories WHERE company_id=$1 AND name=$2 AND type='product'`,
        [cid, catName]
      );
      if (ex.length) {
        catMap[catName] = ex[0].id;
      } else {
        const { rows: [ins] } = await client.query(
          `INSERT INTO categories (id, company_id, name, type, sort_order)
           VALUES (gen_random_uuid(),$1,$2,'product',99) RETURNING id`,
          [cid, catName]
        );
        catMap[catName] = ins.id;
        console.log(`  Created category: ${catName}`);
      }
    }

    let imported = 0, updated = 0, skipped = 0, errors = 0;

    for (const row of rows) {
      try {
        const unit  = mapUnit(row.unit);
        const catId = catMap[row.category] || null;

        const { rows: ex } = await client.query(
          `SELECT id FROM products WHERE company_id=$1 AND sku=$2`,
          [cid, row.code]
        );

        if (ex.length) {
          // Update existing
          await client.query(
            `UPDATE products SET
               name=$3, description=$4, category_id=$5, unit=$6,
               cost_price=$7, price_1=$8, price_2=$9, price_3=$10, price_4=$11,
               vat_rate=$12, updated_at=now()
             WHERE company_id=$1 AND sku=$2`,
            [cid, row.code, row.name, row.desc||null, catId, unit,
             row.cost, row.price1, row.price2, row.price3, row.price4, row.taxRate]
          );
          updated++;
        } else {
          // Insert new
          const { rows: [prod] } = await client.query(
            `INSERT INTO products
               (id,company_id,sku,name,description,category_id,unit,
                cost_price,price_1,price_2,price_3,price_4,vat_rate)
             VALUES
               (gen_random_uuid(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
             RETURNING id`,
            [cid, row.code, row.name, row.desc||null, catId, unit,
             row.cost, row.price1, row.price2, row.price3, row.price4, row.taxRate]
          );

          // Opening stock (only if positive)
          if (row.stock > 0) {
            await client.query(
              `INSERT INTO stock_movements
                 (id,company_id,product_id,movement_type,qty,ref_type,notes)
               VALUES
                 (gen_random_uuid(),$1,$2,'opening',$3,'manual','Opening stock — CSV import')`,
              [cid, prod.id, row.stock]
            );
          }
          imported++;
        }
      } catch (err) {
        console.error(`  ERR [${row.code}]: ${err.message}`);
        errors++;
      }
    }

    console.log('\n========================================');
    console.log(`  Imported (new) : ${imported}`);
    console.log(`  Updated (exist): ${updated}`);
    console.log(`  Skipped        : ${skipped}`);
    console.log(`  Errors         : ${errors}`);
    console.log('========================================\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => { console.error(err); process.exit(1); });
