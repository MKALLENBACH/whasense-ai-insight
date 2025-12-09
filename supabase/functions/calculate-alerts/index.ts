import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Alert type definitions
const ALERT_TYPES = {
  WAITING_RESPONSE: 'waiting_response',
  HOT_LEAD: 'hot_lead',
  OPEN_OBJECTION: 'open_objection',
  STALE_LEAD: 'stale_lead',
  INCOMPLETE_LEAD: 'incomplete_lead',
};

// Thresholds in milliseconds
const THRESHOLDS = {
  WAITING_RESPONSE: 60 * 1000, // 1 minute
  LONG_WAIT_WARNING: 3 * 60 * 1000, // 3 minutes
  LONG_WAIT_ORANGE: 5 * 60 * 1000, // 5 minutes
  LONG_WAIT_CRITICAL: 10 * 60 * 1000, // 10 minutes
  STALE_LEAD: 24 * 60 * 60 * 1000, // 24 hours
};

interface AlertData {
  customer_id: string;
  seller_id: string;
  cycle_id: string | null;
  alert_type: string;
  severity: string;
  message: string;
  metadata: Record<string, any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting alert calculation...');
    const now = new Date();

    // Fetch all active sale cycles (pending or in_progress only)
    const { data: activeCycles, error: cyclesError } = await supabase
      .from('sale_cycles')
      .select('id, customer_id, seller_id, status, last_activity_at, created_at')
      .in('status', ['pending', 'in_progress']);

    if (cyclesError) {
      console.error('Error fetching active cycles:', cyclesError);
      throw cyclesError;
    }

    const activeCustomerIds = [...new Set(activeCycles?.map(c => c.customer_id) || [])];
    
