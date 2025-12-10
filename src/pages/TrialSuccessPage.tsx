import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, Zap, CheckCircle, Mail } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const TrialSuccessPage = () => {
  const navigate = useNavigate();
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          navigate("/login");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-lg">
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
          <CardContent className="pt-8 pb-8 text-center">
            <div className="flex justify-center mb-6">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/20">
                <CheckCircle className="h-12 w-12 text-primary" />
              </div>
            </div>

            <h2 className="text-2xl font-bold text-card-foreground mb-2">
              Conta criada com sucesso! 🎉
            </h2>
            
            <p className="text-muted-foreground mb-6">
              Seu período de teste de 7 dias começou. Você tem acesso completo a todas as funcionalidades.
            </p>

            <div className="bg-muted/50 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Mail className="h-5 w-5 text-primary" />
                <span className="font-medium text-card-foreground">Verifique seu e-mail</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Enviamos suas credenciais de acesso para o e-mail cadastrado. 
                Use a senha temporária para fazer seu primeiro login.
              </p>
            </div>

            <Button
              variant="hero"
              className="w-full mb-4"
              onClick={() => navigate("/login")}
            >
              Ir para o Login
            </Button>

            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Redirecionando em {countdown}s...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default TrialSuccessPage;
