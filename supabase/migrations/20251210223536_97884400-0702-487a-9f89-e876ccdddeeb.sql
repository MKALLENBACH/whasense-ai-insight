-- =============================================
-- Performance Optimization: Database Indexes
-- =============================================

-- Messages table indexes (high traffic)
CREATE INDEX IF NOT EXISTS idx_messages_customer_id ON public.messages(customer_id);
CREATE INDEX IF NOT EXISTS idx_messages_seller_id ON public.messages(seller_id);
CREATE INDEX IF NOT EXISTS idx_messages_cycle_id ON public.messages(cycle_id);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp_desc ON public.messages(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_messages_customer_timestamp ON public.messages(customer_id, timestamp DESC);

-- Customers table indexes
CREATE INDEX IF NOT EXISTS idx_customers_seller_id ON public.customers(seller_id);
CREATE INDEX IF NOT EXISTS idx_customers_company_id ON public.customers(company_id);
CREATE INDEX IF NOT EXISTS idx_customers_lead_status ON public.customers(lead_status);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_customers_client_id ON public.customers(client_id);

-- Sale cycles table indexes
CREATE INDEX IF NOT EXISTS idx_sale_cycles_customer_id ON public.sale_cycles(customer_id);
CREATE INDEX IF NOT EXISTS idx_sale_cycles_seller_id ON public.sale_cycles(seller_id);
CREATE INDEX IF NOT EXISTS idx_sale_cycles_status ON public.sale_cycles(status);
CREATE INDEX IF NOT EXISTS idx_sale_cycles_customer_status ON public.sale_cycles(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_sale_cycles_created_at_desc ON public.sale_cycles(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sale_cycles_cycle_type ON public.sale_cycles(cycle_type);

-- Insights table indexes
CREATE INDEX IF NOT EXISTS idx_insights_message_id ON public.insights(message_id);
CREATE INDEX IF NOT EXISTS idx_insights_insight_type ON public.insights(insight_type);
CREATE INDEX IF NOT EXISTS idx_insights_created_at_desc ON public.insights(created_at DESC);

-- Alerts table indexes
CREATE INDEX IF NOT EXISTS idx_alerts_customer_id ON public.alerts(customer_id);
CREATE INDEX IF NOT EXISTS idx_alerts_seller_id ON public.alerts(seller_id);
CREATE INDEX IF NOT EXISTS idx_alerts_cycle_id ON public.alerts(cycle_id);
CREATE INDEX IF NOT EXISTS idx_alerts_alert_type ON public.alerts(alert_type);

-- Profiles table indexes
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON public.profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_active ON public.profiles(company_id, is_active);

-- Buyers table indexes
CREATE INDEX IF NOT EXISTS idx_buyers_client_id ON public.buyers(client_id);
CREATE INDEX IF NOT EXISTS idx_buyers_company_id ON public.buyers(company_id);
CREATE INDEX IF NOT EXISTS idx_buyers_phone ON public.buyers(phone);

-- Clients table indexes
CREATE INDEX IF NOT EXISTS idx_clients_company_id ON public.clients(company_id);
CREATE INDEX IF NOT EXISTS idx_clients_cnpj ON public.clients(cnpj);

-- Analytics tables indexes
CREATE INDEX IF NOT EXISTS idx_analytics_daily_company_date ON public.analytics_daily_company(company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_seller_date ON public.analytics_daily_seller(seller_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_daily_seller_company ON public.analytics_daily_seller(company_id, date DESC);

-- Processing queue indexes
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON public.processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_company_status ON public.processing_queue(company_id, status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_priority ON public.processing_queue(priority, created_at);

-- Goals and gamification indexes
CREATE INDEX IF NOT EXISTS idx_goals_company_id ON public.goals(company_id);
CREATE INDEX IF NOT EXISTS idx_goal_vendors_goal_id ON public.goal_vendors(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_vendors_vendor_id ON public.goal_vendors(vendor_id);
CREATE INDEX IF NOT EXISTS idx_gamification_points_vendor_id ON public.gamification_points(vendor_id);
CREATE INDEX IF NOT EXISTS idx_gamification_points_company_id ON public.gamification_points(company_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_company_period ON public.leaderboard(company_id, period, period_start DESC);

-- Company related indexes
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_company_id ON public.company_subscriptions(company_id);
CREATE INDEX IF NOT EXISTS idx_company_subscriptions_status ON public.company_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_payment_history_company_id ON public.payment_history(company_id);
CREATE INDEX IF NOT EXISTS idx_company_settings_company_id ON public.company_settings(company_id);
CREATE INDEX IF NOT EXISTS idx_company_limits_company_id ON public.company_limits(company_id);

-- User roles index
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- WhatsApp sessions index
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_seller_id ON public.whatsapp_sessions(seller_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_phone ON public.whatsapp_sessions(phone_number);
CREATE INDEX IF NOT EXISTS idx_whatsapp_sessions_status ON public.whatsapp_sessions(status);