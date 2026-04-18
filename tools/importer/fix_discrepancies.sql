-- Auto-generated reconciliation payments
-- 477 invoices: paid in SI, pending in ElecTrade
-- Total adjustment: BHD 364.190

BEGIN;

-- INV/2020/1061  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '611ddaf8-1790-4b37-af29-42dabed5f52d';

-- INV/2020/1083  |  GOLDEN LIGHT CO. W.L.L  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7b9f06e7-cc37-4939-87ce-44d37ac6f823';

-- INV/2020/1088  |  EBRAHIM KHALIL KANOO CO. B.S.C (CLOSED)  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0b55a559-0860-436d-b1de-44bb5c0a5348';

-- INV/2020/1095  |  GOLDEN LIGHT CO. W.L.L  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd9ad594b-ae62-4393-83f0-9683a3c5bbfc';

-- INV/2020/1122  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '66635b59-2c2a-47de-9181-d632617f4d10';

-- INV/2020/1154  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b1f0acbb-d742-4cf0-ac9a-2d0ab2b76afe';

-- INV/2020/1160  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6076758c-7941-40db-9e7a-ee6803d51369';

-- INV/2020/1162  |  CASH MEMO  |  balance=0.011  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a4461807-ed00-4a9f-ba55-8b1a902f79f3';

-- INV/2020/1170  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7576e4ea-b9c3-4f44-9f18-bb4cd6ef08ec';

-- INV/2020/1171  |  CENTURY TRADING HOUSE CO. W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2824b2c6-fa83-4c4c-8302-c590d3b8bad9';

-- INV/2020/1185  |  CASH MEMO  |  balance=0.022  diff=+0.022
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c40eef61-731f-48fa-bcd4-681415895f15';

-- INV/2020/1197  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '530a0e9c-1c32-49fb-b089-39d9a3db3bf0';

-- INV/2020/120  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0e184fc5-f5d5-407a-a05c-a3379a76c803';

-- INV/2020/1206  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '766c4724-2fa8-4fea-bc9e-bbbe990529e9';

-- INV/2020/125  |  CASH MEMO  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ce10f1df-0738-46d5-99df-a45b98075e6f';

-- INV/2020/1276  |  CASH CUSTOMER  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '885f828f-4ca4-475c-94fc-1c35d7179ca5';

-- INV/2020/1317  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6dc5291e-9b72-488a-9d18-961fe1d57043';

-- INV/2020/1329  |  EVER FINE TRADING W.L.L  |  balance=5.429  diff=+5.429
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e2e3c7fd-93c3-408b-8f59-35e86821e0bb';

-- INV/2020/1383  |  CASH MEMO  |  balance=0.015  diff=+0.015
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '66aa12fa-0fce-4175-8f21-62775474e1cf';

-- INV/2020/1387  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'cb3855e7-9395-4e5d-a403-34903d39f23d';

-- INV/2020/1416  |  CASH MEMO  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f5847cfa-00a2-4694-91d5-2c5f9c94854a';

-- INV/2020/1440  |  MR. NABEEL DAWANI  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'daf07cd6-0ad8-46e9-8fa4-7172dfa8372f';

-- INV/2020/1499  |  CASH MEMO  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a6e4c42e-38ab-4708-8cd5-a26b50e26187';

-- INV/2020/1548  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '30a74529-3b82-4aaf-aff7-41264aadbc6a';

-- INV/2020/1562  |  CASH MEMO  |  balance=0.019  diff=+0.019
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '09c0dc1b-da23-47bf-86d0-e480f56908b6';

-- INV/2020/1567  |  CASH MEMO  |  balance=0.150  diff=+0.150
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1cbd4018-7973-48a7-a872-74ea19c8e5fc';

-- INV/2020/1570  |  MIDDLE EAST COMPUTER SERVICE (MECOS)  |  balance=0.053  diff=+0.052
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '59370177-befe-4330-9f3d-ba7b20bfb0bb';

-- INV/2020/1573  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0f207545-9ee0-4c27-9c6d-5d614a38013c';

-- INV/2020/1578  |  MAP RENTAL EQUIPMENTS W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '46668210-0c1d-40b0-8f67-1e1845f331da';

-- INV/2020/1596  |  BACK BONE MEDICAL EQUIPMENTS  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '107adde7-ffd2-4e67-b518-6fcb7dcdf6c8';

-- INV/2020/164  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '87167fc8-6f1a-420d-8d2b-87a05f504bca';

-- INV/2020/2  |  KANOO MOTORS S.P.C  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '47f2b7a6-53d3-4eb7-88ea-4f7903ee0b92';

-- INV/2020/207  |  CASH MEMO  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c33b6762-9e46-465a-8019-9c697320b3e8';

-- INV/2020/220  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd0073471-5eff-463d-867f-ee253408a119';

-- INV/2020/238  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '16865f7f-fafe-48ea-b776-17a655f2c239';

-- INV/2020/277  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'caaa4b82-7ecb-4854-93b2-7cf1d48893bd';

-- INV/2020/280  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd3a11d37-fdf6-409d-8f9c-6758b1afa0cd';

-- INV/2020/299  |  TRAVENCORE LIGHTS & ELECTRICALS CO. W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5d8b6850-ee3a-4bdf-a63d-8e8f4bc7fff3';

-- INV/2020/301  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '634bfb9e-8520-41df-bd6a-cc88ef632e76';

-- INV/2020/313  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0a13d9f6-ed7d-48dc-9c17-0868c524b57a';

-- INV/2020/330  |  CASH MEMO  |  balance=0.034  diff=+0.034
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ebaf9abd-df1b-47c7-8c11-18941c5682e6';

-- INV/2020/331  |  CASH MEMO  |  balance=0.050  diff=+0.050
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0db2e6dc-b037-4215-bd6e-aac9ca4d766d';

-- INV/2020/334  |  CASH MEMO  |  balance=0.053  diff=+0.053
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5ee39465-1e8d-4b53-a0ea-1a879d2e7d8c';

-- INV/2020/347  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd8664aa6-ce93-4f20-8de0-852dd977d3f6';

-- INV/2020/361  |  CASH MEMO  |  balance=0.038  diff=+0.038
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '632b629e-6d34-481d-bf44-16ae4b3be242';

-- INV/2020/377  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'cf96498f-21fd-4e45-a582-4622d68ca9d9';

-- INV/2020/42  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bc90c551-52d3-485f-8ae9-b515b9591723';

-- INV/2020/474  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9053b109-d550-41e7-a2ed-51b578be54ca';

-- INV/2020/498  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a59cc1d9-f7a7-45b4-ad14-b8966bd55c56';

-- INV/2020/523  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9d770437-1bf6-406e-9f29-4008b8fe7736';

-- INV/2020/538  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1873a289-55ac-4118-8e31-af215475dd4f';

-- INV/2020/549  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '045e913b-b7bc-4a5a-8359-6f3e82a227c8';

-- INV/2020/561  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7bc931de-75a7-4cd5-a7da-3ed95bac49fb';

-- INV/2020/572  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7cd5a4b4-b015-46fc-8876-88625b5f47ca';

-- INV/2020/574  |  CASH MEMO  |  balance=0.599  diff=+0.599
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '34219b74-e709-4058-8c19-3c99a92e5073';

-- INV/2020/575  |  CASH MEMO  |  balance=0.105  diff=+0.105
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5f2a84d4-4d48-434e-8cdd-08e32921dc02';

-- INV/2020/576  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2fefcf18-7c3d-46e5-8f24-cad8ba6c8f76';

-- INV/2020/589  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd1714e49-3823-4f3e-951a-deff766b530f';

-- INV/2020/591  |  EVER FINE TRADING W.L.L  |  balance=0.527  diff=+0.526
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd087fa8a-2dea-4b30-8425-978520316941';

-- INV/2020/606  |  ALBARAKA EXHIBITION  |  balance=28.350  diff=+28.350
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '79afee16-28f6-4a04-b644-b5aed8c9b1ac';

-- INV/2020/617  |  ALBARAKA EXHIBITION  |  balance=13.494  diff=+13.494
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '83a03611-1269-4e59-8d77-0930c3ab6ad3';

-- INV/2020/624  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'efb8eeb7-30d1-488f-857d-a7faf734efb2';

-- INV/2020/629  |  AL SUQAYYA RESTAURANT  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3b94fff0-ec31-4202-8dfa-535d4d748104';

-- INV/2020/643  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '80d41afa-94ca-4278-ad7c-82f2b839aa76';

-- INV/2020/676  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8d96b5a5-31fa-4b4b-8726-d52e7eefa918';

-- INV/2020/697  |  EBRAHIM KHALIL KANOO CO. B.S.C (CLOSED)  |  balance=0.900  diff=+0.900
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2a9c7e6b-f2f5-44c1-9fa0-495057b4c1ca';

-- INV/2020/7  |  EBRAHIM KHALIL KANOO CO. B.S.C (CLOSED)  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '27ca0c7a-9446-45b7-9426-b649cc3ef49a';

-- INV/2020/754  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '634e36dc-df3e-4a64-9cbc-645075489609';

-- INV/2020/771  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bc373dd0-74cc-4c0e-b823-927b00379bf9';

-- INV/2020/78  |  EBRAHIM KHALIL KANOO CO. B.S.C (CLOSED)  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd4e7e934-96be-4499-90d8-d136e2d12783';

