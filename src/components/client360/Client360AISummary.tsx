import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Brain, Sparkles, RefreshCw, AlertTriangle, TrendingUp, Users, Target } from "lucide-react";
import { toast } from "sonner";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
}

interface AISummary {
  perfil_empresa: string;
  numero_de_compradores: number;
  interesse_geral: string;
  objecoes_recorrentes: string[];
  temperatura_media: string;
  emocao_predominante: string;
  vendedores_que_atendem: string[];
  risco_churn: string;
  resumo_executivo: string;
  proximos_passos_sugeridos: string;
}

interface Client360AISummaryProps {
  clientId: string;
  client: Client;
}

const Client360AISummary = ({ clientId, client }: Client360AISummaryProps) => {
  const [summary, setSummary] = useState<AISummary | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const generateSummary = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("client-360-summary", {
        body: { clientId },
      });

      if (error) throw error;

      setSummary(data);
      toast.success("Resumo 360° gerado com sucesso!");
    } catch (error) {
      console.error("Error generating summary:", error);
      toast.error("Erro ao gerar resumo");
    } finally {
      setIsLoading(false);
    }
  };

  const riskColors: Record<string, string> = {
    baixo: "bg-success text-success-foreground",
    medio: "bg-warning text-warning-foreground",
    alto: "bg-destructive text-destructive-foreground",
  };

  const interestColors: Record<string, string> = {
    baixo: "text-muted-foreground",
    medio: "text-warning",
    alto: "text-success",
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Resumo Inteligente 360°
          </CardTitle>
          <Button onClick={generateSummary} disabled={isLoading}>
            {isLoading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Gerando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Gerar Resumo
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {!summary && !isLoading ? (
          <div className="text-center py-12">
            <Brain className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold mb-2">Resumo 360° com IA</h3>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Clique em "Gerar Resumo" para obter uma análise completa deste cliente,
              incluindo perfil, interesse, riscos e próximos passos sugeridos.
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : summary ? (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Users className="h-4 w-4 text-primary" />
                  <span className="text-xs text-muted-foreground">Compradores</span>
                </div>
                <p className="text-xl font-bold">{summary.numero_de_compradores}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Target className="h-4 w-4 text-success" />
                  <span className="text-xs text-muted-foreground">Interesse</span>
                </div>
                <p className={`text-xl font-bold capitalize ${interestColors[summary.interesse_geral]}`}>
                  {summary.interesse_geral}
                </p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-warning" />
                  <span className="text-xs text-muted-foreground">Temperatura</span>
                </div>
                <p className="text-xl font-bold capitalize">{summary.temperatura_media}</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  <span className="text-xs text-muted-foreground">Risco Churn</span>
                </div>
                <Badge className={riskColors[summary.risco_churn]}>
                  {summary.risco_churn}
                </Badge>
              </div>
            </div>

            {/* Profile */}
            <div>
              <h4 className="font-semibold mb-2">Perfil da Empresa</h4>
              <p className="text-sm text-muted-foreground">{summary.perfil_empresa}</p>
            </div>

            {/* Executive Summary */}
            <div className="bg-primary/5 p-4 rounded-lg border border-primary/20">
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Resumo Executivo
              </h4>
              <p className="text-sm">{summary.resumo_executivo}</p>
            </div>

            {/* Objections */}
            {summary.objecoes_recorrentes.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Objeções Recorrentes</h4>
                <div className="flex flex-wrap gap-2">
                  {summary.objecoes_recorrentes.map((obj, i) => (
                    <Badge key={i} variant="secondary">{obj}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Next Steps */}
            <div className="bg-success/5 p-4 rounded-lg border border-success/20">
              <h4 className="font-semibold mb-2 text-success">Próximos Passos Sugeridos</h4>
              <p className="text-sm">{summary.proximos_passos_sugeridos}</p>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
};

export default Client360AISummary;
