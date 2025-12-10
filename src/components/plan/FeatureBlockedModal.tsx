import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface FeatureBlockedModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName: string;
  requiredPlan?: string;
}

export function FeatureBlockedModal({ 
  open, 
  onOpenChange, 
  featureName,
  requiredPlan = "Premium"
}: FeatureBlockedModalProps) {
  const navigate = useNavigate();

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/financeiro");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">
            Recurso não disponível
          </DialogTitle>
          <DialogDescription className="text-center">
            <strong>{featureName}</strong> não está incluído no seu plano atual.
            <br />
            Faça upgrade para o plano <strong>{requiredPlan}</strong> ou superior para desbloquear.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={handleUpgrade} className="w-full gap-2">
            <Crown className="h-4 w-4" />
            Ver planos disponíveis
          </Button>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Voltar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
