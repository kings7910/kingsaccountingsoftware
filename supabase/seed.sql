-- Development-only seed helpers. Production must never execute this file automatically.
-- Create users through Supabase Auth first, then insert a company and membership using their UUID.

-- Trucking categories are inserted for each company by the onboarding server action.
-- Keep this file intentionally data-free so local resets never create realistic
-- financial, payroll, banking, or personally identifiable records.
