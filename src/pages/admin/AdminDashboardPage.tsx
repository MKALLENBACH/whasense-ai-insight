import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Building2,
  Users,
  UserCog,
  MessageSquare,
  TrendingUp,
  AlertTriangle,
  Activity,
  Loader2,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface DashboardStats {
  totalCompanies: number;
  activeCompanies: number;
  totalManagers: number;
  totalSellers: number;
  totalCustomers: number;
  totalMessages: number;
  totalCycles: number;
  wonCycles: number;
  lostCycles: number;
  inactiveCompanies: number;
}

interface RecentCompany {
  id: string;
  name: string;
  created_at: string;
  sellerCount: number;
  is_active: boolean;
}

const AdminDashboardPage = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentCompanies, setRecentCompanies] = useState<RecentCompany[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch companies
      const { data: companies, error: companiesError } = await supabase
        .from("companies")
        .select("*");

      if (companiesError) throw companiesError;

      // Fetch user roles with profiles
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role, user_id");

      if (rolesError) throw rolesError;

      // Fetch profiles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, company_id");

      if (profilesError) throw profilesError;

      // Fetch customers
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("id, company_id");

      if (customersError) throw customersError;

      // Fetch messages count
      const { count: messagesCount, error: messagesError } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true });

      if (messagesError) throw messagesError;

      // Fetch sale cycles
      const { data: cycles, error: cyclesError } = await supabase
        .from("sale_cycles")
        .select("status");

      if (cyclesError) throw cyclesError;

      // Calculate stats
      const managers = userRoles?.filter((r) => r.role === "manager") || [];
      const sellers = userRoles?.filter((r) => r.role === "seller") || [];

      // Count active/inactive companies based on is_active field
      const activeCompanies = companies?.filter((c) => c.is_active) || [];
      const inactiveCompanies = companies?.filter((c) => !c.is_active) || [];

      // Calculate recent companies with seller counts
      const companiesWithCounts = (companies || []).map((c) => ({
        ...c,
        sellerCount: profiles?.filter((p) => p.company_id === c.id).length || 0,
      }));

      setStats({
        totalCompanies: companies?.length || 0,
        activeCompanies: activeCompanies.length,
        totalManagers: managers.length,
        totalSellers: sellers.length,
        totalCustomers: customers?.length || 0,
        totalMessages: messagesCount || 0,
        totalCycles: cycles?.length || 0,
        wonCycles: cycles?.filter((c) => c.status === "won").length || 0,
        lostCycles: cycles?.filter((c) => c.status === "lost").length || 0,
        inactiveCompanies: inactiveCompanies.length,
      });

      setRecentCompanies(
        companiesWithCounts
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .slice(0, 5)
      );
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
        </div>
      </AdminLayout>
    );
  }

  const kpis = [
    {
      label: "Empresas Ativas",
      value: stats?.activeCompanies || 0,
      icon: Building2,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      label: "Total de Gestores",
      value: stats?.totalManagers || 0,
      icon: UserCog,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
    {
      label: "Total de Vendedores",
      value: stats?.totalSellers || 0,
      icon: Users,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
    },
    {
      label: "Total de Leads",
      value: stats?.totalCustomers || 0,
      icon: TrendingUp,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
    },
    {
      label: "Mensagens Trocadas",
      value: stats?.totalMessages || 0,
      icon: MessageSquare,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
    },
    {
      label: "Ciclos de Venda",
      value: stats?.totalCycles || 0,
      icon: Activity,
      color: "text-pink-500",
      bgColor: "bg-pink-500/10",
    },
  ];

  const conversionRate = stats?.totalCycles
    ? ((stats.wonCycles / stats.totalCycles) * 100).toFixed(1)
    : "0";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard Administrativo</h1>
          <p className="text-slate-400">Visão geral da plataforma Whasense</p>
        </div>

        {/* KPI Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {kpis.map((kpi) => (
            <Card key={kpi.label} className="bg-slate-800 border-slate-700">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`p-2.5 rounded-lg ${kpi.bgColor}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">{kpi.value.toLocaleString()}</p>
                    <p className="text-xs text-slate-400">{kpi.label}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Secondary stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Taxa de Conversão</p>
                  <p className="text-3xl font-bold text-emerald-500">{conversionRate}%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-500/30" />
              </div>
              <div className="mt-3 flex gap-4 text-sm">
                <span className="text-emerald-500">{stats?.wonCycles} ganhos</span>
                <span className="text-red-500">{stats?.lostCycles} perdidos</span>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Empresas Desativadas</p>
                  <p className="text-3xl font-bold text-red-500">{stats?.inactiveCompanies || 0}</p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500/30" />
              </div>
              <p className="mt-3 text-sm text-slate-500">Usuários não conseguem acessar</p>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-400">Total de Empresas</p>
                  <p className="text-3xl font-bold text-white">{stats?.totalCompanies || 0}</p>
                </div>
                <Building2 className="h-8 w-8 text-slate-600" />
              </div>
              <p className="mt-3 text-sm text-slate-500">Cadastradas na plataforma</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent companies */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white">Últimas Empresas Cadastradas</CardTitle>
            <CardDescription className="text-slate-400">
              Empresas mais recentes na plataforma
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentCompanies.length === 0 ? (
                <p className="text-slate-500 text-center py-4">Nenhuma empresa cadastrada</p>
              ) : (
                recentCompanies.map((company) => (
                  <div
                    key={company.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${company.is_active ? 'bg-slate-700/50' : 'bg-red-900/20 border border-red-800/30'}`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${company.is_active ? 'bg-orange-500/10' : 'bg-red-500/10'}`}>
                        <Building2 className={`h-5 w-5 ${company.is_active ? 'text-orange-500' : 'text-red-500'}`} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{company.name}</p>
                          {!company.is_active && (
                            <Badge variant="destructive" className="text-xs">Inativa</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-400">
                          {company.sellerCount} vendedor{company.sellerCount !== 1 ? "es" : ""}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm text-slate-500">
                      {format(new Date(company.created_at), "dd MMM yyyy", { locale: ptBR })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
