import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AIScript {
  ai_persona: string | null;
  sales_playbook: string | null;
  forbidden_phrases: string | null;
  recommended_phrases: string | null;
  tone_of_voice: string | null;
  product_context: string | null;
  objection_handling: string | null;
  closing_techniques: string | null;
  opening_messages: string | null;
  example_responses: string | null;
}

// Build dynamic prompt based on company script and cycle type
function buildAnalysisPrompt(script: AIScript | null, cycleType: string = "pre_sale"): string {
  // Use script values or defaults
  const aiPersona = script?.ai_persona || `Você é um assistente de vendas profissional, consultivo e atencioso. Seu objetivo é entender as necessidades do cliente e oferecer soluções adequadas.`;
  
  // For post-sale cycles, use support-focused playbook
  const salesPlaybook = cycleType === "post_sale" 
    ? `1. Saudação cordial e escuta ativa
2. Identificar problema ou dúvida do cliente
3. Demonstrar empatia e compreensão
4. Oferecer solução clara e prática
5. Verificar satisfação com a solução
6. Confirmar se há mais alguma dúvida
7. Encerrar de forma positiva`
    : (script?.sales_playbook || `1. Saudação cordial e apresentação
2. Identificar necessidade do cliente
3. Fazer perguntas consultivas
4. Apresentar soluções relevantes
5. Lidar com objeções
6. Fechar a venda
7. Confirmar próximos passos`);

  const forbiddenPhrases = cycleType === "post_sale"
    ? `Nunca use: técnicas de fechamento de venda, urgência para comprar, "aproveite agora", menção a promoções, tentativas de upsell agressivo.`
    : (script?.forbidden_phrases || `Nunca use: "infelizmente", "não posso", "impossível", linguagem negativa, gírias excessivas, promessas que não pode cumprir.`);

  const recommendedPhrases = cycleType === "post_sale"
    ? `Use frequentemente: "entendo sua preocupação", "vou resolver isso", "fico feliz em ajudar", "me conta mais sobre", "posso ajudar com mais algo?".`
    : (script?.recommended_phrases || `Use frequentemente: "excelente escolha", "perfeito para você", "vou te ajudar", "entendo perfeitamente", "ótima pergunta".`);

  const toneOfVoice = script?.tone_of_voice || `Profissional, amigável, consultivo. Transmita confiança sem ser arrogante. Seja empático e atencioso.`;

  const productContext = script?.product_context || `Produto/serviço da empresa. Adapte conforme contexto da conversa.`;

  const objectionHandling = cycleType === "post_sale"
    ? `Técnica de resolução empática: Acolha a frustração, peça desculpas se necessário, proponha solução concreta, e confirme se resolve.`
    : (script?.objection_handling || `Técnica Feel-Felt-Found: Entendo como você se sente, outros clientes sentiram o mesmo, e descobriram que...`);

  const closingTechniques = cycleType === "post_sale"
    ? `Encerre com: confirmação de satisfação, oferta de suporte adicional, agradecimento pela confiança.`
    : (script?.closing_techniques || `Pergunte sobre próximos passos, ofereça opções claras, crie senso de urgência moderado sem pressão excessiva.`);

  const openingMessages = script?.opening_messages || `Olá! Tudo bem? Como posso te ajudar hoje?`;

  const exampleResponses = cycleType === "post_sale"
    ? `Cliente: Meu produto veio com defeito.
Resposta: Sinto muito por esse transtorno! Vamos resolver isso agora mesmo. Pode me enviar uma foto do defeito? Assim consigo agilizar a troca ou reembolso pra você.`
    : (script?.example_responses || `Cliente: Está caro.
Resposta: Entendo sua preocupação com o investimento. Muitos clientes tinham a mesma dúvida e perceberam que o valor se paga rapidamente pelos benefícios. Posso explicar melhor como isso funciona?`);

  return `
═══════════════════════════════════════════════════════════════
🎯 SCRIPT DA EMPRESA (SIGA FIELMENTE)
═══════════════════════════════════════════════════════════════

📋 PERSONA DO VENDEDOR:
${aiPersona}

📘 PLAYBOOK DE VENDAS:
${salesPlaybook}

✅ VOCABULÁRIO RECOMENDADO:
${recommendedPhrases}

🚫 VOCABULÁRIO PROIBIDO:
${forbiddenPhrases}

🎤 TOM DE VOZ:
${toneOfVoice}

📦 CONTEXTO DE PRODUTOS/SERVIÇOS:
${productContext}

🛡️ COMO LIDAR COM OBJEÇÕES:
${objectionHandling}

🎯 TÉCNICAS DE FECHAMENTO:
${closingTechniques}

💬 MENSAGENS DE ABERTURA RECOMENDADAS:
${openingMessages}

📝 EXEMPLOS DE RESPOSTAS IDEAIS:
${exampleResponses}

═══════════════════════════════════════════════════════════════
📊 ANÁLISE DA CONVERSA
═══════════════════════════════════════════════════════════════

HISTÓRICO DO CICLO:
"""
{{cycleMessages}}
"""

MENSAGEM ATUAL DO CLIENTE:
"""
{{message}}
"""

═══════════════════════════════════════════════════════════════
🎯 TÉCNICAS ${cycleType === "post_sale" ? "DE SUPORTE" : "DE VENDAS"} A APLICAR:
═══════════════════════════════════════════════════════════════

${cycleType === "post_sale" ? `
1. **Escuta Ativa**
   - Ouvir completamente antes de responder
   - Demonstrar que entendeu o problema
   - Fazer perguntas esclarecedoras

2. **Empatia Genuína**
   - Validar sentimentos do cliente
   - Pedir desculpas quando apropriado
   - Mostrar que se importa com a resolução

3. **Resolução Focada**
   - Propor soluções práticas e claras
   - Oferecer alternativas quando possível
   - Não criar expectativas irreais

4. **Acompanhamento**
   - Verificar se a solução funcionou
   - Oferecer suporte adicional
   - Garantir satisfação antes de encerrar

5. **Retenção Suave**
   - Agradecer pela confiança
   - Reforçar disponibilidade para ajudar
   - NÃO tentar vender neste momento
` : `
1. **SPIN Selling**
   - Situação: entender contexto atual do cliente
   - Problema: identificar dores ou necessidades
   - Implicação: mostrar consequências de não resolver
   - Necessidade: fazer o cliente perceber o valor da solução

2. **GAP Selling**
   - Onde o cliente está agora
   - Onde ele quer chegar (objetivo)
   - O que está faltando para chegar lá

3. **Rapport Empático**
   - Criar conexão genuína
   - Demonstrar interesse real pelo objetivo do cliente

4. **Feel–Felt–Found**
   - Acolher objeções com empatia
   - "Entendo como você se sente... outros clientes também sentiram isso... e descobriram que..."

5. **Gatilhos Mentais Suaves**
   - Prova social, autoridade, escassez (sem forçar)

6. **Next Step Coaching**
   - Sempre mover a conversa para frente
   - Sugerir próximo passo claro
`}

═══════════════════════════════════════════════════════════════
🎯 FASES ${cycleType === "post_sale" ? "DO ATENDIMENTO" : "DA VENDA"} (classifique):
═══════════════════════════════════════════════════════════════

${cycleType === "post_sale" ? `
- abertura_suporte
- identificacao_problema
- investigacao
- proposta_solucao
- execucao_solucao
- validacao_satisfacao
- encerramento
- escalacao
` : `
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
`}

═══════════════════════════════════════════════════════════════
🧠 REGRAS IMPORTANTES:
═══════════════════════════════════════════════════════════════

- Responda como humano (natural e simpático)
- Use no máximo 1–3 frases na sugestão
${cycleType === "post_sale" ? `
- NUNCA sugira técnicas de fechamento de venda
- NUNCA aumente a temperatura artificialmente
- NUNCA trate como oportunidade de venda
- Foque em SUPORTE, SATISFAÇÃO e RETENÇÃO
- Se cliente mencionar novo interesse, apenas anote
` : `
- Nunca ofereça desconto espontaneamente
`}
- Nunca invente informações sobre produtos
- Não repita a mensagem do cliente
- Não seja robótico
- SE houver ${cycleType === "post_sale" ? "reclamação" : "objeção"}, acolha antes de redirecionar
- Personalize conforme contexto do cliente
- SIGA FIELMENTE O SCRIPT DA EMPRESA ACIMA

═══════════════════════════════════════════════════════════════
📦 RETORNE APENAS JSON VÁLIDO:
═══════════════════════════════════════════════════════════════

{
  "sales_stage": "fase_${cycleType === "post_sale" ? "do_atendimento" : "da_venda"}",
  "sentiment": "positive | neutral | negative | angry | insecure | excited",
  "intention": ${cycleType === "post_sale" ? "0" : "0-100"},
  "analysis": "Resumo em 1-2 frases do que está acontecendo.",
  "suggestion": "Melhor resposta seguindo o script da empresa (1-3 frases).",
  "next_action": "Próxima ação recomendada para ${cycleType === "post_sale" ? "resolver" : "avançar"}.",
  "objection": "${cycleType === "post_sale" ? "problem | question | complaint | none" : "price | delay | trust | doubt | none"}",
  "temperature": "${cycleType === "post_sale" ? "cold" : "cold | warm | hot"}"
}
`;
}

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

