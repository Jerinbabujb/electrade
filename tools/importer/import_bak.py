#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import sys, io
# Force UTF-8 output on Windows (avoids cp1252 UnicodeEncodeError)
if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')
"""
Simple Invoice backup importer for ElecTrade Pro
Reads sinvoice_bak.zip (a ZIP of XML files) and imports all data into the
ElecTrade Pro PostgreSQL database.

Usage:
    python3 import_bak.py --bak /path/to/sinvoice_bak.zip
    python3 import_bak.py --bak /path/to/sinvoice_bak.zip --dry-run
    python3 import_bak.py --bak /path/to/sinvoice_bak.zip --company-id UUID
    python3 import_bak.py --bak /path/to/sinvoice_bak.zip --fast

Requirements:
    pip install psycopg2-binary

The script reads DATABASE_URL from ../../backend/.env (relative to this file),
or falls back to DB_USER / DB_PASSWORD / DB_NAME / DB_HOST / DB_PORT env vars.
"""

import argparse
import os
import re
import sys
import uuid
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime, date as date_type

try:
    import psycopg2
except ImportError:
    print("ERROR: psycopg2-binary is required.")
    print("       Install with:  pip install psycopg2-binary")
    sys.exit(1)

# ── Constants ──────────────────────────────────────────────────────────────────

SALE_TYPE_MAP = {
    '1': 'tax_invoice',
    '2': 'credit_note',
    '3': 'quotation',
    '4': 'proforma',
    '5': 'receipt',
}

# Map raw unit strings → ElecTrade unit_type enum values
# Valid enum: 'pcs','mtr','box','reel','kg','set','pack','ltr','m2','m3'
UNIT_MAP = {
    'each': 'pcs', 'ea': 'pcs', 'ech': 'pcs', 'pcs': 'pcs', 'pc': 'pcs',
    'piece': 'pcs', 'pieces': 'pcs', 'nos': 'pcs', 'no.': 'pcs', 'no': 'pcs',
    'nos.': 'pcs', 'strip': 'pcs', 'number': 'pcs', 'unit': 'pcs', 'units': 'pcs',
    'item': 'pcs', 'items': 'pcs', 'length': 'pcs',
    'mtr': 'mtr', 'm': 'mtr', 'meter': 'mtr', 'metre': 'mtr', 'mts': 'mtr',
    'meters': 'mtr', 'metres': 'mtr', 'mtrs': 'mtr',
    'roll': 'reel', 'rolls': 'reel', 'reel': 'reel', 'reels': 'reel',
    'coil': 'reel', 'coils': 'reel',
    'pkt': 'pack', 'pack': 'pack', 'packet': 'pack', 'packets': 'pack', 'pkg': 'pack',
    'kg': 'kg', 'kgs': 'kg', 'kilogram': 'kg', 'kilograms': 'kg',
    'set': 'set', 'sets': 'set', 'kit': 'set',
    'box': 'box', 'boxes': 'box', 'bx': 'box', 'carton': 'box',
    'ltr': 'ltr', 'litre': 'ltr', 'liter': 'ltr', 'litres': 'ltr',
    'liters': 'ltr', 'l': 'ltr', 'lt': 'ltr',
    'm2': 'm2', 'sqm': 'm2', 'sq.m': 'm2', 'sqft': 'm2',
    'm3': 'm3', 'cbm': 'm3', 'cum': 'm3',
}

TODAY_STR = date_type.today().isoformat()  # YYYY-MM-DD

# ── Helper functions ───────────────────────────────────────────────────────────

def parse_date(s):
    """Parse DD/MM/YYYY or YYYY-MM-DD → 'YYYY-MM-DD'. Returns None on failure."""
    if not s:
        return None
    s = s.strip()
    for fmt in ('%d/%m/%Y', '%Y-%m-%d', '%d-%m-%Y', '%m/%d/%Y'):
        try:
            return datetime.strptime(s, fmt).strftime('%Y-%m-%d')
        except ValueError:
            pass
    return None


def extract_vat(nip, street):
    """Extract 15-digit VAT/TRN number from Nip or Street fields."""
    for text in [nip or '', street or '']:
        m = re.search(r'\d{15}', text)
        if m:
            return m.group(0)
    return None


def clean_address(street):
    """Remove TRN lines from address string."""
    if not street:
        return None
    lines = [
        ln for ln in street.split('\n')
        if not re.search(r'^\s*TRN[:\s]', ln, re.IGNORECASE)
    ]
    result = '\n'.join(lines).strip()
    return result or None


def norm_unit(raw):
    """Normalise raw unit string to ElecTrade unit_type enum value."""
    if not raw:
        return 'pcs'
    key = raw.strip().lower()
    return UNIT_MAP.get(key, 'pcs')


def flt(val, default=0.0):
    """Safely convert to float."""
    try:
        return float(val or 0)
    except (ValueError, TypeError):
        return default


def gen_uuid():
    return str(uuid.uuid4())


def xml_from_zip(zf, path):
    """Read and parse an XML file from the ZIP, handling UTF-8 BOM."""
    try:
        with zf.open(path) as f:
            content = f.read().decode('utf-8-sig')
        return ET.fromstring(content)
    except KeyError:
        return None
    except ET.ParseError as e:
        print(f"\n  WARNING: XML parse error in {path}: {e}")
        return None


# ── Database connection ────────────────────────────────────────────────────────

def connect_db():
    """Connect using DATABASE_URL from .env or individual env vars."""
    script_dir = os.path.dirname(os.path.abspath(__file__))
    env_path   = os.path.normpath(os.path.join(script_dir, '..', '..', 'backend', '.env'))

    if os.path.exists(env_path):
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line.startswith('DATABASE_URL=') and not line.startswith('#'):
                    val = line.split('=', 1)[1].strip().strip('"\'')
                    os.environ.setdefault('DATABASE_URL', val)
                    break

    db_url = os.environ.get('DATABASE_URL')
    if db_url:
        conn = psycopg2.connect(db_url)
    else:
        conn = psycopg2.connect(
            dbname=os.environ.get('DB_NAME', 'electrade'),
            user=os.environ.get('DB_USER', 'electrade'),
            password=os.environ.get('DB_PASSWORD', ''),
            host=os.environ.get('DB_HOST', 'localhost'),
            port=int(os.environ.get('DB_PORT', '5432')),
        )
    conn.autocommit = False
    return conn


