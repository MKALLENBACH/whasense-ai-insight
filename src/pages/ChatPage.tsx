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
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";
import SaleRegistrationModal from "@/components/sale/SaleRegistrationModal";
import { useCustomerSimulation } from "@/hooks/useCustomerSimulation";
import ManagerInsightsPanel from "@/components/manager/ManagerInsightsPanel";
import NewLeadModal from "@/components/lead/NewLeadModal";
import SaleCycleHistory from "@/components/sale/SaleCycleHistory";
import CurrentCycleBadge from "@/components/sale/CurrentCycleBadge";
import { useSaleCycles } from "@/hooks/useSaleCycles";
import { ChatAlertsBanner } from "@/components/conversation/ChatAlertsBanner";
import ChatInput from "@/components/conversation/ChatInput";
import MessageBubble from "@/components/conversation/MessageBubble";
import ImageInsightsCard from "@/components/conversation/ImageInsightsCard";
import { CycleDivider } from "@/components/conversation/CycleDivider";

interface Message {
  id: string;
  content: string;
  direction: "incoming" | "outgoing";
  timestamp: string;
  cycle_id?: string | null;
  attachment_url?: string | null;
  attachment_type?: string | null;
  attachment_name?: string | null;
}

interface AIAnalysis {
  sales_stage?: string;
  sentiment: string;
  intention: number;
  objection: string;
  temperature: string;
  analysis?: string;
  suggestion: string;
  next_action: string;
}

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  seller_id: string | null;
  lead_status: string;
  is_incomplete: boolean;
  company_id: string | null;
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
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [imageInsights, setImageInsights] = useState<Array<{ imageUrl: string; data: any }>>([]);

  // Sale cycles hook
  const {
    cycles,
    activeCycle,
    isLoading: isCyclesLoading,
    closeCycle,
    updateCycleStatus,
    getCycleNumber,
    getOrCreateActiveCycle,
    fetchCycles,
  } = useSaleCycles({
    customerId: id || "",
    sellerId: user?.id,
  });

  // Current cycle to display (active or selected from history)
  const displayedCycleId = selectedCycleId || activeCycle?.id;
  const displayedCycle = selectedCycleId 
    ? cycles.find(c => c.id === selectedCycleId) 
    : activeCycle;

  // Determine if conversation is completed
  const isConversationCompleted = displayedCycle?.status === 'won' || displayedCycle?.status === 'lost';

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
    enabled: simulationEnabled && !isConversationCompleted && !isViewingHistory,
    minDelay: 20000,
    maxDelay: 60000,
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
  }, [id, session, user, isManager, isSeller, displayedCycleId]);

  const fetchConversation = async () => {
    if (!id || !session?.access_token) return;

    setIsLoading(true);
    try {
      // Fetch customer info
      const { data: customerData, error: customerError } = await supabase
        .from("customers")
        .select("*, lead_status, is_incomplete")
        .eq("id", id)
        .maybeSingle();

      if (customerError) throw customerError;
      setCustomer(customerData);

      // If customer is incomplete, show the modal
      if (customerData?.is_incomplete && isSeller) {
        setShowLeadModal(true);
      }

      // Fetch messages for this customer
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("id, content, direction, timestamp, cycle_id, attachment_url, attachment_type, attachment_name")
        .eq("customer_id", id)
        .order("timestamp", { ascending: true });
      
      const typedMessages = (messagesData as unknown as Message[]) || [];
      setMessages(typedMessages);

      // Get the latest insight if exists (only for non-completed conversations)
      if (typedMessages && typedMessages.length > 0 && !isConversationCompleted) {
        const lastIncomingMessage = [...typedMessages].reverse().find(m => m.direction === "incoming");
        if (lastIncomingMessage) {
          const { data: insightData } = await supabase
            .from("insights")
            .select("*")
            .eq("message_id", lastIncomingMessage.id)
            .eq("insight_type", "message_analysis")
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

        // Fetch image insights for messages with image attachments
        const imageMessages = typedMessages.filter(m => 
          m.attachment_type?.startsWith('image/') || 
          ['jpg', 'jpeg', 'png', 'webp', 'gif'].some(ext => m.attachment_name?.toLowerCase().endsWith(`.${ext}`))
        );
        
        if (imageMessages.length > 0) {
          const messageIds = imageMessages.map(m => m.id);
          const { data: imgInsights } = await supabase
            .from("insights")
            .select("message_id, image_analysis_data")
            .eq("insight_type", "image_analysis")
            .in("message_id", messageIds);
          
          if (imgInsights && imgInsights.length > 0) {
            const imgInsightsWithUrls = imgInsights
              .filter(ins => ins.image_analysis_data)
              .map(ins => {
                const msg = imageMessages.find(m => m.id === ins.message_id);
                return {
                  imageUrl: msg?.attachment_url || "",
                  data: ins.image_analysis_data,
                };
              });
            setImageInsights(imgInsightsWithUrls);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching conversation:", error);
      toast.error("Erro ao carregar conversa");
    } finally {
      setIsLoading(false);
    }
  };

  // Build cycle messages for AI context
  const buildCycleMessages = useCallback(() => {
    return messages.map(m => ({
      from: m.direction === "incoming" ? "client" as const : "seller" as const,
      text: m.content,
      timestamp: format(new Date(m.timestamp), "HH:mm", { locale: ptBR }),
    }));
  }, [messages]);

  const analyzeMessage = async (messageContent: string, messageId: string) => {
    if (isConversationCompleted || isViewingHistory) return;
    
    setIsAnalyzing(true);
    try {
      // Send full cycle history to AI
      const cycleMessages = buildCycleMessages();
      
      const { data, error } = await supabase.functions.invoke("analyze-message", {
        body: { 
          message: messageContent, 
          message_id: messageId,
          cycleMessages,
          companyId: user?.companyId, // Pass company ID for script lookup
        },
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
    if (!newMessage.trim() || !id || !user || isSending || isViewingHistory) return;

    const messageContent = newMessage.trim();
    setIsSending(true);
    setNewMessage("");
    
    try {
      // Get or create active cycle
      const cycle = await getOrCreateActiveCycle();
      if (!cycle) throw new Error("Failed to get or create cycle");

      // Update cycle status to in_progress if it's pending
      if (cycle.status === 'pending') {
        await updateCycleStatus(cycle.id, 'in_progress');
      }

      const { data, error } = await supabase
        .from("messages")
        .insert({
          seller_id: user.id,
          customer_id: id,
          content: messageContent,
          direction: "outgoing",
          cycle_id: cycle.id,
        })
        .select()
        .single();

      if (error) throw error;

      setMessages((prev) => [...prev, data as unknown as Message]);

      // Trigger AI customer response after seller sends a message
      if (simulationEnabled && !isConversationCompleted) {
        setIsSimulatingResponse(true);
        const response = await triggerResponseAfterSellerMessage(messageContent);
        if (response) {
          const { data: newMsg } = await supabase
            .from("messages")
            .select("id, content, direction, timestamp, cycle_id")
            .eq("id", response.messageId)
            .single();
          
          if (newMsg) {
            setMessages((prev) => [...prev, newMsg as unknown as Message]);
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

  // Handler for ChatInput component (simplified - ignores attachments since columns don't exist yet)
  const handleSendMessageWithAttachments = async (
    content: string, 
    attachments?: { url: string; type: string; name: string }[]
  ) => {
    // Allow sending if there's content OR attachments
    const hasContent = content.trim().length > 0;
    const hasAttachments = attachments && attachments.length > 0;
    if ((!hasContent && !hasAttachments) || !id || !user || isSending || isViewingHistory) return;

    setIsSending(true);
    
    try {
      const cycle = await getOrCreateActiveCycle();
      if (!cycle) throw new Error("Failed to get or create cycle");

      if (cycle.status === 'pending') {
        await updateCycleStatus(cycle.id, 'in_progress');
      }

      // Get the first attachment if any
      const attachment = attachments?.[0];
      const isImageAttachment = attachment?.type?.startsWith('image/') || 
        ['jpg', 'jpeg', 'png', 'webp', 'gif'].some(ext => attachment?.name?.toLowerCase().endsWith(`.${ext}`));

      const { data, error } = await supabase
        .from("messages")
        .insert({
          seller_id: user.id,
          customer_id: id,
          content: content.trim() || (attachment ? `[${attachment.type}: ${attachment.name}]` : ""),
          direction: "outgoing",
          cycle_id: cycle.id,
          attachment_url: attachment?.url || null,
          attachment_type: attachment?.type || null,
          attachment_name: attachment?.name || null,
        })
        .select("id, content, direction, timestamp, cycle_id, attachment_url, attachment_type, attachment_name")
        .single();

      if (error) throw error;
      setMessages((prev) => [...prev, data as unknown as Message]);

      // Trigger Vision AI analysis for image attachments
      if (isImageAttachment && attachment?.url && data?.id) {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (currentSession) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${currentSession.access_token}`,
            },
            body: JSON.stringify({
              message_id: data.id,
              image_url: attachment.url,
              sender: "seller",
            }),
          }).then(async (response) => {
            if (response.ok) {
              const result = await response.json();
              console.log("Image analysis complete:", result);
              toast.success("Imagem analisada pela Vision AI");
            } else {
              console.error("Image analysis failed:", await response.text());
            }
          }).catch(err => {
            console.error("Error calling analyze-image:", err);
          });
        }
      }

      // Trigger AI customer response
      if (simulationEnabled && !isConversationCompleted) {
        setIsSimulatingResponse(true);
        const response = await triggerResponseAfterSellerMessage(content.trim());
        if (response) {
          const { data: newMsg } = await supabase
            .from("messages")
            .select("id, content, direction, timestamp, cycle_id, attachment_url, attachment_type, attachment_name")
            .eq("id", response.messageId)
            .single();
          
          if (newMsg) {
            setMessages((prev) => [...prev, newMsg as unknown as Message]);
            
            // Check if incoming message has image attachment
            const incomingIsImage = newMsg.attachment_type?.startsWith('image/') ||
              ['jpg', 'jpeg', 'png', 'webp', 'gif'].some(ext => newMsg.attachment_name?.toLowerCase().endsWith(`.${ext}`));
            
            if (incomingIsImage && newMsg.attachment_url) {
              // Trigger Vision AI analysis for incoming image
              const { data: { session: currentSession } } = await supabase.auth.getSession();
              if (currentSession) {
                fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${currentSession.access_token}`,
                  },
                  body: JSON.stringify({
                    message_id: newMsg.id,
                    image_url: newMsg.attachment_url,
                    sender: "client",
                  }),
                }).catch(err => {
                  console.error("Error calling analyze-image for incoming:", err);
                });
              }
            }
            
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

  // Audio recording handler - uploads and analyzes seller audio
  const handleSendAudio = async (audioBlob: Blob) => {
    if (!id || !user || !customer?.company_id || isSending) return;
    
    setIsSending(true);
    
    try {
      // Ensure we have an active cycle
      const cycle = await getOrCreateActiveCycle();
      if (!cycle) {
        toast.error("Erro ao obter ciclo de venda");
        return;
      }
      
      // If cycle was pending, update to in_progress
      if (cycle.status === 'pending') {
        await updateCycleStatus(cycle.id, 'in_progress');
      }

      // Upload audio to storage
      const fileName = `audio-${Date.now()}.webm`;
      const filePath = `${customer.company_id}/${id}/${cycle.id}/${fileName}`;
      
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("message_attachments")
        .upload(filePath, audioBlob, {
          contentType: "audio/webm",
        });

      if (uploadError) {
        console.error("Audio upload error:", uploadError);
        toast.error("Erro ao fazer upload do áudio");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("message_attachments")
        .getPublicUrl(filePath);

      const audioUrl = urlData.publicUrl;

      // Create message with audio attachment
      const { data: msgData, error: msgError } = await supabase
        .from("messages")
        .insert({
          seller_id: user.id,
          customer_id: id,
          content: "[Áudio - processando transcrição...]",
          direction: "outgoing",
          cycle_id: cycle.id,
          attachment_url: audioUrl,
          attachment_type: "audio",
          attachment_name: fileName,
        })
        .select("id, content, direction, timestamp, cycle_id, attachment_url, attachment_type, attachment_name")
        .single();

      if (msgError) {
        console.error("Message creation error:", msgError);
        toast.error("Erro ao salvar mensagem de áudio");
        return;
      }

      setMessages(prev => [...prev, msgData]);

      // Call analyze-audio edge function
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada");
        return;
      }

      fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-audio`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          audio_url: audioUrl,
          message_id: msgData.id,
          sender: "seller",
        }),
      }).then(async (response) => {
        if (response.ok) {
          const result = await response.json();
          if (result.transcription) {
            // Update the message in state with transcription
            setMessages(prev => prev.map(m => 
              m.id === msgData.id 
                ? { ...m, content: result.transcription }
                : m
            ));
          }
        } else {
          console.error("Audio analysis failed:", await response.text());
        }
      }).catch(err => {
        console.error("Error calling analyze-audio:", err);
      });

      toast.success("Áudio enviado!");
    } catch (error) {
      console.error("Error sending audio:", error);
      toast.error("Erro ao enviar áudio");
    } finally {
      setIsSending(false);
    }
  };

  const simulateIncomingMessage = async () => {
    if (!id || !user || isSimulatingResponse || isConversationCompleted || isViewingHistory) return;

    setIsSimulatingResponse(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

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
        const { data: newMsg } = await supabase
          .from("messages")
          .select("id, content, direction, timestamp, cycle_id")
          .eq("id", data.messageId)
          .single();
        
        if (newMsg) {
          setMessages((prev) => [...prev, newMsg]);
          await analyzeMessage(data.message, data.messageId);
        }
        // Refresh cycles to get the new one if created
        await fetchCycles();
      }
    } catch (error) {
      console.error("Error simulating message:", error);
      toast.error("Erro ao simular mensagem");
    } finally {
      setIsSimulatingResponse(false);
    }
  };

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

  const handleSelectCycle = (cycleId: string) => {
    if (cycleId === activeCycle?.id) {
      setSelectedCycleId(null);
      setIsViewingHistory(false);
    } else {
      setSelectedCycleId(cycleId);
      setIsViewingHistory(true);
    }
  };

  const handleBackToCurrentCycle = () => {
    setSelectedCycleId(null);
    setIsViewingHistory(false);
  };

  if (isLoading || isCyclesLoading) {
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
  const currentCycleNumber = displayedCycle ? getCycleNumber(displayedCycle.id) : 1;

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

            <div className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold",
              customer?.is_incomplete 
                ? "bg-orange-500/10 text-orange-500" 
                : "bg-primary/10 text-primary"
            )}>
              {customer ? getInitials(customer.name) : "?"}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">{customer?.name || "Cliente"}</h2>
                {customer?.is_incomplete && (
                  <Badge 
                    variant="outline" 
                    className="text-[10px] px-1.5 py-0 border-orange-500 bg-orange-500/10 text-orange-500 cursor-pointer"
                    onClick={() => setShowLeadModal(true)}
                  >
                    <AlertCircle className="h-3 w-3 mr-1" />
                    Completar dados
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {customer?.phone || customer?.email || "Sem contato"}
              </p>
            </div>

            {/* Current Cycle Badge */}
            {displayedCycle && (
              <CurrentCycleBadge
                cycleNumber={currentCycleNumber}
                status={displayedCycle.status as "pending" | "in_progress" | "won" | "lost"}
              />
            )}

            {/* Viewing history indicator */}
            {isViewingHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleBackToCurrentCycle}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar ao atual
              </Button>
            )}

            {/* Temperature badge - only for active conversations */}
            {!isConversationCompleted && !isViewingHistory && aiAnalysis && (
              <LeadTemperatureBadge 
                temperature={aiAnalysis.temperature as "hot" | "warm" | "cold"} 
                showLabel 
              />
            )}

            {/* Demo button to simulate incoming messages - Only for sellers on active conversations */}
            {isSeller && !isConversationCompleted && !isViewingHistory && (
              <Button
                variant="outline"
                size="sm"
                onClick={simulateIncomingMessage}
                className="gap-2"
                disabled={isSimulatingResponse}
              >
                <RefreshCw className={cn("h-4 w-4", isSimulatingResponse && "animate-spin")} />
                Simular
              </Button>
            )}

            {/* Sale registration buttons - Only for sellers when cycle is active */}
            {isSeller && activeCycle && !isConversationCompleted && !isViewingHistory && (
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
          </div>

          {/* Alerts Banner - Only for active conversations */}
          {isSeller && !isConversationCompleted && !isViewingHistory && (
            <ChatAlertsBanner 
              customerId={id || ""} 
              cycleId={displayedCycleId} 
            />
          )}

          {/* Messages Area - Grouped by Cycle */}
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-2">
              {messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center">
                    <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma mensagem {isViewingHistory ? "neste ciclo" : "ainda"}</p>
                    {!isViewingHistory && <p className="text-sm">Clique em "Simular" para testar</p>}
                  </div>
                </div>
              ) : (
                (() => {
                  // Group messages by cycle for visual separation
                  const cyclesWithMessages = cycles
                    .filter(c => messages.some(m => m.cycle_id === c.id))
                    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
                  
                  return cyclesWithMessages.map((cycle) => {
                    const cycleMessages = messages.filter(m => m.cycle_id === cycle.id);
                    const cycleNum = getCycleNumber(cycle.id);
                    
                    return (
                      <div key={cycle.id}>
                        <CycleDivider
                          cycleNumber={cycleNum}
                          status={cycle.status as "pending" | "in_progress" | "won" | "lost"}
                          startDate={cycle.start_message_timestamp || cycle.created_at}
                          endDate={cycle.closed_at}
                        />
                        <div className="space-y-4">
                          {cycleMessages.map((message) => (
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
                      </div>
                    );
                  });
                })()
              )}
              <div ref={messagesEndRef} />
            </div>
          </ScrollArea>

          {/* Message Input - Only for sellers on active conversations */}
          {isSeller && !isConversationCompleted && !isViewingHistory && activeCycle && (
            <ChatInput
              onSendMessage={handleSendMessageWithAttachments}
              onSendAudio={handleSendAudio}
              disabled={isSending}
              companyId={user?.companyId}
              customerId={id || ""}
              cycleId={activeCycle.id}
              initialMessage={newMessage}
              onMessageChange={setNewMessage}
            />
          )}

          {/* Read-only message for completed/history conversations */}
          {(isConversationCompleted || isViewingHistory) && (
            <div className="p-4 border-t border-border bg-muted/50">
              <p className="text-sm text-muted-foreground text-center">
                {isViewingHistory 
                  ? "Você está visualizando um ciclo anterior. Volte ao ciclo atual para enviar mensagens."
                  : "Este ciclo foi encerrado. Não é possível enviar novas mensagens."}
              </p>
            </div>
          )}
        </div>

        {/* Right Panel */}
        <div className="w-80 flex-shrink-0 flex flex-col gap-4">
          {/* Cycle History */}
          {cycles.length > 0 && (
            <SaleCycleHistory
              cycles={cycles}
              activeCycleId={activeCycle?.id || null}
              onSelectCycle={handleSelectCycle}
            />
          )}

          {/* Insights Panel - Different for Manager vs Seller */}
          {isManager ? (
            <ManagerInsightsPanel customerId={id || ""} />
          ) : !isConversationCompleted && !isViewingHistory ? (
            <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
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

                    {/* Image Insights */}
                    {imageInsights.length > 0 && (
                      <div className="space-y-2">
                        <Separator />
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          📷 Análises de Imagens
                        </h4>
                        {imageInsights.slice(-3).map((img, idx) => (
                          <ImageInsightsCard
                            key={idx}
                            imageUrl={img.imageUrl}
                            analysisData={img.data}
                            isSeller={img.data?.detected_type === "seller"}
                          />
                        ))}
                      </div>
                    )}
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
          ) : (
            // Static panel for completed conversations (seller view)
            <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
              <div className="p-4 border-b border-border">
                <h3 className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  {isViewingHistory ? "Ciclo Anterior" : "Ciclo Encerrado"}
                </h3>
              </div>
              <div className="flex-1 flex items-center justify-center p-4">
                <div className="text-center">
                  <Badge className={cn(
                    "text-lg px-4 py-2",
                    displayedCycle?.status === "won" ? "bg-success" : "bg-destructive"
                  )}>
                    {displayedCycle?.status === "won" ? "Venda Ganha" : "Venda Perdida"}
                  </Badge>
                  {displayedCycle?.lost_reason && (
                    <p className="text-sm text-muted-foreground mt-4">
                      Motivo: {displayedCycle.lost_reason}
                    </p>
                  )}
                  {displayedCycle?.won_summary && (
                    <p className="text-sm text-success mt-4">
                      {displayedCycle.won_summary}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sale Registration Modal - Now closes cycles */}
      {customer && user && activeCycle && (
        <SaleRegistrationModal
          open={showSaleModal}
          onOpenChange={setShowSaleModal}
          customerId={customer.id}
          sellerId={user.id}
          customerName={customer.name}
          cycleId={activeCycle.id}
          onSuccess={async (status, reason, summary) => {
            await closeCycle(activeCycle.id, status, reason, summary);
            fetchConversation();
          }}
        />
      )}

      {/* Lead Modal for incomplete leads */}
      {customer && (
        <NewLeadModal
          open={showLeadModal}
          onOpenChange={setShowLeadModal}
          phoneNumber={customer.phone || ""}
          customerId={customer.id}
          isEditMode={true}
          existingData={{
            name: customer.name,
            email: customer.email,
            companyId: null,
          }}
          onSuccess={() => {
            fetchConversation();
          }}
        />
      )}
    </AppLayout>
  );
};

export default ChatPage;
