import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction, fetchWithAuth } from "@/lib/supabaseApi";
import { useAuth } from "@/contexts/AuthContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import SaleRegistrationModal from "@/components/sale/SaleRegistrationModal";
import { useCustomerSimulation } from "@/hooks/useCustomerSimulation";
import ManagerInsightsPanel from "@/components/manager/ManagerInsightsPanel";
import NewLeadModal from "@/components/lead/NewLeadModal";
import SaleCycleHistory from "@/components/sale/SaleCycleHistory";
import { useSaleCycles } from "@/hooks/useSaleCycles";
import { ChatAlertsBanner } from "@/components/conversation/ChatAlertsBanner";
import ChatInput from "@/components/conversation/ChatInput";
import MessageBubble from "@/components/conversation/MessageBubble";
import { CycleDivider } from "@/components/conversation/CycleDivider";
import ChatHeader from "@/components/chat/ChatHeader";
import SellerAIInsightsPanel, { AIAnalysis } from "@/components/chat/SellerAIInsightsPanel";
import CompletedCyclePanel from "@/components/chat/CompletedCyclePanel";
import ReassignLeadModal from "@/components/chat/ReassignLeadModal";

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

interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  seller_id: string | null;
  assigned_to: string | null;
  lead_status: string;
  is_incomplete: boolean;
  company_id: string | null;
}

