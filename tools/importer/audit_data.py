#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Data Quality Audit for ElecTrade Pro
Checks for duplicates, missing data, and inconsistencies in imported data.
"""
import sys, io, os

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

import psycopg2
import psycopg2.extras
from pathlib import Path

# ── Load DATABASE_URL ────────────────────────────────────────────────────────
env_path = Path(__file__).parent.parent.parent / 'backend' / '.env'
db_url = None
if env_path.exists():
    for line in env_path.read_text().splitlines():
        if line.startswith('DATABASE_URL='):
            db_url = line.split('=', 1)[1].strip()
            break
if not db_url:
    db_url = os.environ.get('DATABASE_URL')
if not db_url:
    print("ERROR: DATABASE_URL not found. Set it in backend/.env or environment.")
    sys.exit(1)

conn = psycopg2.connect(db_url)
conn.autocommit = True
cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

# Get company_id
cur.execute("SELECT id, name FROM companies LIMIT 1")
company = cur.fetchone()
if not company:
    print("ERROR: No company found in database.")
    sys.exit(1)
COMPANY_ID = company['id']
print(f"Auditing company: {company['name']} ({COMPANY_ID})")
print("=" * 70)

issues = []

def section(title):
    print(f"\n{'─' * 70}")
    print(f"  {title}")
    print(f"{'─' * 70}")

def run(label, sql, params=None):
    cur.execute(sql, params or (COMPANY_ID,))
    rows = cur.fetchall()
    count = len(rows)
    return rows, count

# ════════════════════════════════════════════════════════════════════════════
# 1. DUPLICATE CUSTOMERS (exact name)
# ════════════════════════════════════════════════════════════════════════════
section("1. DUPLICATE CUSTOMERS — exact name match")
rows, n = run("dup_customers_exact", """
    SELECT LOWER(name) AS norm_name, COUNT(*) AS cnt,
           STRING_AGG(id::text, ', ') AS ids,
           STRING_AGG(COALESCE(code,'?'), ', ') AS codes
    FROM customers
    WHERE company_id = %s
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, norm_name
""")
if n == 0:
    print("  OK — no exact-name duplicates")
else:
    print(f"  FOUND {n} duplicate name groups:")
    for r in rows:
        print(f"    [{r['cnt']}x] {r['norm_name']}  |  ids: {r['ids']}  |  codes: {r['codes']}")
    issues.append(f"Duplicate customers (exact name): {n} groups")

# ════════════════════════════════════════════════════════════════════════════
# 2. DUPLICATE CUSTOMERS (near-match — strip punctuation/spaces)
# ════════════════════════════════════════════════════════════════════════════
section("2. DUPLICATE CUSTOMERS — near-match (strip punctuation & spaces)")
rows, n = run("dup_customers_near", """
    SELECT REGEXP_REPLACE(LOWER(name), '[^a-z0-9]', '', 'g') AS slug,
           COUNT(*) AS cnt,
           STRING_AGG(name, ' | ') AS names,
           STRING_AGG(id::text, ', ') AS ids
    FROM customers
    WHERE company_id = %s
    GROUP BY REGEXP_REPLACE(LOWER(name), '[^a-z0-9]', '', 'g')
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, slug
""")
if n == 0:
    print("  OK — no near-match duplicates")
else:
    print(f"  FOUND {n} near-duplicate groups:")
    for r in rows[:30]:
        print(f"    [{r['cnt']}x] {r['names']}  |  ids: {r['ids']}")
    if n > 30:
        print(f"    ... and {n-30} more groups")
    issues.append(f"Near-duplicate customers: {n} groups")

# ════════════════════════════════════════════════════════════════════════════
# 3. DUPLICATE CUSTOMERS — same VAT number
# ════════════════════════════════════════════════════════════════════════════
section("3. DUPLICATE CUSTOMERS — same VAT number")
rows, n = run("dup_vat", """
    SELECT vat_number, COUNT(*) AS cnt,
           STRING_AGG(name, ' | ') AS names,
           STRING_AGG(id::text, ', ') AS ids
    FROM customers
    WHERE company_id = %s AND vat_number IS NOT NULL AND vat_number <> ''
    GROUP BY vat_number
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, vat_number
""")
if n == 0:
    print("  OK — no duplicate VAT numbers")
else:
    print(f"  FOUND {n} duplicate VAT groups:")
    for r in rows:
        print(f"    VAT {r['vat_number']}  [{r['cnt']}x]  {r['names']}")
    issues.append(f"Duplicate VAT numbers: {n} groups")

# ════════════════════════════════════════════════════════════════════════════
# 4. CUSTOMERS WITH NO TRANSACTIONS
# ════════════════════════════════════════════════════════════════════════════
section("4. CUSTOMERS WITH NO TRANSACTIONS (no invoices, no purchases)")
rows, n = run("orphan_customers", """
    SELECT c.id, c.code, c.name, c.type
    FROM customers c
    WHERE c.company_id = %s
      AND NOT EXISTS (SELECT 1 FROM invoices i WHERE i.customer_id = c.id)
      AND NOT EXISTS (SELECT 1 FROM purchases p WHERE p.supplier_id = c.id)
    ORDER BY c.name
