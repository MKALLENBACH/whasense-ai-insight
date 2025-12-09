-- Create plans table
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  monthly_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  annual_price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  seller_limit INTEGER, -- NULL means unlimited
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for plans
CREATE POLICY "Admins can manage plans" 
ON public.plans 
FOR ALL 
USING (is_admin(auth.uid()));

CREATE POLICY "Anyone can view active plans" 
ON public.plans 
FOR SELECT 
USING (is_active = true);

-- Add plan_id to companies
ALTER TABLE public.companies 
ADD COLUMN plan_id UUID REFERENCES public.plans(id);

-- Create trigger for updated_at on plans
CREATE TRIGGER update_plans_updated_at
BEFORE UPDATE ON public.plans
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default plans
INSERT INTO public.plans (name, description, monthly_price, annual_price, seller_limit, is_active) VALUES
('Starter', 'Ideal para pequenas equipes começando com Whasense', 49.90, 479.00, 2, true),
('Pro', 'Para equipes em crescimento que precisam de mais recursos', 129.90, 1249.00, 5, true),
('Premium', 'Acesso ilimitado para grandes operações', 299.90, 2879.00, NULL, true);