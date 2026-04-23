-- Link issued cheques to a company bank account.
-- Nullable so all existing cheques remain valid (bank_name free-text is still kept).
ALTER TABLE cheques
  ADD COLUMN IF NOT EXISTS bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE SET NULL;