# ── XML loading ────────────────────────────────────────────────────────────────

def load_xml_data(bak_path):
    """Load all relevant XML files from the ZIP into memory."""
    print(f"Reading {bak_path} ...")
    data = {}

    with zipfile.ZipFile(bak_path) as zf:
        names = set(zf.namelist())

        def get(filename):
            # Try common path variants
            for candidate in [
                f'1/{filename}',
                filename,
                filename.lower(),
                f'1/{filename.lower()}',
            ]:
                if candidate in names:
                    return xml_from_zip(zf, candidate)
            # Case-insensitive fallback
            base = filename.lower()
            for n in sorted(names):
                if n.lower().endswith('/' + base) or n.lower() == base:
                    return xml_from_zip(zf, n)
            return None

        data['categories']        = get('Category.xml')
        data['contractors']       = get('Contractors.xml')
        data['products']          = get('Product.xml')
        data['suppliers']         = get('Suppliers.xml')
        data['sales']             = get('Sale.xml')
        data['sale_items']        = get('SaleItem.xml')
        data['payments']          = get('Payments.xml')
        data['purchases']         = get('Purchase.xml')
        data['purchase_items']    = get('PurchaseItem.xml')
        data['purchase_payments'] = get('PurchasePayment.xml')
        data['expenses']          = get('Expenses.xml')

    found = [k for k, v in data.items() if v is not None]
    missing = [k for k, v in data.items() if v is None]
    print(f"  Loaded: {', '.join(found)}")
    if missing:
        print(f"  Missing: {', '.join(missing)}")
    return data


# ── Import: Categories ─────────────────────────────────────────────────────────

def import_categories(cur, company_id, root):
    """
    Import categories from Category.xml.
    TypeID 1 → product category, TypeID 3 → expense category.
    Returns dict: {si_id_str: uuid_str}
    """
    print('→ Importing categories...', end='', flush=True)
    if root is None:
        print('  SKIPPED')
        return {}

    cat_map = {}   # SI ID string → ElecTrade UUID
    imported = skipped = 0

    for el in root.findall('Category'):
        si_id   = el.findtext('ID')
        type_id = el.findtext('TypeID') or '1'
        name    = (el.findtext('Name') or '').strip()

        if not si_id or not name:
            continue

        cat_type = 'expense' if type_id == '3' else 'product'

        # Duplicate check
        cur.execute(
            "SELECT id FROM categories WHERE company_id=%s AND LOWER(name)=%s AND type=%s::category_type",
            (company_id, name.lower(), cat_type),
        )
        row = cur.fetchone()
        if row:
            cat_map[si_id] = str(row[0])
            skipped += 1
            continue

        new_id = gen_uuid()
        cur.execute(
            "INSERT INTO categories (id, company_id, name, type) VALUES (%s,%s,%s,%s::category_type)",
            (new_id, company_id, name, cat_type),
        )
        cat_map[si_id] = new_id
        imported += 1

    print(f'  {imported:>6,} imported, {skipped} already existed')
    return cat_map


# ── Import: Customers / Suppliers ──────────────────────────────────────────────

def import_customers(cur, company_id, root):
    """
    Import Contractors.xml as customers and suppliers.
    IsSupplier=true  → type='supplier', code S0001…
    IsCustomer=true only → type='retail',   code C0001…
    Returns dict: {si_id_str: uuid_str}
    """
    print('→ Importing customers/suppliers...', end='', flush=True)
    if root is None:
        print('  SKIPPED')
        return {}

    cust_map  = {}
    imported = skipped = cust_count = sup_count = 0
    cust_seq = sup_seq = 0
    used_codes = set()

    # Pre-load existing codes so we don't collide
    cur.execute("SELECT code FROM customers WHERE company_id=%s", (company_id,))
    for r in cur.fetchall():
        used_codes.add(r[0])

    def next_code(prefix, seq):
        code = f'{prefix}{seq:04d}'
        while code in used_codes:
            seq += 1
            code = f'{prefix}{seq:04d}'
        used_codes.add(code)
        return code, seq

    for el in root.findall('Contractor'):
        si_id  = el.findtext('ID')
        name   = (el.findtext('FullName') or '').strip()
        nip    = el.findtext('Nip')   or ''
        street = el.findtext('Street') or ''
        phone  = (el.findtext('Phone') or el.findtext('Mobile') or '').strip()
        email  = (el.findtext('Email') or '').strip()
        is_sup = (el.findtext('IsSupplier') or 'false').lower() == 'true'

        if not si_id or not name:
            continue

        vat_no  = extract_vat(nip, street)
        address = clean_address(street)
        tel_val   = phone[:30] if phone else None
        email_val = email[:150] if '@' in email else None

        # Duplicate check by name
        cur.execute(
            "SELECT id FROM customers WHERE company_id=%s AND LOWER(name)=%s",
            (company_id, name.lower()),
        )
        row = cur.fetchone()
        if row:
            cust_map[si_id] = str(row[0])
            skipped += 1
            continue

        if is_sup:
            sup_seq += 1
            code, sup_seq = next_code('S', sup_seq)
            cust_type = 'supplier'
            sup_count += 1
        else:
            cust_seq += 1
            code, cust_seq = next_code('C', cust_seq)
            cust_type = 'retail'
            cust_count += 1

        new_id = gen_uuid()
        cur.execute("""
            INSERT INTO customers
                (id, company_id, code, name, type, vat_number, address, tel, email, payment_terms_days)
            VALUES (%s,%s,%s,%s,%s::customer_type,%s,%s,%s,%s,30)
        """, (new_id, company_id, code, name, cust_type, vat_no, address, tel_val, email_val))

        cust_map[si_id] = new_id
        imported += 1

    print(f'  {imported:>6,} imported ({cust_count:,} customers, {sup_count:,} suppliers), {skipped} skipped')
    return cust_map


