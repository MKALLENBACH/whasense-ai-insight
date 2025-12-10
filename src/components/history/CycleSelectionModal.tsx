import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Calendar,
  User,
  MessageSquare,
  ArrowRight,
  Loader2,
  HeadphonesIcon,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Cycle {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  start_message_timestamp: string | null;
  seller_id: string;
  seller_name: string;
  message_count: number;
}

interface CycleSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
}

export const CycleSelectionModal = ({
  open,
  onOpenChange,
  customerId,
  customerName,
}: CycleSelectionModalProps) => {
  const navigate = useNavigate();
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (open && customerId) {
      fetchCycles();
    }
  }, [open, customerId]);

  const fetchCycles = async () => {
    setIsLoading(true);
    try {
      // Fetch all cycles for this customer
      const { data: cyclesData, error: cyclesError } = await supabase
        .from("sale_cycles")
        .select("id, status, created_at, closed_at, start_message_timestamp, seller_id")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: true });

      if (cyclesError) throw cyclesError;

      if (!cyclesData || cyclesData.length === 0) {
        setCycles([]);
        setIsLoading(false);
        return;
      }

      // Get seller info and message counts
      const sellerIds = [...new Set(cyclesData.map((c) => c.seller_id))];
      const cycleIds = cyclesData.map((c) => c.id);

      const [sellersResult, messagesResult] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", sellerIds),
        supabase
          .from("messages")
          .select("cycle_id")
          .in("cycle_id", cycleIds),
      ]);

      const sellersMap = new Map(
        (sellersResult.data || []).map((s) => [s.user_id, s.name])
      );

      // Count messages per cycle
      const messageCountMap = new Map<string, number>();
      (messagesResult.data || []).forEach((m) => {
        if (m.cycle_id) {
          messageCountMap.set(m.cycle_id, (messageCountMap.get(m.cycle_id) || 0) + 1);
        }
      });

      const enrichedCycles: Cycle[] = cyclesData.map((c) => ({
        id: c.id,
        status: c.status,
        created_at: c.created_at,
        closed_at: c.closed_at,
        start_message_timestamp: c.start_message_timestamp,
        seller_id: c.seller_id,
        seller_name: sellersMap.get(c.seller_id) || "Desconhecido",
        message_count: messageCountMap.get(c.id) || 0,
      }));

      setCycles(enrichedCycles);
    } catch (error) {
      console.error("Error fetching cycles:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "won":
        return (
          <Badge className="bg-success hover:bg-success/90">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ganha
          </Badge>
        );
      case "lost":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Perdida
          </Badge>
        );
      case "in_progress":
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Em Andamento
          </Badge>
        );
      case "closed":
        return (
          <Badge className="bg-blue-600 hover:bg-blue-700">
            <HeadphonesIcon className="h-3 w-3 mr-1" />
            Pós-venda Concluído
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            <Clock className="h-3 w-3 mr-1" />
            Pendente
          </Badge>
        );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return format(new Date(dateStr), "dd/MM/yyyy HH:mm", { locale: ptBR });
  };

  const handleSelectCycle = (cycleId: string) => {
    onOpenChange(false);
    navigate(`/gestor/ciclos/${cycleId}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Ciclos de Venda - {customerName}
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[400px] pr-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : cycles.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum ciclo encontrado para este cliente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {cycles.map((cycle, index) => (
                <div
                  key={cycle.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleSelectCycle(cycle.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">Ciclo #{index + 1}</span>
                        {getStatusBadge(cycle.status)}
                      </div>

                      <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>Início: {formatDate(cycle.start_message_timestamp || cycle.created_at)}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          <span>
                            Fim: {cycle.closed_at ? formatDate(cycle.closed_at) : "Em aberto"}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5" />
                          <span>Vendedor: {cycle.seller_name}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="h-3.5 w-3.5" />
                          <span>{cycle.message_count} mensagens</span>
                        </div>
                      </div>
                    </div>

                    <Button variant="ghost" size="icon" className="shrink-0">
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};
