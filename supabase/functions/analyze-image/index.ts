import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Vision AI analysis prompt
const IMAGE_ANALYSIS_PROMPT = `Você é responsável por analisar imagens enviadas em uma conversa de vendas via WhatsApp.

A imagem foi enviada por um comprador ou vendedor no contexto de um ciclo de vendas.

Sua tarefa é:
- Descrever o que aparece na imagem.
- Extrair qualquer texto visível (OCR).
- Identificar se há intenção de compra.
- Detectar possíveis objeções.
- Avaliar a emoção do comprador (se houver contexto humano).
- Entender se a imagem é um comprovante de pagamento, uma foto de produto, um documento, uma tabela, ou algo relevante para a venda.

RETORNE APENAS JSON:

{
  "description": "Descrição geral da imagem.",
  "ocr_text": "Se houver texto, retornar. Se não, string vazia.",
  "detected_type": "produto | comprovante | documento | tabela | foto_ambiente | selfie | outro",
  "sentiment": "positivo | neutro | negativo",
  "objection": "preco | prazo | confianca | concorrencia | qualidade | nenhuma",
  "intention": "avaliando | pronto_para_comprar | sem_intencao | duvida",
  "temperature_adjustment": "none | increase | decrease",
  "action_required": "nenhuma | vendedor_deve_confirmar_pagamento | vendedor_deve_enviar_preco | vendedor_deve_pedir_detalhes",
  "summary": "Resumo curto do que o vendedor deve saber.",
  "detected_products": ["lista de produtos identificados se houver"]
}

REGRAS:
- Não criar informações que não existam.
- Não assumir preços ou produtos não vistos.
- Se a imagem não estiver clara, avisar no campo description.`;

// Seller image analysis prompt (simpler - no purchase intent analysis)
const SELLER_IMAGE_ANALYSIS_PROMPT = `Analise esta imagem enviada por um VENDEDOR para um cliente.

Como é uma mensagem do vendedor, NÃO avalie intenção de compra ou objeções.

RETORNE APENAS JSON:

{
  "description": "Descrição geral da imagem.",
  "ocr_text": "Se houver texto, retornar. Se não, string vazia.",
  "detected_type": "produto | comprovante | documento | tabela | foto_ambiente | outro",
  "summary": "Resumo curto do conteúdo da imagem."
}`;

async function fetchImageAsBase64(imageUrl: string): Promise<string> {
  console.log("Downloading image from:", imageUrl);
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
  return base64;
}

