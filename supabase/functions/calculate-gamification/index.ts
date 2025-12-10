import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Starting gamification calculation...");

    const now = new Date();
    const dayStart = now.toISOString().split("T")[0];
    const weekStart = new Date(now.setDate(now.getDate() - now.getDay())).toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    // Get all active companies
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id")
      .eq("is_active", true);

    if (companiesError) throw companiesError;

    console.log(`Processing ${companies?.length || 0} companies`);

    for (const company of companies || []) {
      // Get sellers for this company
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id")
        .eq("company_id", company.id);

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "seller");

      const sellerUserIds = new Set(roles?.map(r => r.user_id) || []);
      const sellers = (profiles || []).filter(p => sellerUserIds.has(p.user_id));

      console.log(`Company ${company.id}: Found ${sellers.length} sellers`);

      for (const seller of sellers) {
        // Calculate points for different periods
        for (const period of ["daily", "weekly", "monthly"] as const) {
          const periodStart = period === "daily" ? dayStart : period === "weekly" ? weekStart : monthStart;

          // Get points for this period
          const { data: pointsData } = await supabase
            .from("gamification_points")
            .select("points")
            .eq("vendor_id", seller.user_id)
            .eq("company_id", company.id)
            .gte("created_at", `${periodStart}T00:00:00Z`);

          const totalPoints = (pointsData || []).reduce((acc, p) => acc + p.points, 0);

          console.log(`Seller ${seller.user_id} - ${period}: ${totalPoints} points`);

          // Upsert leaderboard entry
          const { error: upsertError } = await supabase
            .from("leaderboard")
            .upsert({
              company_id: company.id,
              vendor_id: seller.user_id,
              period,
              period_start: periodStart,
              total_points: totalPoints,
            }, {
              onConflict: "company_id,vendor_id,period,period_start",
            });

          if (upsertError) {
            console.error(`Leaderboard upsert error:`, upsertError);
          }
        }
      }

      // Update positions for each period
      for (const period of ["daily", "weekly", "monthly"]) {
        const periodStart = period === "daily" ? dayStart : period === "weekly" ? weekStart : monthStart;

        const { data: entries } = await supabase
          .from("leaderboard")
          .select("id, total_points")
          .eq("company_id", company.id)
          .eq("period", period)
          .eq("period_start", periodStart)
          .order("total_points", { ascending: false });

        // Update positions
        for (let i = 0; i < (entries || []).length; i++) {
          await supabase
            .from("leaderboard")
            .update({ position: i + 1 })
            .eq("id", entries![i].id);
        }

        console.log(`Updated ${entries?.length || 0} positions for ${period} leaderboard`);
      }

      // Update goal progress
      const nowDate = new Date();
      const { data: activeGoals } = await supabase
        .from("goals")
        .select("id, goal_type, start_date")
        .eq("company_id", company.id)
        .lte("start_date", nowDate.toISOString())
        .gte("end_date", nowDate.toISOString());

      console.log(`Found ${activeGoals?.length || 0} active goals for company ${company.id}`);

      for (const goal of activeGoals || []) {
        const { data: goalVendors } = await supabase
          .from("goal_vendors")
          .select("id, vendor_id, target_value")
          .eq("goal_id", goal.id);

        for (const gv of goalVendors || []) {
          let currentValue = 0;

          // Calculate current value based on goal type using goal's start_date
          if (goal.goal_type === "vendas") {
            const { count } = await supabase
              .from("sales")
              .select("id", { count: "exact", head: true })
              .eq("seller_id", gv.vendor_id)
              .eq("status", "won")
              .gte("created_at", `${goal.start_date}T00:00:00Z`);
            currentValue = count || 0;
            console.log(`Vendor ${gv.vendor_id} has ${currentValue} sales since ${goal.start_date}`);
          } else if (goal.goal_type === "conversas_ativas") {
            const { count } = await supabase
              .from("sale_cycles")
              .select("id", { count: "exact", head: true })
              .eq("seller_id", gv.vendor_id)
              .in("status", ["pending", "in_progress"]);
            currentValue = count || 0;
          } else if (goal.goal_type === "taxa_resposta") {
            // For response rate, calculate as percentage (target is already in %)
            const { count: totalMessages } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("seller_id", gv.vendor_id)
              .eq("direction", "incoming")
              .gte("timestamp", `${goal.start_date}T00:00:00Z`);
            
            const { count: respondedMessages } = await supabase
              .from("messages")
              .select("id", { count: "exact", head: true })
              .eq("seller_id", gv.vendor_id)
              .eq("direction", "outgoing")
              .gte("timestamp", `${goal.start_date}T00:00:00Z`);
            
            // Calculate percentage (0-100)
            if ((totalMessages || 0) > 0) {
              currentValue = Math.round(((respondedMessages || 0) / (totalMessages || 1)) * 100);
            } else {
              currentValue = 0;
            }
            console.log(`Vendor ${gv.vendor_id} response rate: ${currentValue}% (target: ${gv.target_value}%)`);
          }

          const progress = gv.target_value > 0 ? Math.min((currentValue / gv.target_value) * 100, 100) : 0;
          const status = progress >= 100 ? "achieved" : progress >= 70 ? "on_track" : "behind";

          // Note: 'progress' column is auto-computed in DB, don't update it
          await supabase
            .from("goal_vendors")
            .update({ 
              current_value: currentValue, 
              status 
            })
            .eq("id", gv.id);

          // Award badge if goal achieved
          if (progress >= 100) {
            const { data: existingBadge } = await supabase
              .from("achievements")
              .select("id")
              .eq("vendor_id", gv.vendor_id)
              .eq("badge_type", "meta_batida")
              .gte("awarded_at", `${goal.start_date}T00:00:00Z`)
              .maybeSingle();

            if (!existingBadge) {
              await supabase
                .from("achievements")
                .insert({
                  vendor_id: gv.vendor_id,
                  badge_type: "meta_batida",
                });

              // Award points for achieving goal
              await supabase
                .from("gamification_points")
                .insert({
                  company_id: company.id,
                  vendor_id: gv.vendor_id,
                  points: 20,
                  reason: "Meta atingida",
                });
              
              console.log(`Awarded meta_batida badge to ${gv.vendor_id}`);
            }
          }
        }
      }

      // Check for achievements
      for (const seller of sellers) {
        // Closer Master: 10 vendas em 7 dias
        const sevenDaysAgo = new Date(nowDate.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const { count: salesCount } = await supabase
          .from("sales")
          .select("id", { count: "exact", head: true })
          .eq("seller_id", seller.user_id)
          .eq("status", "won")
          .gte("created_at", sevenDaysAgo);

        if ((salesCount || 0) >= 10) {
          const { data: existing } = await supabase
            .from("achievements")
            .select("id")
            .eq("vendor_id", seller.user_id)
            .eq("badge_type", "closer_master")
            .gte("awarded_at", sevenDaysAgo)
            .maybeSingle();

          if (!existing) {
            await supabase.from("achievements").insert({
              vendor_id: seller.user_id,
              badge_type: "closer_master",
            });
          }
        }

        // Top Vendedor: first position in monthly ranking
        const { data: topEntry } = await supabase
          .from("leaderboard")
          .select("vendor_id")
          .eq("company_id", company.id)
          .eq("period", "monthly")
          .eq("period_start", monthStart)
          .eq("position", 1)
          .maybeSingle();

        if (topEntry?.vendor_id === seller.user_id) {
          const { data: existing } = await supabase
            .from("achievements")
            .select("id")
            .eq("vendor_id", seller.user_id)
            .eq("badge_type", "top_vendedor")
            .gte("awarded_at", `${monthStart}T00:00:00Z`)
            .maybeSingle();

          if (!existing) {
            await supabase.from("achievements").insert({
              vendor_id: seller.user_id,
              badge_type: "top_vendedor",
            });
          }
        }
      }
    }

    console.log("Gamification calculation complete");

    return new Response(
      JSON.stringify({ success: true, message: "Gamification calculated" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in calculate-gamification:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});