import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Zap, Sparkles, Check } from "lucide-react";
import { toast } from "sonner";

const TrialPage = () => {
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const createTrialCheckout = async () => {
      try {
        const origin = window.location.origin;
        
        const { data, error: fnError } = await supabase.functions.invoke("create-trial-checkout", {
          body: {
            successUrl: `${origin}/trial-success`,
            cancelUrl: `${origin}/login`,
          },
        });

        if (fnError) throw fnError;

        if (data?.url) {
          window.location.href = data.url;
        } else {
          throw new Error("URL do checkout não retornada");
        }
      } catch (err) {
        console.error("Error creating trial checkout:", err);
        setError(err instanceof Error ? err.message : "Erro ao criar checkout");
        setIsLoading(false);
        toast.error("Erro ao iniciar período de teste");
      }
    };

    createTrialCheckout();
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/20 mx-auto mb-4">
            <Zap className="h-8 w-8 text-destructive" />
          </div>
          <h1 className="text-2xl font-bold text-sidebar-foreground mb-2">Erro</h1>
          <p className="text-sidebar-foreground/60 mb-4">{error}</p>
          <a
            href="/login"
            className="text-primary hover:underline"
          >
            Voltar para login
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sidebar via-sidebar to-primary/20 flex items-center justify-center p-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="relative text-center max-w-lg">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary shadow-glow">
            <Zap className="h-8 w-8 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-sidebar-foreground">Whasense</h1>
            <p className="text-sm text-sidebar-foreground/60">Inteligência em vendas via WhatsApp</p>
          </div>
        </div>

        <div className="bg-card/95 backdrop-blur-sm border-none shadow-2xl rounded-xl p-8">
          <div className="flex items-center justify-center gap-2 mb-6">
            <Sparkles className="h-6 w-6 text-primary" />
            <h2 className="text-xl font-bold text-card-foreground">
              Iniciando seu período de teste
            </h2>
          </div>

          <div className="space-y-3 mb-8 text-left">
            <div className="flex items-center gap-3 text-muted-foreground">
              <Check className="h-5 w-5 text-primary flex-shrink-0" />
              <span>7 dias grátis com acesso completo</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Check className="h-5 w-5 text-primary flex-shrink-0" />
              <span>Todas as funcionalidades liberadas</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Check className="h-5 w-5 text-primary flex-shrink-0" />
              <span>Análise de IA em tempo real</span>
            </div>
            <div className="flex items-center gap-3 text-muted-foreground">
              <Check className="h-5 w-5 text-primary flex-shrink-0" />
              <span>Cancele a qualquer momento</span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-muted-foreground">Redirecionando para o checkout seguro...</p>
          </div>

          <p className="text-xs text-muted-foreground/60 mt-6">
            Após o período de teste, sua assinatura será convertida automaticamente para o plano Starter (R$147/mês).
            Você pode cancelar a qualquer momento durante o período de teste.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialPage;
