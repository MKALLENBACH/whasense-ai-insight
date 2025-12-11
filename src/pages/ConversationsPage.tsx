import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  MessageSquare, 
  Loader2, 
  RefreshCw, 
  Clock, 
  CheckCircle2,
  Search,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import NewLeadModal from "@/components/lead/NewLeadModal";
import LinkClientModal from "@/components/conversation/LinkClientModal";
import ReassignLeadModal from "@/components/chat/ReassignLeadModal";
import ConversationCard, { ConversationData } from "@/components/conversation/ConversationCard";
import { useConversations } from "@/hooks/useConversations";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Seller {
  user_id: string;
  name: string;
  email: string;
}

const ConversationsPage = () => {
  const { session, isManager, user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"pending" | "completed" | "post_sale">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSellerId, setSelectedSellerId] = useState<string | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoadingSellers, setIsLoadingSellers] = useState(false);
  
  // Modal state for incomplete leads
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedIncompleteConv, setSelectedIncompleteConv] = useState<ConversationData | null>(null);
  
  // Modal state for linking client
  const [showLinkClientModal, setShowLinkClientModal] = useState(false);
  const [selectedLinkConv, setSelectedLinkConv] = useState<{id: string; name: string} | null>(null);

  // Modal state for reassigning lead (manager)
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedReassignConv, setSelectedReassignConv] = useState<ConversationData | null>(null);

  // Fetch sellers for manager
  useEffect(() => {
    const fetchSellers = async () => {
      if (!isManager || !user?.companyId) return;
      
      setIsLoadingSellers(true);
      try {
        // Get seller user_ids
        const { data: sellerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "seller");

        if (!sellerRoles || sellerRoles.length === 0) {
          setSellers([]);
          return;
        }

        const sellerUserIds = sellerRoles.map((r) => r.user_id);

        // Get active sellers in company
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("user_id, name, email")
          .eq("company_id", user.companyId)
          .eq("is_active", true)
          .in("user_id", sellerUserIds);

        if (error) throw error;

        setSellers(profiles || []);
      } catch (error) {
        console.error("Error fetching sellers:", error);
      } finally {
        setIsLoadingSellers(false);
      }
    };

    fetchSellers();
  }, [isManager, user?.companyId]);

  const {
    alerts,
    isLoading,
    isRefreshing,
    handleRefresh,
    fetchConversations,
    activeConversations,
    pendingConversations,
    completedConversations,
    postSaleConversations,
    filterBySearch,
  } = useConversations({ 
    accessToken: session?.access_token,
    sellerId: isManager ? selectedSellerId : null,
  });

  // For manager: show only active conversations (no tabs)
  // For seller: show tabs as before
  const currentConversations = isManager
    ? filterBySearch(activeConversations, searchQuery)
    : filterBySearch(
        activeTab === "pending" 
          ? pendingConversations 
          : activeTab === "completed" 
            ? completedConversations 
            : postSaleConversations,
        searchQuery
      );

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

  // Manager: Open reassign modal
  const handleReassign = (customerId: string) => {
    const conv = currentConversations.find(c => c.customer.id === customerId);
    if (conv) {
      setSelectedReassignConv(conv);
      setShowReassignModal(true);
    }
  };

  // Manager: Return lead to inbox
  const handleReturnToInbox = async (customerId: string) => {
    try {
      const { error } = await supabase
        .from("customers")
        .update({ assigned_to: null, seller_id: null })
        .eq("id", customerId);

      if (error) throw error;

      toast.success("Lead devolvido ao Inbox Pai");
      fetchConversations();
    } catch (error) {
      console.error("Error returning to inbox:", error);
      toast.error("Erro ao devolver lead ao inbox");
    }
  };

  // Loading state for sellers (full page) or managers with seller selected
  const showFullPageLoading = isLoading && (!isManager || selectedSellerId);
  
  if (showFullPageLoading && !isManager) {
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
              <h2 className="font-semibold text-lg">
                {isManager ? "Conversas da Equipe" : "Minhas Conversas"}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
              </Button>
            </div>

            {/* Manager: Seller selector */}
            {isManager && (
              <div className="mb-4">
                <label className="text-sm font-medium text-muted-foreground mb-2 block">
                  Selecione o vendedor
                </label>
                <Select
                  value={selectedSellerId || ""}
                  onValueChange={(value) => setSelectedSellerId(value || null)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Escolha um vendedor para ver as conversas" />
                  </SelectTrigger>
                  <SelectContent>
                    {isLoadingSellers ? (
                      <div className="flex items-center justify-center p-4">
                        <Loader2 className="h-4 w-4 animate-spin" />
                      </div>
                    ) : sellers.length === 0 ? (
                      <div className="p-4 text-center text-muted-foreground text-sm">
                        Nenhum vendedor ativo
                      </div>
                    ) : (
                      sellers.map((seller) => (
                        <SelectItem key={seller.user_id} value={seller.user_id}>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4" />
                            <span>{seller.name}</span>
                            <span className="text-muted-foreground text-xs">({seller.email})</span>
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Search - only show when seller is selected (manager) or always for sellers */}
            {(!isManager || selectedSellerId) && (
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, telefone, empresa..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            )}

            {/* Tabs - only for sellers */}
            {!isManager && (
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid grid-cols-3 w-full">
                  <TabsTrigger value="pending" className="gap-1 text-xs sm:text-sm">
                    <Clock className="h-4 w-4" />
                    <span className="hidden sm:inline">Ativos</span>
                    <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                      {pendingConversations.length}
                    </Badge>
                  </TabsTrigger>
                  <TabsTrigger value="completed" className="gap-1 text-xs sm:text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Concluídos</span>
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
            )}

            {/* Manager: Active conversations count */}
            {isManager && selectedSellerId && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Conversas ativas:</span>
                <Badge variant="secondary">{activeConversations.length}</Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <ScrollArea className="flex-1">
            {/* Manager without seller selected */}
            {isManager && !selectedSellerId ? (
              <div className="flex-1 flex items-center justify-center p-8 h-64">
                <div className="text-center text-muted-foreground">
                  <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Selecione um vendedor</p>
                  <p className="text-sm mt-1">
                    Escolha um vendedor acima para ver suas conversas ativas
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="flex flex-col items-center justify-center p-8 h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Carregando conversas...</p>
              </div>
            ) : currentConversations.length > 0 ? (
              <div>
                {currentConversations.map((conv) => (
                  <ConversationCard
                    key={conv.id}
                    conversation={conv}
                    alerts={alerts}
                    isManager={isManager}
                    onClick={() => handleConversationClick(conv)}
                    onLinkClient={handleLinkClient}
                    onReassign={isManager ? () => handleReassign(conv.customer.id) : undefined}
                    onReturnToInbox={isManager ? () => handleReturnToInbox(conv.customer.id) : undefined}
                  />
                ))}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 h-64">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    {isManager
                      ? "Nenhuma conversa ativa para este vendedor"
                      : activeTab === "pending" 
                        ? "Nenhum lead atribuído a você" 
                        : activeTab === "completed"
                          ? "Nenhuma venda concluída"
                          : "Nenhum atendimento pós-venda"}
                  </p>
                  <p className="text-xs mt-1">
                    {isManager
                      ? "Leads ativos aparecerão aqui quando o vendedor puxar do Inbox"
                      : activeTab === "pending"
                        ? "Puxe leads do Inbox Pai para começar"
                        : "Vendas finalizadas aparecerão aqui"}
                  </p>
                </div>
              </div>
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

      {/* Reassign Lead Modal (manager only) */}
      {selectedReassignConv && user?.companyId && (
        <ReassignLeadModal
          open={showReassignModal}
          onOpenChange={(open) => {
            setShowReassignModal(open);
            if (!open) setSelectedReassignConv(null);
          }}
          customerId={selectedReassignConv.customer.id}
          currentAssignedTo={selectedReassignConv.sellerId || null}
          companyId={user.companyId}
          onSuccess={fetchConversations}
        />
      )}
    </AppLayout>
  );
};

export default ConversationsPage;
