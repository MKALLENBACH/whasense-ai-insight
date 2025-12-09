import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockDashboardMetrics, mockSales, mockConversations } from "@/data/mockData";
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
} from "lucide-react";
import { Progress } from "@/components/ui/progress";

const DashboardPage = () => {
  const metrics = mockDashboardMetrics;

  const statsCards = [
    {
      title: "Conversas Ativas",
      value: metrics.activeConversations,
      total: metrics.totalConversations,
      icon: MessageSquare,
      iconClass: "bg-primary/10 text-primary",
    },
    {
      title: "Taxa de Conversão",
      value: `${metrics.conversionRate}%`,
      icon: Target,
      iconClass: "bg-success/10 text-success",
    },
    {
      title: "Tempo Médio de Resposta",
      value: `${metrics.avgResponseTime} min`,
      icon: Clock,
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

  const totalLeads = metrics.hotLeads + metrics.warmLeads + metrics.coldLeads;

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral do desempenho da equipe</p>
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
                    {stat.total && (
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
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Vendas Recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockSales.slice(0, 5).map((sale) => (
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
                      <p className="font-medium">{sale.contactName}</p>
                      {sale.notes && (
                        <p className="text-sm text-muted-foreground">{sale.notes}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    {sale.status === "won" && (
                      <p className="font-semibold text-success">
                        R$ {sale.value.toLocaleString("pt-BR")}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {sale.closedAt.toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
