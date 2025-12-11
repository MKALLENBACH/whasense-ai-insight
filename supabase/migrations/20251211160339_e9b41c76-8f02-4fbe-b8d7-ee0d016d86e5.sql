-- Fix customers table RLS policies to match access logic:
-- 1. Inbox Pai (assigned_to IS NULL) - only managers/admins can see
-- 2. Assigned leads - only assigned seller can see (+ manager/admin)

-- Drop policies that allow sellers to see unassigned leads
DROP POLICY IF EXISTS "Sellers can view unassigned company leads" ON public.customers;

-- Drop old policy that checks seller_id (should only check assigned_to)
DROP POLICY IF EXISTS "Sellers can view assigned customers" ON public.customers;

-- Create new policy: sellers can ONLY see customers assigned to them
CREATE POLICY "Sellers can view assigned customers" 
ON public.customers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid())
  AND assigned_to IS NOT NULL 
  AND assigned_to = auth.uid()
);