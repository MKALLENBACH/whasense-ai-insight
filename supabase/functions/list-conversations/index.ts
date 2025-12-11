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

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      console.error('Auth error:', authError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Fetching conversations for user:', user.id);

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

    if (!companyId) {
      return new Response(
        JSON.stringify({ conversations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // CORREÇÃO: Para vendedor, buscar apenas customers onde assigned_to = user.id
    // Para gestor, buscar todos os customers da empresa com assigned_to != null
    let customersQuery = supabase
      .from('customers')
      .select('id, name, phone, email, lead_status, seller_id, assigned_to, is_incomplete, company_id, client_id')
      .eq('company_id', companyId)
      .not('assigned_to', 'is', null) // CRÍTICO: Só mostra leads atribuídos
      .limit(500);

    if (!isManager) {
      // Vendedor vê apenas seus leads atribuídos
      customersQuery = customersQuery.eq('assigned_to', user.id);
    }

    const { data: customers, error: customersError } = await customersQuery;

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      throw customersError;
    }

    if (!customers || customers.length === 0) {
      return new Response(
        JSON.stringify({ conversations: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerIds = customers.map(c => c.id);

    // Get messages for these customers
    const { data: messages } = await supabase
      .from('messages')
      .select('id, content, direction, timestamp, customer_id, seller_id, cycle_id')
      .in('customer_id', customerIds)
      .order('timestamp', { ascending: false })
      .limit(2000);

    // Fetch all sale_cycles for these customers
    const { data: allCycles } = await supabase
      .from('sale_cycles')
      .select('id, customer_id, seller_id, status, cycle_type, created_at, closed_at, lost_reason, won_summary')
      .in('customer_id', customerIds)
      .order('created_at', { ascending: false });

    // Build a map of customer_id -> most recent cycle
    const customerCycleMap = new Map<string, {
      id: string;
      status: string;
      cycle_type: string;
      created_at: string;
      closed_at: string | null;
      lost_reason: string | null;
      won_summary: string | null;
    }>();

    for (const cycle of allCycles || []) {
      if (!customerCycleMap.has(cycle.customer_id)) {
        customerCycleMap.set(cycle.customer_id, {
          id: cycle.id,
          status: cycle.status,
          cycle_type: cycle.cycle_type || 'pre_sale',
          created_at: cycle.created_at,
          closed_at: cycle.closed_at,
          lost_reason: cycle.lost_reason,
          won_summary: cycle.won_summary,
        });
      }
    }

    // Get client company names
    const clientIds = [...new Set(customers.map(c => c.client_id).filter(Boolean))];

    let clientsMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from('clients')
        .select('id, name')
        .in('id', clientIds);
      
      clientsMap = new Map(clientsData?.map(c => [c.id, c.name]) || []);
    }

    // Group messages by customer
    const customerMessagesMap = new Map<string, {
      lastMessage: string;
      lastMessageTime: string;
      lastMessageDirection: string;
      messageCount: number;
      messageIds: string[];
    }>();

    for (const message of messages || []) {
      const customerId = message.customer_id;
      const existing = customerMessagesMap.get(customerId);
      
      if (existing) {
        existing.messageCount++;
        existing.messageIds.push(message.id);
      } else {
        customerMessagesMap.set(customerId, {
          lastMessage: message.content,
          lastMessageTime: message.timestamp,
          lastMessageDirection: message.direction,
          messageCount: 1,
          messageIds: [message.id],
        });
      }
    }

    // Build conversations array
    const conversationsMap = new Map();

    for (const customer of customers) {
      const msgInfo = customerMessagesMap.get(customer.id);
      if (!msgInfo) continue; // Skip customers with no messages

      const cycleInfo = customerCycleMap.get(customer.id);
      const currentStatus = cycleInfo?.status || customer.lead_status || 'pending';
      const cycleType = cycleInfo?.cycle_type || 'pre_sale';

      conversationsMap.set(customer.id, {
        id: customer.id,
        customer: {
          id: customer.id,
          name: customer.name,
          phone: customer.phone,
          email: customer.email,
          lead_status: customer.lead_status || 'pending',
          is_incomplete: customer.is_incomplete || false,
          companyName: customer.client_id ? clientsMap.get(customer.client_id) : null,
        },
        lastMessage: msgInfo.lastMessage,
        lastMessageTime: msgInfo.lastMessageTime,
        lastMessageDirection: msgInfo.lastMessageDirection,
        sellerId: customer.assigned_to || customer.seller_id,
        insight: null,
        messageCount: msgInfo.messageCount,
        hasRisk: false,
        cycleStatus: currentStatus,
        cycleType: cycleType,
        cycleId: cycleInfo?.id || null,
        cycleLostReason: cycleInfo?.lost_reason || null,
        cycleWonSummary: cycleInfo?.won_summary || null,
        leadStatus: currentStatus,
        isIncomplete: customer.is_incomplete || false,
      });
    }

    // Get insights for messages
    const allMessageIds = Array.from(customerMessagesMap.values()).flatMap(m => m.messageIds);
    
    if (allMessageIds.length > 0) {
      const { data: allInsights } = await supabase
        .from('insights')
        .select('*')
        .in('message_id', allMessageIds)
        .order('created_at', { ascending: false });

      const insightsByMessage = new Map<string, any>();
      for (const insight of allInsights || []) {
        if (!insightsByMessage.has(insight.message_id)) {
          insightsByMessage.set(insight.message_id, insight);
        }
      }

      // Find latest insight for each customer
      for (const [customerId, msgInfo] of customerMessagesMap.entries()) {
        let latestInsight = null;
        for (const msgId of msgInfo.messageIds) {
          const insight = insightsByMessage.get(msgId);
          if (insight) {
            latestInsight = insight;
            break;
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

    let filteredConversations = Array.from(conversationsMap.values());

    // Get seller names for manager view
    if (isManager) {
      const sellerIds = [...new Set(filteredConversations.map(c => c.sellerId).filter(Boolean))];
      if (sellerIds.length > 0) {
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
    }

    // Sort: incomplete leads first, then by last message time
    filteredConversations.sort((a, b) => {
      if (a.isIncomplete && !b.isIncomplete) return -1;
      if (!a.isIncomplete && b.isIncomplete) return 1;
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
