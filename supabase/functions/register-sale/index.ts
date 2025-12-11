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

    // Validate JWT token from Authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    
    // Create a client with the user's token to validate authentication
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } }
    });
    
    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    
    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    // Use the authenticated user's ID as the seller_id (not from request body)
    const sellerId = user.id;

    const body = await req.json();
    const { customer_id, status, reason, description } = body;

    // Validate required fields
    if (!customer_id || !status) {
      return new Response(
        JSON.stringify({ error: 'customer_id and status are required' }),
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

    console.log('Registering sale:', { seller_id: sellerId, customer_id, status, reason });

    // Get seller's company_id and verify seller exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', sellerId)
      .maybeSingle();

    if (profileError) {
      console.error('Error fetching profile:', profileError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify seller profile' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!profile) {
      return new Response(
        JSON.stringify({ error: 'Seller profile not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = profile.company_id;
    console.log('Seller company_id:', companyId);

    // Verify the customer belongs to the same company as the seller
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('id, company_id, seller_id')
      .eq('id', customer_id)
      .maybeSingle();

    if (customerError) {
      console.error('Error fetching customer:', customerError);
      return new Response(
        JSON.stringify({ error: 'Failed to verify customer' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!customer) {
      return new Response(
        JSON.stringify({ error: 'Customer not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify company match
    if (customer.company_id !== companyId) {
      console.error('Company mismatch: customer company', customer.company_id, 'seller company', companyId);
      return new Response(
        JSON.stringify({ error: 'Unauthorized - customer belongs to different company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify seller is assigned to this customer (or is manager)
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', sellerId)
      .maybeSingle();

    const isManager = userRole?.role === 'manager';
    
    if (!isManager && customer.seller_id !== sellerId) {
      console.error('Seller not assigned to customer');
      return new Response(
        JSON.stringify({ error: 'Unauthorized - you are not assigned to this customer' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
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
        seller_id: sellerId,
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
              vendor_id: sellerId,
              points: 10,
              reason: 'Venda concluída',
              sale_id: sale.id,
            });
          console.log('Gamification points awarded');
        } else {
          console.log('Points already exist for this sale, skipping');
        }

        // Trigger full gamification recalculation (goals, leaderboards, badges)
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
