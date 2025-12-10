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

    // Get seller's company_id
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', seller_id)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
    }

    const companyId = profile?.company_id || null;
    console.log('Seller company_id:', companyId);

    // Check for existing sale for this customer (prevent duplicates)
    const { data: existingSale } = await supabase
      .from('sales')
      .select('id, status')
      .eq('customer_id', customer_id)
      .maybeSingle();

    if (existingSale) {
      console.log('Sale already exists for this customer:', existingSale);
      return new Response(
        JSON.stringify({ 
          error: 'Já existe uma venda registrada para este cliente',
          existing_sale: existingSale 
        }),
        { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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
        company_id: companyId,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting sale:', insertError);
      // Handle unique constraint violation
      if (insertError.code === '23505') {
        return new Response(
          JSON.stringify({ error: 'Já existe uma venda registrada para este cliente' }),
          { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw insertError;
    }

    console.log('Sale registered successfully:', sale);

    // Award gamification points for won sales
    if (status === 'won' && companyId) {
      try {
        console.log('Awarding gamification points for sale');
        
        // Check if points already exist for this sale (prevent duplicates)
        const { data: existingPoints } = await supabase
          .from('gamification_points')
          .select('id')
          .eq('sale_id', sale.id)
          .maybeSingle();

        if (!existingPoints) {
          // Insert gamification points
          await supabase
            .from('gamification_points')
            .insert({
              company_id: companyId,
              vendor_id: seller_id,
              points: 10,
              reason: 'Venda concluída',
              sale_id: sale.id,
            });
          console.log('Gamification points awarded');
        } else {
          console.log('Points already exist for this sale, skipping');
        }

        // Trigger full gamification recalculation (goals, leaderboards, badges)
        // This will recalculate goal progress based on actual sales count
        console.log('Triggering calculate-gamification for full recalculation');
        await supabase.functions.invoke('calculate-gamification', {
          body: { company_id: companyId }
        });
        console.log('Calculate-gamification triggered successfully');
      } catch (gamError) {
        console.error('Error updating gamification:', gamError);
        // Don't fail the sale registration if gamification fails
      }
    }

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
