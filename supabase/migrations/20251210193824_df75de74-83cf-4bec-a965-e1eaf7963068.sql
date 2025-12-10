-- Add is_active field to profiles table for seller status control
ALTER TABLE public.profiles 
ADD COLUMN is_active boolean NOT NULL DEFAULT true;

-- Create index for faster queries on active sellers
CREATE INDEX idx_profiles_company_active ON public.profiles(company_id, is_active);

-- Comment for documentation
COMMENT ON COLUMN public.profiles.is_active IS 'Controls if the user can login. Used for seller deactivation without losing history.';