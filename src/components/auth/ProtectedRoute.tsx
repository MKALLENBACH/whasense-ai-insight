import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: "gestor" | "vendedor" | "any";
}

const ProtectedRoute = ({ children, requiredRole = "any" }: ProtectedRouteProps) => {
  const { isAuthenticated, isLoading, user } = useAuth();
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

  if (requiredRole !== "any" && user?.role !== requiredRole) {
    // Redirect to appropriate page based on role
    if (user?.role === "gestor") {
      return <Navigate to="/dashboard" replace />;
    } else {
      return <Navigate to="/conversas" replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
