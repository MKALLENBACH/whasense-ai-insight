-- Add cycle_id to alerts table
ALTER TABLE public.alerts ADD COLUMN IF NOT EXISTS cycle_id uuid REFERENCES public.sale_cycles(id);

-- Create unique constraint for upsert operations
-- First drop existing constraint if exists
DROP INDEX IF EXISTS alerts_customer_seller_type_unique;

-- Create unique index on customer_id, seller_id, alert_type
CREATE UNIQUE INDEX alerts_customer_seller_type_unique ON public.alerts(customer_id, seller_id, alert_type);

-- Add index for faster lookups by cycle
CREATE INDEX IF NOT EXISTS idx_alerts_cycle_id ON public.alerts(cycle_id);

-- Add index for faster lookups by customer
CREATE INDEX IF NOT EXISTS idx_alerts_customer_id ON public.alerts(customer_id);