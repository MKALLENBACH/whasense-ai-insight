import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line, ComposedChart } from "recharts";
import { TrendingUp } from "lucide-react";

interface MonthlyConversion {
  month: string;
  won: number;
  lost: number;
  rate: number;
}

interface MonthlyConversionChartProps {
  data: MonthlyConversion[];
}

export function MonthlyConversionChart({ data }: MonthlyConversionChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium mb-1">{item.month}</p>
          <p className="text-sm text-success">Ganhas: {item.won}</p>
          <p className="text-sm text-destructive">Perdidas: {item.lost}</p>
          <p className="text-sm text-primary font-medium">Conversão: {item.rate}%</p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          Conversão Mensal
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {data.some((d) => d.won > 0 || d.lost > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 12 }} />
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar yAxisId="left" dataKey="won" name="Ganhas" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="left" dataKey="lost" name="Perdidas" fill="hsl(0 84% 60%)" radius={[4, 4, 0, 0]} />
                <Line yAxisId="right" type="monotone" dataKey="rate" name="Taxa %" stroke="hsl(173 58% 39%)" strokeWidth={2} dot={{ r: 4 }} />
              </ComposedChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <p className="text-sm font-medium">Nenhuma venda no período</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
