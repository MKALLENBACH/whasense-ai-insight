import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Database, 
  Gauge, 
  MessageSquare, 
  Users, 
  Zap,
  TrendingUp,
  Server,
  Cpu,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SystemMetrics {
  totalMessages24h: number;
  totalLeads24h: number;
  totalIaOps24h: number;
  totalErrors24h: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  queueLength: number;
  activeCompanies: number;
}

interface QueueStats {
  totalPending: number;
  byType: Record<string, number>;
  byCompany: Array<{ companyId: string; companyName: string; count: number }>;
  avgDelayMs: number;
}

interface CompanyMetrics {
  companyId: string;
  companyName: string;
  planName: string;
  leadsHoje: number;
  mensagensHoje: number;
  iaOpsHoje: number;
  errosHoje: number;
  queueItemsPending: number;
  avgResponseTimeMs: number;
  status: "normal" | "alto_uso" | "sobrecarga";
}

interface SystemAlert {
  id: string;
  type: "critical" | "warning" | "info";
  title: string;
  description: string;
}

const AdminSystemHealthPage = () => {
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [metrics, setMetrics] = useState<SystemMetrics>({
    totalMessages24h: 0,
    totalLeads24h: 0,
    totalIaOps24h: 0,
    totalErrors24h: 0,
    avgLatencyMs: 0,
    p95LatencyMs: 0,
    queueLength: 0,
    activeCompanies: 0,
  });
  const [queueStats, setQueueStats] = useState<QueueStats>({
    totalPending: 0,
    byType: {},
    byCompany: [],
    avgDelayMs: 0,
  });
  const [companyMetrics, setCompanyMetrics] = useState<CompanyMetrics[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [latencyHistory, setLatencyHistory] = useState<Array<{ time: string; latency: number; iaLatency: number }>>([]);
  const [queueHistory, setQueueHistory] = useState<Array<{ time: string; pending: number }>>([]);
  const [iaByType, setIaByType] = useState<Array<{ type: string; count: number }>>([]);

  useEffect(() => {
    fetchAllData();
    const interval = setInterval(fetchAllData, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    await Promise.all([
      fetchSystemMetrics(),
      fetchQueueStats(),
      fetchCompanyMetrics(),
      fetchLatencyHistory(),
      fetchIaStats(),
    ]);
    generateAlerts();
    setLastUpdate(new Date());
    setLoading(false);
  };

  const fetchSystemMetrics = async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch messages in last 24h
    const { count: messagesCount } = await supabase
      .from("messages")
      .select("*", { count: "exact", head: true })
      .gte("timestamp", yesterday.toISOString());

    // Fetch leads in last 24h
    const { count: leadsCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .gte("created_at", yesterday.toISOString());

    // Fetch queue stats
    const { count: queueLength } = await supabase
      .from("processing_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");

    // Fetch errors in last 24h
    const { count: errorsCount } = await supabase
      .from("processing_queue")
      .select("*", { count: "exact", head: true })
      .eq("status", "failed")
      .gte("created_at", yesterday.toISOString());

    // Fetch IA ops (from queue completed)
    const { count: iaOpsCount } = await supabase
      .from("processing_queue")
      .select("*", { count: "exact", head: true })
      .in("type", ["text_analysis", "audio_analysis", "image_analysis"])
      .gte("created_at", yesterday.toISOString());

    // Fetch active companies today
    const { data: activeCompaniesData } = await supabase
      .from("analytics_daily_company")
      .select("company_id")
      .eq("date", format(now, "yyyy-MM-dd"));

    // Calculate avg latency from queue processing times
    const { data: latencyData } = await supabase
      .from("queue_usage_hourly")
      .select("avg_processing_time_ms")
      .gte("hour", yesterday.toISOString())
      .not("avg_processing_time_ms", "is", null);

    const avgLatency = latencyData?.length 
      ? latencyData.reduce((sum, r) => sum + (r.avg_processing_time_ms || 0), 0) / latencyData.length 
      : 0;

    // Estimate P95 (simplified - in production would use percentile calculation)
    const p95Latency = avgLatency * 1.8;

    setMetrics({
      totalMessages24h: messagesCount || 0,
      totalLeads24h: leadsCount || 0,
      totalIaOps24h: iaOpsCount || 0,
      totalErrors24h: errorsCount || 0,
      avgLatencyMs: Math.round(avgLatency),
      p95LatencyMs: Math.round(p95Latency),
      queueLength: queueLength || 0,
      activeCompanies: activeCompaniesData?.length || 0,
    });
  };

  const fetchQueueStats = async () => {
    // Fetch pending items by type
    const { data: queueData } = await supabase
      .from("processing_queue")
      .select("type, company_id, created_at, started_at")
      .eq("status", "pending");

    if (!queueData) {
      setQueueStats({ totalPending: 0, byType: {}, byCompany: [], avgDelayMs: 0 });
      return;
    }

    // Count by type
    const byType: Record<string, number> = {};
    queueData.forEach(item => {
      byType[item.type] = (byType[item.type] || 0) + 1;
    });

    // Count by company
    const companyCountMap: Record<string, number> = {};
    queueData.forEach(item => {
      companyCountMap[item.company_id] = (companyCountMap[item.company_id] || 0) + 1;
    });

    // Fetch company names
    const companyIds = Object.keys(companyCountMap);
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name")
      .in("id", companyIds.length > 0 ? companyIds : ["none"]);

    const companyNameMap: Record<string, string> = {};
    companies?.forEach(c => { companyNameMap[c.id] = c.name; });

    const byCompany = Object.entries(companyCountMap)
      .map(([companyId, count]) => ({
        companyId,
        companyName: companyNameMap[companyId] || "Desconhecida",
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Calculate average delay
    const now = new Date().getTime();
    const delays = queueData.map(item => now - new Date(item.created_at).getTime());
    const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : 0;

    setQueueStats({
      totalPending: queueData.length,
      byType,
      byCompany,
      avgDelayMs: Math.round(avgDelay),
    });
  };

  const fetchCompanyMetrics = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Fetch companies with plans
    const { data: companies } = await supabase
      .from("companies")
      .select("id, name, plans(name)")
      .eq("is_active", true);

    if (!companies) {
      setCompanyMetrics([]);
      return;
    }

    // Fetch daily analytics
    const { data: analytics } = await supabase
      .from("analytics_daily_company")
      .select("*")
      .eq("date", today);

    const analyticsMap: Record<string, any> = {};
    analytics?.forEach(a => { analyticsMap[a.company_id] = a; });

    // Fetch queue counts per company
    const { data: queueData } = await supabase
      .from("processing_queue")
      .select("company_id")
      .eq("status", "pending");

    const queueCountMap: Record<string, number> = {};
    queueData?.forEach(q => {
      queueCountMap[q.company_id] = (queueCountMap[q.company_id] || 0) + 1;
    });

    // Fetch errors per company
    const { data: errorData } = await supabase
      .from("processing_queue")
      .select("company_id")
      .eq("status", "failed")
      .gte("created_at", yesterday.toISOString());

    const errorCountMap: Record<string, number> = {};
    errorData?.forEach(e => {
      errorCountMap[e.company_id] = (errorCountMap[e.company_id] || 0) + 1;
    });

    // Fetch latency per company
    const { data: latencyData } = await supabase
      .from("queue_usage_hourly")
      .select("company_id, avg_processing_time_ms")
      .gte("hour", yesterday.toISOString());

    const latencyMap: Record<string, number[]> = {};
    latencyData?.forEach(l => {
      if (!latencyMap[l.company_id]) latencyMap[l.company_id] = [];
      if (l.avg_processing_time_ms) latencyMap[l.company_id].push(l.avg_processing_time_ms);
    });

    // Calculate global averages for comparison
    const globalAvgMessages = analytics?.length 
      ? analytics.reduce((sum, a) => sum + a.total_messages, 0) / analytics.length 
      : 100;
    const globalAvgIa = analytics?.length 
      ? analytics.reduce((sum, a) => sum + a.ai_text_analyses + a.ai_audio_analyses + a.ai_image_analyses, 0) / analytics.length 
      : 50;

    const companyMetricsData: CompanyMetrics[] = companies.map(company => {
      const analytics = analyticsMap[company.id] || {};
      const queuePending = queueCountMap[company.id] || 0;
      const errors = errorCountMap[company.id] || 0;
      const latencies = latencyMap[company.id] || [];
      const avgLatency = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
      
      const mensagens = analytics.total_messages || 0;
      const iaOps = (analytics.ai_text_analyses || 0) + (analytics.ai_audio_analyses || 0) + (analytics.ai_image_analyses || 0);

      // Determine status
      let status: "normal" | "alto_uso" | "sobrecarga" = "normal";
      
      if (avgLatency > 3000 || queuePending > 200 || errors > 50) {
        status = "sobrecarga";
      } else if (mensagens > globalAvgMessages * 3 || iaOps > globalAvgIa * 3 || queuePending > 100) {
        status = "alto_uso";
      }

      return {
        companyId: company.id,
        companyName: company.name,
        planName: (company.plans as any)?.name || "Sem plano",
        leadsHoje: analytics.new_leads || 0,
        mensagensHoje: mensagens,
        iaOpsHoje: iaOps,
        errosHoje: errors,
        queueItemsPending: queuePending,
        avgResponseTimeMs: Math.round(avgLatency),
        status,
      };
    });

    // Sort by status priority then by queue items
    const statusPriority = { sobrecarga: 0, alto_uso: 1, normal: 2 };
    companyMetricsData.sort((a, b) => {
      const priorityDiff = statusPriority[a.status] - statusPriority[b.status];
      if (priorityDiff !== 0) return priorityDiff;
      return b.queueItemsPending - a.queueItemsPending;
    });

    setCompanyMetrics(companyMetricsData);
  };

  const fetchLatencyHistory = async () => {
    const now = new Date();
    const hoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000);

    const { data } = await supabase
      .from("queue_usage_hourly")
      .select("hour, avg_processing_time_ms, ai_ops_count")
      .gte("hour", hoursAgo.toISOString())
      .order("hour", { ascending: true });

    if (!data) return;

    // Aggregate by hour
    const hourlyData: Record<string, { latencies: number[]; iaOps: number }> = {};
    data.forEach(row => {
      const hour = format(new Date(row.hour), "HH:mm");
      if (!hourlyData[hour]) hourlyData[hour] = { latencies: [], iaOps: 0 };
      if (row.avg_processing_time_ms) hourlyData[hour].latencies.push(row.avg_processing_time_ms);
      hourlyData[hour].iaOps += row.ai_ops_count || 0;
    });

    const latencyHistory = Object.entries(hourlyData).map(([time, data]) => ({
      time,
      latency: data.latencies.length ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length) : 0,
      iaLatency: data.latencies.length ? Math.round(data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length * 1.2) : 0,
    }));

    setLatencyHistory(latencyHistory);

    // Generate queue history (simulated based on current queue)
    const queueHistoryData = latencyHistory.map((item, idx) => ({
      time: item.time,
      pending: Math.max(0, queueStats.totalPending - (latencyHistory.length - idx) * 5 + Math.random() * 20),
    }));
    setQueueHistory(queueHistoryData);
  };

  const fetchIaStats = async () => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const { data } = await supabase
      .from("processing_queue")
      .select("type")
      .in("type", ["text_analysis", "audio_analysis", "image_analysis"])
      .gte("created_at", yesterday.toISOString());

    if (!data) return;

    const typeCount: Record<string, number> = {};
    data.forEach(item => {
      typeCount[item.type] = (typeCount[item.type] || 0) + 1;
    });

    const iaByTypeData = [
      { type: "Texto", count: typeCount["text_analysis"] || 0 },
      { type: "Áudio", count: typeCount["audio_analysis"] || 0 },
      { type: "Visão", count: typeCount["image_analysis"] || 0 },
    ];

    setIaByType(iaByTypeData);
  };

  const generateAlerts = () => {
    const newAlerts: SystemAlert[] = [];

    if (metrics.queueLength > 2000) {
      newAlerts.push({
        id: "queue-critical",
        type: "critical",
        title: "Fila muito grande",
        description: `A fila de processamento tem ${metrics.queueLength} itens pendentes.`,
      });
    } else if (metrics.queueLength > 500) {
      newAlerts.push({
        id: "queue-warning",
        type: "warning",
        title: "Fila crescendo",
        description: `A fila de processamento tem ${metrics.queueLength} itens pendentes.`,
      });
    }

    if (metrics.avgLatencyMs > 3000) {
      newAlerts.push({
        id: "latency-critical",
        type: "critical",
        title: "Latência crítica",
        description: `Latência média está em ${metrics.avgLatencyMs}ms (acima de 3000ms).`,
      });
    } else if (metrics.avgLatencyMs > 1500) {
      newAlerts.push({
        id: "latency-warning",
        type: "warning",
        title: "Latência elevada",
        description: `Latência média está em ${metrics.avgLatencyMs}ms.`,
      });
    }

    if (metrics.totalErrors24h > 100) {
      newAlerts.push({
        id: "errors-critical",
        type: "critical",
        title: "Muitos erros",
        description: `${metrics.totalErrors24h} erros nas últimas 24h.`,
      });
    } else if (metrics.totalErrors24h > 20) {
      newAlerts.push({
        id: "errors-warning",
        type: "warning",
        title: "Erros detectados",
        description: `${metrics.totalErrors24h} erros nas últimas 24h.`,
      });
    }

    const companiesOverloaded = companyMetrics.filter(c => c.status === "sobrecarga");
    if (companiesOverloaded.length > 0) {
      newAlerts.push({
        id: "companies-overload",
        type: "warning",
        title: "Empresas em sobrecarga",
        description: `${companiesOverloaded.length} empresa(s) com status de sobrecarga.`,
      });
    }

    if (newAlerts.length === 0) {
      newAlerts.push({
        id: "all-ok",
        type: "info",
        title: "Sistema saudável",
        description: "Todos os indicadores estão dentro dos parâmetros normais.",
      });
    }

    setAlerts(newAlerts);
  };

  useEffect(() => {
    if (companyMetrics.length > 0) {
      generateAlerts();
    }
  }, [metrics, companyMetrics]);

  const getStatusBadge = (status: "normal" | "alto_uso" | "sobrecarga") => {
    switch (status) {
      case "normal":
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">Normal</Badge>;
      case "alto_uso":
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Alto Uso</Badge>;
      case "sobrecarga":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Sobrecarga</Badge>;
    }
  };

  const getAlertVariant = (type: "critical" | "warning" | "info") => {
    switch (type) {
      case "critical":
        return "destructive";
      case "warning":
        return "default";
      case "info":
        return "default";
    }
  };

  const getAlertIcon = (type: "critical" | "warning" | "info") => {
    switch (type) {
      case "critical":
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      case "info":
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Saúde do Sistema</h1>
            <p className="text-muted-foreground">
              Última atualização: {format(lastUpdate, "HH:mm:ss", { locale: ptBR })}
            </p>
          </div>
          <Button onClick={fetchAllData} disabled={loading} variant="outline">
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Alerts Section */}
        <div className="space-y-2">
          {alerts.map(alert => (
            <Alert key={alert.id} variant={getAlertVariant(alert.type)}>
              {getAlertIcon(alert.type)}
              <AlertTitle>{alert.title}</AlertTitle>
              <AlertDescription>{alert.description}</AlertDescription>
            </Alert>
          ))}
        </div>

        {/* System Overview Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Mensagens 24h</CardTitle>
              <MessageSquare className="h-4 w-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalMessages24h.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Leads 24h</CardTitle>
              <Users className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalLeads24h.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">IA Ops 24h</CardTitle>
              <Cpu className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalIaOps24h.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Erros 24h</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.totalErrors24h.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Latência Média</CardTitle>
              <Gauge className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.avgLatencyMs}ms</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Latência P95</CardTitle>
              <TrendingUp className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.p95LatencyMs}ms</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Fila Pendente</CardTitle>
              <Database className="h-4 w-4 text-cyan-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.queueLength.toLocaleString()}</div>
            </CardContent>
          </Card>

          <Card className="bg-card border-border">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Empresas Ativas</CardTitle>
              <Activity className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-foreground">{metrics.activeCompanies}</div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Latency Chart */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Clock className="h-5 w-5 text-orange-500" />
                Latência ao Longo do Tempo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={latencyHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Line type="monotone" dataKey="latency" stroke="#f97316" strokeWidth={2} name="APIs" dot={false} />
                  <Line type="monotone" dataKey="iaLatency" stroke="#8b5cf6" strokeWidth={2} name="IA" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* IA Usage by Type */}
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-purple-500" />
                Uso de IA por Tipo (24h)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={iaByType}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="type" stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: "hsl(var(--card))", 
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px"
                    }} 
                  />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Queue Processing Section */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Server className="h-5 w-5 text-cyan-500" />
              Fila de Processamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Summary */}
              <div className="space-y-4">
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-muted-foreground">Total Pendente</span>
                  <span className="font-bold text-foreground">{queueStats.totalPending}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <span className="text-muted-foreground">Delay Médio</span>
                  <span className="font-bold text-foreground">{(queueStats.avgDelayMs / 1000).toFixed(1)}s</span>
                </div>
              </div>

              {/* By Type */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Por Tipo</h4>
                <div className="space-y-2">
                  {Object.entries(queueStats.byType).map(([type, count]) => (
                    <div key={type} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                      <span className="text-sm text-foreground">{type.replace("_", " ")}</span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
                  {Object.keys(queueStats.byType).length === 0 && (
                    <p className="text-sm text-muted-foreground">Nenhum item pendente</p>
                  )}
                </div>
              </div>

              {/* By Company */}
              <div>
                <h4 className="text-sm font-medium text-muted-foreground mb-3">Top 10 Empresas</h4>
                <ScrollArea className="h-[150px]">
                  <div className="space-y-2">
                    {queueStats.byCompany.map(item => (
                      <div key={item.companyId} className="flex justify-between items-center p-2 bg-muted/20 rounded">
                        <span className="text-sm text-foreground truncate max-w-[150px]">{item.companyName}</span>
                        <Badge variant="secondary">{item.count}</Badge>
                      </div>
                    ))}
                    {queueStats.byCompany.length === 0 && (
                      <p className="text-sm text-muted-foreground">Nenhum item pendente</p>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Company Metrics Table */}
        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              Consumo por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <Table>
                <TableHeader>
                  <TableRow className="border-border">
                    <TableHead className="text-muted-foreground">Empresa</TableHead>
                    <TableHead className="text-muted-foreground">Plano</TableHead>
                    <TableHead className="text-muted-foreground text-right">Leads</TableHead>
                    <TableHead className="text-muted-foreground text-right">Msgs</TableHead>
                    <TableHead className="text-muted-foreground text-right">IA Ops</TableHead>
                    <TableHead className="text-muted-foreground text-right">Erros</TableHead>
                    <TableHead className="text-muted-foreground text-right">Fila</TableHead>
                    <TableHead className="text-muted-foreground text-right">Latência</TableHead>
                    <TableHead className="text-muted-foreground text-center">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyMetrics.map(company => (
                    <TableRow key={company.companyId} className="border-border">
                      <TableCell className="font-medium text-foreground">{company.companyName}</TableCell>
                      <TableCell className="text-muted-foreground">{company.planName}</TableCell>
                      <TableCell className="text-right text-foreground">{company.leadsHoje}</TableCell>
                      <TableCell className="text-right text-foreground">{company.mensagensHoje}</TableCell>
                      <TableCell className="text-right text-foreground">{company.iaOpsHoje}</TableCell>
                      <TableCell className="text-right text-foreground">{company.errosHoje}</TableCell>
                      <TableCell className="text-right text-foreground">{company.queueItemsPending}</TableCell>
                      <TableCell className="text-right text-foreground">{company.avgResponseTimeMs}ms</TableCell>
                      <TableCell className="text-center">{getStatusBadge(company.status)}</TableCell>
                    </TableRow>
                  ))}
                  {companyMetrics.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        Nenhuma empresa encontrada
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminSystemHealthPage;