-- INV/2020/782  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '56d9e3fd-d903-4eff-910f-4beb98a2182c';

-- INV/2020/791  |  CASH MEMO  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f215e715-deae-4327-9a28-09dcc43fb673';

-- INV/2020/798  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7f3b48fd-8fb7-4509-afdf-010e028afc2b';

-- INV/2020/800  |  CASH MEMO  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0dcbb43e-fed2-4de2-8e7b-85236a820411';

-- INV/2020/815  |  CASH MEMO  |  balance=1.575  diff=+1.575
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c0f2f402-25e2-4b49-ad85-937af3f33a64';

-- INV/2020/883  |  INTERSTAR ELECTRICAL EQUIPMENTS W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'eaad7106-0005-4228-9d63-097943c9e16e';

-- INV/2020/886  |  DANWAY ELECTRICAL & MECHANICAL ENGINEERING L.  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a33cc81d-5445-4a47-af35-795f5ef74b9b';

-- INV/2020/902  |  DANWAY ELECTRICAL & MECHANICAL ENGINEERING L.  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a457d411-b857-41f4-8e0b-0969bb0e7e2e';

-- INV/2020/919  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4d3ac903-0ffa-49eb-9ba6-1d5fac5bf412';

-- INV/2020/92  |  MAP RENTAL EQUIPMENTS W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ced3b847-773e-4630-a180-faef42938c0f';

-- INV/2020/947  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5f81a8b7-5279-4935-b760-ddee7f901c97';

-- INV/2021/1014  |  AL MOSAWI TRADING & ELECTRICAL CONTRACTING.  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1f17924a-43d9-4049-bced-d95ca06f2648';

-- INV/2021/1018  |  BACK BONE MEDICAL EQUIPMENTS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a3503612-a2cf-477c-b490-2f91d6b4d0fc';

-- INV/2021/1103  |  AL MOSAWI TRADING & ELECTRICAL CONTRACTING.  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '43343a89-bbf3-4b1d-b311-a5edea6cc408';

-- INV/2021/1104  |  CASH MEMO  |  balance=0.045  diff=+0.045
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '86f20950-b9ff-45d7-86f7-75857d033529';

-- INV/2021/1107  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5b106350-f463-41b8-8089-5596181ff37d';

-- INV/2021/1108  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd966737b-2b4d-44e6-8c28-bb62a27f01a1';

-- INV/2021/1116  |  ABURADWAN BUILDING MATERIALS TRADING CONTRACT  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3075b8ce-2975-4ab7-a81a-c6049f8b12a0';

-- INV/2021/1127  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '53f694cf-71d6-400c-a853-dd4ac71594c4';

-- INV/2021/1137  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '59151178-1616-46c0-a2de-3f1578b6e006';

-- INV/2021/1157  |  CASH MEMO  |  balance=0.018  diff=+0.018
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a5725ab7-3b8f-43a4-b8ce-89b639089238';

-- INV/2021/1158  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bcf04a10-de7c-4403-a1fb-70290852f260';

-- INV/2021/1160  |  CASH MEMO  |  balance=0.026  diff=+0.026
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '86db33fd-4914-40fe-9a52-ae5cd6e962d6';

-- INV/2021/1162  |  CASH MEMO  |  balance=0.012  diff=+0.012
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0b0f6d5e-8564-489a-a22b-340b284098e3';

-- INV/2021/1181  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8ffe24d3-9990-472b-a4f2-4270bfca58f7';

-- INV/2021/122  |  CASH MEMO  |  balance=0.031  diff=+0.031
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b6b97832-1b41-4054-b5a2-328ce81933aa';

-- INV/2021/132  |  TALAL FUAD KANOO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6677bedb-0ff8-4f40-af79-8c16cad54c75';

-- INV/2021/139  |  CASH CUSTOMER  |  balance=0.019  diff=+0.019
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4036da91-7abb-4c14-97ed-d284e4b7d344';

-- INV/2021/147  |  EBRAHIM KHALIL KANOO CO. B.S.C (CLOSED)  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'be734582-ce27-4293-bda7-fb82c3227607';

-- INV/2021/194  |  MAP RENTAL EQUIPMENTS W.L.L  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1716f273-fedc-45e0-babb-83fab711da2e';

-- INV/2021/220  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b88a839c-5fe3-48ae-9fc2-05852ba37809';

-- INV/2021/228  |  MAP RENTAL EQUIPMENTS W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '780129d5-ebc3-4ee3-baed-a11dadabc940';

-- INV/2021/246  |  MAP RENTAL EQUIPMENTS W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd7353c94-c7bd-4d98-a81e-20a887c8b911';

-- INV/2021/254  |  INTERNATIONAL SECURITY SERVICES CO. SPC  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6fc392c5-5460-430c-b268-c2d46c77cf67';

-- INV/2021/258  |  CASH CUSTOMER  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '466ec3d7-68d3-4756-83f7-10626efcb28d';

-- INV/2021/267  |  CASH CUSTOMER  |  balance=0.027  diff=+0.027
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c5271aba-20d2-4ee7-885a-034f886021be';

-- INV/2021/308  |  ALBARAKA EXHIBITION  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9bded6eb-07b8-46e8-aba5-0b9dc06d6f2c';

-- INV/2021/309  |  ALBARAKA EXHIBITION  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e61c3bfc-91e3-466a-b209-ae19f9952dd8';

-- INV/2021/314  |  CASH MEMO  |  balance=0.028  diff=+0.028
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '74bee4ee-196e-4342-b943-a6b02ec32cfc';

-- INV/2021/337  |  CASH MEMO  |  balance=0.029  diff=+0.029
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'edc3e3d2-6224-45ef-9a1c-bb441ae55fa8';

-- INV/2021/34  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9a13607b-79c2-4e68-b91b-df87f2d453db';

-- INV/2021/353  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f85ca004-1418-4e1a-9e0b-f93fe067e207';

-- INV/2021/354  |  EVER FINE TRADING W.L.L  |  balance=0.053  diff=+0.053
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '890660d0-6e2f-4b7e-965c-f1d02083600c';

-- INV/2021/388  |  ABRAJ AL JAMEEL FOR CONSTUCTION W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'dfd0b03b-21cc-4434-a5a2-58d28af6c6d6';

-- INV/2021/4  |  EBRAHIM KHALIL KANOO CO. B.S.C (CLOSED)  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'acf85060-3de7-4e99-adbf-cc296b8ea24b';

-- INV/2021/436  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7b206a49-6aee-4b26-97e4-9a067a1f1a7d';

-- INV/2021/438  |  BAHRAIN AND SAUDI ELECTRICAL CO. W.L.L  |  balance=1.575  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '11683fd0-bef6-4d48-abd1-88310308d05e';

-- INV/2021/439  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '06b06959-864b-4e29-8396-ea4c346c3345';

-- INV/2021/452  |  CASH MEMO  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ee872120-c06c-4782-a102-a6959f50eb3e';

-- INV/2021/462  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '610e0f65-7e7a-4814-9b19-8319dab9443f';

-- INV/2021/473  |  FRESH KITCHEN W.L.L  |  balance=0.052  diff=+0.052
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ecb45ef5-718b-482f-abce-012f4d108880';

-- INV/2021/48  |  CASH MEMO  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '69c3a736-28c7-4955-be9c-c53a3448cb8c';

-- INV/2021/489  |  MIDDLE EAST COMPUTER SERVICE (MECOS)  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1bff433d-a761-4266-aac3-d02b88fe4eac';

-- INV/2021/501  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5e00725e-ea7e-4eda-8119-09d88db84155';

-- INV/2021/508  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3627fe92-59e5-43dc-a813-3313854f1072';

-- INV/2021/564  |  EBRAHIM KHALIL KANOO CO. B.S.C (CLOSED)  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '233a274d-b782-4684-8996-6361028f7a54';

-- INV/2021/567  |  GREEN VALLEY REAL ESTATE CO. W.L.L  |  balance=0.053  diff=+0.053
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'adf1d558-74e7-43f4-beba-900125795c50';

-- INV/2021/618  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ef139901-b417-4431-8ffa-b5386d714c73';

-- INV/2021/638  |  CASH MEMO  |  balance=0.014  diff=+0.014
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '44d6c736-3552-4cfe-adb5-e30193bc3d2d';

-- INV/2021/676  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0cf3bda6-024f-48ad-8b40-6271d56ca03e';

-- INV/2021/697  |  CASH MEMO  |  balance=0.056  diff=+0.056
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '05e38e93-3c06-4990-95ca-cf011f63a357';

-- INV/2021/728  |  BATSCO CO. W.L.L  |  balance=0.004  diff=+12.604
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0fea350f-28e0-49aa-98ad-ca2f45abc586';

-- INV/2021/729  |  TRAVENCORE LIGHTS & ELECTRICALS CO. W.L.L  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '40aaee1b-34a6-4b62-b2f6-c1becea16b75';

-- INV/2021/733  |  CASH MEMO  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4ca61468-b1f0-4251-8084-05a3acce6de0';

-- INV/2021/736  |  BACK BONE MEDICAL EQUIPMENTS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8fb2a6cd-23e4-4cab-8284-ff5e757f3d0a';

-- INV/2021/74  |  MAP RENTAL EQUIPMENTS W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'eb4aca6f-098d-48e1-bd9f-51fbb83706cd';

