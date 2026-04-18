#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Post-import verification: compare ElecTrade Pro DB totals against the
raw Simple Invoice backup file.

Checks:
  - AR  (unpaid/partial tax invoices)
  - AP  (unpaid/partial purchases)
  - Invoice, purchase, product, customer counts
  - Per-bucket breakdown of any gap

Usage:
    py verify_import.py
    py verify_import.py --bak C:/path/to/sinvoice.bak.zip
    py verify_import.py --verbose        # show individual mismatches
"""

import sys, io, os, argparse, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from collections import defaultdict

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import psycopg2, psycopg2.extras
except ImportError:
    print("ERROR: pip install psycopg2-binary"); sys.exit(1)

PASS = '\033[92m✓ PASS\033[0m'
FAIL = '\033[91m✗ FAIL\033[0m'
WARN = '\033[93m⚠ WARN\033[0m'
BOLD = '\033[1m'
RST  = '\033[0m'

BAK_DEFAULT = str(Path(__file__).parent.parent.parent / 'sinvoice.bak.zip')

# ── Helpers ───────────────────────────────────────────────────────────────────
def txt(el, tag):
    v = el.findtext(tag); return (v or '').strip()

def flt(v):
    try: return float(v or 0)
    except: return 0.0

def xml_from_zip(zf, names_set, filename):
    candidates = [f'1/{filename}', filename, filename.lower(), f'1/{filename.lower()}']
    for c in candidates:
        if c in names_set:
            with zf.open(c) as f: return ET.fromstring(f.read().decode('utf-8-sig'))
    base = filename.lower()
    for n in sorted(names_set):
        if n.lower().endswith('/' + base) or n.lower() == base:
            with zf.open(n) as f: return ET.fromstring(f.read().decode('utf-8-sig'))
    return None

def connect_db():
    env_path = Path(__file__).parent.parent.parent / 'backend' / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith('DATABASE_URL='):
                os.environ.setdefault('DATABASE_URL', line.split('=', 1)[1].strip()); break
    url = os.environ.get('DATABASE_URL')
    if not url:
        print("ERROR: DATABASE_URL not set and backend/.env not found"); sys.exit(1)
    conn = psycopg2.connect(url); conn.autocommit = True
    return conn

def check(label, expected, actual, tolerance=0.005):
    diff = actual - expected
    ok   = abs(diff) <= tolerance
    sym  = PASS if ok else FAIL
    print(f'  {sym}  {label:<38}  SI={expected:>12,.3f}  DB={actual:>12,.3f}  diff={diff:>+10.3f}')
    return ok

def check_count(label, expected, actual, tolerance=0):
    diff = actual - expected
    ok   = abs(diff) <= tolerance
    sym  = PASS if ok else WARN
    print(f'  {sym}  {label:<38}  SI={expected:>12,}  DB={actual:>12,}  diff={diff:>+10}')
    return ok

# ── Parse SI backup ───────────────────────────────────────────────────────────
def parse_si(bak_path):
    print(f'\nReading SI backup: {bak_path}')
    with zipfile.ZipFile(bak_path) as zf:
        names       = set(zf.namelist())
        sale_root   = xml_from_zip(zf, names, 'Sale.xml')
        pur_root    = xml_from_zip(zf, names, 'Purchase.xml')
        spay_root   = xml_from_zip(zf, names, 'Payments.xml')
        ppay_root   = xml_from_zip(zf, names, 'PurchasePayment.xml')
        prod_root   = xml_from_zip(zf, names, 'Product.xml')
        cont_root   = xml_from_zip(zf, names, 'Contractors.xml')

    if sale_root is None:  print("ERROR: Sale.xml not found");     sys.exit(1)
    if pur_root is None:   print("ERROR: Purchase.xml not found"); sys.exit(1)

    # Build payment maps from payment XMLs (more reliable than TotalDue field)
    # sale_id → total payments made
    sale_paid_map = defaultdict(float)
    if spay_root is not None:
        for el in spay_root.findall('Payment'):
            sale_paid_map[txt(el, 'DocumentID')] += flt(txt(el, 'Amount'))

    # purchase_id → total payments made
    pur_paid_map = defaultdict(float)
    if ppay_root is not None:
        for el in ppay_root.findall('PurchasePayment'):
            pur_paid_map[txt(el, 'PurchaseID')] += flt(txt(el, 'Amount'))

    # AR — unpaid/partial tax invoices (TypeID=1)
    # Balance = Amount - payments (from Payments.xml)
    ar_total    = 0.0
    inv_count   = 0
    inv_unpaid  = 0
    for el in sale_root.findall('Sale'):
        if txt(el, 'TypeID') != '1': continue
        inv_count += 1
        paid = txt(el, 'Paid').lower() == 'true'
        if not paid:
            si_id   = txt(el, 'ID')
            amount  = flt(txt(el, 'Amount'))
            paid_so_far = sale_paid_map.get(si_id, 0.0)
            balance = max(amount - paid_so_far, 0.0)
            if balance > 0.005:
                inv_unpaid += 1
                ar_total   += balance

    # AP — unpaid/partial purchases
    # Balance = Amount - payments (from PurchasePayment.xml)
    ap_total   = 0.0
    pur_count  = 0
    pur_unpaid = 0
    for el in pur_root.findall('Purchase'):
        pur_count += 1
        paid = txt(el, 'Paid').lower() == 'true'
        if not paid:
            si_id   = txt(el, 'ID')
            amount  = flt(txt(el, 'Amount'))
            paid_so_far = pur_paid_map.get(si_id, 0.0)
            balance = max(amount - paid_so_far, 0.0)
            if balance > 0.005:
                pur_unpaid += 1
                ap_total   += balance

    prod_count = len(prod_root.findall('Product')) if prod_root is not None else 0
    cust_count = 0
    if cont_root is not None:
        for c in cont_root.findall('Contractor'):
            cust_count += 1

    return {
        'ar':         round(ar_total, 3),
        'ap':         round(ap_total, 3),
        'inv_total':  inv_count,
        'inv_unpaid': inv_unpaid,
        'pur_total':  pur_count,
        'pur_unpaid': pur_unpaid,
        'products':   prod_count,
        'contractors': cust_count,
    }

# ── Query our DB ──────────────────────────────────────────────────────────────
def query_db(conn):
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT id, name FROM companies LIMIT 1")
    co = cur.fetchone()
    if not co:
        print("ERROR: No company found in DB — did the import run?"); sys.exit(1)
    company_id = co['id']
    print(f'Company: {co["name"]}  (id={company_id})\n')

    # AR — only outstanding invoices (unpaid/partial/overdue), not paid
    cur.execute("""
        SELECT COALESCE(SUM(balance_due), 0) AS ar,
               COUNT(*) AS unpaid_count,
               (SELECT COUNT(*) FROM invoices
                WHERE company_id=%s AND type='tax_invoice') AS total_count
        FROM invoices
        WHERE company_id=%s AND type='tax_invoice'
          AND payment_status IN ('unpaid','partial','overdue')
          AND write_off_date IS NULL
    """, (company_id, company_id))
    r = cur.fetchone()
    db_ar          = float(r['ar'])
    db_inv_unpaid  = int(r['unpaid_count'])
    db_inv_total   = int(r['total_count'])

    # AP — only outstanding purchases (unpaid/partial), not paid
    cur.execute("""
        SELECT COALESCE(SUM(grand_total - amount_paid), 0) AS ap,
               COUNT(*) AS unpaid_count,
               (SELECT COUNT(*) FROM purchases WHERE company_id=%s) AS total_count
        FROM purchases
        WHERE company_id=%s
          AND payment_status IN ('unpaid','partial')
    """, (company_id, company_id))
    r = cur.fetchone()
    db_ap          = float(r['ap'])
    db_pur_unpaid  = int(r['unpaid_count'])
    db_pur_total   = int(r['total_count'])

    # Products
    cur.execute("SELECT COUNT(*) FROM products WHERE company_id=%s", (company_id,))
    db_products = int(cur.fetchone()['count'])

    # Customers
    cur.execute("SELECT COUNT(*) FROM customers WHERE company_id=%s", (company_id,))
    db_customers = int(cur.fetchone()['count'])

    cur.close()
    return {
        'ar':         round(db_ar, 3),
        'ap':         round(db_ap, 3),
        'inv_total':  db_inv_total,
        'inv_unpaid': db_inv_unpaid,
        'pur_total':  db_pur_total,
        'pur_unpaid': db_pur_unpaid,
        'products':   db_products,
        'customers':  db_customers,
    }

# ── Verbose gap analysis ──────────────────────────────────────────────────────
def verbose_ar_gap(conn, bak_path):
    """Show which invoices are causing AR discrepancy."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id FROM companies LIMIT 1")
    company_id = cur.fetchone()['id']

    # Build SI unpaid map: invoice_no → balance (from payment XML)
    with zipfile.ZipFile(bak_path) as zf:
        names = set(zf.namelist())
        sale_root  = xml_from_zip(zf, names, 'Sale.xml')
        spay_root  = xml_from_zip(zf, names, 'Payments.xml')
    sale_paid_map = defaultdict(float)
    if spay_root is not None:
        for el in spay_root.findall('Payment'):
            sale_paid_map[txt(el, 'DocumentID')] += flt(txt(el, 'Amount'))
    si_map = {}
    for el in sale_root.findall('Sale'):
        if txt(el, 'TypeID') != '1': continue
        if txt(el, 'Paid').lower() == 'true': continue
        si_id   = txt(el, 'ID')
        num     = txt(el, 'Number')
        amount  = flt(txt(el, 'Amount'))
        balance = max(amount - sale_paid_map.get(si_id, 0.0), 0.0)
        if balance > 0.005:
            si_map[num] = balance

    # Get our outstanding invoices
    cur.execute("""
        SELECT invoice_no, balance_due, payment_status
        FROM invoices
        WHERE company_id=%s AND type='tax_invoice'
          AND payment_status IN ('unpaid','partial','overdue')
          AND write_off_date IS NULL
    """, (company_id,))
    db_map = {r['invoice_no']: float(r['balance_due']) for r in cur.fetchall()}

    # Find mismatches
    all_keys = set(si_map) | set(db_map)
    mismatches = []
    for k in sorted(all_keys):
        si_v = si_map.get(k, 0)
        db_v = db_map.get(k, 0)
        diff = db_v - si_v
        if abs(diff) > 0.005:
            mismatches.append((k, si_v, db_v, diff))

    if mismatches:
        print(f'\n  AR mismatches ({len(mismatches)} invoices):')
        print(f"  {'Invoice':<22} {'SI balance':>12} {'DB balance':>12} {'diff':>10}")
        print(f"  {'-'*21} {'-'*12} {'-'*12} {'-'*10}")
        for k, si_v, db_v, diff in mismatches[:40]:
            flag = ' ← in DB only' if si_v == 0 else (' ← in SI only' if db_v == 0 else '')
            print(f"  {k:<22} {si_v:>12.3f} {db_v:>12.3f} {diff:>+10.3f}{flag}")
        if len(mismatches) > 40:
            print(f"  ... and {len(mismatches)-40} more")
    cur.close()

