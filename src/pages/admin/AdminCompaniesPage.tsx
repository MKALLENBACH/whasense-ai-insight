import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Building2,
  Plus,
  Search,
  Eye,
  Edit,
  Loader2,
  Users,
  UserCog,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface Company {
  id: string;
  name: string;
  segment: string | null;
  created_at: string;
  managerName?: string;
  managerEmail?: string;
  sellerCount: number;
  customerCount: number;
}

const AdminCompaniesPage = () => {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Form state
  const [companyName, setCompanyName] = useState("");
  const [companySegment, setCompanySegment] = useState("");
  const [managerName, setManagerName] = useState("");
  const [managerEmail, setManagerEmail] = useState("");
  const [managerPassword, setManagerPassword] = useState("");

  useEffect(() => {
    fetchCompanies();
  }, []);

  const fetchCompanies = async () => {
    try {
      // Fetch companies
      const { data: companiesData, error: companiesError } = await supabase
        .from("companies")
        .select("*")
        .order("created_at", { ascending: false });

      if (companiesError) throw companiesError;

      // Fetch profiles with roles
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("user_id, name, email, company_id");

      if (profilesError) throw profilesError;

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role");

      if (rolesError) throw rolesError;

      // Fetch customers
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("id, company_id");

      if (customersError) throw customersError;

      // Combine data
      const enrichedCompanies = (companiesData || []).map((company) => {
        const companyProfiles = profiles?.filter((p) => p.company_id === company.id) || [];
        const managerProfile = companyProfiles.find((p) => {
          const role = roles?.find((r) => r.user_id === p.user_id);
          return role?.role === "manager";
        });
        const sellerCount = companyProfiles.filter((p) => {
          const role = roles?.find((r) => r.user_id === p.user_id);
          return role?.role === "seller";
        }).length;
        const customerCount = customers?.filter((c) => c.company_id === company.id).length || 0;

        return {
          ...company,
          managerName: managerProfile?.name,
          managerEmail: managerProfile?.email,
          sellerCount,
          customerCount,
        };
      });

      setCompanies(enrichedCompanies);
    } catch (error) {
      console.error("Error fetching companies:", error);
      toast.error("Erro ao carregar empresas");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateCompany = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!companyName || !managerName || !managerEmail || !managerPassword) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    if (managerPassword.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsCreating(true);

    try {
      // Use edge function for admin operations (bypasses RLS)
      const { data, error } = await supabase.functions.invoke("admin-operations", {
        body: {
          action: "create_company_with_manager",
          companyName,
          companySegment,
          managerName,
          managerEmail,
          managerPassword,
        },
      });

      if (error) {
        console.error("Edge function error:", error);
        throw new Error(error.message || "Erro ao criar empresa");
      }

      if (data?.error) {
        throw new Error(data.error);
      }

      toast.success("Empresa criada com sucesso!");
      setIsCreateModalOpen(false);
      resetForm();
      fetchCompanies();
    } catch (error: any) {
      console.error("Error creating company:", error);
      if (error.message?.includes("already registered") || error.message?.includes("already been registered")) {
        toast.error("Este email já está cadastrado");
      } else {
        toast.error(error.message || "Erro ao criar empresa");
      }
    } finally {
      setIsCreating(false);
    }
  };

  const resetForm = () => {
    setCompanyName("");
    setCompanySegment("");
    setManagerName("");
    setManagerEmail("");
    setManagerPassword("");
  };

  const filteredCompanies = companies.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.managerName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.managerEmail?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Empresas</h1>
            <p className="text-slate-400">Gerencie as empresas cadastradas na plataforma</p>
          </div>

          <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
            <DialogTrigger asChild>
              <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Criar Empresa
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
              <DialogHeader>
                <DialogTitle>Criar Nova Empresa</DialogTitle>
                <DialogDescription className="text-slate-400">
                  Cadastre uma nova empresa e seu gestor principal
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleCreateCompany} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Nome da Empresa *</Label>
                  <Input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="Ex: Exercit Esportes"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Segmento</Label>
                  <Input
                    value={companySegment}
                    onChange={(e) => setCompanySegment(e.target.value)}
                    placeholder="Ex: E-commerce, Varejo"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>

                <div className="border-t border-slate-700 pt-4">
                  <p className="text-sm font-medium text-slate-300 mb-3">Gestor Principal</p>

                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-slate-300">Nome do Gestor *</Label>
                      <Input
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        placeholder="Nome completo"
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Email do Gestor *</Label>
                      <Input
                        type="email"
                        value={managerEmail}
                        onChange={(e) => setManagerEmail(e.target.value)}
                        placeholder="email@empresa.com"
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-slate-300">Senha *</Label>
                      <Input
                        type="password"
                        value={managerPassword}
                        onChange={(e) => setManagerPassword(e.target.value)}
                        placeholder="Mínimo 6 caracteres"
                        className="bg-slate-900/50 border-slate-700 text-white"
                      />
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setIsCreateModalOpen(false)}
                    className="text-slate-400 hover:text-white"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isCreating}
                    className="bg-orange-500 hover:bg-orange-600"
                  >
                    {isCreating ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Criando...
                      </>
                    ) : (
                      "Criar Empresa"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            placeholder="Buscar por empresa, gestor ou email..."
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
            ) : filteredCompanies.length === 0 ? (
              <div className="text-center py-12">
                <Building2 className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nenhuma empresa encontrada</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Empresa</TableHead>
                    <TableHead className="text-slate-400">Gestor</TableHead>
                    <TableHead className="text-slate-400 text-center">Vendedores</TableHead>
                    <TableHead className="text-slate-400 text-center">Leads</TableHead>
                    <TableHead className="text-slate-400">Criada em</TableHead>
                    <TableHead className="text-slate-400 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCompanies.map((company) => (
                    <TableRow key={company.id} className="border-slate-700">
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                            <Building2 className="h-4 w-4 text-orange-500" />
                          </div>
                          <div>
                            <p className="font-medium text-white">{company.name}</p>
                            {company.segment && (
                              <Badge variant="secondary" className="text-xs bg-slate-700 text-slate-300">
                                {company.segment}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {company.managerName ? (
                          <div>
                            <p className="text-white">{company.managerName}</p>
                            <p className="text-sm text-slate-400">{company.managerEmail}</p>
                          </div>
                        ) : (
                          <span className="text-slate-500">Sem gestor</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Users className="h-4 w-4 text-slate-500" />
                          <span className="text-white">{company.sellerCount}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-white">
                        {company.customerCount}
                      </TableCell>
                      <TableCell className="text-slate-400">
                        {format(new Date(company.created_at), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link to={`/admin/empresa/${company.id}`}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-slate-400 hover:text-white"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </Link>
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

export default AdminCompaniesPage;
