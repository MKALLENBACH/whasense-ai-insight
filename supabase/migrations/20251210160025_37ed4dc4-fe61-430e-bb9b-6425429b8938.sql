
-- Create function to auto-fill buyer_id and client_id on sale_cycles
CREATE OR REPLACE FUNCTION public.auto_fill_sale_cycle_references()
RETURNS TRIGGER AS $$
DECLARE
  customer_record RECORD;
BEGIN
  -- Get buyer_id and client_id from the customer
  SELECT buyer_id, client_id INTO customer_record
  FROM public.customers
  WHERE id = NEW.customer_id;
  
  -- Auto-fill if the sale_cycle values are null but customer has them
  IF NEW.buyer_id IS NULL AND customer_record.buyer_id IS NOT NULL THEN
    NEW.buyer_id := customer_record.buyer_id;
  END IF;
  
  IF NEW.client_id IS NULL AND customer_record.client_id IS NOT NULL THEN
    NEW.client_id := customer_record.client_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on INSERT
CREATE TRIGGER auto_fill_sale_cycle_refs_on_insert
BEFORE INSERT ON public.sale_cycles
FOR EACH ROW
EXECUTE FUNCTION public.auto_fill_sale_cycle_references();

-- Create trigger on UPDATE (in case customer is linked later)
CREATE TRIGGER auto_fill_sale_cycle_refs_on_update
BEFORE UPDATE ON public.sale_cycles
FOR EACH ROW
WHEN (NEW.buyer_id IS NULL OR NEW.client_id IS NULL)
EXECUTE FUNCTION public.auto_fill_sale_cycle_references();
