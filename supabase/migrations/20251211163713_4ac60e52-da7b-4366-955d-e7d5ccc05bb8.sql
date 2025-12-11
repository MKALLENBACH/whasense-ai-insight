-- Add policy to allow sellers to view all clients in their company (for linking purposes)
-- This prevents duplicate client creation
CREATE POLICY "Sellers can view all company clients for linking"
ON public.clients
FOR SELECT
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid())
);

-- Same for buyers - sellers need to see all buyers to avoid duplicate creation
CREATE POLICY "Sellers can view all company buyers for linking"
ON public.buyers
FOR SELECT
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid())
);