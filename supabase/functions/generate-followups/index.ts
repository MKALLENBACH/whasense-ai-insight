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

    console.log("Starting follow-up generation...");

    // Get all active companies with follow-ups enabled at admin level
    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, allow_followups")
      .eq("is_active", true)
      .eq("allow_followups", true);

    if (companiesError) {
      console.error("Error fetching companies:", companiesError);
      throw companiesError;
    }

    console.log(`Found ${companies?.length || 0} companies with follow-ups allowed`);

    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ message: "No companies with follow-ups enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const companyIds = companies.map((c) => c.id);

    // Get company settings for those companies
    const { data: companySettings, error: settingsError } = await supabase
      .from("company_settings")
      .select("company_id, followups_enabled, followup_delay_hours")
      .in("company_id", companyIds)
      .eq("followups_enabled", true);

    if (settingsError) {
      console.error("Error fetching company settings:", settingsError);
      throw settingsError;
    }

    console.log(`Found ${companySettings?.length || 0} companies with manager follow-ups enabled`);

    if (!companySettings || companySettings.length === 0) {
      return new Response(
        JSON.stringify({ message: "No companies with manager follow-ups enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settingsMap = new Map(
      companySettings.map((s) => [s.company_id, s.followup_delay_hours])
    );
    const enabledCompanyIds = companySettings.map((s) => s.company_id);

    // Get profiles with seller_followups_enabled = true
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, company_id, seller_followups_enabled")
      .in("company_id", enabledCompanyIds)
      .eq("seller_followups_enabled", true);

    if (profilesError) {
      console.error("Error fetching profiles:", profilesError);
      throw profilesError;
    }

    console.log(`Found ${profiles?.length || 0} sellers with follow-ups enabled`);

    if (!profiles || profiles.length === 0) {
      return new Response(
        JSON.stringify({ message: "No sellers with follow-ups enabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const sellerIds = profiles.map((p) => p.user_id);
    const sellerCompanyMap = new Map(profiles.map((p) => [p.user_id, p.company_id]));

    // Get active cycles for those sellers
    const { data: cycles, error: cyclesError } = await supabase
      .from("sale_cycles")
      .select("id, customer_id, seller_id, last_activity_at")
      .in("seller_id", sellerIds)
      .in("status", ["pending", "in_progress"]);

    if (cyclesError) {
      console.error("Error fetching cycles:", cyclesError);
      throw cyclesError;
    }

    console.log(`Found ${cycles?.length || 0} active cycles`);

    let followupsSent = 0;

    for (const cycle of cycles || []) {
      const companyId = sellerCompanyMap.get(cycle.seller_id);
      if (!companyId) continue;

      const delayHours = settingsMap.get(companyId) || 24;
      const cutoffTime = new Date();
      cutoffTime.setHours(cutoffTime.getHours() - delayHours);

      // Get last messages for this cycle
      const { data: messages, error: messagesError } = await supabase
        .from("messages")
        .select("id, direction, timestamp, content")
        .eq("cycle_id", cycle.id)
        .order("timestamp", { ascending: false })
        .limit(10);

      if (messagesError) {
        console.error("Error fetching messages for cycle:", cycle.id, messagesError);
        continue;
      }

      if (!messages || messages.length === 0) continue;

      // Check conditions:
      // 1. Last message is from seller (customer has not responded)
      // 2. There was at least one customer message before (client_request)
      // 3. There was at least one seller message before (seller_replied)
      // 4. Last message is older than delay hours

      const lastMessage = messages[0];
      const hasCustomerMessage = messages.some((m) => m.direction === "inbound");
      const hasSellerMessage = messages.some((m) => m.direction === "outbound");
      const lastMessageTime = new Date(lastMessage.timestamp);

      if (
        lastMessage.direction === "outbound" &&
        hasCustomerMessage &&
        hasSellerMessage &&
        lastMessageTime < cutoffTime
      ) {
        // Check if we already sent a follow-up recently (within delay period)
        const recentFollowupCutoff = new Date();
        recentFollowupCutoff.setHours(recentFollowupCutoff.getHours() - delayHours);

        const recentFollowup = messages.find(
          (m) =>
            m.direction === "outbound" &&
            m.content?.includes("[Follow-up automático]") &&
            new Date(m.timestamp) > recentFollowupCutoff
        );

        if (recentFollowup) {
          console.log(`Skipping cycle ${cycle.id} - recent follow-up exists`);
          continue;
        }

        // Generate a light follow-up message
        const followupMessages = [
          "Oi! Tudo bem? Se precisar de algo, estou por aqui 😊",
          "Olá! Só passando para saber se posso ajudar em algo mais!",
          "Oi! Ficou alguma dúvida? Estou à disposição!",
          "Olá! Só dando um oi para ver se precisa de mais alguma coisa 😊",
          "Oi! Qualquer dúvida, é só me chamar!",
        ];

        const followupContent =
          followupMessages[Math.floor(Math.random() * followupMessages.length)];

        // Insert follow-up message
        const { error: insertError } = await supabase.from("messages").insert({
          customer_id: cycle.customer_id,
          seller_id: cycle.seller_id,
          cycle_id: cycle.id,
          direction: "outbound",
          content: `[Follow-up automático] ${followupContent}`,
        });

        if (insertError) {
          console.error("Error inserting follow-up:", insertError);
          continue;
        }

        console.log(`Follow-up sent for cycle ${cycle.id}`);
        followupsSent++;
      }
    }

    console.log(`Follow-up generation complete. Sent ${followupsSent} follow-ups`);

    return new Response(
      JSON.stringify({
        success: true,
        followupsSent,
        message: `Generated ${followupsSent} follow-ups`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in generate-followups:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
