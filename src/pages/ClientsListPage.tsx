import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
  Users,
  TrendingUp,
  Search,
  Plus,
  ChevronRight,
  Calendar,
  Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import NewClientModal from "@/components/client360/NewClientModal";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
  created_at: string;
  company_id: string;
  buyers_count?: number;
  cycles_count?: number;
  won_count?: number;
}

const ClientsListPage = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [showNewClientModal, setShowNewClientModal] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    try {
      const { data: clientsData, error: clientsError } = await supabase
        .from("clients")
        .select("*")
        .order("created_at", { ascending: false });

      if (clientsError) throw clientsError;

      // Enrich with counts
      const enrichedClients = await Promise.all(
        (clientsData || []).map(async (client) => {
          const [buyersResult, cyclesResult] = await Promise.all([
            supabase
              .from("buyers")
              .select("id", { count: "exact", head: true })
              .eq("client_id", client.id),
            supabase
              .from("sale_cycles")
              .select("id, status", { count: "exact" })
              .eq("client_id", client.id),
          ]);

          const wonCount = cyclesResult.data?.filter(c => c.status === "won").length || 0;

          return {
            ...client,
            buyers_count: buyersResult.count || 0,
            cycles_count: cyclesResult.count || 0,
            won_count: wonCount,
          };
        })
      );

      setClients(enrichedClients);
    } catch (error) {
      console.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(client =>
    client.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    client.cnpj?.includes(searchTerm) ||
    client.segment?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalStats = {
    clients: clients.length,
    buyers: clients.reduce((acc, c) => acc + (c.buyers_count || 0), 0),
    cycles: clients.reduce((acc, c) => acc + (c.cycles_count || 0), 0),
    won: clients.reduce((acc, c) => acc + (c.won_count || 0), 0),
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold">Clientes 360°</h1>
            <p className="text-muted-foreground">Visão completa das empresas clientes</p>
          </div>
          <Button onClick={() => setShowNewClientModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Cliente
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStats.clients}</p>
                  <p className="text-xs text-muted-foreground">Clientes</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStats.buyers}</p>
                  <p className="text-xs text-muted-foreground">Compradores</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStats.cycles}</p>
                  <p className="text-xs text-muted-foreground">Ciclos</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalStats.won}</p>
                  <p className="text-xs text-muted-foreground">Vendas</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, CNPJ ou segmento..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Clients Table */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-6 space-y-4">
                {[1, 2, 3, 4, 5].map(i => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-12 text-center">
                <Building2 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold mb-2">Nenhum cliente encontrado</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {searchTerm ? "Tente ajustar sua busca" : "Comece criando seu primeiro cliente"}
                </p>
                {!searchTerm && (
                  <Button onClick={() => setShowNewClientModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Criar Cliente
                  </Button>
                )}
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Segmento</TableHead>
                    <TableHead className="text-center">Compradores</TableHead>
                    <TableHead className="text-center">Ciclos</TableHead>
                    <TableHead className="text-center">Vendas</TableHead>
                    <TableHead>Criado em</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredClients.map((client) => (
                    <TableRow
                      key={client.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/cliente/${client.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <p className="font-medium">{client.name}</p>
                            {client.cnpj && (
                              <p className="text-xs text-muted-foreground">{client.cnpj}</p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {client.segment ? (
                          <Badge variant="secondary">{client.segment}</Badge>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{client.buyers_count || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{client.cycles_count || 0}</span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default" className="bg-success">
                          {client.won_count || 0}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">
                          {format(new Date(client.created_at), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <NewClientModal
        open={showNewClientModal}
        onOpenChange={setShowNewClientModal}
        onSuccess={fetchClients}
      />
    </AppLayout>
  );
};

export default ClientsListPage;
