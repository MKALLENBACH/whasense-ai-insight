import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Client audio analysis prompt
const CLIENT_AUDIO_ANALYSIS_PROMPT = `Você é responsável por analisar mensagens de áudio enviadas por um cliente em uma conversa de vendas via WhatsApp.

Aqui está a transcrição do áudio:
"""
{{transcription}}
"""

Analise o conteúdo e retorne um JSON com:

{
  "sentiment": "positive" | "neutral" | "negative",
  "emotion": "calmo" | "irritado" | "animado" | "frustrado" | "confuso" | "interessado" | "desinteressado",
  "intention": "duvida" | "avaliando" | "pronto_para_comprar" | "comparando" | "reclamando" | "cancelando" | "outro",
  "objection": "price" | "delay" | "trust" | "doubt" | "none",
  "temperature": "cold" | "warm" | "hot",
  "summary": "Resumo de 1 linha do que o cliente disse",
  "clientRequest": true | false,
  "indicatesInterest": true | false,
  "detectedObjection": "texto da objeção ou null",
  "attentionPoint": "ponto de atenção para o vendedor ou null"
}

Regras:
- NÃO sugerir resposta.
- NÃO tentar negociar.
- Apenas analisar.
- clientRequest = true se o cliente pediu algo, fez pergunta, ou solicitou informação.
- indicatesInterest = true se demonstrou interesse em comprar ou saber mais.
- detectedObjection deve conter o texto exato da objeção se houver.
- attentionPoint deve destacar algo importante que o vendedor precisa notar.`;

