import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2, Target, Trophy, Medal, TrendingUp, Crown, Award, Flame, Zap, Star, Sparkles, Bot, RefreshCw } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface GoalVendor {
  id: string;
  goal_id: string;
  target_value: number;
  current_value: number;
  progress: number;
  status: string;
  goal?: {
    goal_type: string;
    end_date: string;
  };
}

interface LeaderboardEntry {
  vendor_id: string;
  vendor_name: string;
  total_points: number;
  position: number;
  period: string;
}

interface Achievement {
  id: string;
  badge_type: string;
  awarded_at: string;
}

interface PointsHistory {
  id: string;
  points: number;
  reason: string;
  created_at: string;
}

interface AIInsights {
  vendorName: string;
  stats: {
    wonSales: number;
    lostSales: number;
    conversionRate: string;
    totalPoints: number;
    rankingPosition: number | null;
  };
  activeGoals: {
    type: string;
    target: number;
    current: number;
    progress: number;
    remaining: number;
    endDate: string;
  }[];
  hotLeadsCount: number;
  aiInsights: string;
}

const GOAL_TYPES = {
  vendas: "Vendas",
  conversas_ativas: "Conversas Ativas",
  taxa_resposta: "Taxa de Resposta (%)",
};

const BADGE_INFO: Record<string, { icon: React.ReactNode; label: string; description: string; color: string }> = {
  closer_master: { icon: <Flame className="h-6 w-6" />, label: "🔥 Closer Master", description: "10 vendas em 7 dias", color: "from-orange-500 to-red-500" },
  resposta_relampago: { icon: <Zap className="h-6 w-6" />, label: "⚡ Resposta Relâmpago", description: "50 respostas rápidas no mês", color: "from-yellow-400 to-orange-500" },
  recuperador_leads: { icon: <TrendingUp className="h-6 w-6" />, label: "♻️ Recuperador de Leads", description: "20 follow-ups bem-sucedidos", color: "from-green-400 to-emerald-500" },
  top_vendedor: { icon: <Crown className="h-6 w-6" />, label: "🏆 Top Vendedor do Mês", description: "Mais pontos no ranking mensal", color: "from-purple-500 to-pink-500" },
  meta_batida: { icon: <Target className="h-6 w-6" />, label: "📈 Meta Batida", description: "Atingiu 100% da meta", color: "from-blue-400 to-cyan-500" },
  excelencia: { icon: <Award className="h-6 w-6" />, label: "💎 Excelência", description: "3 metas seguidas completadas", color: "from-pink-500 to-rose-500" },
};

