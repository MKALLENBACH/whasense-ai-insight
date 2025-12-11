-- Add policy for sellers to view customers assigned to them
CREATE POLICY "Sellers can view assigned customers" 
ON public.customers 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid())
  AND (seller_id = auth.uid() OR assigned_to = auth.uid())
);