import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  TrendingUp,
  Flame,
  ThermometerSun,
  Snowflake,
  CheckCircle2,
  XCircle,
  Clock,
  Target,
  RefreshCw,
  Loader2,
  Users,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface DashboardMetrics {
  totalConversations: number;
  activeConversations: number;
  wonSales: number;
  lostSales: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  totalSellers: number;
  avgResponseTime: number;
}

interface RecentSale {
  id: string;
  status: string;
  reason: string | null;
  createdAt: string;
  customerName: string;
  sellerName: string;
}

const DashboardPage = () => {
  const { user, session } = useAuth();
  const [metrics, setMetrics] = useState<DashboardMetrics>({
    totalConversations: 0,
    activeConversations: 0,
    wonSales: 0,
    lostSales: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    totalSellers: 0,
    avgResponseTime: 0,
  });
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    if (!user?.companyId) return;

    try {
      // Fetch sellers count
      const { data: sellers } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("company_id", user.companyId);

      const sellerIds = sellers?.map(s => s.user_id) || [];

      // Fetch messages to count conversations
      const { data: customers } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", user.companyId);

      const customerIds = customers?.map(c => c.id) || [];

      // Fetch sales
      const { data: sales } = await supabase
        .from("sales")
        .select("id, status, reason, created_at, customer_id, seller_id")
        .eq("company_id", user.companyId)
        .order("created_at", { ascending: false });

      const wonSales = sales?.filter(s => s.status === "won").length || 0;
      const lostSales = sales?.filter(s => s.status === "lost").length || 0;

      // Fetch insights to get lead temperatures
      const { data: insights } = await supabase
        .from("insights")
        .select("temperature, message_id");

      // Get unique temperatures per customer (latest insight)
      const temperatureCounts = { hot: 0, warm: 0, cold: 0 };
      
      if (insights && insights.length > 0) {
        // Count temperatures
        const tempMap = new Map<string, string>();
        insights.forEach(insight => {
          if (insight.temperature) {
            tempMap.set(insight.message_id, insight.temperature);
          }
        });
        
        tempMap.forEach(temp => {
          if (temp === 'hot') temperatureCounts.hot++;
          else if (temp === 'warm') temperatureCounts.warm++;
          else temperatureCounts.cold++;
        });
      }

      // Count active conversations (customers with messages in last 24h)
      const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: recentMessages } = await supabase
        .from("messages")
        .select("customer_id")
        .gte("timestamp", oneDayAgo);

      const activeCustomers = new Set(recentMessages?.map(m => m.customer_id) || []);

      setMetrics({
        totalConversations: customerIds.length,
        activeConversations: activeCustomers.size,
        wonSales,
        lostSales,
        hotLeads: temperatureCounts.hot,
        warmLeads: temperatureCounts.warm,
        coldLeads: temperatureCounts.cold,
        totalSellers: sellerIds.length - 1, // Exclude manager
        avgResponseTime: 3, // Would need message timestamp analysis
      });

      // Fetch recent sales with customer and seller names
      if (sales && sales.length > 0) {
        const recentSalesData: RecentSale[] = [];
        
        for (const sale of sales.slice(0, 5)) {
          const { data: customer } = await supabase
            .from("customers")
            .select("name")
            .eq("id", sale.customer_id)
            .maybeSingle();

          const { data: seller } = await supabase
            .from("profiles")
            .select("name")
            .eq("user_id", sale.seller_id)
            .maybeSingle();

          recentSalesData.push({
            id: sale.id,
            status: sale.status,
            reason: sale.reason,
            createdAt: sale.created_at,
            customerName: customer?.name || "Cliente",
            sellerName: seller?.name || "Vendedor",
          });
        }

        setRecentSales(recentSalesData);
      }
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [user?.companyId]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchDashboardData();
  };

  const statsCards = [
    {
      title: "Conversas Ativas",
      value: metrics.activeConversations,
      total: metrics.totalConversations,
      icon: MessageSquare,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      title: "Vendedores",
      value: metrics.totalSellers,
      icon: Users,
      iconClass: "bg-success/10 text-success",
    },
    {
      title: "Taxa de Conversão",
      value: metrics.wonSales + metrics.lostSales > 0 
        ? `${Math.round((metrics.wonSales / (metrics.wonSales + metrics.lostSales)) * 100)}%`
        : "0%",
      icon: Target,
      iconClass: "bg-warning/10 text-warning",
    },
  ];

  const leadStats = [
    {
      label: "Leads Quentes",
      value: metrics.hotLeads,
      icon: Flame,
      color: "bg-lead-hot",
    },
    {
      label: "Leads Mornos",
      value: metrics.warmLeads,
      icon: ThermometerSun,
      color: "bg-lead-warm",
    },
    {
      label: "Leads Frios",
      value: metrics.coldLeads,
      icon: Snowflake,
      color: "bg-lead-cold",
    },
  ];

  const totalLeads = metrics.hotLeads + metrics.warmLeads + metrics.coldLeads || 1;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-[calc(100vh-3rem)] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral do desempenho da equipe</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {statsCards.map((stat) => (
            <Card key={stat.title} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{stat.title}</p>
                    <p className="text-3xl font-bold">{stat.value}</p>
                    {stat.total !== undefined && (
                      <p className="text-sm text-muted-foreground mt-1">
                        de {stat.total} total
                      </p>
                    )}
                  </div>
                  <div className={`h-12 w-12 rounded-lg flex items-center justify-center ${stat.iconClass}`}>
                    <stat.icon className="h-6 w-6" />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Lead Distribution & Sales */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Lead Temperature Distribution */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                Distribuição de Leads
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {leadStats.map((lead) => (
                  <div key={lead.label}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <lead.icon className="h-4 w-4" />
                        <span className="text-sm font-medium">{lead.label}</span>
                      </div>
                      <span className="text-sm font-semibold">{lead.value}</span>
                    </div>
                    <Progress
                      value={(lead.value / totalLeads) * 100}
                      className={`h-2 [&>div]:${lead.color}`}
                    />
                  </div>
                ))}
              </div>

              {/* Visual representation */}
              <div className="flex h-8 rounded-lg overflow-hidden mt-6">
                <div
                  className="bg-lead-hot transition-all"
                  style={{ width: `${(metrics.hotLeads / totalLeads) * 100}%` }}
                />
                <div
                  className="bg-lead-warm transition-all"
                  style={{ width: `${(metrics.warmLeads / totalLeads) * 100}%` }}
                />
                <div
                  className="bg-lead-cold transition-all"
                  style={{ width: `${(metrics.coldLeads / totalLeads) * 100}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Sales Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Desempenho de Vendas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-success" />
                    <span className="text-sm font-medium">Vendas Ganhas</span>
                  </div>
                  <p className="text-3xl font-bold text-success">{metrics.wonSales}</p>
                </div>
                <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
                  <div className="flex items-center gap-2 mb-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    <span className="text-sm font-medium">Vendas Perdidas</span>
                  </div>
                  <p className="text-3xl font-bold text-destructive">{metrics.lostSales}</p>
                </div>
              </div>

              {/* Win rate visualization */}
              {(metrics.wonSales + metrics.lostSales) > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium">Taxa de Sucesso</span>
                    <span className="text-sm font-semibold text-success">
                      {Math.round((metrics.wonSales / (metrics.wonSales + metrics.lostSales)) * 100)}%
                    </span>
                  </div>
                  <div className="flex h-4 rounded-full overflow-hidden bg-destructive/20">
                    <div
                      className="bg-success transition-all"
                      style={{
                        width: `${(metrics.wonSales / (metrics.wonSales + metrics.lostSales)) * 100}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {(metrics.wonSales + metrics.lostSales) === 0 && (
                <p className="text-center text-muted-foreground text-sm">
                  Nenhuma venda registrada ainda
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {recentSales.length > 0 ? (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                  >
                    <div className="flex items-center gap-3">
                      {sale.status === "won" ? (
                        <CheckCircle2 className="h-5 w-5 text-success" />
                      ) : (
                        <XCircle className="h-5 w-5 text-destructive" />
                      )}
                      <div>
                        <p className="font-medium">{sale.customerName}</p>
                        <p className="text-sm text-muted-foreground">
                          por {sale.sellerName}
                          {sale.reason && ` • ${sale.reason}`}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(new Date(sale.createdAt), {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nenhuma venda registrada ainda</p>
                <p className="text-sm">As vendas aparecerão aqui conforme forem registradas</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;