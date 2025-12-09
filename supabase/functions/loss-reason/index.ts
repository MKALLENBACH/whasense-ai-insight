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
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!openAIApiKey) {
      return new Response(
        JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }),
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

    // Call OpenAI
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { 
            role: 'system', 
            content: 'You analyze sales conversations and determine loss reasons. Always respond with valid JSON only.' 
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Parse JSON response
    try {
      const parsed = JSON.parse(content.trim());
      
      console.log('AI suggested loss reason:', parsed);

      return new Response(
        JSON.stringify({
          suggested_reason: parsed.suggested_reason || 'other',
          explanation: parsed.explanation || 'Motivo não identificado',
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
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
