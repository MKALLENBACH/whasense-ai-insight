-- Create companies table
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to profiles
ALTER TABLE public.profiles ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add company_id to customers
ALTER TABLE public.customers ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Add company_id to sales  
ALTER TABLE public.sales ADD COLUMN company_id UUID REFERENCES public.companies(id);

-- Create index for performance
CREATE INDEX idx_profiles_company ON public.profiles(company_id);
CREATE INDEX idx_customers_company ON public.customers(company_id);
CREATE INDEX idx_sales_company ON public.sales(company_id);
CREATE INDEX idx_messages_seller ON public.messages(seller_id);

-- Function to get user's company
CREATE OR REPLACE FUNCTION public.get_user_company(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id
  FROM public.profiles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS for companies
CREATE POLICY "Users can view their company" ON public.companies
  FOR SELECT USING (
    id = public.get_user_company(auth.uid())
  );

-- Update profiles RLS to include company access for managers
DROP POLICY IF EXISTS "Managers can view all profiles" ON public.profiles;
CREATE POLICY "Managers can view company profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager') 
    AND company_id = public.get_user_company(auth.uid())
  );

-- Update customers RLS
DROP POLICY IF EXISTS "Sellers can view their customers" ON public.customers;
DROP POLICY IF EXISTS "Managers can view all customers" ON public.customers;

CREATE POLICY "Sellers can view their customers" ON public.customers
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.messages 
      WHERE messages.customer_id = customers.id 
      AND messages.seller_id = auth.uid()
    )
  );

CREATE POLICY "Managers can view company customers" ON public.customers
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager')
    AND company_id = public.get_user_company(auth.uid())
  );

CREATE POLICY "Users can insert customers with company" ON public.customers
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company(auth.uid())
  );

-- Update messages RLS
DROP POLICY IF EXISTS "Managers can view all messages" ON public.messages;
CREATE POLICY "Managers can view company messages" ON public.messages
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager')
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.user_id = messages.seller_id
      AND profiles.company_id = public.get_user_company(auth.uid())
    )
  );

-- Update sales RLS
DROP POLICY IF EXISTS "Managers can view all sales" ON public.sales;
CREATE POLICY "Managers can view company sales" ON public.sales
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager')
    AND company_id = public.get_user_company(auth.uid())
  );

CREATE POLICY "Users can insert sales with company" ON public.sales
  FOR INSERT WITH CHECK (
    company_id = public.get_user_company(auth.uid())
  );

-- Update insights RLS
DROP POLICY IF EXISTS "Managers can view all insights" ON public.insights;
CREATE POLICY "Managers can view company insights" ON public.insights
  FOR SELECT USING (
    public.has_role(auth.uid(), 'manager')
    AND EXISTS (
      SELECT 1 FROM public.messages
      JOIN public.profiles ON profiles.user_id = messages.seller_id
      WHERE messages.id = insights.message_id
      AND profiles.company_id = public.get_user_company(auth.uid())
    )
  );

-- Trigger to update companies updated_at
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();