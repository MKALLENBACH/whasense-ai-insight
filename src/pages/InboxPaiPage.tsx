import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Inbox, 
  Loader2, 
  RefreshCw, 
  Search,
  ArrowRight,
  Clock,
  Phone,
  MessageSquare,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LeadDistributionDashboard } from "@/components/dashboard/LeadDistributionDashboard";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
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

const ITEMS_PER_PAGE = 5;

const InboxPaiPage = () => {
  const { session, isManager, user } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxLeads, setInboxLeads] = useState<InboxPaiLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPulling, setIsPulling] = useState<string | null>(null);
  const [hasActiveSellers, setHasActiveSellers] = useState(false);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: ITEMS_PER_PAGE,
    total: 0,
    totalPages: 0,
    hasMore: false,
  });

  // Check if company has active sellers
  useEffect(() => {
    const checkActiveSellers = async () => {
      if (!user?.companyId) return;
      
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
      
      // Then count active sellers in company
      const { count, error } = await supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("company_id", user.companyId)
        .eq("is_active", true)
        .in("user_id", sellerUserIds);
      
      if (!error) {
        setHasActiveSellers((count ?? 0) > 0);
      }
    };
    
    checkActiveSellers();
  }, [user?.companyId]);

  const fetchInboxPai = useCallback(async (page = 1) => {
    if (!session?.access_token) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-inbox-pai', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: null,
      });

      // Add query params via URL
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

  useEffect(() => {
    fetchInboxPai(1);
  }, [fetchInboxPai]);

  // Realtime subscription for new leads and assignments
  useEffect(() => {
    const channel = supabase
      .channel('inbox-pai-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
        },
        (payload) => {
          // Refresh when:
          // - New customer created (INSERT)
          // - Customer assigned_to changed (UPDATE)
          if (payload.eventType === 'INSERT') {
            // New lead arrived - refresh current page
            fetchInboxPai(pagination.page);
          } else if (payload.eventType === 'UPDATE') {
            const newRecord = payload.new as { assigned_to: string | null };
            const oldRecord = payload.old as { assigned_to: string | null };
            
            // assigned_to changed - either pulled or returned to inbox
            if (newRecord.assigned_to !== oldRecord.assigned_to) {
              fetchInboxPai(pagination.page);
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInboxPai, pagination.page]);

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
      
      // Navigate to the chat
      navigate(`/chat/${customerId}`);
    } catch (error: any) {
      console.error('Error pulling lead:', error);
      toast.error(error.message || 'Erro ao puxar lead');
      fetchInboxPai(pagination.page); // Refresh list on error
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
                <ScrollArea className="max-h-[600px]">
                  <div className="divide-y divide-border">
                    {filteredLeads.map((lead) => (
                      <InboxPaiCard
                        key={lead.id}
                        lead={lead}
                        onPullLead={handlePullLead}
                        isPulling={isPulling !== null}
                        canPull={!isManager && hasActiveSellers}
                      />
                    ))}
                  </div>
                </ScrollArea>
                
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
