import { Navigate, useLocation } from "react-router-dom";
import { useAuth, PlanFeatures } from "@/contexts/AuthContext";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";
import { Loader2, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "gestor" | "vendedor" | "any";
  allowRestrictedAccess?: boolean;
  allowSellerLimitExceeded?: boolean;
  requiredFeature?: keyof PlanFeatures;
}

// Map routes to their required features
const ROUTE_FEATURE_MAP: Record<string, keyof PlanFeatures> = {
  "/clientes": "canAccess360",
  "/cliente": "canAccess360",
  "/gestor/metas": "canUseGamification",
  "/vendedor/performance": "canUseGamification",
  "/gestor/followups": "canUseFollowups",
};

// Map features to required plans for display
const FEATURE_PLAN_MAP: Record<keyof PlanFeatures, string> = {
  canAccess360: "Enterprise",
  canUseGamification: "Pro",
  canUseFollowups: "Premium",
  canAccessFullDashboard: "Starter",
};

// Map features to names for display
const FEATURE_NAME_MAP: Record<keyof PlanFeatures, string> = {
  canAccess360: "Cliente 360°",
  canUseGamification: "Metas e Gamificação",
  canUseFollowups: "Follow-ups Automáticos",
  canAccessFullDashboard: "Dashboard Completo",
};

const ProtectedRoute = ({ 
  children, 
  requiredRole = "any",
  allowRestrictedAccess = false,
  allowSellerLimitExceeded = false,
  requiredFeature,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user, hasRestrictedAccess, hasSellerLimitExceeded, isAdmin } = useAuth();
  const permissions = usePlanPermissions();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Admin nunca tem restrição
  if (isAdmin) {
    return <>{children}</>;
  }

  // Vendedor com empresa inativa/plano inativo
  if (user?.role === "vendedor" && hasRestrictedAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Acesso Restrito
          </h2>
          <p className="text-muted-foreground mb-4">
            Sua empresa está com o plano inativo. Entre em contato com seu gestor para regularizar a situação.
          </p>
          <button
            onClick={() => window.location.href = "/login"}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
          >
            Voltar ao Login
          </button>
        </div>
      </div>
    );
  }

  // Gestor com empresa inativa/plano inativo - só pode acessar /financeiro
  if (user?.role === "gestor" && hasRestrictedAccess) {
    if (allowRestrictedAccess) {
      return <>{children}</>;
    }
    
    if (location.pathname !== "/financeiro") {
      return <Navigate to="/financeiro" replace />;
    }
  }

  // Gestor com limite de vendedores excedido
  if (user?.role === "gestor" && hasSellerLimitExceeded && !hasRestrictedAccess) {
    // Rotas permitidas quando limite excedido
    const allowedPaths = ["/dashboard", "/gestor/vendedores", "/financeiro"];
    const isAllowedPath = allowedPaths.some(path => location.pathname.startsWith(path));
    
    if (allowSellerLimitExceeded || isAllowedPath) {
      return <>{children}</>;
    }
    
    // Redireciona para dashboard se tentar acessar outra rota
    return <Navigate to="/dashboard" replace />;
  }

  // Check feature-based access
  const routeFeature = requiredFeature || Object.entries(ROUTE_FEATURE_MAP).find(
    ([route]) => location.pathname.startsWith(route)
  )?.[1];

  if (routeFeature && !permissions.hasFullAccess) {
    const hasFeatureAccess = permissions[routeFeature];
    
    if (!hasFeatureAccess) {
      const featureName = FEATURE_NAME_MAP[routeFeature];
      const requiredPlan = FEATURE_PLAN_MAP[routeFeature];
      
      return (
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="text-center max-w-md p-6">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Recurso não disponível
            </h2>
            <p className="text-muted-foreground mb-4">
              <strong>{featureName}</strong> não está incluído no seu plano atual.
              <br />
              Faça upgrade para o plano <strong>{requiredPlan}</strong> ou superior para desbloquear.
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={() => window.location.href = "/financeiro"}>
                Ver planos disponíveis
              </Button>
              <Button 
                variant="outline" 
                onClick={() => window.history.back()}
              >
                Voltar
              </Button>
            </div>
          </div>
        </div>
      );
    }
  }

  // Verificação de role normal
  if (requiredRole !== "any" && user?.role !== requiredRole) {
    if (user?.role === "gestor") {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/conversas" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
