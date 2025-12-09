-- Add is_active column to companies table
ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Create function to check if user's company is active
CREATE OR REPLACE FUNCTION public.is_user_company_active(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT c.is_active 
     FROM companies c 
     JOIN profiles p ON p.company_id = c.id 
     WHERE p.user_id = _user_id
     LIMIT 1),
    true  -- Return true if user has no company (like admins)
  )
$$;