// Seller audio analysis prompt
const SELLER_AUDIO_ANALYSIS_PROMPT = `Analise esta mensagem de áudio de um VENDEDOR para um cliente:

"{{transcription}}"

Como é uma mensagem do vendedor, NÃO avalie intenção de compra.
Retorne um JSON com:
{
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "Resumo breve do que o vendedor disse (1-2 frases)",
  "tone": "Avaliação do tom usado (profissional, amigável, etc)",
  "suggestion": null
}`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio_url, message_id, sender, simulated_transcription } = await req.json();

    if (!message_id) {
      return new Response(
        JSON.stringify({ error: "message_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing audio for message ${message_id}, sender: ${sender}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let transcription = "";

    // Check if this is a simulated transcription (for testing/demo)
    if (simulated_transcription) {
      console.log("Using simulated transcription");
      transcription = simulated_transcription;
    } else if (audio_url && !audio_url.startsWith("simulated://")) {
      // Download and transcribe real audio
      console.log("Downloading audio from:", audio_url);
      const audioResponse = await fetch(audio_url);
      if (!audioResponse.ok) {
        throw new Error(`Failed to download audio: ${audioResponse.status}`);
      }
      const audioBuffer = await audioResponse.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

      // Try OpenAI Whisper first
      let whisperSuccess = false;
      if (openaiApiKey) {
        console.log("Transcribing with OpenAI Whisper...");
        const formData = new FormData();
        formData.append("file", audioBlob, "audio.webm");
        formData.append("model", "whisper-1");
        formData.append("language", "pt");

        try {
          const whisperResponse = await fetch("https://api.openai.com/v1/audio/transcriptions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiApiKey}`,
            },
            body: formData,
          });

          if (whisperResponse.ok) {
            const whisperData = await whisperResponse.json();
            transcription = whisperData.text || "";
            whisperSuccess = true;
            console.log("Whisper transcription:", transcription);
          } else {
            const errorText = await whisperResponse.text();
            console.error("Whisper error:", errorText);
            // Check for quota errors
            if (errorText.includes("insufficient_quota") || errorText.includes("rate_limit")) {
              console.log("OpenAI quota exceeded, falling back to Gemini...");
            }
          }
        } catch (whisperErr) {
          console.error("Whisper request failed:", whisperErr);
        }
      }

      // Fallback to Gemini for transcription if Whisper failed
      if (!whisperSuccess && lovableApiKey) {
        console.log("Transcribing with Gemini (fallback)...");
        
        // Convert audio to base64 for Gemini
        const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBuffer)));
        
        try {
          const geminiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
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
                      text: "Transcreva este áudio em português brasileiro. Retorne APENAS a transcrição, sem nenhum texto adicional, explicações ou formatação. Se não conseguir transcrever, retorne apenas: [Áudio não transcrito]"
                    },
                    {
                      type: "input_audio",
                      input_audio: {
                        data: base64Audio,
                        format: "webm"
                      }
                    }
                  ]
                }
              ],
              temperature: 0.1,
            }),
          });

          if (geminiResponse.ok) {
            const geminiData = await geminiResponse.json();
            const geminiText = geminiData.choices?.[0]?.message?.content?.trim() || "";
            if (geminiText && !geminiText.includes("[Áudio não transcrito]")) {
              transcription = geminiText;
              console.log("Gemini transcription:", transcription);
            }
          } else {
            console.error("Gemini transcription error:", await geminiResponse.text());
          }
        } catch (geminiErr) {
          console.error("Gemini transcription failed:", geminiErr);
        }
      }
    }

    // If no transcription yet, use placeholder
    if (!transcription) {
      transcription = "[Áudio - transcrição não disponível]";
      console.log("No transcription available, using placeholder");
    }

    // Update message content with transcription
    await supabase
      .from("messages")
      .update({ content: transcription })
      .eq("id", message_id);

    // Analyze the transcription with AI
    const isSeller = sender === "seller" || sender === "outgoing";
    const isClient = sender === "client" || sender === "incoming";

    let analysisPrompt: string;
    if (isSeller) {
      analysisPrompt = SELLER_AUDIO_ANALYSIS_PROMPT.replace("{{transcription}}", transcription);
    } else {
      analysisPrompt = CLIENT_AUDIO_ANALYSIS_PROMPT.replace("{{transcription}}", transcription);
    }

    console.log("Analyzing transcription with AI...");
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "Você é um analisador de mensagens de vendas. Retorne sempre JSON válido." },
          { role: "user", content: analysisPrompt },
        ],
        temperature: 0.3,
      }),
    });

    let insights: any = {};

    if (aiResponse.ok) {
      const aiData = await aiResponse.json();
      const aiContent = aiData.choices?.[0]?.message?.content || "{}";
      
      try {
        let jsonContent = aiContent.trim();
        // Remove markdown code blocks if present
        if (jsonContent.startsWith('```json')) {
          jsonContent = jsonContent.replace(/^```json\n?/, '').replace(/\n?```$/, '');
        } else if (jsonContent.startsWith('```')) {
          jsonContent = jsonContent.replace(/^```\n?/, '').replace(/\n?```$/, '');
        }
        insights = JSON.parse(jsonContent);
      } catch (e) {
        console.error("Error parsing AI response:", e);
      }
    } else {
      console.error("AI analysis failed:", await aiResponse.text());
    }

    // Get message and cycle info for updates
    const { data: messageData } = await supabase
      .from("messages")
      .select("customer_id, cycle_id, seller_id")
      .eq("id", message_id)
      .single();

    // Save insights to database
    const insightData: any = {
      message_id,
      sentiment: insights.sentiment || "neutral",
    };

    if (isClient) {
      // Map client analysis fields to insight table structure
      const intentionMap: Record<string, string> = {
        "duvida": "dúvida",
        "avaliando": "interesse",
        "pronto_para_comprar": "compra",
        "comparando": "dúvida",
        "reclamando": "reclamação",
        "cancelando": "reclamação",
        "outro": "outro",
      };

      insightData.intention = intentionMap[insights.intention] || insights.intention || null;
      insightData.objection = insights.objection || null;
      insightData.temperature = insights.temperature || null;
      insightData.next_action = insights.attentionPoint || insights.summary || null;
      insightData.suggestion = null; // AI should not suggest for client messages directly
    } else {
      // For seller messages, only store sentiment and summary
      insightData.intention = null;
      insightData.objection = null;
      insightData.temperature = null;
      insightData.next_action = insights.summary || null;
      insightData.suggestion = null;
    }

    const { error: insightError } = await supabase
      .from("insights")
      .insert(insightData);

    if (insightError) {
      console.error("Error saving insight:", insightError);
    }

    // Update sale cycle for client audios
    if (isClient && messageData?.cycle_id) {
      const cycleUpdates: any = {
        last_activity_at: new Date().toISOString(),
      };

      // Update cycle status to in_progress if pending
      const { data: cycleData } = await supabase
        .from("sale_cycles")
        .select("status")
        .eq("id", messageData.cycle_id)
        .single();

      if (cycleData?.status === "pending") {
        cycleUpdates.status = "in_progress";
      }

      await supabase
        .from("sale_cycles")
        .update(cycleUpdates)
        .eq("id", messageData.cycle_id);

      // Update customer lead status based on temperature
      if (insights.temperature === "hot") {
        await supabase
          .from("customers")
          .update({ lead_status: "in_progress" })
          .eq("id", messageData.customer_id);
      }
    }

    // Create alerts for client audios with important signals
    if (isClient && messageData) {
      const alertsToCreate: any[] = [];
      const sellerId = messageData.seller_id;

      // Alert for angry/frustrated client
      if (insights.emotion === "irritado" || insights.emotion === "frustrado") {
        alertsToCreate.push({
          customer_id: messageData.customer_id,
          seller_id: sellerId,
          cycle_id: messageData.cycle_id,
          alert_type: "client_angry_audio",
          severity: "critical",
          message: `Cliente irritado em mensagem de áudio: "${insights.summary || transcription.substring(0, 50)}..."`,
          metadata: { emotion: insights.emotion, transcription: transcription.substring(0, 200) },
        });
      }

      // Alert for objection in audio
      if (insights.objection && insights.objection !== "none") {
        const objectionLabels: Record<string, string> = {
          price: "Preço",
          delay: "Prazo de entrega",
          trust: "Confiança",
          doubt: "Dúvida sobre produto",
        };
        
        alertsToCreate.push({
          customer_id: messageData.customer_id,
          seller_id: sellerId,
          cycle_id: messageData.cycle_id,
          alert_type: "audio_objection",
          severity: "warning",
          message: `Objeção detectada em áudio: ${objectionLabels[insights.objection] || insights.objection}`,
          metadata: { objection: insights.objection, detectedObjection: insights.detectedObjection },
        });
      }

      // Alert for high purchase intent
      if (insights.intention === "pronto_para_comprar" || insights.indicatesInterest) {
        alertsToCreate.push({
          customer_id: messageData.customer_id,
          seller_id: sellerId,
          cycle_id: messageData.cycle_id,
          alert_type: "high_intent_audio",
          severity: "info",
          message: `Alta intenção de compra detectada em áudio do cliente`,
          metadata: { intention: insights.intention, temperature: insights.temperature },
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
          console.log(`Created ${alertsToCreate.length} alerts from audio analysis`);
        }
      }
    }

    console.log("Audio analysis complete");

    return new Response(
      JSON.stringify({
        success: true,
        transcription,
        insights,
        isClient,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error in analyze-audio:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
