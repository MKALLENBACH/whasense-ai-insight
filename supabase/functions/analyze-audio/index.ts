import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio_url, message_id, sender } = await req.json();

    if (!audio_url || !message_id) {
      return new Response(
        JSON.stringify({ error: "audio_url and message_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Analyzing audio for message ${message_id}, sender: ${sender}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY")!;
    const openaiApiKey = Deno.env.get("OPENAI_API_KEY");

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Download the audio file
    console.log("Downloading audio from:", audio_url);
    const audioResponse = await fetch(audio_url);
    if (!audioResponse.ok) {
      throw new Error(`Failed to download audio: ${audioResponse.status}`);
    }
    const audioBuffer = await audioResponse.arrayBuffer();
    const audioBlob = new Blob([audioBuffer], { type: "audio/webm" });

    // Step 2: Transcribe using OpenAI Whisper (if available) or Lovable AI
    let transcription = "";

    if (openaiApiKey) {
      console.log("Transcribing with OpenAI Whisper...");
      const formData = new FormData();
      formData.append("file", audioBlob, "audio.webm");
      formData.append("model", "whisper-1");
      formData.append("language", "pt");

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
        console.log("Transcription:", transcription);
      } else {
        console.error("Whisper error:", await whisperResponse.text());
      }
    }

    // If no transcription yet, use placeholder
    if (!transcription) {
      transcription = "[Áudio - transcrição não disponível]";
    }

    // Step 3: Update message content with transcription
    await supabase
      .from("messages")
      .update({ content: transcription })
      .eq("id", message_id);

    // Step 4: Analyze the transcription with AI
    const isSeller = sender === "seller" || sender === "outgoing";

    let analysisPrompt: string;
    if (isSeller) {
      // For seller audio, only analyze tone and provide summary
      analysisPrompt = `Analise esta mensagem de áudio de um VENDEDOR para um cliente:

"${transcription}"

Como é uma mensagem do vendedor, NÃO avalie intenção de compra.
Retorne um JSON com:
{
  "sentiment": "positive" | "neutral" | "negative",
  "summary": "Resumo breve do que o vendedor disse (1-2 frases)",
  "tone": "Avaliação do tom usado (profissional, amigável, etc)",
  "suggestion": null
}`;
    } else {
      // For customer audio, full analysis
      analysisPrompt = `Analise esta mensagem de áudio de um CLIENTE:

"${transcription}"

Retorne um JSON com:
{
  "sentiment": "positive" | "neutral" | "negative",
  "intention": "compra" | "dúvida" | "interesse" | "reclamação" | "outro",
  "objection": "price" | "delay" | "trust" | "doubt" | "none",
  "temperature": "hot" | "warm" | "cold",
  "next_action": "Sugestão de próxima ação para o vendedor",
  "suggestion": "Sugestão de resposta para o vendedor"
}`;
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
        const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          insights = JSON.parse(jsonMatch[0]);
        }
      } catch (e) {
        console.error("Error parsing AI response:", e);
      }
    } else {
      console.error("AI analysis failed:", await aiResponse.text());
    }

    // Step 5: Save insights to database
    const insightData: any = {
      message_id,
      sentiment: insights.sentiment || "neutral",
    };

    if (!isSeller) {
      insightData.intention = insights.intention || null;
      insightData.objection = insights.objection || null;
      insightData.temperature = insights.temperature || null;
      insightData.next_action = insights.next_action || null;
      insightData.suggestion = insights.suggestion || null;
    } else {
      // For seller messages, only store sentiment
      insightData.intention = null;
      insightData.objection = null;
      insightData.temperature = null;
      insightData.next_action = null;
      insightData.suggestion = null;
    }

    const { error: insightError } = await supabase
      .from("insights")
      .insert(insightData);

    if (insightError) {
      console.error("Error saving insight:", insightError);
    }

    console.log("Audio analysis complete");

    return new Response(
      JSON.stringify({
        success: true,
        transcription,
        insights,
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
