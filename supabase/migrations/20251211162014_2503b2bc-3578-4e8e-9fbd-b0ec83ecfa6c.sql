-- Add 'relocated' status to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'relocated';

-- Update RLS policy on messages to allow sellers to see ALL messages from their assigned customers
-- (including messages from previous cycles with other sellers)
DROP POLICY IF EXISTS "Sellers can view assigned customer messages" ON public.messages;

CREATE POLICY "Sellers can view assigned customer messages" 
ON public.messages 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = messages.customer_id 
    AND c.assigned_to = auth.uid()
  )
);

-- Also update insights policy to see all insights from messages of assigned customers
DROP POLICY IF EXISTS "Sellers can view insights of own messages" ON public.insights;

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

-- Update sale_cycles RLS to allow sellers to see all cycles of their assigned customers
DROP POLICY IF EXISTS "Sellers can view their cycles" ON public.sale_cycles;
DROP POLICY IF EXISTS "Sellers can view assigned customer cycles" ON public.sale_cycles;

CREATE POLICY "Sellers can view assigned customer cycles" 
ON public.sale_cycles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'seller'::app_role) 
  AND EXISTS (
    SELECT 1 FROM customers c
    WHERE c.id = sale_cycles.customer_id 
    AND c.assigned_to = auth.uid()
  )
);