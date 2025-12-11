-- Create index on customers.assigned_to for optimizing Inbox Pai queries
CREATE INDEX IF NOT EXISTS idx_customers_assigned_to ON public.customers(assigned_to);

-- Create composite index for company + assigned_to queries (most common pattern)
CREATE INDEX IF NOT EXISTS idx_customers_company_assigned ON public.customers(company_id, assigned_to);

-- Create index for filtering unassigned leads by status
CREATE INDEX IF NOT EXISTS idx_customers_company_assigned_status ON public.customers(company_id, assigned_to, lead_status);

-- Enable realtime for customers table
ALTER PUBLICATION supabase_realtime ADD TABLE public.customers;