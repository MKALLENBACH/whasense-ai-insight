import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOSS_REASON_PROMPT = `Você é uma IA especializada em análise de vendas perdidas.

Com base nas mensagens abaixo, identifique qual foi o motivo mais provável da perda:

Motivos possíveis:
- "price" (preço)
- "delay" (demora)
- "competition" (concorrência)
- "trust" (desconfiança)
- "other"

Retorne SOMENTE um JSON assim:
{
  "suggested_reason": "price",
  "explanation": "O cliente reclamou que está caro."
}

Mensagens:
"""
{{messages}}
"""`;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { customer_id, seller_id } = await req.json();

    if (!customer_id || !seller_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id and seller_id are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!lovableApiKey) {
      return new Response(
        JSON.stringify({ error: 'LOVABLE_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch last 10 messages from this conversation
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select('content, direction, timestamp')
      .eq('customer_id', customer_id)
      .eq('seller_id', seller_id)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    if (!messages || messages.length === 0) {
      return new Response(
        JSON.stringify({ 
          suggested_reason: 'other', 
          explanation: 'Sem mensagens para analisar' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Format messages for the prompt
    const formattedMessages = messages
      .reverse()
      .map(m => `[${m.direction === 'incoming' ? 'Cliente' : 'Vendedor'}]: ${m.content}`)
      .join('\n');

    const prompt = LOSS_REASON_PROMPT.replace('{{messages}}', formattedMessages);

    console.log('Analyzing loss reason with messages:', formattedMessages.substring(0, 200));

    // Call Lovable AI Gateway
    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'You analyze sales conversations and determine loss reasons. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI error:', response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded, please try again later' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required, please add funds' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from AI');
    }

    // Parse JSON response - handle markdown code blocks
    try {
      let jsonContent = content.trim();
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.slice(7);
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.slice(3);
      }
      if (jsonContent.endsWith('```')) {
        jsonContent = jsonContent.slice(0, -3);
      }
      jsonContent = jsonContent.trim();
      
      const parsed = JSON.parse(jsonContent);
      
      console.log('AI suggested loss reason:', parsed);

      return new Response(
        JSON.stringify({
          suggested_reason: parsed.suggested_reason || 'other',
          explanation: parsed.explanation || 'Motivo não identificado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse AI response:', content);
      return new Response(
        JSON.stringify({ 
          suggested_reason: 'other', 
          explanation: 'Erro ao analisar resposta da IA' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in loss-reason function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