# ── Import: Products ───────────────────────────────────────────────────────────

def import_products(cur, company_id, products_root, suppliers_root, cat_map):
    """
    Import products from Product.xml.
    Skip Type=3 (system items) and handle inactive products.
    Cost price comes from Suppliers.xml (minimum price per product).
    Returns dict: {si_id_str: uuid_str}
    """
    print('→ Importing products...', end='', flush=True)
    if products_root is None:
        print('  SKIPPED')
        return {}

    # Build cost price lookup: SI product ID → min supplier price
    cost_prices = {}
    if suppliers_root is not None:
        for el in suppliers_root.findall('Supplier'):
            pid   = el.findtext('ProductId')
            price = flt(el.findtext('Price'))
            if pid and price > 0:
                if pid not in cost_prices or price < cost_prices[pid]:
                    cost_prices[pid] = price

    # Pre-load existing SKUs for dedup
    cur.execute("SELECT sku FROM products WHERE company_id=%s", (company_id,))
    existing_skus = {r[0] for r in cur.fetchall()}

    prod_map = {}
    imported = type3_skip = inactive_skip = dup_skip = 0
    sku_usage = {}  # raw_sku → counter for generating unique variants

    for el in products_root.findall('Product'):
        si_id    = el.findtext('ID')
        ptype    = el.findtext('Type') or '1'
        inactive = (el.findtext('Inactive') or 'false').lower() == 'true'
        name     = (el.findtext('Name') or el.findtext('n') or '').strip()

        if not si_id or not name:
            continue

        if ptype == '3':
            type3_skip += 1
            continue

        cat_si   = el.findtext('CategoryID') or ''
        sku_raw  = (el.findtext('Index') or '').strip() or f'SKU-{si_id}'
        units    = el.findtext('Units') or 'pcs'
        tax_id   = el.findtext('TaxRateID') or '2'
        p1       = flt(el.findtext('Price1'))
        p2       = flt(el.findtext('Price2'))
        p3       = flt(el.findtext('Price3'))
        p4       = flt(el.findtext('Price4'))
        stock_min = flt(el.findtext('StockLowLevel'))
        tracked  = (el.findtext('StockControl') or 'true').lower() == 'true'
        is_sales = (el.findtext('SalesItem') or 'true').lower() == 'true'
        is_purch = (el.findtext('PurchaseItem') or 'true').lower() == 'true'

        vat_rate = 10.00 if tax_id == '2' else 0.00
        unit     = norm_unit(units)
        cat_id   = cat_map.get(cat_si)
        cost     = cost_prices.get(si_id, p1 * 0.7 if p1 > 0 else 0.0)

        # Duplicate check by name
        cur.execute(
            "SELECT id FROM products WHERE company_id=%s AND LOWER(name)=%s",
            (company_id, name.lower()),
        )
        row = cur.fetchone()
        if row:
            prod_map[si_id] = str(row[0])
            dup_skip += 1
            if inactive:
                inactive_skip += 1
            continue

        # Ensure unique SKU (handle duplicates with suffix)
        sku = sku_raw
        if sku in existing_skus:
            sku_usage[sku_raw] = sku_usage.get(sku_raw, 1) + 1
            sku = f'{sku_raw}-{sku_usage[sku_raw]}'
            while sku in existing_skus:
                sku_usage[sku_raw] += 1
                sku = f'{sku_raw}-{sku_usage[sku_raw]}'
        else:
            sku_usage[sku_raw] = sku_usage.get(sku_raw, 0) + 1
        existing_skus.add(sku)

        new_id = gen_uuid()
        cur.execute("""
            INSERT INTO products
                (id, company_id, sku, name, category_id, unit, cost_price,
                 price_1, price_2, price_3, price_4, vat_rate, stock_min,
                 is_stock_tracked, is_sales_item, is_purchase_item, is_active)
            VALUES (%s,%s,%s,%s,%s,%s::unit_type,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            new_id, company_id, sku, name, cat_id, unit,
            round(cost, 3), round(p1, 3), round(p2, 3), round(p3, 3), round(p4, 3),
            vat_rate, round(stock_min, 3),
            tracked, is_sales, is_purch, not inactive,
        ))

        prod_map[si_id] = new_id
        imported += 1
        if inactive:
            inactive_skip += 1

        if imported % 500 == 0:
            print(f'\r→ Importing products...   {imported:>7,} so far', end='', flush=True)
            cur.connection.commit()

    print(
        f'\r→ Importing products...   {imported:>7,} imported '
        f'({type3_skip} system items skipped, {inactive_skip} inactive, {dup_skip} duplicate)'
    )
    return prod_map


# ── Import: Invoices ───────────────────────────────────────────────────────────

def import_invoices(cur, company_id, sales_root, items_root, cust_map):
    """
    Import invoice headers from Sale.xml.
    Compute subtotal/total_vat from SaleItem.xml aggregates.
    Returns dict: {si_id_str: uuid_str}
    """
    print('→ Importing invoices...', end='', flush=True)
    if sales_root is None:
        print('  SKIPPED')
        return {}

    # Pre-aggregate item totals by DocumentID so we don't have to scan items twice
    item_totals = {}   # si_doc_id → {'sub': float, 'vat': float}
    if items_root is not None:
        for el in items_root.findall('SaleItem'):
            doc_id = el.findtext('DocumentID')
            if not doc_id:
                continue
            t = item_totals.setdefault(doc_id, {'sub': 0.0, 'vat': 0.0})
            t['sub'] += flt(el.findtext('NetAmount'))
            t['vat'] += flt(el.findtext('TaxAmount'))

    inv_map  = {}
    imported = skipped = 0

    for el in sales_root.findall('Sale'):
        si_id      = el.findtext('ID')
        type_id    = el.findtext('TypeID') or '1'
        cust_si    = el.findtext('ContractorID')
        number     = (el.findtext('Number') or '').strip()
        amount     = flt(el.findtext('Amount'))
        issue_date = parse_date(el.findtext('IssueDate'))
        due_date   = parse_date(el.findtext('DueDate'))
        po_ref     = (el.findtext('PurchaseOrder') or '').strip() or None
        message    = (el.findtext('Message') or '').strip() or None
        add_notes  = (el.findtext('AdditionalNotes') or '').strip() or None

        if not si_id or not number or not cust_si:
            continue

        cust_id  = cust_map.get(cust_si)
        if not cust_id:
            skipped += 1
            continue

        inv_type = SALE_TYPE_MAP.get(type_id, 'tax_invoice')

        # Duplicate check
        cur.execute(
            "SELECT id FROM invoices WHERE company_id=%s AND invoice_no=%s",
            (company_id, number),
        )
        row = cur.fetchone()
        if row:
            inv_map[si_id] = str(row[0])
            skipped += 1
            continue

        # Totals from items; fall back to proportional split of grand_total
        totals   = item_totals.get(si_id, {})
        subtotal = totals.get('sub', 0.0)
        total_vat = totals.get('vat', 0.0)
        if subtotal == 0.0 and amount > 0:
            # No items: estimate from grand total (assume 10% VAT)
            subtotal  = round(amount / 1.1, 3)
            total_vat = round(amount - subtotal, 3)
        grand_total = amount if amount > 0 else round(subtotal + total_vat, 3)

        notes_parts = [x for x in [message, add_notes] if x]
        notes = '\n'.join(notes_parts) or None

        new_id = gen_uuid()
        cur.execute("""
            INSERT INTO invoices
                (id, company_id, invoice_no, type, customer_id,
                 invoice_date, due_date, po_reference,
                 subtotal, total_discount, total_vat, grand_total,
                 payment_status, notes)
            VALUES (%s,%s,%s,%s::invoice_type,%s,%s,%s,%s,%s,0,%s,%s,'unpaid',%s)
        """, (
            new_id, company_id, number, inv_type, cust_id,
            issue_date, due_date, po_ref,
            round(subtotal, 3), round(total_vat, 3), round(grand_total, 3),
            notes,
        ))

        inv_map[si_id] = new_id
        imported += 1

        if imported % 500 == 0:
            print(f'\r→ Importing invoices...   {imported:>7,} so far', end='', flush=True)
            cur.connection.commit()

    print(f'\r→ Importing invoices...   {imported:>7,} imported, {skipped} skipped')
    return inv_map


# ── Import: Invoice Items ──────────────────────────────────────────────────────

def import_invoice_items(cur, company_id, items_root, inv_map, prod_map):
    """
    Import SaleItem.xml.
    net_amount / vat_amount / line_total are GENERATED columns — do NOT insert them.
    """
    print('→ Importing invoice items...', end='', flush=True)
    if items_root is None:
        print('  SKIPPED')
        return

    imported = skipped = 0

    for el in items_root.findall('SaleItem'):
        doc_id   = el.findtext('DocumentID')
        prod_si  = el.findtext('ProductID')
        qty      = flt(el.findtext('Quantity'), 1.0)
        price    = flt(el.findtext('Amount'))       # unit price
        name     = (el.findtext('ProductName') or 'Item').strip()
        units    = el.findtext('Units') or 'pcs'
        discount = flt(el.findtext('Discount'))
        line_no  = int(flt(el.findtext('Index'), 0))
        # Derive actual VAT rate from SI's own TaxAmount/NetAmount.
        # TaxRateID=2 covered both 5% (pre-2022) and 10% (post-2022) as Bahrain
        # doubled its rate in Jan 2022 but kept the same rate ID — so we cannot
        # trust the TaxRates.xml Rate field for historical items.
        si_net   = flt(el.findtext('NetAmount'))
        si_tax   = flt(el.findtext('TaxAmount'))
        if si_net > 0:
            vat_rate = round(si_tax / si_net * 100, 2)
        else:
            vat_rate = 0.00

        inv_id = inv_map.get(doc_id)
        if not inv_id:
            skipped += 1
            continue

        prod_id  = prod_map.get(prod_si)   # may be None (free-text line)
        unit     = norm_unit(units)

        cur.execute("""
            INSERT INTO invoice_items
                (id, invoice_id, product_id, line_no, description,
                 qty, unit, unit_price, discount, vat_rate)
            VALUES (%s,%s,%s,%s,%s,%s,%s::unit_type,%s,%s,%s)
        """, (
            gen_uuid(), inv_id, prod_id, line_no, name[:500],
            round(qty, 3), unit, round(price, 6), round(discount * qty, 3), vat_rate,
        ))

        imported += 1
        if imported % 500 == 0:
            print(f'\r→ Importing invoice items... {imported:>8,} so far', end='', flush=True)
            cur.connection.commit()

    print(f'\r→ Importing invoice items... {imported:>8,} imported, {skipped} skipped')


# ── Import: Customer Payments ──────────────────────────────────────────────────

def import_payments(cur, company_id, pay_root, inv_map):
    """
    Import Payments.xml (customer payments).
    The trigger trg_invoice_payment_status fires on INSERT and auto-updates
    invoice.payment_status and invoice.amount_paid.
    """
    print('→ Importing payments...', end='', flush=True)
    if pay_root is None:
        print('  SKIPPED')
        return

    imported = skipped = 0

    for el in pay_root.findall('Payment'):
        doc_id   = el.findtext('DocumentID')
        amount   = flt(el.findtext('Amount'))
        pay_date = parse_date(el.findtext('PaymentDate'))
        note     = (el.findtext('Note') or '').strip() or None

        inv_id = inv_map.get(doc_id)
        if not inv_id or amount <= 0 or not pay_date:
            skipped += 1
            continue

        # Duplicate check
        cur.execute(
            """SELECT 1 FROM payments
               WHERE reference_type='invoice' AND reference_id=%s
                 AND payment_date=%s AND amount=%s""",
            (inv_id, pay_date, round(amount, 3)),
        )
        if cur.fetchone():
            skipped += 1
            continue

        cur.execute("""
            INSERT INTO payments
                (id, company_id, reference_type, reference_id,
                 payment_date, amount, method, notes)
            VALUES (%s,%s,'invoice',%s,%s,%s,'bank_transfer',%s)
        """, (gen_uuid(), company_id, inv_id, pay_date, round(amount, 3), note))

        imported += 1
        if imported % 500 == 0:
            print(f'\r→ Importing payments...   {imported:>7,} so far', end='', flush=True)
            cur.connection.commit()

    print(f'\r→ Importing payments...   {imported:>7,} imported, {skipped} skipped')


# ── Import: Purchases ──────────────────────────────────────────────────────────

def import_purchases(cur, company_id, pur_root, cust_map):
    """
    Import Purchase.xml headers.
    Totals are initially estimated; updated after purchase_items are inserted.
    Returns dict: {si_id_str: uuid_str}
    """
    print('→ Importing purchases...', end='', flush=True)
    if pur_root is None:
        print('  SKIPPED')
        return {}

    pur_map  = {}
    imported = skipped = 0

    for el in pur_root.findall('Purchase'):
        si_id    = el.findtext('ID')
        sup_si   = el.findtext('SupplierID')
        number   = (el.findtext('Number') or '').strip()
        amount   = flt(el.findtext('Amount'))
        pur_date = parse_date(el.findtext('PurchaseDate'))
        ref_no   = (el.findtext('ReferenceNumber') or '').strip() or None

        if not si_id or not sup_si or not number:
            continue

        sup_id = cust_map.get(sup_si)
        if not sup_id:
            skipped += 1
            continue

        # Duplicate check
        cur.execute(
            "SELECT id FROM purchases WHERE company_id=%s AND purchase_no=%s",
            (company_id, number),
        )
        row = cur.fetchone()
        if row:
            pur_map[si_id] = str(row[0])
            skipped += 1
            continue

        # Estimate subtotal/vat from grand_total (actual values updated after items)
        grand_total = amount
        subtotal    = round(grand_total / 1.1, 3)
        total_vat   = round(grand_total - subtotal, 3)

        new_id = gen_uuid()
        cur.execute("""
            INSERT INTO purchases
                (id, company_id, purchase_no, supplier_id, supplier_invoice_no,
                 purchase_date, subtotal, total_vat, grand_total, payment_status)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'unpaid')
        """, (
            new_id, company_id, number, sup_id, ref_no,
            pur_date, subtotal, total_vat, round(grand_total, 3),
        ))

        pur_map[si_id] = new_id
        imported += 1

        if imported % 500 == 0:
            print(f'\r→ Importing purchases...  {imported:>7,} so far', end='', flush=True)
            cur.connection.commit()

    print(f'\r→ Importing purchases...  {imported:>7,} imported, {skipped} skipped')
    return pur_map


# ── Import: Purchase Items ─────────────────────────────────────────────────────

def import_purchase_items(cur, company_id, items_root, pur_map, prod_map, fast_mode=False):
    """
    Import PurchaseItem.xml.
    In normal mode: the trigger trg_purchase_stock_in fires per row, inserting
    a stock_movement and updating stock_qty. This is correct but slow for large imports.
    In fast mode (triggers disabled): stock movements are inserted separately in bulk.
    After insertion, purchase header totals are updated from actual computed columns.
    """
    print('→ Importing purchase items...', end='', flush=True)
    if items_root is None:
        print('  SKIPPED')
        return

    imported = skipped = 0

    for el in items_root.findall('PurchaseItem'):
        pur_si  = el.findtext('PurchaseID')
        prod_si = el.findtext('ProductID')
        qty     = flt(el.findtext('Quantity'), 1.0)
        price   = flt(el.findtext('Amount'))    # unit price
        name    = (el.findtext('ProductName') or 'Item').strip()
        units   = el.findtext('Units') or 'pcs'
        line_no = int(flt(el.findtext('Index'), 0))
        # Derive actual VAT rate from SI's own TaxAmount/NetAmount.
        # TaxRateID=2 covered both 5% (pre-2022) and 10% (post-2022) as Bahrain
        # doubled its rate in Jan 2022 but kept the same rate ID.
        si_net  = flt(el.findtext('NetAmount'))
        si_tax  = flt(el.findtext('TaxAmount'))
        if si_net > 0:
            vat_rate = round(si_tax / si_net * 100, 2)
        else:
            vat_rate = 0.00

        pur_id = pur_map.get(pur_si)
        if not pur_id:
            skipped += 1
            continue

        prod_id  = prod_map.get(prod_si)   # may be None
        unit     = norm_unit(units)

        cur.execute("""
            INSERT INTO purchase_items
                (id, purchase_id, product_id, line_no, description,
                 qty, unit, unit_price, vat_rate)
            VALUES (%s,%s,%s,%s,%s,%s,%s::unit_type,%s,%s)
        """, (
            gen_uuid(), pur_id, prod_id, line_no, name[:500],
            round(qty, 3), unit, round(price, 6), vat_rate,
        ))

        imported += 1
        if imported % 500 == 0:
            print(f'\r→ Importing purchase items... {imported:>8,} so far', end='', flush=True)
            cur.connection.commit()

    print(f'\r→ Importing purchase items... {imported:>8,} imported, {skipped} skipped')

    # Update purchase header totals from generated columns (accurate after items inserted)
    print('  Updating purchase totals from items...', end='', flush=True)
    cur.execute("""
        UPDATE purchases p SET
            subtotal    = COALESCE((SELECT SUM(net_amount)  FROM purchase_items pi WHERE pi.purchase_id = p.id), 0),
            total_vat   = COALESCE((SELECT SUM(vat_amount)  FROM purchase_items pi WHERE pi.purchase_id = p.id), 0),
            grand_total = COALESCE((SELECT SUM(line_total)  FROM purchase_items pi WHERE pi.purchase_id = p.id), 0)
        WHERE p.company_id = %s
    """, (company_id,))
    print(f' {cur.rowcount:,} purchases updated')


# ── Import: Purchase Payments ──────────────────────────────────────────────────

def import_purchase_payments(cur, company_id, pay_root, pur_map):
    """
    Import PurchasePayment.xml.
    No trigger exists for purchase payments — we manually update payment_status.
    """
    print('→ Importing purch. payments...', end='', flush=True)
    if pay_root is None:
        print('  SKIPPED')
        return

    imported = skipped = 0
    pur_paid = {}   # pur_id → total amount paid

    for el in pay_root.findall('PurchasePayment'):
        pur_si   = el.findtext('PurchaseID')
        amount   = flt(el.findtext('Amount'))
        pay_date = parse_date(el.findtext('PaymentDate'))
        note     = (el.findtext('Note') or '').strip() or None

        pur_id = pur_map.get(pur_si)
        if not pur_id or amount <= 0 or not pay_date:
            skipped += 1
            continue

        # Duplicate check
        cur.execute(
            """SELECT 1 FROM payments
               WHERE reference_type='purchase' AND reference_id=%s
                 AND payment_date=%s AND amount=%s""",
            (pur_id, pay_date, round(amount, 3)),
        )
        if cur.fetchone():
            skipped += 1
            continue

        cur.execute("""
            INSERT INTO payments
                (id, company_id, reference_type, reference_id,
                 payment_date, amount, method, notes)
            VALUES (%s,%s,'purchase',%s,%s,%s,'bank_transfer',%s)
        """, (gen_uuid(), company_id, pur_id, pay_date, round(amount, 3), note))

        pur_paid[pur_id] = pur_paid.get(pur_id, 0.0) + amount
        imported += 1

        if imported % 500 == 0:
            print(f'\r→ Importing purch. payments... {imported:>8,} so far', end='', flush=True)
            cur.connection.commit()

    print(f'\r→ Importing purch. payments... {imported:>8,} imported, {skipped} skipped')

    # Manually update purchase payment_status (no trigger for purchases)
    if pur_paid:
        print('  Updating purchase payment statuses...', end='', flush=True)
        updated = 0
        for pur_id, paid in pur_paid.items():
            cur.execute("SELECT grand_total FROM purchases WHERE id=%s", (pur_id,))
            row = cur.fetchone()
            if not row:
                continue
            grand   = float(row[0])
            balance = grand - paid
            status  = 'paid' if balance <= 0.001 else ('partial' if paid > 0 else 'unpaid')
            cur.execute(
                "UPDATE purchases SET amount_paid=%s, payment_status=%s::payment_status WHERE id=%s",
                (round(paid, 3), status, pur_id),
            )
            updated += 1
        print(f' {updated:,} updated')


# ── Import: Expenses ───────────────────────────────────────────────────────────

def import_expenses(cur, company_id, exp_root, cat_map):
    """Import Expenses.xml, generating expense_no sequentially."""
    print('→ Importing expenses...', end='', flush=True)
    if exp_root is None:
        print('  SKIPPED')
        return

    # Find starting sequence number
    cur.execute(
        "SELECT expense_no FROM expenses WHERE company_id=%s AND expense_no LIKE 'IMP-EXP-%%' ORDER BY expense_no DESC LIMIT 1",
        (company_id,),
    )
    row = cur.fetchone()
    exp_seq = int(row[0].split('-')[-1]) if row else 0

    imported = skipped = 0

    for el in exp_root.findall('Expense'):
        cat_si   = el.findtext('CategoryID') or ''
        exp_date = parse_date(el.findtext('Date'))
        subtotal = flt(el.findtext('Subtotal'))
        total    = flt(el.findtext('Total'))
        tax_amt  = flt(el.findtext('TaxAmount'))
        desc     = (el.findtext('Description') or '').strip()

        if not desc or not exp_date:
            continue

        net_amt = subtotal if subtotal > 0 else total - tax_amt
        cat_id  = cat_map.get(cat_si)

        # Duplicate check
        cur.execute(
            """SELECT 1 FROM expenses
               WHERE company_id=%s AND expense_date=%s
                 AND LOWER(description)=%s AND net_amount=%s""",
            (company_id, exp_date, desc.lower(), round(net_amt, 3)),
        )
        if cur.fetchone():
            skipped += 1
            continue

        exp_seq += 1
        exp_no = f'IMP-EXP-{exp_seq:04d}'

        cur.execute("""
            INSERT INTO expenses
                (id, company_id, expense_no, category_id, expense_date,
                 description, net_amount, vat_amount, total_amount)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (
            gen_uuid(), company_id, exp_no, cat_id, exp_date,
            desc[:300], round(net_amt, 3), round(tax_amt, 3), round(total, 3),
        ))
        imported += 1

    print(f'  {imported:>6,} imported, {skipped} skipped')


