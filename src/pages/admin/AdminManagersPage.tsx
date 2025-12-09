import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  UserCog,
  Search,
  Eye,
  Loader2,
  Building2,
  Mail,
  Calendar,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Manager {
  id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
  company_id: string | null;
  company_name: string | null;
}

const AdminManagersPage = () => {
  const [managers, setManagers] = useState<Manager[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchManagers();
  }, []);

  const fetchManagers = async () => {
    try {
      // Get all manager roles
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "manager");

      if (rolesError) throw rolesError;

      if (!roles || roles.length === 0) {
        setManagers([]);
        setIsLoading(false);
        return;
      }

      const userIds = roles.map((r) => r.user_id);

      // Get profiles for these users
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, name, email, created_at, company_id")
        .in("user_id", userIds);

      if (profilesError) throw profilesError;

      // Get companies
      const companyIds = profiles?.filter((p) => p.company_id).map((p) => p.company_id) || [];
      const { data: companies } = await supabase
        .from("companies")
        .select("id, name")
        .in("id", companyIds.length > 0 ? companyIds : ["00000000-0000-0000-0000-000000000000"]);

      // Combine data
      const managersData = (profiles || []).map((p) => ({
        id: p.id,
        user_id: p.user_id,
        name: p.name,
        email: p.email,
        created_at: p.created_at,
        company_id: p.company_id,
        company_name: companies?.find((c) => c.id === p.company_id)?.name || null,
      }));

      setManagers(managersData);
    } catch (error) {
      console.error("Error fetching managers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredManagers = managers.filter(
    (m) =>
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.company_name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white">Gestores</h1>
          <p className="text-slate-400">Todos os gestores cadastrados na plataforma</p>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar por nome, email ou empresa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {/* Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : filteredManagers.length === 0 ? (
              <div className="text-center py-12">
                <UserCog className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nenhum gestor encontrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Gestor</TableHead>
                    <TableHead className="text-slate-400">Empresa</TableHead>
                    <TableHead className="text-slate-400">Cadastrado em</TableHead>
                    <TableHead className="text-slate-400 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredManagers.map((manager) => (
                    <TableRow key={manager.id} className="border-slate-700">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-full bg-orange-500/10 flex items-center justify-center">
                            <UserCog className="h-4 w-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{manager.name}</p>
                            <p className="text-sm text-slate-400 flex items-center gap-1">
                              <Mail className="h-3 w-3" />
                              {manager.email}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {manager.company_name ? (
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-slate-500" />
                            <span className="text-white">{manager.company_name}</span>
                          </div>
                        ) : (
                          <Badge variant="secondary" className="bg-slate-700 text-slate-400">
                            Sem empresa
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(manager.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        {manager.company_id && (
                          <Link to={`/admin/empresa/${manager.company_id}`}>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-white"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Ver empresa
                            </Button>
                          </Link>
                        )}
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

export default AdminManagersPage;
