import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useManagerDashboard } from "@/hooks/useManagerDashboard";
import { KPICard } from "@/components/dashboard/KPICard";
import { LeadDistributionChart } from "@/components/dashboard/LeadDistributionChart";
import { RiskCyclesList } from "@/components/dashboard/RiskCyclesList";
import { ObjectionsChart } from "@/components/dashboard/ObjectionsChart";
import { SellerPerformanceChart } from "@/components/dashboard/SellerPerformanceChart";
import { SalesTimelineChart } from "@/components/dashboard/SalesTimelineChart";
import { RecentSalesTable } from "@/components/dashboard/RecentSalesTable";
import { PostSaleMetrics } from "@/components/dashboard/PostSaleMetrics";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, Clock, Target, Flame, TrendingUp, TrendingDown, Users, CheckCircle2, XCircle, Bot, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const ManagerDashboardPage = () => {
  const { isLoading, kpis, leadDistribution, riskCycles, objections, sellerPerformance, salesTimeline, recentSales, followupMetrics, postSaleMetrics, refresh } = useManagerDashboard();
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

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Gerencial</h1>
            <p className="text-muted-foreground">Visão estratégica da operação de vendas</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
            <RefreshCw className={cn("h-4 w-4 mr-2", isRefreshing && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* KPIs Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <KPICard title="Pendentes" value={kpis.pendingLeads} icon={Clock} iconClassName="bg-warning/10 text-warning" />
          <KPICard title="Em Progresso" value={kpis.inProgressLeads} icon={TrendingUp} iconClassName="bg-primary/10 text-primary" />
          <KPICard title="Ganhas" value={kpis.wonSales} icon={CheckCircle2} iconClassName="bg-success/10 text-success" />
          <KPICard title="Perdidas" value={kpis.lostSales} icon={XCircle} iconClassName="bg-destructive/10 text-destructive" />
          <KPICard title="Conversão" value={`${kpis.conversionRate}%`} icon={Target} iconClassName="bg-accent/10 text-accent" />
          <KPICard title="Tempo Resp." value={`${kpis.avgResponseTime} min`} icon={Clock} iconClassName="bg-muted text-muted-foreground" />
          <KPICard title="Leads Quentes" value={kpis.hotLeads} icon={Flame} iconClassName="bg-red-500/10 text-red-500" />
        </div>

        {/* Follow-up Metrics - Only show if enabled */}
        {followupMetrics.enabled && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-medium flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Follow-ups Automáticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{followupMetrics.last24h}</p>
                  <p className="text-xs text-muted-foreground">Últimas 24h</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{followupMetrics.last7days}</p>
                  <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
                </div>
                <div className="text-center p-3 bg-muted/50 rounded-lg">
                  <p className="text-2xl font-bold text-foreground">{followupMetrics.totalSent}</p>
                  <p className="text-xs text-muted-foreground">Total enviados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Post-Sale Metrics */}
        <PostSaleMetrics data={postSaleMetrics} />
        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <LeadDistributionChart bySeller={leadDistribution.bySeller} byTemperature={leadDistribution.byTemperature} />
          <RiskCyclesList cycles={riskCycles} />
          <ObjectionsChart data={objections} />
        </div>

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SellerPerformanceChart data={sellerPerformance} />
        </div>

        {/* Timeline */}
        <SalesTimelineChart data={salesTimeline} />

        {/* Recent Sales */}
        <RecentSalesTable sales={recentSales} showSeller={true} />
      </div>
    </AppLayout>
  );
};

export default ManagerDashboardPage;
