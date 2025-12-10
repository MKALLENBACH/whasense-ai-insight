import { useState } from "react";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import NewLeadModal from "@/components/lead/NewLeadModal";
import LinkClientModal from "@/components/conversation/LinkClientModal";
import ConversationCard, { ConversationData } from "@/components/conversation/ConversationCard";
import { useConversations } from "@/hooks/useConversations";

const ConversationsPage = () => {
  const { session, isManager } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"pending" | "completed" | "post_sale">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  
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

  const currentConversations = filterBySearch(
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

  if (isLoading) {
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
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 w-8"
              >
                <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "completed" | "post_sale")}>
              <TabsList className="grid grid-cols-3 w-full">
                <TabsTrigger value="pending" className="gap-2">
                  <Clock className="h-4 w-4" />
                  Pendente
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {pendingConversations.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="completed" className="gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  Concluída
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {completedConversations.length}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="post_sale" className="gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Pós-venda
                  <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
                    {postSaleConversations.length}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {currentConversations.length > 0 ? (
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
                      ? "Nenhuma conversa pendente" 
                      : activeTab === "completed"
                        ? "Nenhuma venda concluída"
                        : "Nenhum atendimento pós-venda"}
                  </p>
                  <p className="text-xs mt-1">
                    {activeTab === "pending"
                      ? "Novas conversas aparecerão aqui"
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
    </AppLayout>
  );
};

export default ConversationsPage;
