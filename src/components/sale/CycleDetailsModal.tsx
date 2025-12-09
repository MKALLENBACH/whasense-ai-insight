import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Loader2, Trophy, XCircle, Clock, MessageSquare, Flame, ThermometerSun, Snowflake, Calendar, User, ChartBar } from "lucide-react";
import { cn } from "@/lib/utils";

interface CycleDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cycleId: string;
  cycleNumber: number;
}

interface CycleDetails {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  lost_reason: string | null;
  won_summary: string | null;
  last_activity_at: string | null;
  sellerName: string;
  messageCount: number;
  averageTemperature: string;
  temperatures: { hot: number; warm: number; cold: number };
}

const statusConfig: Record<string, { label: string; icon: typeof Clock; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "text-muted-foreground bg-muted" },
  in_progress: { label: "Em andamento", icon: MessageSquare, color: "text-primary bg-primary/10" },
  won: { label: "Ganhou", icon: Trophy, color: "text-success bg-success/10" },
  lost: { label: "Perdido", icon: XCircle, color: "text-destructive bg-destructive/10" },
};

export function CycleDetailsModal({ open, onOpenChange, cycleId, cycleNumber }: CycleDetailsModalProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [details, setDetails] = useState<CycleDetails | null>(null);

  useEffect(() => {
    if (open && cycleId) {
      fetchDetails();
    }
  }, [open, cycleId]);

  const fetchDetails = async () => {
    setIsLoading(true);
    try {
      // Fetch cycle data
      const { data: cycle, error: cycleError } = await supabase
        .from("sale_cycles")
        .select("*")
        .eq("id", cycleId)
        .single();

      if (cycleError) throw cycleError;

      // Fetch seller profile
      const { data: sellerProfile } = await supabase
        .from("profiles")
        .select("name")
        .eq("user_id", cycle.seller_id)
        .maybeSingle();

      // Fetch message count
      const { count: messageCount } = await supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("cycle_id", cycleId);

      // Fetch messages to get their insights
      const { data: messages } = await supabase
        .from("messages")
        .select("id")
        .eq("cycle_id", cycleId);

      const messageIds = messages?.map((m) => m.id) || [];

      // Fetch insights for these messages
      const { data: insights } = await supabase
        .from("insights")
        .select("temperature")
        .in("message_id", messageIds.length > 0 ? messageIds : [""]);

      // Calculate temperature distribution
      const temperatures = { hot: 0, warm: 0, cold: 0 };
      insights?.forEach((i) => {
        if (i.temperature === "hot") temperatures.hot++;
        else if (i.temperature === "warm") temperatures.warm++;
        else if (i.temperature === "cold") temperatures.cold++;
      });

      const totalTemp = temperatures.hot + temperatures.warm + temperatures.cold;
      let averageTemperature = "cold";
      if (totalTemp > 0) {
        if (temperatures.hot >= temperatures.warm && temperatures.hot >= temperatures.cold) {
          averageTemperature = "hot";
        } else if (temperatures.warm >= temperatures.cold) {
          averageTemperature = "warm";
        }
      }

      setDetails({
        id: cycle.id,
        status: cycle.status,
        created_at: cycle.created_at,
        closed_at: cycle.closed_at,
        lost_reason: cycle.lost_reason,
        won_summary: cycle.won_summary,
        last_activity_at: cycle.last_activity_at,
        sellerName: sellerProfile?.name || "Vendedor",
        messageCount: messageCount || 0,
        averageTemperature,
        temperatures,
      });
    } catch (error) {
      console.error("Error fetching cycle details:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const status = details ? statusConfig[details.status] || statusConfig.pending : statusConfig.pending;
  const StatusIcon = status.icon;

  const TempIcon = details?.averageTemperature === "hot" 
    ? Flame 
    : details?.averageTemperature === "warm" 
      ? ThermometerSun 
      : Snowflake;

  const tempColor = details?.averageTemperature === "hot"
    ? "text-red-500"
    : details?.averageTemperature === "warm"
      ? "text-orange-500"
      : "text-blue-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className={cn("h-10 w-10 rounded-full flex items-center justify-center", status.color)}>
              <StatusIcon className="h-5 w-5" />
            </div>
            Ciclo #{cycleNumber}
            <Badge variant="outline" className={status.color}>
              {status.label}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : details ? (
          <div className="space-y-4">
            {/* Basic Info */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Criado em
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm font-medium">
                    {format(new Date(details.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs text-muted-foreground flex items-center gap-1">
                    <User className="h-3 w-3" />
                    Vendedor
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm font-medium">{details.sellerName}</p>
                </CardContent>
              </Card>
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardContent className="pt-4 text-center">
                  <MessageSquare className="h-5 w-5 mx-auto text-primary mb-1" />
                  <p className="text-xl font-bold">{details.messageCount}</p>
                  <p className="text-xs text-muted-foreground">Mensagens</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 text-center">
                  <TempIcon className={cn("h-5 w-5 mx-auto mb-1", tempColor)} />
                  <p className="text-xl font-bold capitalize">{details.averageTemperature}</p>
                  <p className="text-xs text-muted-foreground">Temperatura</p>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-4 text-center">
                  <ChartBar className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
                  <p className="text-xl font-bold">
                    {details.closed_at
                      ? formatDistanceToNow(new Date(details.closed_at), { locale: ptBR })
                      : "-"}
                  </p>
                  <p className="text-xs text-muted-foreground">Duração</p>
                </CardContent>
              </Card>
            </div>

            {/* Temperature Distribution */}
            {(details.temperatures.hot + details.temperatures.warm + details.temperatures.cold) > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Distribuição de Temperatura</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                    <div
                      className="bg-red-500 transition-all"
                      style={{
                        width: `${(details.temperatures.hot / (details.temperatures.hot + details.temperatures.warm + details.temperatures.cold)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-orange-500 transition-all"
                      style={{
                        width: `${(details.temperatures.warm / (details.temperatures.hot + details.temperatures.warm + details.temperatures.cold)) * 100}%`,
                      }}
                    />
                    <div
                      className="bg-blue-500 transition-all"
                      style={{
                        width: `${(details.temperatures.cold / (details.temperatures.hot + details.temperatures.warm + details.temperatures.cold)) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex justify-between mt-2 text-xs">
                    <span className="text-red-500">🔥 {details.temperatures.hot}</span>
                    <span className="text-orange-500">🌡️ {details.temperatures.warm}</span>
                    <span className="text-blue-500">❄️ {details.temperatures.cold}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Closed Info */}
            {details.closed_at && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">Encerramento</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xs text-muted-foreground">
                    Encerrado em{" "}
                    {format(new Date(details.closed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                  {details.status === "won" && details.won_summary && (
                    <div className="mt-2 p-2 rounded bg-success/10 border border-success/20">
                      <p className="text-sm text-success font-medium">Resumo da Venda</p>
                      <p className="text-sm mt-1">{details.won_summary}</p>
                    </div>
                  )}
                  {details.status === "lost" && details.lost_reason && (
                    <div className="mt-2 p-2 rounded bg-destructive/10 border border-destructive/20">
                      <p className="text-sm text-destructive font-medium">Motivo da Perda</p>
                      <p className="text-sm mt-1">{details.lost_reason}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <p className="text-center text-muted-foreground py-8">Erro ao carregar detalhes</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
