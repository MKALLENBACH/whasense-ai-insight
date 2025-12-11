-- Add CASCADE delete from goals to goal_vendors
ALTER TABLE goal_vendors
DROP CONSTRAINT IF EXISTS goal_vendors_goal_id_fkey;

ALTER TABLE goal_vendors
ADD CONSTRAINT goal_vendors_goal_id_fkey
FOREIGN KEY (goal_id) REFERENCES goals(id) ON DELETE CASCADE;

-- Add DELETE policy for goal_vendors (managers can delete via cascade)
CREATE POLICY "Managers can delete goal_vendors"
ON goal_vendors
FOR DELETE
USING (
  has_role(auth.uid(), 'manager'::app_role) AND
  EXISTS (
    SELECT 1 FROM goals g
    WHERE g.id = goal_vendors.goal_id
    AND g.company_id = get_user_company(auth.uid())
  )
);