// Fetch company script
async function getCompanyScript(supabaseUrl: string, serviceKey: string, companyId: string): Promise<AIScript | null> {
  console.log(`Fetching script for company: ${companyId}`);
  
  const supabaseClient = createClient(supabaseUrl, serviceKey);
  
  // Try to get company's active script
  const { data: companyScript, error: companyError } = await supabaseClient
    .from("ai_scripts")
    .select("*")
    .eq("company_id", companyId)
    .eq("is_active", true)
    .maybeSingle();

  if (companyError) {
    console.error("Error fetching company script:", companyError);
  }

  if (companyScript) {
    console.log(`Using company script: ${(companyScript as AIScript & { script_name?: string }).script_name || 'unnamed'}`);
    return companyScript as AIScript;
  }

  // Fallback to default script
  console.log("No active company script, fetching default");
  const { data: defaultScript, error: defaultError } = await supabaseClient
    .from("default_ai_script")
    .select("*")
    .limit(1)
    .maybeSingle();

  if (defaultError) {
    console.error("Error fetching default script:", defaultError);
  }

  if (defaultScript) {
    console.log("Using default script");
    return defaultScript as AIScript;
  }

  console.log("No script found, using built-in defaults");
  return null;
}

// IA Service - handles Lovable AI communication
async function analyzeMessage(
  message: string, 
  cycleMessages: CycleMessage[] = [],
  script: AIScript | null = null,
  cycleType: string = "pre_sale"
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

  // Build the prompt with the company script and cycle type
  const basePrompt = buildAnalysisPrompt(script, cycleType);
  const systemPrompt = basePrompt
    .replace("{{cycleMessages}}", formattedCycleMessages)
    .replace("{{message}}", message);

  console.log("Analyzing with script context:", {
    hasScript: !!script,
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
          content: `Analise a mensagem atual do cliente considerando todo o histórico do ciclo e o script da empresa. Retorne o JSON com sua análise completa.`
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

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body
    const body = await req.json();
    const { message, message_id, cycleMessages, companyId, cycleType } = body;

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

    console.log('Analyzing message:', {
      message: message.substring(0, 100) + '...',
      cycleMessagesCount: cycleMessages?.length || 0,
      companyId: companyId || 'not provided',
      cycleType: cycleType || 'pre_sale',
    });

    // Fetch company script if companyId is provided
    let script: AIScript | null = null;
    if (companyId) {
      script = await getCompanyScript(supabaseUrl, supabaseServiceKey, companyId);
    }

    // Call IA Service to analyze the message with full cycle context, company script, and cycle type
    const analysis = await analyzeMessage(message, cycleMessages || [], script, cycleType || "pre_sale");

    console.log('Analysis result:', {
      sales_stage: analysis.sales_stage,
      sentiment: analysis.sentiment,
      temperature: analysis.temperature,
      objection: analysis.objection,
      usedScript: !!script,
    });

    // Save to database if message_id is provided
    if (message_id) {
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