""")
if n == 0:
    print("  OK — all customers have at least one transaction")
else:
    print(f"  FOUND {n} customers with no transactions:")
    for r in rows[:20]:
        print(f"    [{r['type']}] {r['code']} — {r['name']}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Orphan customers (no transactions): {n}")

# ════════════════════════════════════════════════════════════════════════════
# 5. DUPLICATE PRODUCTS — exact name
# ════════════════════════════════════════════════════════════════════════════
section("5. DUPLICATE PRODUCTS — exact name match")
rows, n = run("dup_products_name", """
    SELECT LOWER(name) AS norm_name, COUNT(*) AS cnt,
           STRING_AGG(sku, ', ') AS skus,
           STRING_AGG(id::text, ', ') AS ids
    FROM products
    WHERE company_id = %s
    GROUP BY LOWER(name)
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, norm_name
""")
if n == 0:
    print("  OK — no exact-name product duplicates")
else:
    print(f"  FOUND {n} duplicate product name groups:")
    for r in rows[:20]:
        print(f"    [{r['cnt']}x] {r['norm_name']}  |  skus: {r['skus']}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Duplicate products (exact name): {n} groups")

# ════════════════════════════════════════════════════════════════════════════
# 6. DUPLICATE PRODUCTS — same SKU
# ════════════════════════════════════════════════════════════════════════════
section("6. DUPLICATE PRODUCTS — same SKU")
rows, n = run("dup_sku", """
    SELECT sku, COUNT(*) AS cnt,
           STRING_AGG(name, ' | ') AS names,
           STRING_AGG(id::text, ', ') AS ids
    FROM products
    WHERE company_id = %s AND sku IS NOT NULL AND sku <> ''
    GROUP BY sku
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, sku
""")
if n == 0:
    print("  OK — no duplicate SKUs")
else:
    print(f"  FOUND {n} duplicate SKU groups:")
    for r in rows[:20]:
        print(f"    SKU {r['sku']}  [{r['cnt']}x]  {r['names']}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Duplicate SKUs: {n} groups")

# ════════════════════════════════════════════════════════════════════════════
# 7. PRODUCTS WITH ZERO OR NULL PRICE
# ════════════════════════════════════════════════════════════════════════════
section("7. PRODUCTS WITH ZERO OR NULL price_1")
rows, n = run("zero_price", """
    SELECT id, sku, name, price_1, cost_price
    FROM products
    WHERE company_id = %s AND (price_1 IS NULL OR price_1 = 0)
    ORDER BY name
""")
if n == 0:
    print("  OK — all products have price_1 > 0")
else:
    print(f"  FOUND {n} products with zero/null price_1:")
    for r in rows[:20]:
        print(f"    {r['sku']}  {r['name']}  cost={r['cost_price']}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Products with zero price: {n}")

# ════════════════════════════════════════════════════════════════════════════
# 8. UNUSED PRODUCTS (never sold, never purchased)
# ════════════════════════════════════════════════════════════════════════════
section("8. UNUSED PRODUCTS (never on any invoice item or purchase item)")
rows, n = run("unused_products", """
    SELECT p.id, p.sku, p.name, p.stock_qty
    FROM products p
    WHERE p.company_id = %s
      AND NOT EXISTS (SELECT 1 FROM invoice_items ii WHERE ii.product_id = p.id)
      AND NOT EXISTS (SELECT 1 FROM purchase_items pi WHERE pi.product_id = p.id)
    ORDER BY p.name
""")
if n == 0:
    print("  OK — all products have been used in at least one transaction")
else:
    print(f"  FOUND {n} unused products:")
    for r in rows[:20]:
        print(f"    {r['sku']}  {r['name']}  stock={r['stock_qty']}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Unused products: {n}")

# ════════════════════════════════════════════════════════════════════════════
# 9. DUPLICATE INVOICES (same customer + date + grand_total)
# ════════════════════════════════════════════════════════════════════════════
section("9. DUPLICATE INVOICES — same customer + date + amount")
rows, n = run("dup_invoices", """
    SELECT i.customer_id, c.name AS customer_name,
           i.invoice_date, i.grand_total, COUNT(*) AS cnt,
           STRING_AGG(i.invoice_no, ', ') AS inv_numbers,
           STRING_AGG(i.id::text, ', ') AS ids
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.company_id = %s
    GROUP BY i.customer_id, c.name, i.invoice_date, i.grand_total
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, i.invoice_date DESC
""")
if n == 0:
    print("  OK — no duplicate invoices")
else:
    print(f"  FOUND {n} duplicate invoice groups:")
    for r in rows[:20]:
        print(f"    [{r['cnt']}x] {r['customer_name']}  {r['invoice_date']}  BD {r['grand_total']}  | {r['inv_numbers']}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Duplicate invoices: {n} groups")

# ════════════════════════════════════════════════════════════════════════════
# 10. INVOICES WITH ZERO GRAND TOTAL
# ════════════════════════════════════════════════════════════════════════════
section("10. INVOICES WITH ZERO grand_total")
rows, n = run("zero_invoices", """
    SELECT i.id, i.invoice_no, i.invoice_date,
           c.name AS customer_name, i.payment_status, i.type AS invoice_type
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.company_id = %s AND (i.grand_total IS NULL OR i.grand_total = 0)
    ORDER BY i.invoice_date DESC

