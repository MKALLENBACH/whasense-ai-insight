-- Create security definer function to check if user can access a customer
CREATE OR REPLACE FUNCTION public.can_access_customer(_customer_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = _customer_id
    AND c.company_id = get_user_company(auth.uid())
    AND (
      c.seller_id = auth.uid() 
      OR c.assigned_to = auth.uid()
      OR c.assigned_to IS NULL
      OR has_role(auth.uid(), 'manager'::app_role)
      OR is_admin(auth.uid())
    )
  )
$$;

-- Drop the problematic recursive policy on customers
DROP POLICY IF EXISTS "Sellers can view their customers" ON public.customers;

-- Drop the policy I just added that caused more recursion
DROP POLICY IF EXISTS "Sellers can view assigned customer messages" ON public.messages;

-- Recreate the messages policy using the security definer function
CREATE POLICY "Sellers can view assigned customer messages" 
ON public.messages 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND can_access_customer(customer_id)
);