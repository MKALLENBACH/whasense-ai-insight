-- Add features JSON to plans table
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS features jsonb DEFAULT '{
  "canAccess360": false,
  "canUseGamification": false,
  "canUseFollowups": false,
  "canAccessFullDashboard": true
}'::jsonb;

-- Add trial_ends_at to companies for Free trial tracking
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS trial_ends_at timestamp with time zone;

-- Update existing plans with their correct features
-- Free (all features during trial)
UPDATE public.plans SET features = '{
  "canAccess360": true,
  "canUseGamification": true,
  "canUseFollowups": true,
  "canAccessFullDashboard": true
}'::jsonb WHERE name = 'Free';

-- Starter (no 360, no followups, no gamification)
UPDATE public.plans SET features = '{
  "canAccess360": false,
  "canUseGamification": false,
  "canUseFollowups": false,
  "canAccessFullDashboard": true
}'::jsonb WHERE name = 'Starter';

-- Pro (no 360, no followups, but has gamification)
UPDATE public.plans SET features = '{
  "canAccess360": false,
  "canUseGamification": true,
  "canUseFollowups": false,
  "canAccessFullDashboard": true
}'::jsonb WHERE name = 'Pro';

-- Premium (no 360, but has followups and gamification)
UPDATE public.plans SET features = '{
  "canAccess360": false,
  "canUseGamification": true,
  "canUseFollowups": true,
  "canAccessFullDashboard": true
}'::jsonb WHERE name = 'Premium';

-- Enterprise (everything)
UPDATE public.plans SET features = '{
  "canAccess360": true,
  "canUseGamification": true,
  "canUseFollowups": true,
  "canAccessFullDashboard": true
}'::jsonb WHERE name = 'Enterprise';

-- Inativo (nothing)
UPDATE public.plans SET features = '{
  "canAccess360": false,
  "canUseGamification": false,
  "canUseFollowups": false,
  "canAccessFullDashboard": false
}'::jsonb WHERE name = 'Inativo';