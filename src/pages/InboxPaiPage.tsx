import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Inbox, 
  Loader2, 
  RefreshCw, 
  Search,
  ChevronLeft,
  ChevronRight,
  Users,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LeadDistributionDashboard } from "@/components/dashboard/LeadDistributionDashboard";
import InboxPaiCard from "@/components/conversation/InboxPaiCard";

interface InboxPaiLead {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email?: string | null;
  };
  lastMessage: string;
  lastMessageAt: string;
  lastMessageTime: string;
  messageCount: number;
  waitingTime: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface LeadLimitInfo {
  currentLeads: number;
  maxLeads: number;
  hasLimit: boolean;
  hasReachedLimit: boolean;
}

const ITEMS_PER_PAGE = 5;

const InboxPaiPage = () => {
  const { session, isManager, user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxLeads, setInboxLeads] = useState<InboxPaiLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const [hasActiveSellers, setHasActiveSellers] = useState(false);
  const [leadLimitInfo, setLeadLimitInfo] = useState<LeadLimitInfo>({
    currentLeads: 0,
    maxLeads: 0,
    hasLimit: false,
    hasReachedLimit: false,
  });
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Check if company has active sellers and fetch lead limit info
  useEffect(() => {
    const fetchSellerInfo = async () => {
      if (!user?.companyId || !user?.id) return;
      
      // First get seller user_ids
      const { data: sellerRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "seller");
      
      if (!sellerRoles || sellerRoles.length === 0) {
        setHasActiveSellers(false);
        return;
      }
      
      const sellerUserIds = sellerRoles.map(r => r.user_id);
      
      // Count active sellers in company
      const { count: sellersCount } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", user.companyId)
        .eq("is_active", true)
        .in("user_id", sellerUserIds);
      
      setHasActiveSellers((sellersCount ?? 0) > 0);
      
      // Only fetch lead limit for sellers
      if (isManager) return;
      
      // Get operation settings for max leads limit
      const { data: settings } = await supabase
        .from("manager_operation_settings")
        .select("max_active_leads_per_seller")
        .eq("company_id", user.companyId)
        .maybeSingle();
      
      const maxLeads = settings?.max_active_leads_per_seller || 0;
      
      if (maxLeads > 0) {
        // Count current active leads for this seller using sale_cycles (RLS allows sellers to see their cycles)
        const { count: currentLeads } = await supabase
          .from("sale_cycles")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", user.id)
          .in("status", ["pending", "in_progress"]);
        
        setLeadLimitInfo({
          currentLeads: currentLeads || 0,
          maxLeads,
          hasLimit: true,
          hasReachedLimit: (currentLeads || 0) >= maxLeads,
        });
      } else {
        setLeadLimitInfo({
          currentLeads: 0,
          maxLeads: 0,
          hasLimit: false,
          hasReachedLimit: false,
        });
      }
    };
    
    fetchSellerInfo();
  }, [user?.companyId, user?.id, isManager]);

  const fetchInboxPai = useCallback(async (page = 1) => {
    if (!session?.access_token) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-inbox-pai?page=${page}&limit=${ITEMS_PER_PAGE}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch');
      }

      const result = await response.json();
      setInboxLeads(result?.leads || []);
      setPagination(result?.pagination || {
        page: 1,
        limit: ITEMS_PER_PAGE,
        total: 0,
        totalPages: 0,
        hasMore: false,
      });
    } catch (error) {
      console.error('Error fetching inbox pai:', error);
      toast.error('Erro ao carregar Inbox Pai');
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  // Refresh lead limit info
  const refreshLeadLimitInfo = useCallback(async () => {
    if (isManager || !user?.companyId || !user?.id) return;
    
    const { data: settings } = await supabase
      .from("manager_operation_settings")
      .select("max_active_leads_per_seller")
      .eq("company_id", user.companyId)
      .maybeSingle();
    
    const maxLeads = settings?.max_active_leads_per_seller || 0;
    
    if (maxLeads > 0) {
      // Count current active leads using sale_cycles (RLS allows sellers to see their cycles)
      const { count: currentLeads } = await supabase
        .from("sale_cycles")
        .select("id", { count: "exact", head: true })
        .eq("seller_id", user.id)
        .in("status", ["pending", "in_progress"]);
      
      setLeadLimitInfo({
        currentLeads: currentLeads || 0,
        maxLeads,
        hasLimit: true,
        hasReachedLimit: (currentLeads || 0) >= maxLeads,
      });
    }
  }, [isManager, user?.companyId, user?.id]);

  useEffect(() => {
    fetchInboxPai(1);
  }, [fetchInboxPai]);

  // Realtime subscription for new leads, assignments, and cycle closures
  useEffect(() => {
    const customersChannel = supabase
      .channel('inbox-pai-customers')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            fetchInboxPai(pagination.page);
          } else if (payload.eventType === 'UPDATE') {
            const newRecord = payload.new as { assigned_to: string | null; lead_status: string };
            const oldRecord = payload.old as { assigned_to: string | null; lead_status: string };
            
            // Refresh on assignment changes or lead_status changes (cycle closures)
            if (newRecord.assigned_to !== oldRecord.assigned_to || 
                newRecord.lead_status !== oldRecord.lead_status) {
              fetchInboxPai(pagination.page);
              refreshLeadLimitInfo();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(customersChannel);
    };
  }, [fetchInboxPai, pagination.page, refreshLeadLimitInfo]);

  const handlePullLead = async (customerId: string) => {
    if (!session?.access_token) return;
    
    setIsPulling(customerId);
    try {
      const { data, error } = await supabase.functions.invoke('pull-lead', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { customer_id: customerId },
      });

      if (error) throw error;
      
      toast.success('Lead atribuído com sucesso!');
      
      // Refresh lead limit info
      await refreshLeadLimitInfo();
      
      // Navigate to the chat
      navigate(`/chat/${customerId}`);
    } catch (error: any) {
      console.error('Error pulling lead:', error);
      
      // Better error messages
      const errorMessage = error.message || 'Erro ao puxar lead';
      if (errorMessage.includes('maximum') || errorMessage.includes('limite')) {
        toast.error('Você atingiu o limite de leads ativos. Finalize alguns leads antes de puxar novos.');
        refreshLeadLimitInfo();
      } else {
        toast.error(errorMessage);
      }
      
      fetchInboxPai(pagination.page);
    } finally {
      setIsPulling(null);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages) {
      fetchInboxPai(newPage);
    }
  };

  const filteredLeads = inboxLeads.filter(lead => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.customer.name.toLowerCase().includes(query) ||
      lead.customer.phone?.toLowerCase().includes(query) ||
      lead.lastMessage.toLowerCase().includes(query)
    );
  });

  // Determine if seller can pull leads
  const canPullLeads = !isManager && hasActiveSellers && !leadLimitInfo.hasReachedLimit;

  return (
    <AppLayout>
      <div className="space-y-6 pb-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Inbox className="h-7 w-7 text-primary" />
              Inbox Pai
            </h1>
            <p className="text-muted-foreground">
              {isManager 
                ? "Leads aguardando atribuição • Acompanhe a distribuição da equipe"
                : "Leads aguardando atribuição • Puxe para começar a atender"
              }
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => fetchInboxPai(pagination.page)} 
            disabled={isLoading}
          >
            <RefreshCw className={cn("h-4 w-4 mr-2", isLoading && "animate-spin")} />
            Atualizar
          </Button>
        </div>

        {/* Dashboard - Only for managers */}
        {isManager && <LeadDistributionDashboard />}

        {/* Lead Limit Warning - Only for sellers with limit */}
        {!isManager && leadLimitInfo.hasLimit && (
          <Card className={cn(
            "border",
            leadLimitInfo.hasReachedLimit 
              ? "border-destructive/50 bg-destructive/5" 
              : "border-primary/30 bg-primary/5"
          )}>
            <CardContent className="py-3 px-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Users className={cn(
                    "h-5 w-5",
                    leadLimitInfo.hasReachedLimit ? "text-destructive" : "text-primary"
                  )} />
                  <span className="font-medium">Seus leads ativos:</span>
                  <Badge variant={leadLimitInfo.hasReachedLimit ? "destructive" : "secondary"}>
                    {leadLimitInfo.currentLeads} / {leadLimitInfo.maxLeads}
                  </Badge>
                </div>
                {leadLimitInfo.hasReachedLimit && (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    <span>Limite atingido. Finalize leads para puxar novos.</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lead List */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-medium">
                Leads Aguardando
                <Badge variant="secondary" className="ml-2">
                  {pagination.total}
                </Badge>
              </CardTitle>
              
              {/* Pagination Info */}
              {pagination.totalPages > 1 && (
                <div className="text-sm text-muted-foreground">
                  Página {pagination.page} de {pagination.totalPages}
                </div>
              )}
            </div>
            {/* Search */}
            <div className="relative mt-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : filteredLeads.length > 0 ? (
              <>
                <div className="divide-y divide-border">
                  {filteredLeads.map((lead) => (
                    <InboxPaiCard
                      key={lead.id}
                      lead={lead}
                      onPullLead={handlePullLead}
                      isPulling={isPulling !== null}
                      canPull={canPullLeads}
                    />
                  ))}
                </div>
                
                {/* Pagination Controls */}
                {pagination.totalPages > 1 && (
                  <div className="flex items-center justify-between p-4 border-t border-border">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {((pagination.page - 1) * pagination.limit) + 1} - {Math.min(pagination.page * pagination.limit, pagination.total)} de {pagination.total} leads
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page - 1)}
                        disabled={pagination.page <= 1 || isLoading}
                      >
                        <ChevronLeft className="h-4 w-4 mr-1" />
                        Anterior
                      </Button>
                      
                      {/* Page Numbers */}
                      <div className="flex items-center gap-1">
                        {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                          let pageNum: number;
                          if (pagination.totalPages <= 5) {
                            pageNum = i + 1;
                          } else if (pagination.page <= 3) {
                            pageNum = i + 1;
                          } else if (pagination.page >= pagination.totalPages - 2) {
                            pageNum = pagination.totalPages - 4 + i;
                          } else {
                            pageNum = pagination.page - 2 + i;
                          }
                          
                          return (
                            <Button
                              key={pageNum}
                              variant={pagination.page === pageNum ? "default" : "outline"}
                              size="sm"
                              className="w-9 px-0"
                              onClick={() => handlePageChange(pageNum)}
                              disabled={isLoading}
                            >
                              {pageNum}
                            </Button>
                          );
                        })}
                      </div>
                      
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handlePageChange(pagination.page + 1)}
                        disabled={!pagination.hasMore || isLoading}
                      >
                        Próxima
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="flex items-center justify-center h-64">
                <div className="text-center text-muted-foreground">
                  <Inbox className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p className="font-medium">Inbox Pai vazio</p>
                  <p className="text-sm mt-1">
                    Novos leads aparecerão aqui automaticamente
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default InboxPaiPage;
