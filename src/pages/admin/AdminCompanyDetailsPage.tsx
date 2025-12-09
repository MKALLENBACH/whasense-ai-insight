import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import CompanyPlanSection from "@/components/admin/CompanyPlanSection";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  ArrowLeft,
  Users,
  UserCog,
  MessageSquare,
  TrendingUp,
  Loader2,
  Mail,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface CompanyDetails {
  id: string;
  name: string;
  segment: string | null;
  plan_id: string | null;
  created_at: string;
}

interface CompanyUser {
  id: string;
  name: string;
  email: string;
  role: string;
  created_at: string;
}

interface CompanyStats {
  totalSellers: number;
  totalCustomers: number;
  totalMessages: number;
  totalCycles: number;
  wonCycles: number;
  lostCycles: number;
}

const AdminCompanyDetailsPage = () => {
  const { id } = useParams<{ id: string }>();
  const [company, setCompany] = useState<CompanyDetails | null>(null);
  const [manager, setManager] = useState<CompanyUser | null>(null);
  const [sellers, setSellers] = useState<CompanyUser[]>([]);
  const [stats, setStats] = useState<CompanyStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (id) {
      fetchCompanyDetails(id);
    }
  }, [id]);

  const fetchCompanyDetails = async (companyId: string) => {
    try {
      // Fetch company
      const { data: companyData, error: companyError } = await supabase
        .from("companies")
        .select("*")
        .eq("id", companyId)
        .single();

      if (companyError) throw companyError;
      setCompany(companyData);

      // Fetch profiles for this company
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, email, created_at")
        .eq("company_id", companyId);

      if (profilesError) throw profilesError;

      // Fetch roles
      const userIds = profiles?.map((p) => p.user_id) || [];
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) throw rolesError;

      // Separate manager and sellers
      const usersWithRoles = (profiles || []).map((p) => ({
        id: p.user_id,
        name: p.name,
        email: p.email,
        role: roles?.find((r) => r.user_id === p.user_id)?.role || "seller",
        created_at: p.created_at,
      }));

      const managerUser = usersWithRoles.find((u) => u.role === "manager");
      const sellerUsers = usersWithRoles.filter((u) => u.role === "seller");

      setManager(managerUser || null);
      setSellers(sellerUsers);

      // Fetch stats
      const sellerIds = sellerUsers.map((s) => s.id);

      // Customers
      const { data: customers } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", companyId);

      // Messages
      const { count: messagesCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .in("seller_id", sellerIds.length > 0 ? sellerIds : ["00000000-0000-0000-0000-000000000000"]);

      // Cycles
      const { data: cycles } = await supabase
        .from("sale_cycles")
        .select("status")
        .in("seller_id", sellerIds.length > 0 ? sellerIds : ["00000000-0000-0000-0000-000000000000"]);

      setStats({
        totalSellers: sellerUsers.length,
        totalCustomers: customers?.length || 0,
        totalMessages: messagesCount || 0,
        totalCycles: cycles?.length || 0,
        wonCycles: cycles?.filter((c) => c.status === "won").length || 0,
        lostCycles: cycles?.filter((c) => c.status === "lost").length || 0,
      });
    } catch (error) {
      console.error("Error fetching company details:", error);
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

  if (!company) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
          <p className="text-slate-400">Empresa não encontrada</p>
          <Link to="/admin/empresas">
            <Button variant="ghost" className="mt-4 text-orange-500">
              Voltar para empresas
            </Button>
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const conversionRate = stats?.totalCycles
    ? ((stats.wonCycles / stats.totalCycles) * 100).toFixed(1)
    : "0";

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link to="/admin/empresas">
            <Button variant="ghost" size="icon" className="text-slate-400 hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-white">{company.name}</h1>
            <p className="text-slate-400">
              Criada em {format(new Date(company.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <Users className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.totalSellers || 0}</p>
                  <p className="text-xs text-slate-400">Vendedores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-500/10">
                  <TrendingUp className="h-5 w-5 text-orange-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.totalCustomers || 0}</p>
                  <p className="text-xs text-slate-400">Leads</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-cyan-500/10">
                  <MessageSquare className="h-5 w-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{stats?.totalMessages || 0}</p>
                  <p className="text-xs text-slate-400">Mensagens</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-emerald-500/10">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-white">{conversionRate}%</p>
                  <p className="text-xs text-slate-400">Conversão</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Manager card */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <UserCog className="h-5 w-5 text-orange-500" />
              Gestor Principal
            </CardTitle>
          </CardHeader>
          <CardContent>
            {manager ? (
              <div className="flex items-center gap-4 p-4 bg-slate-700/50 rounded-lg">
                <div className="h-12 w-12 rounded-full bg-orange-500/20 flex items-center justify-center">
                  <UserCog className="h-6 w-6 text-orange-500" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-white">{manager.name}</p>
                  <p className="text-sm text-slate-400 flex items-center gap-1">
                    <Mail className="h-3 w-3" />
                    {manager.email}
                  </p>
                </div>
                <div className="text-right text-sm text-slate-400">
                  <p className="flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Desde {format(new Date(manager.created_at), "MMM yyyy", { locale: ptBR })}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-slate-500 text-center py-4">Nenhum gestor cadastrado</p>
            )}
          </CardContent>
        </Card>

        {/* Plan Section */}
        <CompanyPlanSection
          companyId={company.id}
          currentPlanId={company.plan_id}
          onPlanUpdated={() => fetchCompanyDetails(company.id)}
        />

        {/* Sellers table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-500" />
              Vendedores ({sellers.length})
            </CardTitle>
            <CardDescription className="text-slate-400">
              Equipe de vendas da empresa
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sellers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="h-10 w-10 text-slate-600 mx-auto mb-2" />
                <p className="text-slate-500">Nenhum vendedor cadastrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Nome</TableHead>
                    <TableHead className="text-slate-400">Email</TableHead>
                    <TableHead className="text-slate-400">Cadastrado em</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sellers.map((seller) => (
                    <TableRow key={seller.id} className="border-slate-700">
                      <TableCell className="text-white font-medium">{seller.name}</TableCell>
                      <TableCell className="text-slate-400">{seller.email}</TableCell>
                      <TableCell className="text-slate-400">
                        {format(new Date(seller.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminCompanyDetailsPage;
