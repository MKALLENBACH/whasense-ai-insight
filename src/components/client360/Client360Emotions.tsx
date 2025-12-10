import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { LineChart as LineChartIcon } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client360EmotionsProps {
  clientId: string;
  sellerId?: string; // If provided, filter by this seller only
}

const temperatureToNumber = (temp: string): number => {
  switch (temp) {
    case "hot": return 3;
    case "warm": return 2;
    case "cold": return 1;
    default: return 0;
  }
};

const sentimentToNumber = (sentiment: string): number => {
  switch (sentiment) {
    case "positive": return 3;
    case "neutral": return 2;
    case "negative": return 1;
    default: return 2;
  }
};

const Client360Emotions = ({ clientId, sellerId }: Client360EmotionsProps) => {
  const [data, setData] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchEmotions();
  }, [clientId, sellerId]);

  const fetchEmotions = async () => {
    setIsLoading(true);
    try {
      // For sellers, get messages where they interacted with this client
      // For managers, get all messages for this client
      let messagesQuery = supabase
        .from("messages")
        .select("id, timestamp")
        .order("timestamp", { ascending: true });
      
      if (sellerId) {
        messagesQuery = messagesQuery.eq("seller_id", sellerId).eq("client_id", clientId);
      } else {
        messagesQuery = messagesQuery.eq("client_id", clientId);
      }

      const { data: messages } = await messagesQuery;

      if (!messages || messages.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
      }

      const messageIds = messages.map(m => m.id);

      // Get insights
      const { data: insights } = await supabase
        .from("insights")
        .select("message_id, temperature, sentiment, created_at")
        .in("message_id", messageIds)
        .order("created_at", { ascending: true });

      if (!insights || insights.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // Build chart data
      const chartData = insights.map((insight: any) => ({
        date: format(new Date(insight.created_at), "dd/MM", { locale: ptBR }),
        temperatura: temperatureToNumber(insight.temperature),
        sentimento: sentimentToNumber(insight.sentiment),
      }));

      setData(chartData);
    } catch (error) {
      console.error("Error fetching emotions:", error);
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
          <LineChartIcon className="h-5 w-5" />
          Evolução de Emoções e Temperatura
        </CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="text-center py-12">
            <LineChartIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Sem dados de emoções disponíveis</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 4]} ticks={[1, 2, 3]} tickFormatter={(v) => {
                if (v === 1) return "Frio/Neg";
                if (v === 2) return "Morno/Neu";
                if (v === 3) return "Quente/Pos";
                return "";
              }} />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="temperatura" 
                stroke="hsl(var(--destructive))" 
                name="Temperatura"
                strokeWidth={2}
              />
              <Line 
                type="monotone" 
                dataKey="sentimento" 
                stroke="hsl(var(--primary))" 
                name="Sentimento"
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};

export default Client360Emotions;
