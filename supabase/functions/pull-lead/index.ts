import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { customer_id } = await req.json();

    if (!customer_id) {
      return new Response(
        JSON.stringify({ error: 'customer_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[PULL-LEAD] Pulling lead:', { customer_id, seller_id: user.id });

    // Get user profile to get company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User has no company' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get operation settings
    const { data: settings } = await supabase
      .from('manager_operation_settings')
      .select('*')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    // Check if free pull is allowed
    if (settings && !settings.allow_free_pull) {
      return new Response(
        JSON.stringify({ error: 'Free lead pulling is not allowed. Contact your manager.' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check max leads per seller limit
    if (settings && settings.max_active_leads_per_seller > 0) {
      const { count: activeLeadsCount } = await supabase
        .from('customers')
        .select('*', { count: 'exact', head: true })
        .eq('assigned_to', user.id)
        .in('lead_status', ['pending', 'in_progress']);

      if (activeLeadsCount && activeLeadsCount >= settings.max_active_leads_per_seller) {
        return new Response(
          JSON.stringify({ 
            error: `You have reached the maximum of ${settings.max_active_leads_per_seller} active leads. Close some leads before pulling new ones.` 
          }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // CORREÇÃO: Usar UPDATE com WHERE para lock otimista
    // Isso previne condição de corrida onde dois vendedores puxam o mesmo lead
    const { data: updatedCustomer, error: updateError } = await supabase
      .from('customers')
      .update({ 
        assigned_to: user.id,
        seller_id: user.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', customer_id)
      .eq('company_id', profile.company_id)
      .is('assigned_to', null) // CRÍTICO: Só atualiza se ainda não estiver atribuído
      .select('id, name')
      .maybeSingle();

    if (updateError) {
      console.error('[PULL-LEAD] Update error:', updateError);
      throw updateError;
    }

    // Se não retornou nenhum registro, o lead já foi atribuído a outro
    if (!updatedCustomer) {
      return new Response(
        JSON.stringify({ error: 'Lead já foi atribuído a outro vendedor' }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[PULL-LEAD] Lead assigned successfully:', updatedCustomer.name);

    // Update sale cycles to use the new seller
    await supabase
      .from('sale_cycles')
      .update({ seller_id: user.id })
      .eq('customer_id', customer_id)
      .in('status', ['pending', 'in_progress']);

    // Trigger AI analysis for recent messages
    const { data: recentMessages } = await supabase
      .from('messages')
      .select('id, content, direction')
      .eq('customer_id', customer_id)
      .order('timestamp', { ascending: false })
      .limit(10);

    if (recentMessages && recentMessages.length > 0) {
      // Analyze each incoming message that hasn't been analyzed yet
      for (const msg of recentMessages.filter(m => m.direction === 'incoming')) {
        // Check if insight already exists
        const { data: existingInsight } = await supabase
          .from('insights')
          .select('id')
          .eq('message_id', msg.id)
          .maybeSingle();

        if (!existingInsight) {
          try {
            console.log('[PULL-LEAD] Triggering AI analysis for message:', msg.id);
            await fetch(`${supabaseUrl}/functions/v1/analyze-message`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseServiceKey}`,
              },
              body: JSON.stringify({
                message: msg.content,
                message_id: msg.id,
              }),
            });
          } catch (analyzeError) {
            console.error('[PULL-LEAD] AI analysis error:', analyzeError);
            // Don't fail the pull if AI analysis fails
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Lead assigned successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[PULL-LEAD] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
