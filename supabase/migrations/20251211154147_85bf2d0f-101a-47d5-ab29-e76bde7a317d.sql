-- Fix customers UPDATE policies: change from RESTRICTIVE to PERMISSIVE
-- so that ANY matching policy allows the update

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Sellers can update their customers" ON public.customers;
DROP POLICY IF EXISTS "Sellers can pull unassigned leads" ON public.customers;

-- Create permissive policies (default is PERMISSIVE)
CREATE POLICY "Sellers can update their customers" 
ON public.customers 
FOR UPDATE 
USING (seller_id = auth.uid());

CREATE POLICY "Sellers can pull unassigned leads" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid()) 
  AND assigned_to IS NULL
)
WITH CHECK (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid()) 
  AND assigned_to = auth.uid()
);