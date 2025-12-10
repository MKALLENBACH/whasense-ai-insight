import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TrendingUp, Calendar, User, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Buyer {
  id: string;
  name: string;
}

interface SaleCycle {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  lost_reason: string | null;
  won_summary: string | null;
  buyer_id: string | null;
  customer_id: string;
}

interface Client360CyclesProps {
  clientId: string;
  cycles: SaleCycle[];
  buyers: Buyer[];
}

const statusConfig: Record<string, { label: string; color: string }> = {
  pending: { label: "Pendente", color: "bg-muted text-muted-foreground" },
  in_progress: { label: "Em andamento", color: "bg-warning text-warning-foreground" },
  won: { label: "Ganho", color: "bg-success text-success-foreground" },
  lost: { label: "Perdido", color: "bg-destructive text-destructive-foreground" },
};

const Client360Cycles = ({ clientId, cycles, buyers }: Client360CyclesProps) => {
  const getBuyerName = (buyerId: string | null) => {
    if (!buyerId) return "Não associado";
    const buyer = buyers.find(b => b.id === buyerId);
    return buyer?.name || "Desconhecido";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5" />
          Ciclos de Venda ({cycles.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {cycles.length === 0 ? (
          <div className="p-12 text-center">
            <TrendingUp className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum ciclo de venda registrado</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Comprador</TableHead>
                <TableHead>Período</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo/Resumo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {cycles.map((cycle) => (
                <TableRow key={cycle.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span>{getBuyerName(cycle.buyer_id)}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm">
                      <Calendar className="h-3 w-3" />
                      {format(new Date(cycle.created_at), "dd/MM/yy", { locale: ptBR })}
                      {cycle.closed_at && (
                        <>
                          <span>→</span>
                          {format(new Date(cycle.closed_at), "dd/MM/yy", { locale: ptBR })}
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={statusConfig[cycle.status]?.color}>
                      {statusConfig[cycle.status]?.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {cycle.status === "lost" && cycle.lost_reason ? (
                      <div className="flex items-center gap-1 text-sm text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {cycle.lost_reason}
                      </div>
                    ) : cycle.status === "won" && cycle.won_summary ? (
                      <span className="text-sm text-success">{cycle.won_summary}</span>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
};

export default Client360Cycles;
