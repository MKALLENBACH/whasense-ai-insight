import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ConversationList from "@/components/conversation/ConversationList";
import ChatWindow from "@/components/conversation/ChatWindow";
import AIInsightsPanel from "@/components/conversation/AIInsightsPanel";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Message, Conversation, AIInsight, LeadTemperature } from "@/types";
import { MessageSquare, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface ConversationData {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  lastMessage: string;
  lastMessageTime: string;
  lastMessageDirection: string;
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
}

const ConversationsPage = () => {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Record<string, Message[]>>({});
  const [insights, setInsights] = useState<Record<string, AIInsight>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchConversations = async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke('list-conversations', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;

      const conversationsData: ConversationData[] = data?.conversations || [];

      // Transform to app format
      const transformedConversations: Conversation[] = conversationsData.map((conv) => ({
        id: conv.id,
        contact: {
          id: conv.customer.id,
          name: conv.customer.name,
          phone: conv.customer.phone || "",
          avatar: undefined,
          company: undefined,
        },
        lastMessage: conv.lastMessage,
        lastMessageTime: new Date(conv.lastMessageTime),
        unreadCount: 0,
        leadTemperature: (conv.insight?.temperature as LeadTemperature) || "cold",
        saleStatus: "pending",
        assignedTo: "",
        aiInsight: conv.insight ? {
          emotion: conv.insight.sentiment,
          emotionScore: parseInt(conv.insight.intention) || 0,
          purchaseIntent: parseInt(conv.insight.intention) || 0,
          objections: conv.insight.objection !== "none" ? [conv.insight.objection] : [],
          suggestedResponses: conv.insight.suggestion ? [conv.insight.suggestion] : [],
          leadTemperature: (conv.insight.temperature as LeadTemperature) || "cold",
          keyTopics: [],
        } : undefined,
      }));

      setConversations(transformedConversations);

      // Build insights map
      const insightsMap: Record<string, AIInsight> = {};
      conversationsData.forEach((conv) => {
        if (conv.insight) {
          insightsMap[conv.id] = {
            emotion: conv.insight.sentiment,
            emotionScore: parseInt(conv.insight.intention) || 0,
            purchaseIntent: parseInt(conv.insight.intention) || 0,
            objections: conv.insight.objection !== "none" ? [conv.insight.objection] : [],
            suggestedResponses: conv.insight.suggestion ? [conv.insight.suggestion] : [],
            leadTemperature: (conv.insight.temperature as LeadTemperature) || "cold",
            keyTopics: [],
          };
        }
      });
      setInsights(insightsMap);

      // Select first conversation if none selected
      if (transformedConversations.length > 0 && !selectedConversationId) {
        setSelectedConversationId(transformedConversations[0].id);
      }

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

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchConversations();
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);
  const conversationMessages = selectedConversationId ? messages[selectedConversationId] || [] : [];

  const handleSendMessage = (content: string) => {
    if (!selectedConversationId) return;

    const newMessage: Message = {
      id: `m${Date.now()}`,
      conversationId: selectedConversationId,
      content,
      sender: "user",
      timestamp: new Date(),
      isRead: true,
    };

    setMessages((prev) => ({
      ...prev,
      [selectedConversationId]: [...(prev[selectedConversationId] || []), newMessage],
    }));
  };

  const handleUseSuggestion = (suggestion: string) => {
    handleSendMessage(suggestion);
  };

  const handleMarkSale = (status: "won" | "lost") => {
    console.log(`Marked conversation ${selectedConversationId} as ${status}`);
    toast.success(`Venda marcada como ${status === "won" ? "ganha" : "perdida"}`);
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
      <div className="h-[calc(100vh-3rem)] flex gap-4">
        {/* Conversation List */}
        <div className="w-80 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold text-sm">Conversas</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
          {conversations.length > 0 ? (
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversationId}
              onSelect={setSelectedConversationId}
              navigateToChat
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">As conversas aparecerão aqui</p>
              </div>
            </div>
          )}
        </div>

        {/* Chat Window */}
        <div className="flex-1 min-w-0">
          {selectedConversation ? (
            <ChatWindow
              conversation={selectedConversation}
              messages={conversationMessages}
              onSendMessage={handleSendMessage}
              onMarkSale={handleMarkSale}
            />
          ) : (
            <div className="h-full flex items-center justify-center bg-card rounded-lg border border-border">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Selecione uma conversa para começar</p>
              </div>
            </div>
          )}
        </div>

        {/* AI Insights Panel */}
        <div className="w-80 flex-shrink-0">
          {selectedConversation && selectedConversationId && insights[selectedConversationId] ? (
            <AIInsightsPanel 
              insight={insights[selectedConversationId]} 
              onUseSuggestion={handleUseSuggestion} 
            />
          ) : (
            <div className="h-full bg-card rounded-lg border border-border flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Insights aparecerão aqui</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ConversationsPage;
