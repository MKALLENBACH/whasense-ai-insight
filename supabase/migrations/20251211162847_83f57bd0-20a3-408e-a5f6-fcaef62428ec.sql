-- Fix RLS policy on clients table - sellers should only see clients linked to their assigned customers
DROP POLICY IF EXISTS "Sellers can view company clients" ON public.clients;
CREATE POLICY "Sellers can view clients of assigned customers"
ON public.clients
FOR SELECT
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.client_id = clients.id
    AND c.assigned_to = auth.uid()
  )
);

-- Fix RLS policy on buyers table - sellers should only see buyers linked to their assigned customers
DROP POLICY IF EXISTS "Sellers can view company buyers" ON public.buyers;
CREATE POLICY "Sellers can view buyers of assigned customers"
ON public.buyers
FOR SELECT
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.client_id = buyers.client_id
    AND c.assigned_to = auth.uid()
  )
);