-- INV/2021/756  |  CASH MEMO  |  balance=0.013  diff=+0.013
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'de337cef-ba37-4aa6-b1d9-e6c290ab7621';

-- INV/2021/782  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8dfd24a1-95a9-4291-a8dd-11bf1864ecdf';

-- INV/2021/797  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '583838b7-76d0-49d7-9d9e-3d2c763ce0c6';

-- INV/2021/803  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5490afcc-220b-42a6-a267-4ccc248b3cde';

-- INV/2021/850  |  SOLAR ONE CO. W.L.L  |  balance=0.212  diff=+0.212
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a4a3ff54-e559-47fb-920b-e7bc0fa7b641';

-- INV/2021/852  |  CASH MEMO  |  balance=0.075  diff=+0.075
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'dc87444a-0b8e-44df-8412-4f09c967ed57';

-- INV/2021/856  |  CASH MEMO  |  balance=0.021  diff=+0.021
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'aa902540-5e77-4991-8584-51a8a9537acd';

-- INV/2021/879  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bfa09f62-52d1-44b3-a081-14436671a8f7';

-- INV/2021/884  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7e449763-a283-460d-a4ae-bd3ab0f0bbf1';

-- INV/2021/885  |  CASH CUSTOMER  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '97054f97-a283-4b7b-bf69-2de9a282c97a';

-- INV/2021/908  |  CASH MEMO  |  balance=0.035  diff=+0.035
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1ffcba45-4f79-44ec-9af5-33701c3d1934';

-- INV/2021/917  |  CASH MEMO  |  balance=0.005  diff=+14.905
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '79613022-a345-4564-a647-f5fdb0c9884a';

-- INV/2021/926  |  CASH MEMO  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '776e5b1d-6baf-44de-a499-f5006d4188a8';

-- INV/2021/936  |  CASH MEMO  |  balance=0.067  diff=+0.067
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4aaab692-1820-4ded-9d02-23d4573822fa';

-- INV/2021/94  |  MOHAMED HASSAN DAWANI &SONS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c3b6def8-b859-4657-b67c-b5582b31d653';

-- INV/2021/940  |  CASH MEMO  |  balance=0.047  diff=+0.047
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '55c0f1a6-57d2-4b38-bfb1-c27a8b6e0684';

-- INV/2021/963  |  CASH MEMO  |  balance=0.067  diff=+0.067
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2425994c-352d-4399-a7bc-f906c53615f9';

-- INV/2021/968  |  CASH MEMO  |  balance=0.033  diff=+0.033
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c064abf8-e662-40f8-9e83-632e8edb1d06';

-- INV/2021/969  |  AL HAMRA BUILDING MATERIALS CO. W.L.L  |  balance=0.002  diff=+1.892
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8b194ad5-240a-4275-8a76-6f6cb30999ac';

-- INV/2021/985  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9da365a3-3518-42cc-b3ab-44d2d3d8376d';

-- INV/2022/1113  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e323613a-92ec-4dd8-8cdd-b45d2027e1c6';

-- INV/2022/1157  |  CASH MEMO  |  balance=0.715  diff=+0.715
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6be72f30-c639-4efe-81f5-33b705a25b83';

-- INV/2022/1181  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c59b3908-a98b-46f4-8521-05649798a83a';

-- INV/2022/1309  |  CASH MEMO  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9da314a9-8bfa-4a11-8655-580538effcf7';

-- INV/2022/1341  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5e2a6842-c35b-4b71-bf44-468c95471c4c';

-- INV/2022/1380  |  TRAVENCORE LIGHTS & ELECTRICALS CO. W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '98516406-2c2e-41b5-8226-e6f0d99a8f76';

-- INV/2022/1584  |  CASH MEMO  |  balance=0.001  diff=+2.003
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0b1993c5-79ec-495d-ba55-19ea77fff170';

-- INV/2022/1638  |  SPLINE CONTRACTING CO.W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '23a24260-cce6-4df7-ae62-d68f9dadd4f1';

-- INV/2022/1669  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'fb8d6fdd-a115-40e1-93bb-98c86eb32762';

-- INV/2022/1737  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3ca2c6cf-e885-414c-9ae0-86984c6d413d';

-- INV/2022/1759  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7c4b0379-00e1-4c86-b33e-981f0a465364';

-- INV/2022/1845  |  CASH CUSTOMER  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b906a4b4-745a-4144-b4ae-99575818032c';

-- INV/2022/1865  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1cec939d-53a0-47df-8540-4a1eb1ed4404';

-- INV/2022/1871  |  CASH CUSTOMER  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '14a578f7-1d2d-407d-8c2b-0ccd068a560a';

-- INV/2022/1924  |  DOUBLE COOL MACHNERY AND EQUIPMENTS  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b32f0754-81fa-4495-8843-d81b6024e962';

-- INV/2022/2009  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '839db382-3cf9-40ea-9f29-e9952a5aa5b9';

-- INV/2022/2031  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7ca06449-9367-4484-a233-e0582f489854';

-- INV/2022/2212  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd4eca149-d421-4ff1-8d04-81597336bb22';

-- INV/2022/2272  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '73f50fb5-78e0-41f5-b704-17649c1b0e64';

-- INV/2022/2281  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2e79218d-834a-4450-8782-cba1375934f1';

-- INV/2022/2286  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '058b8f36-31a0-4bf1-bce8-9974545cbb01';

-- INV/2022/2301  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7bd9b15e-61fc-435a-b835-c3fce8581448';

-- INV/2022/562  |  CASH MEMO  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '486c716d-a7e2-49c1-a15d-b712ddd68f1d';

-- INV/2022/586  |  CASH MEMO  |  balance=0.051  diff=+0.050
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f1265ec3-7bf7-41f5-9bcd-14805dd9ccc9';

-- INV/2022/592  |  CASH MEMO  |  balance=0.051  diff=+0.050
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f2714be4-8976-4272-93f4-4d2ff2334ea5';

-- INV/2022/622  |  MANAMA GATE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2a10d1cd-80ee-43db-b8b7-7d4960039529';

-- INV/2022/813  |  CASH MEMO  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '243eaf4f-fbcc-4185-bbad-7550d84df1da';

-- INV/2022/887  |  CASH MEMO  |  balance=1.760  diff=+1.760
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f9de847b-2375-47a7-bb36-792fbe283bb5';

-- INV/2022/902  |  EVER FINE TRADING W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2ecf3e9c-15e5-415b-80f6-b135a635e1e1';

-- INV/2023/117  |  CASH CUSTOMER  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '89c65bbf-20d4-487b-9881-f1fc5d02700d';

-- INV/2023/1650  |  CASH CUSTOMER  |  balance=0.475  diff=+0.475
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7c2ac1e0-0e0c-46be-acc9-47e5cc754f5a';

-- INV/2023/1747  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3a3f93be-5a35-4983-ad19-4ce35157fdd9';

-- INV/2023/1813  |  CASH MEMO  |  balance=0.079  diff=+0.079
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '37870169-b938-4511-9b61-56883a9f7c31';

-- INV/2023/1885  |  CASH CUSTOMER  |  balance=1.710  diff=+1.710
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a33d0327-a3ea-48d3-9458-bbe4a85e4259';

-- INV/2023/1906  |  FUTURE POWER Electrical Equipments W.L.L  |  balance=0.715  diff=+0.715
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bad8c265-dadf-4e47-ad05-45e2490b0ba8';

-- INV/2023/1941  |  ZEKO GENERAL TRADING  |  balance=0.055  diff=+0.055
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a4c8eda4-2680-4eb7-be41-5ef31f05efc0';

-- INV/2023/1944  |  ZEKO GENERAL TRADING  |  balance=0.056  diff=+0.056
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9a4fe613-a0cc-4de1-ae19-783cfa605427';

-- INV/2023/1950  |  TRAVENCORE LIGHTS & ELECTRICALS CO. W.L.L  |  balance=0.070  diff=+0.070
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '56502bd7-ad49-48c3-9d67-5de950d4144e';

-- INV/2023/2012  |  CASH MEMO  |  balance=0.016  diff=+0.016
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '934dd597-6420-4411-bdf2-c4c8229aae23';

-- INV/2023/2059  |  EVER FINE TRADING W.L.L  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2fb05da0-464b-4015-87a4-9d5663acdba2';

-- INV/2023/2126  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '01aff1c8-35a9-441a-be50-b0aa567acc31';

-- INV/2023/230  |  WESTLINE INTERNATIONAL TRADING CO. W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c6b2cf8b-1f49-4e17-8434-97095beb8f8b';

-- INV/2023/40  |  FUTURE FOODS W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '828ea1e5-79fc-4a28-844e-f2e637c07ef4';

-- INV/2023/545  |  AL MOUSSAWI INTERNATIONAL FOR ELECTRICAL CONT  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '14e03b29-4473-4267-a411-5320ab3fe634';

-- INV/2023/571  |  TRAVENCORE LIGHTS & ELECTRICALS CO. W.L.L  |  balance=0.001  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '36336fdd-b328-4ed7-b00d-1d489fc5f492';

-- INV/2023/696  |  CASH MEMO  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4dced2e0-47f2-473a-9205-8d9eb849ea5a';

-- INV/2023/753  |  CASH MEMO  |  balance=0.286  diff=+0.286
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'aed552b2-a7d3-4fa6-8569-4d044d4edfa1';

