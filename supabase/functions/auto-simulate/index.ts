import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// This function simulates customer messages for active conversations
// It can be called manually or via cron job

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const maxSimulations = body.maxSimulations || 3;
    const minDelayMs = body.minDelayMs || 20000;
    const maxDelayMs = body.maxDelayMs || 60000;

    console.log('Starting auto-simulation...', { maxSimulations, minDelayMs, maxDelayMs });

    // Find active sale cycles that haven't had a customer message recently
    const { data: activeCycles, error: cyclesError } = await supabase
      .from('sale_cycles')
      .select(`
        id,
        customer_id,
        seller_id,
        status
      `)
      .in('status', ['pending', 'in_progress'])
      .limit(maxSimulations);

    if (cyclesError) {
      throw cyclesError;
    }

    // Fetch customer names separately
    const customerIds = activeCycles?.map(c => c.customer_id) || [];
    const { data: customers } = await supabase
      .from('customers')
      .select('id, name, phone')
      .in('id', customerIds.length > 0 ? customerIds : ['']);
    
    const customerMap = new Map(customers?.map(c => [c.id, c]) || []);

    if (cyclesError) {
      throw cyclesError;
    }

    if (!activeCycles || activeCycles.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'No active cycles to simulate',
        simulated: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const results: Array<{ customerId: string; customerName: string; message: string; success: boolean }> = [];

    for (const cycle of activeCycles) {
      const customer = customerMap.get(cycle.customer_id);
      
      try {
        // Get conversation history for this cycle
        const { data: messages } = await supabase
          .from('messages')
          .select('direction, content')
          .eq('cycle_id', cycle.id)
          .order('timestamp', { ascending: true });

        // Check if last message was from seller (customer should respond)
        // Or if there are no messages yet
        const shouldSimulate = !messages || messages.length === 0 || 
          messages[messages.length - 1]?.direction === 'outgoing';

        if (!shouldSimulate) {
          console.log(`Skipping cycle ${cycle.id} - waiting for seller response`);
          continue;
        }

        // Add random delay to make it more realistic
        console.log(`Simulating for customer ${customer?.name || 'Unknown'} (cycle ${cycle.id})`);


        // Call simulate-customer function
        const response = await fetch(`${supabaseUrl}/functions/v1/simulate-customer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({
            customerId: cycle.customer_id,
            sellerId: cycle.seller_id,
            conversationHistory: messages || [],
          }),
        });

        const data = await response.json();

        results.push({
          customerId: cycle.customer_id,
          customerName: customer?.name || 'Unknown',
          message: data.message || '',
          success: data.success || false,
        });

        console.log(`Simulated message for ${customer?.name}: ${data.message?.substring(0, 50)}...`);

      } catch (err) {
        console.error(`Error simulating for cycle ${cycle.id}:`, err);
        results.push({
          customerId: cycle.customer_id,
          customerName: customer?.name || 'Unknown',
          message: '',
          success: false,
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      simulated: results.filter(r => r.success).length,
      total: activeCycles.length,
      results,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in auto-simulate:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
