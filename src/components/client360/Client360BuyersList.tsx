import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  User,
  Phone,
  Briefcase,
  MessageSquare,
  ChevronRight,
  Clock,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";

interface Buyer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  client_id: string;
  created_at?: string;
}

interface BuyerWithStats extends Buyer {
  currentCycleStatus?: string;
  lastMessage?: string;
  lastMessageTime?: string;
  temperature?: "hot" | "warm" | "cold";
}

interface Client360BuyersListProps {
  buyers: Buyer[];
  clientId: string;
  onRefresh: () => void;
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em andamento", color: "bg-warning text-warning-foreground" },
  won: { label: "Ganho", color: "bg-success text-success-foreground" },
  lost: { label: "Perdido", color: "bg-destructive text-destructive-foreground" },
};

const Client360BuyersList = ({ buyers, clientId, onRefresh }: Client360BuyersListProps) => {
  const navigate = useNavigate();
  const [enrichedBuyers, setEnrichedBuyers] = useState<BuyerWithStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    enrichBuyersData();
  }, [buyers]);

  const enrichBuyersData = async () => {
    if (buyers.length === 0) {
      setEnrichedBuyers([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const enriched = await Promise.all(
        buyers.map(async (buyer) => {
          // First get customer linked to this buyer
          const { data: customerData } = await supabase
            .from("customers")
            .select("id")
            .eq("buyer_id", buyer.id)
            .limit(1)
            .maybeSingle();

          let cycleData = null;
          let messageData = null;
          let temperature: "hot" | "warm" | "cold" | undefined = undefined;

          if (customerData) {
            // Get current cycle via customer_id
            const { data: cycle } = await supabase
              .from("sale_cycles")
              .select("id, status")
              .eq("customer_id", customerData.id)
              .in("status", ["pending", "in_progress"])
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();
            cycleData = cycle;

            // Get last message via customer_id
            const { data: message } = await supabase
              .from("messages")
              .select("content, timestamp, id")
              .eq("customer_id", customerData.id)
              .order("timestamp", { ascending: false })
              .limit(1)
              .maybeSingle();
            messageData = message;

            // Get latest temperature from insights of this customer's messages
            if (message) {
              const { data: insight } = await supabase
                .from("insights")
                .select("temperature")
                .eq("message_id", message.id)
                .maybeSingle();
              temperature = (insight?.temperature as "hot" | "warm" | "cold") || undefined;
            }
          }

          return {
            ...buyer,
            currentCycleStatus: cycleData?.status,
            lastMessage: messageData?.content ? 
              messageData.content.substring(0, 50) + (messageData.content.length > 50 ? "..." : "") : 
              undefined,
            lastMessageTime: messageData?.timestamp,
            temperature,
          };
        })
      );

      setEnrichedBuyers(enriched);
    } catch (error) {
      console.error("Error enriching buyers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full mb-2" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (buyers.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold mb-2">Nenhum comprador cadastrado</h3>
          <p className="text-sm text-muted-foreground">
            Adicione compradores para acompanhar as conversas individuais.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Compradores ({buyers.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Comprador</TableHead>
              <TableHead>Cargo</TableHead>
              <TableHead>Telefone</TableHead>
              <TableHead>Status Atual</TableHead>
              <TableHead>Temperatura</TableHead>
              <TableHead>Última Mensagem</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {enrichedBuyers.map((buyer) => (
              <TableRow key={buyer.id} className="cursor-pointer hover:bg-muted/50">
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{buyer.name}</p>
                      {buyer.email && (
                        <p className="text-xs text-muted-foreground">{buyer.email}</p>
                      )}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  {buyer.role ? (
                    <span className="text-sm">{buyer.role}</span>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {buyer.phone ? (
                    <div className="flex items-center gap-1 text-sm">
                      <Phone className="h-3 w-3" />
                      {buyer.phone}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {buyer.currentCycleStatus ? (
                    <Badge className={statusConfig[buyer.currentCycleStatus]?.color}>
                      {statusConfig[buyer.currentCycleStatus]?.label}
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sem ciclo</span>
                  )}
                </TableCell>
                <TableCell>
                  {buyer.temperature ? (
                    <LeadTemperatureBadge temperature={buyer.temperature} size="sm" />
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  {buyer.lastMessage ? (
                    <div>
                      <p className="text-sm truncate max-w-[150px]">{buyer.lastMessage}</p>
                      {buyer.lastMessageTime && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(buyer.lastMessageTime), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-sm">Sem mensagens</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {/* Navigate to buyer chat */}}
                    >
                      <MessageSquare className="h-4 w-4" />
                    </Button>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
};

export default Client360BuyersList;
