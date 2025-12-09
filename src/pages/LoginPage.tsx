import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, User, Users, Loader2, Mail, Lock, UserPlus, LogIn } from "lucide-react";
import { toast } from "sonner";
import { UserRole } from "@/types";

const LoginPage = () => {
  const { login, signup, isAuthenticated, user, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("vendedor");
  const [authMode, setAuthMode] = useState<"login" | "signup">("login");

  // Show loading while checking auth state
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect if already authenticated
  if (isAuthenticated && user) {
    return <Navigate to={user.role === "gestor" ? "/dashboard" : "/conversas"} replace />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast.error("Preencha todos os campos");
      return;
    }

    setIsLoading(true);
    try {
      const { role } = await login(email, password);
      toast.success("Login realizado com sucesso!");
      navigate(role === "gestor" ? "/dashboard" : "/conversas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password || !name) {
      toast.error("Preencha todos os campos");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    setIsLoading(true);
    try {
      await signup(email, password, name, selectedRole);
      toast.success("Conta criada com sucesso!");
      navigate(selectedRole === "gestor" ? "/dashboard" : "/conversas");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao criar conta");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center p-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <Zap className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-sidebar-foreground">Whasense</h1>
            <p className="text-sm text-sidebar-foreground/60">Inteligência em vendas via WhatsApp</p>
          </div>
        </div>

        {/* Auth Card */}
        <Card className="border-none shadow-2xl backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">
              {authMode === "login" ? "Bem-vindo de volta" : "Crie sua conta"}
            </CardTitle>
            <CardDescription>
              {authMode === "login" 
                ? "Entre na sua conta para continuar" 
                : "Preencha os dados para começar"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Auth Mode Toggle */}
            <div className="flex gap-2 mb-6">
              <Button
                type="button"
                variant={authMode === "login" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setAuthMode("login")}
              >
                <LogIn className="h-4 w-4" />
                Entrar
              </Button>
              <Button
                type="button"
                variant={authMode === "signup" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setAuthMode("signup")}
              >
                <UserPlus className="h-4 w-4" />
                Cadastrar
              </Button>
            </div>

            {/* Role Selection (only for signup) */}
            {authMode === "signup" && (
              <Tabs
                value={selectedRole}
                onValueChange={(v) => setSelectedRole(v as UserRole)}
                className="mb-6"
              >
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="vendedor" className="gap-2">
                    <User className="h-4 w-4" />
                    Vendedor
                  </TabsTrigger>
                  <TabsTrigger value="gestor" className="gap-2">
                    <Users className="h-4 w-4" />
                    Gestor
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            )}

            <form onSubmit={authMode === "login" ? handleLogin : handleSignup} className="space-y-4">
              {/* Name field (signup only) */}
              {authMode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      disabled={isLoading}
                      className="pl-10"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={isLoading}
                    className="pl-10"
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
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isLoading}
                    className="pl-10"
                  />
                </div>
                {authMode === "signup" && (
                  <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
                )}
              </div>

              <Button 
                type="submit" 
                variant="hero" 
                className="w-full" 
                size="lg" 
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {authMode === "login" ? "Entrar" : `Cadastrar como ${selectedRole === "vendedor" ? "Vendedor" : "Gestor"}`}
              </Button>
            </form>

            <p className="text-xs text-center text-muted-foreground mt-6">
              {authMode === "login" 
                ? "Não tem uma conta? Clique em Cadastrar acima" 
                : "Já tem uma conta? Clique em Entrar acima"}
            </p>
          </CardContent>
        </Card>

        {/* Footer */}
        <p className="text-xs text-center text-sidebar-foreground/40 mt-6">
          © 2024 Whasense. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
