import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Alert type definitions
const ALERT_TYPES = {
  WAITING_RESPONSE: 'waiting_response',
  LONG_WAIT: 'long_wait',
  HOT_LEAD: 'hot_lead',
  OPEN_OBJECTION: 'open_objection',
  STALE_LEAD: 'stale_lead',
  INCOMPLETE_LEAD: 'incomplete_lead',
  // Manager-only alerts
  MANAGER_STALE_LEAD: 'manager_stale_lead',
  MANAGER_AT_RISK: 'manager_at_risk',
  MANAGER_SLOW_RESPONSE: 'manager_slow_response',
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

    // Fetch all active customers (pending or in_progress) with their latest messages and insights
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, seller_id, lead_status, is_incomplete, company_id')
      .in('lead_status', ['pending', 'in_progress']);

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    console.log(`Found ${customers?.length || 0} active customers`);

    const alertsToCreate: AlertData[] = [];
    const customerIdsToKeep = new Set<string>();

    for (const customer of customers || []) {
      if (!customer.seller_id) continue;

      const customerId = customer.id;
      const sellerId = customer.seller_id;

      // Fetch latest message for this customer
      const { data: lastMessage } = await supabase
        .from('messages')
        .select('id, direction, timestamp, content')
        .eq('customer_id', customerId)
        .eq('seller_id', sellerId)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Fetch latest insight
      const { data: messagesForInsight } = await supabase
        .from('messages')
        .select('id')
        .eq('customer_id', customerId)
        .eq('direction', 'incoming')
        .order('timestamp', { ascending: false })
        .limit(1);

      let latestInsight = null;
      if (messagesForInsight && messagesForInsight.length > 0) {
        const { data: insight } = await supabase
          .from('insights')
          .select('temperature, objection, created_at')
          .eq('message_id', messagesForInsight[0].id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        latestInsight = insight;
      }

      // Calculate alerts based on conditions

      // ALERT 1 & 2: Waiting response / Long wait
      if (lastMessage && lastMessage.direction === 'incoming') {
        const timeSinceMessage = now.getTime() - new Date(lastMessage.timestamp).getTime();
        const minutesWaiting = Math.floor(timeSinceMessage / 60000);

        if (timeSinceMessage >= THRESHOLDS.WAITING_RESPONSE) {
          customerIdsToKeep.add(`${customerId}-${ALERT_TYPES.WAITING_RESPONSE}`);
          
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
            alert_type: ALERT_TYPES.WAITING_RESPONSE,
            severity,
            message,
            metadata: { minutes_waiting: minutesWaiting, last_message_time: lastMessage.timestamp },
          });
        }
      }

      // ALERT 3: Hot lead
      if (latestInsight?.temperature === 'hot') {
        customerIdsToKeep.add(`${customerId}-${ALERT_TYPES.HOT_LEAD}`);
        alertsToCreate.push({
          customer_id: customerId,
          seller_id: sellerId,
          alert_type: ALERT_TYPES.HOT_LEAD,
          severity: 'info',
          message: 'Lead quente — oportunidade!',
          metadata: { temperature: 'hot' },
        });
      }

      // ALERT 4: Open objection
      if (latestInsight?.objection && latestInsight.objection !== 'none') {
        // Check if seller responded after the objection
        const insightTime = new Date(latestInsight.created_at);
        const { data: responseAfterObjection } = await supabase
          .from('messages')
          .select('id')
          .eq('customer_id', customerId)
          .eq('seller_id', sellerId)
          .eq('direction', 'outgoing')
          .gt('timestamp', insightTime.toISOString())
          .limit(1);

        if (!responseAfterObjection || responseAfterObjection.length === 0) {
          customerIdsToKeep.add(`${customerId}-${ALERT_TYPES.OPEN_OBJECTION}`);
          
          const objectionLabels: Record<string, string> = {
            price: 'Preço alto',
            delay: 'Prazo de entrega',
            trust: 'Falta de confiança',
            doubt: 'Dúvidas sobre o produto',
          };

          alertsToCreate.push({
            customer_id: customerId,
            seller_id: sellerId,
            alert_type: ALERT_TYPES.OPEN_OBJECTION,
            severity: 'warning',
            message: `Objeção aberta: ${objectionLabels[latestInsight.objection] || latestInsight.objection}`,
            metadata: { objection: latestInsight.objection },
          });
        }
      }

      // ALERT 5: Stale lead (24h without messages)
      if (lastMessage && customer.lead_status === 'in_progress') {
        const timeSinceLastMessage = now.getTime() - new Date(lastMessage.timestamp).getTime();
        if (timeSinceLastMessage >= THRESHOLDS.STALE_LEAD) {
          customerIdsToKeep.add(`${customerId}-${ALERT_TYPES.STALE_LEAD}`);
          const hoursStale = Math.floor(timeSinceLastMessage / (60 * 60 * 1000));
          alertsToCreate.push({
            customer_id: customerId,
            seller_id: sellerId,
            alert_type: ALERT_TYPES.STALE_LEAD,
            severity: 'warning',
            message: `Lead parado há ${hoursStale} horas`,
            metadata: { hours_stale: hoursStale },
          });
        }
      }

      // ALERT 6: Incomplete lead
      if (customer.is_incomplete) {
        customerIdsToKeep.add(`${customerId}-${ALERT_TYPES.INCOMPLETE_LEAD}`);
        alertsToCreate.push({
          customer_id: customerId,
          seller_id: sellerId,
          alert_type: ALERT_TYPES.INCOMPLETE_LEAD,
          severity: 'info',
          message: 'Lead incompleto — completar cadastro',
          metadata: { is_incomplete: true },
        });
      }
    }

    // Delete all existing alerts and insert new ones (atomic update)
    // First, get IDs of customers with alerts to delete
    const activeCustomerIds = customers?.map(c => c.id) || [];
    
    if (activeCustomerIds.length > 0) {
      // Delete alerts for active customers (will be recreated if conditions still apply)
      const { error: deleteError } = await supabase
        .from('alerts')
        .delete()
        .in('customer_id', activeCustomerIds)
        .in('alert_type', [
          ALERT_TYPES.WAITING_RESPONSE,
          ALERT_TYPES.HOT_LEAD,
          ALERT_TYPES.OPEN_OBJECTION,
          ALERT_TYPES.STALE_LEAD,
          ALERT_TYPES.INCOMPLETE_LEAD,
        ]);

      if (deleteError) {
        console.error('Error deleting old alerts:', deleteError);
      }
    }

    // Also delete alerts for completed leads
    const { error: deleteCompletedError } = await supabase
      .from('alerts')
      .delete()
      .not('customer_id', 'in', `(${activeCustomerIds.length > 0 ? activeCustomerIds.map(id => `'${id}'`).join(',') : "'00000000-0000-0000-0000-000000000000'"})`)
      .in('alert_type', [
        ALERT_TYPES.WAITING_RESPONSE,
        ALERT_TYPES.HOT_LEAD,
        ALERT_TYPES.OPEN_OBJECTION,
        ALERT_TYPES.STALE_LEAD,
        ALERT_TYPES.INCOMPLETE_LEAD,
      ]);

    // Insert new alerts using upsert
    if (alertsToCreate.length > 0) {
      const { error: insertError } = await supabase
        .from('alerts')
        .upsert(alertsToCreate, {
          onConflict: 'customer_id,seller_id,alert_type',
          ignoreDuplicates: false,
        });

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
