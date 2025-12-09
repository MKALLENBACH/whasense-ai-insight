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

    console.log('Fetching conversation history for user:', user.id);

    // Get user's profile to find their company
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!userProfile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User has no company', conversations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's role
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isManager = roleData?.role === 'manager';

    // Get customers based on role
    let customersQuery = supabase
      .from('customers')
      .select('*')
      .eq('company_id', userProfile.company_id)
      .order('updated_at', { ascending: false });

    // If seller, only show their customers
    if (!isManager) {
      customersQuery = customersQuery.eq('seller_id', user.id);
    }

    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    const conversationHistory = [];

    for (const customer of customers || []) {
      // Get latest message for this customer
      const { data: latestMessage } = await supabase
        .from('messages')
        .select('id, content, direction, timestamp, seller_id')
        .eq('customer_id', customer.id)
        .order('timestamp', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!latestMessage) continue;

      // Get seller profile
      const { data: sellerProfile } = await supabase
        .from('profiles')
        .select('name, email')
        .eq('user_id', latestMessage.seller_id)
        .maybeSingle();

      // Get all message IDs for this customer to find the latest insight
      const { data: customerMessages } = await supabase
        .from('messages')
        .select('id')
        .eq('customer_id', customer.id)
        .order('timestamp', { ascending: false });

      // Get latest insight for any message in this conversation
      let latestInsight = null;
      if (customerMessages && customerMessages.length > 0) {
        const messageIds = customerMessages.map(m => m.id);
        const { data: insights } = await supabase
          .from('insights')
          .select('*')
          .in('message_id', messageIds)
          .order('created_at', { ascending: false })
          .limit(1);
        
        if (insights && insights.length > 0) {
          latestInsight = insights[0];
        }
      }

      // Get sale result if exists
      const { data: sale } = await supabase
        .from('sales')
        .select('*')
        .eq('customer_id', customer.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Get message count
      const { count: messageCount } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', customer.id);

      conversationHistory.push({
        id: customer.id,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
        seller: sellerProfile ? {
          name: sellerProfile.name,
          email: sellerProfile.email,
        } : null,
        lastMessage: latestMessage.content,
        lastMessageTime: latestMessage.timestamp,
        messageCount: messageCount || 0,
        insight: latestInsight ? {
          sentiment: latestInsight.sentiment,
          intention: latestInsight.intention,
          objection: latestInsight.objection,
          temperature: latestInsight.temperature,
          suggestion: latestInsight.suggestion,
          next_action: latestInsight.next_action,
        } : null,
        sale: sale ? {
          id: sale.id,
          status: sale.status,
          reason: sale.reason,
          createdAt: sale.created_at,
        } : null,
      });
    }

    console.log(`Found ${conversationHistory.length} conversations`);

    return new Response(
      JSON.stringify({ conversations: conversationHistory }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in conversation-history:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
