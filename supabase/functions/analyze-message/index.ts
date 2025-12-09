import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANALYSIS_PROMPT = `Você é uma IA especialista em análise de conversas de WhatsApp focada em vendas.

Sua função é analisar uma única mensagem enviada pelo cliente e retornar um JSON contendo:

1. sentiment → Emoção do cliente
   Valores possíveis:
   - "positive"
   - "neutral"
   - "negative"
   - "angry"
   - "insecure"
   - "excited"

2. intention → Nível de intenção de compra (0 a 100)

3. objection → Objeção principal detectada
   Valores possíveis:
   - "price"
   - "delay"
   - "trust"
   - "doubt"
   - "none"

4. temperature → Probabilidade de conversão
   Valores possíveis:
   - "cold"
   - "warm"
   - "hot"

5. suggestion → Sugestão de resposta breve e prática

6. next_action → Ação recomendada para o vendedor tomar agora

IMPORTANTE:
- Responda SOMENTE o JSON.
- Não adicione nenhuma explicação.
- Não escreva texto fora do JSON.`;

// IA Service - handles Lovable AI communication
async function analyzeMessage(message: string): Promise<{
  sentiment: string;
  intention: number;
  objection: string;
  temperature: string;
  suggestion: string;
  next_action: string;
}> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  const userPrompt = `Mensagem do cliente a analisar:
"""
${message}
"""`;

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
          content: ANALYSIS_PROMPT
        },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error('Lovable AI error:', response.status, errorText);
    
    if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again in a moment.');
    }
    if (response.status === 402) {
      throw new Error('AI credits exhausted. Please add credits to continue.');
    }
    
    throw new Error(`AI API error: ${response.status}`);
  }

  const data = await response.json();
  const content = data.choices[0]?.message?.content;

  if (!content) {
    throw new Error('No content returned from AI');
  }

  // Parse and validate JSON response - handle markdown code blocks
  try {
    let jsonContent = content.trim();
    
    // Remove markdown code blocks if present
    if (jsonContent.startsWith('```json')) {
      jsonContent = jsonContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
    } else if (jsonContent.startsWith('```')) {
      jsonContent = jsonContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
    }
    
    const parsed = JSON.parse(jsonContent);
    
    // Validate required fields
    const requiredFields = ['sentiment', 'intention', 'objection', 'temperature', 'suggestion', 'next_action'];
    for (const field of requiredFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }

    return {
      sentiment: String(parsed.sentiment),
      intention: Number(parsed.intention),
      objection: String(parsed.objection),
      temperature: String(parsed.temperature),
      suggestion: String(parsed.suggestion),
      next_action: String(parsed.next_action),
    };
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    // Return default values instead of throwing
    return {
      sentiment: 'neutral',
      intention: 50,
      objection: 'none',
      temperature: 'warm',
      suggestion: 'Continue a conversa de forma natural.',
      next_action: 'Responder ao cliente',
    };
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate request method
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { message, message_id } = body;

    // Validate input
    if (!message || typeof message !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Message is required and must be a string' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Message cannot be empty' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (message.length > 5000) {
      return new Response(
        JSON.stringify({ error: 'Message is too long (max 5000 characters)' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Analyzing message:', message.substring(0, 100) + '...');

    // Call IA Service to analyze the message
    const analysis = await analyzeMessage(message);

    console.log('Analysis result:', analysis);

    // Save to database if message_id is provided
    if (message_id) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const { error: insertError } = await supabase
        .from('insights')
        .insert({
          message_id,
          sentiment: analysis.sentiment,
          intention: String(analysis.intention),
          objection: analysis.objection,
          temperature: analysis.temperature,
          suggestion: analysis.suggestion,
          next_action: analysis.next_action,
        });

      if (insertError) {
        console.error('Error saving insight to database:', insertError);
        // Continue anyway - we still return the analysis
      } else {
        console.log('Insight saved to database');
      }
    }

    // Return the analysis result
    return new Response(
      JSON.stringify(analysis),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-message function:', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
