#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
List all duplicate purchase numbers in the SI backup (Purchase.xml).
Groups entries by number, shows each occurrence's date, amount, supplier, and paid status.
"""

import sys, io, zipfile, argparse
import xml.etree.ElementTree as ET

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def txt(el, tag):
    v = el.findtext(tag)
    return (v or '').strip()

def flt(v):
    try: return float(v or 0)
    except: return 0.0

def xml_from_zip(zf, names_set, filename):
    candidates = [f'1/{filename}', filename, filename.lower(), f'1/{filename.lower()}']
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

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--bak', default=r'C:\Projects\electrade\sinvoice.bak.zip')
    args = ap.parse_args()

    with zipfile.ZipFile(args.bak) as zf:
        names = set(zf.namelist())
        pur_root  = xml_from_zip(zf, names, 'Purchase.xml')
        cont_root = xml_from_zip(zf, names, 'Contractors.xml')

    if pur_root is None:
        print("ERROR: Purchase.xml not found"); sys.exit(1)

    # Build contractor/supplier name map (ID → FullName, suppliers only)
    sup_map = {}
    if cont_root:
        for s in cont_root.findall('Contractor'):
            sup_map[txt(s, 'ID')] = txt(s, 'FullName') or txt(s, 'ID') or '?'

    # Collect all purchases
    from collections import defaultdict
    by_number = defaultdict(list)

    for el in pur_root.findall('Purchase'):
        num    = txt(el, 'Number')
        si_id  = txt(el, 'ID')
        raw_date = txt(el, 'PurchaseDate')
        # SI stores date as DD/MM/YYYY
        if raw_date and '/' in raw_date:
            d, m, y = raw_date.split('/')
            date = f'{y}-{m.zfill(2)}-{d.zfill(2)}'
        else:
            date = raw_date[:10] if raw_date else ''
        amount = flt(txt(el, 'Amount'))
        paid   = txt(el, 'Paid').lower() == 'true'
        sup_id = txt(el, 'SupplierID')
        sup    = sup_map.get(sup_id, sup_id or '?')
        by_number[num].append({
            'si_id': si_id, 'date': date, 'amount': amount,
            'paid': paid, 'supplier': sup,
        })

    # Filter to duplicates only
    dups = {num: entries for num, entries in by_number.items() if len(entries) > 1}

    print(f"Duplicate purchase numbers in SI backup: {len(dups)}")
    total_extra = sum(len(v) - 1 for v in dups.values())
    print(f"Extra entries beyond first: {total_extra}")

    # Separate mixed-status (some paid, some unpaid) from all-paid / all-unpaid
    mixed   = {n: e for n, e in dups.items() if any(x['paid'] for x in e) and any(not x['paid'] for x in e)}
    all_paid   = {n: e for n, e in dups.items() if all(x['paid'] for x in e)}
    all_unpaid = {n: e for n, e in dups.items() if not any(x['paid'] for x in e)}

    total_unpaid_balance = sum(
        x['amount'] for entries in mixed.values() for x in entries if not x['paid']
    )

    print(f"\n  Mixed paid/unpaid (need investigation): {len(mixed)}")
    print(f"  All paid (harmless duplicates):          {len(all_paid)}")
    print(f"  All unpaid duplicates:                   {len(all_unpaid)}")
    print(f"\n  Unpaid balance in mixed-status dups: BHD {total_unpaid_balance:,.3f}")

    # ── Mixed status — most important ────────────────────────────────────────────
    if mixed:
        print(f"\n{'═'*110}")
        print(f"  MIXED STATUS — some paid, some unpaid (these affect AP balance)")
        print(f"{'═'*110}")
        hdr = f"  {'Number':<22} {'SI_ID':<12} {'Date':<12} {'Amount':>10} {'Paid':<6} {'Supplier'}"
        sep = f"  {'-'*21} {'-'*11} {'-'*11} {'-'*10} {'-'*5} {'-'*40}"
        print(hdr); print(sep)
        for num in sorted(mixed):
            for i, x in enumerate(mixed[num]):
                mark = ' <-- UNPAID' if not x['paid'] else ''
                print(f"  {(num if i==0 else ''):<22} {x['si_id']:<12} {x['date']:<12} "
                      f"{x['amount']:>10.3f} {'Y' if x['paid'] else 'N':<6} {x['supplier'][:45]}{mark}")
            print()

    # ── All-paid duplicates ───────────────────────────────────────────────────────
    if all_paid:
        print(f"\n{'═'*110}")
        print(f"  ALL-PAID DUPLICATES ({len(all_paid)}) — both entries paid, likely split shipments or re-entries")
        print(f"{'═'*110}")
        hdr = f"  {'Number':<22} {'SI_ID':<12} {'Date':<12} {'Amount':>10} {'Supplier'}"
        sep = f"  {'-'*21} {'-'*11} {'-'*11} {'-'*10} {'-'*40}"
        print(hdr); print(sep)
        for num in sorted(all_paid):
            for i, x in enumerate(all_paid[num]):
                print(f"  {(num if i==0 else ''):<22} {x['si_id']:<12} {x['date']:<12} "
                      f"{x['amount']:>10.3f} {x['supplier'][:45]}")
            print()

    # ── All-unpaid duplicates ─────────────────────────────────────────────────────
    if all_unpaid:
        print(f"\n{'═'*110}")
        print(f"  ALL-UNPAID DUPLICATES ({len(all_unpaid)}) — both unpaid")
        print(f"{'═'*110}")
        hdr = f"  {'Number':<22} {'SI_ID':<12} {'Date':<12} {'Amount':>10} {'Supplier'}"
        sep = f"  {'-'*21} {'-'*11} {'-'*11} {'-'*10} {'-'*40}"
        print(hdr); print(sep)
        for num in sorted(all_unpaid):
            for i, x in enumerate(all_unpaid[num]):
                print(f"  {(num if i==0 else ''):<22} {x['si_id']:<12} {x['date']:<12} "
                      f"{x['amount']:>10.3f} {x['supplier'][:45]}")
            print()

if __name__ == '__main__':
    main()
