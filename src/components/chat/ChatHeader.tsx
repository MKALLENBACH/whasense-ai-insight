import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, 
  RefreshCw, 
  Trophy, 
  XCircle, 
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";
import CurrentCycleBadge from "@/components/sale/CurrentCycleBadge";

interface ChatHeaderProps {
  customerName: string;
  customerPhone?: string | null;
  customerEmail?: string | null;
  isIncomplete?: boolean;
  onBack: () => void;
  onShowLeadModal: () => void;
  // Cycle info
  cycleNumber?: number;
  cycleStatus?: "pending" | "in_progress" | "won" | "lost" | "closed";
  cycleType?: "pre_sale" | "post_sale";
  isViewingHistory?: boolean;
  onBackToCurrentCycle?: () => void;
  // AI Analysis
  temperature?: "hot" | "warm" | "cold";
  showTemperature?: boolean;
  // Actions
  isSeller?: boolean;
  isConversationCompleted?: boolean;
  isPostSaleCycle?: boolean;
  isSimulatingResponse?: boolean;
  onSimulate?: () => void;
  onRegisterWon?: () => void;
  onRegisterLost?: () => void;
  onMarkPostSale?: () => void;
  onClosePostSale?: () => void;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const ChatHeader = ({
  customerName,
  customerPhone,
  customerEmail,
  isIncomplete = false,
  onBack,
  onShowLeadModal,
  cycleNumber,
  cycleStatus,
  cycleType,
  isViewingHistory = false,
  onBackToCurrentCycle,
  temperature,
  showTemperature = false,
  isSeller = false,
  isConversationCompleted = false,
  isPostSaleCycle = false,
  isSimulatingResponse = false,
  onSimulate,
  onRegisterWon,
  onRegisterLost,
  onMarkPostSale,
  onClosePostSale,
}: ChatHeaderProps) => {
  return (
    <div className="p-4 border-b border-border flex items-center gap-3">
      <Button
        variant="ghost"
        size="icon"
        onClick={onBack}
        className="h-8 w-8"
      >
        <ArrowLeft className="h-4 w-4" />
      </Button>

      <div className={cn(
        "h-10 w-10 rounded-full flex items-center justify-center text-sm font-semibold",
        isIncomplete 
          ? "bg-orange-500/10 text-orange-500" 
          : "bg-primary/10 text-primary"
      )}>
        {getInitials(customerName)}
      </div>

      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{customerName}</h2>
          {isIncomplete && (
            <Badge 
              variant="outline" 
              className="text-[10px] px-1.5 py-0 border-orange-500 bg-orange-500/10 text-orange-500 cursor-pointer"
              onClick={onShowLeadModal}
            >
              <AlertCircle className="h-3 w-3 mr-1" />
              Completar dados
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {customerPhone || customerEmail || "Sem contato"}
        </p>
      </div>

      {/* Current Cycle Badge */}
      {cycleNumber && cycleStatus && (
        <CurrentCycleBadge
          cycleNumber={cycleNumber}
          status={cycleStatus}
          cycleType={cycleType}
        />
      )}

      {/* Viewing history indicator */}
      {isViewingHistory && onBackToCurrentCycle && (
        <Button
          variant="outline"
          size="sm"
          onClick={onBackToCurrentCycle}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar ao atual
        </Button>
      )}

      {/* Temperature badge */}
      {showTemperature && temperature && !isConversationCompleted && !isViewingHistory && (
        <LeadTemperatureBadge 
          temperature={temperature} 
          showLabel 
        />
      )}

      {/* Simulate button */}
      {isSeller && !isConversationCompleted && !isViewingHistory && onSimulate && (
        <Button
          variant="outline"
          size="sm"
          onClick={onSimulate}
          className="gap-2"
          disabled={isSimulatingResponse}
        >
          <RefreshCw className={cn("h-4 w-4", isSimulatingResponse && "animate-spin")} />
          Simular
        </Button>
      )}

      {/* Sale registration buttons */}
      {isSeller && cycleStatus && !isConversationCompleted && !isViewingHistory && (
        <>
          {/* Pre-sale actions */}
          {!isPostSaleCycle && (
            <>
              {onRegisterWon && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={onRegisterWon}
                  className="gap-2 bg-success hover:bg-success/90"
                >
                  <Trophy className="h-4 w-4" />
                  Venda
                </Button>
              )}
              {onRegisterLost && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRegisterLost}
                  className="gap-2"
                >
                  <XCircle className="h-4 w-4" />
                  Perda
                </Button>
              )}
              {onMarkPostSale && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onMarkPostSale}
                  className="gap-2 border-blue-500 text-blue-500 hover:bg-blue-500/10"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Pós-venda
                </Button>
              )}
            </>
          )}
          {/* Post-sale actions */}
          {isPostSaleCycle && onClosePostSale && (
            <Button
              variant="default"
              size="sm"
              onClick={onClosePostSale}
              className="gap-2 bg-blue-600 hover:bg-blue-700"
            >
              <CheckCircle2 className="h-4 w-4" />
              Concluir Pós-venda
            </Button>
          )}
        </>
      )}
    </div>
  );
};

export default ChatHeader;
