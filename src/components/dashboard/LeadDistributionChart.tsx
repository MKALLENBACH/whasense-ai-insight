import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Users, Thermometer } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface LeadDistributionChartProps {
  bySeller: { name: string; pending: number; inProgress: number }[];
  byTemperature: { temperature: string; count: number }[];
}

const TEMPERATURE_COLORS = {
  Quente: "hsl(0 84% 60%)",
  Morno: "hsl(38 92% 50%)",
  Frio: "hsl(210 90% 55%)",
};

const SELLER_COLORS = [
  "hsl(173 58% 39%)",
  "hsl(38 92% 50%)",
  "hsl(210 90% 55%)",
  "hsl(142 71% 45%)",
  "hsl(280 65% 60%)",
];

export function LeadDistributionChart({ bySeller, byTemperature }: LeadDistributionChartProps) {
  const temperatureData = byTemperature.filter((t) => t.count > 0);
  const sellerData = bySeller.map((s) => ({
    ...s,
    total: s.pending + s.inProgress,
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0].name}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} leads
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          Distribuição de Leads
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="seller" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="seller" className="text-xs">
              Por Vendedor
            </TabsTrigger>
            <TabsTrigger value="temperature" className="text-xs">
              Por Temperatura
            </TabsTrigger>
          </TabsList>

          <TabsContent value="seller" className="h-[280px]">
            {sellerData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sellerData} layout="horizontal">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                  <XAxis
                    type="category"
                    dataKey="name"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    type="number"
                    tick={{ fontSize: 11 }}
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip 
                    content={({ active, payload, label }) => {
                      if (active && payload && payload.length) {
                        return (
                          <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                            <p className="font-medium mb-2">{label}</p>
                            {payload.map((entry: any, index: number) => (
                              <p key={index} className="text-sm" style={{ color: entry.color }}>
                                {entry.name}: {entry.value} leads
                              </p>
                            ))}
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    height={36}
                    formatter={(value) => <span className="text-xs text-foreground">{value}</span>}
                  />
                  <Bar
                    dataKey="pending"
                    name="Pendentes"
                    fill="hsl(38 92% 50%)"
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  />
                  <Bar
                    dataKey="inProgress"
                    name="Em Progresso"
                    fill="hsl(173 58% 39%)"
                    radius={[4, 4, 0, 0]}
                    barSize={32}
                  />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhum lead distribuído
              </div>
            )}
          </TabsContent>

          <TabsContent value="temperature" className="h-[280px]">
            {temperatureData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={temperatureData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="temperature"
                    label={({ temperature, percent }) =>
                      `${temperature} ${(percent * 100).toFixed(0)}%`
                    }
                  >
                    {temperatureData.map((entry) => (
                      <Cell
                        key={entry.temperature}
                        fill={TEMPERATURE_COLORS[entry.temperature as keyof typeof TEMPERATURE_COLORS]}
                      />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                Nenhum lead ativo
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
