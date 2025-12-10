import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import ManagerInsightsPanel from "@/components/manager/ManagerInsightsPanel";
import { 
  ArrowLeft, 
  Loader2, 
  MessageSquare,
  Calendar,
  User,
  Hash,
  Trophy,
  XCircle,
  Clock,
  Play,
  ChevronRight,
  Thermometer,
  Target,
  Building2,
  Phone,
  HeadphonesIcon,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import MessageBubble from "@/components/conversation/MessageBubble";

interface Message {
  id: string;
  content: string;
  direction: "incoming" | "outgoing";
  timestamp: string;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

interface Insight {
  id: string;
  message_id: string;
  sentiment: string | null;
  temperature: string | null;
  objection: string | null;
  intention: string | null;
  suggestion: string | null;
  next_action: string | null;
}

interface Cycle {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  start_message_timestamp: string | null;
  lost_reason: string | null;
  won_summary: string | null;
  customer_id: string;
  seller_id: string;
  buyer_id: string | null;
  client_id: string | null;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
}

interface Seller {
  id: string;
  name: string;
}

interface Buyer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
}

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
}

const statusConfig = {
  pending: { label: "Aguardando", icon: Clock, color: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em Andamento", icon: Play, color: "bg-primary/10 text-primary" },
  won: { label: "Venda Realizada", icon: Trophy, color: "bg-success/10 text-success" },
  lost: { label: "Perdido", icon: XCircle, color: "bg-destructive/10 text-destructive" },
  closed: { label: "Pós-venda Concluído", icon: HeadphonesIcon, color: "bg-blue-500/10 text-blue-500" },
};

const lossReasonLabels: Record<string, string> = {
  price: "Preço alto",
  delay: "Prazo de entrega",
  competitor: "Concorrência",
  no_need: "Não precisa mais",
  no_response: "Sem resposta",
  other: "Outro motivo",
};

const intentionLabels: Record<string, string> = {
  doubt: "Dúvida",
  evaluating: "Avaliando",
  "ready-to-buy": "Pronto para comprar",
  comparing: "Comparando",
  complaining: "Reclamando",
  canceling: "Cancelando",
};

const temperatureLabels: Record<string, { label: string; color: string }> = {
  hot: { label: "Quente", color: "text-orange-500" },
  warm: { label: "Morno", color: "text-yellow-500" },
  cold: { label: "Frio", color: "text-blue-500" },
};

export default function ManagerCycleViewPage() {
  const { cycleId } = useParams<{ cycleId: string }>();
  const navigate = useNavigate();
  const { isManager } = useAuth();
  
  const [cycle, setCycle] = useState<Cycle | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [buyer, setBuyer] = useState<Buyer | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [allCycles, setAllCycles] = useState<Cycle[]>([]);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (cycleId && isManager) {
      fetchCycleData();
    }
  }, [cycleId, isManager]);

  const fetchCycleData = async () => {
    if (!cycleId) return;

    setIsLoading(true);
    try {
      // Fetch cycle
      const { data: cycleData, error: cycleError } = await supabase
        .from("sale_cycles")
        .select("*")
        .eq("id", cycleId)
        .maybeSingle();

      if (cycleError) throw cycleError;
      if (!cycleData) {
        toast.error("Ciclo não encontrado");
        navigate("/dashboard");
        return;
      }
      setCycle(cycleData);

      // Fetch messages ONLY for this cycle
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("id, content, direction, timestamp, attachment_url, attachment_type, attachment_name")
        .eq("cycle_id", cycleId)
        .order("timestamp", { ascending: true });

      if (messagesError) throw messagesError;
      setMessages(messagesData || []);

      // Fetch customer
      const { data: customerData } = await supabase
        .from("customers")
        .select("id, name, phone")
        .eq("id", cycleData.customer_id)
        .maybeSingle();
      setCustomer(customerData);

      // Fetch seller
      const { data: sellerData } = await supabase
        .from("profiles")
        .select("user_id, name")
        .eq("user_id", cycleData.seller_id)
        .maybeSingle();
      if (sellerData) {
        setSeller({ id: sellerData.user_id, name: sellerData.name });
      }

      // Fetch buyer if exists
      if (cycleData.buyer_id) {
        const { data: buyerData } = await supabase
          .from("buyers")
          .select("id, name, phone, email, role")
          .eq("id", cycleData.buyer_id)
          .maybeSingle();
        setBuyer(buyerData);
      }

      // Fetch client if exists
      if (cycleData.client_id) {
        const { data: clientData } = await supabase
          .from("clients")
          .select("id, name, cnpj, segment")
          .eq("id", cycleData.client_id)
          .maybeSingle();
        setClient(clientData);
      }

      // Fetch all cycles for this customer (for navigation) - sorted by created_at ASC
      const { data: allCyclesData } = await supabase
        .from("sale_cycles")
        .select("*")
        .eq("customer_id", cycleData.customer_id)
        .order("created_at", { ascending: true });
      setAllCycles(allCyclesData || []);

      // Fetch insights for messages in this cycle
      if (messagesData && messagesData.length > 0) {
        const messageIds = messagesData.map(m => m.id);
        const { data: insightsData } = await supabase
          .from("insights")
          .select("id, message_id, sentiment, temperature, objection, intention, suggestion, next_action")
          .in("message_id", messageIds);
        setInsights(insightsData || []);
      }

    } catch (error) {
      console.error("Error fetching cycle data:", error);
      toast.error("Erro ao carregar dados do ciclo");
    } finally {
      setIsLoading(false);
    }
  };

  const getCycleNumber = (cycleId: string) => {
    const index = allCycles.findIndex(c => c.id === cycleId);
    return index >= 0 ? index + 1 : 1;
  };

  const getObjectionsCount = () => {
    return insights.filter(i => i.objection && i.objection !== "none").length;
  };

  const getFinalTemperature = () => {
    const temps = insights.filter(i => i.temperature);
    if (temps.length === 0) return null;
    return temps[temps.length - 1].temperature;
  };

  const getAverageIntention = () => {
    const intentions = insights.filter(i => i.intention).map(i => i.intention as string);
    if (intentions.length === 0) return null;
    const intentionCount: Record<string, number> = {};
    intentions.forEach(i => {
      intentionCount[i] = (intentionCount[i] || 0) + 1;
    });
    return Object.entries(intentionCount).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  };

  if (!isManager) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Acesso restrito a gestores</p>
        </div>
      </AppLayout>
    );
  }

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-[calc(100vh-3rem)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!cycle) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <p className="text-muted-foreground">Ciclo não encontrado</p>
        </div>
      </AppLayout>
    );
  }

  const config = statusConfig[cycle.status as keyof typeof statusConfig] || statusConfig.pending;
  const StatusIcon = config.icon;
  const cycleNumber = getCycleNumber(cycle.id);
  const startDate = cycle.start_message_timestamp || cycle.created_at;
  const finalTemp = getFinalTemperature();
  const avgIntention = getAverageIntention();

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3rem)] flex gap-4 p-4">
        {/* Left Sidebar - Cycle Navigation */}
        <div className="w-56 flex-shrink-0">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Hash className="h-4 w-4" />
                Ciclos
              </CardTitle>
              <p className="text-xs text-muted-foreground truncate">
                {customer?.name || "Lead"}
              </p>
            </CardHeader>
            <CardContent className="p-0">
              <ScrollArea className="h-[calc(100%-5rem)]">
                <div className="space-y-1 p-2">
                  {allCycles.map((c, index) => {
                    const cNum = index + 1;
                    const cConfig = statusConfig[c.status as keyof typeof statusConfig] || statusConfig.pending;
                    const CIcon = cConfig.icon;
                    const isActive = c.id === cycleId;
                    
                    return (
                      <Button
                        key={c.id}
                        variant={isActive ? "secondary" : "ghost"}
                        className={cn(
                          "w-full justify-start gap-2 h-auto py-2",
                          isActive && "bg-primary/10"
                        )}
                        onClick={() => navigate(`/gestor/ciclos/${c.id}`)}
                      >
                        <CIcon className={cn("h-4 w-4 flex-shrink-0", cConfig.color.split(" ")[1])} />
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium">Ciclo #{cNum}</div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(c.start_message_timestamp || c.created_at), "dd/MM/yy", { locale: ptBR })}
                          </div>
                        </div>
                        {isActive && <ChevronRight className="h-4 w-4 flex-shrink-0" />}
                      </Button>
                    );
                  })}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          {/* Header */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-start gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate("/historico")}
                  className="h-8 w-8 flex-shrink-0"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h1 className="text-xl font-semibold">Ciclo #{cycleNumber}</h1>
                    <Badge className={config.color}>
                      <StatusIcon className="h-3.5 w-3.5 mr-1" />
                      {config.label}
                    </Badge>
                    {finalTemp && (
                      <Badge variant="outline" className={temperatureLabels[finalTemp]?.color}>
                        <Thermometer className="h-3.5 w-3.5 mr-1" />
                        {temperatureLabels[finalTemp]?.label || finalTemp}
                      </Badge>
                    )}
                    {avgIntention && (
                      <Badge variant="outline">
                        <Target className="h-3.5 w-3.5 mr-1" />
                        {intentionLabels[avgIntention] || avgIntention}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Customer/Buyer/Client info */}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground flex-wrap">
                    {client && (
                      <div className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5" />
                        <span>{client.name}</span>
                        {client.segment && <span className="text-xs">({client.segment})</span>}
                      </div>
                    )}
                    {buyer && (
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span>{buyer.name}</span>
                        {buyer.role && <span className="text-xs">({buyer.role})</span>}
                      </div>
                    )}
                    {!buyer && customer && (
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span>{customer.name}</span>
                      </div>
                    )}
                    {(buyer?.phone || customer?.phone) && (
                      <div className="flex items-center gap-1">
                        <Phone className="h-3.5 w-3.5" />
                        <span>{buyer?.phone || customer?.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Cycle Metrics */}
                <div className="flex items-center gap-4 text-sm flex-shrink-0">
                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">Período</div>
                    <div className="font-medium">
                      {format(new Date(startDate), "dd/MM", { locale: ptBR })}
                      {cycle.closed_at && (
                        <> → {format(new Date(cycle.closed_at), "dd/MM", { locale: ptBR })}</>
                      )}
                    </div>
                  </div>

                  <Separator orientation="vertical" className="h-8" />

                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">Vendedor</div>
                    <div className="font-medium">{seller?.name || "N/A"}</div>
                  </div>

                  <Separator orientation="vertical" className="h-8" />

                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">Msgs</div>
                    <div className="font-medium">{messages.length}</div>
                  </div>

                  <Separator orientation="vertical" className="h-8" />

                  <div className="text-center">
                    <div className="text-muted-foreground text-xs">Objeções</div>
                    <div className="font-medium">{getObjectionsCount()}</div>
                  </div>
                </div>
              </div>

              {/* Status details */}
              {(cycle.status === "won" || cycle.status === "lost") && (
                <div className="mt-4 pt-4 border-t">
                  {cycle.status === "won" && cycle.won_summary && (
                    <div className="flex items-start gap-2">
                      <Trophy className="h-4 w-4 text-success mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-success">Resumo da venda:</span>
                        <p className="text-sm text-muted-foreground">{cycle.won_summary}</p>
                      </div>
                    </div>
                  )}
                  {cycle.status === "lost" && cycle.lost_reason && (
                    <div className="flex items-start gap-2">
                      <XCircle className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <span className="text-sm font-medium text-destructive">Motivo da perda:</span>
                        <p className="text-sm text-muted-foreground">
                          {lossReasonLabels[cycle.lost_reason] || cycle.lost_reason}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Messages and Insights */}
          <div className="flex-1 flex gap-4 overflow-hidden">
            {/* Messages */}
            <Card className="flex-1 flex flex-col overflow-hidden">
              <CardHeader className="pb-2 flex-shrink-0">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Mensagens do Ciclo
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 p-0 overflow-hidden">
                <ScrollArea className="h-full p-4">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-muted-foreground">
                      <div className="text-center">
                        <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>Nenhuma mensagem neste ciclo</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((message) => (
                        <MessageBubble
                          key={message.id}
                          content={message.content}
                          direction={message.direction}
                          timestamp={message.timestamp}
                          attachmentUrl={message.attachment_url}
                          attachmentType={message.attachment_type}
                          attachmentName={message.attachment_name}
                        />
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>

            {/* Insights Panel */}
            <ManagerInsightsPanel cycleId={cycleId} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
