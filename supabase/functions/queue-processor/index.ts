import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BATCH_SIZE = 20;
const AI_TIMEOUT_MS = 10000; // 10 seconds max for AI calls
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface QueueItem {
  id: string;
  company_id: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  attempts: number;
  max_attempts: number;
  priority: number;
}

interface CompanyLimit {
  max_ai_ops_per_minute: number;
  priority_level: string;
  is_throttled: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Authorization: Require internal cron secret for background jobs
    const cronSecret = Deno.env.get('INTERNAL_CRON_SECRET');
    const body = await req.json().catch(() => ({}));
    const { companyId, batchSize = BATCH_SIZE, secret } = body;
    
    if (cronSecret && secret !== cronSecret) {
      console.warn('Unauthorized queue-processor attempt');
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get pending items, prioritized by priority and created_at
    let query = supabase
      .from("processing_queue")
      .select("*")
      .eq("status", "pending")
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })
      .limit(batchSize);

    if (companyId) {
      query = query.eq("company_id", companyId);
    }

    const { data: items, error: fetchError } = await query;

    if (fetchError) {
      console.error("Error fetching queue items:", fetchError);
      return new Response(JSON.stringify({ error: fetchError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ processed: 0, message: "No items in queue" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Processing ${items.length} queue items`);

    // Group items by company for rate limiting
    const itemsByCompany = new Map<string, QueueItem[]>();
    for (const item of items) {
      const companyItems = itemsByCompany.get(item.company_id) || [];
      companyItems.push(item);
      itemsByCompany.set(item.company_id, companyItems);
    }

    // Get company limits
    const companyIds = Array.from(itemsByCompany.keys());
    const { data: limits } = await supabase
      .from("company_limits")
      .select("company_id, max_ai_ops_per_minute, priority_level, is_throttled")
      .in("company_id", companyIds);

    const limitsMap = new Map<string, CompanyLimit>();
    if (limits) {
      for (const limit of limits) {
        limitsMap.set(limit.company_id, limit);
      }
    }

    let processed = 0;
    let failed = 0;
    const results: { id: string; status: string; type: string }[] = [];

    // Process items by company
    for (const [companyId, companyItems] of itemsByCompany) {
      const limit = limitsMap.get(companyId);
      
      // Skip throttled companies
      if (limit?.is_throttled) {
        console.log(`Skipping throttled company: ${companyId}`);
        continue;
      }

      // Process items for this company
      for (const item of companyItems) {
        try {
          // Mark as processing
          await supabase
            .from("processing_queue")
            .update({ 
              status: "processing", 
              started_at: new Date().toISOString(),
              attempts: item.attempts + 1 
            })
            .eq("id", item.id);

          // Process based on type
          let success = false;
          let errorMessage: string | null = null;

          try {
            switch (item.type) {
              case "text_analysis":
                success = await processTextAnalysis(supabase, item.payload);
                break;
              case "audio_analysis":
                success = await processAudioAnalysis(supabase, item.payload);
                break;
              case "image_analysis":
                success = await processImageAnalysis(supabase, item.payload);
                break;
              case "metric_aggregation":
                success = await processMetricAggregation(supabase, item.payload);
                break;
              default:
                console.log(`Unknown queue type: ${item.type}`);
                success = true; // Mark as done to avoid infinite retries
            }
          } catch (processingError) {
            console.error(`Error processing item ${item.id}:`, processingError);
            errorMessage = processingError instanceof Error ? processingError.message : "Unknown error";
          }

          if (success) {
            await supabase
              .from("processing_queue")
              .update({ 
                status: "done", 
                completed_at: new Date().toISOString(),
                error_message: null
              })
              .eq("id", item.id);
            processed++;
            results.push({ id: item.id, status: "done", type: item.type });
          } else {
            // Check if we should retry or mark as failed
            const newStatus = item.attempts + 1 >= item.max_attempts ? "failed" : "pending";
            await supabase
              .from("processing_queue")
              .update({ 
                status: newStatus,
                error_message: errorMessage,
                started_at: null
              })
              .eq("id", item.id);
            
            if (newStatus === "failed") {
              failed++;
            }
            results.push({ id: item.id, status: newStatus, type: item.type });
          }
        } catch (itemError) {
          console.error(`Error handling item ${item.id}:`, itemError);
          failed++;
        }
      }
    }

    const duration = Date.now() - startTime;
    console.log(`Queue processing completed: ${processed} done, ${failed} failed in ${duration}ms`);

    return new Response(JSON.stringify({ 
      processed, 
      failed, 
      duration,
      results 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Queue processor error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// Process text analysis
async function processTextAnalysis(supabase: any, payload: Record<string, unknown>): Promise<boolean> {
  const messageId = payload.message_id as string;
  const message = payload.message as string;
  const companyId = payload.company_id as string;
  const cycleType = payload.cycle_type as string || "pre_sale";
  const cycleMessages = payload.cycle_messages as any[] || [];
  
  if (!messageId || !message) {
    console.error("Missing required fields for text analysis");
    return false;
  }

  try {
    // Get company script
    const { data: script } = await supabase
      .from("ai_scripts")
      .select("*")
      .eq("company_id", companyId)
      .eq("is_active", true)
      .single();

    const prompt = buildAnalysisPrompt(script, message, cycleMessages, cycleType);

    // Call AI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "Você é um especialista em análise de vendas." },
            { role: "user", content: prompt }
          ],
          max_tokens: 1000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error("AI API error:", response.status);
        return false;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        console.error("No content in AI response");
        return false;
      }

      // Parse and save insight
      const analysis = parseAnalysisResponse(content);
      
      await supabase.from("insights").insert({
        message_id: messageId,
        sentiment: analysis.sentiment,
        intention: analysis.intention,
        objection: analysis.objection,
        temperature: analysis.temperature,
        suggestion: analysis.suggestion,
        next_action: analysis.next_action,
        insight_type: "message_analysis",
      });

      return true;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError instanceof Error && fetchError.name === "AbortError") {
        console.error("AI call timed out");
      }
      throw fetchError;
    }
  } catch (error) {
    console.error("Text analysis error:", error);
    return false;
  }
}

// Process audio analysis
async function processAudioAnalysis(supabase: any, payload: Record<string, unknown>): Promise<boolean> {
  const messageId = payload.message_id as string;
  const audioUrl = payload.audio_url as string;
  const companyId = payload.company_id as string;
  
  if (!messageId || !audioUrl) {
    console.error("Missing required fields for audio analysis");
    return false;
  }

  try {
    // Call existing analyze-audio logic (simplified for queue)
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-audio-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message_id: messageId, audio_url: audioUrl, company_id: companyId }),
    });

    return response.ok;
  } catch (error) {
    console.error("Audio analysis error:", error);
    return false;
  }
}

// Process image analysis
async function processImageAnalysis(supabase: any, payload: Record<string, unknown>): Promise<boolean> {
  const messageId = payload.message_id as string;
  const imageUrl = payload.image_url as string;
  const companyId = payload.company_id as string;
  
  if (!messageId || !imageUrl) {
    console.error("Missing required fields for image analysis");
    return false;
  }

  try {
    // Call existing analyze-image logic (simplified for queue)
    const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/analyze-image-worker`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message_id: messageId, image_url: imageUrl, company_id: companyId }),
    });

    return response.ok;
  } catch (error) {
    console.error("Image analysis error:", error);
    return false;
  }
}

