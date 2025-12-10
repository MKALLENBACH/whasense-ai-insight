-- Create company_subscriptions table to store Stripe subscription data
CREATE TABLE public.company_subscriptions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  plan_id UUID REFERENCES public.plans(id),
  status TEXT NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'past_due', 'canceled', 'inactive', 'inactive_due_payment', 'trialing')),
  next_billing_date TIMESTAMP WITH TIME ZONE,
  current_period_start TIMESTAMP WITH TIME ZONE,
  current_period_end TIMESTAMP WITH TIME ZONE,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id)
);

-- Create payment_history table
CREATE TABLE public.payment_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  stripe_invoice_id TEXT,
  stripe_payment_intent_id TEXT,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL DEFAULT 'brl',
  status TEXT NOT NULL CHECK (status IN ('paid', 'failed', 'pending', 'refunded')),
  description TEXT,
  paid_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for company_subscriptions
CREATE POLICY "Admins can manage all subscriptions"
ON public.company_subscriptions FOR ALL
USING (is_admin(auth.uid()));

CREATE POLICY "Managers can view own company subscription"
ON public.company_subscriptions FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) AND company_id = get_user_company(auth.uid()));

CREATE POLICY "System can manage subscriptions"
ON public.company_subscriptions FOR ALL
USING (true);

-- RLS Policies for payment_history
CREATE POLICY "Admins can view all payment history"
ON public.payment_history FOR SELECT
USING (is_admin(auth.uid()));

CREATE POLICY "Managers can view own company payment history"
ON public.payment_history FOR SELECT
USING (has_role(auth.uid(), 'manager'::app_role) AND company_id = get_user_company(auth.uid()));

CREATE POLICY "System can manage payment history"
ON public.payment_history FOR ALL
USING (true);

-- Create indexes
CREATE INDEX idx_company_subscriptions_company ON public.company_subscriptions(company_id);
CREATE INDEX idx_company_subscriptions_status ON public.company_subscriptions(status);
CREATE INDEX idx_company_subscriptions_stripe_customer ON public.company_subscriptions(stripe_customer_id);
CREATE INDEX idx_payment_history_company ON public.payment_history(company_id);
CREATE INDEX idx_payment_history_created ON public.payment_history(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_company_subscriptions_updated_at
BEFORE UPDATE ON public.company_subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();