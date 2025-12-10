import { Users, Infinity, AlertTriangle, Crown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PlanLimitBannerProps {
  planName: string | null;
  sellerLimit: number | null;
  currentSellerCount: number;
}

const PlanLimitBanner = ({
  planName,
  sellerLimit,
  currentSellerCount,
}: PlanLimitBannerProps) => {
  const isUnlimited = sellerLimit === null;
  const isAtLimit = !isUnlimited && currentSellerCount >= sellerLimit;
  const isNearLimit = !isUnlimited && currentSellerCount >= sellerLimit - 1;

  return (
    <div
      className={`rounded-xl p-5 border transition-all ${
        isAtLimit
          ? "bg-destructive/10 border-destructive/30"
          : isNearLimit
          ? "bg-amber-500/10 border-amber-500/30"
          : "bg-card border-border"
      }`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`h-12 w-12 rounded-xl flex items-center justify-center ${
              isAtLimit
                ? "bg-destructive/20"
                : isNearLimit
                ? "bg-amber-500/20"
                : "bg-primary/10"
            }`}
          >
            {isAtLimit ? (
              <AlertTriangle className="h-6 w-6 text-destructive" />
            ) : (
              <Crown className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Plano:</span>
              <Badge variant="secondary" className="font-semibold">
                {planName || "Sem plano"}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Vendedores:</span>
              <span
                className={`font-bold text-lg ${
                  isAtLimit
                    ? "text-destructive"
                    : isNearLimit
                    ? "text-amber-500"
                    : "text-foreground"
                }`}
              >
                {currentSellerCount}
              </span>
              <span className="text-muted-foreground">/</span>
              {isUnlimited ? (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  <Infinity className="h-3 w-3 mr-1" />
                  Ilimitado
                </Badge>
              ) : (
                <span className="font-bold text-lg text-foreground">{sellerLimit}</span>
              )}
            </div>
          </div>
        </div>

        {isAtLimit && (
          <div className="text-right px-4 py-2 rounded-lg bg-destructive/10">
            <p className="text-sm font-semibold text-destructive">Limite atingido</p>
            <p className="text-xs text-muted-foreground">
              Contate Whasense para upgrade
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanLimitBanner;
