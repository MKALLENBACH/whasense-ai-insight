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
    const startTime = Date.now();
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

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

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Fetching conversation history for user:', user.id);

    // Parallel fetch: user profile and role
    const [profileResult, roleResult] = await Promise.all([
      supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle()
    ]);

    const userProfile = profileResult.data;
    const roleData = roleResult.data;

    if (!userProfile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User has no company', conversations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isManager = roleData?.role === 'manager';

    // Get customers based on role
    let customersQuery = supabase
      .from('customers')
      .select('id, name, phone, email, seller_id, lead_status, client_id')
      .eq('company_id', userProfile.company_id)
      .order('updated_at', { ascending: false });

    if (!isManager) {
      customersQuery = customersQuery.eq('seller_id', user.id);
    }

    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    if (!customers || customers.length === 0) {
      console.log('No customers found');
      return new Response(
        JSON.stringify({ conversations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get client IDs for company names
    const clientIds = [...new Set(customers.map(c => c.client_id).filter(Boolean))];
    
    // Fetch client names if there are any
    let clientsMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clients } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);
      
      if (clients) {
        clientsMap = new Map(clients.map(c => [c.id, c.name]));
      }
    }

    const customerIds = customers.map(c => c.id);
    const sellerIds = [...new Set(customers.map(c => c.seller_id).filter(Boolean))];

    // Parallel batch queries for all data
    const [messagesResult, sellerProfilesResult, salesResult] = await Promise.all([
      // Get all messages for all customers (with row number to get latest per customer)
      supabase
        .from('messages')
        .select('id, content, direction, timestamp, customer_id, seller_id')
        .in('customer_id', customerIds)
        .order('timestamp', { ascending: false }),
      
      // Get all seller profiles in one query
      supabase
        .from('profiles')
        .select('user_id, name, email')
        .in('user_id', sellerIds),
      
      // Get all sales for all customers
      supabase
        .from('sales')
        .select('id, status, reason, created_at, customer_id')
        .in('customer_id', customerIds)
        .order('created_at', { ascending: false })
    ]);

    const allMessages = messagesResult.data || [];
    const sellerProfiles = sellerProfilesResult.data || [];
    const allSales = salesResult.data || [];

    // Get message IDs for insights query
    const messageIds = allMessages.map(m => m.id);
    
    // Get all insights in one query
    const { data: allInsights } = await supabase
      .from('insights')
      .select('id, message_id, sentiment, intention, objection, temperature, suggestion, next_action, created_at')
      .in('message_id', messageIds)
      .order('created_at', { ascending: false });

    // Create lookup maps for O(1) access
    const sellerProfileMap = new Map(sellerProfiles.map(p => [p.user_id, p]));
    
    // Group messages by customer
    const messagesByCustomer = new Map<string, typeof allMessages>();
    for (const msg of allMessages) {
      if (!messagesByCustomer.has(msg.customer_id)) {
        messagesByCustomer.set(msg.customer_id, []);
      }
      messagesByCustomer.get(msg.customer_id)!.push(msg);
    }

    // Group sales by customer (get latest)
    const salesByCustomer = new Map<string, typeof allSales[0]>();
    for (const sale of allSales) {
      if (!salesByCustomer.has(sale.customer_id)) {
        salesByCustomer.set(sale.customer_id, sale);
      }
    }

    // Define insight type
    type InsightData = {
      id: string;
      message_id: string;
      sentiment: string | null;
      intention: string | null;
      objection: string | null;
      temperature: string | null;
      suggestion: string | null;
      next_action: string | null;
      created_at: string;
    };

    // Group insights by message_id
    const insightsByMessage = new Map<string, InsightData>();
    for (const insight of (allInsights || []) as InsightData[]) {
      if (!insightsByMessage.has(insight.message_id)) {
        insightsByMessage.set(insight.message_id, insight);
      }
    }

    // Build conversation history
    const conversationHistory = [];

    for (const customer of customers) {
      const customerMessages = messagesByCustomer.get(customer.id) || [];
      if (customerMessages.length === 0) continue;

      const latestMessage = customerMessages[0]; // Already sorted by timestamp desc
      const sellerProfile = customer.seller_id ? sellerProfileMap.get(customer.seller_id) : null;
      const sale = salesByCustomer.get(customer.id) || null;

      // Find latest insight from any message in this conversation
      let latestInsight = null;
      for (const msg of customerMessages) {
        const insight = insightsByMessage.get(msg.id);
        if (insight) {
          latestInsight = insight;
          break; // First one is latest due to sorting
        }
      }

      conversationHistory.push({
        id: customer.id,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
        },
        clientName: customer.client_id ? clientsMap.get(customer.client_id) || null : null,
        seller: sellerProfile ? {
          name: sellerProfile.name,
          email: sellerProfile.email,
        } : null,
        lastMessage: latestMessage.content,
        lastMessageTime: latestMessage.timestamp,
        messageCount: customerMessages.length,
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

    const duration = Date.now() - startTime;
    console.log(`Found ${conversationHistory.length} conversations in ${duration}ms`);

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
