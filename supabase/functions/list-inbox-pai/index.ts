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
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile to get company_id
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'User has no company' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[LIST-INBOX-PAI] Fetching unassigned leads for company:', profile.company_id);

    // Get operation settings for ordering preference
    const { data: settings } = await supabase
      .from('manager_operation_settings')
      .select('inbox_ordering')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    const ordering = settings?.inbox_ordering || 'last_message';

    // Get all unassigned customers in the company
    const { data: unassignedCustomers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, phone, email, created_at, lead_status')
      .eq('company_id', profile.company_id)
      .is('assigned_to', null)
      .in('lead_status', ['pending', 'in_progress'])
      .limit(500);

    if (customersError) {
      console.error('[LIST-INBOX-PAI] Error fetching customers:', customersError);
      throw customersError;
    }

    if (!unassignedCustomers || unassignedCustomers.length === 0) {
      return new Response(
        JSON.stringify({ leads: [] }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const customerIds = unassignedCustomers.map(c => c.id);

    // Get latest message for each customer
    const { data: messages } = await supabase
      .from('messages')
      .select('customer_id, content, timestamp, direction')
      .in('customer_id', customerIds)
      .order('timestamp', { ascending: false });

    // Group messages by customer
    const customerMessages = new Map<string, { 
      lastMessage: string; 
      lastMessageTime: string; 
      messageCount: number;
      firstMessageTime: string;
    }>();

    for (const msg of messages || []) {
      const existing = customerMessages.get(msg.customer_id);
      if (existing) {
        existing.messageCount++;
        // Track first message time for "time without response" ordering
        if (new Date(msg.timestamp) < new Date(existing.firstMessageTime)) {
          existing.firstMessageTime = msg.timestamp;
        }
      } else {
        customerMessages.set(msg.customer_id, {
          lastMessage: msg.content,
          lastMessageTime: msg.timestamp,
          messageCount: 1,
          firstMessageTime: msg.timestamp,
        });
      }
    }

    // Build leads array
    let leads = unassignedCustomers
      .filter(c => customerMessages.has(c.id))
      .map(customer => {
        const msgInfo = customerMessages.get(customer.id)!;
        const createdAt = new Date(customer.created_at);
        const now = new Date();
        const waitingMs = now.getTime() - createdAt.getTime();
        const waitingMinutes = Math.floor(waitingMs / (1000 * 60));
        const waitingHours = Math.floor(waitingMinutes / 60);
        const waitingDays = Math.floor(waitingHours / 24);

        let waitingTime = '';
        if (waitingDays > 0) {
          waitingTime = `${waitingDays}d`;
        } else if (waitingHours > 0) {
          waitingTime = `${waitingHours}h`;
        } else {
          waitingTime = `${waitingMinutes}m`;
        }

        return {
          id: customer.id,
          customer: {
            id: customer.id,
            name: customer.name,
            phone: customer.phone,
          },
          lastMessage: msgInfo.lastMessage,
          lastMessageTime: msgInfo.lastMessageTime,
          messageCount: msgInfo.messageCount,
          waitingTime,
          createdAt: customer.created_at,
          firstMessageTime: msgInfo.firstMessageTime,
        };
      });

    // Sort based on ordering preference
    switch (ordering) {
      case 'time_without_response':
        // Oldest first message first (waiting longest)
        leads.sort((a, b) => 
          new Date(a.firstMessageTime).getTime() - new Date(b.firstMessageTime).getTime()
        );
        break;
      case 'newest':
        // Newest created first
        leads.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        break;
      case 'last_message':
      default:
        // Most recent message first
        leads.sort((a, b) => 
          new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime()
        );
        break;
    }

    console.log(`[LIST-INBOX-PAI] Found ${leads.length} unassigned leads`);

    return new Response(
      JSON.stringify({ leads }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[LIST-INBOX-PAI] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});