-- Add policy for managers to update profiles of sellers in their company
CREATE POLICY "Managers can update company profiles" 
ON public.profiles 
FOR UPDATE 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND company_id = get_user_company(auth.uid())
);