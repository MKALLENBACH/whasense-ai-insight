import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from "recharts";
import { TrendingUp } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface SalesTimelinePoint {
  date: string;
  won: number;
  lost: number;
}

interface SalesTimelineChartProps {
  data: SalesTimelinePoint[];
}

export function SalesTimelineChart({ data }: SalesTimelineChartProps) {
  const chartData = data.map((d) => ({
    ...d,
    dateLabel: format(parseISO(d.date), "dd/MM", { locale: ptBR }),
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = chartData.find((d) => d.dateLabel === label);
      if (item) {
        return (
          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
            <p className="font-medium mb-1">
              {format(parseISO(item.date), "dd 'de' MMMM", { locale: ptBR })}
            </p>
            <p className="text-sm text-success">Ganhas: {item.won}</p>
            <p className="text-sm text-destructive">Perdidas: {item.lost}</p>
          </div>
        );
      }
    }
    return null;
  };

  const totalWon = data.reduce((acc, d) => acc + d.won, 0);
  const totalLost = data.reduce((acc, d) => acc + d.lost, 0);

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Timeline de Vendas (30 dias)
          </span>
          <div className="flex items-center gap-4 text-sm">
            <span className="text-success font-medium">{totalWon} ganhas</span>
            <span className="text-destructive font-medium">{totalLost} perdidas</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {data.some((d) => d.won > 0 || d.lost > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="wonGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="lostGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(0 84% 60%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(0 84% 60%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="dateLabel"
                  tick={{ fontSize: 10 }}
                  interval="preserveStartEnd"
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey="won"
                  stroke="hsl(142 71% 45%)"
                  strokeWidth={2}
                  fill="url(#wonGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="lost"
                  stroke="hsl(0 84% 60%)"
                  strokeWidth={2}
                  fill="url(#lostGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <TrendingUp className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nenhuma venda no período</p>
              <p className="text-xs text-muted-foreground mt-1">
                O gráfico será atualizado com as vendas
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
