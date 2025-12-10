import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
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

    // Get user's company
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("company_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ subscribed: false, reason: "no_company" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    // Get company subscription from database
    const { data: localSub } = await supabaseClient
      .from("company_subscriptions")
      .select(`
        *,
        plans:plan_id (id, name, monthly_price, annual_price, seller_limit)
      `)
      .eq("company_id", profile.company_id)
      .single();

    if (!localSub || !localSub.stripe_customer_id) {
      logStep("No subscription found locally");
      return new Response(JSON.stringify({ 
        subscribed: false, 
        reason: "no_subscription",
        company_id: profile.company_id 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    logStep("Local subscription found", { status: localSub.status });

    // Verify with Stripe for the latest status
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const subscriptions = await stripe.subscriptions.list({
      customer: localSub.stripe_customer_id,
      status: "all",
      limit: 1,
    });

    let stripeStatus = "inactive";
    let subscriptionEnd = null;
    let cancelAtPeriodEnd = false;

    if (subscriptions.data.length > 0) {
      const stripeSub = subscriptions.data[0];
      stripeStatus = stripeSub.status;
      subscriptionEnd = new Date(stripeSub.current_period_end * 1000).toISOString();
      cancelAtPeriodEnd = stripeSub.cancel_at_period_end;

      // Update local status if different
      if (stripeStatus !== localSub.status || cancelAtPeriodEnd !== localSub.cancel_at_period_end) {
        logStep("Syncing subscription status", { stripeStatus, localStatus: localSub.status });
        
        let mappedStatus = stripeStatus;
        if (stripeStatus === "incomplete" || stripeStatus === "incomplete_expired") {
          mappedStatus = "inactive";
        }

        await supabaseClient
          .from("company_subscriptions")
          .update({
            status: mappedStatus,
            next_billing_date: subscriptionEnd,
            current_period_end: subscriptionEnd,
            cancel_at_period_end: cancelAtPeriodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq("id", localSub.id);
      }

      // Check for 7-day past_due inactivation
      if (stripeStatus === "past_due") {
        const periodEnd = new Date(stripeSub.current_period_end * 1000);
        const daysPastDue = Math.floor((Date.now() - periodEnd.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysPastDue >= 7 && localSub.status !== "inactive_due_payment") {
          logStep("Company past due for 7+ days, marking as inactive_due_payment");
          
          await supabaseClient
            .from("company_subscriptions")
            .update({ status: "inactive_due_payment" })
            .eq("id", localSub.id);

          await supabaseClient
            .from("companies")
            .update({ is_active: false })
            .eq("id", profile.company_id);

          stripeStatus = "inactive_due_payment";
        }
      }
    }

    const isActive = stripeStatus === "active" || stripeStatus === "trialing";

    logStep("Returning subscription status", { isActive, stripeStatus });

    return new Response(JSON.stringify({
      subscribed: isActive,
      status: stripeStatus,
      subscription_end: subscriptionEnd,
      cancel_at_period_end: cancelAtPeriodEnd,
      plan: localSub.plans,
      company_id: profile.company_id,
      next_billing_date: localSub.next_billing_date,
    }), {
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