""")
if n == 0:
    print("  OK — no zero-total invoices")
else:
    print(f"  FOUND {n} zero-total invoices:")
    for r in rows[:20]:
        print(f"    {r['invoice_no']}  {r['invoice_date']}  {r['customer_name']}  [{r['invoice_type']}]")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Zero-total invoices: {n}")

# ════════════════════════════════════════════════════════════════════════════
# 11. INVOICE TOTAL MISMATCHES (grand_total != subtotal + total_vat)
# ════════════════════════════════════════════════════════════════════════════
section("11. INVOICE TOTAL MISMATCHES (grand_total != subtotal + total_vat)")
rows, n = run("total_mismatch", """
    SELECT COUNT(*) AS cnt,
           SUM(ABS(grand_total - (subtotal + total_vat))) AS total_diff
    FROM invoices
    WHERE company_id = %s
      AND ABS(grand_total - (subtotal + total_vat)) > 0.005
""")
r = rows[0]
if r['cnt'] == 0:
    print("  OK — all invoice totals match (subtotal + vat = grand_total)")
else:
    print(f"  FOUND {r['cnt']} invoices where grand_total != subtotal + total_vat")
    print(f"  Total discrepancy: BD {r['total_diff']:.3f}")
    issues.append(f"Invoice total mismatches: {r['cnt']}")

# ════════════════════════════════════════════════════════════════════════════
# 12. OVERPAYMENTS (amount_paid > grand_total)
# ════════════════════════════════════════════════════════════════════════════
section("12. OVERPAYMENTS (amount_paid > grand_total)")
rows, n = run("overpayments", """
    SELECT i.invoice_no, i.invoice_date, c.name AS customer_name,
           i.grand_total, i.amount_paid,
           (i.amount_paid - i.grand_total) AS excess
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    WHERE i.company_id = %s
      AND i.amount_paid > (i.grand_total + 0.005)
    ORDER BY excess DESC
""")
if n == 0:
    print("  OK — no overpayments")
else:
    print(f"  FOUND {n} overpaid invoices:")
    for r in rows[:20]:
        print(f"    {r['invoice_no']}  {r['invoice_date']}  {r['customer_name']}  "
              f"total={r['grand_total']:.3f}  paid={r['amount_paid']:.3f}  excess={r['excess']:.3f}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Overpayments: {n}")

# ════════════════════════════════════════════════════════════════════════════
# 13. INVOICE ITEMS WITH NO PRODUCT LINK
# ════════════════════════════════════════════════════════════════════════════
section("13. INVOICE ITEMS WITH NO PRODUCT LINK (free-text lines, no product_id)")
rows, n = run("unlinked_items", """
    SELECT COUNT(*) AS cnt,
           COUNT(DISTINCT ii.invoice_id) AS inv_count
    FROM invoice_items ii
    JOIN invoices inv ON inv.id = ii.invoice_id
    WHERE inv.company_id = %s AND ii.product_id IS NULL
""")
r = rows[0]
if r['cnt'] == 0:
    print("  OK — all invoice items have a product link")
else:
    print(f"  FOUND {r['cnt']} unlinked invoice items across {r['inv_count']} invoices")
    # Show a sample
    cur.execute("""
        SELECT ii.description, COUNT(*) AS cnt
        FROM invoice_items ii
        JOIN invoices inv ON inv.id = ii.invoice_id
        WHERE inv.company_id = %s AND ii.product_id IS NULL
        GROUP BY ii.description
        ORDER BY cnt DESC
        LIMIT 10
    """, (COMPANY_ID,))
    samples = cur.fetchall()
    for s in samples:
        print(f"    [{s['cnt']}x] {s['description']}")
    issues.append(f"Unlinked invoice items: {r['cnt']}")

# ════════════════════════════════════════════════════════════════════════════
# 14. DUPLICATE PURCHASES (same supplier + date + grand_total)
# ════════════════════════════════════════════════════════════════════════════
section("14. DUPLICATE PURCHASES — same supplier + date + amount")
rows, n = run("dup_purchases", """
    SELECT p.supplier_id, c.name AS supplier_name,
           p.purchase_date, p.grand_total, COUNT(*) AS cnt,
           STRING_AGG(COALESCE(p.supplier_invoice_no,'?'), ', ') AS refs,
           STRING_AGG(p.id::text, ', ') AS ids
    FROM purchases p
    JOIN customers c ON c.id = p.supplier_id
    WHERE p.company_id = %s
    GROUP BY p.supplier_id, c.name, p.purchase_date, p.grand_total
    HAVING COUNT(*) > 1
    ORDER BY cnt DESC, p.purchase_date DESC