// Process metric aggregation
async function processMetricAggregation(supabase: any, payload: Record<string, unknown>): Promise<boolean> {
  const companyId = payload.company_id as string;
  const dateStr = payload.date as string;
  
  if (!companyId || !dateStr) {
    console.error("Missing required fields for metric aggregation");
    return false;
  }

  try {
    // Aggregate company daily metrics
    const targetDate = new Date(dateStr);
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    // Get message counts
    const { data: messages } = await supabase
      .from("messages")
      .select("id, direction, seller_id")
      .gte("timestamp", startOfDay.toISOString())
      .lte("timestamp", endOfDay.toISOString());

    // Get cycle counts by status
    const { data: cycles } = await supabase
      .from("sale_cycles")
      .select("id, status, seller_id")
      .gte("created_at", startOfDay.toISOString())
      .lte("created_at", endOfDay.toISOString());

    // Upsert company analytics
    const companyMetrics = {
      company_id: companyId,
      date: dateStr,
      total_messages: messages?.length || 0,
      incoming_messages: messages?.filter((m: any) => m.direction === "incoming").length || 0,
      outgoing_messages: messages?.filter((m: any) => m.direction === "outgoing").length || 0,
      total_won: cycles?.filter((c: any) => c.status === "won").length || 0,
      total_lost: cycles?.filter((c: any) => c.status === "lost").length || 0,
      total_pending: cycles?.filter((c: any) => c.status === "pending").length || 0,
      total_in_progress: cycles?.filter((c: any) => c.status === "in_progress").length || 0,
      updated_at: new Date().toISOString(),
    };

    await supabase
      .from("analytics_daily_company")
      .upsert(companyMetrics, { onConflict: "company_id,date" });

    return true;
  } catch (error) {
    console.error("Metric aggregation error:", error);
    return false;
  }
}

function buildAnalysisPrompt(script: any, message: string, cycleMessages: any[], cycleType: string): string {
  const persona = script?.ai_persona || "Consultor de vendas experiente";
  const context = script?.product_context || "produtos e serviços";
  
  let prompt = `Você é um ${persona}. Analise a seguinte mensagem do cliente no contexto de ${context}.\n\n`;
  
  if (cycleMessages && cycleMessages.length > 0) {
    prompt += "Histórico da conversa:\n";
    for (const msg of cycleMessages.slice(-10)) {
      prompt += `${msg.direction === "incoming" ? "Cliente" : "Vendedor"}: ${msg.content}\n`;
    }
    prompt += "\n";
  }
  
  prompt += `Mensagem atual: ${message}\n\n`;
  prompt += `Tipo de ciclo: ${cycleType === "post_sale" ? "pós-venda" : "pré-venda"}\n\n`;
  prompt += `Responda em JSON com os campos: sentiment (positive/neutral/negative), intention, objection (se houver), temperature (hot/warm/cold), suggestion, next_action`;
  
  return prompt;
}

function parseAnalysisResponse(content: string): any {
  try {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
  } catch (e) {
    console.error("Error parsing AI response:", e);
  }
  
  // Return defaults if parsing fails
  return {
    sentiment: "neutral",
    intention: null,
    objection: null,
    temperature: "warm",
    suggestion: null,
    next_action: null,
  };
}
