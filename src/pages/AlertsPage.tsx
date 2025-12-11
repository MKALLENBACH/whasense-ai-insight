import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseApi";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  Flame, 
  AlertTriangle, 
  Clock, 
  TrendingUp, 
  RefreshCw, 
  Loader2, 
  AlertCircle,
  UserX,
  MessageSquare,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Alert {
  id: string;
  customer_id: string;
  seller_id: string;
  alert_type: string;
  severity: string;
  message: string;
  metadata: any;
  created_at: string;
  updated_at: string;
  customer_name?: string;
}

const alertConfig: Record<string, { 
  icon: typeof Flame; 
  iconClass: string; 
  bgClass: string;
  priority: number;
}> = {
  waiting_response: {
    icon: Clock,
    iconClass: "text-warning",
    bgClass: "bg-warning/10 border-l-warning",
    priority: 3,
  },
  hot_lead: {
    icon: Flame,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10 border-l-destructive",
    priority: 2,
  },
  open_objection: {
    icon: AlertTriangle,
    iconClass: "text-orange-500",
    bgClass: "bg-orange-500/10 border-l-orange-500",
    priority: 1,
  },
  stale_lead: {
    icon: UserX,
    iconClass: "text-muted-foreground",
    bgClass: "bg-muted border-l-muted-foreground",
    priority: 4,
  },
  incomplete_lead: {
    icon: AlertCircle,
    iconClass: "text-blue-500",
    bgClass: "bg-blue-500/10 border-l-blue-500",
    priority: 5,
  },
  // Manager alerts
  manager_stale_lead: {
    icon: UserX,
    iconClass: "text-muted-foreground",
    bgClass: "bg-muted border-l-muted-foreground",
    priority: 1,
  },
  manager_at_risk: {
    icon: AlertTriangle,
    iconClass: "text-destructive",
    bgClass: "bg-destructive/10 border-l-destructive",
    priority: 2,
  },
  manager_slow_response: {
    icon: Clock,
    iconClass: "text-warning",
    bgClass: "bg-warning/10 border-l-warning",
    priority: 3,
  },
};

const severityColors: Record<string, string> = {
  info: "bg-blue-500",
  warning: "bg-warning",
  critical: "bg-destructive",
};

