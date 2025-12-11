-- Add auto-close delay hours column to company_settings
ALTER TABLE public.company_settings 
ADD COLUMN IF NOT EXISTS auto_close_delay_hours integer NOT NULL DEFAULT 24;

-- Add comment for documentation
COMMENT ON COLUMN public.company_settings.auto_close_delay_hours IS 'Hours to wait before auto-closing a cycle due to no customer response';