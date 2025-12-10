import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Target, Plus, Trophy, Medal, AlertTriangle, TrendingUp, Crown, Award, Flame, Zap } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Goal {
  id: string;
  goal_type: string;
  target_value: number;
  start_date: string;
  end_date: string;
  created_at: string;
}

interface GoalVendor {
  id: string;
  goal_id: string;
  vendor_id: string;
  target_value: number;
  current_value: number;
  progress: number;
  status: string;
  vendor_name?: string;
}

interface LeaderboardEntry {
  vendor_id: string;
  vendor_name: string;
  total_points: number;
  position: number;
}

interface Achievement {
  id: string;
  vendor_id: string;
  badge_type: string;
  awarded_at: string;
  vendor_name?: string;
}

const GOAL_TYPES = {
  vendas: "Vendas",
};

const BADGE_INFO: Record<string, { icon: React.ReactNode; label: string; color: string }> = {
  closer_master: { icon: <Flame className="h-4 w-4" />, label: "Closer Master", color: "bg-orange-500" },
  resposta_relampago: { icon: <Zap className="h-4 w-4" />, label: "Resposta Relâmpago", color: "bg-yellow-500" },
  recuperador_leads: { icon: <TrendingUp className="h-4 w-4" />, label: "Recuperador de Leads", color: "bg-green-500" },
  top_vendedor: { icon: <Crown className="h-4 w-4" />, label: "Top Vendedor", color: "bg-purple-500" },
  meta_batida: { icon: <Target className="h-4 w-4" />, label: "Meta Batida", color: "bg-blue-500" },
  excelencia: { icon: <Award className="h-4 w-4" />, label: "Excelência", color: "bg-pink-500" },
};

const ManagerGoalsPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [goalVendors, setGoalVendors] = useState<GoalVendor[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([]);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);

  // Form state
  const [goalType, setGoalType] = useState<string>("vendas");
  const [targetValue, setTargetValue] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user?.companyId) {
      fetchData();
    }
  }, [user?.companyId]);

  const fetchData = async () => {
    if (!user?.companyId) return;
    setIsLoading(true);

    try {
      // Fetch goals
      const { data: goalsData } = await supabase
        .from("goals")
        .select("*")
        .eq("company_id", user.companyId)
        .order("created_at", { ascending: false });

      setGoals((goalsData || []) as Goal[]);

      // Fetch sellers
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("company_id", user.companyId);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "seller");

      const sellerUserIds = new Set(roles?.map(r => r.user_id) || []);
      const filteredSellers = (profiles || [])
        .filter(p => sellerUserIds.has(p.user_id))
        .map(p => ({ id: p.user_id, name: p.name }));

      setSellers(filteredSellers);

      // Fetch goal vendors for all goals
      if (goalsData && goalsData.length > 0) {
        const goalIds = goalsData.map(g => g.id);
        const { data: gvData } = await supabase
          .from("goal_vendors")
          .select("*")
          .in("goal_id", goalIds);

        const gvWithNames = (gvData || []).map(gv => ({
          ...gv,
          vendor_name: filteredSellers.find(s => s.id === gv.vendor_id)?.name || "Vendedor"
        }));

        setGoalVendors(gvWithNames as GoalVendor[]);
      }

      // Fetch leaderboard (monthly)
      const now = new Date();
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      const { data: lbData } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("company_id", user.companyId)
        .eq("period", "monthly")
        .eq("period_start", monthStart)
        .order("position", { ascending: true });

      const lbWithNames = (lbData || []).map(lb => ({
        ...lb,
        vendor_name: filteredSellers.find(s => s.id === lb.vendor_id)?.name || "Vendedor"
      }));

      setLeaderboard(lbWithNames as LeaderboardEntry[]);

      // Fetch achievements
      const sellerIds = filteredSellers.map(s => s.id);
      if (sellerIds.length > 0) {
        const { data: achData } = await supabase
          .from("achievements")
          .select("*")
          .in("vendor_id", sellerIds)
          .order("awarded_at", { ascending: false })
          .limit(20);

        const achWithNames = (achData || []).map(a => ({
          ...a,
          vendor_name: filteredSellers.find(s => s.id === a.vendor_id)?.name || "Vendedor"
        }));

        setAchievements(achWithNames as Achievement[]);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateGoal = async () => {
    if (!user?.companyId || !targetValue || !startDate || !endDate) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: newGoal, error } = await supabase
        .from("goals")
        .insert({
          company_id: user.companyId,
          goal_type: goalType,
          target_value: parseFloat(targetValue),
          start_date: startDate,
          end_date: endDate,
          created_by: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Create goal_vendors for all sellers
      const goalVendorsToInsert = sellers.map(seller => ({
        goal_id: newGoal.id,
        vendor_id: seller.id,
        target_value: parseFloat(targetValue),
      }));

      if (goalVendorsToInsert.length > 0) {
        await supabase.from("goal_vendors").insert(goalVendorsToInsert);
      }

      toast.success("Meta criada com sucesso!");
      setIsCreateOpen(false);
      setGoalType("vendas");
      setTargetValue("");
      setStartDate("");
      setEndDate("");
      fetchData();
    } catch (error) {
      console.error("Error creating goal:", error);
      toast.error("Erro ao criar meta");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string, progress: number) => {
    if (progress >= 100 || status === "achieved") {
      return <Badge className="bg-success text-success-foreground">Atingida</Badge>;
    }
    if (progress >= 70) {
      return <Badge className="bg-primary text-primary-foreground">No caminho</Badge>;
    }
    return <Badge variant="destructive">Abaixo</Badge>;
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const behindGoalVendors = goalVendors.filter(gv => gv.progress < 50 && gv.status !== "achieved");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Metas e Gamificação</h1>
            <p className="text-muted-foreground">Gerencie metas e acompanhe o desempenho da equipe</p>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Meta
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Nova Meta</DialogTitle>
                <DialogDescription>Defina uma meta para sua equipe de vendas</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Meta de Vendas</Label>
                  <Input
                    type="number"
                    placeholder="10"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">Quantidade de vendas a serem realizadas</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data Início</Label>
                    <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Data Fim</Label>
                    <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateGoal} disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Criar Meta
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Alert for behind sellers */}
        {behindGoalVendors.length > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-destructive">
                <AlertTriangle className="h-5 w-5" />
                Vendedores Abaixo da Meta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {behindGoalVendors.slice(0, 5).map((gv) => (
                  <Badge key={gv.id} variant="outline" className="border-destructive/50">
                    {gv.vendor_name} - {gv.progress.toFixed(0)}%
                  </Badge>
                ))}
                {behindGoalVendors.length > 5 && (
                  <Badge variant="secondary">+{behindGoalVendors.length - 5} mais</Badge>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="goals" className="space-y-4">
          <TabsList>
            <TabsTrigger value="goals">Metas Ativas</TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="badges">Conquistas</TabsTrigger>
          </TabsList>

          <TabsContent value="goals" className="space-y-4">
            {goals.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Target className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">Nenhuma meta criada</p>
                  <Button className="mt-4" onClick={() => setIsCreateOpen(true)}>
                    Criar Primeira Meta
                  </Button>
                </CardContent>
              </Card>
            ) : (
              goals.map((goal) => {
                const gvs = goalVendors.filter(gv => gv.goal_id === goal.id);
                const avgProgress = gvs.length > 0 
                  ? gvs.reduce((acc, gv) => acc + gv.progress, 0) / gvs.length 
                  : 0;

                return (
                  <Card key={goal.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            {GOAL_TYPES[goal.goal_type as keyof typeof GOAL_TYPES]}
                          </CardTitle>
                          <CardDescription>
                            Meta: {goal.target_value} • {format(new Date(goal.start_date + 'T12:00:00'), "dd/MM", { locale: ptBR })} - {format(new Date(goal.end_date + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                          </CardDescription>
                        </div>
                        <div className="text-right">
                          <p className="text-2xl font-bold">{avgProgress.toFixed(0)}%</p>
                          <p className="text-xs text-muted-foreground">Progresso médio</p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Progress value={avgProgress} className="h-2 mb-4" />
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Vendedor</TableHead>
                            <TableHead className="text-center">Atual</TableHead>
                            <TableHead className="text-center">Meta</TableHead>
                            <TableHead className="text-center">Progresso</TableHead>
                            <TableHead className="text-right">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gvs.map((gv) => (
                            <TableRow key={gv.id}>
                              <TableCell className="font-medium">{gv.vendor_name}</TableCell>
                              <TableCell className="text-center">{gv.current_value}</TableCell>
                              <TableCell className="text-center">{gv.target_value}</TableCell>
                              <TableCell className="text-center">
                                <div className="flex items-center gap-2">
                                  <Progress value={gv.progress} className="h-2 flex-1" />
                                  <span className="text-sm w-12">{gv.progress.toFixed(0)}%</span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right">
                                {getStatusBadge(gv.status, gv.progress)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="ranking" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Ranking do Mês
                </CardTitle>
                <CardDescription>Classificação baseada em pontos de gamificação</CardDescription>
              </CardHeader>
              <CardContent>
                {leaderboard.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum dado de ranking ainda</p>
                ) : (
                  <div className="space-y-3">
                    {leaderboard.map((entry, index) => (
                      <div 
                        key={entry.vendor_id}
                        className={`flex items-center gap-4 p-3 rounded-lg ${
                          index === 0 ? "bg-yellow-500/10 border border-yellow-500/30" :
                          index === 1 ? "bg-gray-400/10 border border-gray-400/30" :
                          index === 2 ? "bg-amber-600/10 border border-amber-600/30" :
                          "bg-muted/50"
                        }`}
                      >
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full ${
                          index === 0 ? "bg-yellow-500 text-white" :
                          index === 1 ? "bg-gray-400 text-white" :
                          index === 2 ? "bg-amber-600 text-white" :
                          "bg-muted text-muted-foreground"
                        }`}>
                          {index < 3 ? <Medal className="h-5 w-5" /> : <span className="font-bold">{index + 1}</span>}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{entry.vendor_name}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-bold">{entry.total_points}</p>
                          <p className="text-xs text-muted-foreground">pontos</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="badges" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-500" />
                  Conquistas Recentes
                </CardTitle>
                <CardDescription>Badges conquistados pela equipe</CardDescription>
              </CardHeader>
              <CardContent>
                {achievements.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhuma conquista ainda</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {achievements.map((ach) => {
                      const badgeInfo = BADGE_INFO[ach.badge_type] || { 
                        icon: <Award className="h-4 w-4" />, 
                        label: ach.badge_type, 
                        color: "bg-gray-500" 
                      };
                      return (
                        <div key={ach.id} className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <div className={`flex items-center justify-center w-10 h-10 rounded-full ${badgeInfo.color} text-white`}>
                            {badgeInfo.icon}
                          </div>
                          <div>
                            <p className="font-medium text-sm">{badgeInfo.label}</p>
                            <p className="text-xs text-muted-foreground">{ach.vendor_name}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
};

export default ManagerGoalsPage;
