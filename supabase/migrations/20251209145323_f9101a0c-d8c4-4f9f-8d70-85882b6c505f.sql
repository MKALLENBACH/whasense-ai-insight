-- Add is_incomplete field to customers table
ALTER TABLE public.customers 
ADD COLUMN IF NOT EXISTS is_incomplete boolean NOT NULL DEFAULT false;

-- Add segment and description fields to companies table
ALTER TABLE public.companies 
ADD COLUMN IF NOT EXISTS segment text,
ADD COLUMN IF NOT EXISTS description text;

-- Create index for faster queries on incomplete leads
CREATE INDEX IF NOT EXISTS idx_customers_is_incomplete ON public.customers(is_incomplete) WHERE is_incomplete = true;

-- Create index for lead status queries
CREATE INDEX IF NOT EXISTS idx_customers_lead_status ON public.customers(lead_status);

-- Update RLS policy for customers to allow sellers to update their own leads
DROP POLICY IF EXISTS "Sellers can update their customers" ON public.customers;
CREATE POLICY "Sellers can update their customers" 
ON public.customers 
FOR UPDATE 
USING (seller_id = auth.uid());

-- Allow managers to update company customers
DROP POLICY IF EXISTS "Managers can update company customers" ON public.customers;
CREATE POLICY "Managers can update company customers" 
ON public.customers 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role) AND (company_id = get_user_company(auth.uid())));

-- Update companies RLS to allow sellers to insert
DROP POLICY IF EXISTS "Users can insert companies" ON public.companies;
CREATE POLICY "Users can insert companies" 
ON public.companies 
FOR INSERT 
WITH CHECK (true);

-- Allow users to view all companies (for dropdown)
DROP POLICY IF EXISTS "Users can view all companies" ON public.companies;
CREATE POLICY "Users can view all companies" 
ON public.companies 
FOR SELECT 
USING (true);

-- Allow managers to update companies
DROP POLICY IF EXISTS "Managers can update companies" ON public.companies;
CREATE POLICY "Managers can update companies" 
ON public.companies 
FOR UPDATE 
USING (has_role(auth.uid(), 'manager'::app_role));