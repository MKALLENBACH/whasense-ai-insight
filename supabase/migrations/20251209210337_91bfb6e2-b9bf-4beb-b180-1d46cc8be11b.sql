-- Goals table (metas definidas pelo gestor)
CREATE TABLE public.goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  goal_type text NOT NULL CHECK (goal_type IN ('vendas', 'faturamento', 'conversas_ativas', 'taxa_resposta')),
  target_value numeric NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Goal vendors table (metas por vendedor)
CREATE TABLE public.goal_vendors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id uuid NOT NULL REFERENCES public.goals(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL,
  target_value numeric NOT NULL,
  current_value numeric NOT NULL DEFAULT 0,
  progress numeric GENERATED ALWAYS AS (CASE WHEN target_value > 0 THEN ROUND((current_value / target_value) * 100, 2) ELSE 0 END) STORED,
  status text NOT NULL DEFAULT 'on_track' CHECK (status IN ('on_track', 'behind', 'achieved')),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Gamification points table
CREATE TABLE public.gamification_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL,
  points integer NOT NULL,
  reason text NOT NULL,
  sale_id uuid REFERENCES public.sales(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Achievements table (badges)
CREATE TABLE public.achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL,
  badge_type text NOT NULL,
  awarded_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Leaderboard table
CREATE TABLE public.leaderboard (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  vendor_id uuid NOT NULL,
  period text NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  period_start date NOT NULL,
  total_points integer NOT NULL DEFAULT 0,
  position integer,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(company_id, vendor_id, period, period_start)
);

-- Enable RLS on all tables
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gamification_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leaderboard ENABLE ROW LEVEL SECURITY;

-- Goals RLS policies
CREATE POLICY "Admins can view all goals" ON public.goals FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Managers can view company goals" ON public.goals FOR SELECT 
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));
CREATE POLICY "Sellers can view company goals" ON public.goals FOR SELECT 
  USING (has_role(auth.uid(), 'seller') AND company_id = get_user_company(auth.uid()));
CREATE POLICY "Managers can insert goals" ON public.goals FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));
CREATE POLICY "Managers can update goals" ON public.goals FOR UPDATE 
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));
CREATE POLICY "Managers can delete goals" ON public.goals FOR DELETE 
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));

-- Goal vendors RLS policies
CREATE POLICY "Admins can view all goal_vendors" ON public.goal_vendors FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Managers can view company goal_vendors" ON public.goal_vendors FOR SELECT 
  USING (has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1 FROM goals g WHERE g.id = goal_vendors.goal_id AND g.company_id = get_user_company(auth.uid())
  ));
CREATE POLICY "Sellers can view own goal_vendors" ON public.goal_vendors FOR SELECT 
  USING (vendor_id = auth.uid());
CREATE POLICY "Managers can insert goal_vendors" ON public.goal_vendors FOR INSERT 
  WITH CHECK (has_role(auth.uid(), 'manager'));
CREATE POLICY "Managers can update goal_vendors" ON public.goal_vendors FOR UPDATE 
  USING (has_role(auth.uid(), 'manager'));
CREATE POLICY "System can update goal_vendors" ON public.goal_vendors FOR UPDATE USING (true);

-- Gamification points RLS policies
CREATE POLICY "Admins can view all gamification_points" ON public.gamification_points FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Managers can view company points" ON public.gamification_points FOR SELECT 
  USING (has_role(auth.uid(), 'manager') AND company_id = get_user_company(auth.uid()));
CREATE POLICY "Sellers can view own points" ON public.gamification_points FOR SELECT 
  USING (vendor_id = auth.uid());
CREATE POLICY "System can insert points" ON public.gamification_points FOR INSERT WITH CHECK (true);

-- Achievements RLS policies
CREATE POLICY "Admins can view all achievements" ON public.achievements FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Managers can view company achievements" ON public.achievements FOR SELECT 
  USING (has_role(auth.uid(), 'manager') AND EXISTS (
    SELECT 1 FROM profiles p WHERE p.user_id = achievements.vendor_id AND p.company_id = get_user_company(auth.uid())
  ));
CREATE POLICY "Sellers can view own achievements" ON public.achievements FOR SELECT 
  USING (vendor_id = auth.uid());
CREATE POLICY "System can insert achievements" ON public.achievements FOR INSERT WITH CHECK (true);

-- Leaderboard RLS policies
CREATE POLICY "Admins can view all leaderboard" ON public.leaderboard FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Users can view company leaderboard" ON public.leaderboard FOR SELECT 
  USING (company_id = get_user_company(auth.uid()));
CREATE POLICY "System can manage leaderboard" ON public.leaderboard FOR ALL USING (true);

-- Triggers for updated_at
CREATE TRIGGER update_goals_updated_at BEFORE UPDATE ON public.goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_goal_vendors_updated_at BEFORE UPDATE ON public.goal_vendors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_leaderboard_updated_at BEFORE UPDATE ON public.leaderboard
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.gamification_points;
ALTER PUBLICATION supabase_realtime ADD TABLE public.achievements;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaderboard;