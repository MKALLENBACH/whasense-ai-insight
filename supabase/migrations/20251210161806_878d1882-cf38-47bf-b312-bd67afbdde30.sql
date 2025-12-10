-- ====================================================================
-- PROCESSING QUEUE - Fila de processamento por empresa
-- ====================================================================
CREATE TABLE public.processing_queue (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  type TEXT NOT NULL, -- text_analysis, audio_analysis, image_analysis, alert, metric, followup
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, done, failed
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  error_message TEXT,
  priority INTEGER NOT NULL DEFAULT 5, -- 1 = highest, 10 = lowest
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Indexes for efficient queue processing
CREATE INDEX idx_processing_queue_status_priority ON public.processing_queue(status, priority, created_at) WHERE status = 'pending';
CREATE INDEX idx_processing_queue_company_status ON public.processing_queue(company_id, status);
CREATE INDEX idx_processing_queue_type_status ON public.processing_queue(type, status);
CREATE INDEX idx_processing_queue_created_at ON public.processing_queue(created_at);

-- Enable RLS
ALTER TABLE public.processing_queue ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all queue items" ON public.processing_queue FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "System can manage queue" ON public.processing_queue FOR ALL USING (true);

-- ====================================================================
-- COMPANY LIMITS - Limites de carga por empresa
-- ====================================================================
CREATE TABLE public.company_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL UNIQUE REFERENCES public.companies(id),
  max_requests_per_second INTEGER NOT NULL DEFAULT 100,
  max_ai_ops_per_minute INTEGER NOT NULL DEFAULT 60,
  max_messages_per_day INTEGER NOT NULL DEFAULT 100000,
  priority_level TEXT NOT NULL DEFAULT 'normal', -- normal, premium, enterprise
  is_throttled BOOLEAN NOT NULL DEFAULT false,
  throttle_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.company_limits ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can manage company_limits" ON public.company_limits FOR ALL USING (is_admin(auth.uid()));
CREATE POLICY "Managers can view own company limits" ON public.company_limits FOR SELECT 
  USING (has_role(auth.uid(), 'manager'::app_role) AND company_id = get_user_company(auth.uid()));

-- ====================================================================
-- ANALYTICS DAILY COMPANY - Agregados diários por empresa
-- ====================================================================
CREATE TABLE public.analytics_daily_company (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  date DATE NOT NULL,
  total_leads INTEGER NOT NULL DEFAULT 0,
  new_leads INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  incoming_messages INTEGER NOT NULL DEFAULT 0,
  outgoing_messages INTEGER NOT NULL DEFAULT 0,
  total_won INTEGER NOT NULL DEFAULT 0,
  total_lost INTEGER NOT NULL DEFAULT 0,
  total_pending INTEGER NOT NULL DEFAULT 0,
  total_in_progress INTEGER NOT NULL DEFAULT 0,
  avg_response_time_seconds NUMERIC,
  hot_leads INTEGER NOT NULL DEFAULT 0,
  warm_leads INTEGER NOT NULL DEFAULT 0,
  cold_leads INTEGER NOT NULL DEFAULT 0,
  ai_text_analyses INTEGER NOT NULL DEFAULT 0,
  ai_audio_analyses INTEGER NOT NULL DEFAULT 0,
  ai_image_analyses INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, date)
);

-- Indexes
CREATE INDEX idx_analytics_daily_company_date ON public.analytics_daily_company(company_id, date DESC);

-- Enable RLS
ALTER TABLE public.analytics_daily_company ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all analytics" ON public.analytics_daily_company FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Managers can view company analytics" ON public.analytics_daily_company FOR SELECT 
  USING (has_role(auth.uid(), 'manager'::app_role) AND company_id = get_user_company(auth.uid()));
CREATE POLICY "System can manage analytics" ON public.analytics_daily_company FOR ALL USING (true);

