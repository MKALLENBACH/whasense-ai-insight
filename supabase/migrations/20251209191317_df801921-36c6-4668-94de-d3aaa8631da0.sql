
-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Managers can view company profiles" ON public.profiles;

-- Recreate as PERMISSIVE policies (default, using OR logic)
CREATE POLICY "Users can view own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Managers can view company profiles" 
ON public.profiles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND company_id = get_user_company(auth.uid())
);