-- INV/2023/883  |  AL MOOSAWI TRADING & ELECTRICAL CONTRACTING W  |  balance=0.001  diff=+0.001
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9825014c-2b3f-475d-b84d-d2507ab89741';

-- INV/2024/1002  |  BRIDGE INDUSTRIAL SERVICE  |  balance=0.300  diff=+0.300
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'cbef27f0-a03b-4541-837b-7fffcdc042fa';

-- INV/2024/1011  |  CASH MEMO  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '39b499f0-9819-4a06-97d3-8c35b904ce79';

-- INV/2024/1015  |  ROYAL AMBASSDOR PROPERTY CO.W.L.L  |  balance=1.319  diff=+1.319
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a727385d-ad86-4073-b013-2eab4b130b4f';

-- INV/2024/1031  |  CASH CUSTOMER  |  balance=0.638  diff=+0.638
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '13492510-cb87-4863-ae65-3630142b1681';

-- INV/2024/1044  |  CASH CUSTOMER  |  balance=1.760  diff=+1.760
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '63bdd93f-c210-4163-8f05-3c3310e14656';

-- INV/2024/1066  |  CASH MEMO  |  balance=0.056  diff=+0.056
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '40a8a0ea-5a0e-4e7b-b8ab-7b0b5afa626f';

-- INV/2024/1105  |  CASH CUSTOMER  |  balance=0.825  diff=+0.825
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '86f160d9-b308-43c6-9e78-608dcc206079';

-- INV/2024/1109  |  JEMS SOLUTION COMPANY W.L.L  |  balance=0.243  diff=+0.244
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0f207dcc-3851-487c-9636-12a52ed9382b';

-- INV/2024/111  |  CASH MEMO  |  balance=0.352  diff=+0.352
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4d81a18e-8b8d-4bba-ac9a-4251e16e847f';

-- INV/2024/1161  |  FLOWVENT CO WLL  |  balance=0.201  diff=+0.201
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '023922a5-befc-4709-a76a-5459173c7f9d';

-- INV/2024/1201  |  CASH MEMO  |  balance=0.040  diff=+0.040
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5d160685-a78f-4afa-88e7-d6e7a35b78e1';

-- INV/2024/1228  |  PAK KASHMIR SERVICES CO. W.L.L  |  balance=0.066  diff=+0.066
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c3e9b878-1085-47eb-b0c2-0fad04b4a0de';

-- INV/2024/1240  |  CASH CUSTOMER  |  balance=3.355  diff=+3.355
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6e8b4cbf-5870-4c76-a7bc-bbad554f930e';

-- INV/2024/1242  |  CASH MEMO  |  balance=0.165  diff=+0.165
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '27a77e1e-d9ea-4194-a87e-49c61853caa8';

-- INV/2024/1279  |  CASH CUSTOMER  |  balance=1.937  diff=+1.937
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '06ad0cfe-65b1-43ac-81f7-eb2e8364cf3f';

-- INV/2024/1287  |  CASH MEMO  |  balance=0.770  diff=+0.770
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f18daf59-d011-4e7e-8873-b601e48715cd';

-- INV/2024/1330  |  CASH MEMO  |  balance=0.232  diff=+0.232
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '90e66756-a9b6-42ed-87da-7df00e0e2fba';

-- INV/2024/1332  |  SWISS-BELSUITES ADMIRAL JUFFAIR W.L.L  |  balance=2.999  diff=+2.999
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c265f5dc-5c3a-4199-bedf-2c39e9950f84';

-- INV/2024/1341  |  CASH MEMO  |  balance=0.990  diff=+0.990
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '62e5131a-a5a6-4529-a104-d2128f990e48';

-- INV/2024/1350  |  CASH MEMO  |  balance=0.544  diff=+0.544
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '64afc5cc-db77-4a46-b4f6-583f26957ec0';

-- INV/2024/1357  |  CASH CUSTOMER  |  balance=9.394  diff=+9.394
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '957c72ae-7087-4d4b-bb57-12e1a1ca160a';

-- INV/2024/1376  |  CASH MEMO  |  balance=0.246  diff=+0.246
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9280edf0-6ff3-48a3-a7d1-24979a9aeb8f';

-- INV/2024/1416  |  IN CITY GENERAL TRADE W.L.L  |  balance=0.855  diff=+0.855
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2848d1d9-39c5-4b9e-a947-391a3864eaa1';

-- INV/2024/1419  |  AREEJ DAIRIES  |  balance=1.155  diff=+1.155
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'aee806ef-f272-480f-8ab0-e0dd93588cf9';

-- INV/2024/1430  |  CASH MEMO  |  balance=0.440  diff=+0.440
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '785130e7-1c03-44f2-800b-fb5f823a9e61';

-- INV/2024/1435  |  CASH CUSTOMER  |  balance=0.275  diff=+0.275
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5849c3d8-d46a-4b5e-9a33-8a8d32c2ea7b';

-- INV/2024/1437  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9e6850d4-43f9-49de-b1f7-5dead2d1cd91';

-- INV/2024/1444  |  BEST LED LIGHTING CO.W.L.L  |  balance=5.060  diff=+5.060
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5f0fc9a7-b39d-404f-92e3-ae3514dadd87';

-- INV/2024/1447  |  ZEKO GENERAL TRADING  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5bef1783-1adb-4820-bf02-b7c640dae9bc';

-- INV/2024/1450  |  CASH MEMO  |  balance=0.429  diff=+0.429
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '23b5f482-bafe-4876-87f1-17a4271e8f93';

-- INV/2024/1455  |  CASH MEMO  |  balance=0.660  diff=+0.660
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4e5efdbb-fb3d-42c4-81a5-edc24640a86b';

-- INV/2024/1456  |  BEST LED LIGHTING CO.W.L.L  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '795fc3b3-c07d-4a0d-95a2-2105e4293379';

-- INV/2024/146  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '266727bd-b87e-4d1e-a76c-98c31a625a89';

-- INV/2024/1469  |  CASH MEMO  |  balance=0.825  diff=+0.825
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6df8311c-8bf8-497a-b833-aa1e62f221b6';

-- INV/2024/1471  |  CASH MEMO  |  balance=1.705  diff=+1.705
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '803ae2ba-57b7-4934-bbe0-c4a9836ad013';

-- INV/2024/1481  |  CASH CUSTOMER  |  balance=4.944  diff=+4.944
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'fdd1b884-1491-47de-a03e-6ca3d214b9a7';

-- INV/2024/1493  |  CASH MEMO  |  balance=0.413  diff=+0.413
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8eb85a2d-36a1-4c98-9610-d0f60ff57338';

-- INV/2024/1498  |  CASH MEMO  |  balance=0.440  diff=+0.440
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2ad170d3-39fd-41c3-a3d9-69547cf07086';

-- INV/2024/1515  |  CASH MEMO  |  balance=0.248  diff=+0.248
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1187a3cb-f752-49ef-91c4-501892a64df2';

-- INV/2024/1528  |  CASH CUSTOMER  |  balance=0.800  diff=+0.800
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '76acdc79-004a-479c-8014-5b5a40ea0844';

-- INV/2024/1543  |  CASH MEMO  |  balance=0.970  diff=+0.970
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '44d91409-1e91-453f-9bb7-41bb42584e7d';

-- INV/2024/1563  |  CASH MEMO  |  balance=0.220  diff=+0.220
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a74b953f-e579-4942-a465-0f0e001577f7';

-- INV/2024/1597  |  CASH MEMO  |  balance=0.021  diff=+0.021
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f1b6914d-3307-4f8f-854a-532ff44a17f5';

-- INV/2024/1623  |  CASH MEMO  |  balance=6.993  diff=+6.993
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a39b7cd3-58d3-4059-a37f-6577fdea7770';

-- INV/2024/1627  |  JIDHAFS TECHNICAL SECONDARY SCHOOL  |  balance=0.110  diff=+0.110
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b6d6fb2f-68e8-4b5f-b661-bf0ff178f6c9';

-- INV/2024/1673  |  JIDHAFS TECHNICAL SECONDARY SCHOOL  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7efa52eb-4cbd-495d-bb07-8e44bb5a4740';

-- INV/2024/1678  |  CASH MEMO  |  balance=0.165  diff=+0.165
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd4fd6f87-94a0-45b3-9560-8c2a42ef3e0f';

-- INV/2024/1683  |  CASH MEMO  |  balance=0.193  diff=+0.193
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e27743e2-efb3-4361-8ff0-0c8935bdf90f';

-- INV/2024/1702  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c01b8a9d-e9c3-4796-8449-2da666e4ed17';

-- INV/2024/1715  |  CASH MEMO  |  balance=0.200  diff=+0.200
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '413b0585-5cac-4f23-9f99-33517af65fdb';

-- INV/2024/1742  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e07ae920-affa-4b6a-b241-d5005c9ec731';

-- INV/2024/1747  |  CASH MEMO  |  balance=1.338  diff=+1.338
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b5294809-8169-4ff9-a799-46ccf02652bf';

-- INV/2024/1757  |  CASH MEMO  |  balance=0.032  diff=+0.032
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '37144753-dc03-4bbf-ab0c-c11666efe81d';

-- INV/2024/1758  |  CASH MEMO  |  balance=0.303  diff=+0.303
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e5fe00c7-69a8-4785-b099-d3e18be74c87';

