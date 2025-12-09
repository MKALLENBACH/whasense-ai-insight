import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

interface Client360ObjectionsProps {
  clientId: string;
}

const objectionLabels: Record<string, string> = {
  price: "Preço",
  delay: "Prazo",
  trust: "Confiança",
  doubt: "Dúvidas",
  none: "Nenhuma",
};

const Client360Objections = ({ clientId }: Client360ObjectionsProps) => {
  const [data, setData] = useState<{ name: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchObjections();
  }, [clientId]);

  const fetchObjections = async () => {
    setIsLoading(true);
    try {
      // Get all message IDs for this client
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("client_id", clientId);

      if (!messages || messages.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
      }

      const messageIds = messages.map(m => m.id);

      // Get insights with objections
      const { data: insights } = await supabase
        .from("insights")
        .select("objection")
        .in("message_id", messageIds)
        .not("objection", "is", null)
        .neq("objection", "none");

      if (!insights) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // Count objections
      const objectionCounts: Record<string, number> = {};
      insights.forEach((insight: any) => {
        const obj = insight.objection;
        if (obj && obj !== "none") {
          objectionCounts[obj] = (objectionCounts[obj] || 0) + 1;
        }
      });

      // Convert to chart data
      const chartData = Object.entries(objectionCounts)
        .map(([key, count]) => ({
          name: objectionLabels[key] || key,
          count,
        }))
        .sort((a, b) => b.count - a.count);

      setData(chartData);
    } catch (error) {
      console.error("Error fetching objections:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Objeções Recorrentes
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-12">
            <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma objeção registrada</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={100} />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(var(--warning))" name="Ocorrências" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default Client360Objections;
