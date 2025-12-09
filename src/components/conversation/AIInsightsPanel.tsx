import { AIInsight } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Brain,
  Heart,
  Target,
  AlertTriangle,
  Lightbulb,
  TrendingUp,
  Copy,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";

interface AIInsightsPanelProps {
  insight: AIInsight;
  onUseSuggestion: (suggestion: string) => void;
}

const AIInsightsPanel = ({ insight, onUseSuggestion }: AIInsightsPanelProps) => {
  const handleCopySuggestion = (suggestion: string) => {
    navigator.clipboard.writeText(suggestion);
    toast.success("Sugestão copiada!");
  };

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Brain className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-sm">Insights da IA</h3>
            <p className="text-xs text-muted-foreground">Análise em tempo real</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Lead Temperature */}
        <Card className="border-none shadow-none bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Temperatura do Lead</span>
              <LeadTemperatureBadge temperature={insight.leadTemperature} size="sm" />
            </div>
          </CardContent>
        </Card>

        {/* Emotion */}
        <Card className="border-none shadow-none bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="text-sm font-medium">Emoção Detectada</span>
            </div>
            <p className="text-sm text-muted-foreground mb-2">{insight.emotion}</p>
            <Progress value={insight.emotionScore} className="h-2" />
            <p className="text-xs text-muted-foreground mt-1">{insight.emotionScore}% de confiança</p>
          </CardContent>
        </Card>

        {/* Purchase Intent */}
        <Card className="border-none shadow-none bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Intenção de Compra</span>
            </div>
            <div className="flex items-center gap-3">
              <Progress value={insight.purchaseIntent} className="h-3 flex-1" />
              <span
                className={cn(
                  "text-lg font-bold",
                  insight.purchaseIntent >= 70
                    ? "text-success"
                    : insight.purchaseIntent >= 40
                    ? "text-warning"
                    : "text-muted-foreground"
                )}
              >
                {insight.purchaseIntent}%
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Objections */}
        {insight.objections.length > 0 && (
          <Card className="border-none shadow-none bg-warning/5 border-l-2 border-l-warning">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                <span className="text-sm font-medium">Objeções Detectadas</span>
              </div>
              <ul className="space-y-1">
                {insight.objections.map((objection, index) => (
                  <li key={index} className="text-sm text-muted-foreground flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                    {objection}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Key Topics */}
        <Card className="border-none shadow-none bg-muted/50">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Tópicos Principais</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {insight.keyTopics.map((topic, index) => (
                <span
                  key={index}
                  className="px-2 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary"
                >
                  {topic}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Suggested Responses */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-semibold">Sugestões de Resposta</span>
          </div>
          {insight.suggestedResponses.map((suggestion, index) => (
            <Card
              key={index}
              className="border-primary/20 hover:border-primary/40 transition-colors cursor-pointer group"
            >
              <CardContent className="p-3">
                <p className="text-sm mb-2">{suggestion}</p>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="default"
                    className="h-7 text-xs"
                    onClick={() => onUseSuggestion(suggestion)}
                  >
                    <Lightbulb className="h-3 w-3 mr-1" />
                    Usar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => handleCopySuggestion(suggestion)}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copiar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AIInsightsPanel;