-- INV/2024/1790  |  CASH MEMO  |  balance=0.015  diff=+0.015
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9d3fa2c6-0ed9-4d52-85b0-797f1ef19386';

-- INV/2024/1802  |  CASH MEMO  |  balance=0.825  diff=+0.825
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b0f9c345-6ca9-4a20-a704-fcbcfa84aa31';

-- INV/2024/1927  |  CASH MEMO  |  balance=0.365  diff=+0.365
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'abd069e5-8d95-439d-858d-82ed95a83aa2';

-- INV/2024/1928  |  CASH MEMO  |  balance=0.220  diff=+0.220
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0dce7243-ed6f-4301-9430-f5774cbb7384';

-- INV/2024/1947  |  IV TRADERS W.L.L  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5f8b2bdf-442a-480c-9677-00cc528f58c1';

-- INV/2024/1967  |  CASH MEMO  |  balance=0.025  diff=+0.025
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1a1b5794-5f1b-4ef7-bffc-e745a99249b4';

-- INV/2024/2001  |  AREEJ DAIRIES  |  balance=0.549  diff=+0.549
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '55c52994-212f-4141-8f32-345b828b9f80';

-- INV/2024/2064  |  CASH MEMO  |  balance=1.072  diff=+1.072
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '285f9802-cac9-4210-8452-3da1947b9e1e';

-- INV/2024/2075  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e61b867f-811e-4297-8ca9-1976cfa18775';

-- INV/2024/2087  |  CASH MEMO  |  balance=0.201  diff=+0.201
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6c554971-b2cd-4813-be32-70684519856d';

-- INV/2024/2115  |  H.H SH. ALI BIN ISA BIN SALAMAN AL-KHALIFA  |  balance=7.959  diff=+7.959
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'fff7a16a-9670-42d7-a7c9-96c30fbf1447';

-- INV/2024/2135  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8c7aac01-795b-44e6-9aa2-358549f35e5d';

-- INV/2024/2138  |  BANAFA FOR OUD  |  balance=7.000  diff=+7.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b0db7de9-580b-4cd6-b7ba-7fe73057b464';

-- INV/2024/2198  |  ROYAL AMBASSDOR PROPERTY CO.W.L.L  |  balance=0.099  diff=+0.099
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '326df676-2623-499e-bb2d-6e59ff1ad3a2';

-- INV/2024/2210  |  CASH MEMO  |  balance=0.006  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'fc477442-8ffc-4a01-a236-acea22d075f3';

-- INV/2024/234  |  VALCOA BUILDING MATERIALS W.L.L  |  balance=0.055  diff=+0.055
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b9771774-fbc0-446d-a754-0bf70df5421e';

-- INV/2024/373  |  CASH MEMO  |  balance=2.255  diff=+2.255
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6aaee904-572f-4924-9f68-8b6fb99aa72a';

-- INV/2024/415  |  CASH MEMO  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a0bdf26d-06a2-4689-9cf2-8da7e08c6194';

-- INV/2024/451  |  CASH MEMO  |  balance=0.281  diff=+0.281
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '004bf666-bac3-4aa8-a8db-6c0a58adc658';

-- INV/2024/523  |  CASH MEMO  |  balance=0.180  diff=+0.180
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2db03320-fea2-49b4-8be9-43c806172830';

-- INV/2024/71  |  CASH MEMO  |  balance=0.220  diff=+0.220
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '93ddbb7e-db0c-4084-9daa-b017db8c0cd3';

-- INV/2024/77  |  CASH MEMO  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c1bde607-142b-4aab-a8a1-5e171ba87292';

-- INV/2024/828  |  CASH MEMO  |  balance=0.743  diff=+0.743
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e6e208be-a27b-4473-bae8-3a196d5214a4';

-- INV/2024/865  |  INNOVATION ELECTROMECHANICAL CO.W.L.L.  |  balance=0.440  diff=+0.440
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f2e78f83-c5cd-45cd-8e8d-85e528cea546';

-- INV/2024/875  |  GREEN VALLEY REAL ESTATE CO. W.L.L  |  balance=13.571  diff=+13.571
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b1051594-ade7-471a-b9ef-f29834daa224';

-- INV/2024/911  |  CASH CUSTOMER  |  balance=0.604  diff=+0.604
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a00b561a-01a5-40cf-880e-10edf501fd74';

-- INV/2024/925  |  CASH CUSTOMER  |  balance=3.900  diff=+3.900
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f1d34578-fc6d-4e87-b76c-babdab830c80';

-- INV/2024/978  |  HIMALAYA TRADING CO. W.L.L  |  balance=0.165  diff=+0.165
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0438b551-ea18-418c-b43e-4823ef79f4c8';

-- INV/2024/996  |  CASH MEMO  |  balance=1.650  diff=+1.650
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4a869b57-0277-4c39-b872-38c2805b091a';

-- INV/2025/1015  |  CASH CUSTOMER  |  balance=2.872  diff=+2.872
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4b340f4d-94fd-4ea7-9b9e-283dc0c60078';

-- INV/2025/1021  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a4183152-d469-446f-8f3f-839c3b0c14dc';

-- INV/2025/1025  |  CASH MEMO  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a55e5b90-cc91-4f01-be4f-a44556476273';

-- INV/2025/1053  |  BEST LED LIGHTING CO.W.L.L  |  balance=4.180  diff=+4.180
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c6f69e78-4a1a-4005-bc82-5c065648f244';

-- INV/2025/1055  |  SAYED MOHAMMED HASHIM ALHASHIMI AND PARTNERS-  |  balance=0.303  diff=+0.303
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '76fe9799-6c7e-42d2-aa0a-90822d7f6513';

-- INV/2025/1056  |  CASH MEMO  |  balance=0.545  diff=+0.545
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1391e66f-fac1-4612-b2bb-837af35d6b6b';

-- INV/2025/1089  |  CASH CUSTOMER  |  balance=6.667  diff=+6.667
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8e8b8925-1dda-41eb-954a-23118fda6316';

-- INV/2025/1107  |  JAMEELA STORES W.L.L  |  balance=1.214  diff=+1.214
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '761a6909-d065-46e2-a9ec-d2b3ada65c00';

-- INV/2025/1115  |  ROYAL AMBASSDOR PROPERTY CO.W.L.L  |  balance=0.658  diff=+0.658
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'dc6cc957-e670-42b7-a7f1-e9971dbaf667';

-- INV/2025/113  |  CASH MEMO  |  balance=0.134  diff=+0.134
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c0b1636d-ca5a-4a5d-9505-0a4dc7fc767f';

-- INV/2025/1159  |  CASH MEMO  |  balance=1.241  diff=+1.241
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ab68111e-27ac-40be-9659-39bd0b445941';

-- INV/2025/1168  |  CASH MEMO  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9e119e42-2dff-41c2-a5b4-f7728ab61a28';

-- INV/2025/1169  |  CASH MEMO  |  balance=0.017  diff=+0.017
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8d82b116-22a4-4698-81a7-b6384bd9182d';

-- INV/2025/1177  |  AL MOOSAWI TRADING & ELECTRICAL CONTRACTING W  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1c715a1c-863f-4168-ae6a-0cd90cf263ad';

-- INV/2025/1189  |  AHMED & YOUSIF KADHIM ALHALWAJI SONS CO. W.L.  |  balance=3.300  diff=+3.300
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '379e8cc9-9941-473f-ab9b-f8de90345a7d';

-- INV/2025/1198  |  CASH MEMO  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '181cd517-1248-45e6-be07-39650b488c0d';

-- INV/2025/1204  |  CASH MEMO  |  balance=0.079  diff=+0.079
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a383b228-2198-4787-b4e3-b7b79b778755';

-- INV/2025/122  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8a7cf9c8-a60c-4f33-a32d-6e4a53a31867';

-- INV/2025/1228  |  CASH MEMO  |  balance=0.041  diff=+0.041
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ecff10a2-58a9-413a-b101-e81eaae96721';

-- INV/2025/1231  |  CASH MEMO  |  balance=0.100  diff=+0.100
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7df3e8b1-cb83-48d0-b467-a15ff6b79bed';

-- INV/2025/1239  |  CASH CUSTOMER  |  balance=5.556  diff=+5.556
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'fdd40ccf-3faf-44be-b6a9-8feddb36c4f3';

-- INV/2025/1245  |  JAMEELA STORES W.L.L  |  balance=4.460  diff=+4.460
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b564fd46-fbe9-4eac-b6a4-a290fb11c925';

-- INV/2025/1247  |  CASH MEMO  |  balance=0.200  diff=+0.200
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '180bc525-b26d-4435-ba46-09b2ae6ffef3';

-- INV/2025/1250  |  CASH CUSTOMER  |  balance=0.110  diff=+0.110
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2962e7a4-680c-4637-ac16-b0222460a83e';

-- INV/2025/1253  |  JAMEELA STORES W.L.L  |  balance=2.640  diff=+2.640
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '118e99cd-6f14-4f91-bdad-30c86deeb6a7';

-- INV/2025/1267  |  JAMEELA STORES W.L.L  |  balance=0.500  diff=+0.500
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bbf1531a-339a-4ca6-a0eb-466254bf00de';

-- INV/2025/1269  |  CASH MEMO  |  balance=0.660  diff=+0.660
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '04307b75-8ac1-4b04-bf75-39f567d27e36';

