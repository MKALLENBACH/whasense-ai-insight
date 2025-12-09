import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Flame, ThermometerSun, Snowflake, MessageCircle, Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Priority {
  id: string;
  customerId: string;
  customerName: string;
  temperature: "hot" | "warm" | "cold";
  status: string;
  urgencyType: string;
  lastMessageAt: string;
}

interface PrioritiesListProps {
  priorities: Priority[];
}

export function PrioritiesList({ priorities }: PrioritiesListProps) {
  const navigate = useNavigate();

  const getTempIcon = (temp: string) => {
    if (temp === "hot") return Flame;
    if (temp === "warm") return ThermometerSun;
    return Snowflake;
  };

  const getTempColor = (temp: string) => {
    if (temp === "hot") return "text-red-500";
    if (temp === "warm") return "text-orange-500";
    return "text-blue-500";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-warning" />
          Prioridades do Dia
          {priorities.length > 0 && (
            <Badge variant="destructive">{priorities.length}</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px] pr-4">
          {priorities.length > 0 ? (
            <div className="space-y-3">
              {priorities.map((p) => {
                const TempIcon = getTempIcon(p.temperature);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn("p-2 rounded-lg bg-muted", getTempColor(p.temperature))}>
                        <TempIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{p.customerName}</p>
                        <p className="text-xs text-destructive font-medium">{p.urgencyType}</p>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {formatDistanceToNow(new Date(p.lastMessageAt), { addSuffix: true, locale: ptBR })}
                        </div>
                      </div>
                    </div>
                    <Button size="sm" onClick={() => navigate(`/chat/${p.customerId}`)}>
                      <MessageCircle className="h-4 w-4 mr-1" />
                      Abrir
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <AlertCircle className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-medium">Nenhuma prioridade urgente</p>
              <p className="text-xs text-muted-foreground mt-1">Seus leads estão em dia!</p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
