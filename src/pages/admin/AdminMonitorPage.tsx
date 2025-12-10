import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Activity, AlertTriangle, Server, Zap, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface CompanyStats {
  company_id: string;
  company_name: string;
  pending_queue: number;
  processing_queue: number;
  failed_queue: number;
  is_throttled: boolean;
  priority_level: string;
  max_ai_ops_per_minute: number;
  messages_today: number;
  ai_ops_today: number;
}

const AdminMonitorPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState<CompanyStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/admin/login");
      return;
    }
    fetchStats();
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, [user]);

  const fetchStats = async () => {
    try {
      // Get all companies
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .eq("is_active", true);

      if (!companies) return;

      const statsPromises = companies.map(async (company) => {
        // Get queue counts
        const { count: pending } = await supabase
          .from("processing_queue")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("status", "pending");

        const { count: processing } = await supabase
          .from("processing_queue")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("status", "processing");

        const { count: failed } = await supabase
          .from("processing_queue")
          .select("id", { count: "exact", head: true })
          .eq("company_id", company.id)
          .eq("status", "failed");

        // Get limits
        const { data: limits } = await supabase
          .from("company_limits")
          .select("*")
          .eq("company_id", company.id)
          .single();

        // Get today's analytics
        const today = new Date().toISOString().split("T")[0];
        const { data: analytics } = await supabase
          .from("analytics_daily_company")
          .select("total_messages, ai_text_analyses, ai_audio_analyses, ai_image_analyses")
          .eq("company_id", company.id)
          .eq("date", today)
          .single();

        return {
          company_id: company.id,
          company_name: company.name,
          pending_queue: pending || 0,
          processing_queue: processing || 0,
          failed_queue: failed || 0,
          is_throttled: limits?.is_throttled || false,
          priority_level: limits?.priority_level || "normal",
          max_ai_ops_per_minute: limits?.max_ai_ops_per_minute || 60,
          messages_today: analytics?.total_messages || 0,
          ai_ops_today: (analytics?.ai_text_analyses || 0) + (analytics?.ai_audio_analyses || 0) + (analytics?.ai_image_analyses || 0),
        };
      });

      const results = await Promise.all(statsPromises);
      setStats(results.sort((a, b) => b.pending_queue - a.pending_queue));
    } catch (error) {
      console.error("Error fetching stats:", error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const triggerQueueProcessor = async () => {
    try {
      setIsRefreshing(true);
      const { error } = await supabase.functions.invoke("queue-processor", {
        body: { batchSize: 50 },
      });
      if (error) throw error;
      toast.success("Processador de fila executado");
      await fetchStats();
    } catch (error) {
      toast.error("Erro ao executar processador");
    } finally {
      setIsRefreshing(false);
    }
  };

  const triggerAggregation = async () => {
    try {
      setIsRefreshing(true);
      const { error } = await supabase.functions.invoke("aggregate-analytics", {
        body: {},
      });
      if (error) throw error;
      toast.success("Agregação executada");
      await fetchStats();
    } catch (error) {
      toast.error("Erro ao executar agregação");
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalPending = stats.reduce((sum, s) => sum + s.pending_queue, 0);
  const totalProcessing = stats.reduce((sum, s) => sum + s.processing_queue, 0);
  const totalFailed = stats.reduce((sum, s) => sum + s.failed_queue, 0);
  const throttledCompanies = stats.filter((s) => s.is_throttled).length;

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <Skeleton className="h-8 w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" />
            Monitor do Sistema
          </h1>
          <div className="flex gap-2">
            <Button variant="outline" onClick={triggerAggregation} disabled={isRefreshing}>
              <Zap className="h-4 w-4 mr-2" />
              Agregar Analytics
            </Button>
            <Button onClick={triggerQueueProcessor} disabled={isRefreshing}>
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Processar Fila
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Pendentes na Fila</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{totalPending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Processando</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-500">{totalProcessing}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Falhas</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-destructive">{totalFailed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Empresas Throttled</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-warning">{throttledCompanies}</p>
            </CardContent>
          </Card>
        </div>

        {/* Company Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              Status por Empresa
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Prioridade</TableHead>
                  <TableHead>Pendentes</TableHead>
                  <TableHead>Processando</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Msgs Hoje</TableHead>
                  <TableHead>IA Ops Hoje</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.map((company) => (
                  <TableRow key={company.company_id}>
                    <TableCell className="font-medium">{company.company_name}</TableCell>
                    <TableCell>
                      <Badge variant={company.priority_level === "enterprise" ? "default" : "secondary"}>
                        {company.priority_level}
                      </Badge>
                    </TableCell>
                    <TableCell>{company.pending_queue}</TableCell>
                    <TableCell>{company.processing_queue}</TableCell>
                    <TableCell className={company.failed_queue > 0 ? "text-destructive font-bold" : ""}>
                      {company.failed_queue}
                    </TableCell>
                    <TableCell>{company.messages_today}</TableCell>
                    <TableCell>{company.ai_ops_today}</TableCell>
                    <TableCell>
                      {company.is_throttled ? (
                        <Badge variant="destructive" className="gap-1">
                          <AlertTriangle className="h-3 w-3" />
                          Throttled
                        </Badge>
                      ) : company.pending_queue > 50 ? (
                        <Badge variant="outline" className="text-warning border-warning">
                          Alta carga
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-success border-success">
                          Normal
                        </Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminMonitorPage;
