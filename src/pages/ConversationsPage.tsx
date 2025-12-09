import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import ConversationList from "@/components/conversation/ConversationList";
import ChatWindow from "@/components/conversation/ChatWindow";
import AIInsightsPanel from "@/components/conversation/AIInsightsPanel";
import { mockConversations, mockMessages, mockAIInsight } from "@/data/mockData";
import { Message } from "@/types";
import { MessageSquare } from "lucide-react";

const ConversationsPage = () => {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(
    mockConversations[0]?.id || null
  );
  const [messages, setMessages] = useState<Record<string, Message[]>>(mockMessages);

  const selectedConversation = mockConversations.find((c) => c.id === selectedConversationId);
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
    // In production, this would update the backend
    console.log(`Marked conversation ${selectedConversationId} as ${status}`);
  };

  return (
    <AppLayout>
      <div className="h-[calc(100vh-3rem)] flex gap-4">
        {/* Conversation List */}
        <div className="w-80 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden">
          <ConversationList
            conversations={mockConversations}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
          />
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
          {selectedConversation ? (
            <AIInsightsPanel insight={mockAIInsight} onUseSuggestion={handleUseSuggestion} />
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