-- INV/2025/127  |  CASH MEMO  |  balance=0.248  diff=+0.248
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'cc599fce-8cc6-4c0a-ae35-182fcaa02f09';

-- INV/2025/1273  |  CASH CUSTOMER  |  balance=0.017  diff=+0.017
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2b577a8b-b7a7-4af8-9a13-6d619d4bcbff';

-- INV/2025/1277  |  CASH MEMO  |  balance=1.600  diff=+1.600
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ed280d14-60f0-4c53-8d72-b228d16a8565';

-- INV/2025/1289  |  JAMEELA STORES W.L.L  |  balance=0.800  diff=+0.800
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3438ea79-2940-45cc-ba2c-a382f368d24f';

-- INV/2025/129  |  CASH CUSTOMER  |  balance=0.523  diff=+0.523
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '84496a53-390e-4d29-b7c2-9e22dd3a7207';

-- INV/2025/1380  |  CASH MEMO  |  balance=1.450  diff=+1.450
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8dbb7829-f638-461b-852a-94a4e229054b';

-- INV/2025/1398  |  CASH MEMO  |  balance=0.300  diff=+0.300
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9822d601-76a1-4fe7-a9b7-1749affce6c9';

-- INV/2025/1403  |  CASH MEMO  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2b1a129c-8467-4cbb-ada0-91b45d53a766';

-- INV/2025/1451  |  CASH MEMO  |  balance=0.365  diff=+0.365
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '97c18525-27c3-4ea2-b378-af5f1e749c39';

-- INV/2025/1455  |  CASH MEMO  |  balance=0.533  diff=+0.533
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '78ffbccd-6d70-4004-9ef6-1ed3087f8994';

-- INV/2025/147  |  ROYAL AMBASSDOR PROPERTY CO.W.L.L  |  balance=0.413  diff=+0.413
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6d566e3d-05b8-492a-b2d2-e12805b70d37';

-- INV/2025/1478  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '75e0341a-3605-46f2-94d3-7947eef38d80';

-- INV/2025/1501  |  CASH CUSTOMER  |  balance=0.025  diff=+0.025
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '92ba47ec-d8a3-4b71-bcf8-8bf011a5bdcc';

-- INV/2025/1505  |  CASH MEMO  |  balance=0.013  diff=+0.013
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '49cc7621-2e22-4f40-a12b-becd4bdcc6b3';

-- INV/2025/1536  |  CASH MEMO  |  balance=5.041  diff=+5.041
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'dc57798e-fbf3-4f76-a82e-b33b9be23bff';

-- INV/2025/1558  |  CASH CUSTOMER  |  balance=1.039  diff=+1.039
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c3af2654-e865-4859-9cb2-79177d1b4c6c';

-- INV/2025/1598  |  CASH MEMO  |  balance=0.540  diff=+0.540
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd495327b-8c4f-426a-9def-60e48322fa47';

-- INV/2025/1631  |  CASH CUSTOMER  |  balance=0.601  diff=+0.601
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '322aadf2-4695-45b8-a346-338c28341305';

-- INV/2025/1645  |  CASH MEMO  |  balance=4.785  diff=+4.785
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd17aa58e-7fa8-4c65-9d91-6070671f54dc';

-- INV/2025/1647  |  CASH MEMO  |  balance=0.369  diff=+0.369
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '91c6a1fa-aaae-4c3a-8f39-16480f392d64';

-- INV/2025/1658  |  CASH MEMO  |  balance=0.200  diff=+0.200
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7e7e578c-e6e8-4ef4-af62-8fc8e0d12cc4';

-- INV/2025/1667  |  BEST LED LIGHTING CO.W.L.L  |  balance=2.772  diff=+2.772
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '55d5f608-221e-4a02-b1de-3a943e7b7ef1';

-- INV/2025/1700  |  CASH CUSTOMER  |  balance=0.110  diff=+0.110
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e098ef48-1a7f-465b-88e6-6ded49e97e4b';

-- INV/2025/1760  |  CASH MEMO  |  balance=0.456  diff=+0.456
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f9984993-83b7-4150-b8f2-af4550e063c0';

-- INV/2025/1791  |  CASH MEMO  |  balance=0.700  diff=+0.700
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '45cd4482-8106-432f-8c70-1e263076846c';

-- INV/2025/1797  |  CASH MEMO  |  balance=0.552  diff=+0.552
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '82571831-ce5f-41e9-b80a-3f4dfeca3530';

-- INV/2025/1831  |  CASH MEMO  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '523bcfc2-1926-42bf-9018-c053e088d32f';

-- INV/2025/184  |  CASH MEMO  |  balance=0.031  diff=+0.031
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8410cb23-a833-4a90-b2f3-9699ad13ce80';

-- INV/2025/1851  |  CASH MEMO  |  balance=1.290  diff=+1.290
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '329f29e7-0ec0-496d-b12f-464dc96ac2a0';

-- INV/2025/1853  |  CASH MEMO  |  balance=1.100  diff=+1.100
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ffc377f8-420c-4fea-942e-ae88eaed8795';

-- INV/2025/1862  |  CASH MEMO  |  balance=0.094  diff=+0.094
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '97723132-db86-4e84-aefb-1363e73a42db';

-- INV/2025/1863  |  CASH CUSTOMER  |  balance=1.485  diff=+1.485
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1516a3c7-becc-4a51-92c0-7554d2cded9b';

-- INV/2025/1872  |  CASH CUSTOMER  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '41b35a3c-7e50-411c-bd8e-083f3bce165c';

-- INV/2025/1873  |  CASH CUSTOMER  |  balance=0.770  diff=+0.770
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5c45bf43-64d0-4f52-90cb-66667cf9a2a3';

-- INV/2025/1884  |  CASH MEMO  |  balance=0.600  diff=+0.600
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9581748a-041e-4914-be21-3e34dc2dc9e9';

-- INV/2025/1885  |  CASH MEMO  |  balance=1.045  diff=+1.045
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b4a9aec5-e71e-4d39-bda4-44fb8a28b5db';

-- INV/2025/1895  |  CASH CUSTOMER  |  balance=0.595  diff=+0.595
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ab256903-b799-402b-8ef9-4f09621f9b9c';

-- INV/2025/1896  |  CASH MEMO  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '73957008-ae13-47ef-8eb0-0261e9d391dd';

-- INV/2025/1912  |  CASH MEMO  |  balance=0.083  diff=+0.083
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a9cbf8c2-c784-4bdb-801f-64e3ffea0e5f';

-- INV/2025/1919  |  TRAVENCORE LIGHTS & ELECTRICALS CO. W.L.L  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0249a498-5887-42cb-b5cd-bc83c949a915';

-- INV/2025/1935  |  CASH MEMO  |  balance=0.500  diff=+0.500
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e9b354e0-3622-4808-b5ff-0a8338aa189a';

-- INV/2025/1958  |  CASH CUSTOMER  |  balance=0.275  diff=+0.275
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd3dd0519-d691-4b7f-b064-3c9681174a3d';

-- INV/2025/1960  |  CASH MEMO  |  balance=0.248  diff=+0.248
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '374f858d-19e6-4623-b24b-b6c9fff8d2b4';

-- INV/2025/1965  |  CASH MEMO  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c71f0bf6-8d20-41b9-bfd1-10cc4084e51b';

-- INV/2025/1980  |  BEST LED LIGHTING CO.W.L.L  |  balance=2.309  diff=+2.309
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '663f8a94-a9f0-40bf-81b6-c1f126b42800';

-- INV/2025/1981  |  ASTER INFOTECH CO W.L.L  |  balance=0.176  diff=+0.176
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4af63c43-8cfa-482e-8552-e9bd34440c2a';

-- INV/2025/1982  |  CASH MEMO  |  balance=0.231  diff=+0.231
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd8a66e25-4af6-45b9-88a9-6c77da320463';

-- INV/2025/1988  |  ASTER INFOTECH CO W.L.L  |  balance=0.200  diff=+0.200
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'aaa109f2-1358-41a8-892d-d8b45a062baa';

-- INV/2025/1998  |  CASH CUSTOMER  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0b5e9915-1912-4d4c-85e7-55397f737d00';

-- INV/2025/2030  |  CASH CUSTOMER  |  balance=0.303  diff=+0.303
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8cb95c5c-189a-4bf4-b649-ee06cf7ebac4';

-- INV/2025/2071  |  CASH MEMO  |  balance=0.111  diff=+0.111
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'da143214-87d2-4738-b583-28bd310bfdc8';

-- INV/2025/2085  |  FUTURE FOODS W.L.L  |  balance=0.185  diff=+0.185
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c44f31fd-3fb0-4b57-af55-78a0bfb1ef1b';

-- INV/2025/2090  |  CASH MEMO  |  balance=0.825  diff=+0.825
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c0f6275f-1460-460d-b9e2-ccd0082db245';

-- INV/2025/2133  |  CASH MEMO  |  balance=0.329  diff=+0.329
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '29b7ad2c-ff0d-4539-8d99-7b986c14814b';

-- INV/2025/2144  |  CASH CUSTOMER  |  balance=8.030  diff=+8.030
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a2f1216e-291f-4d42-8a8e-1617d5d2cf0c';

-- INV/2025/2146  |  CASH MEMO  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '529d5471-c014-450a-9009-04b31c4076d7';

