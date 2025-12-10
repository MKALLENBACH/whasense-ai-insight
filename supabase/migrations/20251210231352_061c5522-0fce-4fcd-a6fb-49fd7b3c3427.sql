-- Create whatsapp_seller_integrations table for per-seller WhatsApp Cloud API integration
CREATE TABLE public.whatsapp_seller_integrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone_number_id text NOT NULL,
  whatsapp_business_account_id text NOT NULL,
  access_token text NOT NULL,
  verification_token text NOT NULL,
  display_phone_number text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('connected', 'pending', 'error', 'disconnected')),
  last_error text,
  last_webhook_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(seller_id),
  UNIQUE(phone_number_id)
);

-- Enable RLS
ALTER TABLE public.whatsapp_seller_integrations ENABLE ROW LEVEL SECURITY;

-- Indexes for performance
CREATE INDEX idx_whatsapp_seller_integrations_seller ON public.whatsapp_seller_integrations(seller_id);
CREATE INDEX idx_whatsapp_seller_integrations_company ON public.whatsapp_seller_integrations(company_id);
CREATE INDEX idx_whatsapp_seller_integrations_phone ON public.whatsapp_seller_integrations(phone_number_id);
CREATE INDEX idx_whatsapp_seller_integrations_status ON public.whatsapp_seller_integrations(status);

-- RLS Policies
-- Sellers can view and manage their own integration
CREATE POLICY "Sellers can view own integration"
ON public.whatsapp_seller_integrations
FOR SELECT
USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert own integration"
ON public.whatsapp_seller_integrations
FOR INSERT
WITH CHECK (seller_id = auth.uid() AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Sellers can update own integration"
ON public.whatsapp_seller_integrations
FOR UPDATE
USING (seller_id = auth.uid());

CREATE POLICY "Sellers can delete own integration"
ON public.whatsapp_seller_integrations
FOR DELETE
USING (seller_id = auth.uid());

-- Managers can view company integrations (but NOT tokens - handled in query)
CREATE POLICY "Managers can view company integrations status"
ON public.whatsapp_seller_integrations
FOR SELECT
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

-- Admins can view all
CREATE POLICY "Admins can view all integrations"
ON public.whatsapp_seller_integrations
FOR SELECT
USING (is_admin(auth.uid()));

-- System can manage all (for webhooks)
CREATE POLICY "System can manage integrations"
ON public.whatsapp_seller_integrations
FOR ALL
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_whatsapp_seller_integrations_updated_at
BEFORE UPDATE ON public.whatsapp_seller_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for status updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.whatsapp_seller_integrations;