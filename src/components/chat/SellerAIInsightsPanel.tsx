import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  Loader2, 
  Smile, 
  Frown, 
  Meh, 
  Angry, 
  HelpCircle, 
  Sparkles,
  Target,
  AlertTriangle,
  Thermometer,
  Lightbulb,
  ArrowRight,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ImageInsightsCard from "@/components/conversation/ImageInsightsCard";

export interface AIAnalysis {
  sales_stage?: string;
  sentiment: string;
  intention: number;
  objection: string;
  temperature: string;
  analysis?: string;
  suggestion: string;
  next_action: string;
}

const sentimentConfig: Record<string, { icon: typeof Smile; label: string; color: string }> = {
  positive: { icon: Smile, label: "Positivo", color: "text-success" },
  excited: { icon: Sparkles, label: "Empolgado", color: "text-success" },
  neutral: { icon: Meh, label: "Neutro", color: "text-muted-foreground" },
  negative: { icon: Frown, label: "Negativo", color: "text-warning" },
  angry: { icon: Angry, label: "Irritado", color: "text-destructive" },
  insecure: { icon: HelpCircle, label: "Inseguro", color: "text-warning" },
};

const objectionLabels: Record<string, string> = {
  price: "Preço alto",
  delay: "Prazo de entrega",
  trust: "Falta de confiança",
  doubt: "Dúvidas sobre o produto",
  complaint: "Reclamação",
  competition: "Concorrência",
  quality: "Qualidade",
  support: "Suporte",
  delivery: "Entrega",
  defect: "Defeito",
  refund: "Reembolso",
  exchange: "Troca",
  problem: "Problema",
  question: "Dúvida",
  none: "Nenhuma objeção",
  preco: "Preço alto",
  prazo: "Prazo de entrega",
  confianca: "Falta de confiança",
  duvida: "Dúvidas sobre o produto",
  reclamacao: "Reclamação",
  concorrencia: "Concorrência",
  problema: "Problema com produto",
  nenhuma: "Nenhuma objeção",
};

const temperatureConfig: Record<string, { label: string; color: string }> = {
  hot: { label: "Quente", color: "bg-destructive text-destructive-foreground" },
  warm: { label: "Morno", color: "bg-warning text-warning-foreground" },
  cold: { label: "Frio", color: "bg-muted text-muted-foreground" },
  quente: { label: "Quente", color: "bg-destructive text-destructive-foreground" },
  morno: { label: "Morno", color: "bg-warning text-warning-foreground" },
  frio: { label: "Frio", color: "bg-muted text-muted-foreground" },
};

interface SellerAIInsightsPanelProps {
  isAnalyzing: boolean;
  aiAnalysis: AIAnalysis | null;
  imageInsights: Array<{ imageUrl: string; data: any }>;
  onUseSuggestion: () => void;
}

const SellerAIInsightsPanel = ({
  isAnalyzing,
  aiAnalysis,
  imageInsights,
  onUseSuggestion,
}: SellerAIInsightsPanelProps) => {
  const sentimentInfo = sentimentConfig[aiAnalysis?.sentiment || "neutral"] || sentimentConfig.neutral;
  const SentimentIcon = sentimentInfo.icon;
  const tempInfo = temperatureConfig[aiAnalysis?.temperature || "cold"] || temperatureConfig.cold;

  return (
    <div className="flex-1 bg-card rounded-lg border border-border overflow-hidden flex flex-col">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Insights da IA
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Análise automática em tempo real
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        {isAnalyzing ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Analisando mensagem...</p>
            </div>
          </div>
        ) : aiAnalysis ? (
          <div className="space-y-4">
            {/* Sentiment */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <SentimentIcon className={cn("h-4 w-4", sentimentInfo.color)} />
                  Emoção do Cliente
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge variant="outline" className={sentimentInfo.color}>
                  {sentimentInfo.label}
                </Badge>
              </CardContent>
            </Card>

            {/* Purchase Intent */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Target className="h-4 w-4 text-primary" />
                  Intenção de Compra
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${aiAnalysis.intention}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold">{aiAnalysis.intention}%</span>
                </div>
              </CardContent>
            </Card>

            {/* Objection */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Objeção Detectada
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge 
                  variant={aiAnalysis.objection === "none" ? "secondary" : "destructive"}
                >
                  {objectionLabels[aiAnalysis.objection] || aiAnalysis.objection}
                </Badge>
              </CardContent>
            </Card>

            {/* Temperature */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Thermometer className="h-4 w-4 text-primary" />
                  Temperatura do Lead
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Badge className={tempInfo.color}>
                  {tempInfo.label}
                </Badge>
              </CardContent>
            </Card>

            <Separator />

            {/* Suggestion */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  Sugestão de Resposta
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{aiAnalysis.suggestion}</p>
                <Button
                  variant="default"
                  size="sm"
                  onClick={onUseSuggestion}
                  className="w-full gap-2"
                >
                  <Copy className="h-4 w-4" />
                  Usar sugestão da IA
                </Button>
              </CardContent>
            </Card>

            {/* Next Action */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ArrowRight className="h-4 w-4 text-success" />
                  Próxima Ação
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{aiAnalysis.next_action}</p>
              </CardContent>
            </Card>

            {/* Image Insights */}
            {imageInsights.length > 0 && (
              <div className="space-y-2">
                <Separator />
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  📷 Análises de Imagens
                </h4>
                {imageInsights.slice(-3).map((img, idx) => (
                  <ImageInsightsCard
                    key={idx}
                    imageUrl={img.imageUrl}
                    analysisData={img.data}
                    isSeller={img.data?.detected_type === "seller"}
                  />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <div className="text-center">
              <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aguardando mensagem do cliente</p>
              <p className="text-xs mt-1">Os insights aparecerão automaticamente</p>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
};

export default SellerAIInsightsPanel;
