import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FREE_PLAN_ID = "8af5c9e1-02a3-4705-b312-6f33bcc0d965";

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[EXPIRE-FREE-TRIALS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authorization: Require internal cron secret for background jobs
    const cronSecret = Deno.env.get('INTERNAL_CRON_SECRET');
    const { secret } = await req.json().catch(() => ({}));
    
    if (cronSecret && secret !== cronSecret) {
      console.warn('Unauthorized expire-free-trials attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    logStep("Starting free trial expiration check");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const today = new Date().toISOString().split("T")[0];
    logStep("Checking for expired trials", { today });

    // Find companies with FREE plan where free_end_date has passed
    const { data: expiredCompanies, error: fetchError } = await supabase
      .from("companies")
      .select("id, name, free_end_date")
      .eq("plan_id", FREE_PLAN_ID)
      .lt("free_end_date", today);

    if (fetchError) {
      throw new Error(`Error fetching expired companies: ${fetchError.message}`);
    }

    if (!expiredCompanies || expiredCompanies.length === 0) {
      logStep("No expired trials found");
      return new Response(
        JSON.stringify({ success: true, expired: 0, message: "No expired trials" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Found expired trials", { count: expiredCompanies.length });

    let expiredCount = 0;
    for (const company of expiredCompanies) {
      logStep("Expiring trial for company", { 
        companyId: company.id, 
        companyName: company.name,
        freeEndDate: company.free_end_date 
      });

      // Remove the plan (set to null = "Sem Plano")
      const { error: updateError } = await supabase
        .from("companies")
        .update({ plan_id: null })
        .eq("id", company.id);

      if (updateError) {
        logStep("Error expiring trial", { 
          companyId: company.id, 
          error: updateError.message 
        });
      } else {
        expiredCount++;
        logStep("Trial expired successfully", { companyId: company.id });
      }
    }

    logStep("Expiration complete", { total: expiredCompanies.length, expired: expiredCount });

    return new Response(
      JSON.stringify({ 
        success: true, 
        expired: expiredCount, 
        total: expiredCompanies.length,
        message: `Expired ${expiredCount} of ${expiredCompanies.length} trials` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});