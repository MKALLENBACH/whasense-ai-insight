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
      throw insertError;
    }

    console.log('Sale registered successfully:', sale);

    // Award gamification points for won sales
    if (status === 'won' && companyId) {
      try {
        console.log('Awarding gamification points for sale');
        
        // Insert gamification points directly
        await supabase
          .from('gamification_points')
          .insert({
            company_id: companyId,
            vendor_id: seller_id,
            points: 10,
            reason: 'Venda concluída',
            sale_id: sale.id,
          });

        // Update goal progress for sales-type goals
        const { data: activeGoals } = await supabase
          .from('goals')
          .select('id')
          .eq('company_id', companyId)
          .eq('goal_type', 'vendas')
          .lte('start_date', new Date().toISOString().split('T')[0])
          .gte('end_date', new Date().toISOString().split('T')[0]);

        if (activeGoals && activeGoals.length > 0) {
          for (const goal of activeGoals) {
            // Get current goal_vendor record
            const { data: gv } = await supabase
              .from('goal_vendors')
              .select('*')
              .eq('goal_id', goal.id)
              .eq('vendor_id', seller_id)
              .single();

            if (gv) {
              const newCurrentValue = (gv.current_value || 0) + 1;
              const newProgress = Math.min(100, (newCurrentValue / gv.target_value) * 100);
              const newStatus = newProgress >= 100 ? 'achieved' : newProgress >= 70 ? 'on_track' : 'behind';

              await supabase
                .from('goal_vendors')
                .update({
                  current_value: newCurrentValue,
                  progress: newProgress,
                  status: newStatus,
                })
                .eq('id', gv.id);

              // Award bonus points if goal is achieved
              if (newProgress >= 100 && gv.progress < 100) {
                await supabase
                  .from('gamification_points')
                  .insert({
                    company_id: companyId,
                    vendor_id: seller_id,
                    points: 20,
                    reason: 'Meta atingida',
                  });

                // Award achievement badge
                const { data: existingBadge } = await supabase
                  .from('achievements')
                  .select('id')
                  .eq('vendor_id', seller_id)
                  .eq('badge_type', 'meta_batida')
                  .single();

                if (!existingBadge) {
                  await supabase
                    .from('achievements')
                    .insert({
                      vendor_id: seller_id,
                      badge_type: 'meta_batida',
                    });
                }
              }
            }
          }
        }

        // Check for Closer Master badge (10 sales in 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const { count: recentSalesCount } = await supabase
          .from('sales')
          .select('*', { count: 'exact', head: true })
          .eq('seller_id', seller_id)
          .eq('status', 'won')
          .gte('created_at', sevenDaysAgo.toISOString());

        if (recentSalesCount && recentSalesCount >= 10) {
          const { data: existingCloserBadge } = await supabase
            .from('achievements')
            .select('id')
            .eq('vendor_id', seller_id)
            .eq('badge_type', 'closer_master')
            .single();

          if (!existingCloserBadge) {
            await supabase
              .from('achievements')
              .insert({
                vendor_id: seller_id,
                badge_type: 'closer_master',
              });

            console.log('Awarded Closer Master badge');
          }
        }

        console.log('Gamification updated successfully');
      } catch (gamError) {
        console.error('Error updating gamification:', gamError);
        // Don't fail the sale registration if gamification fails
      }

      // Trigger full gamification recalculation (leaderboards, etc.)
      try {
        console.log('Triggering calculate-gamification for full recalculation');
        await supabase.functions.invoke('calculate-gamification', {
          body: { company_id: companyId }
        });
        console.log('Calculate-gamification triggered successfully');
      } catch (calcError) {
        console.error('Error triggering calculate-gamification:', calcError);
        // Don't fail the sale registration
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
