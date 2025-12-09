import { Conversation } from "@/types";
import { cn } from "@/lib/utils";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle } from "lucide-react";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const ConversationList = ({ conversations, selectedId, onSelect }: ConversationListProps) => {
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold">Conversas</h2>
        <p className="text-sm text-muted-foreground">{conversations.length} contatos ativos</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        {conversations.map((conversation) => (
          <button
            key={conversation.id}
            onClick={() => onSelect(conversation.id)}
            className={cn(
              "w-full p-4 flex items-start gap-3 text-left transition-all duration-200 hover:bg-muted/50 border-b border-border/50",
              selectedId === conversation.id && "bg-primary/5 border-l-2 border-l-primary"
            )}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {getInitials(conversation.contact.name)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5">
                <LeadTemperatureBadge temperature={conversation.leadTemperature} showLabel={false} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="font-medium truncate">{conversation.contact.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(conversation.lastMessageTime, {
                    addSuffix: false,
                    locale: ptBR,
                  })}
                </span>
              </div>

              {conversation.contact.company && (
                <p className="text-xs text-muted-foreground mb-1">{conversation.contact.company}</p>
              )}

              <p className="text-sm text-muted-foreground truncate">{conversation.lastMessage}</p>
            </div>

            {/* Status indicators */}
            <div className="flex flex-col items-end gap-1">
              {conversation.unreadCount > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {conversation.unreadCount}
                </span>
              )}
              {conversation.saleStatus === "won" && (
                <CheckCircle2 className="h-4 w-4 text-success" />
              )}
              {conversation.saleStatus === "lost" && (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default ConversationList;
