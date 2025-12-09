import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CUSTOMER_SIMULATION_PROMPT = `Você é um cliente conversando via WhatsApp.
Responda de forma natural, humana e coerente com a conversa.

Personas possíveis (escolha uma aleatoriamente):
- Cliente interessado porém cauteloso
- Cliente com pressa
- Cliente pedindo desconto
- Cliente desconfiado
- Cliente frio que quase não responde
- Cliente animado e pronto para comprar

Siga as regras:
- Responda com até 1–2 frases.
- Não identifique que é uma IA.
- Mantenha coerência com o contexto da conversa.
- Às vezes faça perguntas.
- Às vezes gere objeções (preço, demora, confiança).
- Às vezes demonstre interesse.
- Às vezes fique mais frio.
- Seja imprevisível, mas realista.
- Use linguagem informal brasileira (pode usar "vc", "tb", emojis ocasionais).`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { customerId, sellerId, sellerMessage, conversationHistory } = await req.json();

    if (!customerId || !sellerId) {
      return new Response(JSON.stringify({ error: 'Missing customerId or sellerId' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build conversation context
    let conversationContext = "";
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = "\n\nHistórico da conversa:\n";
      conversationHistory.slice(-10).forEach((msg: { direction: string; content: string }) => {
        const role = msg.direction === 'incoming' ? 'Cliente' : 'Vendedor';
        conversationContext += `${role}: ${msg.content}\n`;
      });
    }

    const userPrompt = sellerMessage 
      ? `Mensagem do vendedor:\n"""\n${sellerMessage}\n"""`
      : `O vendedor não respondeu ainda. Envie uma mensagem de acompanhamento como cliente interessado.`;

    // Call Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: CUSTOMER_SIMULATION_PROMPT + conversationContext },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.9,
        max_tokens: 150,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI Gateway error:', errorText);
      throw new Error('Failed to get AI response');
    }

    const aiData = await aiResponse.json();
    const customerMessage = aiData.choices?.[0]?.message?.content?.trim() || "Hmm, pode me explicar melhor?";

    // Save the customer message
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        seller_id: sellerId,
        content: customerMessage,
        direction: 'incoming',
        timestamp: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
      throw messageError;
    }

    // Trigger AI analysis for insights
    try {
      await fetch(`${supabaseUrl}/functions/v1/analyze-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          message: customerMessage,
          message_id: savedMessage.id,
        }),
      });
    } catch (analyzeError) {
      console.error('Failed to analyze message:', analyzeError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: customerMessage,
      messageId: savedMessage.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in simulate-customer:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