-- INV/2025/2149  |  CASH MEMO  |  balance=0.094  diff=+0.094
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1f4ced38-1886-4b3c-8a2a-ba24a0358f19';

-- INV/2025/2176  |  CASH CUSTOMER  |  balance=0.030  diff=+0.030
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c6cf66c6-36e2-48f2-9841-a179b6e141e6';

-- INV/2025/2177  |  CASH MEMO  |  balance=0.358  diff=+0.358
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '50dee1ab-733d-423c-a889-fc78e0aebcba';

-- INV/2025/2179  |  CASH CUSTOMER  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '9e7ae2ed-700b-4f23-8775-b63c91b2d22d';

-- INV/2025/2191  |  CASH MEMO  |  balance=1.337  diff=+1.337
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '21d61324-d0d3-4ef8-89f8-a417925e711f';

-- INV/2025/2201  |  CASH CUSTOMER  |  balance=0.080  diff=+0.080
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '22f440ac-e9bd-49d5-a85a-262c21541c6a';

-- INV/2025/2205  |  CASH CUSTOMER  |  balance=0.897  diff=+0.897
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '800f70ff-c48d-4c64-a71d-eaf553fd61b3';

-- INV/2025/2209  |  CASH MEMO  |  balance=0.700  diff=+0.700
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '18988ef5-9104-4f97-9728-85a11996c77a';

-- INV/2025/2258  |  BEST LED LIGHTING CO.W.L.L  |  balance=6.752  diff=+6.752
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5cdc5391-78ef-4170-a0b6-65bd59534215';

-- INV/2025/2270  |  CASH CUSTOMER  |  balance=0.488  diff=+0.488
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '74cb76ff-c455-43de-8ad5-11e28cfc2139';

-- INV/2025/2281  |  CASH MEMO  |  balance=0.880  diff=+0.880
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b44487c1-e5c8-4b5c-89ab-e482a95b91a7';

-- INV/2025/2282  |  CASH MEMO  |  balance=1.540  diff=+1.540
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '50ec0352-cbb1-4c5c-8a8e-51ee807ea603';

-- INV/2025/2295  |  CASH MEMO  |  balance=3.812  diff=+3.812
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '87d8726e-1c62-427b-b034-9f2278ffd11b';

-- INV/2025/2300  |  BEST LED LIGHTING CO.W.L.L  |  balance=5.886  diff=+5.886
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'f7247c87-b802-453f-9486-accbceb5d50e';

-- INV/2025/2313  |  FM TRADING W.L.L  |  balance=0.005  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b76ac41a-da90-4bd9-938d-5a0f40a45c7d';

-- INV/2025/2441  |  JIDHAFS TECHNICAL SECONDARY SCHOOL  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2871be1e-dfb4-4fa4-9468-87bd66baf1e3';

-- INV/2025/245  |  PALACE ELECTRONICS CO.W.L.L  |  balance=0.165  diff=+0.166
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3c9c02eb-101c-44a6-bd96-6d1dd21fe12c';

-- INV/2025/246  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6ec7d1ba-0005-43f8-a2a0-a331d7678bae';

-- INV/2025/2465  |  CASH CUSTOMER  |  balance=0.221  diff=+0.221
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '5f19acf4-1e95-45e5-9864-5dbe0b3c21fa';

-- INV/2025/2513  |  CASH MEMO  |  balance=0.005  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4a8f2473-aace-44a9-b417-2c1d831afb8e';

-- INV/2025/2535  |  TRAVENCORE LIGHTS & ELECTRICALS CO. W.L.L  |  balance=0.013  diff=+0.013
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7cba8d1b-cad3-48eb-9229-3eceb7c02c58';

-- INV/2025/2566  |  CASH MEMO  |  balance=0.202  diff=+0.202
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a1bfc10e-930b-4b54-bad4-5d10e65fb93d';

-- INV/2025/26  |  CASH MEMO  |  balance=0.314  diff=+0.314
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '99196194-dc6c-405d-8759-8da155c1ee2f';

-- INV/2025/2639  |  CASH MEMO  |  balance=2.531  diff=+2.531
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'da8d72fa-7e74-465c-901f-41e5800fd507';

-- INV/2025/2658  |  CASH CUSTOMER  |  balance=0.247  diff=+0.247
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '11103a0b-c3d3-42db-a517-3cb3697b614c';

-- INV/2025/2666  |  CASH MEMO  |  balance=0.221  diff=+0.221
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '77b92fba-e4bc-42d1-9b63-150f761c48f4';

-- INV/2025/2668  |  A I K INTERIORS S.P.C  |  balance=0.022  diff=+0.022
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6e7a4d06-3460-4684-a44d-c4ff1efa4b6d';

-- INV/2025/2691  |  CASH CUSTOMER  |  balance=1.236  diff=+1.237
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ed4f8c85-c393-49b3-be93-15043c0573a0';

-- INV/2025/2692  |  HAJI ALI HAJI GENERAL TRADING CO. W.L.L  |  balance=0.220  diff=+0.220
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'eaf8f84c-93db-4639-8fa8-907f400c299b';

-- INV/2025/2764  |  CASH MEMO  |  balance=0.276  diff=+0.276
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6b390bb9-7366-45eb-8928-819a2c3c3618';

-- INV/2025/2784  |  CASH MEMO  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'cfe2fe42-d3ee-41eb-b087-4dedeb1954b5';

-- INV/2025/2791  |  CASH CUSTOMER  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '584fe1cf-ff36-4307-9f48-d1746ce30010';

-- INV/2025/2839  |  CASH MEMO  |  balance=2.199  diff=+2.199
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3ac63d7d-960e-4963-bccf-8cfc4aa7746b';

-- INV/2025/2847  |  CASH MEMO  |  balance=1.346  diff=+1.346
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bd316f0d-84b6-4761-b8bd-e3e2c821cb94';

-- INV/2025/2861  |  CASH MEMO  |  balance=0.248  diff=+0.248
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7aec4715-f07b-44c9-9cf8-933d0eee5a1b';

-- INV/2025/292  |  CASH MEMO  |  balance=0.413  diff=+0.413
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd4bfea00-1e62-4a46-b8a6-ff2950aec965';

-- INV/2025/296  |  CASH MEMO  |  balance=0.302  diff=+0.302
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e0a44790-bddb-4ad6-a675-66cbe98f0479';

-- INV/2025/300  |  CASH MEMO  |  balance=0.440  diff=+0.440
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ae590104-3972-4e0b-bb6c-84dc08cd1c2b';

-- INV/2025/304  |  CASH CUSTOMER  |  balance=0.100  diff=+0.100
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8f63dd67-a4e4-4cb1-a51a-ae6841b6de23';

-- INV/2025/307  |  CASH MEMO  |  balance=0.110  diff=+0.110
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3b857c20-6b18-4e20-a48f-2a2ab9ec8ed1';

-- INV/2025/354  |  CASH CUSTOMER  |  balance=44.138  diff=+44.138
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e847e64b-639a-4412-b09a-f58846e86aaf';

-- INV/2025/37  |  CASH MEMO  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6efb8785-f703-4190-9af9-89629fe66ddc';

-- INV/2025/389  |  ROYAL AMBASSDOR PROPERTY CO.W.L.L  |  balance=0.110  diff=+0.110
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '560e60d0-be68-4de1-889c-a1ba33edd522';

-- INV/2025/390  |  CASH MEMO  |  balance=0.028  diff=+0.028
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b599757b-12f2-4a5a-8032-e9706c031e37';

-- INV/2025/394  |  BACK BONE MEDICAL EQUIPMENTS  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8cf3ca85-4a50-4f66-ac51-de316c8fabbd';

-- INV/2025/416  |  KASHFI ENTERPRISES COMPANY W.L.L  |  balance=0.010  diff=+0.010
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3524a0b7-c6a6-4a85-8424-6565f5db6ced';

-- INV/2025/443  |  CASH MEMO  |  balance=0.550  diff=+0.550
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '17c8b12d-30f4-43c1-87ec-aafd36e0c49a';

-- INV/2025/476  |  CASH MEMO  |  balance=0.138  diff=+0.138
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3765d607-9cf3-481d-861a-fd1ded34c0d6';

-- INV/2025/498  |  ZEKO GENERAL TRADING  |  balance=1.100  diff=+1.100
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '83179f67-3c5b-4b78-ba0d-da29ffa145ec';

-- INV/2025/52  |  JAN MOHD. TRADING EST.  |  balance=1.500  diff=+0.000
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — payment not captured during data import',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0eea77ee-9f59-43da-8e64-713d9a62b0e8';

-- INV/2025/530  |  ROYAL AMBASSDOR PROPERTY CO.W.L.L  |  balance=0.220  diff=+0.220
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '21eb4688-4e1d-4cb6-bc42-c8e9e383627f';

-- INV/2025/531  |  CASH MEMO  |  balance=0.550  diff=+0.551
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '65e906f6-6879-44bb-a599-8e3eb3ca1977';

-- INV/2025/566  |  CASH MEMO  |  balance=1.100  diff=+1.100
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '0dba151d-189a-472e-a9db-2c093b327493';

-- INV/2025/581  |  ZEKO GENERAL TRADING  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6d100e57-e065-4ed5-82f5-c013dc3f2cd6';

-- INV/2025/583  |  AL MOOSAWI TRADING & ELECTRICAL CONTRACTING W  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd01359c9-f807-4e43-9273-fd0d0fb73c9b';

