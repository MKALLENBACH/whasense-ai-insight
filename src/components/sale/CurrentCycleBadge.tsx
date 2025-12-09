import { Badge } from "@/components/ui/badge";
import { Clock, MessageSquare, Trophy, XCircle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface CurrentCycleBadgeProps {
  cycleNumber: number;
  status: "pending" | "in_progress" | "won" | "lost";
  className?: string;
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", icon: Clock, variant: "secondary" },
  in_progress: { label: "Em andamento", icon: MessageSquare, variant: "default" },
  won: { label: "Concluída", icon: Trophy, variant: "default" },
  lost: { label: "Perdida", icon: XCircle, variant: "destructive" },
};

const CurrentCycleBadge = ({ cycleNumber, status, className }: CurrentCycleBadgeProps) => {
  const config = statusConfig[status] || statusConfig.pending;
  const StatusIcon = config.icon;

  return (
    <Badge
      variant={config.variant}
      className={cn(
        "gap-1.5",
        status === "won" && "bg-success hover:bg-success/90",
        className
      )}
    >
      <RefreshCw className="h-3 w-3" />
      Ciclo #{cycleNumber}
      <span className="opacity-70">•</span>
      <StatusIcon className="h-3 w-3" />
      {config.label}
    </Badge>
  );
};

export default CurrentCycleBadge;