# ── Post-import fixes ──────────────────────────────────────────────────────────

def fix_overdue_invoices(cur, company_id):
    """Mark unpaid invoices with past due dates as overdue."""
    print('  Marking overdue invoices...', end='', flush=True)
    cur.execute("""
        UPDATE invoices
        SET    payment_status = 'overdue', updated_at = now()
        WHERE  company_id = %s
          AND  payment_status = 'unpaid'
          AND  due_date IS NOT NULL
          AND  due_date < CURRENT_DATE
    """, (company_id,))
    print(f' {cur.rowcount:,} marked overdue')


def recalculate_invoice_totals(cur, company_id):
    """Recompute invoice subtotal/total_discount/total_vat from actual invoice_items.
    grand_total is intentionally left as-is (authoritative value from SI's Amount field).
    """
    print('  Recalculating invoice totals...', end='', flush=True)
    cur.execute("""
        UPDATE invoices i SET
            subtotal       = COALESCE((SELECT SUM(net_amount)  FROM invoice_items ii WHERE ii.invoice_id = i.id), 0),
            total_discount = COALESCE((SELECT SUM(discount)    FROM invoice_items ii WHERE ii.invoice_id = i.id), 0),
            total_vat      = COALESCE((SELECT SUM(vat_amount)  FROM invoice_items ii WHERE ii.invoice_id = i.id), 0),
            updated_at     = now()
        WHERE i.company_id = %s
    """, (company_id,))
    print(f' {cur.rowcount:,} updated')


