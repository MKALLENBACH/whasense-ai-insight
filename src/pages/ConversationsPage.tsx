import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ConversationList from "@/components/conversation/ConversationList";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Conversation, AIInsight, LeadTemperature } from "@/types";
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
  saleStatus: "won" | "lost" | null;
}

const ConversationsPage = () => {
  const { session } = useAuth();
  const [conversations, setConversations] = useState<Conversation[]>([]);
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
        saleStatus: conv.saleStatus || "pending",
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
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h2 className="font-semibold">Conversas</h2>
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
              selectedId={null}
              onSelect={() => {}}
              navigateToChat
            />
          ) : (
            <div className="flex-1 flex items-center justify-center p-4">
              <div className="text-center text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm">Nenhuma conversa ainda</p>
                <p className="text-xs mt-1">As conversas aparecerão aqui</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default ConversationsPage;
