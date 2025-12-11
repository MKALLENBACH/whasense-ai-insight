import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Zap, Loader2, Mail, Lock, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

const LoginPage = () => {
  const { login, isAuthenticated, logout, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const wasAuthenticatedOnMount = useRef<boolean | null>(null);
  const logoutAttempted = useRef(false);

  // Capture initial auth state on mount
  useEffect(() => {
    if (wasAuthenticatedOnMount.current === null) {
      wasAuthenticatedOnMount.current = isAuthenticated;
    }
  }, [isAuthenticated]);

  // Force logout ONLY if user was already authenticated when they navigated to /login
  // This prevents logging out after a successful login
  useEffect(() => {
    if (
      wasAuthenticatedOnMount.current === true &&
      isAuthenticated &&
      !logoutAttempted.current
    ) {
      logoutAttempted.current = true;
      setIsLoggingOut(true);
      logout().finally(() => {
        setIsLoggingOut(false);
      });
    }
  }, [isAuthenticated, logout]);

  if (authLoading || isLoggingOut) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sidebar-foreground/60">{isLoggingOut ? "Saindo..." : "Carregando..."}</p>
        </div>
      </div>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email || !password) {
      setError("Preencha todos os campos");
      return;
    }

    if (!email.includes("@")) {
      setError("Digite um email válido");
      return;
    }

    setIsLoading(true);
    try {
      const { role } = await login(email, password);
      
      // Check if password change is required (from user metadata)
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser?.user_metadata?.requires_password_change) {
        toast.success("Bem-vindo! Por favor, altere sua senha.");
        navigate("/change-password", { replace: true });
        return;
      }
      
      toast.success("Login realizado com sucesso!");
      
      // Redirect based on role
      let redirectPath = "/conversas";
      if (role === "admin") {
        redirectPath = "/admin/dashboard";
      } else if (role === "gestor") {
        redirectPath = "/dashboard";
      }
      navigate(redirectPath, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <Zap className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-sidebar-foreground">Whasense</h1>
            <p className="text-sm text-sidebar-foreground/60">Inteligência em vendas via WhatsApp</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center space-y-1 pb-4">
            <CardTitle className="text-2xl font-bold">Acessar conta</CardTitle>
            <CardDescription className="text-base">Entre com suas credenciais</CardDescription>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setError("");
                    }}
                    disabled={isLoading}
                    className="pl-10 h-11"
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError("");
                    }}
                    disabled={isLoading}
                    className="pl-10 h-11"
                    autoComplete="current-password"
                  />
                </div>
              </div>

              <Button type="submit" variant="hero" className="w-full h-11 text-base font-semibold" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Entrando...
                  </>
                ) : (
                  "Entrar"
                )}
            </Button>
            </form>
          </CardContent>

          <CardFooter className="flex flex-col gap-3 pt-0">
            <Link
              to="/forgot-password"
              className="text-sm text-muted-foreground hover:text-primary transition-colors"
            >
              Esqueci minha senha
            </Link>

            <div className="w-full border-t border-border pt-4 mt-2">
              <div className="text-center mb-4">
                <p className="text-sm text-muted-foreground mb-3">Ainda não tem conta?</p>
                <Link to="/trial">
                  <Button 
                    variant="outline" 
                    className="w-full h-11 text-base font-semibold border-primary text-primary hover:bg-primary hover:text-primary-foreground transition-all"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Testar grátis por 7 dias
                  </Button>
                </Link>
              </div>

            </div>
          </CardFooter>
        </Card>

        <p className="text-xs text-center text-sidebar-foreground/40 mt-6">
          © 2024 Whasense. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
