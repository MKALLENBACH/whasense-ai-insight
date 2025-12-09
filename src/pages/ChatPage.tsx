import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Send, 
  ArrowLeft, 
  Loader2, 
  Smile, 
  Frown, 
  Meh, 
  Angry, 
  HelpCircle, 
  Sparkles,
  Target,
  AlertTriangle,
  Thermometer,
  MessageSquare,
  Lightbulb,
  ArrowRight,
  Copy,
  RefreshCw,
  Trophy,
  XCircle,
  Bot
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";
import SaleRegistrationModal from "@/components/sale/SaleRegistrationModal";
import { useCustomerSimulation } from "@/hooks/useCustomerSimulation";
import ManagerInsightsPanel from "@/components/manager/ManagerInsightsPanel";

interface Message {
  id: string;
  content: string;
  direction: "incoming" | "outgoing";
  timestamp: string;
}

interface AIAnalysis {
  sentiment: string;
  intention: number;
  objection: string;
  temperature: string;
  suggestion: string;
  next_action: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  seller_id: string | null;
}

interface ExistingSale {
  id: string;
  status: "won" | "lost";
  reason: string | null;
}

const sentimentConfig: Record<string, { icon: typeof Smile; label: string; color: string }> = {
  positive: { icon: Smile, label: "Positivo", color: "text-success" },
  excited: { icon: Sparkles, label: "Empolgado", color: "text-success" },
  neutral: { icon: Meh, label: "Neutro", color: "text-muted-foreground" },
  negative: { icon: Frown, label: "Negativo", color: "text-warning" },
  angry: { icon: Angry, label: "Irritado", color: "text-destructive" },
  insecure: { icon: HelpCircle, label: "Inseguro", color: "text-warning" },
};

const objectionLabels: Record<string, string> = {
  price: "Preço alto",
  delay: "Prazo de entrega",
  trust: "Falta de confiança",
  doubt: "Dúvidas sobre o produto",
  none: "Nenhuma objeção",
};

const temperatureConfig: Record<string, { label: string; color: string }> = {
  hot: { label: "Quente", color: "bg-destructive text-destructive-foreground" },
  warm: { label: "Morno", color: "bg-warning text-warning-foreground" },
  cold: { label: "Frio", color: "bg-muted text-muted-foreground" },
};

const ChatPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, user, isManager, isSeller } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  const [isSimulatingResponse, setIsSimulatingResponse] = useState(false);
  const [existingSale, setExistingSale] = useState<ExistingSale | null>(null);

  // AI Customer Simulation
  const {
    isSimulating,
    triggerResponseAfterSellerMessage,
    startContinuousSimulation,
    stopContinuousSimulation,
    updateHistory,
  } = useCustomerSimulation({
    customerId: id || "",
    sellerId: user?.id || "",
    enabled: simulationEnabled,
    minDelay: 20000, // 20 seconds
    maxDelay: 60000, // 60 seconds
  });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (id && session && user) {
      fetchConversation();
    }
  }, [id, session, user, isManager, isSeller]);

  const fetchConversation = async () => {
    if (!id || !session?.access_token) return;

    setIsLoading(true);
    try {
      // Fetch customer info
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // Fetch messages for this customer
      // Managers can see all messages, sellers only see their own
      let messagesQuery = supabase
        .from("messages")
        .select("id, content, direction, timestamp")
        .eq("customer_id", id)
        .order("timestamp", { ascending: true });

      // Only filter by seller_id for sellers, managers can see all
      if (isSeller) {
        messagesQuery = messagesQuery.eq("seller_id", user?.id);
      }

      const { data: messagesData, error: messagesError } = await messagesQuery;

      if (messagesError) throw messagesError;
      
      setMessages(messagesData || []);

      // Get the latest insight if exists
      if (messagesData && messagesData.length > 0) {
        const lastIncomingMessage = [...messagesData].reverse().find(m => m.direction === "incoming");
        if (lastIncomingMessage) {
          const { data: insightData } = await supabase
            .from("insights")
            .select("*")
            .eq("message_id", lastIncomingMessage.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (insightData) {
            setAiAnalysis({
              sentiment: insightData.sentiment || "neutral",
              intention: parseInt(insightData.intention || "0"),
              objection: insightData.objection || "none",
              temperature: insightData.temperature || "cold",
              suggestion: insightData.suggestion || "",
              next_action: insightData.next_action || "",
            });
          }
        }
      }

      // Fetch existing sale for this customer
      const { data: saleData } = await supabase
        .from("sales")
        .select("id, status, reason")
        .eq("customer_id", id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (saleData) {
        setExistingSale({
          id: saleData.id,
          status: saleData.status as "won" | "lost",
          reason: saleData.reason,
        });
      } else {
        setExistingSale(null);
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
      toast.error("Erro ao carregar conversa");
    } finally {
      setIsLoading(false);
    }
  };

  const analyzeMessage = async (messageContent: string, messageId: string) => {
    setIsAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-message", {
        body: { message: messageContent, message_id: messageId },
      });

      if (error) throw error;

      setAiAnalysis(data);
      toast.success("Mensagem analisada pela IA");
    } catch (error) {
      console.error("Error analyzing message:", error);
      toast.error("Erro ao analisar mensagem");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !id || !user || isSending) return;

    const messageContent = newMessage.trim();
    setIsSending(true);
    setNewMessage("");
    
    try {
      const { data, error } = await supabase
        .from("messages")
        .insert({
          seller_id: user.id,
          customer_id: id,
          content: messageContent,
          direction: "outgoing",
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) => [...prev, data]);

      // Trigger AI customer response after seller sends a message
      if (simulationEnabled) {
        setIsSimulatingResponse(true);
        const response = await triggerResponseAfterSellerMessage(messageContent);
        if (response) {
          // Fetch the new message from the database
          const { data: newMsg } = await supabase
            .from("messages")
            .select("id, content, direction, timestamp")
            .eq("id", response.messageId)
            .single();
          
          if (newMsg) {
            setMessages((prev) => [...prev, newMsg]);
            // Trigger analysis for the new customer message
            await analyzeMessage(response.message, response.messageId);
          }
        }
        setIsSimulatingResponse(false);
      }
    } catch (error) {
      console.error("Error sending message:", error);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const simulateIncomingMessage = async () => {
    if (!id || !user || isSimulatingResponse) return;

    setIsSimulatingResponse(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Use AI to generate customer response
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-customer`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            customerId: id,
            sellerId: user.id,
            conversationHistory: messages.map(m => ({ direction: m.direction, content: m.content })),
          }),
        }
      );

      const data = await response.json();
      
      if (data.success) {
        // Fetch the new message
        const { data: newMsg } = await supabase
          .from("messages")
          .select("id, content, direction, timestamp")
          .eq("id", data.messageId)
          .single();
        
        if (newMsg) {
          setMessages((prev) => [...prev, newMsg]);
          await analyzeMessage(data.message, data.messageId);
        }
      }
    } catch (error) {
      console.error("Error simulating message:", error);
      toast.error("Erro ao simular mensagem");
    } finally {
      setIsSimulatingResponse(false);
    }
  };

  // Update simulation history when messages change
  useEffect(() => {
    updateHistory(messages.map(m => ({ direction: m.direction, content: m.content })));
  }, [messages, updateHistory]);

  const useSuggestion = () => {
    if (aiAnalysis?.suggestion) {
      setNewMessage(aiAnalysis.suggestion);
      toast.info("Sugestão aplicada");
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-[calc(100vh-3rem)] flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  const sentimentInfo = sentimentConfig[aiAnalysis?.sentiment || "neutral"] || sentimentConfig.neutral;
  const SentimentIcon = sentimentInfo.icon;
  const tempInfo = temperatureConfig[aiAnalysis?.temperature || "cold"] || temperatureConfig.cold;

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3rem)] flex gap-4">
        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-border flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/conversas")}
              className="h-8 w-8"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>

            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
              {customer ? getInitials(customer.name) : "?"}
            </div>

            <div className="flex-1">
              <h2 className="font-semibold">{customer?.name || "Cliente"}</h2>
              <p className="text-xs text-muted-foreground">
                {customer?.phone || customer?.email || "Sem contato"}
              </p>
            </div>

            {aiAnalysis && (
              <LeadTemperatureBadge 
                temperature={aiAnalysis.temperature as "hot" | "warm" | "cold"} 
                showLabel 
              />
            )}

            {/* Demo button to simulate incoming messages - Only for sellers */}
            {isSeller && (
              <Button
                variant="outline"
                size="sm"
                onClick={simulateIncomingMessage}
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Simular
              </Button>
            )}

            {/* Sale registration buttons - Only for sellers when no existing sale */}
            {isSeller && !existingSale && (
              <>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => setShowSaleModal(true)}
                  className="gap-2 bg-success hover:bg-success/90"
                >
                  <Trophy className="h-4 w-4" />
                  Venda
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSaleModal(true)}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Perda
                </Button>
              </>
            )}

            {/* Show status badge for sellers when sale exists */}
            {isSeller && existingSale && (
              <Badge className={existingSale.status === "won" ? "bg-success" : "bg-destructive"}>
                {existingSale.status === "won" ? "Venda Ganha" : "Venda Perdida"}
              </Badge>
            )}

            {/* Edit button - Only for managers when sale exists */}
            {isManager && existingSale && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaleModal(true)}
                className="gap-2"
              >
                <Trophy className="h-4 w-4" />
                Editar Status
              </Button>
            )}
          </div>

          {/* Messages Area */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mensagem ainda</p>
                    <p className="text-sm">Clique em "Simular mensagem" para testar</p>
                  </div>
                </div>
              ) : (
                messages.map((message) => (
                  <div
                    key={message.id}
                    className={cn(
                      "flex",
                      message.direction === "outgoing" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[70%] rounded-2xl px-4 py-2 shadow-sm",
                        message.direction === "outgoing"
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md"
                      )}
                    >
                      <p className="text-sm">{message.content}</p>
                      <p
                        className={cn(
                          "text-[10px] mt-1",
                          message.direction === "outgoing"
                            ? "text-primary-foreground/70"
                            : "text-muted-foreground"
                        )}
                      >
                        {format(new Date(message.timestamp), "HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input - Only for sellers */}
          {isSeller && (
            <form onSubmit={handleSendMessage} className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Digite sua mensagem..."
                  disabled={isSending}
                  className="flex-1"
                />
                <Button type="submit" disabled={isSending || !newMessage.trim()}>
                  {isSending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Insights Panel - Different for Manager vs Seller */}
        {isManager ? (
          <ManagerInsightsPanel customerId={id || ""} />
        ) : (
          <div className="w-80 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
            <div className="p-4 border-b border-border">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Insights da IA
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Análise automática em tempo real
              </p>
            </div>

            <ScrollArea className="flex-1 p-4">
              {isAnalyzing ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Analisando mensagem...</p>
                  </div>
                </div>
              ) : aiAnalysis ? (
                <div className="space-y-4">
                  {/* Sentiment */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <SentimentIcon className={cn("h-4 w-4", sentimentInfo.color)} />
                        Emoção do Cliente
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge variant="outline" className={sentimentInfo.color}>
                        {sentimentInfo.label}
                      </Badge>
                    </CardContent>
                  </Card>

                  {/* Purchase Intent */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Target className="h-4 w-4 text-primary" />
                        Intenção de Compra
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3">
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary transition-all duration-500"
                            style={{ width: `${aiAnalysis.intention}%` }}
                          />
                        </div>
                        <span className="text-sm font-semibold">{aiAnalysis.intention}%</span>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Objection */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-warning" />
                        Objeção Detectada
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge 
                        variant={aiAnalysis.objection === "none" ? "secondary" : "destructive"}
                      >
                        {objectionLabels[aiAnalysis.objection] || aiAnalysis.objection}
                      </Badge>
                    </CardContent>
                  </Card>

                  {/* Temperature */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Thermometer className="h-4 w-4 text-primary" />
                        Temperatura do Lead
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Badge className={tempInfo.color}>
                        {tempInfo.label}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Separator />

                  {/* Suggestion */}
                  <Card className="border-primary/30 bg-primary/5">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-primary" />
                        Sugestão de Resposta
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <p className="text-sm">{aiAnalysis.suggestion}</p>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={useSuggestion}
                        className="w-full gap-2"
                      >
                        <Copy className="h-4 w-4" />
                        Usar sugestão da IA
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Next Action */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        <ArrowRight className="h-4 w-4 text-success" />
                        Próxima Ação
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{aiAnalysis.next_action}</p>
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <div className="text-center">
                    <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aguardando mensagem do cliente</p>
                    <p className="text-xs mt-1">Os insights aparecerão automaticamente</p>
                  </div>
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>

      {/* Sale Registration Modal */}
      {customer && user && (
        <SaleRegistrationModal
          open={showSaleModal}
          onOpenChange={setShowSaleModal}
          customerId={customer.id}
          sellerId={existingSale ? customer.seller_id || user.id : user.id}
          customerName={customer.name}
          isEditMode={isManager && !!existingSale}
          existingSaleId={existingSale?.id}
          existingStatus={existingSale?.status}
          existingReason={existingSale?.reason || undefined}
          onSuccess={() => {
            fetchConversation();
          }}
        />
      )}
    </AppLayout>
  );
};

export default ChatPage;
