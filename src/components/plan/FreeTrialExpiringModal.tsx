import { useNavigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Crown } from "lucide-react";

interface FreeTrialExpiringModalProps {
  open: boolean;
  onClose: () => void;
  daysRemaining: number;
  endDate: string;
}

export function FreeTrialExpiringModal({ 
  open, 
  onClose, 
  daysRemaining, 
  endDate 
}: FreeTrialExpiringModalProps) {
  const navigate = useNavigate();

  const handleGoToFinanceiro = () => {
    onClose();
    navigate("/financeiro");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="h-5 w-5" />
            Seu período gratuito está acabando!
          </DialogTitle>
          <DialogDescription>
            {daysRemaining === 0 
              ? "Seu plano Free expira hoje!" 
              : `Falta apenas ${daysRemaining} dia para o fim do seu período de avaliação.`}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4 rounded-lg">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              Após <strong>{endDate}</strong>, sua empresa perderá acesso às funcionalidades 
              da plataforma. Para continuar usando o Whasense sem interrupções, 
              escolha um plano agora.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Crown className="h-4 w-4 text-primary" />
            <span>Assine e mantenha todos os seus dados e histórico!</span>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Button onClick={handleGoToFinanceiro}>
            <Crown className="h-4 w-4 mr-2" />
            Escolher plano
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
