import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Trophy, XCircle, Clock, Play, HeadphonesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CycleDividerProps {
  cycleNumber: number;
  status: "pending" | "in_progress" | "won" | "lost" | "closed";
  startDate: string;
  endDate?: string | null;
  cycleType?: "pre_sale" | "post_sale";
}

const statusConfig = {
  pending: { 
    label: "aguardando", 
    icon: Clock, 
    color: "text-muted-foreground border-muted-foreground/30" 
  },
  in_progress: { 
    label: "em andamento", 
    icon: Play, 
    color: "text-primary border-primary/30" 
  },
  won: { 
    label: "venda realizada", 
    icon: Trophy, 
    color: "text-success border-success/30" 
  },
  lost: { 
    label: "perdido", 
    icon: XCircle, 
    color: "text-destructive border-destructive/30" 
  },
  closed: { 
    label: "pós-venda concluído", 
    icon: HeadphonesIcon, 
    color: "text-blue-500 border-blue-500/30" 
  },
};

export function CycleDivider({ cycleNumber, status, startDate, endDate, cycleType }: CycleDividerProps) {
  // Use post-sale specific config when cycle is post_sale and in_progress
  const effectiveStatus = cycleType === "post_sale" && status === "in_progress" ? "in_progress" : status;
  const config = statusConfig[effectiveStatus] || statusConfig.pending;
  
  // Override label for post-sale in_progress
  const displayLabel = cycleType === "post_sale" && status === "in_progress" 
    ? "pós-venda em andamento" 
    : config.label;
  const StatusIcon = config.icon;
  
  const isFinished = status === "won" || status === "lost" || status === "closed";
  
  const formattedStartDate = format(new Date(startDate), "dd/MM/yyyy", { locale: ptBR });
  const formattedEndDate = endDate 
    ? format(new Date(endDate), "dd/MM/yyyy", { locale: ptBR }) 
    : null;

  return (
    <div className="flex items-center gap-3 py-4">
      <div className="flex-1 h-px bg-border" />
      <div className={cn(
        "flex items-center gap-2 px-3 py-1.5 rounded-full border bg-background text-xs font-medium",
        config.color
      )}>
        <StatusIcon className="h-3.5 w-3.5" />
        <span>Ciclo #{cycleNumber}</span>
        <span className="text-muted-foreground">—</span>
        <span className="capitalize">{displayLabel}</span>
        {isFinished && (
          <>
            <span className="text-muted-foreground">•</span>
            <span>{formattedStartDate} → {formattedEndDate}</span>
          </>
        )}
        {!isFinished && (
          <>
            <span className="text-muted-foreground">•</span>
            <span>iniciado em {formattedStartDate}</span>
          </>
        )}
      </div>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}