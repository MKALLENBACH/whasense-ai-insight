import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, Trophy, XCircle, RefreshCw, HeadphonesIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentCycleBadgeProps {
  cycleNumber: number;
  status: "pending" | "in_progress" | "won" | "lost" | "closed";
  cycleType?: "pre_sale" | "post_sale";
  className?: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", icon: Clock, variant: "secondary" },
  in_progress: { label: "Em andamento", icon: MessageSquare, variant: "default" },
  won: { label: "Concluída", icon: Trophy, variant: "default" },
  lost: { label: "Perdida", icon: XCircle, variant: "destructive" },
  closed: { label: "Pós-venda concluído", icon: HeadphonesIcon, variant: "default" },
};

const CurrentCycleBadge = ({ cycleNumber, status, cycleType, className }: CurrentCycleBadgeProps) => {
  // For post-sale cycles in progress, show different label
  const effectiveLabel = cycleType === "post_sale" && status === "in_progress" 
    ? "Pós-venda em andamento" 
    : statusConfig[status]?.label || statusConfig.pending.label;
  
  const config = statusConfig[status] || statusConfig.pending;
  const StatusIcon = cycleType === "post_sale" && status === "in_progress" 
    ? HeadphonesIcon 
    : config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1.5",
        status === "won" && "bg-success hover:bg-success/90",
        status === "closed" && "bg-blue-600 hover:bg-blue-700",
        cycleType === "post_sale" && status === "in_progress" && "bg-blue-600 hover:bg-blue-700",
        className
      )}
    >
      <RefreshCw className="h-3 w-3" />
      Ciclo #{cycleNumber}
      <span className="opacity-70">•</span>
      <StatusIcon className="h-3 w-3" />
      {effectiveLabel}
    </Badge>
  );
};

export default CurrentCycleBadge;
