-- Drop existing alerts table if exists (we're replacing it with a dynamic system)
DROP TABLE IF EXISTS public.alerts;

-- Create new alerts table for dynamic alerts
CREATE TABLE public.alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id uuid NOT NULL REFERENCES public.customers(id) ON DELETE CASCADE,
  seller_id uuid NOT NULL,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  message text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  -- Unique constraint to prevent duplicate alerts of same type for same customer
  UNIQUE(customer_id, seller_id, alert_type)
);

-- Enable RLS
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;

-- Sellers can view their own alerts
CREATE POLICY "Sellers can view own alerts" 
ON public.alerts 
FOR SELECT 
USING (seller_id = auth.uid());

-- Sellers can delete their own alerts (when conditions change)
CREATE POLICY "Sellers can delete own alerts" 
ON public.alerts 
FOR DELETE 
USING (seller_id = auth.uid());

-- System can manage alerts (for edge functions)
CREATE POLICY "System can insert alerts" 
ON public.alerts 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "System can update alerts" 
ON public.alerts 
FOR UPDATE 
USING (true);

CREATE POLICY "System can delete alerts" 
ON public.alerts 
FOR DELETE 
USING (true);

-- Managers can view alerts for their company
CREATE POLICY "Managers can view company alerts" 
ON public.alerts 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) AND 
  EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.user_id = auth.uid() AND p2.user_id = alerts.seller_id
  )
);

-- Create indexes for performance
CREATE INDEX idx_alerts_seller_id ON public.alerts(seller_id);
CREATE INDEX idx_alerts_customer_id ON public.alerts(customer_id);
CREATE INDEX idx_alerts_type ON public.alerts(alert_type);
CREATE INDEX idx_alerts_severity ON public.alerts(severity);

-- Enable realtime for alerts
ALTER PUBLICATION supabase_realtime ADD TABLE public.alerts;

-- Add trigger for updated_at
CREATE TRIGGER update_alerts_updated_at
BEFORE UPDATE ON public.alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();