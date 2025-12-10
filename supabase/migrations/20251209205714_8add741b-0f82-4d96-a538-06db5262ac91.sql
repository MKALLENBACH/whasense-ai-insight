-- Add allow_followups to companies (Admin Whasense control)
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS allow_followups boolean NOT NULL DEFAULT true;

-- Create company_settings table for manager control
CREATE TABLE IF NOT EXISTS public.company_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  followups_enabled boolean NOT NULL DEFAULT true,
  followup_delay_hours integer NOT NULL DEFAULT 24 CHECK (followup_delay_hours >= 24),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Add seller_followups_enabled to profiles (per-seller control)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS seller_followups_enabled boolean NOT NULL DEFAULT true;

-- Enable RLS on company_settings
ALTER TABLE public.company_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for company_settings
CREATE POLICY "Admins can view all company_settings"
ON public.company_settings FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Admins can insert company_settings"
ON public.company_settings FOR INSERT
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update company_settings"
ON public.company_settings FOR UPDATE
USING (is_admin(auth.uid()));

CREATE POLICY "Managers can view own company settings"
ON public.company_settings FOR SELECT
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can insert own company settings"
ON public.company_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can update own company settings"
ON public.company_settings FOR UPDATE
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_company_settings_updated_at
BEFORE UPDATE ON public.company_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for company_settings
ALTER PUBLICATION supabase_realtime ADD TABLE public.company_settings;