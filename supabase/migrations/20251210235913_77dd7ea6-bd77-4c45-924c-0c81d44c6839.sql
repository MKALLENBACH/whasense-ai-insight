-- Add assigned_to column to customers table for lead assignment
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES auth.users(id);

-- Create index for performance on assigned_to queries
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON public.customers(assigned_to);
CREATE INDEX IF NOT EXISTS idx_customers_company_assigned ON public.customers(company_id, assigned_to);

-- Create manager operation settings table
CREATE TABLE IF NOT EXISTS public.manager_operation_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL UNIQUE,
  distribution_method TEXT NOT NULL DEFAULT 'manual',
  allow_free_pull BOOLEAN NOT NULL DEFAULT true,
  require_approval BOOLEAN NOT NULL DEFAULT false,
  max_active_leads_per_seller INTEGER NOT NULL DEFAULT 0,
  manager_can_reassign BOOLEAN NOT NULL DEFAULT true,
  manager_can_move_leads BOOLEAN NOT NULL DEFAULT true,
  notify_on_lead_loss BOOLEAN NOT NULL DEFAULT true,
  ai_after_assignment_only BOOLEAN NOT NULL DEFAULT true,
  inbox_ordering TEXT NOT NULL DEFAULT 'last_message',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.manager_operation_settings ENABLE ROW LEVEL SECURITY;

-- RLS policies for manager_operation_settings
CREATE POLICY "Admins can manage all settings"
ON public.manager_operation_settings FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Managers can view own company settings"
ON public.manager_operation_settings FOR SELECT
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can insert own company settings"
ON public.manager_operation_settings FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can update own company settings"
ON public.manager_operation_settings FOR UPDATE
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Sellers can view company settings"
ON public.manager_operation_settings FOR SELECT
USING (has_role(auth.uid(), 'seller') AND company_id = get_user_company(auth.uid()));

-- Create trigger for updated_at
CREATE TRIGGER update_manager_operation_settings_updated_at
BEFORE UPDATE ON public.manager_operation_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Update RLS policy for customers to allow sellers to see unassigned leads (Inbox Pai)
CREATE POLICY "Sellers can view unassigned company leads"
ON public.customers FOR SELECT
USING (
  has_role(auth.uid(), 'seller') 
  AND company_id = get_user_company(auth.uid())
  AND assigned_to IS NULL
);

-- Policy for sellers to update customers when pulling leads
CREATE POLICY "Sellers can pull unassigned leads"
ON public.customers FOR UPDATE
USING (
  has_role(auth.uid(), 'seller')
  AND company_id = get_user_company(auth.uid())
  AND assigned_to IS NULL
)
WITH CHECK (
  has_role(auth.uid(), 'seller')
  AND company_id = get_user_company(auth.uid())
  AND assigned_to = auth.uid()
);