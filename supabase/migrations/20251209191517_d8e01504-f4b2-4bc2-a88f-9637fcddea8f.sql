
-- Allow managers to view roles of users in their company
CREATE POLICY "Managers can view company user roles" 
ON public.user_roles 
FOR SELECT 
USING (
  has_role(auth.uid(), 'manager'::app_role) 
  AND EXISTS (
    SELECT 1 FROM profiles p1
    JOIN profiles p2 ON p1.company_id = p2.company_id
    WHERE p1.user_id = auth.uid() 
    AND p2.user_id = user_roles.user_id
  )
);
