-- Drop old policy for sellers on insights
DROP POLICY IF EXISTS "Sellers can view insights of own messages" ON public.insights;

-- Create new policy that checks assigned_to on the customer
CREATE POLICY "Sellers can view insights of own messages" 
ON public.insights 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND EXISTS (
    SELECT 1 FROM messages m
    JOIN customers c ON c.id = m.customer_id
    WHERE m.id = insights.message_id 
    AND c.assigned_to = auth.uid()
  )
);