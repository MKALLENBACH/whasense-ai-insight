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
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { vendor_id, company_id } = await req.json();

    if (!vendor_id || !company_id) {
      return new Response(
        JSON.stringify({ error: "vendor_id and company_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating AI insights for vendor ${vendor_id}`);

    // Get vendor profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("name")
      .eq("user_id", vendor_id)
      .single();

    const vendorName = profile?.name || "Vendedor";

    // Get vendor's sales stats (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: sales } = await supabase
      .from("sales")
      .select("status, created_at")
      .eq("seller_id", vendor_id)
      .gte("created_at", thirtyDaysAgo.toISOString());

    const wonSales = (sales || []).filter(s => s.status === "won").length;
    const lostSales = (sales || []).filter(s => s.status === "lost").length;
    const totalSales = wonSales + lostSales;
    const conversionRate = totalSales > 0 ? ((wonSales / totalSales) * 100).toFixed(1) : "0";

    // Get active goals
    const today = new Date().toISOString().split("T")[0];
    const { data: goalVendors } = await supabase
      .from("goal_vendors")
      .select(`
        *,
        goal:goals(goal_type, target_value, end_date)
      `)
      .eq("vendor_id", vendor_id);

    const activeGoals = (goalVendors || []).filter(gv => {
      const endDate = gv.goal?.end_date;
      return endDate && endDate >= today;
    });

    // Get hot leads
    const { data: messages } = await supabase
      .from("messages")
      .select("id")
      .eq("seller_id", vendor_id);

    const messageIds = (messages || []).map(m => m.id);
    let hotLeadsCount = 0;

    if (messageIds.length > 0) {
      const { count } = await supabase
        .from("insights")
        .select("*", { count: "exact", head: true })
        .in("message_id", messageIds)
        .eq("temperature", "hot");
      
      hotLeadsCount = count || 0;
    }

    // Get gamification points
    const { data: points } = await supabase
      .from("gamification_points")
      .select("points")
      .eq("vendor_id", vendor_id);

    const totalPoints = (points || []).reduce((acc, p) => acc + p.points, 0);

    // Get ranking position
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data: ranking } = await supabase
      .from("leaderboard")
      .select("position")
      .eq("vendor_id", vendor_id)
      .eq("period", "monthly")
      .eq("period_start", monthStart)
      .maybeSingle();

    const rankingPosition = ranking?.position || null;

    // Build context for AI
    const context = {
      vendorName,
      stats: {
        wonSales,
        lostSales,
        conversionRate,
        totalPoints,
        rankingPosition,
      },
      activeGoals: activeGoals.map(g => ({
        type: g.goal?.goal_type,
        target: g.target_value,
        current: g.current_value,
        progress: g.progress,
        remaining: Math.max(0, g.target_value - g.current_value),
        endDate: g.goal?.end_date,
      })),
      hotLeadsCount,
    };

    // Generate AI insights
    const prompt = `Você é um coach de vendas experiente. Analise o desempenho do vendedor e forneça insights estratégicos e motivacionais.

DADOS DO VENDEDOR "${context.vendorName}":
- Vendas fechadas (30 dias): ${context.stats.wonSales}
- Vendas perdidas (30 dias): ${context.stats.lostSales}
- Taxa de conversão: ${context.stats.conversionRate}%
- Total de pontos: ${context.stats.totalPoints}
- Posição no ranking: ${context.stats.rankingPosition ? `#${context.stats.rankingPosition}` : "Sem ranking ainda"}
- Leads quentes disponíveis: ${context.hotLeadsCount}

METAS ATIVAS:
${context.activeGoals.length > 0 
  ? context.activeGoals.map(g => `- ${g.type}: ${g.current}/${g.target} (${g.progress?.toFixed(0)}% - faltam ${g.remaining})`).join("\n")
  : "Nenhuma meta ativa no momento"}

Com base nesses dados, forneça:
1. Uma análise breve do desempenho atual (2 frases)
2. 2-3 dicas práticas e específicas para melhorar
3. Uma mensagem motivacional personalizada

Responda em português brasileiro, de forma direta e prática. Use emojis moderadamente.`;

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um coach de vendas experiente e motivador." },
          { role: "user", content: prompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!aiResponse.ok) {
      console.error("AI API error:", await aiResponse.text());
      throw new Error("Failed to generate AI insights");
    }

    const aiData = await aiResponse.json();
    const insights = aiData.choices?.[0]?.message?.content || "Não foi possível gerar insights no momento.";

    return new Response(
      JSON.stringify({
        success: true,
        vendorName: context.vendorName,
        stats: context.stats,
        activeGoals: context.activeGoals,
        hotLeadsCount: context.hotLeadsCount,
        aiInsights: insights,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in seller-performance-insights:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
