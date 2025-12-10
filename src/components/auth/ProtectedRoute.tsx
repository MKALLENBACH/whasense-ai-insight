import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2, AlertTriangle } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "gestor" | "vendedor" | "any";
  allowRestrictedAccess?: boolean;
  allowSellerLimitExceeded?: boolean;
}

const ProtectedRoute = ({ 
  children, 
  requiredRole = "any",
  allowRestrictedAccess = false,
  allowSellerLimitExceeded = false,
}: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user, hasRestrictedAccess, hasSellerLimitExceeded, isAdmin } = useAuth();
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
