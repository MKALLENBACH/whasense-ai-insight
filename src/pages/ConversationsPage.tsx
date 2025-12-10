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

interface AlertData {
  id: string;
  customer_id: string;
  alert_type: string;
  severity: string;
  message: string;
}

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
  // Cycle-based status (preferred)
  cycleStatus?: string;
  cycleId?: string | null;
  cycleLostReason?: string | null;
  cycleWonSummary?: string | null;
  // Legacy fields
  saleStatus?: "won" | "lost" | null;
  saleReason?: string | null;
  leadStatus: string;
  isIncomplete: boolean;
  cycleType?: "pre_sale" | "post_sale";
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
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"pending" | "completed" | "post_sale">("pending");
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modal state for incomplete leads
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedIncompleteConv, setSelectedIncompleteConv] = useState<ConversationData | null>(null);

  const fetchConversations = async () => {
    if (!session?.access_token) {
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('list-conversations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      setConversations(data?.conversations || []);

      // Fetch alerts from database
      const { data: alertsData } = await supabase
        .from('alerts')
        .select('id, customer_id, alert_type, severity, message');
      
      setAlerts(alertsData || []);
    } catch (error: any) {
      // Don't show error toast for auth-related errors (user logged out)
      if (error?.message?.includes('401') || error?.message?.includes('token') || error?.message?.includes('auth')) {
        console.log('Session expired, skipping fetch');
      } else {
        console.error('Error fetching conversations:', error);
        toast.error('Erro ao carregar conversas');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (session?.access_token) {
      fetchConversations();
    } else {
      setIsLoading(false);
    }
  }, [session]);

  // Realtime subscription for messages, customers, sales, alerts, and sale_cycles
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
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
          table: 'sale_cycles',
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

  // Filter conversations by tab - use cycleStatus (preferred) or fallback to leadStatus
  const getStatus = (c: ConversationData) => c.cycleStatus || c.leadStatus || 'pending';
  const getCycleType = (c: ConversationData) => c.cycleType || 'pre_sale';
  
  // Pending: pre_sale cycles with pending/in_progress status
  const pendingConversations = conversations.filter(c => {
    const status = getStatus(c);
    const cycleType = getCycleType(c);
    return cycleType === 'pre_sale' && (status === 'pending' || status === 'in_progress');
  });
  
  // Completed: pre_sale cycles with won/lost status
  const completedConversations = conversations.filter(c => {
    const status = getStatus(c);
    const cycleType = getCycleType(c);
    return cycleType === 'pre_sale' && (status === 'won' || status === 'lost');
  });
  
  // Post-sale: post_sale cycles (any status)
  const postSaleConversations = conversations.filter(c => {
    const cycleType = getCycleType(c);
    return cycleType === 'post_sale';
  });

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
    activeTab === "pending" 
      ? pendingConversations 
      : activeTab === "completed" 
        ? completedConversations 
        : postSaleConversations
  );

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  // Get alerts for a conversation from the database alerts
  const getAlertsForConversation = (conv: ConversationData): AlertData[] => {
    const status = conv.cycleStatus || conv.leadStatus;
    if (status === 'won' || status === 'lost') return [];
    if (isManager) return []; // Managers don't see operational alerts
    
    const convAlerts = alerts.filter(a => a.customer_id === conv.id);
    
    // Sort by priority: open_objection > hot_lead > waiting_response > stale_lead > incomplete_lead
    const priorityOrder: Record<string, number> = {
      'open_objection': 1,
      'hot_lead': 2,
      'waiting_response': 3,
      'stale_lead': 4,
      'incomplete_lead': 5,
    };
    
    return convAlerts
      .sort((a, b) => (priorityOrder[a.alert_type] || 99) - (priorityOrder[b.alert_type] || 99))
      .slice(0, 3); // Max 3 alerts per conversation
  };

  const getAlertIcon = (alertType: string) => {
    switch (alertType) {
      case 'hot_lead': return Flame;
      case 'open_objection': return AlertTriangle;
      case 'waiting_response': return Clock;
      case 'stale_lead': return Clock;
      case 'incomplete_lead': return AlertCircle;
      default: return AlertTriangle;
    }
  };

  const getAlertColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'border-destructive text-destructive';
      case 'warning': return 'border-warning text-warning';
      case 'info': return 'border-blue-500 text-blue-500';
      default: return 'border-muted-foreground text-muted-foreground';
    }
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
    const convAlerts = getAlertsForConversation(conv);
    const status = conv.cycleStatus || conv.leadStatus;
    const isCompleted = status === 'won' || status === 'lost';

    return (
      <div
        key={conv.id}
        onClick={() => handleConversationClick(conv)}
        className={cn(
          "p-4 border-b border-border hover:bg-muted/50 cursor-pointer transition-colors",
          convAlerts.length > 0 && !isCompleted && "border-l-4 border-l-warning",
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
            {!isCompleted && convAlerts.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {convAlerts.map((alert) => {
                  const AlertIcon = getAlertIcon(alert.alert_type);
                  return (
                    <Badge 
                      key={alert.id} 
                      variant="outline" 
                      className={cn("text-[10px] px-1.5 py-0", getAlertColor(alert.severity))}
                    >
                      <AlertIcon className="h-3 w-3 mr-1" />
                      {alert.message}
                    </Badge>
                  );
                })}
              </div>
            )}

            {/* Status for completed */}
            {isCompleted && (
              <div className="mt-2 space-y-1">
                <Badge 
                  className={cn(
                    "text-xs",
                    status === 'won' 
                      ? "bg-success text-success-foreground" 
                      : "bg-destructive text-destructive-foreground"
                  )}
                >
                  {status === 'won' ? (
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
                {(conv.cycleLostReason || conv.saleReason) && status === 'lost' && (
                  <p className="text-xs text-muted-foreground">
                    Motivo: {conv.cycleLostReason || conv.saleReason}
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
                {currentConversations.map(renderConversationCard)}
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
    </AppLayout>
  );
};

export default ConversationsPage;
