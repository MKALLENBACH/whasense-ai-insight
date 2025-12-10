import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Loader2, MessageSquare, CheckCircle2, AlertCircle, XCircle, 
  RefreshCw, Users, Phone, Clock, AlertTriangle 
} from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SellerIntegration {
  id: string;
  seller_id: string;
  phone_number_id: string;
  display_phone_number: string | null;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  last_error: string | null;
  last_webhook_at: string | null;
  created_at: string;
  seller_name: string;
  seller_email: string;
}

export default function ManagerWhatsAppStatusPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [integrations, setIntegrations] = useState<SellerIntegration[]>([]);
  const [companyId, setCompanyId] = useState<string | null>(null);

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.company_id) {
        setCompanyId(data.company_id);
      }
    };
    fetchCompanyId();
  }, [user?.id]);

  useEffect(() => {
    if (companyId) {
      fetchIntegrations();
    }
  }, [companyId]);

  const fetchIntegrations = async () => {
    if (!companyId) return;
    
    try {
      // Fetch integrations with seller info
      const { data: integrationsData, error: integrationsError } = await supabase
        .from('whatsapp_seller_integrations')
        .select('id, seller_id, phone_number_id, display_phone_number, status, last_error, last_webhook_at, created_at')
        .eq('company_id', companyId);

      if (integrationsError) throw integrationsError;

      // Fetch all sellers in company
      const { data: sellersData, error: sellersError } = await supabase
        .from('profiles')
        .select('user_id, name, email')
        .eq('company_id', companyId);

      if (sellersError) throw sellersError;

      // Get seller roles
      const { data: rolesData } = await supabase
        .from('user_roles')
        .select('user_id, role')
        .in('user_id', sellersData?.map(s => s.user_id) || []);

      const sellerUserIds = rolesData?.filter(r => r.role === 'seller').map(r => r.user_id) || [];
      const sellers = sellersData?.filter(s => sellerUserIds.includes(s.user_id)) || [];

      // Merge data
      const merged: SellerIntegration[] = sellers.map(seller => {
        const integration = integrationsData?.find(i => i.seller_id === seller.user_id);
        return {
          id: integration?.id || '',
          seller_id: seller.user_id,
          phone_number_id: integration?.phone_number_id || '',
          display_phone_number: integration?.display_phone_number || null,
          status: integration?.status as any || 'disconnected',
          last_error: integration?.last_error || null,
          last_webhook_at: integration?.last_webhook_at || null,
          created_at: integration?.created_at || '',
          seller_name: seller.name,
          seller_email: seller.email,
        };
      });

      setIntegrations(merged);
    } catch (error) {
      console.error('Error fetching integrations:', error);
      toast.error('Erro ao carregar status');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchIntegrations();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pendente</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case 'disconnected':
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Não conectado</Badge>;
      default:
        return <Badge variant="outline">-</Badge>;
    }
  };

  const connectedCount = integrations.filter(i => i.status === 'connected').length;
  const errorCount = integrations.filter(i => i.status === 'error').length;
  const disconnectedCount = integrations.filter(i => i.status === 'disconnected' || !i.id).length;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Status WhatsApp da Equipe</h1>
            <p className="text-muted-foreground">
              Monitore a conexão WhatsApp de cada vendedor
            </p>
          </div>
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{integrations.length}</p>
                  <p className="text-xs text-muted-foreground">Total Vendedores</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-green-600">{connectedCount}</p>
                  <p className="text-xs text-muted-foreground">Conectados</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-red-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-red-600">{errorCount}</p>
                  <p className="text-xs text-muted-foreground">Com Erro</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-muted rounded-lg">
                  <XCircle className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{disconnectedCount}</p>
                  <p className="text-xs text-muted-foreground">Não Conectados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Error Alert */}
        {errorCount > 0 && (
          <Card className="border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-900/50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500" />
                <div>
                  <p className="font-medium text-red-700 dark:text-red-400">
                    {errorCount} vendedor(es) com problema na conexão WhatsApp
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-400/80">
                    Verifique os tokens ou peça para o vendedor reconectar
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Sellers Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Integrações por Vendedor
            </CardTitle>
            <CardDescription>
              Visualize o status da conexão WhatsApp de cada membro da equipe
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Número</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Último Webhook</TableHead>
                  <TableHead>Erro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {integrations.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                      Nenhum vendedor encontrado
                    </TableCell>
                  </TableRow>
                ) : (
                  integrations.map((integration) => (
                    <TableRow key={integration.seller_id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{integration.seller_name}</p>
                          <p className="text-xs text-muted-foreground">{integration.seller_email}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        {integration.display_phone_number ? (
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            {integration.display_phone_number}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{getStatusBadge(integration.status)}</TableCell>
                      <TableCell>
                        {integration.last_webhook_at ? (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="h-4 w-4 text-muted-foreground" />
                            {formatDistanceToNow(new Date(integration.last_webhook_at), { 
                              addSuffix: true, 
                              locale: ptBR 
                            })}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {integration.last_error && integration.status === 'error' ? (
                          <span className="text-xs text-red-500 max-w-[200px] truncate block">
                            {integration.last_error}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
