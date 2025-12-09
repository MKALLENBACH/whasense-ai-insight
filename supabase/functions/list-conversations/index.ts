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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use anon client to validate the user's token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching conversations for seller:', user.id);

    // Get all customers that have messages with this seller
    const { data: messages, error: messagesError } = await supabase
      .from('messages')
      .select(`
        id,
        content,
        direction,
        timestamp,
        customer_id,
        customers (
          id,
          name,
          phone,
          email
        )
      `)
      .eq('seller_id', user.id)
      .order('timestamp', { ascending: false });

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    // Get all sales for this seller
    const { data: sales } = await supabase
      .from('sales')
      .select('customer_id, status')
      .eq('seller_id', user.id);

    const salesMap = new Map();
    for (const sale of sales || []) {
      salesMap.set(sale.customer_id, sale.status);
    }

    // Group messages by customer
    const conversationsMap = new Map();
    const customerMessageIds = new Map<string, string[]>();

    for (const message of messages || []) {
      const customerId = message.customer_id;
      
      if (!conversationsMap.has(customerId)) {
        conversationsMap.set(customerId, {
          id: customerId,
          customer: message.customers,
          lastMessage: message.content,
          lastMessageTime: message.timestamp,
          lastMessageDirection: message.direction,
          insight: null,
          messageCount: 1,
          hasRisk: false,
          saleStatus: salesMap.get(customerId) || null,
        });
        customerMessageIds.set(customerId, [message.id]);
      } else {
        conversationsMap.get(customerId).messageCount++;
        customerMessageIds.get(customerId)?.push(message.id);
      }
    }

    // Get the latest insight for each conversation (from incoming messages)
    for (const [customerId, messageIds] of customerMessageIds.entries()) {
      // Get the most recent insight from any message in this conversation
      const { data: insights } = await supabase
        .from('insights')
        .select('*')
        .in('message_id', messageIds)
        .order('created_at', { ascending: false })
        .limit(1);

      if (insights && insights.length > 0) {
        const insight = insights[0];
        const conv = conversationsMap.get(customerId);
        conv.insight = {
          sentiment: insight.sentiment,
          intention: insight.intention,
          objection: insight.objection,
          temperature: insight.temperature,
          suggestion: insight.suggestion,
          next_action: insight.next_action,
        };
        conv.hasRisk = insight.sentiment === 'angry' || 
                       insight.sentiment === 'negative' || 
                       (insight.objection && insight.objection !== 'none');
      }
    }

    const conversations = Array.from(conversationsMap.values());

    console.log(`Found ${conversations.length} conversations`);

    return new Response(
      JSON.stringify({ conversations }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in list-conversations:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
