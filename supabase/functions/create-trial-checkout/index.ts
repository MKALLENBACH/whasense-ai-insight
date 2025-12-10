import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Starter plan monthly price ID
const STARTER_PRICE_ID = "price_1Scr1ORz1lrMiHrp2CYeXCbY";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-TRIAL-CHECKOUT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const { successUrl, cancelUrl } = await req.json();
    const origin = req.headers.get("origin") || "https://whasense.lovable.app";

    logStep("Creating trial checkout session", { 
      priceId: STARTER_PRICE_ID,
      trialDays: 7 
    });

    // Create checkout session with 7-day trial
    // No user auth required - this is for new signups
    const session = await stripe.checkout.sessions.create({
      line_items: [{ price: STARTER_PRICE_ID, quantity: 1 }],
      mode: "subscription",
      payment_method_collection: "always",
      subscription_data: {
        trial_period_days: 7,
        trial_settings: {
          end_behavior: {
            missing_payment_method: "cancel",
          },
        },
        metadata: {
          source: "trial_signup",
          plan: "starter",
        },
      },
      success_url: successUrl || `${origin}/trial-success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${origin}/login`,
      billing_address_collection: "required",
      customer_creation: "always",
      allow_promotion_codes: true,
      consent_collection: {
        terms_of_service: "none",
      },
      custom_text: {
        submit: {
          message: "Você terá 7 dias de acesso grátis. A cobrança só será realizada após o período de teste.",
        },
      },
      metadata: {
        source: "trial_signup",
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
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
