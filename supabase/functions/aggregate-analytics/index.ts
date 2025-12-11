import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authorization: Require internal cron secret for background jobs
    const cronSecret = Deno.env.get('INTERNAL_CRON_SECRET');
    const body = await req.json().catch(() => ({}));
    const { date, companyId, secret } = body;
    
    if (cronSecret && secret !== cronSecret) {
      console.warn('Unauthorized aggregate-analytics attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    
    // Default to today if no date provided
    const targetDate = date ? new Date(date) : new Date();
    const dateStr = targetDate.toISOString().split("T")[0];
    
    const startOfDay = new Date(dateStr + "T00:00:00.000Z");
    const endOfDay = new Date(dateStr + "T23:59:59.999Z");

    console.log(`Aggregating analytics for ${dateStr}${companyId ? ` (company: ${companyId})` : ""}`);

    // Get all active companies or specific company
    let companiesQuery = supabase.from("companies").select("id").eq("is_active", true);
    if (companyId) {
      companiesQuery = companiesQuery.eq("id", companyId);
    }
    const { data: companies, error: companiesError } = await companiesQuery;

    if (companiesError) {
      throw new Error(`Error fetching companies: ${companiesError.message}`);
    }

    if (!companies || companies.length === 0) {
      return new Response(JSON.stringify({ message: "No companies to process" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let companiesProcessed = 0;
    let sellersProcessed = 0;

    for (const company of companies) {
      try {
        // Get all sellers for this company
        const { data: profiles } = await supabase
          .from("profiles")
          .select("user_id")
          .eq("company_id", company.id);

        const sellerIds = profiles?.map(p => p.user_id) || [];

        // Get messages for this company's sellers
        const { data: messages } = await supabase
          .from("messages")
          .select("id, direction, seller_id, timestamp")
          .in("seller_id", sellerIds)
          .gte("timestamp", startOfDay.toISOString())
          .lte("timestamp", endOfDay.toISOString());

        // Get sale cycles for this company's sellers
        const { data: cycles } = await supabase
          .from("sale_cycles")
          .select("id, status, seller_id, created_at")
          .in("seller_id", sellerIds);

        // Get today's new cycles
        const todayCycles = cycles?.filter(c => {
          const createdAt = new Date(c.created_at);
          return createdAt >= startOfDay && createdAt <= endOfDay;
        }) || [];

        // Get insights with temperature for today's messages
        const messageIds = messages?.map(m => m.id) || [];
        let hotLeads = 0, warmLeads = 0, coldLeads = 0;
        
        if (messageIds.length > 0) {
          const { data: insights } = await supabase
            .from("insights")
            .select("temperature")
            .in("message_id", messageIds);

          if (insights) {
            for (const insight of insights) {
              if (insight.temperature === "hot") hotLeads++;
              else if (insight.temperature === "warm") warmLeads++;
              else if (insight.temperature === "cold") coldLeads++;
            }
          }
        }

        // Aggregate company metrics
        const companyMetrics = {
          company_id: company.id,
          date: dateStr,
          total_leads: cycles?.filter(c => ["pending", "in_progress"].includes(c.status)).length || 0,
          new_leads: todayCycles.length,
          total_messages: messages?.length || 0,
          incoming_messages: messages?.filter(m => m.direction === "incoming").length || 0,
          outgoing_messages: messages?.filter(m => m.direction === "outgoing").length || 0,
          total_won: cycles?.filter(c => c.status === "won").length || 0,
          total_lost: cycles?.filter(c => c.status === "lost").length || 0,
          total_pending: cycles?.filter(c => c.status === "pending").length || 0,
          total_in_progress: cycles?.filter(c => c.status === "in_progress").length || 0,
          hot_leads: hotLeads,
          warm_leads: warmLeads,
          cold_leads: coldLeads,
          updated_at: new Date().toISOString(),
        };

        await supabase
          .from("analytics_daily_company")
          .upsert(companyMetrics, { onConflict: "company_id,date" });

        companiesProcessed++;

        // Aggregate per-seller metrics
        for (const sellerId of sellerIds) {
          const sellerMessages = messages?.filter(m => m.seller_id === sellerId) || [];
          const sellerCycles = cycles?.filter(c => c.seller_id === sellerId) || [];
          const sellerTodayCycles = todayCycles.filter(c => c.seller_id === sellerId);

          // Get seller's message insights
          const sellerMessageIds = sellerMessages.map(m => m.id);
          let sellerHot = 0, sellerWarm = 0, sellerCold = 0;
          
          if (sellerMessageIds.length > 0) {
            const { data: sellerInsights } = await supabase
              .from("insights")
              .select("temperature")
              .in("message_id", sellerMessageIds);

            if (sellerInsights) {
              for (const insight of sellerInsights) {
                if (insight.temperature === "hot") sellerHot++;
                else if (insight.temperature === "warm") sellerWarm++;
                else if (insight.temperature === "cold") sellerCold++;
              }
            }
          }

          const sellerMetrics = {
            seller_id: sellerId,
            company_id: company.id,
            date: dateStr,
            total_leads: sellerCycles.filter(c => ["pending", "in_progress"].includes(c.status)).length,
            new_leads: sellerTodayCycles.length,
            total_messages: sellerMessages.length,
            incoming_messages: sellerMessages.filter(m => m.direction === "incoming").length,
            outgoing_messages: sellerMessages.filter(m => m.direction === "outgoing").length,
            leads_won: sellerCycles.filter(c => c.status === "won").length,
            leads_lost: sellerCycles.filter(c => c.status === "lost").length,
            leads_pending: sellerCycles.filter(c => c.status === "pending").length,
            leads_in_progress: sellerCycles.filter(c => c.status === "in_progress").length,
            hot_leads: sellerHot,
            warm_leads: sellerWarm,
            cold_leads: sellerCold,
            updated_at: new Date().toISOString(),
          };

          await supabase
            .from("analytics_daily_seller")
            .upsert(sellerMetrics, { onConflict: "seller_id,date" });

          sellersProcessed++;
        }
      } catch (companyError) {
        console.error(`Error processing company ${company.id}:`, companyError);
      }
    }

    // Update queue usage stats
    const currentHour = new Date();
    currentHour.setMinutes(0, 0, 0);
    
    for (const company of companies) {
      const { data: queueStats } = await supabase
        .from("processing_queue")
        .select("id")
        .eq("company_id", company.id)
        .eq("status", "pending");

      await supabase
        .from("queue_usage_hourly")
        .upsert({
          company_id: company.id,
          hour: currentHour.toISOString(),
          queue_size_peak: queueStats?.length || 0,
        }, { onConflict: "company_id,hour" });
    }

    const duration = Date.now() - startTime;
    console.log(`Analytics aggregation completed: ${companiesProcessed} companies, ${sellersProcessed} sellers in ${duration}ms`);

    return new Response(JSON.stringify({ 
      success: true,
      companiesProcessed,
      sellersProcessed,
      duration,
      date: dateStr
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Analytics aggregation error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