    if (activeCustomerIds.length === 0) {
      console.log('No active cycles found, cleaning up all alerts');
      // Delete all operational alerts since there are no active cycles
      await supabase
        .from('alerts')
        .delete()
        .in('alert_type', Object.values(ALERT_TYPES));
      
      return new Response(
        JSON.stringify({ success: true, alertsCreated: 0, customersProcessed: 0 }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch customer details for active cycles only
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, seller_id, lead_status, is_incomplete, company_id')
      .in('id', activeCustomerIds);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    console.log(`Found ${customers?.length || 0} active customers`);

    const alertsToCreate: AlertData[] = [];

    for (const cycle of activeCycles || []) {
      const customer = customers?.find(c => c.id === cycle.customer_id);
      if (!customer || !cycle.seller_id) continue;

      const customerId = cycle.customer_id;
      const sellerId = cycle.seller_id;
      const cycleId = cycle.id;

      // Fetch latest message for this cycle
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('id, direction, timestamp, content')
        .eq('customer_id', customerId)
        .eq('cycle_id', cycleId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch latest incoming message for insights
      const { data: lastIncomingMessage } = await supabase
        .from('messages')
        .select('id, timestamp')
        .eq('customer_id', customerId)
        .eq('cycle_id', cycleId)
        .eq('direction', 'incoming')
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      let latestInsight = null;
      if (lastIncomingMessage) {
        const { data: insight } = await supabase
          .from('insights')
          .select('temperature, objection, created_at')
          .eq('message_id', lastIncomingMessage.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        latestInsight = insight;
      }

      // ALERT 1 & 2: Waiting response / Long wait
      // Condition: Last message is from customer and seller hasn't responded
      if (lastMessage && lastMessage.direction === 'incoming') {
        const timeSinceMessage = now.getTime() - new Date(lastMessage.timestamp).getTime();
        const minutesWaiting = Math.floor(timeSinceMessage / 60000);

        if (timeSinceMessage >= THRESHOLDS.WAITING_RESPONSE) {
          let severity = 'warning';
          let message = 'Cliente aguardando resposta';

          if (timeSinceMessage >= THRESHOLDS.LONG_WAIT_CRITICAL) {
            severity = 'critical';
            message = `Mensagem não respondida há ${minutesWaiting} minutos!`;
          } else if (timeSinceMessage >= THRESHOLDS.LONG_WAIT_ORANGE) {
            severity = 'critical';
            message = `Mensagem não respondida há ${minutesWaiting} minutos`;
          } else if (timeSinceMessage >= THRESHOLDS.LONG_WAIT_WARNING) {
            severity = 'warning';
            message = `Mensagem não respondida há ${minutesWaiting} minutos`;
          }

          alertsToCreate.push({
            customer_id: customerId,
            seller_id: sellerId,
            cycle_id: cycleId,
            alert_type: ALERT_TYPES.WAITING_RESPONSE,
            severity,
            message,
            metadata: { minutes_waiting: minutesWaiting, last_message_time: lastMessage.timestamp },
          });
        }
      }

      // ALERT 3: Hot lead
      // Condition: Temperature is hot and cycle is active
      if (latestInsight?.temperature === 'hot') {
        alertsToCreate.push({
          customer_id: customerId,
          seller_id: sellerId,
          cycle_id: cycleId,
          alert_type: ALERT_TYPES.HOT_LEAD,
          severity: 'info',
          message: 'Lead quente — oportunidade!',
          metadata: { temperature: 'hot' },
        });
      }

      // ALERT 4: Open objection
      // Condition: Objection detected and seller hasn't responded since
      if (latestInsight?.objection && latestInsight.objection !== 'none') {
        const insightTime = new Date(latestInsight.created_at);
        const { data: responseAfterObjection } = await supabase
          .from('messages')
          .select('id')
          .eq('customer_id', customerId)
          .eq('cycle_id', cycleId)
          .eq('direction', 'outgoing')
          .gt('timestamp', insightTime.toISOString())
          .limit(1);

        if (!responseAfterObjection || responseAfterObjection.length === 0) {
          const objectionLabels: Record<string, string> = {
            price: 'Preço alto',
            delay: 'Prazo de entrega',
            trust: 'Falta de confiança',
            doubt: 'Dúvidas sobre o produto',
          };

          alertsToCreate.push({
            customer_id: customerId,
            seller_id: sellerId,
            cycle_id: cycleId,
            alert_type: ALERT_TYPES.OPEN_OBJECTION,
            severity: 'warning',
            message: `Objeção aberta: ${objectionLabels[latestInsight.objection] || latestInsight.objection}`,
            metadata: { objection: latestInsight.objection },
          });
        }
      }

      // ALERT 5: Stale lead (24h without activity)
      // Condition: Last activity > 24h and status is in_progress
      if (cycle.status === 'in_progress' && cycle.last_activity_at) {
        const timeSinceLastActivity = now.getTime() - new Date(cycle.last_activity_at).getTime();
        if (timeSinceLastActivity >= THRESHOLDS.STALE_LEAD) {
          const hoursStale = Math.floor(timeSinceLastActivity / (60 * 60 * 1000));
          alertsToCreate.push({
            customer_id: customerId,
            seller_id: sellerId,
            cycle_id: cycleId,
            alert_type: ALERT_TYPES.STALE_LEAD,
            severity: 'warning',
            message: `Lead parado há ${hoursStale} horas`,
            metadata: { hours_stale: hoursStale },
          });
        }
      }

      // ALERT 6: Incomplete lead
      // Condition: Customer is marked as incomplete
      if (customer.is_incomplete) {
        alertsToCreate.push({
          customer_id: customerId,
          seller_id: sellerId,
          cycle_id: cycleId,
          alert_type: ALERT_TYPES.INCOMPLETE_LEAD,
          severity: 'info',
          message: 'Lead incompleto — completar cadastro',
          metadata: { is_incomplete: true },
        });
      }
    }

    // Delete ALL operational alerts first (atomic replacement)
    const { error: deleteError } = await supabase
      .from('alerts')
      .delete()
      .in('alert_type', Object.values(ALERT_TYPES));

    if (deleteError) {
      console.error('Error deleting old alerts:', deleteError);
    }

    // Insert new alerts
    if (alertsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('alerts')
        .insert(alertsToCreate);

      if (insertError) {
        console.error('Error inserting alerts:', insertError);
        throw insertError;
      }
    }

    console.log(`Created/updated ${alertsToCreate.length} alerts`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        alertsCreated: alertsToCreate.length,
        customersProcessed: customers?.length || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in calculate-alerts:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