const SellerPerformancePage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [myGoals, setMyGoals] = useState<GoalVendor[]>([]);
  const [myRanking, setMyRanking] = useState<{ daily: LeaderboardEntry | null; weekly: LeaderboardEntry | null; monthly: LeaderboardEntry | null }>({
    daily: null,
    weekly: null,
    monthly: null,
  });
  const [totalPoints, setTotalPoints] = useState(0);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [pointsHistory, setPointsHistory] = useState<PointsHistory[]>([]);
  const [companyLeaderboard, setCompanyLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsights | null>(null);
  const [isLoadingAI, setIsLoadingAI] = useState(false);

  useEffect(() => {
    if (user?.id) {
      fetchData();
    }
  }, [user?.id]);

  const fetchAIInsights = async () => {
    if (!user?.id || !user?.companyId) return;
    setIsLoadingAI(true);

    try {
      const { data, error } = await supabase.functions.invoke("seller-performance-insights", {
        body: { vendor_id: user.id, company_id: user.companyId },
      });

      if (error) throw error;
      setAiInsights(data);
    } catch (error) {
      console.error("Error fetching AI insights:", error);
      toast.error("Erro ao carregar sugestões da IA");
    } finally {
      setIsLoadingAI(false);
    }
  };

  const fetchData = async () => {
    if (!user?.id || !user?.companyId) return;
    setIsLoading(true);

    try {
      // Fetch my goals
      const { data: gvData } = await supabase
        .from("goal_vendors")
        .select(`
          *,
          goal:goals(goal_type, end_date)
        `)
        .eq("vendor_id", user.id);

      setMyGoals((gvData || []) as GoalVendor[]);

      // Fetch total points
      const { data: pointsData } = await supabase
        .from("gamification_points")
        .select("points")
        .eq("vendor_id", user.id);

      const total = (pointsData || []).reduce((acc, p) => acc + p.points, 0);
      setTotalPoints(total);

      // Fetch points history
      const { data: historyData } = await supabase
        .from("gamification_points")
        .select("*")
        .eq("vendor_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10);

      setPointsHistory((historyData || []) as PointsHistory[]);

      // Fetch achievements
      const { data: achData } = await supabase
        .from("achievements")
        .select("*")
        .eq("vendor_id", user.id)
        .order("awarded_at", { ascending: false });

      setAchievements((achData || []) as Achievement[]);

      // Fetch rankings
      const now = new Date();
      const dayStart = now.toISOString().split("T")[0];
      const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split("T")[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

      // Fetch company profiles for names
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("company_id", user.companyId);

      const nameMap = new Map((profiles || []).map(p => [p.user_id, p.name]));

      const { data: lbData } = await supabase
        .from("leaderboard")
        .select("*")
        .eq("company_id", user.companyId);

      const rankings = {
        daily: (lbData || []).find(l => l.vendor_id === user.id && l.period === "daily" && l.period_start === dayStart),
        weekly: (lbData || []).find(l => l.vendor_id === user.id && l.period === "weekly" && l.period_start === weekStart),
        monthly: (lbData || []).find(l => l.vendor_id === user.id && l.period === "monthly" && l.period_start === monthStart),
      };

      setMyRanking({
        daily: rankings.daily ? { ...rankings.daily, vendor_name: nameMap.get(rankings.daily.vendor_id) || "" } : null,
        weekly: rankings.weekly ? { ...rankings.weekly, vendor_name: nameMap.get(rankings.weekly.vendor_id) || "" } : null,
        monthly: rankings.monthly ? { ...rankings.monthly, vendor_name: nameMap.get(rankings.monthly.vendor_id) || "" } : null,
      } as any);

      // Company leaderboard
      const monthlyLb = (lbData || [])
        .filter(l => l.period === "monthly" && l.period_start === monthStart)
        .sort((a, b) => (a.position || 999) - (b.position || 999))
        .map(l => ({ ...l, vendor_name: nameMap.get(l.vendor_id) || "Vendedor" }));

      setCompanyLeaderboard(monthlyLb as LeaderboardEntry[]);

    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setIsLoading(false);
    }
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

  const activeGoals = myGoals.filter(g => g.progress < 100);
  const mainGoal = activeGoals[0];
  const salesLeft = mainGoal ? Math.max(0, mainGoal.target_value - mainGoal.current_value) : 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Minha Performance</h1>
            <p className="text-muted-foreground">Acompanhe suas metas e conquistas</p>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-lg">
            <Star className="h-5 w-5" />
            <span className="font-bold text-lg">{totalPoints}</span>
            <span className="text-sm opacity-80">pontos</span>
          </div>
        </div>

        {/* Main Goal Card */}
        {mainGoal && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-6 w-6 text-primary" />
                Meta Atual: {GOAL_TYPES[mainGoal.goal?.goal_type as keyof typeof GOAL_TYPES]}
              </CardTitle>
              <CardDescription>
                {mainGoal.goal?.end_date && `Prazo: ${format(new Date(mainGoal.goal.end_date), "dd 'de' MMMM", { locale: ptBR })}`}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-4xl font-bold text-foreground">{mainGoal.current_value}</p>
                    <p className="text-sm text-muted-foreground">de {mainGoal.target_value}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-bold text-primary">{mainGoal.progress.toFixed(0)}%</p>
                    <p className="text-sm text-muted-foreground">concluído</p>
                  </div>
                </div>
                <Progress value={mainGoal.progress} className="h-4" />
                {salesLeft > 0 && (
                  <div className="flex items-center gap-2 text-sm bg-muted/50 p-3 rounded-lg">
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span>Faltam <strong>{salesLeft}</strong> para bater sua meta!</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Trophy className="h-8 w-8 text-yellow-500 mb-2" />
                <p className="text-2xl font-bold">{myRanking.monthly?.position || "-"}</p>
                <p className="text-xs text-muted-foreground">Posição (Mês)</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Medal className="h-8 w-8 text-primary mb-2" />
                <p className="text-2xl font-bold">{achievements.length}</p>
                <p className="text-xs text-muted-foreground">Conquistas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <Target className="h-8 w-8 text-green-500 mb-2" />
                <p className="text-2xl font-bold">{myGoals.filter(g => g.progress >= 100).length}</p>
                <p className="text-xs text-muted-foreground">Metas Batidas</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center">
                <TrendingUp className="h-8 w-8 text-blue-500 mb-2" />
                <p className="text-2xl font-bold">{myRanking.weekly?.total_points || 0}</p>
                <p className="text-xs text-muted-foreground">Pontos (Semana)</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="ai-coach" className="space-y-4">
          <TabsList>
            <TabsTrigger value="ai-coach">
              <Bot className="h-4 w-4 mr-1" />
              Coach IA
            </TabsTrigger>
            <TabsTrigger value="ranking">Ranking</TabsTrigger>
            <TabsTrigger value="badges">Minhas Conquistas</TabsTrigger>
            <TabsTrigger value="history">Histórico de Pontos</TabsTrigger>
          </TabsList>

          <TabsContent value="ai-coach">
            <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="h-5 w-5 text-primary" />
                      Sugestões da IA para Bater Metas
                    </CardTitle>
                    <CardDescription>
                      Análise personalizada do seu desempenho com dicas práticas
                    </CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={fetchAIInsights}
                    disabled={isLoadingAI}
                  >
                    {isLoadingAI ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <RefreshCw className="h-4 w-4 mr-1" />
                        Atualizar
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {!aiInsights && !isLoadingAI ? (
                  <div className="text-center py-8">
                    <Bot className="h-16 w-16 text-primary/40 mx-auto mb-4" />
                    <p className="text-muted-foreground mb-4">
                      Clique no botão acima para gerar sugestões personalizadas da IA
                    </p>
                    <Button onClick={fetchAIInsights}>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Gerar Sugestões
                    </Button>
                  </div>
                ) : isLoadingAI ? (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                    <p className="text-muted-foreground">Analisando seu desempenho...</p>
                  </div>
                ) : aiInsights ? (
                  <div className="space-y-6">
                    {/* Stats summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-background/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-green-500">{aiInsights.stats.wonSales}</p>
                        <p className="text-xs text-muted-foreground">Vendas (30 dias)</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-primary">{aiInsights.stats.conversionRate}%</p>
                        <p className="text-xs text-muted-foreground">Taxa Conversão</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-orange-500">{aiInsights.hotLeadsCount}</p>
                        <p className="text-xs text-muted-foreground">Leads Quentes</p>
                      </div>
                      <div className="bg-background/50 rounded-lg p-3 text-center">
                        <p className="text-2xl font-bold text-purple-500">
                          {aiInsights.stats.rankingPosition ? `#${aiInsights.stats.rankingPosition}` : "-"}
                        </p>
                        <p className="text-xs text-muted-foreground">No Ranking</p>
                      </div>
                    </div>

                    {/* AI Insights */}
                    <div className="bg-background rounded-lg p-4 border">
                      <div className="flex items-start gap-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Sparkles className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1 prose prose-sm dark:prose-invert max-w-none">
                          <div className="whitespace-pre-wrap text-sm leading-relaxed">
                            {aiInsights.aiInsights}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Active goals reminder */}
                    {aiInsights.activeGoals.length > 0 && (
                      <div className="bg-background/50 rounded-lg p-4">
                        <h4 className="font-medium mb-3 flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          Suas Metas Ativas
                        </h4>
                        <div className="space-y-2">
                          {aiInsights.activeGoals.map((goal, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span>{GOAL_TYPES[goal.type as keyof typeof GOAL_TYPES] || goal.type}</span>
                              <div className="flex items-center gap-2">
                                <Progress value={goal.progress} className="w-20 h-2" />
                                <span className="text-xs font-medium">{goal.progress?.toFixed(0)}%</span>
                                {goal.remaining > 0 && (
                                  <Badge variant="outline" className="text-xs">
                                    Faltam {goal.remaining}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : null}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ranking">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Ranking Mensal da Equipe
                </CardTitle>
              </CardHeader>
              <CardContent>
                {companyLeaderboard.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum dado de ranking ainda</p>
                ) : (
                  <div className="space-y-3">
                    {companyLeaderboard.map((entry, index) => {
                      const isMe = entry.vendor_id === user?.id;
                      return (
                        <div 
                          key={entry.vendor_id}
                          className={`flex items-center gap-4 p-3 rounded-lg transition-all ${
                            isMe ? "bg-primary/10 border-2 border-primary ring-2 ring-primary/20" :
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
                            <p className="font-medium">{entry.vendor_name} {isMe && <Badge className="ml-2">Você</Badge>}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold">{entry.total_points}</p>
                            <p className="text-xs text-muted-foreground">pontos</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="badges">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-purple-500" />
                  Minhas Conquistas
                </CardTitle>
              </CardHeader>
              <CardContent>
                {achievements.length === 0 ? (
                  <div className="text-center py-12">
                    <Medal className="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
                    <p className="text-muted-foreground">Continue vendendo para conquistar badges!</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {achievements.map((ach) => {
                      const badgeInfo = BADGE_INFO[ach.badge_type] || { 
                        icon: <Award className="h-6 w-6" />, 
                        label: ach.badge_type, 
                        description: "",
                        color: "from-gray-400 to-gray-500" 
                      };
                      return (
                        <div 
                          key={ach.id} 
                          className={`flex items-center gap-4 p-4 rounded-xl bg-gradient-to-r ${badgeInfo.color} text-white`}
                        >
                          <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/20">
                            {badgeInfo.icon}
                          </div>
                          <div>
                            <p className="font-bold text-lg">{badgeInfo.label}</p>
                            <p className="text-sm opacity-80">{badgeInfo.description}</p>
                            <p className="text-xs opacity-60 mt-1">
                              {format(new Date(ach.awarded_at), "dd/MM/yyyy", { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="h-5 w-5 text-yellow-500" />
                  Histórico de Pontos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {pointsHistory.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Nenhum ponto registrado ainda</p>
                ) : (
                  <div className="space-y-3">
                    {pointsHistory.map((p) => (
                      <div key={p.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                        <div>
                          <p className="font-medium">{p.reason}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(p.created_at), "dd/MM 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        <Badge className={p.points > 0 ? "bg-green-500" : "bg-red-500"}>
                          {p.points > 0 ? "+" : ""}{p.points}
                        </Badge>
                      </div>
                    ))}
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

export default SellerPerformancePage;
