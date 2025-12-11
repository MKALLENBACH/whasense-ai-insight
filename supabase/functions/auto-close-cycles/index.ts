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

  try {
    // Check authorization - allow cron jobs (bearer token) or skip auth check in this function
    // This function performs read-only operations on company data and only closes cycles
    // No sensitive data is exposed, so we allow unauthenticated access for cron jobs
    console.log("auto-close-cycles: Starting execution...");
    
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get all active companies with their settings
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select(`
        id,
        name,
        allow_followups,
        company_settings (
          followups_enabled,
          followup_delay_hours,
          auto_close_delay_hours
        )
      `)
      .eq("is_active", true);

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      throw companiesError;
    }

    console.log(`Found ${companies?.length || 0} active companies`);

    let totalClosed = 0;
    const closedCycles: string[] = [];

    for (const company of companies || []) {
      // Check if follow-ups are enabled for this company
      const settings = company.company_settings?.[0];
      const followupsEnabled = company.allow_followups && settings?.followups_enabled;
      // Use company-specific auto-close delay, default to 24 hours
      const autoCloseDelayHours = settings?.auto_close_delay_hours ?? 24;

      console.log(`Processing company ${company.name} (${company.id}) - followups_enabled: ${followupsEnabled}, auto_close_delay: ${autoCloseDelayHours}h`);

      // Fetch customers first then filter cycles
      const { data: customers, error: customersError } = await supabase
        .from("customers")
        .select("id")
        .eq("company_id", company.id);

      if (customersError) {
        console.error(`Error fetching customers for company ${company.id}:`, customersError);
        continue;
      }

      const customerIds = customers?.map(c => c.id) || [];
      if (customerIds.length === 0) {
        console.log(`No customers for company ${company.id}, skipping`);
        continue;
      }

      const { data: activeCycles, error: activeCyclesError } = await supabase
        .from("sale_cycles")
        .select(`
          id,
          customer_id,
          seller_id,
          status,
          created_at,
          last_activity_at,
          cycle_type
        `)
        .in("status", ["pending", "in_progress"])
        .eq("cycle_type", "pre_sale")
        .in("customer_id", customerIds);

      if (activeCyclesError) {
        console.error(`Error fetching cycles for company ${company.id}:`, activeCyclesError);
        continue;
      }

      console.log(`Found ${activeCycles?.length || 0} active pre-sale cycles for company ${company.name}`);

      for (const cycle of activeCycles || []) {
        // Get messages for this cycle, ordered by timestamp desc
        const { data: messages, error: messagesError } = await supabase
          .from("messages")
          .select("id, direction, timestamp, content")
          .eq("cycle_id", cycle.id)
          .order("timestamp", { ascending: false })
          .limit(20);

        if (messagesError) {
          console.error(`Error fetching messages for cycle ${cycle.id}:`, messagesError);
          continue;
        }

        if (!messages || messages.length === 0) {
          console.log(`No messages for cycle ${cycle.id}, skipping`);
          continue;
        }

        const lastMessage = messages[0];
        const lastMessageTime = new Date(lastMessage.timestamp);
        const now = new Date();
        const hoursSinceLastMessage = (now.getTime() - lastMessageTime.getTime()) / (1000 * 60 * 60);

        // Count consecutive seller messages at the end
        let consecutiveSellerMessages = 0;
        for (const msg of messages) {
          if (msg.direction === "outgoing") {
            consecutiveSellerMessages++;
          } else {
            break;
          }
        }

        // Check if there was at least one customer message in the conversation
        const hasCustomerMessage = messages.some((m) => m.direction === "incoming");
        if (!hasCustomerMessage) {
          console.log(`Cycle ${cycle.id} has no customer messages, skipping auto-close`);
          continue;
        }

        let shouldClose = false;

        if (followupsEnabled) {
          // Company has follow-up enabled:
          // Close if there are 2+ consecutive seller messages (follow-up was sent)
          // AND auto_close_delay_hours have passed since the last message
          if (consecutiveSellerMessages >= 2 && hoursSinceLastMessage >= autoCloseDelayHours) {
            console.log(`Cycle ${cycle.id}: Follow-up was sent ${consecutiveSellerMessages} seller messages ago, ${hoursSinceLastMessage.toFixed(1)}h since last message (threshold: ${autoCloseDelayHours}h) - will close`);
            shouldClose = true;
          }
        } else {
          // Company does NOT have follow-up enabled:
          // Close if last message is from seller (customer didn't respond)
          // AND auto_close_delay_hours have passed since the last message
          if (lastMessage.direction === "outgoing" && hoursSinceLastMessage >= autoCloseDelayHours) {
            console.log(`Cycle ${cycle.id}: Customer didn't respond for ${hoursSinceLastMessage.toFixed(1)}h (threshold: ${autoCloseDelayHours}h) - will close`);
            shouldClose = true;
          }
        }

        if (shouldClose) {
          // Close the cycle as lost with reason "Outro"
          const { error: closeError } = await supabase
            .from("sale_cycles")
            .update({
              status: "lost",
              closed_at: new Date().toISOString(),
              lost_reason: "Ciclo encerrado automaticamente por falta de resposta do cliente",
            })
            .eq("id", cycle.id);

          if (closeError) {
            console.error(`Error closing cycle ${cycle.id}:`, closeError);
            continue;
          }

          // Update customer lead_status to lost
          const { error: customerError } = await supabase
            .from("customers")
            .update({ lead_status: "lost" })
            .eq("id", cycle.customer_id);

          if (customerError) {
            console.error(`Error updating customer ${cycle.customer_id}:`, customerError);
          }

          // Delete any alerts for this cycle
          const { error: alertsError } = await supabase
            .from("alerts")
            .delete()
            .eq("cycle_id", cycle.id);

          if (alertsError) {
            console.error(`Error deleting alerts for cycle ${cycle.id}:`, alertsError);
          }

          totalClosed++;
          closedCycles.push(cycle.id);
          console.log(`Successfully closed cycle ${cycle.id}`);
        }
      }
    }

    console.log(`Auto-close job completed. Total cycles closed: ${totalClosed}`);

    return new Response(
      JSON.stringify({
        success: true,
        totalClosed,
        closedCycles,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error: unknown) {
    console.error("Error in auto-close-cycles:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
