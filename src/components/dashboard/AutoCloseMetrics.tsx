import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TimerOff } from "lucide-react";

interface AutoCloseMetricsProps {
  data: {
    total: number;
    last24h: number;
    last7days: number;
    last30days: number;
  };
}

export const AutoCloseMetrics = ({ data }: AutoCloseMetricsProps) => {
  if (data.total === 0 && data.last30days === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium flex items-center gap-2">
          <TimerOff className="h-5 w-5 text-muted-foreground" />
          Encerramentos Automáticos
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{data.last24h}</p>
            <p className="text-xs text-muted-foreground">Últimas 24h</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{data.last7days}</p>
            <p className="text-xs text-muted-foreground">Últimos 7 dias</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{data.last30days}</p>
            <p className="text-xs text-muted-foreground">Últimos 30 dias</p>
          </div>
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <p className="text-2xl font-bold text-foreground">{data.total}</p>
            <p className="text-xs text-muted-foreground">Total histórico</p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          Ciclos encerrados automaticamente por falta de resposta do cliente
        </p>
      </CardContent>
    </Card>
  );
};
