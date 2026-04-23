-- Add token_version to users for force-logout support.
-- Incrementing this column invalidates all previously issued JWTs for the user.
ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INT NOT NULL DEFAULT 0;
