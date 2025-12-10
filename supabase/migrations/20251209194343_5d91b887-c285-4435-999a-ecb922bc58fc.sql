-- Create an admin-specific function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = 'admin'
  )
$$;

-- Add RLS policies for admin access to companies
DROP POLICY IF EXISTS "Admins can view all companies" ON public.companies;
CREATE POLICY "Admins can view all companies" ON public.companies
FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert companies" ON public.companies;
CREATE POLICY "Admins can insert companies" ON public.companies
FOR INSERT WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update companies" ON public.companies;
CREATE POLICY "Admins can update companies" ON public.companies
FOR UPDATE USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can delete companies" ON public.companies;
CREATE POLICY "Admins can delete companies" ON public.companies
FOR DELETE USING (is_admin(auth.uid()));

-- Admin policies for profiles (view all)
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles
FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update all profiles" ON public.profiles;
CREATE POLICY "Admins can update all profiles" ON public.profiles
FOR UPDATE USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert profiles" ON public.profiles;
CREATE POLICY "Admins can insert profiles" ON public.profiles
FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- Admin policies for user_roles
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" ON public.user_roles
FOR SELECT USING (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can insert user roles" ON public.user_roles;
CREATE POLICY "Admins can insert user roles" ON public.user_roles
FOR INSERT WITH CHECK (is_admin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update user roles" ON public.user_roles;
CREATE POLICY "Admins can update user roles" ON public.user_roles
FOR UPDATE USING (is_admin(auth.uid()));

-- Admin policies for customers
DROP POLICY IF EXISTS "Admins can view all customers" ON public.customers;
CREATE POLICY "Admins can view all customers" ON public.customers
FOR SELECT USING (is_admin(auth.uid()));

-- Admin policies for messages
DROP POLICY IF EXISTS "Admins can view all messages" ON public.messages;
CREATE POLICY "Admins can view all messages" ON public.messages
FOR SELECT USING (is_admin(auth.uid()));

-- Admin policies for sale_cycles
DROP POLICY IF EXISTS "Admins can view all sale_cycles" ON public.sale_cycles;
CREATE POLICY "Admins can view all sale_cycles" ON public.sale_cycles
FOR SELECT USING (is_admin(auth.uid()));

-- Admin policies for sales
DROP POLICY IF EXISTS "Admins can view all sales" ON public.sales;
CREATE POLICY "Admins can view all sales" ON public.sales
FOR SELECT USING (is_admin(auth.uid()));

-- Admin policies for alerts
DROP POLICY IF EXISTS "Admins can view all alerts" ON public.alerts;
CREATE POLICY "Admins can view all alerts" ON public.alerts
FOR SELECT USING (is_admin(auth.uid()));

-- Admin policies for insights
DROP POLICY IF EXISTS "Admins can view all insights" ON public.insights;
CREATE POLICY "Admins can view all insights" ON public.insights
FOR SELECT USING (is_admin(auth.uid()));

-- Admin policies for whatsapp_sessions
DROP POLICY IF EXISTS "Admins can view all whatsapp_sessions" ON public.whatsapp_sessions;
CREATE POLICY "Admins can view all whatsapp_sessions" ON public.whatsapp_sessions
FOR SELECT USING (is_admin(auth.uid()));