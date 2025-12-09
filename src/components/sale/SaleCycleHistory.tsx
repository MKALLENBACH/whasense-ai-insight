import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  History, 
  Trophy, 
  XCircle, 
  Clock, 
  ChevronRight, 
  MessageSquare,
  Calendar,
  Info
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { CycleDetailsModal } from "./CycleDetailsModal";

export interface SaleCycle {
  id: string;
  customer_id: string;
  seller_id: string;
  status: "pending" | "in_progress" | "won" | "lost";
  created_at: string;
  closed_at: string | null;
  lost_reason: string | null;
  won_summary: string | null;
  last_activity_at?: string | null;
  messageCount?: number;
}

interface SaleCycleHistoryProps {
  cycles: SaleCycle[];
  activeCycleId: string | null;
  onSelectCycle: (cycleId: string) => void;
  className?: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-muted-foreground bg-muted" },
  in_progress: { label: "Em andamento", icon: MessageSquare, color: "text-primary bg-primary/10" },
  won: { label: "Ganhou", icon: Trophy, color: "text-success bg-success/10" },
  lost: { label: "Perdido", icon: XCircle, color: "text-destructive bg-destructive/10" },
};

const lossReasonLabels: Record<string, string> = {
  price: "Preço",
  delay: "Prazo",
  competition: "Concorrência",
  trust: "Desconfiança",
  other: "Outro",
};

const SaleCycleHistory = ({
  cycles,
  activeCycleId,
  onSelectCycle,
  className,
}: SaleCycleHistoryProps) => {
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedCycleForDetails, setSelectedCycleForDetails] = useState<{ id: string; number: number } | null>(null);

  if (cycles.length === 0) {
    return null;
  }

  const handleDetailsClick = (e: React.MouseEvent, cycleId: string, cycleNumber: number) => {
    e.stopPropagation();
    setSelectedCycleForDetails({ id: cycleId, number: cycleNumber });
    setDetailsModalOpen(true);
  };

  return (
    <>
      <Card className={cn("", className)}>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-sm">
            <History className="h-4 w-4" />
            Histórico de Ciclos ({cycles.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <ScrollArea className="h-[220px]">
            <div className="space-y-2">
              {cycles.map((cycle, index) => {
                const status = statusConfig[cycle.status] || statusConfig.pending;
                const StatusIcon = status.icon;
                const isActive = cycle.id === activeCycleId;
                const cycleNumber = cycles.length - index;

                return (
                  <div
                    key={cycle.id}
                    className={cn(
                      "w-full flex items-center justify-between p-3 rounded-lg cursor-pointer transition-colors",
                      isActive 
                        ? "bg-primary/5 border border-primary/20 hover:bg-primary/10" 
                        : "hover:bg-muted/50"
                    )}
                    onClick={() => onSelectCycle(cycle.id)}
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className={cn(
                        "h-8 w-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0",
                        status.color
                      )}>
                        <StatusIcon className="h-4 w-4" />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">Ciclo #{cycleNumber}</span>
                          {isActive && (
                            <Badge variant="default" className="text-[10px] px-1.5 py-0">
                              Atual
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(cycle.created_at), "dd/MM/yy", { locale: ptBR })}
                          {cycle.closed_at && (
                            <>
                              <span>→</span>
                              {format(new Date(cycle.closed_at), "dd/MM/yy", { locale: ptBR })}
                            </>
                          )}
                        </div>
                        {cycle.status === "lost" && cycle.lost_reason && (
                          <p className="text-xs text-destructive mt-0.5 truncate">
                            {lossReasonLabels[cycle.lost_reason] || cycle.lost_reason}
                          </p>
                        )}
                        {cycle.status === "won" && cycle.won_summary && (
                          <p className="text-xs text-success mt-0.5 truncate max-w-[150px]">
                            {cycle.won_summary}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={(e) => handleDetailsClick(e, cycle.id, cycleNumber)}
                      >
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {selectedCycleForDetails && (
        <CycleDetailsModal
          open={detailsModalOpen}
          onOpenChange={setDetailsModalOpen}
          cycleId={selectedCycleForDetails.id}
          cycleNumber={selectedCycleForDetails.number}
        />
      )}
    </>
  );
};

export default SaleCycleHistory;
