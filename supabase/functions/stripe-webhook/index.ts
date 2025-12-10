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

// ID do plano Starter no banco (will be looked up dynamically)
const STARTER_PRICE_ID = "price_1Scr1ORz1lrMiHrp2CYeXCbY";

// Enterprise plan features for trial
const ENTERPRISE_FEATURES = {
  canAccess360: true,
  canUseGamification: true,
  canUseFollowups: true,
  canAccessFullDashboard: true,
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// ========================================
// FUNÇÕES AUXILIARES
// ========================================

const generateTemporaryPassword = (): string => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%";
  let password = "";
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

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
    .select("id, name, features, seller_limit")
    .eq("stripe_monthly_price_id", priceId)
    .single();
  
  if (monthlyPlan) return monthlyPlan;

  // Then try annual price
  const { data: annualPlan } = await supabaseAdmin
    .from("plans")
    .select("id, name, features, seller_limit")
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
// TRIAL SIGNUP: checkout.session.completed
// ========================================

const handleCheckoutCompleted = async (session: Stripe.Checkout.Session) => {
  logStep("Checkout session completed", { 
    sessionId: session.id, 
    mode: session.mode,
    customerEmail: session.customer_email,
    metadata: session.metadata 
  });

  // Only handle trial signups
  if (session.metadata?.source !== "trial_signup") {
    logStep("Not a trial signup, skipping automatic company creation");
    return;
  }

  const customerEmail = session.customer_email || session.customer_details?.email;
  const customerName = session.customer_details?.name || "Empresa";
  const customerId = session.customer as string;

  if (!customerEmail) {
    logStep("ERROR: No customer email found");
    return;
  }

  logStep("Processing trial signup", { customerEmail, customerName, customerId });

  // 1. Check if user already exists
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
  const userExists = existingUser?.users?.find(u => u.email === customerEmail);
  
  if (userExists) {
    logStep("User already exists, checking for existing company", { userId: userExists.id });
    
    // Get the user's company
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("company_id")
      .eq("user_id", userExists.id)
      .single();

    if (profile?.company_id) {
      // Update existing company with trial
      logStep("User has existing company, updating with trial", { companyId: profile.company_id });
      await updateCompanyWithTrial(profile.company_id, customerId, session);
      return;
    }
    
    // User exists but has no company/profile - create everything for them
    logStep("User exists but has no company, creating company and profile");
    
    // Generate new password and update user to require password change
    const temporaryPassword = generateTemporaryPassword();
    await supabaseAdmin.auth.admin.updateUserById(userExists.id, {
      password: temporaryPassword,
      user_metadata: {
        ...userExists.user_metadata,
        requires_password_change: true,
      },
    });
    
    // Create company
    const { data: company, error: companyError } = await supabaseAdmin
      .from("companies")
      .insert({
        name: customerName,
        is_active: true,
        allow_followups: true,
      })
      .select()
      .single();

    if (companyError || !company) {
      logStep("ERROR creating company for existing user", { error: companyError });
      return;
    }

    logStep("Company created for existing user", { companyId: company.id });

    // Create profile
    await supabaseAdmin.from("profiles").insert({
      user_id: userExists.id,
      company_id: company.id,
      name: customerName,
      email: customerEmail,
      is_active: true,
    });

    // Create user role as manager
    await supabaseAdmin.from("user_roles").upsert({
      user_id: userExists.id,
      role: "manager",
    }, { onConflict: "user_id" });

    // Update company with trial data
    await updateCompanyWithTrial(company.id, customerId, session);

    // Create company settings
    await supabaseAdmin.from("company_settings").insert({
      company_id: company.id,
      followups_enabled: true,
      followup_delay_hours: 24,
    });

    // Create company limits
    await supabaseAdmin.from("company_limits").insert({
      company_id: company.id,
      max_requests_per_second: 100,
      max_ai_ops_per_minute: 60,
      max_messages_per_day: 100000,
    });

    // Send welcome email with new credentials
    await sendWelcomeEmail(customerEmail, customerName, temporaryPassword);

    logStep("Trial signup completed for existing user", { 
      companyId: company.id, 
      userId: userExists.id,
      email: customerEmail 
    });
    return;
  }

  // 2. Generate temporary password
  const temporaryPassword = generateTemporaryPassword();
  logStep("Generated temporary password");

  // 3. Create auth user
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: customerEmail,
    password: temporaryPassword,
    email_confirm: true,
    user_metadata: {
      name: customerName,
      requires_password_change: true,
    },
  });

  if (authError || !authData.user) {
    logStep("ERROR creating auth user", { error: authError });
    return;
  }

  const userId = authData.user.id;
  logStep("Auth user created", { userId });

  // 4. Create company
  const { data: company, error: companyError } = await supabaseAdmin
    .from("companies")
    .insert({
      name: customerName,
      is_active: true,
      allow_followups: true,
    })
    .select()
    .single();

  if (companyError || !company) {
    logStep("ERROR creating company", { error: companyError });
    return;
  }

  logStep("Company created", { companyId: company.id });

  // 5. Create profile
  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .insert({
      user_id: userId,
      company_id: company.id,
      name: customerName,
      email: customerEmail,
      is_active: true,
    });

  if (profileError) {
    logStep("ERROR creating profile", { error: profileError });
  }

  // 6. Create user role as manager
  const { error: roleError } = await supabaseAdmin
    .from("user_roles")
    .insert({
      user_id: userId,
      role: "manager",
    });

  if (roleError) {
    logStep("ERROR creating user role", { error: roleError });
  }

  // 7. Update company with trial data
  await updateCompanyWithTrial(company.id, customerId, session);

  // 8. Create company settings
  await supabaseAdmin.from("company_settings").insert({
    company_id: company.id,
    followups_enabled: true,
    followup_delay_hours: 24,
  });

  // 9. Create company limits
  await supabaseAdmin.from("company_limits").insert({
    company_id: company.id,
    max_requests_per_second: 100,
    max_ai_ops_per_minute: 60,
    max_messages_per_day: 100000,
  });

  // 10. Send welcome email with credentials
  await sendWelcomeEmail(customerEmail, customerName, temporaryPassword);

  logStep("Trial signup completed successfully", { 
    companyId: company.id, 
    userId,
    email: customerEmail 
  });
};

