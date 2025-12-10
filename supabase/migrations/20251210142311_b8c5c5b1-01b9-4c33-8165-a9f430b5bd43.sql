-- Add cycle_type column to sale_cycles
ALTER TABLE public.sale_cycles 
ADD COLUMN cycle_type text NOT NULL DEFAULT 'pre_sale' 
CHECK (cycle_type IN ('pre_sale', 'post_sale'));

-- Add 'closed' status to lead_status enum
ALTER TYPE public.lead_status ADD VALUE IF NOT EXISTS 'closed';

-- Create index for cycle_type queries
CREATE INDEX idx_sale_cycles_cycle_type ON public.sale_cycles(cycle_type);

-- Update the close_sale_cycle function to support closing post-sale cycles
CREATE OR REPLACE FUNCTION public.close_sale_cycle(_cycle_id uuid, _status lead_status, _reason text DEFAULT NULL::text, _summary text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  UPDATE public.sale_cycles
  SET 
    status = _status,
    closed_at = now(),
    lost_reason = CASE WHEN _status = 'lost' THEN _reason ELSE NULL END,
    won_summary = CASE WHEN _status = 'won' THEN _summary ELSE NULL END
  WHERE id = _cycle_id;
  
  -- Only update customer's lead_status for pre_sale cycles (not post_sale)
  IF _status != 'closed' THEN
    UPDATE public.customers
    SET lead_status = _status
    WHERE id = (SELECT customer_id FROM public.sale_cycles WHERE id = _cycle_id);
  END IF;
END;
$function$;