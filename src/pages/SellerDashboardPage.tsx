import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useSellerDashboard } from "@/hooks/useSellerDashboard";
import { KPICard } from "@/components/dashboard/KPICard";
import { PrioritiesList } from "@/components/dashboard/PrioritiesList";
import { MonthlyConversionChart } from "@/components/dashboard/MonthlyConversionChart";
import { RecentSalesTable } from "@/components/dashboard/RecentSalesTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, RefreshCw, Clock, Flame, TrendingUp, CheckCircle2, AlertTriangle, MessageSquare, Calendar, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const SellerDashboardPage = () => {
  const { isLoading, kpis, priorities, funnel, monthlyConversion, personalPerformance, recentCycles, refresh } = useSellerDashboard();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refresh();
    setIsRefreshing(false);
  };

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

  const recentSalesData = recentCycles
    .filter((c) => c.status === "won" || c.status === "lost")
    .map((c) => ({
      id: c.id,
      customerName: c.customerName,
      sellerName: "",
      status: c.status as "won" | "lost",
      reason: null,
      closedAt: c.createdAt,
      cycleId: c.id,
    }));

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Meu Dashboard</h1>
            <p className="text-muted-foreground">Sua performance e prioridades do dia</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          <KPICard title="Pendentes" value={kpis.pendingLeads} icon={Clock} iconClassName="bg-warning/10 text-warning" />
          <KPICard title="Em Progresso" value={kpis.inProgressLeads} icon={TrendingUp} iconClassName="bg-primary/10 text-primary" />
          <KPICard title="Vendas Ganhas" value={kpis.wonSales} icon={CheckCircle2} iconClassName="bg-success/10 text-success" />
          <KPICard title="Leads Quentes" value={kpis.hotLeads} icon={Flame} iconClassName="bg-red-500/10 text-red-500" />
          <KPICard title="Tempo Resp." value={`${kpis.avgResponseTime} min`} icon={Clock} iconClassName="bg-muted text-muted-foreground" />
          <KPICard title="Em Risco" value={kpis.riskCyclesCount} icon={AlertTriangle} iconClassName="bg-destructive/10 text-destructive" />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <PrioritiesList priorities={priorities} />
          
          {/* Personal Performance */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Desempenho Pessoal
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Msgs Enviadas</span>
                </div>
                <p className="text-2xl font-bold">{personalPerformance.messagesSent}</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2 mb-1">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Tempo Médio</span>
                </div>
                <p className="text-2xl font-bold">{personalPerformance.avgResponseTime} min</p>
              </div>
              <div className="p-4 rounded-lg bg-muted/50 col-span-2">
                <div className="flex items-center gap-2 mb-1">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span className="text-sm text-muted-foreground">Melhor Dia</span>
                </div>
                <p className="text-xl font-bold">{personalPerformance.bestDayOfWeek || "N/A"}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Funnel */}
        {funnel.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Funil de Vendas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 overflow-x-auto pb-4">
                {funnel.map((stage) => (
                  <div key={stage.stage} className="flex-shrink-0 w-[180px] bg-muted/50 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">{stage.label}</span>
                      <Badge variant="secondary">{stage.leads.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {stage.leads.slice(0, 3).map((lead) => (
                        <div key={lead.id} className="bg-card rounded p-2 text-xs">
                          <p className="font-medium truncate">{lead.customerName}</p>
                        </div>
                      ))}
                      {stage.leads.length > 3 && (
                        <p className="text-xs text-muted-foreground text-center">+{stage.leads.length - 3} mais</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <MonthlyConversionChart data={monthlyConversion} />
          <RecentSalesTable sales={recentSalesData} showSeller={false} />
        </div>
      </div>
    </AppLayout>
  );
};

export default SellerDashboardPage;
