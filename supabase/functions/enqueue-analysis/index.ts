import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Enqueue Analysis - Add items to processing queue for async AI analysis
 * This function returns immediately (≤100ms) and queues the heavy work for later
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { 
      type, 
      company_id, 
      message_id, 
      message, 
      audio_url, 
      image_url,
      cycle_id,
      cycle_type,
      cycle_messages,
      priority = 5 
    } = await req.json();

    if (!type || !company_id) {
      return new Response(JSON.stringify({ error: "Missing required fields: type, company_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check company limits before queueing
    const { data: limits } = await supabase
      .from("company_limits")
      .select("is_throttled, max_ai_ops_per_minute")
      .eq("company_id", company_id)
      .maybeSingle();

    if (limits?.is_throttled) {
      return new Response(JSON.stringify({ 
        error: "Company is throttled", 
        queued: false 
      }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check current queue size for this company
    const { count: queueSize } = await supabase
      .from("processing_queue")
      .select("id", { count: "exact", head: true })
      .eq("company_id", company_id)
      .eq("status", "pending");

    // If queue is too large, increase priority (lower number = higher priority)
    let adjustedPriority = priority;
    if (queueSize && queueSize > 100) {
      adjustedPriority = Math.min(priority + 2, 10); // Decrease priority for overloaded companies
    }

    // Build payload based on type
    let payload: Record<string, unknown> = { company_id };

    switch (type) {
      case "text_analysis":
        payload = {
          ...payload,
          message_id,
          message,
          cycle_id,
          cycle_type,
          cycle_messages,
        };
        break;
      case "audio_analysis":
        payload = {
          ...payload,
          message_id,
          audio_url,
        };
        break;
      case "image_analysis":
        payload = {
          ...payload,
          message_id,
          image_url,
        };
        break;
      case "metric_aggregation":
        payload = {
          ...payload,
          date: new Date().toISOString().split("T")[0],
        };
        break;
      default:
        return new Response(JSON.stringify({ error: `Unknown type: ${type}` }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    // Insert into queue
    const { data: queueItem, error: insertError } = await supabase
      .from("processing_queue")
      .insert({
        company_id,
        type,
        payload,
        priority: adjustedPriority,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Error inserting to queue:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Enqueued ${type} for company ${company_id}, queue item: ${queueItem.id}`);

    return new Response(JSON.stringify({ 
      queued: true, 
      queue_id: queueItem.id,
      priority: adjustedPriority,
      current_queue_size: (queueSize || 0) + 1
    }), {
      status: 202, // Accepted
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Enqueue error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
