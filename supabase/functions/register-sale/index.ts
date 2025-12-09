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
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { seller_id, customer_id, status, reason, description } = body;

    // Validate required fields
    if (!seller_id || !customer_id || !status) {
      return new Response(
        JSON.stringify({ error: 'seller_id, customer_id, and status are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate status
    if (!['won', 'lost'].includes(status)) {
      return new Response(
        JSON.stringify({ error: 'status must be "won" or "lost"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // If status is lost, reason is required
    if (status === 'lost' && !reason) {
      return new Response(
        JSON.stringify({ error: 'reason is required when status is "lost"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Registering sale:', { seller_id, customer_id, status, reason });

    // Build the reason string
    let finalReason = null;
    if (status === 'lost') {
      finalReason = description ? `${reason}: ${description}` : reason;
    }

    // Insert into sales table
    const { data: sale, error: insertError } = await supabase
      .from('sales')
      .insert({
        seller_id,
        customer_id,
        status,
        reason: finalReason,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting sale:', insertError);
      throw insertError;
    }

    console.log('Sale registered successfully:', sale);

    return new Response(
      JSON.stringify({ 
        success: true, 
        sale,
        message: status === 'won' ? 'Venda registrada com sucesso!' : 'Perda registrada com sucesso!'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in register-sale function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
