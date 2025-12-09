import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, UserCheck, UserX, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import CreateSellerModal from "@/components/seller/CreateSellerModal";
import EditSellerModal from "@/components/seller/EditSellerModal";
import AppLayout from "@/components/layout/AppLayout";

interface Seller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

const SellersPage = () => {
  const { user } = useAuth();
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  const fetchSellers = async () => {
    if (!user?.id) return;

    try {
      // Get all sellers from company - using the manager RLS policy
      // which allows managers to view all profiles in their company
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, user_id, name, email, created_at, company_id");

      if (profilesError) {
        console.error("Error fetching profiles:", profilesError);
        throw profilesError;
      }

      console.log("Profiles fetched:", profiles);

      if (!profiles || profiles.length === 0) {
        setSellers([]);
        return;
      }

      // Get manager's company from the profiles we can see
      const managerProfile = profiles.find(p => p.user_id === user.id);
      
      if (!managerProfile?.company_id) {
        console.error("Manager profile not found or has no company");
        return;
      }

      // Filter profiles from the same company
      const companyProfiles = profiles.filter(p => p.company_id === managerProfile.company_id);
      const userIds = companyProfiles.map((p) => p.user_id);

      // Get roles for these users
      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", userIds);

      if (rolesError) {
        console.error("Error fetching roles:", rolesError);
      }

      console.log("Roles fetched:", roles);

      // Filter only sellers
      const sellerUserIds = roles?.filter((r) => r.role === "seller").map((r) => r.user_id) || [];
      
      const sellersData: Seller[] = companyProfiles
        .filter((p) => sellerUserIds.includes(p.user_id))
        .map((p) => ({
          id: p.id,
          user_id: p.user_id,
          name: p.name,
          email: p.email,
          created_at: p.created_at,
          is_active: true,
        }));

      console.log("Sellers data:", sellersData);
      setSellers(sellersData);
    } catch (error) {
      console.error("Error fetching sellers:", error);
      toast.error("Erro ao carregar vendedores");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSellers();
  }, [user?.id]);

  const handleEdit = (seller: Seller) => {
    setSelectedSeller(seller);
    setIsEditModalOpen(true);
  };

  const handleToggleStatus = async (seller: Seller) => {
    setTogglingStatus(seller.id);
    try {
      // For now, we'll just toggle the local state
      // In a real implementation, you'd call an edge function to disable the user in Auth
      setSellers((prev) =>
        prev.map((s) =>
          s.id === seller.id ? { ...s, is_active: !s.is_active } : s
        )
      );
      toast.success(
        seller.is_active
          ? "Vendedor desativado com sucesso"
          : "Vendedor ativado com sucesso"
      );
    } catch (error) {
      console.error("Error toggling status:", error);
      toast.error("Erro ao alterar status");
    } finally {
      setTogglingStatus(null);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Vendedores</h1>
            <p className="text-muted-foreground">
              Gerencie os vendedores da sua equipe
            </p>
          </div>
          <Button onClick={() => setIsCreateModalOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Cadastrar Vendedor
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data de Criação</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      <span className="text-muted-foreground">Carregando...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : sellers.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    <p className="text-muted-foreground">
                      Nenhum vendedor cadastrado
                    </p>
                  </TableCell>
                </TableRow>
              ) : (
                sellers.map((seller) => (
                  <TableRow key={seller.id}>
                    <TableCell className="font-medium">{seller.name}</TableCell>
                    <TableCell>{seller.email}</TableCell>
                    <TableCell>
                      <Badge
                        variant={seller.is_active ? "default" : "secondary"}
                        className={
                          seller.is_active
                            ? "bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {seller.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {format(new Date(seller.created_at), "dd/MM/yyyy", {
                        locale: ptBR,
                      })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(seller)}
                          className="h-8 w-8 p-0"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(seller)}
                          disabled={togglingStatus === seller.id}
                          className={`h-8 w-8 p-0 ${
                            seller.is_active
                              ? "text-destructive hover:text-destructive"
                              : "text-emerald-600 hover:text-emerald-700"
                          }`}
                        >
                          {togglingStatus === seller.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : seller.is_active ? (
                            <UserX className="h-4 w-4" />
                          ) : (
                            <UserCheck className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      <CreateSellerModal
        open={isCreateModalOpen}
        onOpenChange={setIsCreateModalOpen}
        onSuccess={fetchSellers}
      />

      {selectedSeller && (
        <EditSellerModal
          open={isEditModalOpen}
          onOpenChange={setIsEditModalOpen}
          seller={selectedSeller}
          onSuccess={fetchSellers}
        />
      )}
    </AppLayout>
  );
};

export default SellersPage;
