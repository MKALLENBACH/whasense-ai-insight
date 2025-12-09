import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MessageSquare,
  Mic,
  AlertTriangle,
  TrendingUp,
  Trophy,
  XCircle,
  Thermometer,
  Bell,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface TimelineEvent {
  id: string;
  type: "message" | "audio" | "insight" | "objection" | "cycle_open" | "cycle_close" | "sale" | "temperature_change";
  timestamp: string;
  buyerName?: string;
  buyerId?: string;
  content: string;
  metadata?: Record<string, any>;
}

interface Client360TimelineProps {
  clientId: string;
}

const eventTypeConfig: Record<string, { icon: typeof MessageSquare; color: string; label: string }> = {
  message: { icon: MessageSquare, color: "text-blue-500 bg-blue-500/10", label: "Mensagem" },
  audio: { icon: Mic, color: "text-purple-500 bg-purple-500/10", label: "Áudio" },
  insight: { icon: TrendingUp, color: "text-primary bg-primary/10", label: "Insight" },
  objection: { icon: AlertTriangle, color: "text-warning bg-warning/10", label: "Objeção" },
  cycle_open: { icon: TrendingUp, color: "text-blue-500 bg-blue-500/10", label: "Ciclo Aberto" },
  cycle_close: { icon: Trophy, color: "text-success bg-success/10", label: "Ciclo Fechado" },
  sale: { icon: Trophy, color: "text-success bg-success/10", label: "Venda" },
  temperature_change: { icon: Thermometer, color: "text-destructive bg-destructive/10", label: "Temperatura" },
};

const Client360Timeline = ({ clientId }: Client360TimelineProps) => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);

  useEffect(() => {
    fetchTimeline();
  }, [clientId]);

  const fetchTimeline = async () => {
    setIsLoading(true);
    try {
      const timelineEvents: TimelineEvent[] = [];

      // Fetch messages
      const { data: messages } = await supabase
        .from("messages")
        .select("id, content, timestamp, direction, buyer_id")
        .eq("client_id", clientId)
        .order("timestamp", { ascending: false })
        .limit(100);

      if (messages) {
        messages.forEach((msg: any) => {
          timelineEvents.push({
            id: msg.id,
            type: "message",
            timestamp: msg.timestamp,
            buyerId: msg.buyer_id || undefined,
            content: msg.content?.substring(0, 100) + (msg.content?.length > 100 ? "..." : "") || "[Mídia]",
            metadata: { direction: msg.direction },
          });
        });
      }

      // Fetch cycles
      const { data: cycles } = await supabase
        .from("sale_cycles")
        .select("id, status, created_at, closed_at, lost_reason, won_summary, buyer_id")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (cycles) {
        cycles.forEach((cycle: any) => {
          // Cycle opened
          timelineEvents.push({
            id: `${cycle.id}-open`,
            type: "cycle_open",
            timestamp: cycle.created_at,
            buyerId: cycle.buyer_id || undefined,
            content: "Novo ciclo de venda iniciado",
          });

          // Cycle closed
          if (cycle.closed_at) {
            timelineEvents.push({
              id: `${cycle.id}-close`,
              type: cycle.status === "won" ? "sale" : "cycle_close",
              timestamp: cycle.closed_at,
              buyerId: cycle.buyer_id || undefined,
              content: cycle.status === "won" 
                ? `Venda concluída: ${cycle.won_summary || ""}` 
                : `Ciclo perdido: ${cycle.lost_reason || "Sem motivo"}`,
              metadata: { status: cycle.status },
            });
          }
        });
      }

      // Sort by timestamp
      timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      setEvents(timelineEvents);
    } catch (error) {
      console.error("Error fetching timeline:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredEvents = filter 
    ? events.filter(e => e.type === filter)
    : events;

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          {[1, 2, 3, 4, 5].map(i => (
            <Skeleton key={i} className="h-20 w-full mb-4" />
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Timeline 360°
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={filter === null ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter(null)}
            >
              Todos
            </Button>
            <Button
              variant={filter === "message" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("message")}
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant={filter === "sale" ? "default" : "outline"}
              size="sm"
              onClick={() => setFilter("sale")}
            >
              <Trophy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[500px] pr-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum evento encontrado</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredEvents.map((event, index) => {
                const config = eventTypeConfig[event.type];
                const Icon = config.icon;
                
                return (
                  <div key={event.id} className="flex gap-4">
                    {/* Timeline line */}
                    <div className="flex flex-col items-center">
                      <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", config.color)}>
                        <Icon className="h-5 w-5" />
                      </div>
                      {index < filteredEvents.length - 1 && (
                        <div className="w-0.5 flex-1 bg-border mt-2" />
                      )}
                    </div>
                    
                    {/* Content */}
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="secondary" className="text-xs">
                          {config.label}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {format(new Date(event.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                        </span>
                      </div>
                      <p className="text-sm">{event.content}</p>
                      {event.buyerName && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Comprador: {event.buyerName}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

export default Client360Timeline;
