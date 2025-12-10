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

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

const findPlanByStripePrice = async (priceId: string) => {
  // First try to find by stripe_monthly_price_id
  const { data: monthlyPlan } = await supabaseAdmin
    .from("plans")
    .select("id, name")
    .eq("stripe_monthly_price_id", priceId)
    .single();
  
  if (monthlyPlan) return monthlyPlan;

  // Then try stripe_annual_price_id
  const { data: annualPlan } = await supabaseAdmin
    .from("plans")
    .select("id, name")
    .eq("stripe_annual_price_id", priceId)
    .single();
  
  return annualPlan;
};

const updateSubscriptionFromStripe = async (subscription: Stripe.Subscription) => {
  logStep("Updating subscription", { subscriptionId: subscription.id, status: subscription.status });

  const customerId = subscription.customer as string;
  
  // Find company by stripe_customer_id
  const { data: existingSub, error: findError } = await supabaseAdmin
    .from("company_subscriptions")
    .select("id, company_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (findError || !existingSub) {
    logStep("No subscription found for customer", { customerId, error: findError });
    return;
  }

  // Map Stripe status to our status
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
    // Also update company's plan_id
    await supabaseAdmin
      .from("companies")
      .update({ plan_id: planId })
      .eq("id", existingSub.company_id);
  }

  const { error: updateError } = await supabaseAdmin
    .from("company_subscriptions")
    .update(updateData)
    .eq("id", existingSub.id);

  if (updateError) {
    logStep("Error updating subscription", { error: updateError });
    return;
  }

  // Check if company should be inactivated (past_due for 7+ days)
  if (status === "past_due") {
    const nextBilling = new Date(subscription.current_period_end * 1000);
    const daysPastDue = Math.floor((Date.now() - nextBilling.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysPastDue >= 7) {
      logStep("Company past due for 7+ days, marking as inactive_due_payment", { companyId: existingSub.company_id, daysPastDue });
      
      await supabaseAdmin
        .from("company_subscriptions")
        .update({ status: "inactive_due_payment" })
        .eq("id", existingSub.id);

      await supabaseAdmin
        .from("companies")
        .update({ is_active: false })
        .eq("id", existingSub.company_id);
    }
  }

  // Reactivate company if subscription becomes active
  if (status === "active") {
    await supabaseAdmin
      .from("companies")
      .update({ is_active: true })
      .eq("id", existingSub.company_id);
  }

  logStep("Subscription updated successfully", { companyId: existingSub.company_id });
};

const handleInvoicePaid = async (invoice: Stripe.Invoice) => {
  logStep("Invoice paid", { invoiceId: invoice.id, customerId: invoice.customer });

  const customerId = invoice.customer as string;

  // Find company
  const { data: sub } = await supabaseAdmin
    .from("company_subscriptions")
    .select("company_id, id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) {
    logStep("No company found for customer", { customerId });
    return;
  }

  // Record payment
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

  // Update subscription status to active and update next_billing_date
  const nextBillingDate = invoice.lines.data[0]?.period?.end 
    ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
    : null;

  await supabaseAdmin
    .from("company_subscriptions")
    .update({ 
      status: "active", 
      next_billing_date: nextBillingDate,
      updated_at: new Date().toISOString() 
    })
    .eq("id", sub.id);

  // Ensure company is active
  await supabaseAdmin
    .from("companies")
    .update({ is_active: true })
    .eq("id", sub.company_id);

  logStep("Invoice payment recorded and company activated", { companyId: sub.company_id });
};

const handleInvoiceFailed = async (invoice: Stripe.Invoice) => {
  logStep("Invoice payment failed", { invoiceId: invoice.id, customerId: invoice.customer });

  const customerId = invoice.customer as string;

  const { data: sub } = await supabaseAdmin
    .from("company_subscriptions")
    .select("company_id, id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) {
    logStep("No company found for customer", { customerId });
    return;
  }

  // Record failed payment
  await supabaseAdmin.from("payment_history").insert({
    company_id: sub.company_id,
    stripe_invoice_id: invoice.id,
    stripe_payment_intent_id: invoice.payment_intent as string,
    amount_cents: invoice.amount_due,
    currency: invoice.currency,
    status: "failed",
    description: invoice.lines.data[0]?.description || "Tentativa de pagamento falhou",
  });

  // Update subscription status to past_due
  await supabaseAdmin
    .from("company_subscriptions")
    .update({ status: "past_due", updated_at: new Date().toISOString() })
    .eq("id", sub.id);

  logStep("Failed payment recorded", { companyId: sub.company_id });
};

const handleSubscriptionDeleted = async (subscription: Stripe.Subscription) => {
  logStep("Subscription deleted", { subscriptionId: subscription.id });

  const customerId = subscription.customer as string;

  const { data: sub } = await supabaseAdmin
    .from("company_subscriptions")
    .select("company_id, id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (!sub) return;

  // Mark subscription as canceled
  await supabaseAdmin
    .from("company_subscriptions")
    .update({ 
      status: "canceled", 
      stripe_subscription_id: null,
      updated_at: new Date().toISOString() 
    })
    .eq("id", sub.id);

  // Inactivate company immediately
  await supabaseAdmin
    .from("companies")
    .update({ is_active: false })
    .eq("id", sub.company_id);

  logStep("Subscription canceled and company inactivated", { companyId: sub.company_id });
};

serve(async (req) => {
  const signature = req.headers.get("stripe-signature");
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

  if (!signature || !webhookSecret) {
    logStep("Missing signature or webhook secret");
    return new Response("Missing signature", { status: 400 });
  }

  try {
    const body = await req.text();
    const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);

    logStep("Webhook received", { type: event.type, id: event.id });

    switch (event.type) {
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;
      case "customer.subscription.updated":
        await updateSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
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
