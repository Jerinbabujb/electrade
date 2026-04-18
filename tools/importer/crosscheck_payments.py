#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Cross-verify invoices that are fully paid in Simple Invoice (SI)
but still show a balance_due > 0 in ElecTrade Pro.

SI uses Sale.Paid='true' to mark fully settled invoices.

Usage:
    py crosscheck_payments.py --bak /path/to/sinvoice.bak.zip
"""

import sys, io, os, argparse, zipfile
import xml.etree.ElementTree as ET
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import psycopg2
    import psycopg2.extras
except ImportError:
    print("ERROR: psycopg2-binary is required.  pip install psycopg2-binary")
    sys.exit(1)

# ── DB connect ────────────────────────────────────────────────────────────────
def connect_db():
    env_path = Path(__file__).parent.parent.parent / 'backend' / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            if line.startswith('DATABASE_URL='):
                os.environ.setdefault('DATABASE_URL', line.split('=', 1)[1].strip())
                break
    url = os.environ.get('DATABASE_URL')
    conn = psycopg2.connect(url)
    conn.autocommit = True
    return conn

# ── XML helpers ───────────────────────────────────────────────────────────────
def xml_from_zip(zf, names_set, filename):
    candidates = [
        f'1/{filename}', filename, filename.lower(), f'1/{filename.lower()}'
    ]
    for c in candidates:
        if c in names_set:
            with zf.open(c) as f:
                return ET.fromstring(f.read().decode('utf-8-sig'))
    base = filename.lower()
    for n in sorted(names_set):
        if n.lower().endswith('/' + base) or n.lower() == base:
            with zf.open(n) as f:
                return ET.fromstring(f.read().decode('utf-8-sig'))
    return None

def flt(val):
    try: return float(val or 0)
    except: return 0.0

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bak', default='/c/Projects/electrade/sinvoice.bak.zip')
    args = ap.parse_args()

    print(f"Reading {args.bak} ...")
    with zipfile.ZipFile(args.bak) as zf:
        names = set(zf.namelist())
        sales_root = xml_from_zip(zf, names, 'Sale.xml')

    if sales_root is None:
        print("ERROR: Sale.xml not found in backup"); sys.exit(1)

    # ── Build set of invoice numbers marked Paid=true in SI ──────────────────
    print("Parsing Sale.xml (looking for Paid=true tax invoices) ...")
    si_paid_invoices = {}   # invoice_no → {si_total, si_total_due}
    total_count = 0
    for el in sales_root.findall('Sale'):
        type_id = el.findtext('TypeID') or '1'
        if type_id != '1':   # only tax invoices
            continue
        total_count += 1
        paid_flag = (el.findtext('Paid') or '').strip().lower()
        if paid_flag != 'true':
            continue
        number    = (el.findtext('Number') or '').strip()
        amount    = flt(el.findtext('Amount'))
        total_due = flt(el.findtext('TotalDue'))
        if number:
            si_paid_invoices[number] = {
                'si_amount':    round(amount, 3),
                'si_total_due': round(total_due, 3),
            }

    print(f"  {total_count:,} tax invoices in SI")
    print(f"  {len(si_paid_invoices):,} marked Paid=true in SI")

    # ── Query our DB for invoices still showing a balance ─────────────────────
    conn = connect_db()
    cur  = conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)

    cur.execute("SELECT id, name FROM companies LIMIT 1")
    company = cur.fetchone()
    COMPANY_ID = company['id']
    print(f"Checking company: {company['name']}")

    cur.execute("""
        SELECT i.invoice_no, i.id, i.grand_total, i.amount_paid, i.balance_due,
               i.payment_status, c.name AS customer_name, i.invoice_date
        FROM invoices i
        JOIN customers c ON c.id = i.customer_id
        WHERE i.company_id = %s
          AND i.type = 'tax_invoice'
          AND i.payment_status IN ('unpaid', 'partial', 'overdue')
          AND i.write_off_date IS NULL
        ORDER BY i.invoice_no
    """, (COMPANY_ID,))
    our_pending = {r['invoice_no']: r for r in cur.fetchall()}

    print(f"  {len(our_pending):,} invoices pending in our system")

    # ── Find discrepancies ────────────────────────────────────────────────────
    discrepancies = []
    for inv_no, our in our_pending.items():
        if inv_no in si_paid_invoices:
            si = si_paid_invoices[inv_no]
            discrepancies.append({
                'invoice_no':    inv_no,
                'customer':      our['customer_name'],
                'invoice_date':  str(our['invoice_date'])[:10],
                'our_total':     float(our['grand_total']),
                'our_paid':      float(our['amount_paid']),
                'our_balance':   float(our['balance_due']),
                'our_status':    our['payment_status'],
                'si_amount':     si['si_amount'],
                'si_total_due':  si['si_total_due'],
                'diff_total':    round(float(our['grand_total']) - si['si_amount'], 3),
                'inv_id':        str(our['id']),
            })

    print(f"\n{'='*90}")
    print(f"  CROSS-CHECK RESULT: {len(discrepancies)} invoice(s) fully paid in SI but pending in our system")
    print(f"{'='*90}")

    if not discrepancies:
        print("  All clear — no discrepancies found.")
        cur.close(); conn.close()
        return

    # ── Group by discrepancy type ─────────────────────────────────────────────
    type_a = [d for d in discrepancies if d['diff_total'] > 0.005]   # our total inflated
    type_b = [d for d in discrepancies if abs(d['diff_total']) <= 0.005]  # totals match, payment missing
    type_c = [d for d in discrepancies if d['diff_total'] < -0.005]  # unusual

    total_adjustment = sum(d['our_balance'] for d in discrepancies)

    print(f"\n  Type A — Our total > SI total (import inflated: VAT/rounding):  {len(type_a)}")
    print(f"  Type B — Totals match, but payment missing in our import:        {len(type_b)}")
    print(f"  Type C — Our total < SI total (unusual — investigate):           {len(type_c)}")
    print(f"\n  Total balance to reconcile: BHD {total_adjustment:,.3f}")

    hdr = f"  {'Invoice':<18} {'Customer':<38} {'Date':<12} {'OurTotal':>9} {'SITotal':>9} {'Balance':>9} {'Diff':>7} {'Status':<10}"
    sep = f"  {'-'*17} {'-'*37} {'-'*11} {'-'*9} {'-'*9} {'-'*9} {'-'*7} {'-'*9}"

    def print_group(label, rows):
        if not rows:
            return
        print(f"\n{'─'*90}")
        print(f"  {label}")
        print(f"{'─'*90}")
        print(hdr)
        print(sep)
        for d in rows:
            print(f"  {d['invoice_no']:<18} {d['customer'][:37]:<38} {d['invoice_date']:<12} "
                  f"{d['our_total']:>9.3f} {d['si_amount']:>9.3f} {d['our_balance']:>9.3f} {d['diff_total']:>+7.3f} {d['our_status']:<10}")

    print_group("Type A — Our total inflated vs SI (VAT misclassification or rounding)", type_a)
    print_group("Type B — Totals match, payment not captured during import", type_b)
    print_group("Type C — Our total lower than SI (investigate)", type_c)

    # ── VAT vs rounding split for Type A ─────────────────────────────────────
    if type_a:
        print(f"\n{'─'*90}")
        print(f"  Type A detail — VAT pattern check (balance divisible by 0.05 = VAT misclassification)")
        print(f"{'─'*90}")
        vat_pattern = []
        rounding    = []
        for d in type_a:
            bal = d['our_balance']
            if bal > 0 and abs(bal / 0.05 - round(bal / 0.05)) < 0.01:
                vat_pattern.append(d)
            else:
                rounding.append(d)
        print(f"    VAT misclassification (balance / 0.05 = whole number): {len(vat_pattern)}")
        print(f"    Other rounding/calculation discrepancy:                {len(rounding)}")
        if rounding:
            print(f"\n    Rounding discrepancies (like INV/2024/2115):")
            for d in rounding:
                print(f"      {d['invoice_no']}  {d['customer'][:40]}  our={d['our_total']:.3f}  si={d['si_amount']:.3f}  balance={d['our_balance']:.3f}")

    # ── Write SQL fix script ──────────────────────────────────────────────────
    fix_file = Path(__file__).parent / 'fix_discrepancies.sql'
    with open(fix_file, 'w', encoding='utf-8') as f:
        f.write("-- Auto-generated reconciliation payments\n")
        f.write(f"-- {len(discrepancies)} invoices: paid in SI, pending in ElecTrade\n")
        f.write(f"-- Total adjustment: BHD {total_adjustment:.3f}\n\n")
        f.write("BEGIN;\n\n")
        for d in discrepancies:
            if abs(d['diff_total']) > 0.005:
                note = "SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)"
            else:
                note = "SI import reconciliation — payment not captured during data import"
            f.write(f"-- {d['invoice_no']}  |  {d['customer'][:45]}  |  balance={d['our_balance']:.3f}  diff={d['diff_total']:+.3f}\n")
            f.write(f"INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)\n")
            f.write(f"SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,\n")
            f.write(f"       i.balance_due, 'other', '{note}',\n")
            f.write(f"       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)\n")
            f.write(f"FROM invoices i WHERE i.id = '{d['inv_id']}';\n\n")
        f.write("COMMIT;\n")

    print(f"\n  Fix SQL written to: {fix_file}")

    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