def insert_bulk_stock_movements(cur, company_id):
    """
    In fast mode (triggers disabled during import), manually insert stock movements
    for all purchase items and recalculate product stock quantities.
    """
    print('  Inserting stock movements (bulk)...', end='', flush=True)
    cur.execute("""
        INSERT INTO stock_movements
            (id, company_id, product_id, movement_type, qty, ref_type, ref_id, ref_no)
        SELECT
            gen_random_uuid(),
            p.company_id,
            pi.product_id,
            'purchase_in',
            pi.qty,
            'purchase',
            p.id,
            p.purchase_no
        FROM   purchase_items pi
        JOIN   purchases p ON p.id = pi.purchase_id
        WHERE  p.company_id = %s
          AND  pi.product_id IS NOT NULL
          AND  NOT EXISTS (
                   SELECT 1 FROM stock_movements sm
                   WHERE  sm.ref_type = 'purchase'
                     AND  sm.ref_id   = p.id
                     AND  sm.product_id = pi.product_id
               )
    """, (company_id,))
    print(f' {cur.rowcount:,} movements inserted')

    print('  Recalculating stock quantities...', end='', flush=True)
    cur.execute("""
        UPDATE products p SET
            stock_qty  = COALESCE((SELECT SUM(qty) FROM stock_movements sm WHERE sm.product_id = p.id), 0),
            updated_at = now()
        WHERE p.company_id = %s
    """, (company_id,))
    print(f' {cur.rowcount:,} products updated')


