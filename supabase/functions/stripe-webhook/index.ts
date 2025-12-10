import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2025-08-27.basil",
});

const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);

// ID do plano "Inativo" no banco
const INACTIVE_PLAN_ID = "fadfe68e-1f50-4e59-8815-40fc9d590fa8";

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

const findCompanyByStripeCustomer = async (customerId: string) => {
  const { data, error } = await supabaseAdmin
    .from("company_subscriptions")
    .select("id, company_id, status, current_period_end")
    .eq("stripe_customer_id", customerId)
    .single();

  if (error || !data) {
    logStep("No subscription found for customer", { customerId, error });
    return null;
  }
  return data;
};

const findPlanByStripePrice = async (priceId: string) => {
  // Try monthly price first
  const { data: monthlyPlan } = await supabaseAdmin
    .from("plans")
    .select("id, name")
    .eq("stripe_monthly_price_id", priceId)
    .single();
  
  if (monthlyPlan) return monthlyPlan;

  // Then try annual price
  const { data: annualPlan } = await supabaseAdmin
    .from("plans")
    .select("id, name")
    .eq("stripe_annual_price_id", priceId)
    .single();
  
  return annualPlan;
};

// ========================================
// AÇÃO PRINCIPAL: INATIVAR EMPRESA
// ========================================

const inactivateCompany = async (
  companyId: string, 
  subscriptionId: string, 
  reason: string,
  status: string = "inactive"
) => {
  logStep("Inactivating company", { companyId, reason, status });

  // 1. Atualizar subscription para status inativo e plano Inativo
  await supabaseAdmin
    .from("company_subscriptions")
    .update({ 
      status: status,
      plan_id: INACTIVE_PLAN_ID,
      updated_at: new Date().toISOString() 
    })
    .eq("id", subscriptionId);

  // 2. Atualizar company: is_active = false, plan_id = Inativo
  await supabaseAdmin
    .from("companies")
    .update({ 
      is_active: false,
      plan_id: INACTIVE_PLAN_ID 
    })
    .eq("id", companyId);

  logStep("Company inactivated successfully", { companyId, reason });
};

// ========================================
// REGRA 1: INADIMPLÊNCIA (7+ dias sem pagar)
// ========================================