const ChatPage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { session, user, isManager, isSeller } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const cycleRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [showSaleModal, setShowSaleModal] = useState(false);
  const [saleModalInitialTab, setSaleModalInitialTab] = useState<"won" | "lost">("won");
  const [simulationEnabled, setSimulationEnabled] = useState(true);
  const [isSimulatingResponse, setIsSimulatingResponse] = useState(false);
  const [showLeadModal, setShowLeadModal] = useState(false);
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null);
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [imageInsights, setImageInsights] = useState<Array<{ imageUrl: string; data: any }>>([]);
  const [isReturningToInbox, setIsReturningToInbox] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
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
    markAsPostSale,
    closePostSaleCycle,
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
  const isConversationCompleted = displayedCycle?.status === 'won' || displayedCycle?.status === 'lost' || (displayedCycle as any)?.status === 'closed';
  
  // Check if current cycle is post-sale
  const isPostSaleCycle = (displayedCycle as any)?.cycle_type === 'post_sale';

  // AI Customer Simulation
  const {
    triggerResponseAfterSellerMessage,
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

  // Scroll to bottom when new messages arrive (only if not viewing history)
  useEffect(() => {
    if (!selectedCycleId) {
      scrollToBottom();
    }
  }, [messages, selectedCycleId]);

  // Scroll to selected cycle when it changes
  useEffect(() => {
    if (selectedCycleId) {
      requestAnimationFrame(() => {
        const cycleElement = cycleRefs.current.get(selectedCycleId);
        if (cycleElement) {
          cycleElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }
  }, [selectedCycleId]);

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

      // Fetch messages for this customer with pagination (last 100 messages for performance)
      const { data: messagesData, error: messagesError } = await supabase
        .from("messages")
        .select("id, content, direction, timestamp, cycle_id, attachment_url, attachment_type, attachment_name")
        .eq("customer_id", id)
        .order("timestamp", { ascending: false })
        .limit(100);
      
      // Reverse to show in chronological order
      const typedMessages = ((messagesData as unknown as Message[]) || []).reverse();
      setMessages(typedMessages);

      // Get the latest insight if exists
      if (typedMessages && typedMessages.length > 0 && !isConversationCompleted) {
        const lastIncomingMessage = [...typedMessages].reverse().find(m => m.direction === "incoming");
        if (lastIncomingMessage) {
          const { data: insightData } = await supabase
            .from("insights")
            .select("*")
            .eq("message_id", lastIncomingMessage.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (insightData && insightData.suggestion) {
            setAiAnalysis({
              sentiment: insightData.sentiment || "neutral",
              intention: parseInt(insightData.intention || "0"),
              objection: insightData.objection || "none",
              temperature: insightData.temperature || "cold",
              suggestion: insightData.suggestion || "",
              next_action: insightData.next_action || "",
            });
          } else {
            analyzeMessage(lastIncomingMessage.content, lastIncomingMessage.id);
          }
        }
      }

      // Fetch image insights for messages with image attachments
      if (typedMessages && typedMessages.length > 0) {
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
      const cycleMessages = buildCycleMessages();
      
      const { data, error } = await invokeFunction<AIAnalysis>("analyze-message", {
        body: { 
          message: messageContent, 
          message_id: messageId,
          cycleMessages,
          companyId: user?.companyId,
          cycleType: isPostSaleCycle ? "post_sale" : "pre_sale",
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

  // Handler for ChatInput component
  const handleSendMessageWithAttachments = async (
    content: string, 
    attachments?: { url: string; type: string; name: string }[]
  ) => {
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
        fetchWithAuth(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
          method: "POST",
          body: JSON.stringify({
            message_id: data.id,
            image_url: attachment.url,
            sender: "seller",
          }),
        }).then(({ error: analysisError }) => {
          if (!analysisError) {
            toast.success("Imagem analisada pela Vision AI");
          }
        }).catch(err => {
          console.error("Error calling analyze-image:", err);
        });
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
            .maybeSingle();
          
          if (newMsg) {
            setMessages((prev) => [...prev, newMsg as unknown as Message]);
            
            const incomingIsImage = newMsg.attachment_type?.startsWith('image/') ||
              ['jpg', 'jpeg', 'png', 'webp', 'gif'].some(ext => newMsg.attachment_name?.toLowerCase().endsWith(`.${ext}`));
            
            if (incomingIsImage && newMsg.attachment_url) {
              fetchWithAuth(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-image`, {
                method: "POST",
                body: JSON.stringify({
                  message_id: newMsg.id,
                  image_url: newMsg.attachment_url,
                  sender: "client",
                }),
              }).catch(err => {
                console.error("Error calling analyze-image for incoming:", err);
              });
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

  // Audio recording handler
  const handleSendAudio = async (audioBlob: Blob) => {
    if (!id || !user || !customer?.company_id || isSending) return;
    
    setIsSending(true);
    
    try {
      const cycle = await getOrCreateActiveCycle();
      if (!cycle) {
        toast.error("Erro ao obter ciclo de venda");
        return;
      }
      
      if (cycle.status === 'pending') {
        await updateCycleStatus(cycle.id, 'in_progress');
      }

      const fileName = `audio-${Date.now()}.webm`;
      const filePath = `${customer.company_id}/${id}/${cycle.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from("message_attachments")
        .upload(filePath, audioBlob, {
          contentType: "audio/webm",
        });

      if (uploadError) {
        toast.error("Erro ao fazer upload do áudio");
        return;
      }

      const { data: urlData } = supabase.storage
        .from("message_attachments")
        .getPublicUrl(filePath);

      const audioUrl = urlData.publicUrl;

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
        toast.error("Erro ao salvar mensagem de áudio");
        return;
      }

      setMessages(prev => [...prev, msgData]);

      fetchWithAuth<{ transcription: string }>(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-audio`, {
        method: "POST",
        body: JSON.stringify({
          audio_url: audioUrl,
          message_id: msgData.id,
          sender: "seller",
        }),
      }).then(({ data: result, error: analysisError }) => {
        if (!analysisError && result?.transcription) {
          setMessages(prev => prev.map(m => 
            m.id === msgData.id 
              ? { ...m, content: result.transcription }
              : m
          ));
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
      const { data, error } = await fetchWithAuth<{ success: boolean; message: string; messageId: string }>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-customer`,
        {
          method: 'POST',
          body: JSON.stringify({
            customerId: id,
            sellerId: user.id,
            conversationHistory: messages.map(m => ({ direction: m.direction, content: m.content })),
          }),
        }
      );

      if (error) throw error;
      
      if (data?.success) {
        const { data: newMsg } = await supabase
          .from("messages")
          .select("id, content, direction, timestamp, cycle_id")
          .eq("id", data.messageId)
          .maybeSingle();
        
        if (newMsg) {
          setMessages((prev) => [...prev, newMsg]);
          await analyzeMessage(data.message, data.messageId);
        }
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

  // Manager: Return lead to Inbox Pai
  const handleReturnToInbox = async () => {
    if (!id || !isManager || !customer?.assigned_to) return;
    
    setIsReturningToInbox(true);
    try {
      // 1. Close current active cycles with "relocated" status
      const { data: activeCycles } = await supabase
        .from("sale_cycles")
        .select("id")
        .eq("customer_id", id)
        .in("status", ["pending", "in_progress"]);

      if (activeCycles && activeCycles.length > 0) {
        for (const cycle of activeCycles) {
          await supabase
            .from("sale_cycles")
            .update({ 
              status: "relocated" as any,
              closed_at: new Date().toISOString()
            })
            .eq("id", cycle.id);
        }
      }

      // 2. Update customer - remove assignment and reset status
      const { error } = await supabase
        .from("customers")
        .update({ 
          assigned_to: null,
          seller_id: null,
          lead_status: "pending"
        })
        .eq("id", id);
      
      if (error) throw error;
      
      toast.success("Lead devolvido ao Inbox Pai");
      navigate("/inbox");
    } catch (error) {
      console.error("Error returning to inbox:", error);
      toast.error("Erro ao devolver lead");
    } finally {
      setIsReturningToInbox(false);
    }
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

  const currentCycleNumber = displayedCycle ? getCycleNumber(displayedCycle.id) : 1;

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3rem)] flex gap-4 overflow-hidden">
        {/* Main Chat Area */}
        <div className="flex-1 min-w-0 flex flex-col bg-card rounded-lg border border-border overflow-hidden">
          {/* Chat Header */}
          <ChatHeader
            customerName={customer?.name || "Cliente"}
            customerPhone={customer?.phone}
            customerEmail={customer?.email}
            isIncomplete={customer?.is_incomplete}
            onBack={() => navigate("/conversas")}
            onShowLeadModal={() => setShowLeadModal(true)}
            cycleNumber={currentCycleNumber}
            cycleStatus={displayedCycle?.status as any}
            cycleType={(displayedCycle as any)?.cycle_type}
            isViewingHistory={isViewingHistory}
            onBackToCurrentCycle={handleBackToCurrentCycle}
            temperature={aiAnalysis?.temperature as any}
            showTemperature={!isConversationCompleted && !isViewingHistory && !!aiAnalysis}
            isSeller={isSeller}
            isManager={isManager}
            isConversationCompleted={isConversationCompleted}
            isPostSaleCycle={isPostSaleCycle}
            isSimulatingResponse={isSimulatingResponse}
            onSimulate={simulateIncomingMessage}
            onRegisterWon={() => {
              setSaleModalInitialTab("won");
              setShowSaleModal(true);
            }}
            onRegisterLost={() => {
              setSaleModalInitialTab("lost");
              setShowSaleModal(true);
            }}
            onMarkPostSale={async () => {
              if (activeCycle) {
                try {
                  await markAsPostSale(activeCycle.id);
                  toast.success("Ciclo marcado como pós-venda");
                  await fetchCycles();
                } catch (error) {
                  toast.error("Erro ao marcar como pós-venda");
                }
              }
            }}
            onClosePostSale={async () => {
              if (activeCycle) {
                try {
                  await closePostSaleCycle(activeCycle.id);
                  toast.success("Atendimento pós-venda concluído");
                  await fetchCycles();
                } catch (error) {
                  toast.error("Erro ao concluir pós-venda");
                }
              }
            }}
            isLeadAssigned={!!customer?.assigned_to}
            onReturnToInbox={handleReturnToInbox}
            isReturningToInbox={isReturningToInbox}
            onReassign={() => setShowReassignModal(true)}
          />

          {/* Alerts Banner */}
          {isSeller && !isConversationCompleted && !isViewingHistory && (
            <ChatAlertsBanner 
              customerId={id || ""} 
              cycleId={displayedCycleId} 
            />
          )}

          {/* Messages Area */}
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
                  const cyclesWithMessages = cycles
                    .filter(c => messages.some(m => m.cycle_id === c.id))
                    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
                  
                  return cyclesWithMessages.map((cycle) => {
                    const cycleMessages = messages.filter(m => m.cycle_id === cycle.id);
                    const cycleNum = getCycleNumber(cycle.id);
                    
                    return (
                      <div 
                        key={cycle.id} 
                        ref={(el) => {
                          if (el) cycleRefs.current.set(cycle.id, el);
                        }}
                      >
                        <CycleDivider
                          cycleNumber={cycleNum}
                          status={cycle.status as any}
                          startDate={cycle.start_message_timestamp || cycle.created_at}
                          endDate={cycle.closed_at}
                          cycleType={(cycle as any).cycle_type}
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

          {/* Message Input */}
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
        <div className="w-80 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* Cycle History */}
          {cycles.length > 0 && (
            <SaleCycleHistory
              cycles={cycles}
              activeCycleId={activeCycle?.id || null}
              onSelectCycle={handleSelectCycle}
            />
          )}

          {/* Insights Panel */}
          {isManager ? (
            <ManagerInsightsPanel customerId={id || ""} />
          ) : !isConversationCompleted && !isViewingHistory ? (
            <SellerAIInsightsPanel
              isAnalyzing={isAnalyzing}
              aiAnalysis={aiAnalysis}
              imageInsights={imageInsights}
              onUseSuggestion={useSuggestion}
            />
          ) : (
            <CompletedCyclePanel
              isViewingHistory={isViewingHistory}
              status={displayedCycle?.status as any}
              lostReason={displayedCycle?.lost_reason}
              wonSummary={displayedCycle?.won_summary}
            />
          )}
        </div>
      </div>

      {/* Sale Registration Modal */}
      {customer && user && activeCycle && (
        <SaleRegistrationModal
          open={showSaleModal}
          onOpenChange={setShowSaleModal}
          customerId={customer.id}
          sellerId={user.id}
          customerName={customer.name}
          cycleId={activeCycle.id}
          initialTab={saleModalInitialTab}
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

      {/* Reassign Lead Modal for managers */}
      {customer && user?.companyId && (
        <ReassignLeadModal
          open={showReassignModal}
          onOpenChange={setShowReassignModal}
          customerId={customer.id}
          currentAssignedTo={customer.assigned_to}
          companyId={user.companyId}
          onSuccess={() => {
            fetchConversation();
            toast.success("Lead realocado com sucesso");
          }}
        />
      )}
    </AppLayout>
  );
};

export default ChatPage;
