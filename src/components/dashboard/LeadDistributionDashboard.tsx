import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Inbox, 
  Users, 
  Clock, 
  TrendingUp, 
  ArrowRight,
  User,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Timer
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";

interface LeadStats {
  inboxPai: number;
  withSellers: number;
  totalActive: number;
  avgWaitTime: number;
  avgTimeToFirstResponse: number;
  sellerDistribution: Array<{
    sellerId: string;
    sellerName: string;
    leadCount: number;
    pendingCount: number;
    inProgressCount: number;
  }>;
  hourlyInflow: Array<{
    hour: string;
    count: number;
  }>;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--chart-2))', 'hsl(var(--chart-3))', 'hsl(var(--chart-4))', 'hsl(var(--chart-5))'];

export function LeadDistributionDashboard() {
  const { session, user } = useAuth();
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (session?.access_token && user?.companyId) {
      fetchStats();
    }
  }, [session?.access_token, user?.companyId]);

  const fetchStats = async () => {
    if (!user?.companyId) return;

    try {
      // Fetch inbox pai count
      const { count: inboxCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.companyId)
        .is('assigned_to', null)
        .in('lead_status', ['pending', 'in_progress']);

      // Fetch with sellers count
      const { count: withSellersCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', user.companyId)
        .not('assigned_to', 'is', null)
        .in('lead_status', ['pending', 'in_progress']);

      // Fetch seller distribution
      const { data: sellersData } = await supabase
        .from('profiles')
        .select('user_id, name')
        .eq('company_id', user.companyId)
        .eq('is_active', true);

      const sellerDistribution: LeadStats['sellerDistribution'] = [];

      if (sellersData) {
        for (const seller of sellersData) {
          const { count: totalCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', user.companyId)
            .eq('assigned_to', seller.user_id)
            .in('lead_status', ['pending', 'in_progress']);

          const { count: pendingCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', user.companyId)
            .eq('assigned_to', seller.user_id)
            .eq('lead_status', 'pending');

          const { count: inProgressCount } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('company_id', user.companyId)
            .eq('assigned_to', seller.user_id)
            .eq('lead_status', 'in_progress');

          if ((totalCount || 0) > 0) {
            sellerDistribution.push({
              sellerId: seller.user_id,
              sellerName: seller.name,
              leadCount: totalCount || 0,
              pendingCount: pendingCount || 0,
              inProgressCount: inProgressCount || 0,
            });
          }
        }
      }

      // Sort by lead count
      sellerDistribution.sort((a, b) => b.leadCount - a.leadCount);

      // Calculate avg wait time for inbox pai leads
      const { data: inboxLeads } = await supabase
        .from('customers')
        .select('created_at')
        .eq('company_id', user.companyId)
        .is('assigned_to', null)
        .in('lead_status', ['pending', 'in_progress'])
        .limit(100);

      let avgWaitTime = 0;
      if (inboxLeads && inboxLeads.length > 0) {
        const now = new Date();
        const totalMinutes = inboxLeads.reduce((acc, lead) => {
          const created = new Date(lead.created_at);
          return acc + (now.getTime() - created.getTime()) / (1000 * 60);
        }, 0);
        avgWaitTime = Math.round(totalMinutes / inboxLeads.length);
      }

      setStats({
        inboxPai: inboxCount || 0,
        withSellers: withSellersCount || 0,
        totalActive: (inboxCount || 0) + (withSellersCount || 0),
        avgWaitTime,
        avgTimeToFirstResponse: 0, // TODO: Calculate from messages
        sellerDistribution,
        hourlyInflow: [], // TODO: Implement hourly inflow
      });
    } catch (error) {
      console.error('Error fetching lead stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="col-span-full">
        <CardContent className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  if (!stats) return null;

  const pieData = [
    { name: 'Inbox Pai', value: stats.inboxPai, color: 'hsl(var(--warning))' },
    { name: 'Com Vendedores', value: stats.withSellers, color: 'hsl(var(--primary))' },
  ];

  const inboxPercentage = stats.totalActive > 0 
    ? Math.round((stats.inboxPai / stats.totalActive) * 100) 
    : 0;

  const formatWaitTime = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 24 
      ? `${Math.floor(hours / 24)}d ${hours % 24}h`
      : `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-6">
      {/* Main KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Inbox Pai */}
        <Card className={cn(
          "relative overflow-hidden",
          stats.inboxPai > 50 && "border-warning"
        )}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Inbox className="h-4 w-4" />
              Inbox Pai
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className={cn(
                  "text-4xl font-bold",
                  stats.inboxPai > 50 ? "text-warning" : "text-foreground"
                )}>
                  {stats.inboxPai}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  leads aguardando
                </p>
              </div>
              {stats.inboxPai > 50 && (
                <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Alto
                </Badge>
              )}
            </div>
            {stats.avgWaitTime > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Timer className="h-3 w-3" />
                  Tempo médio de espera: <span className="font-medium text-foreground">{formatWaitTime(stats.avgWaitTime)}</span>
                </div>
              </div>
            )}
          </CardContent>
          <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-warning/5" />
        </Card>

        {/* Com Vendedores */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Com Vendedores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold text-primary">{stats.withSellers}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  leads atribuídos
                </p>
              </div>
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                <CheckCircle2 className="h-3 w-3 mr-1" />
                Ativos
              </Badge>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <User className="h-3 w-3" />
                {stats.sellerDistribution.length} vendedor(es) com leads
              </div>
            </div>
          </CardContent>
          <div className="absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-primary/5" />
        </Card>

        {/* Total Ativos */}
        <Card className="relative overflow-hidden">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Total Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-4xl font-bold">{stats.totalActive}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  leads em andamento
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-border">
              <Progress 
                value={100 - inboxPercentage} 
                className="h-2"
              />
              <p className="text-xs text-muted-foreground mt-2">
                {100 - inboxPercentage}% atribuídos
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Fluxo */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-background to-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ArrowRight className="h-4 w-4" />
              Fluxo de Atribuição
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center gap-3 py-2">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-warning/10 flex items-center justify-center mb-1">
                  <Inbox className="h-5 w-5 text-warning" />
                </div>
                <p className="text-lg font-bold">{stats.inboxPai}</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground" />
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-1">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <p className="text-lg font-bold">{stats.withSellers}</p>
              </div>
            </div>
            <p className="text-xs text-center text-muted-foreground mt-2">
              Inbox Pai → Vendedores
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Leads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              {stats.totalActive > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhum lead ativo</p>
                </div>
              )}
            </div>
            <div className="flex items-center justify-center gap-6 mt-4">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-warning" />
                <span className="text-sm text-muted-foreground">Inbox Pai</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-primary" />
                <span className="text-sm text-muted-foreground">Com Vendedores</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Seller Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Leads por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.sellerDistribution.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.sellerDistribution.slice(0, 5)}
                    layout="vertical"
                    margin={{ top: 0, right: 20, left: 0, bottom: 0 }}
                  >
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="sellerName" 
                      type="category" 
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar 
                      dataKey="pendingCount" 
                      stackId="a" 
                      fill="hsl(var(--warning))" 
                      name="Pendentes"
                      radius={[0, 0, 0, 0]}
                    />
                    <Bar 
                      dataKey="inProgressCount" 
                      stackId="a" 
                      fill="hsl(var(--primary))" 
                      name="Em Progresso"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-center text-muted-foreground">
                <div>
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-30" />
                  <p>Nenhum lead atribuído</p>
                  <p className="text-xs mt-1">Leads estão no Inbox Pai</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Seller Details Table */}
      {stats.sellerDistribution.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento por Vendedor</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Vendedor</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Total</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Pendentes</th>
                    <th className="text-center py-3 px-4 text-sm font-medium text-muted-foreground">Em Progresso</th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-muted-foreground">Carga</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.sellerDistribution.map((seller) => {
                    const maxLeads = Math.max(...stats.sellerDistribution.map(s => s.leadCount));
                    const loadPercent = maxLeads > 0 ? (seller.leadCount / maxLeads) * 100 : 0;
                    
                    return (
                      <tr key={seller.sellerId} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                              <User className="h-4 w-4 text-primary" />
                            </div>
                            <span className="font-medium">{seller.sellerName}</span>
                          </div>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge variant="secondary">{seller.leadCount}</Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">
                            {seller.pendingCount}
                          </Badge>
                        </td>
                        <td className="text-center py-3 px-4">
                          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">
                            {seller.inProgressCount}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 w-32">
                          <div className="flex items-center gap-2">
                            <Progress value={loadPercent} className="h-2 flex-1" />
                            <span className="text-xs text-muted-foreground w-10">
                              {loadPercent.toFixed(0)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
