#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Development helper: clear all data → import SI backup → verify AR/AP.
One command replaces the manual clear-in-UI + upload + eyeball cycle.

Usage:
    py dev_reimport.py
    py dev_reimport.py --bak C:/path/to/sinvoice.bak.zip
    py dev_reimport.py --url http://localhost --email admin@... --password ...
    py dev_reimport.py --skip-import   # verify only (no clear/import)
    py dev_reimport.py --skip-verify   # import only (no post-check)
"""

import sys, io, os, argparse, time
from pathlib import Path

if sys.stdout.encoding and sys.stdout.encoding.lower() != 'utf-8':
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8', errors='replace')

try:
    import requests
except ImportError:
    print("ERROR: pip install requests"); sys.exit(1)

BAK_DEFAULT   = str(Path(__file__).parent.parent.parent / 'sinvoice.bak.zip')
API_DEFAULT   = 'http://localhost'
EMAIL_DEFAULT = 'admin@company.com'
PASS_DEFAULT  = 'Admin@1234'

BOLD  = '\033[1m'
GREEN = '\033[92m'
RED   = '\033[91m'
YEL   = '\033[93m'
RST   = '\033[0m'

def step(msg):
    print(f'\n{BOLD}▶ {msg}{RST}')

def ok(msg):
    print(f'{GREEN}  ✓ {msg}{RST}')

def fail(msg):
    print(f'{RED}  ✗ {msg}{RST}')

def warn(msg):
    print(f'{YEL}  ⚠ {msg}{RST}')

# ── API helpers ───────────────────────────────────────────────────────────────
def login(base_url, email, password):
    step(f'Authenticating as {email}')
    r = requests.post(f'{base_url}/api/v1/auth/login',
                      json={'email': email, 'password': password}, timeout=15)
    if r.status_code != 200:
        fail(f'Login failed: {r.status_code} {r.text[:200]}'); sys.exit(1)
    token = r.json().get('data', {}).get('token') or r.json().get('token')
    if not token:
        fail(f'No token in response: {r.text[:200]}'); sys.exit(1)
    ok('Authenticated')
    return token

def clear_data(base_url, token):
    step('Clearing all business data')
    r = requests.post(f'{base_url}/api/v1/admin/clear',
                      headers={'Authorization': f'Bearer {token}'}, timeout=120)
    if r.status_code != 200:
        fail(f'Clear failed: {r.status_code} {r.text[:300]}'); sys.exit(1)
    ok(r.json().get('message', 'Cleared'))

def upload_import(base_url, token, bak_path):
    step(f'Uploading {Path(bak_path).name} for import')
    size_mb = Path(bak_path).stat().st_size / 1_048_576
    print(f'  File size: {size_mb:.1f} MB')

    t0 = time.time()
    with open(bak_path, 'rb') as f:
        r = requests.post(
            f'{base_url}/api/v1/admin/import-sinvoice',
            headers={'Authorization': f'Bearer {token}'},
            files={'backup': (Path(bak_path).name, f, 'application/zip')},
            timeout=600,   # large imports can take several minutes
        )
    elapsed = time.time() - t0

    if r.status_code != 200:
        fail(f'Import failed: HTTP {r.status_code}')
        fail(r.text[:400] if r.text else '(empty response — possible nginx timeout)')
        sys.exit(1)

    try:
        data = r.json().get('data', {})
    except Exception:
        # Empty or non-JSON body despite 200 — treat as success with no summary
        warn(f'Response was not JSON (status={r.status_code}), assuming success')
        data = {}
    ok(f'Import completed in {elapsed:.1f}s')
    # Print summary if available
    for key in ('invoices','purchases','products','customers','delivery_notes'):
        if key in data:
            print(f'    {key}: {data[key]:,}')
    return data

def get_db_status(base_url, token):
    r = requests.get(f'{base_url}/api/v1/admin/status',
                     headers={'Authorization': f'Bearer {token}'}, timeout=10)
    if r.status_code == 200:
        return r.json().get('data', {})
    return {}

# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description='Dev reimport: clear → import SI → verify')
    ap.add_argument('--bak',          default=BAK_DEFAULT)
    ap.add_argument('--url',          default=API_DEFAULT)
    ap.add_argument('--email',        default=EMAIL_DEFAULT)
    ap.add_argument('--password',     default=PASS_DEFAULT)
    ap.add_argument('--skip-import',  action='store_true', help='Skip clear+import, verify only')
    ap.add_argument('--skip-verify',  action='store_true', help='Skip post-import verification')
    ap.add_argument('--verbose',      action='store_true', help='Pass --verbose to verify_import')
    args = ap.parse_args()

    if not args.skip_import and not Path(args.bak).exists():
        fail(f'Backup file not found: {args.bak}')
        fail('Set --bak or place sinvoice.bak.zip in the project root.')
        sys.exit(1)

    print(f'\n{BOLD}{"═"*60}{RST}')
    print(f'{BOLD}  ElecTrade Dev Reimport{RST}')
    print(f'{BOLD}{"═"*60}{RST}')

    token = login(args.url, args.email, args.password)

    if not args.skip_import:
        clear_data(args.url, token)
        upload_import(args.url, token, args.bak)
    else:
        warn('Skipping clear + import (--skip-import)')

    if not args.skip_verify:
        step('Running post-import verification')
        verify_script = Path(__file__).parent / 'verify_import.py'
        extra = ['--verbose'] if args.verbose else []
        # Re-run verify_import as subprocess so its output streams naturally
        import subprocess
        result = subprocess.run(
            [sys.executable, str(verify_script), '--bak', args.bak] + extra,
            check=False
        )
        if result.returncode != 0:
            print(f'\n{RED}{BOLD}  Verification FAILED — see mismatch details above.{RST}')
            print(f'  Re-run with --verbose for per-invoice breakdown.')
            sys.exit(1)
        else:
            print(f'\n{GREEN}{BOLD}  All checks passed.{RST}')
    else:
        warn('Skipping verification (--skip-verify)')

    # Show final DB counts
    step('Final DB record counts')
    status = get_db_status(args.url, token)
    for k, v in status.items():
        print(f'  {k:<20} {v:>8,}')

    print(f'\n{BOLD}{"═"*60}{RST}')
    print(f'{GREEN}{BOLD}  Done.{RST}')
    print(f'{BOLD}{"═"*60}{RST}\n')

if __name__ == '__main__':
    main()
