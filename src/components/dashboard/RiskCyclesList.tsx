import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertTriangle, MessageCircle, Clock, Flame, HelpCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface RiskCycle {
  id: string;
  customerName: string;
  sellerName: string;
  riskType: string;
  phase: string;
  customerId: string;
}

interface RiskCyclesListProps {
  cycles: RiskCycle[];
}

export function RiskCyclesList({ cycles }: RiskCyclesListProps) {
  const navigate = useNavigate();

  const getRiskIcon = (riskType: string) => {
    if (riskType.includes("resposta")) return Clock;
    if (riskType.includes("quente")) return Flame;
    if (riskType.includes("Objeção")) return HelpCircle;
    return AlertTriangle;
  };

  const getRiskColor = (riskType: string) => {
    if (riskType.includes("resposta")) return "text-destructive bg-destructive/10";
    if (riskType.includes("quente")) return "text-orange-500 bg-orange-500/10";
    if (riskType.includes("Objeção")) return "text-warning bg-warning/10";
    return "text-muted-foreground bg-muted";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-warning" />
          Ciclos em Risco
          {cycles.length > 0 && (
            <Badge variant="destructive" className="ml-2">
              {cycles.length}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[320px] pr-4">
          {cycles.length > 0 ? (
            <div className="space-y-3">
              {cycles.map((cycle) => {
                const RiskIcon = getRiskIcon(cycle.riskType);
                return (
                  <div
                    key={cycle.id}
                    className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                  >
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <div className={cn("p-2 rounded-lg", getRiskColor(cycle.riskType))}>
                        <RiskIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{cycle.customerName}</p>
                        <p className="text-sm text-muted-foreground">
                          {cycle.sellerName}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {cycle.phase}
                          </Badge>
                          <span className="text-xs text-destructive font-medium">
                            {cycle.riskType}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => navigate(`/gestor/ciclos/${cycle.id}`)}
                    >
                      <MessageCircle className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-center py-8">
              <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center mb-3">
                <AlertTriangle className="h-6 w-6 text-success" />
              </div>
              <p className="text-sm font-medium">Nenhum ciclo em risco</p>
              <p className="text-xs text-muted-foreground mt-1">
                Todos os leads estão sendo atendidos
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