-- INV/2025/585  |  AL RASMIYA TRADING  |  balance=0.008  diff=+0.008
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '56491916-bcae-4f38-9496-9cf16197d018';

-- INV/2025/664  |  CASH MEMO  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd087a3ea-e341-4ccd-933a-1b5814865dbb';

-- INV/2025/68  |  CASH MEMO  |  balance=5.759  diff=+5.759
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e02f91e5-f2c9-40b3-9085-a01e9579ca58';

-- INV/2025/692  |  CASH CUSTOMER  |  balance=0.300  diff=+0.300
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1aea8abc-2952-477d-bc2d-c4258334dbb6';

-- INV/2025/702  |  CASH MEMO  |  balance=1.100  diff=+1.100
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '92a7a752-c822-4a6d-ba5d-e2bc12534122';

-- INV/2025/721  |  CASH CUSTOMER  |  balance=0.331  diff=+0.332
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ff2d2260-a6f7-44c4-a3b1-2efb7f7b1d28';

-- INV/2025/734  |  CASH MEMO  |  balance=0.165  diff=+0.165
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '09b9d9fd-a8ae-474b-bdac-3e4921569c19';

-- INV/2025/753  |  CASH MEMO  |  balance=4.785  diff=+4.785
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e3d9d70c-358a-4efc-9e65-66b14974a71c';

-- INV/2025/782  |  CASH CUSTOMER  |  balance=0.082  diff=+0.082
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c4c38fdd-e1d4-4cd4-ab7e-757caf7401b7';

-- INV/2025/786  |  CASH MEMO  |  balance=0.300  diff=+0.300
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'fb798722-d66e-48e7-a27b-351f09e82536';

-- INV/2025/790  |  CASH MEMO  |  balance=0.025  diff=+0.025
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'bd68a934-3cda-46a8-b99f-65a7c5cb7b1a';

-- INV/2025/794  |  JIDHAFS TECHNICAL SECONDARY SCHOOL  |  balance=0.036  diff=+0.036
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '99961c0f-1399-40a6-92db-4c7d68af2a01';

-- INV/2025/820  |  CASH MEMO  |  balance=0.440  diff=+0.440
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1233402c-8f1e-481d-9327-839db5d8f3f3';

-- INV/2025/832  |  CASH MEMO  |  balance=0.667  diff=+0.667
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd703d3ec-c4ce-4e89-8f90-86f3f8408d58';

-- INV/2025/871  |  CASH MEMO  |  balance=0.103  diff=+0.103
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '4bd4b205-ef68-4f3a-a791-57b91ff3ffa9';

-- INV/2025/872  |  CASH MEMO  |  balance=0.034  diff=+0.034
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'ed3a4e0b-7447-416d-be8a-c9d21ed71385';

-- INV/2025/877  |  CASH MEMO  |  balance=0.074  diff=+0.074
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '20dd994f-2665-423f-8513-a474afb976de';

-- INV/2025/884  |  CASH MEMO  |  balance=0.220  diff=+0.220
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '1522a2c7-9f86-4d18-9fb3-fb4d87eeae88';

-- INV/2025/957  |  CASH MEMO  |  balance=0.067  diff=+0.067
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '98072074-b5f5-47b4-bcad-bb6bc26c2d0c';

-- INV/2025/958  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e4eb7ce5-2425-4d6d-a828-7150193c0b27';

-- INV/2025/979  |  CASH CUSTOMER  |  balance=0.140  diff=+0.140
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '8bca62c0-989d-411e-8da6-73a0899654cc';

-- INV/2025/980  |  SANA MAINTENANCE AND SERVICES W.L.L  |  balance=2.200  diff=+2.200
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '86298a28-2d95-49ee-aba4-d12570f417dd';

-- INV/2025/995  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b568fce1-4f77-44e6-9364-ea59fef066c8';

-- INV/2026/102  |  CASH MEMO  |  balance=0.012  diff=+0.012
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '6fa07bf0-b860-489b-b772-8ad1a438a85f';

-- INV/2026/160  |  CASH CUSTOMER  |  balance=0.951  diff=+0.951
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '36d0d4f1-2bd2-4400-ba89-2a6f8e42b498';

-- INV/2026/166  |  CASH CUSTOMER  |  balance=0.659  diff=+0.659
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a50c94bb-7153-4d79-880e-6ed96af1e5a9';

-- INV/2026/19  |  CASH MEMO  |  balance=0.330  diff=+0.330
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '44f52559-9f2c-4d5a-a6bc-ae443a0fe9ce';

-- INV/2026/199  |  ZEKO GENERAL TRADING  |  balance=0.055  diff=+0.055
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '18d0eb82-782b-4cf0-a6d7-730219ec6f8f';

-- INV/2026/220  |  NORTH WEST TRADING CO W.L.L  |  balance=0.009  diff=+0.009
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'e98920e0-aa26-4fb2-8fa9-ea0fe7909760';

-- INV/2026/223  |  CASH MEMO  |  balance=0.083  diff=+0.084
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '47e5df8f-707a-44e4-b1d2-bfae83d19bc6';

-- INV/2026/295  |  AL RAHMA K.K AUTO PARTS  |  balance=0.165  diff=+0.165
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2bb0cdda-9e59-4632-ab6f-a59fda85a01c';

-- INV/2026/296  |  CASH CUSTOMER  |  balance=0.275  diff=+0.275
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'dfcf134c-995e-468b-80c0-99b3e4e31f20';

-- INV/2026/308  |  AL RAHMA K.K AUTO PARTS  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd9c21ea5-d048-4f7a-a490-62c12749993e';

-- INV/2026/315  |  CASH CUSTOMER  |  balance=0.011  diff=+0.011
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '49a6bd5e-297a-47bc-a692-6299c5406f69';

-- INV/2026/332  |  CASH MEMO  |  balance=0.300  diff=+0.300
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b8bf4dd5-c4b5-41b9-807a-d78b708a3cbf';

-- INV/2026/34  |  CASH CUSTOMER  |  balance=0.219  diff=+0.219
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'cdb48303-2bbd-443c-9079-d45a59d11444';

-- INV/2026/396  |  CASH MEMO  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '7a388bae-32bd-4b50-b43f-13c5ea4ccafd';

-- INV/2026/464  |  CASH MEMO  |  balance=0.275  diff=+0.276
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '52ae396d-a276-4a08-b886-03c399cf5f5b';

-- INV/2026/479  |  CASH MEMO  |  balance=0.012  diff=+0.012
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a212c7fd-5cf0-4ee0-8667-732c4a3543db';

-- INV/2026/5  |  CASH CUSTOMER  |  balance=0.751  diff=+0.751
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '3a16507c-e570-4e95-8ab4-18c2c20edbc0';

-- INV/2026/517  |  CASH CUSTOMER  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '25d0185f-11ee-4e7d-a8b7-a715524ceaa3';

-- INV/2026/527  |  CASH CUSTOMER  |  balance=0.006  diff=+0.006
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'a52baa9e-822c-47dc-9a67-2af0e57a4c9e';

-- INV/2026/538  |  EVER FINE TRADING W.L.L  |  balance=1.540  diff=+1.540
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '50f6fa13-c63e-4348-b70c-c4dfd602b2dd';

-- INV/2026/543  |  CASH MEMO  |  balance=0.099  diff=+0.099
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'd4109613-3020-4464-939f-f278b44669bc';

-- INV/2026/548  |  CASH CUSTOMER  |  balance=0.015  diff=+0.015
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '06fdf0f2-5354-4a55-8fc7-be0b54601a81';

-- INV/2026/557  |  BEST LED LIGHTING CO.W.L.L  |  balance=5.445  diff=+5.445
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '2e30a0b0-5acf-4788-9024-677dd31832db';

-- INV/2026/578  |  BEST LED LIGHTING CO.W.L.L  |  balance=4.180  diff=+4.180
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '91565877-33f0-4064-89a3-defa63376eba';

-- INV/2026/59  |  CASH CUSTOMER  |  balance=1.122  diff=+1.122
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '29df48a4-b037-4ecd-b5c1-19c22c9344e4';

-- INV/2026/644  |  CASH MEMO  |  balance=0.007  diff=+0.007
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c7523a04-bec7-4272-8fe3-045a91d2d154';

-- INV/2026/75  |  ROYAL AMBASSDOR PROPERTY CO.W.L.L  |  balance=1.254  diff=+1.254
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'c3f290e6-548d-4798-ab4f-da328d4cdfd5';

-- INV/2026/95  |  CASH CUSTOMER  |  balance=0.990  diff=+0.990
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = 'b423272e-477c-4eaa-8637-e5d4bd15d619';

-- INV/2026/96  |  CASH CUSTOMER  |  balance=0.150  diff=+0.150
INSERT INTO payments (id, company_id, reference_type, reference_id, payment_date, amount, method, notes, created_by)
SELECT gen_random_uuid(), i.company_id, 'invoice', i.id, CURRENT_DATE,
       i.balance_due, 'other', 'SI import reconciliation — import calculation discrepancy (grand_total inflated vs SI)',
       (SELECT id FROM users WHERE role='admin' AND company_id=i.company_id LIMIT 1)
FROM invoices i WHERE i.id = '77f01b5a-3d63-4a9c-89b8-253db579fae1';

COMMIT;
