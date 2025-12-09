import { Badge } from "@/components/ui/badge";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface IncompleteLeadBadgeProps {
  className?: string;
}

const IncompleteLeadBadge = ({ className }: IncompleteLeadBadgeProps) => {
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "text-[10px] px-1.5 py-0 border-warning bg-warning/10 text-warning",
        className
      )}
    >
      <AlertCircle className="h-3 w-3 mr-1" />
      Incompleto
    </Badge>
  );
};

export default IncompleteLeadBadge;
