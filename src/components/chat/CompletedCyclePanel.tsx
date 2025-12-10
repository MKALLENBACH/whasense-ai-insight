import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface CompletedCyclePanelProps {
  isViewingHistory: boolean;
  status?: "pending" | "in_progress" | "won" | "lost" | "closed";
  lostReason?: string | null;
  wonSummary?: string | null;
}

const CompletedCyclePanel = ({
  isViewingHistory,
  status,
  lostReason,
  wonSummary,
}: CompletedCyclePanelProps) => {
  return (
    <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 text-success" />
          {isViewingHistory ? "Ciclo Anterior" : "Ciclo Encerrado"}
        </h3>
      </div>
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center">
          <Badge className={cn(
            "text-lg px-4 py-2",
            status === "won" ? "bg-success" : "bg-destructive"
          )}>
            {status === "won" ? "Venda Ganha" : "Venda Perdida"}
          </Badge>
          {lostReason && (
            <p className="text-sm text-muted-foreground mt-4">
              Motivo: {lostReason}
            </p>
          )}
          {wonSummary && (
            <p className="text-sm text-success mt-4">
              {wonSummary}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default CompletedCyclePanel;
