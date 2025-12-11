import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Flame, 
  ThermometerSun, 
  Snowflake,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  AlertCircle,
  User,
  Building2,
  UserPlus,
  Inbox,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

export interface AlertData {
  id: string;
  customer_id: string;
  alert_type: string;
  severity: string;
  message: string;
}

export interface ConversationData {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    lead_status: string;
    is_incomplete: boolean;
    companyName: string | null;
  };
  lastMessage: string;
  lastMessageTime: string;
  lastMessageDirection: string;
  sellerId?: string;
  sellerName?: string;
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
  cycleStatus?: string;
  cycleId?: string | null;
  cycleLostReason?: string | null;
  cycleWonSummary?: string | null;
  saleStatus?: "won" | "lost" | null;
  saleReason?: string | null;
  leadStatus: string;
  isIncomplete: boolean;
  cycleType?: "pre_sale" | "post_sale";
}

export const temperatureConfig = {
  hot: { icon: Flame, label: "Quente", color: "text-destructive", bgColor: "bg-destructive/10" },
  warm: { icon: ThermometerSun, label: "Morno", color: "text-warning", bgColor: "bg-warning/10" },
  cold: { icon: Snowflake, label: "Frio", color: "text-muted-foreground", bgColor: "bg-muted" },
};

interface ConversationCardProps {
  conversation: ConversationData;
  alerts: AlertData[];
  isManager: boolean;
  onClick: () => void;
  onLinkClient: (customerId: string, customerName: string) => void;
  onReassign?: (customerId: string, customerName: string) => void;
  onReturnToInbox?: (customerId: string) => void;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const getAlertIcon = (alertType: string) => {
  switch (alertType) {
    case 'hot_lead': return Flame;
    case 'open_objection': return AlertTriangle;
    case 'waiting_response': return Clock;
    case 'stale_lead': return Clock;
    case 'incomplete_lead': return AlertCircle;
    default: return AlertTriangle;
  }
};

const getAlertColor = (severity: string) => {
  switch (severity) {
    case 'critical': return 'border-destructive text-destructive';
    case 'warning': return 'border-warning text-warning';
    case 'info': return 'border-blue-500 text-blue-500';
    default: return 'border-muted-foreground text-muted-foreground';
  }
};

const getAlertsForConversation = (
  conv: ConversationData, 
  alerts: AlertData[], 
  isManager: boolean
): AlertData[] => {
  const status = conv.cycleStatus || conv.leadStatus;
  if (status === 'won' || status === 'lost') return [];
  if (isManager) return [];
  
  const convAlerts = alerts.filter(a => a.customer_id === conv.id);
  
  const priorityOrder: Record<string, number> = {
    'open_objection': 1,
    'hot_lead': 2,
    'waiting_response': 3,
    'stale_lead': 4,
    'incomplete_lead': 5,
  };
  
  return convAlerts
    .sort((a, b) => (priorityOrder[a.alert_type] || 99) - (priorityOrder[b.alert_type] || 99))
    .slice(0, 3);
};

const ConversationCard = ({ 
  conversation: conv, 
  alerts, 
  isManager, 
  onClick, 
  onLinkClient,
  onReassign,
  onReturnToInbox,
}: ConversationCardProps) => {
  const temperature = conv.insight?.temperature || 'cold';
  const TempIcon = temperatureConfig[temperature as keyof typeof temperatureConfig]?.icon || Snowflake;
  const tempColor = temperatureConfig[temperature as keyof typeof temperatureConfig]?.color || 'text-muted-foreground';
  const convAlerts = getAlertsForConversation(conv, alerts, isManager);
  const status = conv.cycleStatus || conv.leadStatus;
  const isCompleted = status === 'won' || status === 'lost';

  const handleCardClick = () => {
    // Managers don't navigate to chat, only use action buttons
    if (!isManager) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "p-4 border-b border-border transition-colors",
        !isManager && "hover:bg-muted/50 cursor-pointer",
        convAlerts.length > 0 && !isCompleted && "border-l-4 border-l-warning",
        conv.isIncomplete && "border-l-4 border-l-orange-500 bg-orange-500/5"
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar className="h-10 w-10 flex-shrink-0">
          <AvatarFallback className={cn(
            "text-sm",
            conv.isIncomplete 
              ? "bg-orange-500/10 text-orange-500" 
              : "bg-primary/10 text-primary"
          )}>
            {getInitials(conv.customer.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-medium truncate">{conv.customer.name}</span>
              {!isCompleted && !conv.isIncomplete && (
                <TempIcon className={cn("h-4 w-4 flex-shrink-0", tempColor)} />
              )}
              {conv.isIncomplete && (
                <Badge 
                  variant="outline" 
                  className="text-[10px] px-1.5 py-0 border-orange-500 bg-orange-500/10 text-orange-500"
                >
                  <AlertCircle className="h-3 w-3 mr-1" />
                  Incompleto
                </Badge>
              )}
            </div>
            <span className="text-xs text-muted-foreground flex-shrink-0">
              {formatDistanceToNow(new Date(conv.lastMessageTime), {
                addSuffix: true,
                locale: ptBR,
              })}
            </span>
          </div>

          {/* Company name or link button */}
          {conv.customer.companyName ? (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <Building2 className="h-3 w-3" />
              <span>{conv.customer.companyName}</span>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-1.5 text-[10px] text-primary hover:text-primary/80 mt-0.5 -ml-1.5"
              onClick={(e) => {
                e.stopPropagation();
                onLinkClient(conv.customer.id, conv.customer.name);
              }}
            >
              <Building2 className="h-3 w-3 mr-1" />
              Vincular empresa
            </Button>
          )}

          {/* Seller name for manager */}
          {isManager && conv.sellerName && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
              <User className="h-3 w-3" />
              <span>{conv.sellerName}</span>
            </div>
          )}

          {/* Last message - hide for managers */}
          {!isManager && (
            <p className="text-sm text-muted-foreground truncate mt-1">
              {conv.lastMessage}
            </p>
          )}

          {/* Alerts for pending */}
          {!isCompleted && convAlerts.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {convAlerts.map((alert) => {
                const AlertIcon = getAlertIcon(alert.alert_type);
                return (
                  <Badge 
                    key={alert.id} 
                    variant="outline" 
                    className={cn("text-[10px] px-1.5 py-0", getAlertColor(alert.severity))}
                  >
                    <AlertIcon className="h-3 w-3 mr-1" />
                    {alert.message}
                  </Badge>
                );
              })}
            </div>
          )}

          {/* Status for completed */}
          {isCompleted && (
            <div className="mt-2 space-y-1">
              <Badge 
                className={cn(
                  "text-xs",
                  status === 'won' 
                    ? "bg-success text-success-foreground" 
                    : "bg-destructive text-destructive-foreground"
                )}
              >
                {status === 'won' ? (
                  <>
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    Venda Fechada
                  </>
                ) : (
                  <>
                    <XCircle className="h-3 w-3 mr-1" />
                    Venda Perdida
                  </>
                )}
              </Badge>
              {(conv.cycleLostReason || conv.saleReason) && status === 'lost' && (
                <p className="text-xs text-muted-foreground">
                  Motivo: {conv.cycleLostReason || conv.saleReason}
                </p>
              )}
            </div>
          )}

          {/* Manager action buttons */}
          {isManager && onReassign && onReturnToInbox && (
            <div className="flex gap-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={(e) => {
                  e.stopPropagation();
                  onReassign(conv.customer.id, conv.customer.name);
                }}
              >
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Realocar Vendedor
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs text-muted-foreground hover:text-foreground"
                onClick={(e) => {
                  e.stopPropagation();
                  onReturnToInbox(conv.customer.id);
                }}
              >
                <Inbox className="h-3.5 w-3.5 mr-1.5" />
                Retornar Inbox
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ConversationCard;
