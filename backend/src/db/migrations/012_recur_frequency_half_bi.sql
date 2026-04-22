-- Add half_yearly (every 6 months) and bi_annual (every 2 years) to recur_frequency enum
-- Required for Bahrain W.L.L. expenses: insurance renewals (half_yearly),
-- residence/work permit renewals (bi_annual)

ALTER TYPE recur_frequency ADD VALUE IF NOT EXISTS 'half_yearly';
ALTER TYPE recur_frequency ADD VALUE IF NOT EXISTS 'bi_annual';
