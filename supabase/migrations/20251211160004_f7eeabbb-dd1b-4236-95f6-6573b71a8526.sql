-- Add policy for sellers to view messages from their assigned customers
CREATE POLICY "Sellers can view assigned customer messages" 
ON public.messages 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = messages.customer_id
    AND c.company_id = get_user_company(auth.uid())
    AND (c.seller_id = auth.uid() OR c.assigned_to = auth.uid())
  )
);