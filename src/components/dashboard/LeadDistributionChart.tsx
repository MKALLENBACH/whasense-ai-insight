import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend } from "recharts";
import { Users } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  "hsl(320 65% 55%)",
  "hsl(200 70% 50%)",
];

export function LeadDistributionChart({ bySeller, byTemperature }: LeadDistributionChartProps) {
  const [selectedSeller, setSelectedSeller] = useState<string>("all");
  
  const temperatureData = byTemperature.filter((t) => t.count > 0);
  const sellerData = bySeller.map((s) => ({
    ...s,
    total: s.pending + s.inProgress,
  }));

  // Data for when a specific seller is selected (shows pending/inProgress breakdown)
  const selectedSellerData = selectedSeller !== "all" 
    ? sellerData.filter(s => s.name === selectedSeller)
    : null;

  // Data for general view (all sellers, just total)
  const generalData = sellerData.map((s, index) => ({
    name: s.name,
    total: s.total,
    fill: SELLER_COLORS[index % SELLER_COLORS.length],
  }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium">{payload[0].name || payload[0].payload?.name}</p>
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

          <TabsContent value="seller" className="space-y-4">
            <Select value={selectedSeller} onValueChange={setSelectedSeller}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione um vendedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os vendedores</SelectItem>
                {sellerData.map((seller) => (
                  <SelectItem key={seller.name} value={seller.name}>
                    {seller.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="h-[240px]">
              {sellerData.length > 0 ? (
                selectedSeller === "all" ? (
                  // General view - all sellers, just total
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={generalData} layout="horizontal">
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
                      <Tooltip content={<CustomTooltip />} />
                      <Bar
                        dataKey="total"
                        name="Total de Leads"
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                      >
                        {generalData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  // Specific seller view - shows pending/inProgress breakdown
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={selectedSellerData} layout="horizontal">
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
                        barSize={40}
                      />
                      <Bar
                        dataKey="inProgress"
                        name="Em Progresso"
                        fill="hsl(173 58% 39%)"
                        radius={[4, 4, 0, 0]}
                        barSize={40}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                )
              ) : (
                <div className="h-full flex items-center justify-center text-muted-foreground">
                  Nenhum lead distribuído
                </div>
              )}
            </div>
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