def update_invoice_payment_status_bulk(cur, company_id):
    """
    In fast mode (trigger was disabled during payment inserts), recompute
    invoice payment statuses from the payments table.
    """
    print('  Recomputing invoice payment statuses...', end='', flush=True)
    cur.execute("""
        UPDATE invoices i SET
            amount_paid = COALESCE(
                (SELECT SUM(amount) FROM payments WHERE reference_type='invoice' AND reference_id=i.id),
                0
            ),
            payment_status = CASE
                WHEN i.grand_total <= COALESCE(
                    (SELECT SUM(amount) FROM payments WHERE reference_type='invoice' AND reference_id=i.id), 0)
                    THEN 'paid'::invoice_status
                WHEN COALESCE(
                    (SELECT SUM(amount) FROM payments WHERE reference_type='invoice' AND reference_id=i.id), 0) > 0
                    THEN 'partial'::invoice_status
                WHEN i.due_date IS NOT NULL AND i.due_date < CURRENT_DATE
                    THEN 'overdue'::invoice_status
                ELSE 'unpaid'::invoice_status
            END,
            updated_at = now()
        WHERE i.company_id = %s
    """, (company_id,))
    print(f' {cur.rowcount:,} invoices updated')


# ── Summary ────────────────────────────────────────────────────────────────────

