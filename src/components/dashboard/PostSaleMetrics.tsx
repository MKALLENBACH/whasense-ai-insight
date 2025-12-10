import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { HeadphonesIcon, Clock, MessageCircle, TrendingUp, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PostSaleMetricsData {
  totalCycles: number;
  activeCycles: number;
  closedCycles: number;
  avgResolutionTime: number; // in hours
  topIssues: { issue: string; count: number }[];
  satisfactionTrend: "positive" | "neutral" | "negative";
}

interface PostSaleMetricsProps {
  data: PostSaleMetricsData;
}

export function PostSaleMetrics({ data }: PostSaleMetricsProps) {
  const satisfactionConfig = {
    positive: { label: "Positiva", color: "text-success", bg: "bg-success/10" },
    neutral: { label: "Neutra", color: "text-warning", bg: "bg-warning/10" },
    negative: { label: "Negativa", color: "text-destructive", bg: "bg-destructive/10" },
  };

  const satisfactionInfo = satisfactionConfig[data.satisfactionTrend];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <HeadphonesIcon className="h-5 w-5 text-blue-500" />
          Atendimentos Pós-venda
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Main KPIs */}
        <div className="grid grid-cols-4 gap-3">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{data.totalCycles}</p>
            <p className="text-xs text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-3 bg-blue-500/10 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">{data.activeCycles}</p>
            <p className="text-xs text-muted-foreground">Em Andamento</p>
          </div>
          <div className="text-center p-3 bg-success/10 rounded-lg">
            <p className="text-2xl font-bold text-success">{data.closedCycles}</p>
            <p className="text-xs text-muted-foreground">Concluídos</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <p className="text-xl font-bold text-foreground">{data.avgResolutionTime}h</p>
            </div>
            <p className="text-xs text-muted-foreground">Tempo Médio</p>
          </div>
        </div>

        {/* Satisfaction Trend */}
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Tendência de Satisfação</span>
          </div>
          <span className={cn("text-sm font-medium px-2 py-1 rounded", satisfactionInfo.bg, satisfactionInfo.color)}>
            {satisfactionInfo.label}
          </span>
        </div>

        {/* Top Issues */}
        {data.topIssues.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <MessageCircle className="h-4 w-4" />
              Principais Dúvidas/Problemas
            </p>
            <div className="space-y-1">
              {data.topIssues.slice(0, 5).map((issue, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <span className="text-foreground truncate flex-1">{issue.issue}</span>
                  <span className="text-muted-foreground ml-2">{issue.count}x</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.totalCycles === 0 && (
          <p className="text-sm text-muted-foreground text-center py-2">
            Nenhum atendimento pós-venda registrado ainda.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
