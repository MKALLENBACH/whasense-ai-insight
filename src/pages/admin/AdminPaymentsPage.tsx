import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Building2,
  DollarSign,
  AlertTriangle,
  Clock,
  TrendingUp,
  ExternalLink,
  Search,
  RefreshCw,
  CheckCircle,
  XCircle,
  Calendar
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CompanySubscription {
  id: string;
  company_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  next_billing_date: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  companies: {
    id: string;
    name: string;
    is_active: boolean;
  };
  plans: {
    id: string;
    name: string;
    monthly_price: number;
  } | null;
}

interface PaymentRecord {
  id: string;
  company_id: string;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  paid_at: string | null;
  created_at: string;
  companies: {
    name: string;
  };
}

interface SaaSMetrics {
  mrr: number;
  arr: number;
  activeCompanies: number;
  trialCompanies: number;
  pastDueCompanies: number;
  churnedThisMonth: number;
  revenueByPlan: Record<string, number>;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  trialing: { label: "Teste", variant: "secondary" },
  past_due: { label: "Atrasado", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
  inactive: { label: "Inativo", variant: "outline" },
  inactive_due_payment: { label: "Bloqueado", variant: "destructive" },
};

export default function AdminPaymentsPage() {
  const [loading, setLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<CompanySubscription[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [metrics, setMetrics] = useState<SaaSMetrics | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTab, setSelectedTab] = useState("overview");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load subscriptions with company and plan data
      const { data: subsData } = await supabase
        .from("company_subscriptions")
        .select(`
          *,
          companies:company_id (id, name, is_active),
          plans:plan_id (id, name, monthly_price)
        `)
        .order("created_at", { ascending: false });

      setSubscriptions(subsData || []);

      // Load recent payments
      const { data: paymentsData } = await supabase
        .from("payment_history")
        .select(`
          *,
          companies:company_id (name)
        `)
        .order("created_at", { ascending: false })
        .limit(50);

      setPayments(paymentsData || []);

      // Calculate metrics
      if (subsData) {
        const activeCompanies = subsData.filter(s => s.status === "active").length;
        const trialCompanies = subsData.filter(s => s.status === "trialing").length;
        const pastDueCompanies = subsData.filter(s => s.status === "past_due" || s.status === "inactive_due_payment").length;
        
        // MRR calculation
        const mrr = subsData
          .filter(s => s.status === "active")
          .reduce((sum, s) => sum + (s.plans?.monthly_price || 0), 0);

        // Revenue by plan
        const revenueByPlan: Record<string, number> = {};
        subsData
          .filter(s => s.status === "active" && s.plans)
          .forEach(s => {
            const planName = s.plans!.name;
            revenueByPlan[planName] = (revenueByPlan[planName] || 0) + (s.plans!.monthly_price || 0);
          });

        setMetrics({
          mrr,
          arr: mrr * 12,
          activeCompanies,
          trialCompanies,
          pastDueCompanies,
          churnedThisMonth: 0, // Would need historical data
          revenueByPlan,
        });
      }
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Erro ao carregar dados");
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStripeCustomerUrl = (customerId: string | null) => {
    if (!customerId) return null;
    return `https://dashboard.stripe.com/customers/${customerId}`;
  };

  const handleToggleCompanyActive = async (companyId: string, currentActive: boolean) => {
    try {
      const { error } = await supabase
        .from("companies")
        .update({ is_active: !currentActive })
        .eq("id", companyId);

      if (error) throw error;
      toast.success(currentActive ? "Empresa desativada" : "Empresa reativada");
      loadData();
    } catch (error) {
      toast.error("Erro ao atualizar empresa");
    }
  };

  const filteredSubscriptions = subscriptions.filter(s => 
    s.companies?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const pastDueSubscriptions = filteredSubscriptions.filter(s => 
    s.status === "past_due" || s.status === "inactive_due_payment"
  );

  const upcomingBillings = filteredSubscriptions
    .filter(s => s.next_billing_date && s.status === "active")
    .sort((a, b) => new Date(a.next_billing_date!).getTime() - new Date(b.next_billing_date!).getTime())
    .slice(0, 10);

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-4 md:grid-cols-4">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-32" />)}
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Pagamentos</h1>
            <p className="text-muted-foreground">Gestão de assinaturas e métricas financeiras</p>
          </div>
          <Button variant="outline" onClick={loadData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Metrics Cards */}
        {metrics && (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">MRR</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCurrency(metrics.mrr)}</div>
                <p className="text-xs text-muted-foreground">
                  ARR: {formatCurrency(metrics.arr)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Empresas Ativas</CardTitle>
                <Building2 className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{metrics.activeCompanies}</div>
                <p className="text-xs text-muted-foreground">
                  +{metrics.trialCompanies} em teste
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Inadimplentes</CardTitle>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">{metrics.pastDueCompanies}</div>
                <p className="text-xs text-muted-foreground">
                  empresas com pagamento pendente
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Receita por Plano</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  {Object.entries(metrics.revenueByPlan).map(([plan, revenue]) => (
                    <div key={plan} className="flex justify-between text-sm">
                      <span>{plan}</span>
                      <span className="font-medium">{formatCurrency(revenue)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar empresa..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <Tabs value={selectedTab} onValueChange={setSelectedTab}>
          <TabsList>
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="past_due" className="text-red-600">
              Inadimplentes ({pastDueSubscriptions.length})
            </TabsTrigger>
            <TabsTrigger value="upcoming">Próximos Vencimentos</TabsTrigger>
            <TabsTrigger value="history">Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Todas as Assinaturas</CardTitle>
                <CardDescription>{filteredSubscriptions.length} empresas</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {filteredSubscriptions.map((sub) => {
                    const status = statusMap[sub.status] || statusMap.inactive;
                    const stripeUrl = getStripeCustomerUrl(sub.stripe_customer_id);
                    
                    return (
                      <div 
                        key={sub.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{sub.companies?.name || "Empresa sem nome"}</span>
                              <Badge variant={status.variant}>{status.label}</Badge>
                              {!sub.companies?.is_active && (
                                <Badge variant="outline" className="text-red-600">Desativada</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                              <span>Plano: {sub.plans?.name || "Sem plano"}</span>
                              {sub.next_billing_date && (
                                <span>
                                  Próx. cobrança: {format(new Date(sub.next_billing_date), "dd/MM/yyyy", { locale: ptBR })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {stripeUrl && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open(stripeUrl, "_blank")}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Stripe
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant={sub.companies?.is_active ? "destructive" : "default"}
                            onClick={() => handleToggleCompanyActive(sub.company_id, sub.companies?.is_active || false)}
                          >
                            {sub.companies?.is_active ? (
                              <>
                                <XCircle className="h-3 w-3 mr-1" />
                                Desativar
                              </>
                            ) : (
                              <>
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Reativar
                              </>
                            )}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="past_due" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-red-600">Empresas Inadimplentes</CardTitle>
                <CardDescription>Empresas com pagamento pendente ou bloqueadas</CardDescription>
              </CardHeader>
              <CardContent>
                {pastDueSubscriptions.length === 0 ? (
                  <p className="text-center py-8 text-muted-foreground">
                    Nenhuma empresa inadimplente
                  </p>
                ) : (
                  <div className="space-y-3">
                    {pastDueSubscriptions.map((sub) => {
                      const daysOverdue = sub.next_billing_date 
                        ? differenceInDays(new Date(), new Date(sub.next_billing_date))
                        : 0;
                      const stripeUrl = getStripeCustomerUrl(sub.stripe_customer_id);
                      
                      return (
                        <div 
                          key={sub.id}
                          className="flex items-center justify-between p-4 rounded-lg border border-red-200 bg-red-50"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-4 w-4 text-red-500" />
                              <span className="font-medium">{sub.companies?.name}</span>
                              <Badge variant="destructive">
                                {daysOverdue > 0 ? `${daysOverdue} dias em atraso` : "Pagamento falhou"}
                              </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              Plano: {sub.plans?.name || "N/A"} • 
                              {sub.next_billing_date && ` Venceu em: ${format(new Date(sub.next_billing_date), "dd/MM/yyyy")}`}
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            {stripeUrl && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => window.open(stripeUrl, "_blank")}
                              >
                                Ver no Stripe
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => handleToggleCompanyActive(sub.company_id, sub.companies?.is_active || false)}
                            >
                              {sub.companies?.is_active ? "Bloquear" : "Desbloquear"}
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="upcoming" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Próximos Vencimentos</CardTitle>
                <CardDescription>Cobranças previstas para os próximos dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {upcomingBillings.map((sub) => {
                    const daysUntil = differenceInDays(new Date(sub.next_billing_date!), new Date());
                    
                    return (
                      <div 
                        key={sub.id}
                        className="flex items-center justify-between p-4 rounded-lg border"
                      >
                        <div className="flex items-center gap-3">
                          <Calendar className="h-5 w-5 text-muted-foreground" />
                          <div>
                            <span className="font-medium">{sub.companies?.name}</span>
                            <p className="text-sm text-muted-foreground">
                              {sub.plans?.name} - {formatCurrency(sub.plans?.monthly_price || 0)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant={daysUntil <= 3 ? "secondary" : "outline"}>
                            {daysUntil === 0 
                              ? "Hoje" 
                              : daysUntil === 1 
                                ? "Amanhã" 
                                : `Em ${daysUntil} dias`}
                          </Badge>
                          <p className="text-sm text-muted-foreground mt-1">
                            {format(new Date(sub.next_billing_date!), "dd/MM/yyyy")}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Pagamentos</CardTitle>
                <CardDescription>Últimos 50 pagamentos registrados</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id}
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {payment.status === "paid" ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <span className="font-medium">{payment.companies?.name}</span>
                          <p className="text-sm text-muted-foreground">
                            {payment.description || "Pagamento de assinatura"}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="font-medium">
                          {new Intl.NumberFormat("pt-BR", {
                            style: "currency",
                            currency: payment.currency.toUpperCase(),
                          }).format(payment.amount_cents / 100)}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(payment.paid_at || payment.created_at), "dd/MM/yyyy HH:mm")}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AdminLayout>
  );
}