def verbose_ap_gap(conn, bak_path):
    """Show which purchases are causing AP discrepancy."""
    cur = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
    cur.execute("SELECT id FROM companies LIMIT 1")
    company_id = cur.fetchone()['id']

    with zipfile.ZipFile(bak_path) as zf:
        names = set(zf.namelist())
        pur_root  = xml_from_zip(zf, names, 'Purchase.xml')
        ppay_root = xml_from_zip(zf, names, 'PurchasePayment.xml')
    pur_paid_map = defaultdict(float)
    if ppay_root is not None:
        for el in ppay_root.findall('PurchasePayment'):
            pur_paid_map[txt(el, 'PurchaseID')] += flt(txt(el, 'Amount'))
    si_map = defaultdict(float)
    for el in pur_root.findall('Purchase'):
        if txt(el, 'Paid').lower() == 'true': continue
        si_id   = txt(el, 'ID')
        num     = txt(el, 'Number')
        amount  = flt(txt(el, 'Amount'))
        balance = max(amount - pur_paid_map.get(si_id, 0.0), 0.0)
        if balance > 0.005:
            si_map[num] += balance

    cur.execute("""
        SELECT purchase_no, grand_total - amount_paid AS balance, payment_status
        FROM purchases
        WHERE company_id=%s AND payment_status IN ('unpaid','partial')
    """, (company_id,))
    db_map = defaultdict(float)
    import re as _re
    _dup_suffix = _re.compile(r'-([2-9])$')   # only strip -2 … -9 (our dedup suffix)
    for r in cur.fetchall():
        num = _dup_suffix.sub('', r['purchase_no'])
        db_map[num] += float(r['balance'])

    all_keys = set(si_map) | set(db_map)
    mismatches = []
    for k in sorted(all_keys):
        si_v = round(si_map.get(k, 0), 3)
        db_v = round(db_map.get(k, 0), 3)
        diff = db_v - si_v
        if abs(diff) > 0.005:
            mismatches.append((k, si_v, db_v, diff))

    if mismatches:
        print(f'\n  AP mismatches ({len(mismatches)} purchase numbers):')
        print(f"  {'Purchase No':<25} {'SI balance':>12} {'DB balance':>12} {'diff':>10}")
        print(f"  {'-'*24} {'-'*12} {'-'*12} {'-'*10}")
        for k, si_v, db_v, diff in mismatches[:40]:
            flag = ' ← in DB only' if si_v == 0 else (' ← in SI only' if db_v == 0 else '')
            print(f"  {k:<25} {si_v:>12.3f} {db_v:>12.3f} {diff:>+10.3f}{flag}")
        if len(mismatches) > 40:
            print(f"  ... and {len(mismatches)-40} more")
    cur.close()

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description='Verify ElecTrade DB against SI backup')
    ap.add_argument('--bak',     default=BAK_DEFAULT, help='Path to sinvoice.bak.zip')
    ap.add_argument('--verbose', action='store_true',  help='Show individual mismatches')
    args = ap.parse_args()

    si = parse_si(args.bak)
    conn = connect_db()
    db = query_db(conn)

    print(f'{BOLD}{"═"*80}{RST}')
    print(f'{BOLD}  IMPORT VERIFICATION REPORT{RST}')
    print(f'{"═"*80}')

    print(f'\n  {BOLD}Financial Balances{RST}')
    ar_ok = check('Accounts Receivable (AR)',  si['ar'], db['ar'], tolerance=0.05)
    ap_ok = check('Accounts Payable (AP)',     si['ap'], db['ap'], tolerance=0.1)

    print(f'\n  {BOLD}Record Counts{RST}')
    check_count('Tax Invoices (total)',         si['inv_total'],  db['inv_total'])
    check_count('Tax Invoices (unpaid)',        si['inv_unpaid'], db['inv_unpaid'])
    check_count('Purchases (total)',            si['pur_total'],  db['pur_total'],  tolerance=20)
    check_count('Purchases (unpaid)',           si['pur_unpaid'], db['pur_unpaid'], tolerance=20)
    check_count('Products',                    si['products'],   db['products'],   tolerance=5)

    print(f'\n{"═"*80}')
    all_ok = ar_ok and ap_ok
    if all_ok:
        print(f'  {PASS}  {BOLD}All financial balances match.{RST}')
    else:
        print(f'  {FAIL}  {BOLD}Financial mismatch detected — see details above.{RST}')
        if args.verbose:
            if not ar_ok:
                print(f'\n{BOLD}  AR Gap Analysis:{RST}')
                verbose_ar_gap(conn, args.bak)
            if not ap_ok:
                print(f'\n{BOLD}  AP Gap Analysis:{RST}')
                verbose_ap_gap(conn, args.bak)
        else:
            print(f'  Run with --verbose for per-invoice breakdown.')
    print(f'{"═"*80}\n')

    conn.close()
    sys.exit(0 if all_ok else 1)

if __name__ == '__main__':
    main()
