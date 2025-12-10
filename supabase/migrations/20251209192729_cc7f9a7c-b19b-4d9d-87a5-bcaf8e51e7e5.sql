
-- Add last_activity_at column to sale_cycles
ALTER TABLE public.sale_cycles 
ADD COLUMN IF NOT EXISTS last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create function to update last_activity_at on new messages
CREATE OR REPLACE FUNCTION public.update_cycle_last_activity()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.cycle_id IS NOT NULL THEN
    UPDATE public.sale_cycles
    SET last_activity_at = now()
    WHERE id = NEW.cycle_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to update last_activity_at when a message is inserted
DROP TRIGGER IF EXISTS update_cycle_activity_on_message ON public.messages;
CREATE TRIGGER update_cycle_activity_on_message
AFTER INSERT ON public.messages
FOR EACH ROW
EXECUTE FUNCTION public.update_cycle_last_activity();

-- Update existing cycles with last_activity_at based on their messages
UPDATE public.sale_cycles sc
SET last_activity_at = COALESCE(
  (SELECT MAX(timestamp) FROM public.messages WHERE cycle_id = sc.id),
  sc.created_at
);