function getMediaType(url: string): string {
  const extension = url.split('.').pop()?.toLowerCase().split('?')[0] || '';
  const mimeTypes: Record<string, string> = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'webp': 'image/webp',
    'gif': 'image/gif',
  };
  return mimeTypes[extension] || 'image/jpeg';
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { message_id, image_url, sender } = await req.json();

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: "message_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing image for message ${message_id}, sender: ${sender}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get message details
    const { data: messageData, error: msgError } = await supabase
      .from("messages")
      .select("id, customer_id, seller_id, cycle_id, attachment_url, direction, buyer_id, client_id")
      .eq("id", message_id)
      .single();

    if (msgError || !messageData) {
      console.error("Error fetching message:", msgError);
      throw new Error("Message not found");
    }

    const imageUrl = image_url || messageData.attachment_url;
    if (!imageUrl) {
      throw new Error("No image URL found");
    }

    // Download and convert image to base64
    const imageBase64 = await fetchImageAsBase64(imageUrl);
    const mediaType = getMediaType(imageUrl);

    // Determine sender type
    const isSeller = sender === "seller" || messageData.direction === "outgoing";
    const isClient = sender === "client" || messageData.direction === "incoming";

    // Select appropriate prompt
    const analysisPrompt = isSeller ? SELLER_IMAGE_ANALYSIS_PROMPT : IMAGE_ANALYSIS_PROMPT;

    console.log("Sending image to Vision AI for analysis...");

    // Call Lovable AI Gateway with vision capability (Gemini 2.5 Pro supports vision)
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: analysisPrompt,
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:${mediaType};base64,${imageBase64}`,
                },
              },
            ],
          },
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error("Vision AI error:", aiResponse.status, errorText);
      throw new Error(`Vision AI failed: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "{}";

    let analysis: any = {};
    try {
      let jsonContent = aiContent.trim();
      // Remove markdown code blocks if present
      if (jsonContent.startsWith('```json')) {
        jsonContent = jsonContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (jsonContent.startsWith('```')) {
        jsonContent = jsonContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      analysis = JSON.parse(jsonContent);
      console.log("Image analysis result:", analysis);
    } catch (e) {
      console.error("Error parsing AI response:", e, aiContent);
      analysis = {
        description: "Erro ao analisar imagem",
        ocr_text: "",
        detected_type: "outro",
        summary: "Não foi possível analisar esta imagem",
      };
    }

    // Build insight data
    const insightData: any = {
      message_id,
      insight_type: "image_analysis",
      image_analysis_data: analysis,
      sentiment: analysis.sentiment === "positivo" ? "positive" : 
                 analysis.sentiment === "negativo" ? "negative" : "neutral",
    };

    // Only set sales-related fields for client images
    if (isClient) {
      // Map objection
      const objectionMap: Record<string, string> = {
        "preco": "price",
        "prazo": "delay",
        "confianca": "trust",
        "concorrencia": "trust",
        "qualidade": "doubt",
        "nenhuma": "none",
      };
      insightData.objection = objectionMap[analysis.objection] || null;

      // Map intention
      const intentionMap: Record<string, string> = {
        "avaliando": "interesse",
        "pronto_para_comprar": "compra",
        "sem_intencao": "outro",
        "duvida": "dúvida",
      };
      insightData.intention = intentionMap[analysis.intention] || null;

      // Map temperature adjustment
      if (analysis.temperature_adjustment === "increase") {
        insightData.temperature = "hot";
      } else if (analysis.temperature_adjustment === "decrease") {
        insightData.temperature = "cold";
      }

      insightData.next_action = analysis.action_required !== "nenhuma" 
        ? analysis.action_required?.replace(/_/g, " ") 
        : analysis.summary;
    } else {
      // Seller image - only store description/OCR
      insightData.next_action = analysis.summary || null;
    }

    // Save insight
    const { error: insightError } = await supabase
      .from("insights")
      .insert(insightData);

    if (insightError) {
      console.error("Error saving insight:", insightError);
    } else {
      console.log("Image insight saved successfully");
    }

    // Process special detected types for client images
    if (isClient && messageData.cycle_id) {
      const alertsToCreate: any[] = [];
      const sellerId = messageData.seller_id;
      const customerId = messageData.customer_id;

      // Handle comprovante (payment proof)
      if (analysis.detected_type === "comprovante") {
        console.log("Payment proof detected!");
        alertsToCreate.push({
          customer_id: customerId,
          seller_id: sellerId,
          cycle_id: messageData.cycle_id,
          alert_type: "payment_proof_detected",
          severity: "info",
          message: `Possível comprovante de pagamento detectado na imagem`,
          metadata: { 
            detected_type: analysis.detected_type,
            ocr_text: analysis.ocr_text?.substring(0, 500),
            description: analysis.description,
          },
        });
      }

      // Handle produto (product image)
      if (analysis.detected_type === "produto") {
        console.log("Product image detected, products:", analysis.detected_products);
        
        // Update temperature to warm/hot for product interest
        await supabase
          .from("sale_cycles")
          .update({ last_activity_at: new Date().toISOString() })
          .eq("id", messageData.cycle_id);

        if (analysis.detected_products?.length > 0) {
          alertsToCreate.push({
            customer_id: customerId,
            seller_id: sellerId,
            cycle_id: messageData.cycle_id,
            alert_type: "product_interest",
            severity: "info",
            message: `Cliente enviou foto de produto: ${analysis.detected_products.join(", ")}`,
            metadata: { 
              detected_products: analysis.detected_products,
              description: analysis.description,
            },
          });
        }
      }

      // Handle high purchase intent
      if (analysis.intention === "pronto_para_comprar") {
        alertsToCreate.push({
          customer_id: customerId,
          seller_id: sellerId,
          cycle_id: messageData.cycle_id,
          alert_type: "high_intent_image",
          severity: "info",
          message: `Alta intenção de compra detectada na imagem`,
          metadata: { 
            intention: analysis.intention,
            summary: analysis.summary,
          },
        });

        // Update customer lead status
        await supabase
          .from("customers")
          .update({ lead_status: "in_progress" })
          .eq("id", customerId);
      }

      // Handle detected objection
      if (analysis.objection && analysis.objection !== "nenhuma") {
        const objectionLabels: Record<string, string> = {
          preco: "Preço",
          prazo: "Prazo de entrega",
          confianca: "Confiança",
          concorrencia: "Concorrência",
          qualidade: "Qualidade do produto",
        };

        alertsToCreate.push({
          customer_id: customerId,
          seller_id: sellerId,
          cycle_id: messageData.cycle_id,
          alert_type: "image_objection",
          severity: "warning",
          message: `Objeção detectada na imagem: ${objectionLabels[analysis.objection] || analysis.objection}`,
          metadata: { 
            objection: analysis.objection,
            summary: analysis.summary,
          },
        });
      }

      // Insert alerts
      if (alertsToCreate.length > 0) {
        const { error: alertError } = await supabase
          .from("alerts")
          .insert(alertsToCreate);

        if (alertError) {
          console.error("Error creating alerts:", alertError);
        } else {
          console.log(`Created ${alertsToCreate.length} alerts from image analysis`);
        }
      }

      // Update cycle activity
      await supabase
        .from("sale_cycles")
        .update({ last_activity_at: new Date().toISOString() })
        .eq("id", messageData.cycle_id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis,
        isClient,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in analyze-image:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