""")
if n == 0:
    print("  OK — no duplicate purchases")
else:
    print(f"  FOUND {n} duplicate purchase groups:")
    for r in rows[:20]:
        print(f"    [{r['cnt']}x] {r['supplier_name']}  {r['purchase_date']}  BD {r['grand_total']}  | refs: {r['refs']}")
    if n > 20:
        print(f"    ... and {n-20} more")
    issues.append(f"Duplicate purchases: {n} groups")

# ════════════════════════════════════════════════════════════════════════════
# 15. PAYMENT STATUS CONSISTENCY
# ════════════════════════════════════════════════════════════════════════════
section("15. PAYMENT STATUS CONSISTENCY CHECK")
rows, n = run("status_check", """
    SELECT
      SUM(CASE WHEN payment_status='unpaid'   AND amount_paid > 0 THEN 1 ELSE 0 END) AS unpaid_but_has_payment,
      SUM(CASE WHEN payment_status='paid'     AND ABS(amount_paid - grand_total) > 0.005 THEN 1 ELSE 0 END) AS paid_but_not_full,
      SUM(CASE WHEN payment_status='partial'  AND amount_paid = 0 THEN 1 ELSE 0 END) AS partial_but_zero,
      SUM(CASE WHEN payment_status='partial'  AND ABS(amount_paid - grand_total) < 0.005 THEN 1 ELSE 0 END) AS partial_but_full,
      SUM(CASE WHEN payment_status='overdue'  AND invoice_date > CURRENT_DATE - INTERVAL '90 days' THEN 1 ELSE 0 END) AS overdue_recent
    FROM invoices
    WHERE company_id = %s AND type = 'tax_invoice'
""")
r = rows[0]
ok = True
for k, v in r.items():
    if v and v > 0:
        print(f"  WARNING: {k}: {v}")
        issues.append(f"Status inconsistency — {k}: {v}")
        ok = False
if ok:
    print("  OK — all payment statuses are consistent")

# ════════════════════════════════════════════════════════════════════════════
# 16. OVERALL COUNTS SUMMARY
# ════════════════════════════════════════════════════════════════════════════
section("16. DATABASE RECORD COUNTS SUMMARY")
tables = [
    ('customers',     'company_id = %s'),
    ('products',      'company_id = %s'),
    ('invoices',      'company_id = %s'),
    ('invoice_items', 'EXISTS (SELECT 1 FROM invoices i WHERE i.id = invoice_id AND i.company_id = %s)'),
    ('payments',      'company_id = %s'),
    ('purchases',     'company_id = %s'),
    ('purchase_items','EXISTS (SELECT 1 FROM purchases p WHERE p.id = purchase_id AND p.company_id = %s)'),
    ('categories',    'company_id = %s'),
    ('expenses',      'company_id = %s'),
]
for tbl, cond in tables:
    cur.execute(f"SELECT COUNT(*) AS n FROM {tbl} WHERE {cond}", (COMPANY_ID,))
    n = cur.fetchone()['n']
    print(f"  {tbl:<20} {n:>8,} records")

# Invoice breakdown
section("  Invoice type breakdown")
cur.execute("""
    SELECT type AS invoice_type, payment_status AS status, COUNT(*) AS n, SUM(grand_total) AS total
    FROM invoices WHERE company_id = %s
    GROUP BY type, payment_status
    ORDER BY type, payment_status
""", (COMPANY_ID,))
for r in cur.fetchall():
    print(f"  {r['invoice_type']:<14} {r['status']:<10} {r['n']:>6,}   BD {r['total']:>12,.3f}")

# ════════════════════════════════════════════════════════════════════════════
# SUMMARY
# ════════════════════════════════════════════════════════════════════════════
print(f"\n{'=' * 70}")
print(f"  AUDIT COMPLETE — {len(issues)} issue type(s) found")
print(f"{'=' * 70}")
if issues:
    for i, iss in enumerate(issues, 1):
        print(f"  {i:2}. {iss}")
else:
    print("  All checks passed — data looks clean!")

cur.close()
conn.close()
