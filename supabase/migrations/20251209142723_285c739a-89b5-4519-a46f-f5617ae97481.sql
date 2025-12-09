-- Create enum for lead status
CREATE TYPE public.lead_status AS ENUM ('pending', 'in_progress', 'won', 'lost');

-- Add lead_status column to customers table
ALTER TABLE public.customers 
ADD COLUMN lead_status public.lead_status NOT NULL DEFAULT 'pending';

-- Create function to update lead_status when a sale is registered
CREATE OR REPLACE FUNCTION public.update_customer_lead_status()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.customers
  SET lead_status = NEW.status::text::public.lead_status
  WHERE id = NEW.customer_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger to auto-update lead_status on sale insert/update
CREATE TRIGGER on_sale_status_change
  AFTER INSERT OR UPDATE OF status ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.update_customer_lead_status();

-- Update existing customers based on their sales
UPDATE public.customers c
SET lead_status = COALESCE(
  (SELECT s.status::text::public.lead_status
   FROM public.sales s
   WHERE s.customer_id = c.id
   ORDER BY s.created_at DESC
   LIMIT 1),
  'pending'::public.lead_status
);