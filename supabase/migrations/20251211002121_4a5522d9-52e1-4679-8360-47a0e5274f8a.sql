-- Create company_whatsapp_settings table
CREATE TABLE public.company_whatsapp_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id) ON DELETE CASCADE,
  waba_id TEXT,
  phone_number_id TEXT,
  permanent_token TEXT,
  verification_token TEXT,
  display_phone_number TEXT,
  status TEXT NOT NULL DEFAULT 'disconnected',
  last_check TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_whatsapp_settings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view all company_whatsapp_settings"
  ON public.company_whatsapp_settings FOR SELECT
  USING (is_admin(auth.uid()));

CREATE POLICY "Admins can manage all company_whatsapp_settings"
  ON public.company_whatsapp_settings FOR ALL
  USING (is_admin(auth.uid()));

CREATE POLICY "Managers can view own company settings"
  ON public.company_whatsapp_settings FOR SELECT
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can insert own company settings"
  ON public.company_whatsapp_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can update own company settings"
  ON public.company_whatsapp_settings FOR UPDATE
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can delete own company settings"
  ON public.company_whatsapp_settings FOR DELETE
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

-- Create index for faster lookups
CREATE INDEX idx_company_whatsapp_settings_company ON public.company_whatsapp_settings(company_id);
CREATE INDEX idx_company_whatsapp_settings_phone ON public.company_whatsapp_settings(phone_number_id);

-- Add trigger for updated_at
CREATE TRIGGER update_company_whatsapp_settings_updated_at
  BEFORE UPDATE ON public.company_whatsapp_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();