import { Users, Infinity, AlertTriangle } from "lucide-react";
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
      className={`rounded-lg p-4 flex items-center justify-between ${
        isAtLimit
          ? "bg-red-500/10 border border-red-500/30"
          : isNearLimit
          ? "bg-amber-500/10 border border-amber-500/30"
          : "bg-slate-800 border border-slate-700"
      }`}
    >
      <div className="flex items-center gap-3">
        <div
          className={`h-10 w-10 rounded-lg flex items-center justify-center ${
            isAtLimit
              ? "bg-red-500/20"
              : isNearLimit
              ? "bg-amber-500/20"
              : "bg-orange-500/10"
          }`}
        >
          {isAtLimit ? (
            <AlertTriangle className="h-5 w-5 text-red-400" />
          ) : (
            <Users className="h-5 w-5 text-orange-500" />
          )}
        </div>
        <div>
          <p className="text-sm text-slate-400">
            Plano: <span className="text-white font-medium">{planName || "Sem plano"}</span>
          </p>
          <p className="text-sm">
            <span className="text-slate-400">Vendedores: </span>
            <span
              className={`font-medium ${
                isAtLimit
                  ? "text-red-400"
                  : isNearLimit
                  ? "text-amber-400"
                  : "text-white"
              }`}
            >
              {currentSellerCount}
            </span>
            <span className="text-slate-400"> / </span>
            {isUnlimited ? (
              <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30 text-xs">
                <Infinity className="h-3 w-3 mr-1" />
                Ilimitado
              </Badge>
            ) : (
              <span className="text-white">{sellerLimit}</span>
            )}
          </p>
        </div>
      </div>

      {isAtLimit && (
        <div className="text-right">
          <p className="text-sm text-red-400 font-medium">Limite atingido</p>
          <p className="text-xs text-slate-400">
            Contate Whasense para upgrade
          </p>
        </div>
      )}
    </div>
  );
};

export default PlanLimitBanner;
