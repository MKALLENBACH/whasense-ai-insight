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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use anon client to validate the user's token
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Use service role client for database operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is a manager
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleData?.role !== 'manager') {
      return new Response(JSON.stringify({ error: 'Unauthorized: Manager role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get manager's company_id
    const { data: managerProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!managerProfile?.company_id) {
      return new Response(JSON.stringify({ error: 'Manager has no company' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'list-sessions': {
        // Get all sellers from the same company with their WhatsApp sessions
        const { data: companySellers } = await supabase
          .from('profiles')
          .select(`
            user_id,
            name,
            email
          `)
          .eq('company_id', managerProfile.company_id);

        if (!companySellers || companySellers.length === 0) {
          return new Response(JSON.stringify({ sessions: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get sessions for these sellers
        const sellerIds = companySellers.map(s => s.user_id);
        const { data: sessions } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .in('seller_id', sellerIds);

        // Merge seller info with session info
        const sessionsWithSellers = companySellers.map(seller => {
          const session = sessions?.find(s => s.seller_id === seller.user_id);
          return {
            sellerId: seller.user_id,
            sellerName: seller.name,
            sellerEmail: seller.email,
            sessionId: session?.id || null,
            status: session?.status || 'disconnected',
            isActive: session?.is_active || false,
            phoneNumber: session?.phone_number || null,
            lastConnectedAt: session?.last_connected_at || null,
            hasSession: !!session,
          };
        });

        // Filter to only show sellers (not managers)
        const { data: sellerRoles } = await supabase
          .from('user_roles')
          .select('user_id, role')
          .in('user_id', sellerIds)
          .eq('role', 'seller');

        const sellerUserIds = new Set(sellerRoles?.map(r => r.user_id) || []);
        const filteredSessions = sessionsWithSellers.filter(s => sellerUserIds.has(s.sellerId));

        return new Response(JSON.stringify({ sessions: filteredSessions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'force-reconnect': {
        const body = await req.json();
        const { sellerId } = body;

        if (!sellerId) {
          return new Response(JSON.stringify({ error: 'Seller ID required' }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Verify seller belongs to manager's company
        const { data: sellerProfile } = await supabase
          .from('profiles')
          .select('company_id')
          .eq('user_id', sellerId)
          .single();

        if (sellerProfile?.company_id !== managerProfile.company_id) {
          return new Response(JSON.stringify({ error: 'Seller not in your company' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Update session to trigger reconnect
        await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'pending',
            is_active: false,
            expires_at: new Date(Date.now() + 2 * 60 * 1000).toISOString(),
          })
          .eq('seller_id', sellerId);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
  } catch (error) {
    console.error('Error in whatsapp-manager:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
