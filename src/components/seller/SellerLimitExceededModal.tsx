import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface SellerLimitExceededModalProps {
  open: boolean;
  currentActiveCount: number;
  allowedLimit: number;
  planName: string | null;
}

const SellerLimitExceededModal = ({
  open,
  currentActiveCount,
  allowedLimit,
  planName,
}: SellerLimitExceededModalProps) => {
  const navigate = useNavigate();

  const handleManageSellers = () => {
    navigate("/gestor/vendedores");
  };

  return (
    <Dialog open={open} modal>
      <DialogContent 
        className="sm:max-w-md"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <DialogTitle className="text-xl">Limite de Vendedores Excedido</DialogTitle>
          <DialogDescription className="text-base mt-2">
            Seu plano atual não suporta a quantidade de vendedores ativos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="rounded-lg bg-muted/50 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Plano atual:</span>
              <span className="font-medium">{planName || "Não definido"}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Limite permitido:</span>
              <span className="font-medium text-primary">{allowedLimit} vendedor{allowedLimit !== 1 ? "es" : ""}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Vendedores ativos:</span>
              <span className="font-medium text-destructive">{currentActiveCount} vendedor{currentActiveCount !== 1 ? "es" : ""}</span>
            </div>
            <div className="flex items-center justify-between border-t pt-3">
              <span className="text-sm font-medium">Excedente:</span>
              <span className="font-bold text-destructive">
                {currentActiveCount - allowedLimit} vendedor{(currentActiveCount - allowedLimit) !== 1 ? "es" : ""}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Ação necessária:</strong> Desative {currentActiveCount - allowedLimit} vendedor{(currentActiveCount - allowedLimit) !== 1 ? "es" : ""} para restaurar o acesso completo da sua equipe ao sistema.
            </p>
          </div>

          <p className="text-sm text-muted-foreground text-center">
            Os vendedores desativados não perdem histórico de conversas, vendas ou métricas.
          </p>
        </div>

        <Button onClick={handleManageSellers} className="w-full gap-2">
          <Users className="h-4 w-4" />
          Gerenciar Vendedores
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default SellerLimitExceededModal;