def print_summary(cur, company_id):
    """Print record counts for all imported tables."""
    print('\n── Import Summary ──────────────────────────────────────────')

    queries = [
        ('categories',      "SELECT COUNT(*) FROM categories   WHERE company_id=%s"),
        ('customers',       "SELECT COUNT(*) FROM customers    WHERE company_id=%s AND type != 'supplier'"),
        ('suppliers',       "SELECT COUNT(*) FROM customers    WHERE company_id=%s AND type = 'supplier'"),
        ('products',        "SELECT COUNT(*) FROM products     WHERE company_id=%s"),
        ('invoices',        "SELECT COUNT(*) FROM invoices     WHERE company_id=%s"),
        ('invoice_items',   "SELECT COUNT(*) FROM invoice_items ii JOIN invoices i ON i.id=ii.invoice_id WHERE i.company_id=%s"),
        ('payments',        "SELECT COUNT(*) FROM payments     WHERE company_id=%s AND reference_type='invoice'"),
        ('purchases',       "SELECT COUNT(*) FROM purchases    WHERE company_id=%s"),
        ('purchase_items',  "SELECT COUNT(*) FROM purchase_items pi JOIN purchases p ON p.id=pi.purchase_id WHERE p.company_id=%s"),
        ('pur. payments',   "SELECT COUNT(*) FROM payments     WHERE company_id=%s AND reference_type='purchase'"),
        ('expenses',        "SELECT COUNT(*) FROM expenses     WHERE company_id=%s"),
        ('stock movements', "SELECT COUNT(*) FROM stock_movements WHERE company_id=%s"),
    ]

    total = 0
    for label, sql in queries:
        cur.execute(sql, (company_id,))
        n = cur.fetchone()[0]
        total += n
        print(f'  {label:<20}: {n:>10,}')

    print(f'  {"─"*32}')
    print(f'  {"TOTAL":<20}: {total:>10,}')
    print()

    # Financial verification
    cur.execute("""
        SELECT
            SUM(grand_total) FILTER (WHERE type='tax_invoice')  AS invoiced,
            SUM(grand_total - amount_paid) FILTER (WHERE type='tax_invoice' AND payment_status NOT IN ('paid','void')) AS receivable,
            SUM(grand_total) AS total_purchased
        FROM invoices WHERE company_id=%s AND type='tax_invoice'
    """, (company_id,))
    r = cur.fetchone()
    if r and r[0]:
        print(f'  Total invoiced (tax invoices) : BHD {float(r[0]):>14,.3f}')
        print(f'  Outstanding receivables       : BHD {float(r[1] or 0):>14,.3f}')

    cur.execute("SELECT SUM(grand_total), SUM(grand_total - amount_paid) FILTER (WHERE payment_status != 'paid') FROM purchases WHERE company_id=%s", (company_id,))
    r = cur.fetchone()
    if r and r[0]:
        print(f'  Total purchased               : BHD {float(r[0]):>14,.3f}')
        print(f'  Outstanding payables          : BHD {float(r[1] or 0):>14,.3f}')

    cur.execute("SELECT SUM(total_amount), SUM(vat_amount) FROM expenses WHERE company_id=%s", (company_id,))
    r = cur.fetchone()
    if r and r[0]:
        print(f'  Total expenses                : BHD {float(r[0]):>14,.3f}  (VAT: {float(r[1] or 0):.3f})')
    print()