const AlertsPage = () => {
  const navigate = useNavigate();
  const { session, isManager, isSeller } = useAuth();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);

  const fetchAlerts = async () => {
    if (!session?.access_token) return;

    try {
      // Fetch alerts
      const { data: alertsData, error: alertsError } = await supabase
        .from('alerts')
        .select('*')
        .order('created_at', { ascending: false });

      if (alertsError) throw alertsError;

      // Fetch customer names
      const customerIds = [...new Set(alertsData?.map(a => a.customer_id) || [])];
      const { data: customers } = await supabase
        .from('customers')
        .select('id, name')
        .in('id', customerIds.length > 0 ? customerIds : ['']);

      const customerMap = new Map(customers?.map(c => [c.id, c.name]) || []);

      // Add customer names to alerts
      const alertsWithNames = alertsData?.map(alert => ({
        ...alert,
        customer_name: customerMap.get(alert.customer_id) || 'Cliente',
      })) || [];

      // Filter alerts based on role
      let filteredAlerts = alertsWithNames;
      if (isManager) {
        // Manager sees only manager-specific alerts
        filteredAlerts = alertsWithNames.filter(a => 
          a.alert_type.startsWith('manager_') || 
          a.alert_type === 'stale_lead'
        );
      } else if (isSeller) {
        // Seller sees operational alerts only
        filteredAlerts = alertsWithNames.filter(a => !a.alert_type.startsWith('manager_'));
      }

      // Sort by priority
      filteredAlerts.sort((a, b) => {
        const priorityA = alertConfig[a.alert_type]?.priority || 99;
        const priorityB = alertConfig[b.alert_type]?.priority || 99;
        return priorityA - priorityB;
      });

      setAlerts(filteredAlerts);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      toast.error('Erro ao carregar alertas');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const triggerAlertCalculation = async () => {
    setIsCalculating(true);
    try {
      const { data, error } = await invokeFunction<{ alertsCreated: number }>('calculate-alerts', {
        body: { internal: true }
      });
      if (error) throw error;
      console.log('Alert calculation result:', data);
      await fetchAlerts();
      toast.success(`${data?.alertsCreated || 0} alertas atualizados`);
    } catch (error) {
      console.error('Error calculating alerts:', error);
      toast.error('Erro ao calcular alertas');
    } finally {
      setIsCalculating(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    // Trigger initial calculation
    triggerAlertCalculation();
  }, [session]);

  // Realtime subscription for alerts
  useEffect(() => {
    const channel = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      triggerAlertCalculation();
    }, 30000);

    return () => clearInterval(interval);
  }, [session]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await triggerAlertCalculation();
  };

  const handleGoToConversation = (customerId: string) => {
    navigate(`/chat/${customerId}`);
  };

  const criticalCount = alerts.filter(a => a.severity === 'critical').length;
  const warningCount = alerts.filter(a => a.severity === 'warning').length;

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-[calc(100vh-3rem)] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando alertas...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Alertas Inteligentes</h1>
            <p className="text-muted-foreground">
              {alerts.length === 0 
                ? "Nenhum alerta ativo" 
                : `${alerts.length} alertas ativos`}
            </p>
            <div className="flex gap-2 mt-2">
              {criticalCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {criticalCount} críticos
                </Badge>
              )}
              {warningCount > 0 && (
                <Badge className="bg-warning text-warning-foreground text-xs">
                  {warningCount} atenção
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefreshing || isCalculating}
            >
              <RefreshCw className={cn("h-4 w-4 mr-2", (isRefreshing || isCalculating) && "animate-spin")} />
              Atualizar
            </Button>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center relative">
              <Bell className="h-6 w-6 text-primary" />
              {alerts.length > 0 && (
                <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-destructive-foreground text-xs flex items-center justify-center">
                  {alerts.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Info banner */}
        <Card className="mb-6 border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-blue-600">Alertas Dinâmicos</p>
                <p className="text-muted-foreground">
                  Os alertas são recalculados automaticamente a cada 30 segundos. 
                  Eles aparecem e desaparecem conforme as condições mudam.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <ScrollArea className="h-[calc(100vh-16rem)]">
          <div className="space-y-3 pr-4">
            {alerts.map((alert) => {
              const config = alertConfig[alert.alert_type] || {
                icon: Bell,
                iconClass: "text-muted-foreground",
                bgClass: "bg-muted border-l-muted-foreground",
                priority: 99,
              };
              const Icon = config.icon;

              return (
                <Card
                  key={alert.id}
                  className={cn(
                    "border-l-4 transition-all duration-200 hover:shadow-md cursor-pointer",
                    config.bgClass,
                  )}
                  onClick={() => handleGoToConversation(alert.customer_id)}
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
                          <span className={cn(
                            "h-2 w-2 rounded-full animate-pulse",
                            severityColors[alert.severity] || "bg-muted-foreground"
                          )} />
                          <p className="font-medium">{alert.message}</p>
                          <Badge 
                            variant="outline" 
                            className={cn(
                              "text-[10px] px-1.5 py-0",
                              alert.severity === 'critical' && "border-destructive text-destructive",
                              alert.severity === 'warning' && "border-warning text-warning",
                              alert.severity === 'info' && "border-blue-500 text-blue-500"
                            )}
                          >
                            {alert.severity === 'critical' ? 'Crítico' : 
                             alert.severity === 'warning' ? 'Atenção' : 'Info'}
                          </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {alert.customer_name} • Atualizado {formatDistanceToNow(new Date(alert.updated_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </p>
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleGoToConversation(alert.customer_id);
                        }}
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Ver
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            {alerts.length === 0 && (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhum alerta ativo no momento</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Os alertas aparecerão automaticamente quando houver condições que requerem atenção
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </div>
    </AppLayout>
  );
};

export default AlertsPage;
