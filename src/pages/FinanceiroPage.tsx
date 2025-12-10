import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { 
  CreditCard, 
  Calendar, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink,
  RefreshCw,
  Crown,
  ArrowUpRight,
  XCircle,
  MessageCircle
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Plan {
  id: string;
  name: string;
  monthly_price: number;
  annual_price: number;
  seller_limit: number | null;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
}

interface Subscription {
  id: string;
  status: string;
  plan_id: string | null;
  next_billing_date: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plans: Plan | null;
}

interface Payment {
  id: string;
  amount_cents: number;
  currency: string;
  status: string;
  description: string | null;
  paid_at: string | null;
  created_at: string;
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  active: { label: "Ativo", variant: "default" },
  trialing: { label: "Em teste", variant: "secondary" },
  past_due: { label: "Pagamento pendente", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
  inactive: { label: "Inativo", variant: "outline" },
  inactive_due_payment: { label: "Inativo por pagamento", variant: "destructive" },
};

export default function FinanceiroPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [checkingStatus, setCheckingStatus] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Assinatura realizada com sucesso!");
    } else if (searchParams.get("canceled") === "true") {
      toast.info("Checkout cancelado");
    }
  }, [searchParams]);

  useEffect(() => {
    if (user?.companyId) {
      loadData();
    }
  }, [user?.companyId]);

  const loadData = async () => {
    if (!user?.companyId) return;

    setLoading(true);
    try {
      // Load subscription
      const { data: subData } = await supabase
        .from("company_subscriptions")
        .select(`*, plans:plan_id (*)`)
        .eq("company_id", user.companyId)
        .single();
      
      setSubscription(subData);

      // Load payment history
      const { data: paymentData } = await supabase
        .from("payment_history")
        .select("*")
        .eq("company_id", user.companyId)
        .order("created_at", { ascending: false })
        .limit(10);
      
      setPayments(paymentData || []);

      // Load all plans (excluding Free plan - admin only)
      const { data: plansData } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .gt("monthly_price", 0)
        .order("monthly_price", { ascending: true });
      
      setPlans(plansData || []);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkSubscriptionStatus = async () => {
    setCheckingStatus(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      
      toast.success("Status atualizado");
      loadData();
    } catch (error) {
      toast.error("Erro ao verificar status");
    } finally {
      setCheckingStatus(false);
    }
  };

  const openCustomerPortal = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal", {
        body: { returnUrl: window.location.href }
      });
      
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      toast.error("Erro ao abrir portal de pagamentos");
    }
  };

  const handleSubscribe = async (plan: Plan, billingCycle: "monthly" | "annual") => {
    const priceId = billingCycle === "monthly" 
      ? plan.stripe_monthly_price_id 
      : plan.stripe_annual_price_id;

    if (!priceId) {
      toast.error("Este plano ainda não está configurado para assinatura");
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId,
          planId: plan.id,
          billingCycle,
          successUrl: `${window.location.origin}/financeiro?success=true`,
          cancelUrl: `${window.location.origin}/financeiro?canceled=true`
        }
      });

      if (error) throw error;
      
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (error) {
      toast.error("Erro ao iniciar checkout");
    }
  };

  const formatCurrency = (cents: number, currency = "brl") => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid gap-6 md:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </AppLayout>
    );
  }

  // Only show current plan if subscription is active
  const isSubscriptionActive = subscription?.status === "active";
  const currentPlan = isSubscriptionActive ? subscription?.plans : null;
  const status = statusMap[subscription?.status || "inactive"] || statusMap.inactive;

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Financeiro</h1>
            <p className="text-muted-foreground">Gerencie sua assinatura e pagamentos</p>
          </div>
          <Button 
            variant="outline" 
            onClick={checkSubscriptionStatus}
            disabled={checkingStatus}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${checkingStatus ? "animate-spin" : ""}`} />
            Atualizar status
          </Button>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {/* Current Subscription */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                Plano Atual
              </CardTitle>
              <CardDescription>Detalhes da sua assinatura</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentPlan ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-2xl font-bold">{currentPlan.name}</span>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Preço mensal:</span>
                      <span>{formatCurrency(currentPlan.monthly_price * 100)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Limite de vendedores:</span>
                      <span>{currentPlan.seller_limit || "Ilimitado"}</span>
                    </div>
                    {subscription?.next_billing_date && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Próxima cobrança:</span>
                        <span>
                          {format(new Date(subscription.next_billing_date), "dd/MM/yyyy", { locale: ptBR })}
                        </span>
                      </div>
                    )}
                    {subscription?.cancel_at_period_end && (
                      <div className="flex items-center gap-2 text-amber-600 mt-2">
                        <AlertTriangle className="h-4 w-4" />
                        <span>Cancelamento agendado ao fim do período</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 flex flex-col gap-2">
                    <Button onClick={openCustomerPortal} className="w-full">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Gerenciar assinatura
                      <ExternalLink className="h-3 w-3 ml-2" />
                    </Button>
                    <Button 
                      variant="outline" 
                      className="w-full text-destructive hover:text-destructive"
                      onClick={() => setShowCancelModal(true)}
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Cancelar assinatura
                    </Button>
                  </div>
                </>
              ) : (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">Você ainda não possui uma assinatura ativa</p>
                  <p className="text-sm">Escolha um plano abaixo para começar</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payment History */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Histórico de Pagamentos
              </CardTitle>
              <CardDescription>Últimos pagamentos realizados</CardDescription>
            </CardHeader>
            <CardContent>
              {payments.length > 0 ? (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div 
                      key={payment.id} 
                      className="flex items-center justify-between p-3 rounded-lg border"
                    >
                      <div className="flex items-center gap-3">
                        {payment.status === "paid" ? (
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        ) : (
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                        )}
                        <div>
                          <p className="font-medium text-sm">
                            {formatCurrency(payment.amount_cents, payment.currency)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {payment.paid_at 
                              ? format(new Date(payment.paid_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                              : format(new Date(payment.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })
                            }
                          </p>
                        </div>
                      </div>
                      <Badge variant={payment.status === "paid" ? "default" : "destructive"}>
                        {payment.status === "paid" ? "Pago" : "Falhou"}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p>Nenhum pagamento registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Available Plans */}
        <Card>
          <CardHeader>
            <CardTitle>Planos Disponíveis</CardTitle>
            <CardDescription>
              {currentPlan 
                ? "Faça upgrade ou downgrade do seu plano" 
                : "Escolha o plano ideal para sua empresa"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => {
                const isCurrentPlan = currentPlan?.id === plan.id;
                
                return (
                  <div 
                    key={plan.id}
                    className={`relative p-4 rounded-lg border-2 transition-colors ${
                      isCurrentPlan 
                        ? "border-primary bg-primary/5" 
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    {isCurrentPlan && (
                      <Badge className="absolute -top-2 -right-2">Atual</Badge>
                    )}
                    
                    <h3 className="font-bold text-lg">{plan.name}</h3>
                    <p className="text-2xl font-bold mt-2">
                      {formatCurrency(plan.monthly_price * 100)}
                      <span className="text-sm font-normal text-muted-foreground">/mês</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      ou {formatCurrency(plan.annual_price * 100)}/ano
                    </p>
                    <p className="text-sm text-muted-foreground mt-2">
                      {plan.seller_limit ? `Até ${plan.seller_limit} vendedores` : "Vendedores ilimitados"}
                    </p>
                    
                    {!isCurrentPlan && plan.stripe_monthly_price_id && (
                      <Button 
                        size="sm" 
                        className="w-full mt-4"
                        onClick={() => handleSubscribe(plan, "monthly")}
                      >
                        {currentPlan ? "Trocar plano" : "Assinar"}
                        <ArrowUpRight className="h-3 w-3 ml-1" />
                      </Button>
                    )}
                    
                    {!isCurrentPlan && !plan.stripe_monthly_price_id && (
                      <p className="text-xs text-muted-foreground mt-4 text-center">
                        Entre em contato para assinar
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Cancel Subscription Modal */}
        <Dialog open={showCancelModal} onOpenChange={setShowCancelModal}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                Cancelar Assinatura
              </DialogTitle>
              <DialogDescription>
                Para cancelar sua assinatura, entre em contato com nosso suporte.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <p className="text-sm text-muted-foreground">
                Nossa equipe está pronta para ajudá-lo com o processo de cancelamento e esclarecer qualquer dúvida.
              </p>
              <div className="bg-muted/50 p-4 rounded-lg">
                <p className="text-sm font-medium">Entre em contato:</p>
                <a 
                  href="https://wa.me/5551995087130" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:underline flex items-center gap-2 mt-2"
                >
                  💬 WhatsApp: (51) 99508-7130
                </a>
              </div>
            </div>
            <div className="flex justify-end">
              <Button variant="outline" onClick={() => setShowCancelModal(false)}>
                Fechar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
