import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANALYSIS_PROMPT = `Você é um especialista em vendas consultivas, responsável por analisar profundamente a conversa e gerar respostas de alta conversão.

IMPORTANTE:
Você deve analisar TODA a conversa abaixo, referente ao ciclo atual.
Nunca ignore o contexto completo.
Nunca se perca na etapa da negociação.

-----------------------------------------
HISTÓRICO COMPLETO DO CICLO (mensagens):
"""
{{cycleMessages}}
"""
-----------------------------------------

Mensagem atual do cliente:
"""
{{message}}
"""

-----------------------------------------
🎯 IDENTIFIQUE A FASE ATUAL DA VENDA
-----------------------------------------

Classifique obrigatoriamente em uma das fases:

- abertura
- descoberta
- diagnostico
- apresentacao_solução
- validacao
- proposta
- fechamento
- objeção
- pos_venda
- reativacao

-----------------------------------------
🎯 O QUE VOCÊ DEVE FAZER:
-----------------------------------------

1. Ler toda a conversa do ciclo (não apenas a última mensagem)
2. Entender a intenção do cliente
3. Detectar objeções explícitas e implícitas
4. Classificar a fase da venda atual
5. Gerar a melhor resposta possível
6. Definir a próxima ação ideal do vendedor para avançar

-----------------------------------------
💡 APLICAR TÉCNICAS DE VENDAS:
-----------------------------------------

- SPIN Selling
- GAP Selling
- Rapport empático
- Feel–Felt–Found
- Gatilhos mentais suaves
- Perguntas consultivas
- Copywriting de conversão
- Next step coaching (sempre mover a conversa para frente)

-----------------------------------------
🧠 REGRAS IMPORTANTES:
-----------------------------------------
- Responda como humano (natural e simpático)
- Use no máximo 1–3 frases
- Nunca ofereça desconto espontaneamente
- Nunca invente informações inexistentes
- Não repita a mensagem do cliente
- Não seja robótico
- SE houver objeção, acolha antes de redirecionar

-----------------------------------------
📦 FORMATO DA RESPOSTA (sempre JSON válido):
-----------------------------------------

{
  "sales_stage": "fase_da_venda",
  "sentiment": "positive | neutral | negative | angry | insecure | excited",
  "intention": 0-100,
  "objection": "price | delay | trust | doubt | none",
  "temperature": "cold | warm | hot",
  "analysis": "Resumo em 1-2 frases do que está acontecendo.",
  "suggestion": "Melhor resposta possível ao cliente.",
  "next_action": "Ação recomendada para avançar a venda."
}

-----------------------------------------`;

interface CycleMessage {
  from: "client" | "seller";
  text: string;
  timestamp?: string;
}

function formatCycleMessages(cycleMessages: CycleMessage[]): string {
  if (!cycleMessages || cycleMessages.length === 0) {
    return "(Nenhuma mensagem anterior no ciclo)";
  }

  return cycleMessages.map((msg, index) => {
    const role = msg.from === "client" ? "CLIENTE" : "VENDEDOR";
    const time = msg.timestamp ? ` [${msg.timestamp}]` : "";
    return `[${index + 1}] ${role}${time}: ${msg.text}`;
  }).join("\n");
}

// IA Service - handles Lovable AI communication
async function analyzeMessage(
  message: string, 
  cycleMessages: CycleMessage[] = []
): Promise<{
  sales_stage: string;
  sentiment: string;
  intention: number;
  objection: string;
  temperature: string;
  analysis: string;
  suggestion: string;
  next_action: string;
}> {
  const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
  
  if (!lovableApiKey) {
    throw new Error('LOVABLE_API_KEY is not configured');
  }

  // Format the cycle messages for the prompt
  const formattedCycleMessages = formatCycleMessages(cycleMessages);

  // Build the prompt with the cycle context
  const systemPrompt = ANALYSIS_PROMPT
    .replace("{{cycleMessages}}", formattedCycleMessages)
    .replace("{{message}}", message);

  console.log("Analyzing with cycle context:", {
    messageCount: cycleMessages.length,
    currentMessage: message.substring(0, 50) + "...",
  });

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
          content: systemPrompt
        },
        { 
          role: 'user', 
          content: `Analise a mensagem atual do cliente considerando todo o histórico do ciclo acima e retorne o JSON com sua análise completa.`
        }
      ],
      temperature: 0.3,
      max_tokens: 800,
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
    
    // Validate and normalize response
    return {
      sales_stage: String(parsed.sales_stage || "descoberta"),
      sentiment: String(parsed.sentiment || "neutral"),
      intention: Number(parsed.intention) || 50,
      objection: String(parsed.objection || "none"),
      temperature: String(parsed.temperature || "warm"),
      analysis: String(parsed.analysis || ""),
      suggestion: String(parsed.suggestion || "Continue a conversa de forma natural."),
      next_action: String(parsed.next_action || "Responder ao cliente"),
    };
  } catch (parseError) {
    console.error('Failed to parse AI response:', content);
    // Return default values instead of throwing
    return {
      sales_stage: "descoberta",
      sentiment: "neutral",
      intention: 50,
      objection: "none",
      temperature: "warm",
      analysis: "Análise não disponível.",
      suggestion: "Continue a conversa de forma natural.",
      next_action: "Responder ao cliente",
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
    const { message, message_id, cycleMessages } = body;

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

    console.log('Analyzing message with cycle context:', {
      message: message.substring(0, 100) + '...',
      cycleMessagesCount: cycleMessages?.length || 0,
    });

    // Call IA Service to analyze the message with full cycle context
    const analysis = await analyzeMessage(message, cycleMessages || []);

    console.log('Analysis result:', {
      sales_stage: analysis.sales_stage,
      sentiment: analysis.sentiment,
      temperature: analysis.temperature,
      objection: analysis.objection,
    });

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
