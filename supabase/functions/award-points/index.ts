import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Points configuration
const POINTS_CONFIG = {
  sale_won: { points: 10, reason: "Venda concluída" },
  quick_response: { points: 2, reason: "Resposta rápida (<2 min)" },
  lead_recovered: { points: 5, reason: "Lead recuperado" },
  goal_achieved: { points: 20, reason: "Meta atingida" },
  insight_applied: { points: 1, reason: "Insight aplicado" },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { event_type, vendor_id, company_id, sale_id } = await req.json();

    console.log(`Awarding points for ${event_type} to vendor ${vendor_id}`);

    if (!event_type || !vendor_id || !company_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const config = POINTS_CONFIG[event_type as keyof typeof POINTS_CONFIG];
    if (!config) {
      return new Response(
        JSON.stringify({ error: "Unknown event type" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert points
    const { data, error } = await supabase
      .from("gamification_points")
      .insert({
        company_id,
        vendor_id,
        points: config.points,
        reason: config.reason,
        sale_id: sale_id || null,
      })
      .select()
      .single();

    if (error) throw error;

    console.log(`Awarded ${config.points} points for ${config.reason}`);

    return new Response(
      JSON.stringify({ success: true, points: config.points, data }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in award-points:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
