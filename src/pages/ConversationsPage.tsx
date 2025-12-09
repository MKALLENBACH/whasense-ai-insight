import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  MessageSquare, 
  Loader2, 
  RefreshCw, 
  Clock, 
  Flame, 
  ThermometerSun, 
  Snowflake,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Search,
  User,
  Building2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import NewLeadModal from "@/components/lead/NewLeadModal";

interface ConversationData {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    lead_status: string;
    is_incomplete: boolean;
    companyName: string | null;
  };
  lastMessage: string;
  lastMessageTime: string;
  lastMessageDirection: string;
  sellerId?: string;
  sellerName?: string;
  insight: {
    sentiment: string;
    intention: string;
    objection: string;
    temperature: string;
    suggestion: string;
    next_action: string;
  } | null;
  messageCount: number;
  hasRisk: boolean;
  saleStatus: "won" | "lost" | null;
  saleReason: string | null;
  leadStatus: string;
  isIncomplete: boolean;
}

const temperatureConfig = {
  hot: { icon: Flame, label: "Quente", color: "text-destructive", bgColor: "bg-destructive/10" },
  warm: { icon: ThermometerSun, label: "Morno", color: "text-warning", bgColor: "bg-warning/10" },
  cold: { icon: Snowflake, label: "Frio", color: "text-muted-foreground", bgColor: "bg-muted" },
};

