-- Add a broader policy to ensure sellers can update customers they have access to
CREATE POLICY "Sellers can update company customers" 
ON public.customers 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid())
  AND (seller_id = auth.uid() OR assigned_to = auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'seller'::app_role) 
  AND company_id = get_user_company(auth.uid())
);