import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserPlus, Clock, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface InboxPaiLead {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  };
  lastMessage: string;
  lastMessageTime: string;
  messageCount: number;
  waitingTime: string;
}

interface InboxPaiCardProps {
  lead: InboxPaiLead;
  onPullLead: (customerId: string) => Promise<void>;
  isPulling?: boolean;
}

const InboxPaiCard = ({ lead, onPullLead, isPulling }: InboxPaiCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handlePull = async () => {
    setIsLoading(true);
    try {
      await onPullLead(lead.customer.id);
    } finally {
      setIsLoading(false);
    }
  };

  const timeAgo = formatDistanceToNow(new Date(lead.lastMessageTime), {
    addSuffix: true,
    locale: ptBR,
  });

  return (
    <div className="flex items-center justify-between p-4 border-b border-border hover:bg-accent/50 transition-colors">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-medium truncate">{lead.customer.name}</h3>
          <Badge variant="outline" className="text-xs">
            <Clock className="h-3 w-3 mr-1" />
            {lead.waitingTime}
          </Badge>
        </div>
        
        {lead.customer.phone && (
          <p className="text-sm text-muted-foreground mb-1">
            {lead.customer.phone}
          </p>
        )}
        
        <p className="text-sm text-muted-foreground truncate">
          {lead.lastMessage}
        </p>
        
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <MessageSquare className="h-3 w-3" />
            {lead.messageCount} mensagem{lead.messageCount !== 1 ? 's' : ''}
          </span>
          <span>{timeAgo}</span>
        </div>
      </div>

      <Button
        size="sm"
        onClick={handlePull}
        disabled={isLoading || isPulling}
        className="ml-4 shrink-0"
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <UserPlus className="h-4 w-4 mr-2" />
        )}
        Puxar Lead
      </Button>
    </div>
  );
};

export default InboxPaiCard;