import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    console.log(`AI Scripts action: ${action}, method: ${req.method}`);

    // GET /ai-scripts/for-company?companyId=XXX - Get active script for AI calls
    if (action === "for-company" && req.method === "GET") {
      const companyId = url.searchParams.get("companyId");
      
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: "companyId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`Fetching script for company: ${companyId}`);

      // Try to get company's active script
      const { data: companyScript, error: companyError } = await supabase
        .from("ai_scripts")
        .select("*")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .maybeSingle();

      if (companyError) {
        console.error("Error fetching company script:", companyError);
        throw companyError;
      }

      // If no company script, get default
      if (!companyScript) {
        console.log("No active company script, fetching default");
        const { data: defaultScript, error: defaultError } = await supabase
          .from("default_ai_script")
          .select("*")
          .limit(1)
          .maybeSingle();

        if (defaultError) {
          console.error("Error fetching default script:", defaultError);
          throw defaultError;
        }

        return new Response(
          JSON.stringify({ 
            script: defaultScript,
            source: "default"
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({ 
          script: companyScript,
          source: "company"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /ai-scripts/list - List all scripts
    if (action === "list" && req.method === "GET") {
      const { data: scripts, error } = await supabase
        .from("ai_scripts")
        .select(`
          *,
          companies:company_id (id, name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ scripts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /ai-scripts/by-company?companyId=XXX - Get all scripts for a company
    if (action === "by-company" && req.method === "GET") {
      const companyId = url.searchParams.get("companyId");
      
      if (!companyId) {
        return new Response(
          JSON.stringify({ error: "companyId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: scripts, error } = await supabase
        .from("ai_scripts")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      return new Response(
        JSON.stringify({ scripts }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // GET /ai-scripts/default - Get default script
    if (action === "default" && req.method === "GET") {
      const { data: script, error } = await supabase
        .from("default_ai_script")
        .select("*")
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      return new Response(
        JSON.stringify({ script }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /ai-scripts/create - Create new script
    if (action === "create" && req.method === "POST") {
      const body = await req.json();
      const { companyId, scriptName, isActive, ...scriptData } = body;

      if (!companyId || !scriptName) {
        return new Response(
          JSON.stringify({ error: "companyId and scriptName are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // If setting as active, deactivate other scripts first
      if (isActive) {
        await supabase
          .from("ai_scripts")
          .update({ is_active: false })
          .eq("company_id", companyId);
      }

      const { data: script, error } = await supabase
        .from("ai_scripts")
        .insert({
          company_id: companyId,
          script_name: scriptName,
          is_active: isActive || false,
          ai_persona: scriptData.aiPersona,
          sales_playbook: scriptData.salesPlaybook,
          forbidden_phrases: scriptData.forbiddenPhrases,
          recommended_phrases: scriptData.recommendedPhrases,
          tone_of_voice: scriptData.toneOfVoice,
          product_context: scriptData.productContext,
          objection_handling: scriptData.objectionHandling,
          closing_techniques: scriptData.closingTechniques,
          opening_messages: scriptData.openingMessages,
          example_responses: scriptData.exampleResponses,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Created script: ${script.id} for company: ${companyId}`);

      return new Response(
        JSON.stringify({ script }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /ai-scripts/update - Update script
    if (action === "update" && req.method === "PATCH") {
      const body = await req.json();
      const { id, isActive, ...scriptData } = body;

      if (!id) {
        return new Response(
          JSON.stringify({ error: "id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get current script to know company_id
      const { data: currentScript } = await supabase
        .from("ai_scripts")
        .select("company_id")
        .eq("id", id)
        .single();

      // If setting as active, deactivate other scripts first
      if (isActive && currentScript) {
        await supabase
          .from("ai_scripts")
          .update({ is_active: false })
          .eq("company_id", currentScript.company_id);
      }

      const updateData: Record<string, unknown> = {};
      if (scriptData.scriptName !== undefined) updateData.script_name = scriptData.scriptName;
      if (isActive !== undefined) updateData.is_active = isActive;
      if (scriptData.aiPersona !== undefined) updateData.ai_persona = scriptData.aiPersona;
      if (scriptData.salesPlaybook !== undefined) updateData.sales_playbook = scriptData.salesPlaybook;
      if (scriptData.forbiddenPhrases !== undefined) updateData.forbidden_phrases = scriptData.forbiddenPhrases;
      if (scriptData.recommendedPhrases !== undefined) updateData.recommended_phrases = scriptData.recommendedPhrases;
      if (scriptData.toneOfVoice !== undefined) updateData.tone_of_voice = scriptData.toneOfVoice;
      if (scriptData.productContext !== undefined) updateData.product_context = scriptData.productContext;
      if (scriptData.objectionHandling !== undefined) updateData.objection_handling = scriptData.objectionHandling;
      if (scriptData.closingTechniques !== undefined) updateData.closing_techniques = scriptData.closingTechniques;
      if (scriptData.openingMessages !== undefined) updateData.opening_messages = scriptData.openingMessages;
      if (scriptData.exampleResponses !== undefined) updateData.example_responses = scriptData.exampleResponses;

      const { data: script, error } = await supabase
        .from("ai_scripts")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;

      console.log(`Updated script: ${id}`);

      return new Response(
        JSON.stringify({ script }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // PATCH /ai-scripts/update-default - Update default script
    if (action === "update-default" && req.method === "PATCH") {
      const body = await req.json();
      const { id, ...scriptData } = body;

      const updateData: Record<string, unknown> = {};
      if (scriptData.scriptName !== undefined) updateData.script_name = scriptData.scriptName;
      if (scriptData.aiPersona !== undefined) updateData.ai_persona = scriptData.aiPersona;
      if (scriptData.salesPlaybook !== undefined) updateData.sales_playbook = scriptData.salesPlaybook;
      if (scriptData.forbiddenPhrases !== undefined) updateData.forbidden_phrases = scriptData.forbiddenPhrases;
      if (scriptData.recommendedPhrases !== undefined) updateData.recommended_phrases = scriptData.recommendedPhrases;
      if (scriptData.toneOfVoice !== undefined) updateData.tone_of_voice = scriptData.toneOfVoice;
      if (scriptData.productContext !== undefined) updateData.product_context = scriptData.productContext;
      if (scriptData.objectionHandling !== undefined) updateData.objection_handling = scriptData.objectionHandling;
      if (scriptData.closingTechniques !== undefined) updateData.closing_techniques = scriptData.closingTechniques;
      if (scriptData.openingMessages !== undefined) updateData.opening_messages = scriptData.openingMessages;
      if (scriptData.exampleResponses !== undefined) updateData.example_responses = scriptData.exampleResponses;

      let query = supabase.from("default_ai_script").update(updateData);
      
      if (id) {
        query = query.eq("id", id);
      }

      const { data: script, error } = await query.select().single();

      if (error) throw error;

      console.log(`Updated default script`);

      return new Response(
        JSON.stringify({ script }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // DELETE /ai-scripts/delete?id=XXX - Delete script
    if (action === "delete" && req.method === "DELETE") {
      const id = url.searchParams.get("id");

      if (!id) {
        return new Response(
          JSON.stringify({ error: "id is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { error } = await supabase
        .from("ai_scripts")
        .delete()
        .eq("id", id);

      if (error) throw error;

      console.log(`Deleted script: ${id}`);

      return new Response(
        JSON.stringify({ success: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // POST /ai-scripts/clone - Clone a script
    if (action === "clone" && req.method === "POST") {
      const body = await req.json();
      const { sourceId, targetCompanyId, newName } = body;

      if (!sourceId) {
        return new Response(
          JSON.stringify({ error: "sourceId is required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Get source script
      const { data: source, error: sourceError } = await supabase
        .from("ai_scripts")
        .select("*")
        .eq("id", sourceId)
        .single();

      if (sourceError) throw sourceError;

      // Create clone
      const { data: script, error } = await supabase
        .from("ai_scripts")
        .insert({
          company_id: targetCompanyId || source.company_id,
          script_name: newName || `${source.script_name} (cópia)`,
          is_active: false,
          ai_persona: source.ai_persona,
          sales_playbook: source.sales_playbook,
          forbidden_phrases: source.forbidden_phrases,
          recommended_phrases: source.recommended_phrases,
          tone_of_voice: source.tone_of_voice,
          product_context: source.product_context,
          objection_handling: source.objection_handling,
          closing_techniques: source.closing_techniques,
          opening_messages: source.opening_messages,
          example_responses: source.example_responses,
        })
        .select()
        .single();

      if (error) throw error;

      console.log(`Cloned script ${sourceId} to ${script.id}`);

      return new Response(
        JSON.stringify({ script }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("AI Scripts error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
