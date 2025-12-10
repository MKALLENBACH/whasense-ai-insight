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
    const { customerId, cycleId } = await req.json();
    
    if (!customerId && !cycleId) {
      console.error("Missing customerId or cycleId");
      return new Response(
        JSON.stringify({ error: "customerId or cycleId is required" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log("Generating manager insights for:", cycleId ? `cycle: ${cycleId}` : `customer: ${customerId}`);

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let targetCustomerId = customerId;
    let cycle: any = null;

    // If cycleId provided, get the cycle and its customer_id
    if (cycleId) {
      const { data: cycleData, error: cycleError } = await supabase
        .from('sale_cycles')
        .select('*')
        .eq('id', cycleId)
        .single();

      if (cycleError) {
        console.error("Error fetching cycle:", cycleError);
        throw cycleError;
      }
      
      cycle = cycleData;
      targetCustomerId = cycleData.customer_id;
    }

    // Fetch customer data
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', targetCustomerId)
      .single();

    if (customerError) {
      console.error("Error fetching customer:", customerError);
      throw customerError;
    }

    // Fetch messages - if cycleId provided, only get messages for that cycle
    let messagesQuery = supabase
      .from('messages')
      .select('*')
      .order('timestamp', { ascending: true });
    
    if (cycleId) {
      messagesQuery = messagesQuery.eq('cycle_id', cycleId);
    } else {
      messagesQuery = messagesQuery.eq('customer_id', targetCustomerId);
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      console.error("Error fetching messages:", messagesError);
      throw messagesError;
    }

    // Determine lead status from cycle or sale
    let leadStatus: 'pending' | 'won' | 'lost' = 'pending';
    let saleReason: string | null = null;

    if (cycle) {
      // Use cycle status
      if (cycle.status === 'won') {
        leadStatus = 'won';
        saleReason = cycle.won_summary;
      } else if (cycle.status === 'lost') {
        leadStatus = 'lost';
        saleReason = cycle.lost_reason;
      } else {
        leadStatus = cycle.status === 'in_progress' ? 'pending' : 'pending';
      }
    } else {
      // Fallback to sale status if no cycle
      const { data: sale, error: saleError } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', targetCustomerId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!saleError && sale) {
        leadStatus = sale.status;
        saleReason = sale.reason;
      }
    }

    // Fetch seller profile
    const sellerId = cycle?.seller_id || customer.seller_id;
    const { data: seller, error: sellerError } = await supabase
      .from('profiles')
      .select('name, email')
      .eq('user_id', sellerId)
      .maybeSingle();

    if (sellerError) {
      console.error("Error fetching seller:", sellerError);
    }

    // Fetch insights for messages
    const messageIds = messages?.map(m => m.id) || [];
    let insights: any[] = [];
    if (messageIds.length > 0) {
      const { data: insightsData, error: insightsError } = await supabase
        .from('insights')
        .select('*')
        .in('message_id', messageIds);

      if (!insightsError && insightsData) {
        insights = insightsData;
      }
    }

    // Calculate metrics
    const totalMessages = messages?.length || 0;
    const incomingMessages = messages?.filter(m => m.direction === 'incoming') || [];
    const outgoingMessages = messages?.filter(m => m.direction === 'outgoing') || [];

    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;
    for (let i = 1; i < (messages?.length || 0); i++) {
      const prev = messages![i - 1];
      const curr = messages![i];
      if (prev.direction === 'incoming' && curr.direction === 'outgoing') {
        const prevTime = new Date(prev.timestamp).getTime();
        const currTime = new Date(curr.timestamp).getTime();
        totalResponseTime += (currTime - prevTime) / 1000 / 60; // in minutes
        responseCount++;
      }
    }
    const avgResponseTimeMinutes = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;

    // Find critical delays (responses > 10 minutes)
    const criticalDelays: string[] = [];
    for (let i = 1; i < (messages?.length || 0); i++) {
      const prev = messages![i - 1];
      const curr = messages![i];
      if (prev.direction === 'incoming' && curr.direction === 'outgoing') {
        const prevTime = new Date(prev.timestamp).getTime();
        const currTime = new Date(curr.timestamp).getTime();
        const delayMinutes = (currTime - prevTime) / 1000 / 60;
        if (delayMinutes > 10) {
          criticalDelays.push(`Cliente ficou ${Math.round(delayMinutes)} minutos sem resposta`);
        }
      }
    }

    // Extract objections from insights
    const objections = [...new Set(insights.filter(i => i.objection && i.objection !== 'none').map(i => i.objection))];

    // Prepare conversation context for AI
    const conversationContext = messages?.map(m => 
      `[${m.direction === 'incoming' ? 'Cliente' : 'Vendedor'}]: ${m.content}`
    ).join('\n') || 'Sem mensagens';

    const objectionLabels: Record<string, string> = {
      price: "Preço alto",
      delay: "Prazo de entrega",
      trust: "Falta de confiança",
      doubt: "Dúvidas sobre o produto",
      delivery: "Prazo de entrega",
      competitor: "Concorrência",
      timing: "Momento inadequado",
      need: "Necessidade",
      none: "Nenhuma objeção",
    };

    const formattedObjections = objections.map(o => objectionLabels[o] || o);

    // Generate AI insights
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      console.error("LOVABLE_API_KEY not configured");
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const systemPrompt = `Você é um analista de vendas experiente. Analise a conversa entre vendedor e cliente e forneça insights gerenciais estratégicos.

IMPORTANTE:
- Seja conciso e objetivo
- Foque em informações acionáveis para o gestor
- Não inclua sugestões de resposta
- Analise o desempenho do vendedor
- Identifique pontos críticos e oportunidades

Retorne um JSON válido com a seguinte estrutura:
{
  "summary": "Resumo curto da conversa em 2-3 frases",
  "reason_stuck": "Por que a venda está parada (se status pending)",
  "reason_won": "O que levou à vitória (se status won)",
  "reason_lost": "O que levou à perda (se status lost)",
  "key_events": ["evento 1", "evento 2", ...],
  "attention_points": ["ponto de atenção 1", "ponto de atenção 2", ...],
  "seller_performance": "Avaliação breve do desempenho do vendedor nesta conversa",
  "negotiation_stage": "Estágio atual da negociação (prospecção, qualificação, proposta, fechamento, etc)"
}`;

    const cycleContext = cycleId ? `\nEsta análise é para um CICLO DE VENDA ESPECÍFICO, não para todo o histórico do cliente.` : '';

    const userPrompt = `Status do lead: ${leadStatus}
Motivo registrado (se houver): ${saleReason || 'Não registrado'}
Objeções identificadas: ${formattedObjections.join(', ') || 'Nenhuma'}
Total de mensagens: ${totalMessages}
Mensagens do cliente: ${incomingMessages.length}
Mensagens do vendedor: ${outgoingMessages.length}
Tempo médio de resposta: ${avgResponseTimeMinutes} minutos
Atrasos críticos: ${criticalDelays.join('; ') || 'Nenhum'}
${cycleContext}

CONVERSA:
${conversationContext}`;

    console.log("Calling Lovable AI for manager insights...");

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("AI API error:", aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices[0]?.message?.content || '{}';
    
    // Parse AI response
    let aiInsights;
    try {
      // Extract JSON from response (may be wrapped in markdown)
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        aiInsights = JSON.parse(jsonMatch[0]);
      } else {
        aiInsights = {};
      }
    } catch (parseError) {
      console.error("Error parsing AI response:", parseError, aiContent);
      aiInsights = {};
    }

    // Build timeline from messages
    const timeline = messages?.slice(-10).map(m => ({
      event: m.direction === 'incoming' 
        ? `Cliente: "${m.content.substring(0, 50)}${m.content.length > 50 ? '...' : ''}"`
        : `Vendedor respondeu`,
      timestamp: m.timestamp,
    })) || [];

    // Compose final response
    const managerInsights = {
      leadStatus,
      customerName: customer.name,
      sellerName: seller?.name || 'Vendedor não identificado',
      summary: aiInsights.summary || 'Análise não disponível',
      reason_stuck: leadStatus === 'pending' ? (aiInsights.reason_stuck || 'Não identificado') : null,
      reason_won: leadStatus === 'won' ? (aiInsights.reason_won || saleReason || 'Não registrado') : null,
      reason_lost: leadStatus === 'lost' ? (aiInsights.reason_lost || saleReason || 'Não registrado') : null,
      timeline,
      key_objections: formattedObjections,
      key_events: aiInsights.key_events || [],
      attention_points: aiInsights.attention_points || criticalDelays,
      seller_performance: aiInsights.seller_performance || 'Não avaliado',
      negotiation_stage: aiInsights.negotiation_stage || 'Não identificado',
      metrics: {
        totalMessages,
        incomingMessages: incomingMessages.length,
        outgoingMessages: outgoingMessages.length,
        avgResponseTimeMinutes,
        criticalDelays: criticalDelays.length,
      },
      saleReason,
    };

    console.log("Manager insights generated successfully");

    return new Response(
      JSON.stringify(managerInsights),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error("Error in manager-insights function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
