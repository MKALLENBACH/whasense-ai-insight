-- Fix can_access_customer function with correct access logic:
-- 1. Inbox Pai (assigned_to IS NULL) - only managers/admins can see
-- 2. Seller pulled - only assigned seller can see (+ manager/admin)
-- 3. Reallocated - only new seller can see (+ manager/admin)
-- 4. Back to inbox - only managers/admins can see

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
      -- Admins can see all
      is_admin(auth.uid())
      -- Managers can see all company customers
      OR has_role(auth.uid(), 'manager'::app_role)
      -- Sellers can ONLY see if assigned to them (not unassigned leads)
      OR (
        has_role(auth.uid(), 'seller'::app_role) 
        AND c.assigned_to IS NOT NULL 
        AND c.assigned_to = auth.uid()
      )
    )
  )
$$;