const ConversationsPage = () => {
  const { session, isManager } = useAuth();
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "completed">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal state for incomplete leads
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedIncompleteConv, setSelectedIncompleteConv] = useState<ConversationData | null>(null);

  const fetchConversations = async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke('list-conversations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setConversations(data?.conversations || []);
    } catch (error) {
      console.error('Error fetching conversations:', error);
      toast.error('Erro ao carregar conversas');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [session]);

  // Realtime subscription for messages
  useEffect(() => {
    const channel = supabase
      .channel('conversations-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'customers',
        },
        () => {
          fetchConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sales',
        },
        () => {
          fetchConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
  };

  // Filter conversations by tab
  const pendingConversations = conversations.filter(
    c => !c.leadStatus || c.leadStatus === 'pending' || c.leadStatus === 'in_progress'
  );
  const completedConversations = conversations.filter(
    c => c.leadStatus === 'won' || c.leadStatus === 'lost'
  );

  // Apply search filter
  const filterBySearch = (convs: ConversationData[]) => {
    if (!searchQuery.trim()) return convs;
    const query = searchQuery.toLowerCase();
    return convs.filter(c => 
      c.customer.name.toLowerCase().includes(query) ||
      c.customer.phone?.toLowerCase().includes(query) ||
      c.customer.companyName?.toLowerCase().includes(query) ||
      c.sellerName?.toLowerCase().includes(query)
    );
  };

  const currentConversations = filterBySearch(
    activeTab === "pending" ? pendingConversations : completedConversations
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getAlerts = (conv: ConversationData): string[] => {
    const alerts: string[] = [];
    
    if (conv.leadStatus === 'won' || conv.leadStatus === 'lost') return alerts;

    // Check for unanswered message
    if (conv.lastMessageDirection === 'incoming') {
      const minutesAgo = (Date.now() - new Date(conv.lastMessageTime).getTime()) / 1000 / 60;
      if (minutesAgo > 10) {
        alerts.push(`Aguardando resposta há ${Math.round(minutesAgo)} min`);
      } else if (minutesAgo > 5) {
        alerts.push('Cliente aguardando resposta');
      }
    }

    // Hot lead
    if (conv.insight?.temperature === 'hot') {
      alerts.push('Lead quente!');
    }

    // Objection
    if (conv.insight?.objection && conv.insight.objection !== 'none') {
      alerts.push('Objeção detectada');
    }

    return alerts;
  };

  const handleConversationClick = (conv: ConversationData) => {
    if (conv.isIncomplete) {
      setSelectedIncompleteConv(conv);
      setShowLeadModal(true);
    } else {
      navigate(`/chat/${conv.id}`);
    }
  };

  const renderConversationCard = (conv: ConversationData) => {
    const temperature = conv.insight?.temperature || 'cold';
    const TempIcon = temperatureConfig[temperature as keyof typeof temperatureConfig]?.icon || Snowflake;
    const tempColor = temperatureConfig[temperature as keyof typeof temperatureConfig]?.color || 'text-muted-foreground';
    const alerts = getAlerts(conv);
    const isCompleted = conv.leadStatus === 'won' || conv.leadStatus === 'lost';

    return (
      <div
        key={conv.id}
        onClick={() => handleConversationClick(conv)}
        className={cn(
          "p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
          alerts.length > 0 && !isCompleted && "border-l-4 border-l-warning",
          conv.isIncomplete && "border-l-4 border-l-orange-500 bg-orange-500/5"
        )}
      >
        <div className="flex items-start gap-3">
          <Avatar className="h-10 w-10 flex-shrink-0">
            <AvatarFallback className={cn(
              "text-sm",
              conv.isIncomplete 
                ? "bg-orange-500/10 text-orange-500" 
                : "bg-primary/10 text-primary"
            )}>
              {getInitials(conv.customer.name)}
            </AvatarFallback>
          </Avatar>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-medium truncate">{conv.customer.name}</span>
                {!isCompleted && !conv.isIncomplete && (
                  <TempIcon className={cn("h-4 w-4 flex-shrink-0", tempColor)} />
                )}
                {conv.isIncomplete && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-1.5 py-0 border-orange-500 bg-orange-500/10 text-orange-500"
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Incompleto
                  </Badge>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatDistanceToNow(new Date(conv.lastMessageTime), {
                  addSuffix: true,
                  locale: ptBR,
                })}
              </span>
            </div>

            {/* Company name */}
            {conv.customer.companyName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Building2 className="h-3 w-3" />
                <span>{conv.customer.companyName}</span>
              </div>
            )}

            {/* Seller name for manager */}
            {isManager && conv.sellerName && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <User className="h-3 w-3" />
                <span>{conv.sellerName}</span>
              </div>
            )}

            <p className="text-sm text-muted-foreground truncate mt-1">
              {conv.lastMessage}
            </p>

            {/* Alerts for pending */}
            {!isCompleted && alerts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {alerts.map((alert, idx) => (
                  <Badge 
                    key={idx} 
                    variant="outline" 
                    className="text-[10px] px-1.5 py-0 border-warning text-warning"
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    {alert}
                  </Badge>
                ))}
              </div>
            )}

            {/* Status for completed */}
            {isCompleted && (
              <div className="mt-2 space-y-1">
                <Badge 
                  className={cn(
                    "text-xs",
                    conv.leadStatus === 'won' 
                      ? "bg-success text-success-foreground" 
                      : "bg-destructive text-destructive-foreground"
                  )}
                >
                  {conv.leadStatus === 'won' ? (
                    <>
                      <CheckCircle2 className="h-3 w-3 mr-1" />
                      Venda Fechada
                    </>
                  ) : (
                    <>
                      <XCircle className="h-3 w-3 mr-1" />
                      Venda Perdida
                    </>
                  )}
                </Badge>
                {conv.saleReason && conv.leadStatus === 'lost' && (
                  <p className="text-xs text-muted-foreground">
                    Motivo: {conv.saleReason}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
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
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "pending" | "completed")}>
              <TabsList className="grid grid-cols-2 w-full">
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
              </TabsList>
            </Tabs>
          </div>

          {/* Conversations List */}
          <ScrollArea className="flex-1">
            {currentConversations.length > 0 ? (
              <div>
                {currentConversations.map(renderConversationCard)}
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center p-8 h-64">
                <div className="text-center text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    {activeTab === "pending" 
                      ? "Nenhuma conversa pendente" 
                      : "Nenhuma venda concluída"}
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
    </AppLayout>
  );
};

export default ConversationsPage;
