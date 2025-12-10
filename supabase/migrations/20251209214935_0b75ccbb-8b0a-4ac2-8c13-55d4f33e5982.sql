-- ====================================================================
-- TABELA: clients (Empresas Clientes atendidas)
-- ====================================================================
CREATE TABLE public.clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cnpj TEXT,
  segment TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- RLS Policies for clients
CREATE POLICY "Admins can view all clients"
ON public.clients FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Managers can view company clients"
ON public.clients FOR SELECT
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Sellers can view company clients"
ON public.clients FOR SELECT
USING (has_role(auth.uid(), 'seller') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can insert clients"
ON public.clients FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Sellers can insert clients"
ON public.clients FOR INSERT
WITH CHECK (has_role(auth.uid(), 'seller') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can update clients"
ON public.clients FOR UPDATE
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can delete clients"
ON public.clients FOR DELETE
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_clients_updated_at
BEFORE UPDATE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- TABELA: buyers (Compradores - pessoas dentro da empresa cliente)
-- ====================================================================
CREATE TABLE public.buyers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  role TEXT, -- cargo do comprador
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.buyers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for buyers
CREATE POLICY "Admins can view all buyers"
ON public.buyers FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Managers can view company buyers"
ON public.buyers FOR SELECT
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Sellers can view company buyers"
ON public.buyers FOR SELECT
USING (has_role(auth.uid(), 'seller') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can insert buyers"
ON public.buyers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Sellers can insert buyers"
ON public.buyers FOR INSERT
WITH CHECK (has_role(auth.uid(), 'seller') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Managers can update buyers"
ON public.buyers FOR UPDATE
USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

CREATE POLICY "Sellers can update buyers"
ON public.buyers FOR UPDATE
USING (has_role(auth.uid(), 'seller') AND company_id = get_user_company(auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_buyers_updated_at
BEFORE UPDATE ON public.buyers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- ====================================================================
-- ADICIONAR COLUNAS ÀS TABELAS EXISTENTES
-- ====================================================================

-- Add client_id and buyer_id to customers (link existing customers to clients/buyers)
ALTER TABLE public.customers 
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL;

-- Add client_id and buyer_id to sale_cycles
ALTER TABLE public.sale_cycles 
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL;

-- Add client_id and buyer_id to messages
ALTER TABLE public.messages 
ADD COLUMN client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
ADD COLUMN buyer_id UUID REFERENCES public.buyers(id) ON DELETE SET NULL;

-- ====================================================================
-- ÍNDICES PARA PERFORMANCE
-- ====================================================================
CREATE INDEX idx_clients_company_id ON public.clients(company_id);
CREATE INDEX idx_buyers_client_id ON public.buyers(client_id);
CREATE INDEX idx_buyers_company_id ON public.buyers(company_id);
CREATE INDEX idx_customers_client_id ON public.customers(client_id);
CREATE INDEX idx_customers_buyer_id ON public.customers(buyer_id);
CREATE INDEX idx_sale_cycles_client_id ON public.sale_cycles(client_id);
CREATE INDEX idx_sale_cycles_buyer_id ON public.sale_cycles(buyer_id);
CREATE INDEX idx_messages_client_id ON public.messages(client_id);
CREATE INDEX idx_messages_buyer_id ON public.messages(buyer_id);