const updateCompanyWithTrial = async (
  companyId: string, 
  customerId: string, 
  session: Stripe.Checkout.Session
) => {
  // Get subscription details
  const subscriptionId = session.subscription as string;
  let trialStart: Date | null = null;
  let trialEnd: Date | null = null;
  let planId: string | null = null;

  if (subscriptionId) {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    if (subscription.trial_start && subscription.trial_end) {
      trialStart = new Date(subscription.trial_start * 1000);
      trialEnd = new Date(subscription.trial_end * 1000);
    }

    // Get plan from price
    const priceId = subscription.items.data[0]?.price?.id;
    if (priceId) {
      const plan = await findPlanByStripePrice(priceId);
      if (plan) {
        planId = plan.id;
      }
    }
  }

  // Update company with trial dates
  await supabaseAdmin
    .from("companies")
    .update({
      is_active: true,
      trial_ends_at: trialEnd?.toISOString() || null,
      free_start_date: trialStart?.toISOString().split('T')[0] || null,
      free_end_date: trialEnd?.toISOString().split('T')[0] || null,
    })
    .eq("id", companyId);

  // Create or update company subscription
  await supabaseAdmin
    .from("company_subscriptions")
    .upsert({
      company_id: companyId,
      stripe_customer_id: customerId,
      stripe_subscription_id: subscriptionId,
      status: "trialing",
      current_period_start: trialStart?.toISOString() || null,
      current_period_end: trialEnd?.toISOString() || null,
      next_billing_date: trialEnd?.toISOString() || null,
      plan_id: planId,
    }, { onConflict: "company_id" });

  logStep("Company updated with trial data", { 
    companyId, 
    trialEnd: trialEnd?.toISOString(),
    planId 
  });
};

