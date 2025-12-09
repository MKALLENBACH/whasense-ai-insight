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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    // Group messages by customer and get the latest insight for each
    const conversationsMap = new Map();

    for (const message of messages || []) {
      const customerId = message.customer_id;
      
      if (!conversationsMap.has(customerId)) {
        // Get the latest insight for this customer's messages
        const { data: insight } = await supabase
          .from('insights')
          .select('*')
          .eq('message_id', message.id)
          .maybeSingle();

        conversationsMap.set(customerId, {
          id: customerId,
          customer: message.customers,
          lastMessage: message.content,
          lastMessageTime: message.timestamp,
          lastMessageDirection: message.direction,
          insight: insight ? {
            sentiment: insight.sentiment,
            intention: insight.intention,
            objection: insight.objection,
            temperature: insight.temperature,
            suggestion: insight.suggestion,
            next_action: insight.next_action,
          } : null,
          messageCount: 1,
          hasRisk: insight?.sentiment === 'angry' || insight?.sentiment === 'negative' || insight?.objection !== 'none',
        });
      } else {
        conversationsMap.get(customerId).messageCount++;
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
