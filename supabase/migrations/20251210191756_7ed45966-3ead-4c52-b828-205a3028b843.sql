-- Add column to control visibility to managers
ALTER TABLE public.plans 
ADD COLUMN visible_to_managers boolean NOT NULL DEFAULT true;

-- Update existing Inativo plan to not be visible to managers
UPDATE public.plans SET visible_to_managers = false WHERE name = 'Inativo';