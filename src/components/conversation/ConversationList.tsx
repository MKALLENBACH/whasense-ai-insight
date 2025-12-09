import { Conversation } from "@/types";
import { cn } from "@/lib/utils";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CheckCircle2, XCircle, AlertTriangle, Frown, Smile, Meh, Angry, HelpCircle, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface ConversationListProps {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  navigateToChat?: boolean;
}

const sentimentConfig: Record<string, { icon: typeof Smile; label: string; className: string }> = {
  positive: { icon: Smile, label: "Positivo", className: "text-success" },
  excited: { icon: Sparkles, label: "Empolgado", className: "text-success" },
  neutral: { icon: Meh, label: "Neutro", className: "text-muted-foreground" },
  negative: { icon: Frown, label: "Negativo", className: "text-warning" },
  angry: { icon: Angry, label: "Irritado", className: "text-destructive" },
  insecure: { icon: HelpCircle, label: "Inseguro", className: "text-warning" },
};

const objectionLabels: Record<string, string> = {
  price: "Preço",
  delay: "Prazo",
  trust: "Confiança",
  doubt: "Dúvida",
  none: "",
};

const ConversationList = ({ conversations, selectedId, onSelect, navigateToChat = false }: ConversationListProps) => {
  const navigate = useNavigate();
  
  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const hasRisk = (conversation: Conversation): boolean => {
    const sentiment = conversation.aiInsight?.emotion;
    const objection = conversation.aiInsight?.objections?.[0];
    return sentiment === "angry" || sentiment === "negative" || (objection !== undefined && objection !== "none");
  };

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conversation) => {
        const sentiment = conversation.aiInsight?.emotion || "neutral";
        const sentimentInfo = sentimentConfig[sentiment] || sentimentConfig.neutral;
        const SentimentIcon = sentimentInfo.icon;
        const objection = conversation.aiInsight?.objections?.[0];
        const showRisk = hasRisk(conversation);

        return (
          <button
            key={conversation.id}
            onClick={() => {
              onSelect(conversation.id);
              if (navigateToChat) {
                navigate(`/chat/${conversation.id}`);
              }
            }}
            className={cn(
              "w-full p-3 flex items-start gap-3 text-left transition-all duration-200 hover:bg-muted/50 border-b border-border/50",
              selectedId === conversation.id && "bg-primary/5 border-l-2 border-l-primary"
            )}
          >
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                {getInitials(conversation.contact.name)}
              </div>
              <div className="absolute -bottom-0.5 -right-0.5">
                <LeadTemperatureBadge temperature={conversation.leadTemperature} showLabel={false} />
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <span className="font-medium text-sm truncate">{conversation.contact.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">
                  {formatDistanceToNow(conversation.lastMessageTime, {
                    addSuffix: false,
                    locale: ptBR,
                  })}
                </span>
              </div>

              <p className="text-xs text-muted-foreground truncate mb-1.5">{conversation.lastMessage}</p>

              {/* Insight badges */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Sentiment */}
                <div className={cn("flex items-center gap-1", sentimentInfo.className)}>
                  <SentimentIcon className="h-3 w-3" />
                  <span className="text-[10px] font-medium">{sentimentInfo.label}</span>
                </div>

                {/* Objection */}
                {objection && objection !== "none" && objectionLabels[objection] && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 bg-warning/10 text-warning border-warning/30">
                    {objectionLabels[objection]}
                  </Badge>
                )}

                {/* Risk alert */}
                {showRisk && (
                  <div className="flex items-center gap-0.5 text-destructive">
                    <AlertTriangle className="h-3 w-3" />
                  </div>
                )}
              </div>
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
        );
      })}
    </div>
  );
};

export default ConversationList;