const sendWelcomeEmail = async (email: string, name: string, password: string) => {
  logStep("Sending welcome email via edge function", { email, name });
  
  try {
    const response = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-welcome-email`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          email,
          name,
          temporaryPassword: password,
        }),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      logStep("Failed to send welcome email", { status: response.status, error: errorBody });
    } else {
      logStep("Welcome email sent successfully", { email });
    }
  } catch (error) {
    logStep("Error calling send-welcome-email function", { error: String(error) });
  }
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
      logStep("Subscription canceled but period still active", { 
        companyId: sub.company_id,
        periodEnd: periodEnd.toISOString()
      });
    } else {
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
      .update({ 
        is_active: true,
        // Clear trial dates when converting to paid
        free_start_date: null,
        free_end_date: null,
        trial_ends_at: null,
      })
      .eq("id", sub.company_id);
    
    logStep("Company reactivated", { companyId: sub.company_id });
  }

  // ========================================
  // Se subscription está em trial, manter empresa ativa
  // ========================================
  if (status === "trialing") {
    await supabaseAdmin
      .from("companies")
      .update({ is_active: true })
      .eq("id", sub.company_id);
    
    logStep("Company in trial, keeping active", { companyId: sub.company_id });
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
// ========================================

const handleRefund = async (refund: Stripe.Refund) => {
  logStep("Refund detected - IMMEDIATE INACTIVATION", { 
    refundId: refund.id, 
    amount: refund.amount, 
    status: refund.status 
  });

  const chargeId = refund.charge as string;
  if (!chargeId) {
    logStep("No charge ID in refund", { refundId: refund.id });
    return;
  }

  const charge = await stripe.charges.retrieve(chargeId);
  const customerId = charge.customer as string;

  if (!customerId) {
    logStep("No customer ID in charge", { chargeId });
    return;
  }

  const sub = await findCompanyByStripeCustomer(customerId);
  if (!sub) return;

  await supabaseAdmin.from("payment_history").insert({
    company_id: sub.company_id,
    stripe_payment_intent_id: charge.payment_intent as string,
    amount_cents: -refund.amount,
    currency: refund.currency,
    status: "refunded",
    description: refund.reason 
      ? `Reembolso: ${refund.reason}` 
      : "Reembolso processado",
    paid_at: new Date().toISOString(),
  });

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
  
  const { data: sub, error: subError } = await supabaseAdmin
    .from("company_subscriptions")
    .select("id, company_id, status, current_period_end, plan_id")
    .eq("stripe_customer_id", customerId)
    .single();

  if (subError || !sub) {
    logStep("No subscription found for customer", { customerId, error: subError });
    return;
  }

  const priceId = invoice.lines.data[0]?.price?.id;
  let planId = null;

  if (priceId) {
    const plan = await findPlanByStripePrice(priceId);
    if (plan) {
      planId = plan.id;
      logStep("Found plan from price", { planId, planName: plan.name });
    }
  }

  if (!planId && sub.plan_id) {
    planId = sub.plan_id;
    logStep("Using existing subscription plan", { planId });
  }

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

  const nextBillingDate = invoice.lines.data[0]?.period?.end 
    ? new Date(invoice.lines.data[0].period.end * 1000).toISOString()
    : null;

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

  const companyUpdate: Record<string, unknown> = { 
    is_active: true,
    // Clear trial dates when paid
    free_start_date: null,
    free_end_date: null,
    trial_ends_at: null,
  };
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
      // NEW: Handle checkout completion for trial signups
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      // Pagamento bem sucedido
      case "invoice.paid":
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      // Pagamento falhou
      case "invoice.payment_failed":
        await handleInvoiceFailed(event.data.object as Stripe.Invoice);
        break;

      // Subscription atualizada
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      // Subscription deletada
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // REEMBOLSO
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
