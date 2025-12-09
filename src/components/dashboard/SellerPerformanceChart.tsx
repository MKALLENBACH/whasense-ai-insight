import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Users2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface SellerPerformance {
  id: string;
  name: string;
  totalLeads: number;
  wonSales: number;
  lostSales: number;
  conversionRate: number;
  avgResponseTime: number;
  hotLeadsHandled: number;
}

interface SellerPerformanceChartProps {
  data: SellerPerformance[];
}

export function SellerPerformanceChart({ data }: SellerPerformanceChartProps) {
  const chartData = data.map((s) => ({
    name: s.name.split(" ")[0],
    fullName: s.name,
    ganhas: s.wonSales,
    perdidas: s.lostSales,
    conversão: s.conversionRate,
    leads: s.totalLeads,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const seller = data.find((s) => s.name.startsWith(payload[0].payload.name));
      if (seller) {
        return (
          <div className="bg-card border border-border rounded-lg p-4 shadow-lg">
            <p className="font-semibold mb-2">{seller.name}</p>
            <div className="space-y-1 text-sm">
              <p className="text-success">Ganhas: {seller.wonSales}</p>
              <p className="text-destructive">Perdidas: {seller.lostSales}</p>
              <p className="text-muted-foreground">Total leads: {seller.totalLeads}</p>
              <p className="text-primary font-medium">Conversão: {seller.conversionRate}%</p>
              <p className="text-muted-foreground">
                Tempo resposta: {seller.avgResponseTime} min
              </p>
            </div>
          </div>
        );
      }
    }
    return null;
  };

  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Users2 className="h-5 w-5 text-primary" />
            Desempenho por Vendedor
          </span>
          <Badge variant="outline">{data.length} vendedores</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar
                  dataKey="ganhas"
                  name="Vendas Ganhas"
                  fill="hsl(142 71% 45%)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="perdidas"
                  name="Vendas Perdidas"
                  fill="hsl(0 84% 60%)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Users2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nenhum vendedor com dados</p>
              <p className="text-xs text-muted-foreground mt-1">
                Os dados de desempenho aparecerão aqui
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
