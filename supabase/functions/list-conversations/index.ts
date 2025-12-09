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

    // Get user role and company
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isManager = roleData?.role === 'manager';

    const { data: profileData } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    const companyId = profileData?.company_id;

    // Get all customers that have messages with this seller (or all for manager)
    let messagesQuery = supabase
      .from('messages')
      .select(`
        id,
        content,
        direction,
        timestamp,
        customer_id,
        seller_id,
        customers (
          id,
          name,
          phone,
          email,
          lead_status,
          seller_id,
          is_incomplete,
          company_id
        )
      `)
      .order('timestamp', { ascending: false });

    if (!isManager) {
      messagesQuery = messagesQuery.eq('seller_id', user.id);
    }

    const { data: messages, error: messagesError } = await messagesQuery;

    if (messagesError) {
      console.error('Error fetching messages:', messagesError);
      throw messagesError;
    }

    // Get all sales for this seller (or all for manager in company)
    let salesQuery = supabase
      .from('sales')
      .select('customer_id, status, reason');

    if (!isManager) {
      salesQuery = salesQuery.eq('seller_id', user.id);
    }

    const { data: sales } = await salesQuery;

    const salesMap = new Map();
    for (const sale of sales || []) {
      salesMap.set(sale.customer_id, { status: sale.status, reason: sale.reason });
    }

    // Get company names
    const { data: companiesData } = await supabase
      .from('companies')
      .select('id, name');
    
    const companiesMap = new Map(companiesData?.map(c => [c.id, c.name]) || []);

    // Group messages by customer
    const conversationsMap = new Map();
    const customerMessageIds = new Map<string, string[]>();

    for (const message of messages || []) {
      const customerId = message.customer_id;
      const customer = message.customers as any;
      
      // Skip if no customer data
      if (!customer) continue;
      
      if (!conversationsMap.has(customerId)) {
        const saleInfo = salesMap.get(customerId);
        conversationsMap.set(customerId, {
          id: customerId,
          customer: {
            ...customer,
            lead_status: customer.lead_status || 'pending',
            is_incomplete: customer.is_incomplete || false,
            companyName: customer.company_id ? companiesMap.get(customer.company_id) : null,
          },
          lastMessage: message.content,
          lastMessageTime: message.timestamp,
          lastMessageDirection: message.direction,
          sellerId: message.seller_id,
          insight: null,
          messageCount: 1,
          hasRisk: false,
          saleStatus: saleInfo?.status || null,
          saleReason: saleInfo?.reason || null,
          leadStatus: customer.lead_status || 'pending',
          isIncomplete: customer.is_incomplete || false,
        });
        customerMessageIds.set(customerId, [message.id]);
      } else {
        conversationsMap.get(customerId).messageCount++;
        customerMessageIds.get(customerId)?.push(message.id);
      }
    }

    // Filter by company for manager
    let filteredConversations = Array.from(conversationsMap.values());
    
    if (isManager && companyId) {
      // For managers, we need to filter by company - get customers with company_id
      const { data: companyCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', companyId);
      
      const companyCustomerIds = new Set(companyCustomers?.map(c => c.id) || []);
      filteredConversations = filteredConversations.filter(c => companyCustomerIds.has(c.id));
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
        if (conv) {
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
    }

    // Get seller names for manager view
    if (isManager) {
      const sellerIds = [...new Set(filteredConversations.map(c => c.sellerId))];
      const { data: sellers } = await supabase
        .from('profiles')
        .select('user_id, name')
        .in('user_id', sellerIds);

      const sellerMap = new Map(sellers?.map(s => [s.user_id, s.name]) || []);
      
      filteredConversations = filteredConversations.map(c => ({
        ...c,
        sellerName: sellerMap.get(c.sellerId) || 'Vendedor',
      }));
    }

    // Sort: incomplete leads first, then by last message time
    filteredConversations.sort((a, b) => {
      // Incomplete leads first
      if (a.isIncomplete && !b.isIncomplete) return -1;
      if (!a.isIncomplete && b.isIncomplete) return 1;
      // Then by last message time (most recent first)
      return new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime();
    });

    console.log(`Found ${filteredConversations.length} conversations`);

    return new Response(
      JSON.stringify({ conversations: filteredConversations }),
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