const handleInvoiceFailed = async (invoice: Stripe.Invoice) => {
  logStep("Invoice payment failed", { invoiceId: invoice.id, customerId: invoice.customer });

  const customerId = invoice.customer as string;
  const sub = await findCompanyByStripeCustomer(customerId);

  if (!sub) return;

  // Registrar pagamento falho
  await supabaseAdmin.from("payment_history").insert({
    company_id: sub.company_id,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    amount_cents: invoice.amount_due,
    currency: invoice.currency,
    status: "failed",
    description: invoice.lines.data[0]?.description || "Tentativa de pagamento falhou",
  });

  // Atualizar subscription para past_due
  await supabaseAdmin
    .from("company_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("id", sub.id);

  // Verificar se está inadimplente há 7+ dias
  // Se current_period_end já passou, calculamos os dias
  if (sub.current_period_end) {
    const periodEnd = new Date(sub.current_period_end);
    const daysPastDue = Math.floor((Date.now() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysPastDue >= 7) {
      logStep("Company past due for 7+ days, marking inactive", { 
        companyId: sub.company_id, 
        daysPastDue 
      });
      
      await inactivateCompany(
        sub.company_id, 
        sub.id, 
        `Inadimplência de ${daysPastDue} dias`,
        "inactive_due_payment"
      );
    }
  }

  logStep("Failed payment processed", { companyId: sub.company_id });
};

// ========================================
// REGRA 2 & 3: CANCELAMENTO E REEMBOLSO
// ========================================

const handleSubscriptionUpdated = async (subscription: Stripe.Subscription) => {
  logStep("Subscription updated", { 
    subscriptionId: subscription.id, 
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end 
  });

  const customerId = subscription.customer as string;
  const sub = await findCompanyByStripeCustomer(customerId);

  if (!sub) return;

  // Map Stripe status
  let status = subscription.status as string;
  if (status === "incomplete" || status === "incomplete_expired") {
    status = "inactive";
  }

  // Get price info to find plan
  const priceId = subscription.items.data[0]?.price?.id;
  let planId = null;

  if (priceId) {
    const plan = await findPlanByStripePrice(priceId);
    if (plan) {
      planId = plan.id;
      logStep("Found matching plan", { planId, planName: plan.name });
    }
  }

  const updateData: Record<string, unknown> = {
    stripe_subscription_id: subscription.id,
    status: status,
    current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
    current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
    next_billing_date: new Date(subscription.current_period_end * 1000).toISOString(),
    cancel_at_period_end: subscription.cancel_at_period_end,
    updated_at: new Date().toISOString(),
  };

  if (planId) {
    updateData.plan_id = planId;
  }

  // Atualizar subscription
  await supabaseAdmin
    .from("company_subscriptions")
    .update(updateData)
    .eq("id", sub.id);

  // Se planId foi encontrado, atualizar company também
  if (planId) {
    await supabaseAdmin
      .from("companies")
      .update({ plan_id: planId })
      .eq("id", sub.company_id);
  }

  // ========================================
  // REGRA: Status = canceled com current_period_end > now
  // → Mantém acesso até o fim do período
  // ========================================
  if (status === "canceled") {
    const periodEnd = new Date(subscription.current_period_end * 1000);
    const now = new Date();

    if (periodEnd > now) {
      // Cancelado mas ainda dentro do período pago
      // Mantém acesso - apenas marca como canceled
      logStep("Subscription canceled but period still active", { 
        companyId: sub.company_id,
        periodEnd: periodEnd.toISOString()
      });
    } else {
      // Período já expirou - inativar imediatamente
      await inactivateCompany(
        sub.company_id, 
        sub.id, 
        "Assinatura cancelada e período expirado",
        "canceled"
      );
    }
    return;
  }

  // ========================================
  // REGRA: Inadimplência (past_due por 7+ dias)
  // ========================================
  if (status === "past_due") {
    const periodEnd = new Date(subscription.current_period_end * 1000);
    const daysPastDue = Math.floor((Date.now() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysPastDue >= 7) {
      logStep("Company past due for 7+ days via subscription update", { 
        companyId: sub.company_id, 
        daysPastDue 
      });
      
      await inactivateCompany(
        sub.company_id, 
        sub.id, 
        `Inadimplência de ${daysPastDue} dias`,
        "inactive_due_payment"
      );
      return;
    }
  }

  // ========================================
  // Se subscription ficou ativa, reativar empresa
  // ========================================
  if (status === "active") {
    await supabaseAdmin
      .from("companies")
      .update({ is_active: true })
      .eq("id", sub.company_id);
    
    logStep("Company reactivated", { companyId: sub.company_id });
  }

  logStep("Subscription updated successfully", { companyId: sub.company_id, status });
};

// ========================================
// REGRA 2: ASSINATURA DELETADA (fim definitivo)
// ========================================

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  logStep("Subscription deleted", { subscriptionId: subscription.id });

  const customerId = subscription.customer as string;
  const sub = await findCompanyByStripeCustomer(customerId);

  if (!sub) return;

  // Quando subscription é deletada, inativar imediatamente
  await supabaseAdmin
    .from("company_subscriptions")
    .update({ 
      status: "canceled", 
      stripe_subscription_id: null,
      plan_id: INACTIVE_PLAN_ID,
      updated_at: new Date().toISOString() 
    })
    .eq("id", sub.id);

  await supabaseAdmin
    .from("companies")
    .update({ 
      is_active: false,
      plan_id: INACTIVE_PLAN_ID 
    })
    .eq("id", sub.company_id);

  logStep("Subscription deleted and company inactivated", { companyId: sub.company_id });
};

// ========================================
// REGRA 3: REEMBOLSO (PRIORIDADE MÁXIMA)
// Inativar IMEDIATAMENTE, sem esperar período
// ========================================

const handleRefund = async (refund: Stripe.Refund) => {
  logStep("Refund detected - IMMEDIATE INACTIVATION", { 
    refundId: refund.id, 
    amount: refund.amount, 
    status: refund.status 
  });

  // Get the charge to find the customer
  const chargeId = refund.charge as string;
  if (!chargeId) {
    logStep("No charge ID in refund", { refundId: refund.id });
    return;
  }

  // Fetch the charge to get customer ID
  const charge = await stripe.charges.retrieve(chargeId);
  const customerId = charge.customer as string;

  if (!customerId) {
    logStep("No customer ID in charge", { chargeId });
    return;
  }

  const sub = await findCompanyByStripeCustomer(customerId);
  if (!sub) return;

  // Registrar reembolso no histórico
  await supabaseAdmin.from("payment_history").insert({
    company_id: sub.company_id,
    stripe_payment_intent_id: charge.payment_intent as string,
    amount_cents: -refund.amount, // Valor negativo para reembolso
    currency: refund.currency,
    status: "refunded",
    description: refund.reason 
      ? `Reembolso: ${refund.reason}` 
      : "Reembolso processado",
    paid_at: new Date().toISOString(),
  });

  // ========================================
  // REGRA: Reembolso = INATIVAR IMEDIATAMENTE
  // Não importa se é total ou parcial
  // ========================================
  await inactivateCompany(
    sub.company_id, 
    sub.id, 
    `Reembolso de ${refund.amount / 100} ${refund.currency.toUpperCase()}`,
    "canceled"
  );

  logStep("Refund processed - company inactivated immediately", { 
    companyId: sub.company_id, 
    refundAmount: refund.amount 
  });
};

// ========================================
// INVOICE PAID - Reativar empresa se estava inativa
// ========================================

const handleInvoicePaid = async (invoice: Stripe.Invoice) => {
  logStep("Invoice paid", { invoiceId: invoice.id, customerId: invoice.customer });

  const customerId = invoice.customer as string;
  
  // Get subscription with more details
  const { data: sub, error: subError } = await supabaseAdmin
    .from("company_subscriptions")
    .select("id, company_id, status, current_period_end, plan_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (subError || !sub) {
    logStep("No subscription found for customer", { customerId, error: subError });
    return;
  }

  // Get plan from invoice price
  const priceId = invoice.lines.data[0]?.price?.id;
  let planId = null;

  if (priceId) {
    const plan = await findPlanByStripePrice(priceId);
    if (plan) {
      planId = plan.id;
      logStep("Found plan from price", { planId, planName: plan.name });
    }
  }

  // If no plan found from price, use existing subscription plan_id
  if (!planId && sub.plan_id) {
    planId = sub.plan_id;
    logStep("Using existing subscription plan", { planId });
  }

  // Registrar pagamento
  await supabaseAdmin.from("payment_history").insert({
    company_id: sub.company_id,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    amount_cents: invoice.amount_paid,
    currency: invoice.currency,
    status: "paid",
    description: invoice.lines.data[0]?.description || "Pagamento de assinatura",
    paid_at: invoice.status_transitions?.paid_at 
      ? new Date(invoice.status_transitions.paid_at * 1000).toISOString() 
      : new Date().toISOString(),
  });

  // Next billing date
  const nextBillingDate = invoice.lines.data[0]?.period?.end 
    ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
    : null;

  // Atualizar subscription
  const subscriptionUpdate: Record<string, unknown> = { 
    status: "active", 
    next_billing_date: nextBillingDate,
    updated_at: new Date().toISOString() 
  };

  if (planId) {
    subscriptionUpdate.plan_id = planId;
  }

  await supabaseAdmin
    .from("company_subscriptions")
    .update(subscriptionUpdate)
    .eq("id", sub.id);

  // Reativar empresa e atualizar plano
  const companyUpdate: Record<string, unknown> = { is_active: true };
  if (planId) {
    companyUpdate.plan_id = planId;
  }

  await supabaseAdmin
    .from("companies")
    .update(companyUpdate)
    .eq("id", sub.company_id);

  logStep("Invoice paid - company activated", { companyId: sub.company_id, planId });
};

// ========================================
// MAIN HANDLER
// ========================================

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    logStep("Missing signature or webhook secret");
    return new Response("Missing signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);

    logStep("Webhook received", { type: event.type, id: event.id });

    switch (event.type) {
      // Pagamento bem sucedido
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      // Pagamento falhou (pode iniciar contagem de inadimplência)
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      // Subscription atualizada (cancelamento, mudança de status, etc)
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      // Subscription deletada (fim definitivo)
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // REEMBOLSO - PRIORIDADE MÁXIMA
      case "charge.refunded":
      case "charge.refund.updated":
      case "refund.created":
        await handleRefund(event.data.object as Stripe.Refund);
        break;

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Webhook error", { error: errorMessage });
    return new Response(`Webhook Error: ${errorMessage}`, { status: 400 });
  }
});
