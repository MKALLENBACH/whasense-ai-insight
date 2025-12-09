import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { DollarSign, TrendingUp, User, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Client360FinancialProps {
  clientId: string;
}

const Client360Financial = ({ clientId }: Client360FinancialProps) => {
  const [stats, setStats] = useState({
    totalSales: 0,
    totalRevenue: 0,
    avgTicket: 0,
  });
  const [salesByMonth, setSalesByMonth] = useState<{ month: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, [clientId]);

  const fetchFinancialData = async () => {
    setIsLoading(true);
    try {
      // Get won cycles
      const { data: wonCycles } = await supabase
        .from("sale_cycles")
        .select("id, closed_at")
        .eq("client_id", clientId)
        .eq("status", "won");

      const totalSales = wonCycles?.length || 0;

      // Group by month
      const monthCounts: Record<string, number> = {};
      wonCycles?.forEach((cycle: any) => {
        if (cycle.closed_at) {
          const month = format(new Date(cycle.closed_at), "MMM/yy", { locale: ptBR });
          monthCounts[month] = (monthCounts[month] || 0) + 1;
        }
      });

      const salesByMonthData = Object.entries(monthCounts)
        .map(([month, count]) => ({ month, count }))
        .slice(-6);

      setStats({
        totalSales,
        totalRevenue: 0, // No value tracking yet
        avgTicket: 0,
      });
      setSalesByMonth(salesByMonthData);
    } catch (error) {
      console.error("Error fetching financial data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalSales}</p>
                <p className="text-xs text-muted-foreground">Vendas Totais</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.totalRevenue > 0 ? `R$ ${stats.totalRevenue.toLocaleString('pt-BR')}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Faturamento Total</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {stats.avgTicket > 0 ? `R$ ${stats.avgTicket.toLocaleString('pt-BR')}` : '-'}
                </p>
                <p className="text-xs text-muted-foreground">Ticket Médio</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Sales Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Vendas por Mês
          </CardTitle>
        </CardHeader>
        <CardContent>
          {salesByMonth.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhuma venda registrada</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={salesByMonth}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--success))" name="Vendas" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Client360Financial;
