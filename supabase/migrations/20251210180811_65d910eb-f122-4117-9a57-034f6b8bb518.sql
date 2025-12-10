-- Add stripe_price_id columns to plans table for proper mapping
ALTER TABLE public.plans 
ADD COLUMN IF NOT EXISTS stripe_monthly_price_id text,
ADD COLUMN IF NOT EXISTS stripe_annual_price_id text;

-- Create index for fast lookup
CREATE INDEX IF NOT EXISTS idx_plans_stripe_monthly_price ON public.plans(stripe_monthly_price_id);
CREATE INDEX IF NOT EXISTS idx_plans_stripe_annual_price ON public.plans(stripe_annual_price_id);