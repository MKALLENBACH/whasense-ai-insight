import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Clock, Crown, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";

const FREE_PLAN_ID = "8af5c9e1-02a3-4705-b312-6f33bcc0d965";

export function TrialBanner() {
  const { companyPlan, isManager } = useAuth();
  const navigate = useNavigate();
  const [isDismissed, setIsDismissed] = useState(false);

  // Only show for managers on FREE plan with valid end date
  if (!isManager || companyPlan?.planId !== FREE_PLAN_ID || !companyPlan?.freeEndDate || isDismissed) {
    return null;
  }

  const freeEndDate = new Date(companyPlan.freeEndDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = Math.max(0, differenceInDays(freeEndDate, today));
  const formattedEndDate = format(freeEndDate, "dd 'de' MMMM", { locale: ptBR });

  // Choose color based on urgency
  let bgColor = "bg-primary/10 border-primary/20";
  let textColor = "text-primary";
  let iconColor = "text-primary";
  
  if (daysRemaining <= 1) {
    bgColor = "bg-destructive/10 border-destructive/20";
    textColor = "text-destructive";
    iconColor = "text-destructive";
  } else if (daysRemaining <= 3) {
    bgColor = "bg-amber-500/10 border-amber-500/20";
    textColor = "text-amber-600 dark:text-amber-400";
    iconColor = "text-amber-500";
  }

  return (
    <div className={`relative flex items-center justify-between gap-4 px-4 py-3 rounded-lg border ${bgColor} mb-4`}>
      <div className="flex items-center gap-3">
        <Clock className={`h-5 w-5 ${iconColor} shrink-0`} />
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className={`font-medium ${textColor}`}>
            {daysRemaining === 0 
              ? "Seu período de teste expira hoje!" 
              : daysRemaining === 1 
                ? "Falta 1 dia para o fim do teste" 
                : `Faltam ${daysRemaining} dias para o fim do teste`}
          </span>
          <span className="text-sm text-muted-foreground hidden sm:inline">
            (expira em {formattedEndDate})
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        <Button 
          size="sm" 
          onClick={() => navigate("/financeiro")}
          className="shrink-0"
        >
          <Crown className="h-4 w-4 mr-1.5" />
          Assinar
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setIsDismissed(true)}
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
