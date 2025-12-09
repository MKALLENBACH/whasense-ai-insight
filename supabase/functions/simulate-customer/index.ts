import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CUSTOMER_SIMULATION_PROMPT = `Você é um cliente real conversando via WhatsApp com a loja **Exercit Esportes** (suplementos, equipamentos e roupas fitness).

🎯 ESCOLHA ALEATORIAMENTE UM PERFIL DE CLIENTE:

OBJETIVOS POSSÍVEIS:
- Ganho de massa muscular
- Definição / emagrecimento
- Melhora de desempenho esportivo
- Montar academia em casa (home gym)
- Comprar roupas esportivas
- Testar suplementos novos
- Reclamar de preço
- Pedir recomendação técnica
- Pedir combos de produtos
- Comprar presente para alguém

TIPOS DE CLIENTES (escolha um):
- Iniciante inseguro (não sabe o que precisa, faz perguntas básicas)
- Cliente técnico (entende de suplementação, usa termos técnicos)
- Cliente motivado (animado, quer começar logo)
- Cliente desconfiado (questiona qualidade, origem, validade)
- Cliente só pesquisando (comparando preços, sem pressa)
- Cliente com pressa ("preciso pra ontem", quer resolver rápido)
- Cliente econômico (sensível a preço, pede desconto)
- Cliente super quente (quase comprando, só precisa de um empurrão)
- Cliente indeciso (não sabe qual escolher entre opções)
- Cliente recorrente (já comprou antes, quer novidades)

🛒 ASSUNTOS SOBRE PRODUTOS EXERCIT:

SUPLEMENTOS:
- Whey protein (concentrado, isolado, hidrolisado)
- Creatina (monohidratada, creapure)
- Pré-treino (C4, Darkness, Black Skull)
- BCAA, glutamina, beta-alanina
- Hipercalóricos (massa)
- Termogênicos (emagrecimento)
- Vitaminas (D3, complexo B, multivitamínicos)
- Colágeno, ômega 3, ZMA, melatonina

EQUIPAMENTOS:
- Halteres (emborrachados, ferro fundido)
- Barras (olímpicas, W, reta)
- Anilhas (revestidas, bumper)
- Elásticos de resistência
- Bancos de supino (reto, inclinado)
- Esteiras, bicicletas ergométricas
- Racks, gaiolas de agachamento
- Kettlebells, medicine balls

ROUPAS E ACESSÓRIOS:
- Leggings, shorts, bermudas
- Regatas, camisetas dry-fit
- Tops femininos, sutiãs esportivos
- Tênis de treino, cross
- Luvas, cintos de musculação
- Straps, munhequeiras
- Tapetes, rolos de liberação miofascial
- Garrafas, shakers, bolsas

📱 REGRAS PARA MENSAGENS:

FORMATO:
- 1 a 3 frases no máximo
- Linguagem natural de WhatsApp brasileiro
- Pode usar "vc", "tb", "blz", "tlg"
- Emojis ocasionais (não exagerar) 💪🤔👍
- Às vezes mensagens bem curtas tipo "hmm", "entendi", "e o preço?"

COMPORTAMENTO:
- Mantenha coerência com o perfil escolhido durante toda conversa
- Às vezes faça perguntas
- Às vezes gere objeções (preço caro, demora na entrega, desconfiança)
- Às vezes demonstre interesse e animação
- Às vezes fique mais frio/distante
- Seja imprevisível, mas realista
- Evolua a conversa naturalmente (não fique repetindo)

OBJEÇÕES COMUNS (use ocasionalmente):
- "tá caro hein" / "vi mais barato em outro lugar"
- "demora muito pra entregar?"
- "esse produto é original mesmo?"
- "será que funciona pra mim?"
- "vou pensar e depois volto"
- "minha esposa/marido precisa aprovar"

NUNCA:
- Revele que é IA
- Quebre o personagem
- Faça mensagens muito longas
- Use linguagem formal demais`;

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

    // Get or create active cycle for this customer
    let cycleId: string;
    
    const { data: existingCycle } = await supabase
      .from('sale_cycles')
      .select('id, status')
      .eq('customer_id', customerId)
      .in('status', ['pending', 'in_progress'])
      .limit(1)
      .maybeSingle();

    if (existingCycle) {
      cycleId = existingCycle.id;
    } else {
      // Create new cycle
      const { data: newCycle, error: cycleError } = await supabase
        .from('sale_cycles')
        .insert({
          customer_id: customerId,
          seller_id: sellerId,
          status: 'pending',
        })
        .select('id')
        .single();

      if (cycleError) {
        console.error('Error creating cycle:', cycleError);
        throw cycleError;
      }
      cycleId = newCycle.id;
      console.log('Created new cycle for simulation:', cycleId);
    }

    // Build conversation context with full cycle history
    let conversationContext = "";
    const cycleMessages: Array<{ from: string; text: string; timestamp?: string }> = [];
    
    if (conversationHistory && conversationHistory.length > 0) {
      conversationContext = "\n\n📜 HISTÓRICO DA CONVERSA (mantenha coerência):\n";
      conversationHistory.forEach((msg: { direction: string; content: string }, index: number) => {
        const role = msg.direction === 'incoming' ? 'Cliente' : 'Vendedor';
        conversationContext += `[${index + 1}] ${role}: ${msg.content}\n`;
        
        // Build cycle messages for analysis
        cycleMessages.push({
          from: msg.direction === 'incoming' ? 'client' : 'seller',
          text: msg.content,
        });
      });
    }

    const userPrompt = sellerMessage 
      ? `O vendedor acabou de responder:\n"""\n${sellerMessage}\n"""\n\nResponda como cliente, mantendo seu perfil e avançando a conversa naturalmente.`
      : `O vendedor ainda não respondeu. Envie uma mensagem inicial como cliente interessado em produtos fitness, ou faça um follow-up natural.`;

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
        temperature: 0.95,
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

    console.log('Simulated customer message:', customerMessage);

    // Save the customer message with cycle_id
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        seller_id: sellerId,
        content: customerMessage,
        direction: 'incoming',
        timestamp: new Date().toISOString(),
        cycle_id: cycleId,
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('Error saving message:', messageError);
      throw messageError;
    }

    // Add the new message to cycle context for analysis
    cycleMessages.push({
      from: 'client',
      text: customerMessage,
    });

    // Trigger AI analysis for insights with full cycle context
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
          cycleMessages: cycleMessages,
        }),
      });
    } catch (analyzeError) {
      console.error('Failed to analyze message:', analyzeError);
    }

    return new Response(JSON.stringify({
      success: true,
      message: customerMessage,
      messageId: savedMessage.id,
      cycleId,
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
