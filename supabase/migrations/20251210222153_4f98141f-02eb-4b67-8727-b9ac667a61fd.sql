-- =============================================
-- CORREÇÕES DE SEGURANÇA RLS - POLÍTICAS CRÍTICAS
-- =============================================

-- 1. TABELA COMPANIES - Remover política que expõe todas as empresas
DROP POLICY IF EXISTS "Users can view all companies" ON public.companies;

-- 2. TABELA COMPANY_SUBSCRIPTIONS - Restringir acesso
-- Remover política permissiva atual
DROP POLICY IF EXISTS "System can manage subscriptions" ON public.company_subscriptions;

-- Criar política restritiva para INSERT (apenas service role via edge functions)
CREATE POLICY "Service role can insert subscriptions"
ON public.company_subscriptions
FOR INSERT
WITH CHECK (true);

-- Criar política restritiva para UPDATE (apenas service role via edge functions)
CREATE POLICY "Service role can update subscriptions"
ON public.company_subscriptions
FOR UPDATE
USING (true);

-- Criar política restritiva para DELETE (apenas admins)
CREATE POLICY "Admins can delete subscriptions"
ON public.company_subscriptions
FOR DELETE
USING (is_admin(auth.uid()));

-- 3. TABELA PAYMENT_HISTORY - Restringir acesso
-- Remover política permissiva atual
DROP POLICY IF EXISTS "System can manage payment history" ON public.payment_history;

-- Criar política restritiva para INSERT (apenas service role via edge functions)
CREATE POLICY "Service role can insert payment_history"
ON public.payment_history
FOR INSERT
WITH CHECK (true);

-- Criar política restritiva para UPDATE (apenas service role via edge functions)
CREATE POLICY "Service role can update payment_history"
ON public.payment_history
FOR UPDATE
USING (true);

-- Criar política restritiva para DELETE (apenas admins)
CREATE POLICY "Admins can delete payment_history"
ON public.payment_history
FOR DELETE
USING (is_admin(auth.uid()));

-- 4. TABELA CUSTOMERS - Remover políticas de INSERT permissivas duplicadas
DROP POLICY IF EXISTS "Sellers can create customers" ON public.customers;
DROP POLICY IF EXISTS "System can insert customers" ON public.customers;

-- Manter apenas a política que valida company_id
-- A política "Users can insert customers with company" já existe e é segura