-- ====================================================================
-- ANALYTICS DAILY SELLER - Agregados diários por vendedor
-- ====================================================================
CREATE TABLE public.analytics_daily_seller (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  seller_id UUID NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  date DATE NOT NULL,
  total_leads INTEGER NOT NULL DEFAULT 0,
  new_leads INTEGER NOT NULL DEFAULT 0,
  total_messages INTEGER NOT NULL DEFAULT 0,
  incoming_messages INTEGER NOT NULL DEFAULT 0,
  outgoing_messages INTEGER NOT NULL DEFAULT 0,
  leads_won INTEGER NOT NULL DEFAULT 0,
  leads_lost INTEGER NOT NULL DEFAULT 0,
  leads_pending INTEGER NOT NULL DEFAULT 0,
  leads_in_progress INTEGER NOT NULL DEFAULT 0,
  avg_response_time_seconds NUMERIC,
  hot_leads INTEGER NOT NULL DEFAULT 0,
  warm_leads INTEGER NOT NULL DEFAULT 0,
  cold_leads INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(seller_id, date)
);

-- Indexes
CREATE INDEX idx_analytics_daily_seller_company_date ON public.analytics_daily_seller(company_id, date DESC);
CREATE INDEX idx_analytics_daily_seller_seller_date ON public.analytics_daily_seller(seller_id, date DESC);

-- Enable RLS
ALTER TABLE public.analytics_daily_seller ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all seller analytics" ON public.analytics_daily_seller FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Managers can view company seller analytics" ON public.analytics_daily_seller FOR SELECT 
  USING (has_role(auth.uid(), 'manager'::app_role) AND company_id = get_user_company(auth.uid()));
CREATE POLICY "Sellers can view own analytics" ON public.analytics_daily_seller FOR SELECT 
  USING (seller_id = auth.uid());
CREATE POLICY "System can manage seller analytics" ON public.analytics_daily_seller FOR ALL USING (true);

-- ====================================================================
-- CRITICAL INDEXES FOR HIGH-LOAD MULTI-TENANT
-- ====================================================================

-- Messages indexes (CRITICAL for chat performance)
CREATE INDEX IF NOT EXISTS idx_messages_company_customer ON public.messages(customer_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_cycle_timestamp ON public.messages(cycle_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_seller_timestamp ON public.messages(seller_id, timestamp DESC);

-- Sale cycles indexes
CREATE INDEX IF NOT EXISTS idx_sale_cycles_customer_status ON public.sale_cycles(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_sale_cycles_seller_status ON public.sale_cycles(seller_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_cycles_status_activity ON public.sale_cycles(status, last_activity_at DESC) WHERE status IN ('pending', 'in_progress');

-- Insights indexes
CREATE INDEX IF NOT EXISTS idx_insights_message ON public.insights(message_id);
CREATE INDEX IF NOT EXISTS idx_insights_created ON public.insights(created_at DESC);

-- Customers indexes
CREATE INDEX IF NOT EXISTS idx_customers_company_seller ON public.customers(company_id, seller_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_status ON public.customers(company_id, lead_status);
CREATE INDEX IF NOT EXISTS idx_customers_seller_status ON public.customers(seller_id, lead_status);

-- Alerts indexes
CREATE INDEX IF NOT EXISTS idx_alerts_seller_created ON public.alerts(seller_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_customer_type ON public.alerts(customer_id, alert_type);

-- ====================================================================
-- QUEUE USAGE TRACKING
-- ====================================================================
CREATE TABLE public.queue_usage_hourly (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  hour TIMESTAMP WITH TIME ZONE NOT NULL,
  requests_count INTEGER NOT NULL DEFAULT 0,
  ai_ops_count INTEGER NOT NULL DEFAULT 0,
  messages_count INTEGER NOT NULL DEFAULT 0,
  avg_processing_time_ms NUMERIC,
  queue_size_peak INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(company_id, hour)
);

-- Index
CREATE INDEX idx_queue_usage_hourly_company ON public.queue_usage_hourly(company_id, hour DESC);

-- Enable RLS
ALTER TABLE public.queue_usage_hourly ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admins can view all queue usage" ON public.queue_usage_hourly FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "System can manage queue usage" ON public.queue_usage_hourly FOR ALL USING (true);

-- ====================================================================
-- TRIGGERS FOR UPDATED_AT
-- ====================================================================
CREATE TRIGGER update_processing_queue_updated_at BEFORE UPDATE ON public.processing_queue
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_company_limits_updated_at BEFORE UPDATE ON public.company_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analytics_daily_company_updated_at BEFORE UPDATE ON public.analytics_daily_company
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_analytics_daily_seller_updated_at BEFORE UPDATE ON public.analytics_daily_seller
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();