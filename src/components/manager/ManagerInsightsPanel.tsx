import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { invokeFunction } from "@/lib/supabaseApi";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Clock,
  MessageSquare,
  AlertTriangle,
  Target,
  User,
  Calendar,
  FileText,
  CheckCircle2,
  XCircle,
  PauseCircle,
  BarChart3,
  Timer,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ManagerInsights {
  leadStatus: "pending" | "won" | "lost";
  customerName: string;
  sellerName: string;
  summary: string;
  reason_stuck: string | null;
  reason_won: string | null;
  reason_lost: string | null;
  timeline: Array<{ event: string; timestamp: string }>;
  key_objections: string[];
  key_events: string[];
  attention_points: string[];
  seller_performance: string;
  negotiation_stage: string;
  metrics: {
    totalMessages: number;
    incomingMessages: number;
    outgoingMessages: number;
    avgResponseTimeMinutes: number;
    criticalDelays: number;
  };
  saleReason: string | null;
}

interface ManagerInsightsPanelProps {
  customerId?: string;
  cycleId?: string;
}

const statusConfig = {
  pending: {
    label: "Em Andamento",
    color: "bg-warning text-warning-foreground",
    icon: PauseCircle,
  },
  won: {
    label: "Ganha",
    color: "bg-success text-success-foreground",
    icon: CheckCircle2,
  },
  lost: {
    label: "Perdida",
    color: "bg-destructive text-destructive-foreground",
    icon: XCircle,
  },
};

const ManagerInsightsPanel = ({ customerId, cycleId }: ManagerInsightsPanelProps) => {
  const [insights, setInsights] = useState<ManagerInsights | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (customerId || cycleId) {
      fetchManagerInsights();
    }
  }, [customerId, cycleId]);

  const fetchManagerInsights = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const body: { customerId?: string; cycleId?: string } = {};
      if (cycleId) {
        body.cycleId = cycleId;
      } else if (customerId) {
        body.customerId = customerId;
      }

      const { data, error: fnError } = await invokeFunction<ManagerInsights>("manager-insights", {
        body,
      });

      if (fnError) throw fnError;
      setInsights(data);
    } catch (err: any) {
      console.error("Error fetching manager insights:", err);
      setError(err.message || "Erro ao carregar insights");
      toast.error("Erro ao carregar insights gerenciais");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-80 lg:w-96 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Insights Gerenciais
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Analisando conversa...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !insights) {
    return (
      <div className="w-80 lg:w-96 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col h-full">
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Insights Gerenciais
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center text-muted-foreground">
            <AlertTriangle className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{error || "Não foi possível carregar os insights"}</p>
          </div>
        </div>
      </div>
    );
  }

  const StatusIcon = statusConfig[insights.leadStatus].icon;

  return (
    <div className="w-80 lg:w-96 flex-shrink-0 bg-card rounded-lg border border-border overflow-hidden flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <h3 className="font-semibold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          Insights Gerenciais
        </h3>
        <p className="text-xs text-muted-foreground mt-1">
          Visão estratégica para gestores
        </p>
      </div>

      <ScrollArea className="flex-1 p-4">
        <div className="space-y-4">
          {/* Status e Vendedor */}
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge className={cn("gap-1", statusConfig[insights.leadStatus].color)}>
                  <StatusIcon className="h-3 w-3" />
                  {statusConfig[insights.leadStatus].label}
                </Badge>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Vendedor</span>
                <span className="text-sm font-medium flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {insights.sellerName}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Estágio</span>
                <Badge variant="outline">{insights.negotiation_stage}</Badge>
              </div>
            </CardContent>
          </Card>

          {/* Resumo */}
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                Resumo da Negociação
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{insights.summary}</p>
            </CardContent>
          </Card>

          {/* Motivo específico baseado no status */}
          {insights.leadStatus === "pending" && insights.reason_stuck && (
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-warning">
                  <PauseCircle className="h-4 w-4" />
                  Por que está parada?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{insights.reason_stuck}</p>
              </CardContent>
            </Card>
          )}

          {insights.leadStatus === "won" && insights.reason_won && (
            <Card className="border-success/30 bg-success/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-success">
                  <TrendingUp className="h-4 w-4" />
                  O que levou ao sucesso?
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{insights.reason_won}</p>
              </CardContent>
            </Card>
          )}

          {insights.leadStatus === "lost" && insights.reason_lost && (
            <Card className="border-destructive/30 bg-destructive/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <TrendingDown className="h-4 w-4" />
                  Motivo da perda
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm">{insights.reason_lost}</p>
              </CardContent>
            </Card>
          )}

          {/* Métricas */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                Métricas
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-sm">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  <span>{insights.metrics.totalMessages} msgs</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Timer className="h-4 w-4 text-muted-foreground" />
                  <span>{insights.metrics.avgResponseTimeMinutes}min resp.</span>
                </div>
              </div>
              {insights.metrics.criticalDelays > 0 && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <span>{insights.metrics.criticalDelays} atraso(s) crítico(s)</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Performance do Vendedor */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Performance do Vendedor
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{insights.seller_performance}</p>
            </CardContent>
          </Card>

          {/* Pontos de Atenção */}
          {insights.attention_points.length > 0 && (
            <Card className="border-warning/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2 text-warning">
                  <AlertTriangle className="h-4 w-4" />
                  Pontos de Atenção
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {insights.attention_points.map((point, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <Zap className="h-3 w-3 mt-1 text-warning flex-shrink-0" />
                      {point}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Objeções */}
          {insights.key_objections.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Objeções Identificadas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1">
                  {insights.key_objections.map((obj, idx) => (
                    <Badge key={idx} variant="destructive" className="text-xs">
                      {obj}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Eventos Principais */}
          {insights.key_events.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap className="h-4 w-4 text-primary" />
                  Eventos Principais
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {insights.key_events.map((event, idx) => (
                    <li key={idx} className="text-sm flex items-start gap-2">
                      <CheckCircle2 className="h-3 w-3 mt-1 text-primary flex-shrink-0" />
                      {event}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {/* Timeline Resumida */}
          {insights.timeline.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  Cronologia Resumida
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {insights.timeline.slice(-5).map((item, idx) => (
                    <div key={idx} className="flex items-start gap-2 text-xs">
                      <Clock className="h-3 w-3 mt-0.5 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-muted-foreground">
                          {format(new Date(item.timestamp), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                        <p>{item.event}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ManagerInsightsPanel;
