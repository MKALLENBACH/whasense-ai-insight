import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { clientId, sellerId } = await req.json();
    
    if (!clientId) {
      throw new Error("clientId is required");
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`Generating 360° summary for client: ${clientId}${sellerId ? `, filtered by seller: ${sellerId}` : ''}`);

    // Fetch client data
    const { data: client, error: clientError } = await supabase
      .from("clients")
      .select("*")
      .eq("id", clientId)
      .maybeSingle();

    if (clientError) throw clientError;
    if (!client) {
      return new Response(JSON.stringify({ error: "Client not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch buyers
    const { data: buyers } = await supabase
      .from("buyers")
      .select("*")
      .eq("client_id", clientId);

    // Fetch cycles (filtered by seller if provided)
    let cyclesQuery = supabase
      .from("sale_cycles")
      .select("*")
      .eq("client_id", clientId);
    
    if (sellerId) {
      cyclesQuery = cyclesQuery.eq("seller_id", sellerId);
    }
    
    const { data: cycles } = await cyclesQuery;

    // Fetch messages (filtered by seller if provided)
    let messagesQuery = supabase
      .from("messages")
      .select("id, content, direction, timestamp")
      .eq("client_id", clientId)
      .order("timestamp", { ascending: false })
      .limit(50);
    
    if (sellerId) {
      messagesQuery = messagesQuery.eq("seller_id", sellerId);
    }
    
    const { data: messages } = await messagesQuery;

    // Fetch insights
    const messageIds = messages?.map(m => m.id) || [];
    let insights: any[] = [];
    if (messageIds.length > 0) {
      const { data: insightsData } = await supabase
        .from("insights")
        .select("*")
        .in("message_id", messageIds);
      insights = insightsData || [];
    }

    // Calculate stats
    const wonCycles = cycles?.filter(c => c.status === "won") || [];
    const lostCycles = cycles?.filter(c => c.status === "lost") || [];
    const activeCycles = cycles?.filter(c => c.status === "pending" || c.status === "in_progress") || [];
    
    // Count objections
    const objectionCounts: Record<string, number> = {};
    insights.forEach(i => {
      if (i.objection && i.objection !== "none") {
        objectionCounts[i.objection] = (objectionCounts[i.objection] || 0) + 1;
      }
    });
    const topObjections = Object.entries(objectionCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([obj]) => obj);

    // Calculate average temperature
    const temperatures = insights.filter(i => i.temperature).map(i => i.temperature);
    const tempCounts = { hot: 0, warm: 0, cold: 0 };
    temperatures.forEach(t => { if (t) tempCounts[t as keyof typeof tempCounts]++; });
    const avgTemp = tempCounts.hot >= tempCounts.warm && tempCounts.hot >= tempCounts.cold ? "quente" :
                   tempCounts.warm >= tempCounts.cold ? "morna" : "fria";

    // Build context for AI
    const context = `
DADOS DO CLIENTE EMPRESA:
- Nome: ${client.name}
- Segmento: ${client.segment || "Não informado"}
- CNPJ: ${client.cnpj || "Não informado"}

ESTATÍSTICAS:
- Total de compradores: ${buyers?.length || 0}
- Total de ciclos de venda: ${cycles?.length || 0}
- Ciclos ganhos: ${wonCycles.length}
- Ciclos perdidos: ${lostCycles.length}
- Ciclos ativos: ${activeCycles.length}
- Taxa de conversão: ${cycles?.length ? Math.round((wonCycles.length / cycles.length) * 100) : 0}%

OBJEÇÕES MAIS COMUNS:
${topObjections.length > 0 ? topObjections.join(", ") : "Nenhuma registrada"}

TEMPERATURA MÉDIA: ${avgTemp}

ÚLTIMAS MENSAGENS:
${messages?.slice(0, 10).map(m => `- [${m.direction}]: ${m.content?.substring(0, 100)}`).join("\n") || "Sem mensagens"}

MOTIVOS DE PERDA:
${lostCycles.map(c => c.lost_reason).filter(Boolean).join(", ") || "Nenhum registrado"}
`;

    // Call Lovable AI
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${Deno.env.get('LOVABLE_API_KEY')}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `Você é um analista de vendas especializado. Analise os dados do cliente empresa e gere um resumo 360° estratégico.
            
RETORNE APENAS UM JSON VÁLIDO com a estrutura:
{
  "perfil_empresa": "Descrição do perfil e comportamento",
  "numero_de_compradores": número,
  "interesse_geral": "baixo | medio | alto",
  "objecoes_recorrentes": ["lista", "de", "objeções"],
  "temperatura_media": "fria | morna | quente",
  "emocao_predominante": "descrição",
  "vendedores_que_atendem": ["lista"],
  "risco_churn": "baixo | medio | alto",
  "resumo_executivo": "Resumo executivo em 2-3 frases",
  "proximos_passos_sugeridos": "Recomendações de próximos passos"
}

NÃO inclua markdown, apenas o JSON puro.`
          },
          {
            role: "user",
            content: context
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error(`AI request failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "";
    
    // Parse JSON from response
    let summary;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        summary = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error("No JSON found in response");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", content);
      // Return a default summary
      summary = {
        perfil_empresa: `${client.name} - ${client.segment || "Segmento não definido"}`,
        numero_de_compradores: buyers?.length || 0,
        interesse_geral: activeCycles.length > 0 ? "medio" : "baixo",
        objecoes_recorrentes: topObjections,
        temperatura_media: avgTemp,
        emocao_predominante: "neutro",
        vendedores_que_atendem: [],
        risco_churn: lostCycles.length > wonCycles.length ? "alto" : "baixo",
        resumo_executivo: `Cliente com ${buyers?.length || 0} compradores e ${cycles?.length || 0} ciclos registrados.`,
        proximos_passos_sugeridos: activeCycles.length > 0 
          ? "Manter acompanhamento dos ciclos ativos" 
          : "Reativar contato com compradores"
      };
    }

    console.log("Generated 360° summary successfully");

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Error generating 360° summary:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
