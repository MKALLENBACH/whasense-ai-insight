import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Zap,
  Loader2,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

const passwordSchema = z
  .object({
    password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

const ResetPasswordPage = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Check if we have a valid recovery session
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      
      // Check URL for recovery token (Supabase adds it as hash fragment)
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      const accessToken = hashParams.get("access_token");
      const type = hashParams.get("type");

      if (type === "recovery" && accessToken) {
        // Set session with the recovery token
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: hashParams.get("refresh_token") || "",
        });

        if (error) {
          console.error("Error setting session:", error);
          setIsValidToken(false);
        } else {
          setIsValidToken(true);
        }
      } else if (session) {
        // Already have a session (user clicked link and was redirected)
        setIsValidToken(true);
      } else {
        setIsValidToken(false);
      }
    };

    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    // Validate passwords
    const result = passwordSchema.safeParse({ password, confirmPassword });
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        throw error;
      }

      setIsSuccess(true);
      toast.success("Senha redefinida com sucesso!");

      // Get user role and redirect
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: roleData } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", user.id)
            .maybeSingle();

          const redirectPath = roleData?.role === "manager" ? "/dashboard" : "/conversas";
          navigate(redirectPath, { replace: true });
        } else {
          navigate("/login", { replace: true });
        }
      }, 2000);
    } catch (err) {
      console.error("Error updating password:", err);
      setErrors({ password: "Erro ao redefinir senha. Tente novamente." });
    } finally {
      setIsLoading(false);
    }
  };

  // Loading state while checking token
  if (isValidToken === null) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sidebar-foreground/60">Verificando link...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center p-4">
      {/* Background decorations */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
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

        <Card className="border-none shadow-2xl backdrop-blur-sm bg-card/95">
          {!isValidToken ? (
            // Invalid/expired token state
            <>
              <CardHeader className="text-center space-y-1 pb-4">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-8 w-8 text-destructive" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">Link inválido</CardTitle>
                <CardDescription className="text-base">
                  Este link expirou ou é inválido.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert variant="destructive" className="mb-4">
                  <AlertDescription>
                    O link de redefinição de senha pode ter expirado. 
                    Solicite um novo link para redefinir sua senha.
                  </AlertDescription>
                </Alert>
                <Link to="/forgot-password">
                  <Button variant="hero" className="w-full h-11 text-base font-semibold">
                    Solicitar novo link
                  </Button>
                </Link>
              </CardContent>
              <CardFooter className="flex justify-center pt-0">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </CardFooter>
            </>
          ) : isSuccess ? (
            // Success state
            <>
              <CardHeader className="text-center space-y-1 pb-4">
                <div className="flex justify-center mb-4">
                  <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </div>
                </div>
                <CardTitle className="text-2xl font-bold">Senha redefinida!</CardTitle>
                <CardDescription className="text-base">
                  Sua senha foi alterada com sucesso.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Alert className="bg-emerald-500/10 border-emerald-500/20">
                  <AlertDescription className="text-center text-foreground">
                    Você será redirecionado automaticamente...
                  </AlertDescription>
                </Alert>
              </CardContent>
            </>
          ) : (
            // Reset password form
            <>
              <CardHeader className="text-center space-y-1 pb-4">
                <CardTitle className="text-2xl font-bold">Nova senha</CardTitle>
                <CardDescription className="text-base">
                  Digite sua nova senha abaixo
                </CardDescription>
              </CardHeader>

              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">Nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => {
                          setPassword(e.target.value);
                          setErrors({});
                        }}
                        disabled={isLoading}
                        className="pl-10 pr-10 h-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="Repita a senha"
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setErrors({});
                        }}
                        disabled={isLoading}
                        className="pl-10 pr-10 h-11"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <Eye className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    className="w-full h-11 text-base font-semibold"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar nova senha"
                    )}
                  </Button>
                </form>
              </CardContent>

              <CardFooter className="flex justify-center pt-0">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Voltar para o login
                </Link>
              </CardFooter>
            </>
          )}
        </Card>

        <p className="text-xs text-center text-sidebar-foreground/40 mt-6">
          © 2024 Whasense. Todos os direitos reservados.
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
