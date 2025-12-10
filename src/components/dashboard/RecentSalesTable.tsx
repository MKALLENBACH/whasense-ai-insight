import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CheckCircle2, XCircle, Eye, Receipt } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface RecentSale {
  id: string;
  customerName: string;
  sellerName: string;
  status: "won" | "lost";
  reason: string | null;
  closedAt: string;
  cycleId: string;
}

interface RecentSalesTableProps {
  sales: RecentSale[];
  showSeller?: boolean;
}

export function RecentSalesTable({ sales, showSeller = true }: RecentSalesTableProps) {
  const navigate = useNavigate();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5 text-primary" />
          Vendas Recentes
          <Badge variant="outline" className="ml-2">
            {sales.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {sales.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  {showSeller && <TableHead>Vendedor</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sales.map((sale) => (
                  <TableRow key={sale.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{sale.customerName}</TableCell>
                    {showSeller && (
                      <TableCell className="text-muted-foreground">
                        {sale.sellerName}
                      </TableCell>
                    )}
                    <TableCell>
                      {sale.status === "won" ? (
                        <Badge className="bg-success/10 text-success border-success/20">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Ganha
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-destructive/10 text-destructive border-destructive/20">
                          <XCircle className="h-3 w-3 mr-1" />
                          Perdida
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-muted-foreground">
                      {sale.reason || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(sale.closedAt), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigate(`/gestor/ciclos/${sale.cycleId}`)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="h-[300px] flex flex-col items-center justify-center text-center">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <Receipt className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">Nenhuma venda registrada</p>
              <p className="text-xs text-muted-foreground mt-1">
                As vendas concluídas aparecerão aqui
              </p>
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
