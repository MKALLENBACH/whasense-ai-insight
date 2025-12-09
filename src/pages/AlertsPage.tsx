import AppLayout from "@/components/layout/AppLayout";
import { mockAlerts } from "@/data/mockData";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Flame, AlertTriangle, Clock, TrendingUp, Check } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

const alertConfig = {
  hot_lead: {
    icon: Flame,
    iconClass: "text-lead-hot",
    bgClass: "bg-lead-hot/10 border-l-lead-hot",
  },
  objection: {
    icon: AlertTriangle,
    iconClass: "text-warning",
    bgClass: "bg-warning/10 border-l-warning",
  },
  long_wait: {
    icon: Clock,
    iconClass: "text-muted-foreground",
    bgClass: "bg-muted border-l-muted-foreground",
  },
  opportunity: {
    icon: TrendingUp,
    iconClass: "text-success",
    bgClass: "bg-success/10 border-l-success",
  },
};

const AlertsPage = () => {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState(mockAlerts);

  const handleMarkRead = (alertId: string) => {
    setAlerts((prev) =>
      prev.map((alert) => (alert.id === alertId ? { ...alert, isRead: true } : alert))
    );
  };

  const handleGoToConversation = (conversationId: string) => {
    navigate("/conversas");
  };

  const unreadCount = alerts.filter((a) => !a.isRead).length;

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Alertas</h1>
            <p className="text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} alertas não lidos` : "Todos os alertas lidos"}
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-6 w-6 text-primary" />
          </div>
        </div>

        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = alertConfig[alert.type];
            const Icon = config.icon;

            return (
              <Card
                key={alert.id}
                className={cn(
                  "border-l-4 transition-all duration-200 hover:shadow-md",
                  config.bgClass,
                  !alert.isRead && "ring-1 ring-primary/20"
                )}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "h-10 w-10 rounded-full flex items-center justify-center flex-shrink-0",
                        "bg-card"
                      )}
                    >
                      <Icon className={cn("h-5 w-5", config.iconClass)} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {!alert.isRead && (
                          <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                        )}
                        <p className="font-medium">{alert.message}</p>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {formatDistanceToNow(alert.createdAt, {
                          addSuffix: true,
                          locale: ptBR,
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {!alert.isRead && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMarkRead(alert.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleGoToConversation(alert.conversationId)}
                      >
                        Ver conversa
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {alerts.length === 0 && (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground">Nenhum alerta no momento</p>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default AlertsPage;
