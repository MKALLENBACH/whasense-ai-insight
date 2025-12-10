import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user) throw new Error("User not authenticated");

    const user = userData.user;
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Get request body
    const { priceId, planId, successUrl, cancelUrl, billingCycle } = await req.json();
    
    if (!priceId) throw new Error("Price ID is required");
    logStep("Request params", { priceId, planId, billingCycle });

    // Get user's company
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) throw new Error("User has no company");
    logStep("Company found", { companyId: profile.company_id });

    // Get company details
    const { data: company } = await supabaseClient
      .from("companies")
      .select("id, name")
      .eq("id", profile.company_id)
      .single();

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if company already has a Stripe customer
    const { data: existingSub } = await supabaseClient
      .from("company_subscriptions")
      .select("stripe_customer_id, stripe_subscription_id, status")
      .eq("company_id", profile.company_id)
      .single();

    let customerId = existingSub?.stripe_customer_id;

    if (!customerId) {
      // Create new Stripe customer
      const customer = await stripe.customers.create({
        email: user.email,
        name: company?.name || user.email,
        metadata: {
          company_id: profile.company_id,
          user_id: user.id,
        },
      });
      customerId = customer.id;
      logStep("Created Stripe customer", { customerId });

      // Create subscription record
      await supabaseClient
        .from("company_subscriptions")
        .upsert({
          company_id: profile.company_id,
          stripe_customer_id: customerId,
          plan_id: planId,
          status: "inactive",
        }, { onConflict: "company_id" });
    } else {
      logStep("Using existing Stripe customer", { customerId });
    }

    // Check for existing active subscription
    if (existingSub?.stripe_subscription_id && existingSub.status === "active") {
      logStep("Customer already has active subscription, redirecting to portal");
      // Redirect to customer portal for upgrades/downgrades
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: successUrl || `${req.headers.get("origin")}/financeiro`,
      });
      return new Response(JSON.stringify({ url: portalSession.url, isPortal: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Create checkout session with promo codes enabled
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      allow_promotion_codes: true,
      success_url: successUrl || `${req.headers.get("origin")}/financeiro?success=true`,
      cancel_url: cancelUrl || `${req.headers.get("origin")}/financeiro?canceled=true`,
      billing_address_collection: "auto",
      metadata: {
        company_id: profile.company_id,
        plan_id: planId,
        billing_cycle: billingCycle || "monthly",
      },
      subscription_data: {
        metadata: {
          company_id: profile.company_id,
          plan_id: planId,
          billing_cycle: billingCycle || "monthly",
        },
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    // Update plan_id in subscription record
    if (planId) {
      await supabaseClient
        .from("company_subscriptions")
        .update({ plan_id: planId })
        .eq("company_id", profile.company_id);
    }

    return new Response(JSON.stringify({ url: session.url, isPortal: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
