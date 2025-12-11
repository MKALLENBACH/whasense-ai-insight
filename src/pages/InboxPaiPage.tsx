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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { LeadDistributionDashboard } from "@/components/dashboard/LeadDistributionDashboard";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface InboxPaiLead {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  lastMessage: string;
  lastMessageAt: string;
  messageCount: number;
  waitingTime: string;
}

const InboxPaiPage = () => {
  const { session, isManager } = useAuth();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const [inboxLeads, setInboxLeads] = useState<InboxPaiLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isPulling, setIsPulling] = useState<string | null>(null);

  const fetchInboxPai = useCallback(async () => {
    if (!session?.access_token) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-inbox-pai', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setInboxLeads(data?.leads || []);
    } catch (error) {
      console.error('Error fetching inbox pai:', error);
      toast.error('Erro ao carregar Inbox Pai');
    } finally {
      setIsLoading(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchInboxPai();
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
            // New lead arrived
            fetchInboxPai();
          } else if (payload.eventType === 'UPDATE') {
            const newRecord = payload.new as { assigned_to: string | null };
            const oldRecord = payload.old as { assigned_to: string | null };
            
            // assigned_to changed - either pulled or returned to inbox
            if (newRecord.assigned_to !== oldRecord.assigned_to) {
              fetchInboxPai();
            }
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInboxPai]);

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
      fetchInboxPai(); // Refresh list on error
    } finally {
      setIsPulling(null);
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
              Leads aguardando atribuição • Puxe para começar a atender
            </p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={fetchInboxPai} 
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
                  {inboxLeads.length}
                </Badge>
              </CardTitle>
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
              <ScrollArea className="max-h-[600px]">
                <div className="divide-y divide-border">
                  {filteredLeads.map((lead) => (
                    <div 
                      key={lead.id}
                      className="p-4 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium truncate">{lead.customer.name}</h4>
                            <Badge variant="outline" className="shrink-0 text-xs">
                              {lead.messageCount} msg
                            </Badge>
                          </div>
                          
                          {lead.customer.phone && (
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2">
                              <Phone className="h-3.5 w-3.5" />
                              {lead.customer.phone}
                            </div>
                          )}
                          
                          <div className="flex items-start gap-2 text-sm text-muted-foreground">
                            <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                            <p className="line-clamp-2">{lead.lastMessage}</p>
                          </div>
                          
                          <div className="flex items-center gap-4 mt-2">
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(lead.lastMessageAt), { 
                                addSuffix: true, 
                                locale: ptBR 
                              })}
                            </span>
                          </div>
                        </div>
                        
                        <Button
                          size="sm"
                          onClick={() => handlePullLead(lead.customer.id)}
                          disabled={isPulling === lead.customer.id}
                          className="shrink-0"
                        >
                          {isPulling === lead.customer.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              Puxar Lead
                              <ArrowRight className="h-4 w-4 ml-1" />
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
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
