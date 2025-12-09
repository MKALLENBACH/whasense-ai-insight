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

    // Get the authorization header to identify the user
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Extract the JWT token from the header
    const token = authHeader.replace('Bearer ', '');

    // Use service role client with getUser(token) to validate the user
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // supabase client already created above with service role

    console.log('Fetching conversations for seller:', user.id);

    // Get user role and company in parallel
    const [roleResult, profileResult] = await Promise.all([
      supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle(),
    ]);

    const isManager = roleResult.data?.role === 'manager';
    const companyId = profileResult.data?.company_id;

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
        cycle_id,
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

    // Get all customer IDs from messages
    const customerIds = [...new Set((messages || []).map(m => m.customer_id).filter(Boolean))];

    // Fetch all active sale_cycles for these customers (status pending or in_progress)
    // AND all cycles to know the current cycle status
    const { data: allCycles } = await supabase
      .from('sale_cycles')
      .select('id, customer_id, seller_id, status, created_at, closed_at, lost_reason, won_summary')
      .in('customer_id', customerIds.length > 0 ? customerIds : [''])
      .order('created_at', { ascending: false });

    // Build a map of customer_id -> most recent cycle (active or last closed)
    const customerCycleMap = new Map<string, {
      id: string;
      status: string;
      created_at: string;
      closed_at: string | null;
      lost_reason: string | null;
      won_summary: string | null;
    }>();

    for (const cycle of allCycles || []) {
      // Only keep the most recent cycle per customer
      if (!customerCycleMap.has(cycle.customer_id)) {
        customerCycleMap.set(cycle.customer_id, {
          id: cycle.id,
          status: cycle.status,
          created_at: cycle.created_at,
          closed_at: cycle.closed_at,
          lost_reason: cycle.lost_reason,
          won_summary: cycle.won_summary,
        });
      }
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
        const cycleInfo = customerCycleMap.get(customerId);
        // Use cycle status if available, otherwise fallback to customer lead_status
        const currentStatus = cycleInfo?.status || customer.lead_status || 'pending';
        
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
          // Use cycle status for filtering tabs
          cycleStatus: currentStatus,
          cycleId: cycleInfo?.id || null,
          cycleLostReason: cycleInfo?.lost_reason || null,
          cycleWonSummary: cycleInfo?.won_summary || null,
          // Keep leadStatus for backward compatibility but use cycleStatus for tabs
          leadStatus: currentStatus,
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

    // Get the latest insight for each conversation (batch query)
    const allMessageIds = Array.from(customerMessageIds.values()).flat();
    
    if (allMessageIds.length > 0) {
      const { data: allInsights } = await supabase
        .from('insights')
        .select('*')
        .in('message_id', allMessageIds)
        .order('created_at', { ascending: false });

      // Build a map of message_id -> insight
      const insightsByMessage = new Map<string, any>();
      for (const insight of allInsights || []) {
        if (!insightsByMessage.has(insight.message_id)) {
          insightsByMessage.set(insight.message_id, insight);
        }
      }

      // For each customer, find the most recent insight from any of their messages
      for (const [customerId, messageIds] of customerMessageIds.entries()) {
        let latestInsight = null;
        for (const msgId of messageIds) {
          const insight = insightsByMessage.get(msgId);
          if (insight) {
            latestInsight = insight;
            break; // Already sorted by created_at desc, so first match is the latest
          }
        }

        if (latestInsight) {
          const conv = conversationsMap.get(customerId);
          if (conv) {
            conv.insight = {
              sentiment: latestInsight.sentiment,
              intention: latestInsight.intention,
              objection: latestInsight.objection,
              temperature: latestInsight.temperature,
              suggestion: latestInsight.suggestion,
              next_action: latestInsight.next_action,
            };
            conv.hasRisk = latestInsight.sentiment === 'angry' || 
                           latestInsight.sentiment === 'negative' || 
                           (latestInsight.objection && latestInsight.objection !== 'none');
          }
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
