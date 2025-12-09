-- Create sale_cycles table
CREATE TABLE public.sale_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  status public.lead_status NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  closed_at timestamp with time zone,
  lost_reason text,
  won_summary text,
  CONSTRAINT one_active_cycle_per_customer UNIQUE (customer_id, status) 
    DEFERRABLE INITIALLY DEFERRED
);

-- Create index for faster lookups
CREATE INDEX idx_sale_cycles_customer_id ON public.sale_cycles(customer_id);
CREATE INDEX idx_sale_cycles_seller_id ON public.sale_cycles(seller_id);
CREATE INDEX idx_sale_cycles_status ON public.sale_cycles(status);

-- Add cycle_id to messages table
ALTER TABLE public.messages ADD COLUMN cycle_id uuid REFERENCES public.sale_cycles(id);
CREATE INDEX idx_messages_cycle_id ON public.messages(cycle_id);

-- Enable RLS on sale_cycles
ALTER TABLE public.sale_cycles ENABLE ROW LEVEL SECURITY;

-- RLS Policies for sale_cycles
CREATE POLICY "Sellers can view own cycles"
ON public.sale_cycles
FOR SELECT
USING (seller_id = auth.uid());

CREATE POLICY "Sellers can insert own cycles"
ON public.sale_cycles
FOR INSERT
WITH CHECK (seller_id = auth.uid());

CREATE POLICY "Sellers can update own cycles"
ON public.sale_cycles
FOR UPDATE
USING (seller_id = auth.uid());

CREATE POLICY "Managers can view company cycles"
ON public.sale_cycles
FOR SELECT
USING (
  has_role(auth.uid(), 'manager') AND 
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.user_id = auth.uid() AND p2.user_id = sale_cycles.seller_id
  )
);

CREATE POLICY "Managers can update company cycles"
ON public.sale_cycles
FOR UPDATE
USING (
  has_role(auth.uid(), 'manager') AND 
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.user_id = auth.uid() AND p2.user_id = sale_cycles.seller_id
  )
);

CREATE POLICY "System can insert cycles"
ON public.sale_cycles
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update cycles"
ON public.sale_cycles
FOR UPDATE
USING (true);

-- Function to get or create active cycle for a customer
CREATE OR REPLACE FUNCTION public.get_or_create_active_cycle(
  _customer_id uuid,
  _seller_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _cycle_id uuid;
BEGIN
  -- Try to find an active cycle
  SELECT id INTO _cycle_id
  FROM public.sale_cycles
  WHERE customer_id = _customer_id
    AND status IN ('pending', 'in_progress')
  LIMIT 1;
  
  -- If no active cycle, create one
  IF _cycle_id IS NULL THEN
    INSERT INTO public.sale_cycles (customer_id, seller_id, status)
    VALUES (_customer_id, _seller_id, 'pending')
    RETURNING id INTO _cycle_id;
  END IF;
  
  RETURN _cycle_id;
END;
$$;

-- Function to close a cycle
CREATE OR REPLACE FUNCTION public.close_sale_cycle(
  _cycle_id uuid,
  _status public.lead_status,
  _reason text DEFAULT NULL,
  _summary text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.sale_cycles
  SET 
    status = _status,
    closed_at = now(),
    lost_reason = CASE WHEN _status = 'lost' THEN _reason ELSE NULL END,
    won_summary = CASE WHEN _status = 'won' THEN _summary ELSE NULL END
  WHERE id = _cycle_id;
  
  -- Also update the customer's lead_status
  UPDATE public.customers
  SET lead_status = _status
  WHERE id = (SELECT customer_id FROM public.sale_cycles WHERE id = _cycle_id);
END;
$$;

-- Enable realtime for sale_cycles
ALTER PUBLICATION supabase_realtime ADD TABLE public.sale_cycles;

-- Drop the unique constraint that doesn't work well with multiple cycles
ALTER TABLE public.sale_cycles DROP CONSTRAINT IF EXISTS one_active_cycle_per_customer;

-- Create a proper partial unique index instead
CREATE UNIQUE INDEX idx_one_active_cycle_per_customer 
ON public.sale_cycles (customer_id) 
WHERE status IN ('pending', 'in_progress');