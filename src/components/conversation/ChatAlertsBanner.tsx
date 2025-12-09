import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Flame, 
  AlertTriangle, 
  AlertCircle,
  UserX 
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Alert {
  id: string;
  alert_type: string;
  severity: string;
  message: string;
}

interface ChatAlertsBannerProps {
  customerId: string;
  cycleId?: string | null;
}

const alertConfig: Record<string, { 
  icon: typeof Flame; 
  iconClass: string; 
  priority: number;
}> = {
  open_objection: {
    icon: AlertTriangle,
    iconClass: "text-orange-500",
    priority: 1,
  },
  hot_lead: {
    icon: Flame,
    iconClass: "text-destructive",
    priority: 2,
  },
  waiting_response: {
    icon: Clock,
    iconClass: "text-warning",
    priority: 3,
  },
  stale_lead: {
    icon: UserX,
    iconClass: "text-muted-foreground",
    priority: 4,
  },
  incomplete_lead: {
    icon: AlertCircle,
    iconClass: "text-blue-500",
    priority: 5,
  },
};

const severityColors: Record<string, string> = {
  critical: "border-destructive bg-destructive/10 text-destructive",
  warning: "border-warning bg-warning/10 text-warning",
  info: "border-blue-500 bg-blue-500/10 text-blue-500",
};

export function ChatAlertsBanner({ customerId, cycleId }: ChatAlertsBannerProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);

  const fetchAlerts = async () => {
    let query = supabase
      .from('alerts')
      .select('id, alert_type, severity, message')
      .eq('customer_id', customerId);

    if (cycleId) {
      query = query.eq('cycle_id', cycleId);
    }

    const { data } = await query;
    
    if (data) {
      // Sort by priority
      const sorted = data.sort((a, b) => {
        const priorityA = alertConfig[a.alert_type]?.priority || 99;
        const priorityB = alertConfig[b.alert_type]?.priority || 99;
        return priorityA - priorityB;
      });
      setAlerts(sorted.slice(0, 3)); // Max 3 alerts
    }
  };

  useEffect(() => {
    fetchAlerts();
    
    // Realtime subscription
    const channel = supabase
      .channel(`alerts-${customerId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts',
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, cycleId]);

  if (alerts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 px-4 py-2 bg-muted/50 border-b border-border">
      {alerts.map((alert) => {
        const config = alertConfig[alert.alert_type] || {
          icon: AlertCircle,
          iconClass: "text-muted-foreground",
          priority: 99,
        };
        const Icon = config.icon;
        const colorClass = severityColors[alert.severity] || severityColors.info;

        return (
          <Badge 
            key={alert.id} 
            variant="outline" 
            className={cn(
              "text-xs px-2 py-1 animate-pulse",
              colorClass
            )}
          >
            <Icon className={cn("h-3 w-3 mr-1", config.iconClass)} />
            {alert.message}
          </Badge>
        );
      })}
    </div>
  );
}
