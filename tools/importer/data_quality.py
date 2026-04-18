#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ElecTrade Pro — Data Quality Assessment
Checks products, customers, and suppliers for duplicates, incomplete records,
and inconsistencies. Prints a categorised report with recommended actions.

Usage:
    py data_quality.py
    py data_quality.py --csv                  # also write CSV files to reports/
    py data_quality.py --section products
    py data_quality.py --section customers
    py data_quality.py --section suppliers
    py data_quality.py --fuzzy-threshold 0.88 (default 0.85)
"""

import sys, io, os, re, csv, argparse, datetime
from pathlib import Path
from difflib import SequenceMatcher
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

try:
    import psycopg2, psycopg2.extras
except ImportError:
    print("ERROR: pip install psycopg2-binary"); sys.exit(1)

# ── ANSI colours ──────────────────────────────────────────────────────────────
RED  = '\033[91m'; YEL = '\033[93m'; GRN = '\033[92m'
CYN  = '\033[96m'; BLD = '\033[1m';  RST = '\033[0m'
def red(s):  return f'{RED}{s}{RST}'
def yel(s):  return f'{YEL}{s}{RST}'
def grn(s):  return f'{GRN}{s}{RST}'
def bld(s):  return f'{BLD}{s}{RST}'
def cyn(s):  return f'{CYN}{s}{RST}'

SEVERITY = {'HIGH': red('HIGH'), 'MED': yel('MED '), 'LOW': grn('LOW ')}

# ── DB helpers ────────────────────────────────────────────────────────────────
def connect_db():
    env = Path(__file__).parent.parent.parent / 'backend' / '.env'
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith('DATABASE_URL='):
                os.environ.setdefault('DATABASE_URL', line.split('=',1)[1].strip()); break
    url = os.environ.get('DATABASE_URL')
    if not url: print("ERROR: DATABASE_URL not set"); sys.exit(1)
    conn = psycopg2.connect(url); conn.autocommit = True
    return conn

def q(conn, sql, params=()):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute(sql, params); rows = cur.fetchall(); cur.close()
    return rows

# ── Name normalisation for fuzzy matching ─────────────────────────────────────
_STRIP_SUFFIXES = re.compile(
    r'\b(w\.?l\.?l\.?|co\.?|llc|ltd\.?|l\.?l\.?c\.?|est\.?|establishment|'
    r'trading|contracting|general|group|holding|international|'
    r'industries|industry|services|solutions|enterprises|company|'
    r'bahrain|bahraini|gulf|middle\s+east)\b',
    re.IGNORECASE
)
_WHITESPACE = re.compile(r'\s+')
_PUNCT      = re.compile(r'[^\w\s]')

def normalise(name):
    n = name.upper()
    n = _PUNCT.sub(' ', n)
    n = _STRIP_SUFFIXES.sub(' ', n)
    n = _WHITESPACE.sub(' ', n).strip()
    return n

def similarity(a, b):
    return SequenceMatcher(None, normalise(a), normalise(b)).ratio()

def find_fuzzy_dupes(names_with_ids, threshold=0.85, max_items=1000):
    """Returns list of (id_a, name_a, id_b, name_b, score) pairs above threshold.
    Uses prefix blocking to keep comparisons manageable for large sets."""
    items = list(names_with_ids)  # [(id, name), ...]
    if not items:
        return []

    if len(items) > max_items:
        # Blocking: group by first 3 chars of normalised name, compare within blocks.
        # Catches the vast majority of real duplicates (same first word) in O(n·k) time.
        blocks = defaultdict(list)
        for item in items:
            key = normalise(item[1])[:3]
            blocks[key].append(item)
        found = []; seen = set()
        for block in blocks.values():
            for i in range(len(block)):
                for j in range(i+1, len(block)):
                    key = (block[i][0], block[j][0])
                    if key in seen: continue
                    score = similarity(block[i][1], block[j][1])
                    if score >= threshold:
                        found.append((block[i][0], block[i][1], block[j][0], block[j][1], score))
                        seen.add(key)
        return sorted(found, key=lambda x: -x[4])

    found = []; seen = set()
    for i in range(len(items)):
        for j in range(i+1, len(items)):
            key = (items[i][0], items[j][0])
            if key in seen: continue
            score = similarity(items[i][1], items[j][1])
            if score >= threshold:
                found.append((items[i][0], items[i][1], items[j][0], items[j][1], score))
                seen.add(key)
    return sorted(found, key=lambda x: -x[4])

# ── CSV helpers ───────────────────────────────────────────────────────────────
def write_csv(csv_dir, filename, fieldnames, rows):
    """Write rows (list of dicts or lists) to csv_dir/filename.csv."""
    if csv_dir is None or not rows:
        return
    path = csv_dir / filename
    with open(path, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        w.writeheader()
        for row in rows:
            if isinstance(row, dict):
                w.writerow({k: row.get(k, '') for k in fieldnames})
            else:
                w.writerow(dict(zip(fieldnames, row)))

def write_fuzzy_csv(csv_dir, filename, label_a, label_b, dupes):
    """Write fuzzy-dupe pairs to CSV."""
    if csv_dir is None or not dupes:
        return
    path = csv_dir / filename
    with open(path, 'w', newline='', encoding='utf-8-sig') as f:
        w = csv.writer(f)
        w.writerow(['similarity_pct', label_a, label_b])
        for _, na, _, nb, sc in dupes:
            w.writerow([f'{sc:.0%}', na, nb])

# ── Report helpers ────────────────────────────────────────────────────────────
# Global list for the summary CSV
_summary = []

def section_header(title):
    w = 90
    print(f'\n{bld("═"*w)}')
    print(f'{bld(f"  {title}")}')
    print(f'{bld("═"*w)}')

def finding(severity, title, rows, columns, col_widths, action,
            notes=None, csv_dir=None, csv_file=None):
    count = len(rows)
    _summary.append({'severity': severity, 'check': title, 'count': count, 'action': action})

    if count == 0:
        print(f'  {grn("✓")}  {title:<55}  {grn("0 issues")}')
        return
    sev = SEVERITY.get(severity, severity)
    print(f'\n  {sev}  {bld(title)}  [{yel(str(count))} record(s)]')
    if notes:
        print(f'       {CYN}→ {notes}{RST}')
    print(f'  {RED}↳ Action: {action}{RST}')
    # Table header
    hdr = '  ' + '  '.join(f'{c:<{w}}' for c, w in zip(columns, col_widths))
    sep = '  ' + '  '.join('-'*w for w in col_widths)
    print(f'  {hdr}')
    print(f'  {sep}')
    for row in rows[:50]:
        vals = [str(row[c] or '') if isinstance(row, dict) else str(row[i] or '')
                for i, c in enumerate(columns if isinstance(row, dict) else range(len(columns)))]
        line = '  ' + '  '.join(v[:w].ljust(w) for v, w in zip(vals, col_widths))
        print(line)
    if count > 50:
        print(f'  ... and {count-50} more')
    print()

    if csv_dir and csv_file:
        write_csv(csv_dir, csv_file, columns, rows)

# ══════════════════════════════════════════════════════════════════════════════
#  PRODUCTS
# ══════════════════════════════════════════════════════════════════════════════
def check_products(conn, co, threshold, csv_dir):
    section_header('PRODUCTS  (6,700+ records)')

    # 1. Zero selling price
    rows = q(conn, """
        SELECT sku, name, cost_price::text AS cost, price_1::text AS sell_price,
               COALESCE(stock_qty,0)::text AS stock
        FROM products WHERE company_id=%s AND price_1=0 AND is_active=true
        ORDER BY name
    """, (co,))
    finding('HIGH', 'Zero selling price (price_1 = 0)', rows,
        ['sku','name','cost','sell_price','stock'],
        [12,40,10,10,8],
        'Set correct selling price. Items cannot be invoiced at zero.',
        csv_dir=csv_dir, csv_file='P1_zero_selling_price.csv')

    # 2. Cost price = 0 but sell price > 0
    rows = q(conn, """
        SELECT sku, name, cost_price::text AS cost, price_1::text AS sell_price
        FROM products WHERE company_id=%s AND cost_price=0 AND price_1>0 AND is_active=true
        ORDER BY name
    """, (co,))
    finding('MED', 'Zero cost price (cost_price = 0, sell price set)', rows,
        ['sku','name','cost','sell_price'], [12,45,10,10],
        'Enter actual cost price. Required for accurate P&L and margin reports.',
        csv_dir=csv_dir, csv_file='P2_zero_cost_price.csv')

    # 3. Negative stock
    rows = q(conn, """
        SELECT sku, name, stock_qty::text AS stock, price_1::text AS sell_price
        FROM products WHERE company_id=%s AND stock_qty < 0 AND is_stock_tracked=true
        ORDER BY stock_qty
    """, (co,))
    finding('HIGH', 'Negative stock quantity', rows,
        ['sku','name','stock','sell_price'], [12,45,10,10],
        'Investigate: likely missing purchase records or opening stock not entered.',
        csv_dir=csv_dir, csv_file='P3_negative_stock.csv')

    # 4. Stock below minimum
    rows = q(conn, """
        SELECT sku, name, stock_qty::text AS stock, stock_min::text AS min_stock
        FROM products
        WHERE company_id=%s AND stock_min > 0 AND stock_qty < stock_min AND is_active=true
        ORDER BY (stock_min - stock_qty) DESC
    """, (co,))
    finding('MED', 'Stock below minimum reorder level', rows,
        ['sku','name','stock','min_stock'], [12,45,10,10],
        'Review reorder levels and raise purchase orders.',
        csv_dir=csv_dir, csv_file='P4_below_min_stock.csv')

    # 5. No category
    rows = q(conn, """
        SELECT sku, name, price_1::text AS sell_price
        FROM products WHERE company_id=%s AND category_id IS NULL AND is_active=true
        ORDER BY name
    """, (co,))
    finding('LOW', 'No category assigned', rows,
        ['sku','name','sell_price'], [12,55,10],
        'Assign a category. Required for stock reports and product filtering.',
        csv_dir=csv_dir, csv_file='P5_no_category.csv')

    # 6. Duplicate SKUs
    rows = q(conn, """
        SELECT sku, COUNT(*) AS count, string_agg(name, ' | ' ORDER BY name) AS names
        FROM products WHERE company_id=%s
        GROUP BY sku HAVING COUNT(*) > 1
        ORDER BY count DESC
    """, (co,))
    finding('HIGH', 'Duplicate SKU codes', rows,
        ['sku','count','names'], [15,6,60],
        'Each product must have a unique SKU. Merge duplicates or assign new codes.',
        csv_dir=csv_dir, csv_file='P6_duplicate_skus.csv')

    # 7. Duplicate barcodes
    rows = q(conn, """
        SELECT barcode, COUNT(*) AS count, string_agg(name, ' | ' ORDER BY name) AS names
        FROM products WHERE company_id=%s AND barcode IS NOT NULL AND barcode != ''
        GROUP BY barcode HAVING COUNT(*) > 1
        ORDER BY count DESC
    """, (co,))
    finding('HIGH', 'Duplicate barcodes', rows,
        ['barcode','count','names'], [15,6,60],
        'Barcode must uniquely identify one product. Remove or correct duplicate barcodes.',
        csv_dir=csv_dir, csv_file='P7_duplicate_barcodes.csv')

    # 8. Fuzzy duplicate product names
    print(f'\n  {SEVERITY["MED"]}  {bld("Similar product names (possible duplicates)")}  '
          f'[threshold={threshold:.0%}]')
    all_prods = q(conn, "SELECT id::text, name FROM products WHERE company_id=%s AND is_active=true", (co,))
    dupes     = find_fuzzy_dupes([(r['id'], r['name']) for r in all_prods], threshold)
    _summary.append({'severity': 'MED', 'check': 'Similar product names (possible duplicates)',
                     'count': len(dupes), 'action': 'Review each pair — merge if same product, rename if different.'})
    if not dupes:
        print(f'       {grn("✓")} No similar product names found above {threshold:.0%} similarity.')
    else:
        print(f'       {YEL}{len(dupes)} potentially duplicate pairs found{RST}')
        print(f'  {RED}↳ Action: Review each pair — merge if same product, rename if different.{RST}')
        print(f'  {"Score":<7}  {"Product A":<45}  {"Product B"}')
        print(f'  {"-"*6}  {"-"*44}  {"-"*44}')
        for _, na, _, nb, sc in dupes[:30]:
            print(f'  {sc:.0%}      {na[:44]:<45}  {nb[:44]}')
        if len(dupes) > 30: print(f'  ... and {len(dupes)-30} more')
    write_fuzzy_csv(csv_dir, 'P8_similar_product_names.csv', 'product_a', 'product_b', dupes)
    print()

    # 9. No sales in last 12 months (slow-moving / dead stock)
    rows = q(conn, """
        SELECT p.sku, p.name, p.stock_qty::text AS stock, p.price_1::text AS price,
               COALESCE(p.notes,'') AS notes
        FROM products p
        WHERE p.company_id=%s AND p.is_active=true AND p.is_stock_tracked=true
          AND p.stock_qty > 0
          AND NOT EXISTS (
              SELECT 1 FROM invoice_items ii
              JOIN invoices i ON i.id = ii.invoice_id
              WHERE ii.product_id = p.id
                AND i.invoice_date >= CURRENT_DATE - INTERVAL '12 months'
          )
        ORDER BY p.stock_qty DESC
    """, (co,))
    finding('MED', 'In-stock products with no sales in last 12 months (slow-moving)', rows,
        ['sku','name','stock','price','notes'], [12,45,10,10,30],
        'Review for write-down, return to supplier, or promotion.',
        csv_dir=csv_dir, csv_file='P9_slow_moving_stock.csv')

    # Summary
    total = q(conn, "SELECT COUNT(*) AS n FROM products WHERE company_id=%s", (co,))[0]['n']
    active= q(conn, "SELECT COUNT(*) AS n FROM products WHERE company_id=%s AND is_active=true", (co,))[0]['n']
    print(f'  {bld("Summary:")}  {total:,} total products  |  {active:,} active')


# ══════════════════════════════════════════════════════════════════════════════
#  CUSTOMERS
# ══════════════════════════════════════════════════════════════════════════════
def check_customers(conn, co, threshold, csv_dir):
    section_header('CUSTOMERS  (excluding suppliers)')

    base = "company_id=%s AND type != 'supplier'"

    # 1. Missing both tel and email
    rows = q(conn, f"""
        SELECT code, name, type::text AS type, COALESCE(tel,'') AS tel,
               COALESCE(email,'') AS email
        FROM customers WHERE {base} AND (tel IS NULL OR tel='') AND (email IS NULL OR email='')
        ORDER BY name
    """, (co,))
    finding('MED', 'No telephone AND no email', rows,
        ['code','name','type','tel','email'], [10,40,12,18,25],
        'Add at least one contact method for invoicing, statements, and overdue chasing.',
        csv_dir=csv_dir, csv_file='C1_no_contact.csv')

    # 2. Missing VAT number (for non-retail / non-individual types)
    rows = q(conn, f"""
        SELECT code, name, type::text AS type
        FROM customers
        WHERE {base}
          AND type IN ('wholesale','contractor','government')
          AND (vat_number IS NULL OR vat_number = '')
        ORDER BY type, name
    """, (co,))
    finding('MED', 'B2B customers missing VAT registration number', rows,
        ['code','name','type'], [10,50,15],
        'Obtain VAT number for tax invoice compliance. Required for VAT audit.',
        csv_dir=csv_dir, csv_file='C2_missing_vat.csv')

    # 3. Missing CR number (for business types)
    rows = q(conn, f"""
        SELECT code, name, type::text AS type
        FROM customers
        WHERE {base}
          AND type IN ('wholesale','contractor','government')
          AND (cr_number IS NULL OR cr_number = '')
        ORDER BY type, name
    """, (co,))
    finding('LOW', 'B2B customers missing CR (Commercial Registration) number', rows,
        ['code','name','type'], [10,50,15],
        'CR number helps with deduplication and formal identification.',
        csv_dir=csv_dir, csv_file='C3_missing_cr.csv')

    # 4. Duplicate VAT numbers
    rows = q(conn, """
        SELECT vat_number, COUNT(*) AS count,
               string_agg(name, ' | ' ORDER BY name) AS names
        FROM customers
        WHERE company_id=%s AND vat_number IS NOT NULL AND vat_number != ''
        GROUP BY vat_number HAVING COUNT(*) > 1
        ORDER BY count DESC
    """, (co,))
    finding('HIGH', 'Duplicate VAT numbers (likely same company entered twice)', rows,
        ['vat_number','count','names'], [20,6,55],
        'Same VAT number = same legal entity. Merge the duplicate records.',
        csv_dir=csv_dir, csv_file='C4_duplicate_vat.csv')

    # 5. Duplicate CR numbers
    rows = q(conn, """
        SELECT cr_number, COUNT(*) AS count,
               string_agg(name, ' | ' ORDER BY name) AS names
        FROM customers
        WHERE company_id=%s AND cr_number IS NOT NULL AND cr_number != ''
        GROUP BY cr_number HAVING COUNT(*) > 1
        ORDER BY count DESC
    """, (co,))
    finding('HIGH', 'Duplicate CR numbers (likely same company entered twice)', rows,
        ['cr_number','count','names'], [20,6,55],
        'Same CR = same legal entity. Merge the duplicate records.',
        csv_dir=csv_dir, csv_file='C5_duplicate_cr.csv')

    # 6. No transactions at all
    rows = q(conn, f"""
        SELECT c.code, c.name, c.type::text AS type,
               COALESCE(c.tel,'') AS tel, c.created_at::date::text AS since
        FROM customers c
        WHERE {base}
          AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.customer_id=c.id LIMIT 1)
        ORDER BY c.name
    """, (co,))
    finding('LOW', 'Customers with no invoices (never traded)', rows,
        ['code','name','type','tel','since'], [10,40,12,18,12],
        'Confirm these are real customers. Deactivate if not needed.',
        csv_dir=csv_dir, csv_file='C6_no_invoices.csv')

    # 7. Fuzzy duplicate names
    print(f'\n  {SEVERITY["HIGH"]}  {bld("Similar customer names (possible duplicates)")}  '
          f'[threshold={threshold:.0%}]')
    all_custs = q(conn, f"SELECT id::text, name FROM customers WHERE {base}", (co,))
    dupes     = find_fuzzy_dupes([(r['id'], r['name']) for r in all_custs], threshold)
    _summary.append({'severity': 'HIGH', 'check': 'Similar customer names (possible duplicates)',
                     'count': len(dupes), 'action': 'Verify each pair. If same company: merge, reassign invoices, delete one.'})
    if not dupes:
        print(f'       {grn("✓")} No similar customer names found above {threshold:.0%} similarity.')
    else:
        print(f'       {YEL}{len(dupes)} potentially duplicate pairs{RST}')
        print(f'  {RED}↳ Action: Verify each pair. If same company: merge, reassign invoices, delete one.{RST}')
        print(f'  {"Score":<7}  {"Customer A":<42}  {"Customer B"}')
        print(f'  {"-"*6}  {"-"*41}  {"-"*41}')
        for _, na, _, nb, sc in dupes[:40]:
            print(f'  {sc:.0%}      {na[:41]:<42}  {nb[:41]}')
        if len(dupes) > 40: print(f'  ... and {len(dupes)-40} more')
    write_fuzzy_csv(csv_dir, 'C7_similar_customer_names.csv', 'customer_a', 'customer_b', dupes)
    print()

    # 8. Zero credit limit for B2B with open balance
    rows = q(conn, f"""
        SELECT c.code, c.name, c.type::text AS type,
               COALESCE(SUM(i.balance_due),0)::numeric(15,3) AS open_balance
        FROM customers c
        JOIN invoices i ON i.customer_id=c.id
        WHERE c.company_id=%s AND c.type IN ('wholesale','contractor','government')
          AND c.credit_limit = 0
          AND i.payment_status IN ('unpaid','partial','overdue')
          AND i.write_off_date IS NULL
        GROUP BY c.id, c.code, c.name, c.type
        HAVING SUM(i.balance_due) > 0
        ORDER BY open_balance DESC
    """, (co,))
    finding('MED', 'B2B customers with open AR balance but credit limit = 0', rows,
        ['code','name','type','open_balance'], [10,42,12,12],
        'Set credit limits to manage exposure and trigger alerts.',
        csv_dir=csv_dir, csv_file='C8_no_credit_limit_with_ar.csv')


# ══════════════════════════════════════════════════════════════════════════════
#  SUPPLIERS
# ══════════════════════════════════════════════════════════════════════════════
def check_suppliers(conn, co, threshold, csv_dir):
    section_header('SUPPLIERS')

    base = "company_id=%s AND type = 'supplier'"

    # 1. Missing both tel and email
    rows = q(conn, f"""
        SELECT code, name, COALESCE(tel,'') AS tel, COALESCE(email,'') AS email
        FROM customers WHERE {base}
          AND (tel IS NULL OR tel='') AND (email IS NULL OR email='')
        ORDER BY name
    """, (co,))
    finding('MED', 'No telephone AND no email', rows,
        ['code','name','tel','email'], [10,45,18,25],
        'Add contact info for purchase orders and payment remittances.',
        csv_dir=csv_dir, csv_file='S1_no_contact.csv')

    # 2. Missing VAT number
    rows = q(conn, f"""
        SELECT code, name
        FROM customers WHERE {base} AND (vat_number IS NULL OR vat_number='')
        ORDER BY name
    """, (co,))
    finding('MED', 'Missing VAT registration number', rows,
        ['code','name'], [10,65],
        'Required on purchase invoices for input VAT reclaim.',
        csv_dir=csv_dir, csv_file='S2_missing_vat.csv')

    # 3. No purchase history
    rows = q(conn, f"""
        SELECT c.code, c.name, COALESCE(c.tel,'') AS tel,
               c.created_at::date::text AS since
        FROM customers c
        WHERE {base}
          AND NOT EXISTS (SELECT 1 FROM purchases p WHERE p.supplier_id=c.id LIMIT 1)
        ORDER BY c.name
    """, (co,))
    finding('LOW', 'Suppliers with no purchase records', rows,
        ['code','name','tel','since'], [10,45,18,12],
        'Confirm these are active suppliers. Deactivate or delete if not needed.',
        csv_dir=csv_dir, csv_file='S3_no_purchases.csv')

    # 4. Open AP balance but missing VAT
    rows = q(conn, f"""
        SELECT c.code, c.name,
               COALESCE(SUM(pu.grand_total - pu.amount_paid),0)::numeric(15,3) AS ap_balance
        FROM customers c
        JOIN purchases pu ON pu.supplier_id=c.id
        WHERE c.company_id=%s AND c.type='supplier'
          AND (c.vat_number IS NULL OR c.vat_number='')
          AND pu.payment_status IN ('unpaid','partial')
        GROUP BY c.id, c.code, c.name
        HAVING SUM(pu.grand_total - pu.amount_paid) > 0
        ORDER BY ap_balance DESC
    """, (co,))
    finding('HIGH', 'Suppliers with open AP balance but no VAT number', rows,
        ['code','name','ap_balance'], [10,52,12],
        'High priority — obtain VAT numbers for outstanding AP suppliers before filing.',
        csv_dir=csv_dir, csv_file='S4_ap_no_vat.csv')

    # 5. Duplicate VAT numbers
    rows = q(conn, """
        SELECT vat_number, COUNT(*) AS count,
               string_agg(name, ' | ' ORDER BY name) AS names
        FROM customers
        WHERE company_id=%s AND type='supplier'
          AND vat_number IS NOT NULL AND vat_number != ''
        GROUP BY vat_number HAVING COUNT(*) > 1
        ORDER BY count DESC
    """, (co,))
    finding('HIGH', 'Duplicate VAT numbers (likely same supplier entered twice)', rows,
        ['vat_number','count','names'], [20,6,55],
        'Merge duplicate supplier records and reassign all purchases to the retained record.',
        csv_dir=csv_dir, csv_file='S5_duplicate_vat.csv')

    # 6. Fuzzy duplicate names
    print(f'\n  {SEVERITY["HIGH"]}  {bld("Similar supplier names (possible duplicates)")}  '
          f'[threshold={threshold:.0%}]')
    all_supps = q(conn, "SELECT id::text, name FROM customers WHERE company_id=%s AND type='supplier'", (co,))
    dupes     = find_fuzzy_dupes([(r['id'], r['name']) for r in all_supps], threshold)
    _summary.append({'severity': 'HIGH', 'check': 'Similar supplier names (possible duplicates)',
                     'count': len(dupes), 'action': 'Verify each pair. If same supplier: merge records, reassign purchases.'})
    if not dupes:
        print(f'       {grn("✓")} No similar supplier names found above {threshold:.0%} similarity.')
    else:
        print(f'       {YEL}{len(dupes)} potentially duplicate pairs{RST}')
        print(f'  {RED}↳ Action: Verify each pair. If same supplier: merge records, reassign purchases.{RST}')
        print(f'  {"Score":<7}  {"Supplier A":<42}  {"Supplier B"}')
        print(f'  {"-"*6}  {"-"*41}  {"-"*41}')
        for _, na, _, nb, sc in dupes[:40]:
            print(f'  {sc:.0%}      {na[:41]:<42}  {nb[:41]}')
        if len(dupes) > 40: print(f'  ... and {len(dupes)-40} more')
    write_fuzzy_csv(csv_dir, 'S6_similar_supplier_names.csv', 'supplier_a', 'supplier_b', dupes)
    print()

    # 7. AP concentration (top 10 suppliers)
    rows = q(conn, """
        SELECT c.name,
               SUM(pu.grand_total - pu.amount_paid)::numeric(15,3) AS ap_balance,
               ROUND(100.0 * SUM(pu.grand_total - pu.amount_paid) /
                     NULLIF(SUM(SUM(pu.grand_total - pu.amount_paid)) OVER (), 0), 1) AS pct_of_total
        FROM customers c
        JOIN purchases pu ON pu.supplier_id=c.id
        WHERE c.company_id=%s AND pu.payment_status IN ('unpaid','partial')
        GROUP BY c.id, c.name
        HAVING SUM(pu.grand_total - pu.amount_paid) > 0
        ORDER BY ap_balance DESC LIMIT 10
    """, (co,))
    if rows:
        print(f'  {SEVERITY["LOW"]}  {bld("AP concentration — top suppliers by outstanding balance")}')
        print(f'  {"Supplier":<50} {"AP Balance":>12} {"% of Total":>10}')
        print(f'  {"-"*49} {"-"*12} {"-"*10}')
        for r in rows:
            print(f'  {r["name"][:49]:<50} {float(r["ap_balance"]):>12,.3f} {float(r["pct_of_total"] or 0):>9.1f}%')
        print()
        _summary.append({'severity': 'LOW', 'check': 'AP concentration (top 10 suppliers)',
                         'count': len(rows), 'action': 'Monitor supplier dependency; diversify if top supplier > 30% of AP.'})
        if csv_dir:
            write_csv(csv_dir, 'S7_ap_concentration.csv',
                      ['name','ap_balance','pct_of_total'], rows)


# ══════════════════════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--section',          choices=['products','customers','suppliers','all'],
                    default='all')
    ap.add_argument('--fuzzy-threshold',  type=float, default=0.85,
                    help='Name similarity threshold 0-1 (default 0.85)')
    ap.add_argument('--csv',              action='store_true',
                    help='Write findings to CSV files in tools/importer/reports/<timestamp>/')
    args = ap.parse_args()

    conn = connect_db()
    co   = q(conn, "SELECT id, name FROM companies LIMIT 1")[0]
    co_id, co_name = co['id'], co['name']

    # Prepare CSV output directory
    csv_dir = None
    if args.csv:
        ts      = datetime.datetime.now().strftime('%Y%m%d_%H%M%S')
        csv_dir = Path(__file__).parent / 'reports' / ts
        csv_dir.mkdir(parents=True, exist_ok=True)

    print(f'\n{bld("═"*90)}')
    print(f'{bld("  DATA QUALITY ASSESSMENT — " + co_name)}')
    print(f'{bld("  Fuzzy name matching threshold: ")}{args.fuzzy_threshold:.0%}')
    if csv_dir:
        print(f'{bld("  CSV output directory:         ")}{csv_dir}')
    print(f'{bld("═"*90)}')

    run = args.section
    t   = args.fuzzy_threshold

    if run in ('products',  'all'): check_products( conn, co_id, t, csv_dir)
    if run in ('customers', 'all'): check_customers(conn, co_id, t, csv_dir)
    if run in ('suppliers', 'all'): check_suppliers (conn, co_id, t, csv_dir)

    # Write summary CSV
    if csv_dir and _summary:
        write_csv(csv_dir, '00_summary.csv',
                  ['severity','check','count','action'], _summary)
        print(f'\n{bld("  CSV files written to:")} {csv_dir}')
        print(f'  Files generated:')
        for f in sorted(csv_dir.iterdir()):
            size = f.stat().st_size
            print(f'    {f.name:<45}  {size:>7,} bytes')

    print(f'\n{bld("═"*90)}')
    print(f'{bld("  Severity legend:")}  '
          f'{red("HIGH")} = fix before go-live   '
          f'{yel("MED")}  = fix within 30 days   '
          f'{grn("LOW")}  = fix when possible')
    print(f'{bld("═"*90)}\n')
    conn.close()

if __name__ == '__main__':
    main()
