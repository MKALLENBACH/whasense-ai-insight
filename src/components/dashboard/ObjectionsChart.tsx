import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MessageSquareWarning } from "lucide-react";

interface ObjectionData {
  type: string;
  count: number;
}

interface ObjectionsChartProps {
  data: ObjectionData[];
}

export function ObjectionsChart({ data }: ObjectionsChartProps) {
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium capitalize">{payload[0].payload.type}</p>
          <p className="text-sm text-muted-foreground">
            {payload[0].value} ocorrências
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <MessageSquareWarning className="h-5 w-5 text-warning" />
          Principais Objeções
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis type="number" tick={{ fontSize: 12 }} />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fontSize: 12 }}
                  width={100}
                  tickFormatter={(value) => value.charAt(0).toUpperCase() + value.slice(1)}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar
                  dataKey="count"
                  fill="hsl(25 95% 53%)"
                  radius={[0, 4, 4, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <MessageSquareWarning className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nenhuma objeção registrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                As objeções aparecerão aqui
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
