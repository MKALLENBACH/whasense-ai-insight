-- Fix: Add explicit WITH CHECK to ensure sellers can update their customers
DROP POLICY IF EXISTS "Sellers can update their customers" ON public.customers;

CREATE POLICY "Sellers can update their customers" 
ON public.customers 
FOR UPDATE 
USING (seller_id = auth.uid())
WITH CHECK (seller_id = auth.uid());