# ── Dry-run ────────────────────────────────────────────────────────────────────

def dry_run(data):
    """Print XML record counts without touching the database."""
    print('\n── Dry Run — XML Record Counts ─────────────────────────────')
    tag_names = {
        'categories': 'Category', 'contractors': 'Contractor',
        'products': 'Product', 'suppliers': 'Supplier',
        'sales': 'Sale', 'sale_items': 'SaleItem',
        'payments': 'Payment', 'purchases': 'Purchase',
        'purchase_items': 'PurchaseItem', 'purchase_payments': 'PurchasePayment',
        'expenses': 'Expense',
    }
    total = 0
    for key, tag in tag_names.items():
        root = data.get(key)
        if root is None:
            print(f'  {key:<22}: (not found)')
        else:
            n = len(root.findall(tag))
            total += n
            print(f'  {key:<22}: {n:>10,}')
    print(f'  {"─"*34}')
    print(f'  {"TOTAL":<22}: {total:>10,}')
    print('\nDry run complete — no data was imported.')


# ── Main ───────────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(
        description='Import a Simple Invoice backup (.zip) into ElecTrade Pro',
    )
    p.add_argument('--bak', required=True, metavar='FILE',
                   help='Path to sinvoice_bak.zip')
    p.add_argument('--company-id', metavar='UUID',
                   help='Target company UUID (defaults to first company in DB)')
    p.add_argument('--dry-run', action='store_true',
                   help='Parse XML and print counts without importing')
    p.add_argument('--fast', action='store_true',
                   help='Disable DB triggers during import for speed '
                        '(stock movements and statuses rebuilt afterward). '
                        'Requires DB superuser or table owner.')
    return p.parse_args()


def main():
    args = parse_args()

    if not os.path.exists(args.bak):
        print(f'ERROR: File not found: {args.bak}')
        sys.exit(1)

    # Load all XML
    data = load_xml_data(args.bak)
    print()

    if args.dry_run:
        dry_run(data)
        return

    # Connect to database
    print('Connecting to database...', end='', flush=True)
    try:
        conn = connect_db()
    except Exception as e:
        print(f'\nERROR: Cannot connect to database: {e}')
        sys.exit(1)
    print(' OK')

    cur = conn.cursor()

    # Resolve company
    if args.company_id:
        cur.execute("SELECT name FROM companies WHERE id=%s", (args.company_id,))
        row = cur.fetchone()
        if not row:
            print(f'ERROR: Company {args.company_id} not found in database')
            sys.exit(1)
        company_id   = args.company_id
        company_name = row[0]
    else:
        cur.execute("SELECT id, name FROM companies LIMIT 1")
        row = cur.fetchone()
        if not row:
            print('ERROR: No companies found in the database. Run the seed script first.')
            sys.exit(1)
        company_id, company_name = str(row[0]), row[1]

    print(f'Target company : {company_name}')
    print(f'Company ID     : {company_id}')
    if args.fast:
        print('Mode           : FAST (triggers disabled during import)')
    print()

    try:
        if args.fast:
            print('  Disabling DB triggers (session_replication_role = replica)...')
            cur.execute("SET session_replication_role = 'replica'")

        # ── 1. Categories ──────────────────────────────────────────────
        cat_map = import_categories(cur, company_id, data['categories'])
        conn.commit()

        # ── 2. Customers / Suppliers ───────────────────────────────────
        cust_map = import_customers(cur, company_id, data['contractors'])
        conn.commit()

        # ── 3. Products ────────────────────────────────────────────────
        prod_map = import_products(cur, company_id, data['products'], data['suppliers'], cat_map)
        conn.commit()

        # ── 4. Invoice headers ─────────────────────────────────────────
        inv_map = import_invoices(cur, company_id, data['sales'], data['sale_items'], cust_map)
        conn.commit()

        # ── 5. Invoice line items ──────────────────────────────────────
        import_invoice_items(cur, company_id, data['sale_items'], inv_map, prod_map)
        conn.commit()

        # ── 6. Customer payments ───────────────────────────────────────
        import_payments(cur, company_id, data['payments'], inv_map)
        conn.commit()

        # ── 7. Purchase headers ────────────────────────────────────────
        pur_map = import_purchases(cur, company_id, data['purchases'], cust_map)
        conn.commit()

        # ── 8. Purchase line items ─────────────────────────────────────
        import_purchase_items(cur, company_id, data['purchase_items'], pur_map, prod_map,
                              fast_mode=args.fast)
        conn.commit()

        # ── 9. Purchase payments ───────────────────────────────────────
        import_purchase_payments(cur, company_id, data['purchase_payments'], pur_map)
        conn.commit()

        # ── 10. Expenses ───────────────────────────────────────────────
        import_expenses(cur, company_id, data['expenses'], cat_map)
        conn.commit()

        # ── Post-import reconciliation ─────────────────────────────────
        print('\n── Post-import reconciliation ──────────────────────────────')

        if args.fast:
            # Re-enable triggers before reconciliation
            print('  Re-enabling DB triggers...')
            cur.execute("SET session_replication_role = 'origin'")

            # Rebuild everything that triggers would have handled
            insert_bulk_stock_movements(cur, company_id)
            conn.commit()

            update_invoice_payment_status_bulk(cur, company_id)
            conn.commit()

        recalculate_invoice_totals(cur, company_id)
        conn.commit()

        fix_overdue_invoices(cur, company_id)
        conn.commit()

        print('\n✓ Import complete!')
        print_summary(cur, company_id)

    except Exception as e:
        conn.rollback()
        print(f'\n\n✗ Import FAILED: {e}')
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        cur.close()
        conn.close()


if __name__ == '__main__':
    main()
