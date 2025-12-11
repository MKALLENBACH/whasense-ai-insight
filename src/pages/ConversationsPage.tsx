import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Loader2, 
  RefreshCw, 
  Clock, 
  CheckCircle2,
  Search,
  Inbox,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NewLeadModal from "@/components/lead/NewLeadModal";
import LinkClientModal from "@/components/conversation/LinkClientModal";
import ConversationCard, { ConversationData } from "@/components/conversation/ConversationCard";
import InboxPaiCard, { InboxPaiLead } from "@/components/conversation/InboxPaiCard";
import { useConversations } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const ConversationsPage = () => {
  const { session, isManager } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"inbox_pai" | "pending" | "completed" | "post_sale">("inbox_pai");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Inbox Pai state
  const [inboxPaiLeads, setInboxPaiLeads] = useState<InboxPaiLead[]>([]);
  const [isLoadingInbox, setIsLoadingInbox] = useState(true);
  const [isPulling, setIsPulling] = useState(false);
  
  // Modal state for incomplete leads
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedIncompleteConv, setSelectedIncompleteConv] = useState<ConversationData | null>(null);
  
  // Modal state for linking client
  const [showLinkClientModal, setShowLinkClientModal] = useState(false);
  const [selectedLinkConv, setSelectedLinkConv] = useState<{id: string; name: string} | null>(null);

  const {
    alerts,
    isLoading,
    isRefreshing,
    handleRefresh,
    fetchConversations,
    pendingConversations,
    completedConversations,
    postSaleConversations,
    filterBySearch,
  } = useConversations({ accessToken: session?.access_token });

  // Fetch Inbox Pai leads
  const fetchInboxPai = useCallback(async () => {
    if (!session?.access_token) return;
    
    setIsLoadingInbox(true);
    try {
      const { data, error } = await supabase.functions.invoke('list-inbox-pai', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setInboxPaiLeads(data?.leads || []);
    } catch (error) {
      console.error('Error fetching inbox pai:', error);
    } finally {
      setIsLoadingInbox(false);
    }
  }, [session?.access_token]);

  useEffect(() => {
    fetchInboxPai();
  }, [fetchInboxPai]);

  // Handle pulling a lead
  const handlePullLead = async (customerId: string) => {
    if (!session?.access_token) return;
    
    setIsPulling(true);
    try {
      const { data, error } = await supabase.functions.invoke('pull-lead', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: { customer_id: customerId },
      });

      if (error) throw error;
      
      toast.success('Lead atribuído com sucesso!');
      
      // Refresh both lists
      await Promise.all([fetchInboxPai(), fetchConversations()]);
      
      // Navigate to the chat
      navigate(`/chat/${customerId}`);
    } catch (error: any) {
      console.error('Error pulling lead:', error);
      toast.error(error.message || 'Erro ao puxar lead');
    } finally {
      setIsPulling(false);
    }
  };

  const handleRefreshAll = () => {
    handleRefresh();
    fetchInboxPai();
  };

  const currentConversations = filterBySearch(
    activeTab === "pending" 
      ? pendingConversations 
      : activeTab === "completed" 
        ? completedConversations 
        : postSaleConversations,
    searchQuery
  );

  const filteredInboxLeads = inboxPaiLeads.filter(lead => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      lead.customer.name.toLowerCase().includes(query) ||
      lead.customer.phone?.toLowerCase().includes(query) ||
      lead.lastMessage.toLowerCase().includes(query)
    );
  });

  const handleConversationClick = (conv: ConversationData) => {
    if (conv.isIncomplete) {
      setSelectedIncompleteConv(conv);
      setShowLeadModal(true);
    } else {
      navigate(`/chat/${conv.id}`);
    }
  };

  const handleLinkClient = (customerId: string, customerName: string) => {
    setSelectedLinkConv({ id: customerId, name: customerName });
    setShowLinkClientModal(true);
  };

  if (isLoading && isLoadingInbox) {
    return (
      <AppLayout>
        <div className="h-[calc(100vh-3rem)] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando conversas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3rem)] flex flex-col">
        <div className="bg-card rounded-lg border border-border overflow-hidden flex flex-col flex-1">
          {/* Header */}
          <div className="p-4 border-b border-border">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg">Conversas</h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefreshAll}
                disabled={isRefreshing || isLoadingInbox}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", (isRefreshing || isLoadingInbox) && "animate-spin")} />
              </Button>
            </div>

            {/* Search */}
            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone, empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
              <TabsList className="grid grid-cols-4 w-full">
                <TabsTrigger value="inbox_pai" className="gap-1 text-xs sm:text-sm">
                  <Inbox className="h-4 w-4" />
                  <span className="hidden sm:inline">Inbox Pai</span>
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {inboxPaiLeads.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="pending" className="gap-1 text-xs sm:text-sm">
                  <Clock className="h-4 w-4" />
                  <span className="hidden sm:inline">Meus</span>
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {pendingConversations.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-1 text-xs sm:text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="hidden sm:inline">Concluída</span>
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {completedConversations.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="post_sale" className="gap-1 text-xs sm:text-sm">
                  <MessageSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Pós-venda</span>
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {postSaleConversations.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Content based on active tab */}
          <ScrollArea className="flex-1">
            {activeTab === "inbox_pai" ? (
              // Inbox Pai Tab
              filteredInboxLeads.length > 0 ? (
                <div>
                  {filteredInboxLeads.map((lead) => (
                    <InboxPaiCard
                      key={lead.id}
                      lead={lead}
                      onPullLead={handlePullLead}
                      isPulling={isPulling}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 h-64">
                  <div className="text-center text-muted-foreground">
                    <Inbox className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">Nenhum lead no Inbox Pai</p>
                    <p className="text-xs mt-1">
                      Novos leads aparecerão aqui automaticamente
                    </p>
                  </div>
                </div>
              )
            ) : (
              // Other tabs (pending, completed, post_sale)
              currentConversations.length > 0 ? (
                <div>
                  {currentConversations.map((conv) => (
                    <ConversationCard
                      key={conv.id}
                      conversation={conv}
                      alerts={alerts}
                      isManager={isManager}
                      onClick={() => handleConversationClick(conv)}
                      onLinkClient={handleLinkClient}
                    />
                  ))}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center p-8 h-64">
                  <div className="text-center text-muted-foreground">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p className="text-sm">
                      {activeTab === "pending" 
                        ? "Nenhum lead atribuído a você" 
                        : activeTab === "completed"
                          ? "Nenhuma venda concluída"
                          : "Nenhum atendimento pós-venda"}
                    </p>
                    <p className="text-xs mt-1">
                      {activeTab === "pending"
                        ? "Puxe leads do Inbox Pai para começar"
                        : "Vendas finalizadas aparecerão aqui"}
                    </p>
                  </div>
                </div>
              )
            )}
          </ScrollArea>
        </div>
      </div>

      {/* Modal for incomplete leads */}
      {selectedIncompleteConv && (
        <NewLeadModal
          open={showLeadModal}
          onOpenChange={(open) => {
            setShowLeadModal(open);
            if (!open) setSelectedIncompleteConv(null);
          }}
          phoneNumber={selectedIncompleteConv.customer.phone || ""}
          customerId={selectedIncompleteConv.id}
          isEditMode={true}
          existingData={{
            name: selectedIncompleteConv.customer.name,
            email: selectedIncompleteConv.customer.email,
            companyId: null,
          }}
          onSuccess={() => {
            fetchConversations();
            navigate(`/chat/${selectedIncompleteConv.id}`);
          }}
        />
      )}

      {/* Link Client Modal */}
      {selectedLinkConv && (
        <LinkClientModal
          open={showLinkClientModal}
          onOpenChange={setShowLinkClientModal}
          customerId={selectedLinkConv.id}
          customerName={selectedLinkConv.name}
          onSuccess={fetchConversations}
        />
      )}
    </AppLayout>
  );
};

export default ConversationsPage;
