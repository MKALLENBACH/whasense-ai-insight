import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MessageSquareWarning } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ObjectionData {
  type: string;
  count: number;
}

const OBJECTION_LABELS: Record<string, string> = {
  preco: "Preço",
  prazo: "Prazo",
  confianca: "Confiança",
  duvida: "Dúvida",
  reclamacao: "Reclamação",
  concorrencia: "Concorrência",
  problema: "Problema",
  nenhuma: "Nenhuma",
  // Legacy English values
  price: "Preço",
  delay: "Prazo",
  trust: "Confiança",
  doubt: "Dúvida",
  competition: "Concorrência",
  problem: "Problema",
  none: "Nenhuma",
};

export function ObjectionsChart() {
  const { user } = useAuth();
  const [period, setPeriod] = useState<string>("30");
  const [data, setData] = useState<ObjectionData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchObjections = async () => {
      if (!user?.companyId) return;

      setIsLoading(true);
      try {
        // Calculate date range
        const now = new Date();
        const daysAgo = parseInt(period);
        const startDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

        // Get all sellers in the company
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("company_id", user.companyId);

        const sellerIds = profiles?.map((p) => p.user_id) || [];

        if (sellerIds.length === 0) {
          setData([]);
          setIsLoading(false);
          return;
        }

        // Get messages from these sellers within the period
        const { data: messages } = await supabase
          .from("messages")
          .select("id")
          .in("seller_id", sellerIds)
          .gte("timestamp", startDate.toISOString());

        const messageIds = messages?.map((m) => m.id) || [];

        if (messageIds.length === 0) {
          setData([]);
          setIsLoading(false);
          return;
        }

        // Get insights with objections from these messages
        const { data: insights } = await supabase
          .from("insights")
          .select("objection, created_at")
          .in("message_id", messageIds)
          .not("objection", "is", null)
          .gte("created_at", startDate.toISOString());

        // Count objections
        const objectionCounts: Record<string, number> = {};
        
        insights?.forEach((insight) => {
          if (insight.objection && insight.objection !== "nenhuma" && insight.objection !== "none") {
            const normalizedKey = insight.objection.toLowerCase().trim();
            const label = OBJECTION_LABELS[normalizedKey] || normalizedKey;
            objectionCounts[label] = (objectionCounts[label] || 0) + 1;
          }
        });

        // Convert to array and sort by count
        const sortedData = Object.entries(objectionCounts)
          .map(([type, count]) => ({ type, count }))
          .filter((o) => o.count > 0)
          .sort((a, b) => b.count - a.count)
          .slice(0, 6); // Top 6 objections

        setData(sortedData);
      } catch (error) {
        console.error("Error fetching objections:", error);
        setData([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchObjections();
  }, [user?.companyId, period]);

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

  const getPeriodLabel = (days: string) => {
    switch (days) {
      case "30": return "Últimos 30 dias";
      case "180": return "Últimos 6 meses";
      case "365": return "Últimos 12 meses";
      default: return "Últimos 30 dias";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquareWarning className="h-5 w-5 text-warning" />
          Principais Objeções de Vendas
        </CardTitle>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[160px] h-8 text-xs">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="180">Últimos 6 meses</SelectItem>
            <SelectItem value="365">Últimos 12 meses</SelectItem>
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              Carregando...
            </div>
          ) : data.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" vertical={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} allowDecimals={false} />
                <YAxis
                  type="category"
                  dataKey="type"
                  tick={{ fontSize: 11 }}
                  width={90}
                  tickLine={false}
                  axisLine={false}
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
                {getPeriodLabel(period)}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
