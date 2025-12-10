-- Add cycle tracking fields
ALTER TABLE public.sale_cycles 
ADD COLUMN IF NOT EXISTS start_message_id UUID REFERENCES public.messages(id),
ADD COLUMN IF NOT EXISTS start_message_timestamp TIMESTAMP WITH TIME ZONE;

-- Create index for faster lookup
CREATE INDEX IF NOT EXISTS idx_sale_cycles_start_message 
ON public.sale_cycles(start_message_id);

CREATE INDEX IF NOT EXISTS idx_sale_cycles_customer_status 
ON public.sale_cycles(customer_id, status);

-- Update existing cycles to set start_message_timestamp from first message
UPDATE public.sale_cycles sc
SET start_message_timestamp = (
  SELECT MIN(m.timestamp)
  FROM public.messages m
  WHERE m.cycle_id = sc.id
)
WHERE sc.start_message_timestamp IS NULL;