-- Add free trial date columns to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS free_start_date date,
ADD COLUMN IF NOT EXISTS free_end_date date;

-- Update Free plan to have all features (same as Enterprise)
UPDATE public.plans 
SET features = '{
  "canAccess360": true,
  "canUseFollowups": true,
  "canUseGamification": true,
  "canAccessFullDashboard": true
}'::jsonb
WHERE name = 'Free';

-- Make sure Free plan is active but not visible to managers
UPDATE public.plans 
SET is_active = true, visible_to_managers = false
WHERE name = 'Free';