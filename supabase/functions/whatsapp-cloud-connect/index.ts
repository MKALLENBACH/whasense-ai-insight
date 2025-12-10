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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Get user from auth header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user's company
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: 'Company not found' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    console.log(`[WHATSAPP-CLOUD-CONNECT] Action: ${action}, User: ${user.id}`);

    if (action === 'connect') {
      const { phone_number_id, whatsapp_business_account_id, access_token, verification_token } = body;

      if (!phone_number_id || !whatsapp_business_account_id || !access_token || !verification_token) {
        return new Response(JSON.stringify({ error: 'Missing required fields' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate the access token by fetching phone number info
      console.log('[WHATSAPP-CLOUD-CONNECT] Validating access token...');
      
      try {
        const phoneInfoResponse = await fetch(
          `https://graph.facebook.com/v17.0/${phone_number_id}?fields=display_phone_number,verified_name`,
          {
            headers: {
              'Authorization': `Bearer ${access_token}`,
            },
          }
        );

        if (!phoneInfoResponse.ok) {
          const errorData = await phoneInfoResponse.json();
          console.error('[WHATSAPP-CLOUD-CONNECT] Token validation failed:', errorData);
          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Token inválido ou Phone Number ID incorreto' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const phoneInfo = await phoneInfoResponse.json();
        console.log('[WHATSAPP-CLOUD-CONNECT] Phone info:', phoneInfo);

        // Subscribe to webhooks
        console.log('[WHATSAPP-CLOUD-CONNECT] Subscribing to webhooks...');
        const subscribeResponse = await fetch(
          `https://graph.facebook.com/v17.0/${whatsapp_business_account_id}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${access_token}`,
            },
          }
        );

        if (!subscribeResponse.ok) {
          const errorData = await subscribeResponse.json();
          console.error('[WHATSAPP-CLOUD-CONNECT] Webhook subscription failed:', errorData);
          // Continue anyway - might already be subscribed
        }

        // Upsert the integration
        const { data, error: upsertError } = await supabase
          .from('whatsapp_seller_integrations')
          .upsert({
            seller_id: user.id,
            company_id: profile.company_id,
            phone_number_id,
            whatsapp_business_account_id,
            access_token,
            verification_token,
            display_phone_number: phoneInfo.display_phone_number || null,
            status: 'connected',
            last_error: null,
          }, {
            onConflict: 'seller_id',
          })
          .select()
          .single();

        if (upsertError) {
          console.error('[WHATSAPP-CLOUD-CONNECT] Upsert error:', upsertError);
          throw upsertError;
        }

        console.log('[WHATSAPP-CLOUD-CONNECT] Integration saved successfully');

        return new Response(JSON.stringify({ 
          success: true, 
          integration: {
            id: data.id,
            status: data.status,
            display_phone_number: data.display_phone_number,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (fetchError) {
        console.error('[WHATSAPP-CLOUD-CONNECT] Fetch error:', fetchError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Erro ao validar credenciais com a Meta' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (action === 'test') {
      // Get existing integration
      const { data: integration } = await supabase
        .from('whatsapp_seller_integrations')
        .select('*')
        .eq('seller_id', user.id)
        .single();

      if (!integration) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Integração não encontrada' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const testResponse = await fetch(
          `https://graph.facebook.com/v17.0/${integration.phone_number_id}?fields=display_phone_number`,
          {
            headers: {
              'Authorization': `Bearer ${integration.access_token}`,
            },
          }
        );

        if (!testResponse.ok) {
          await supabase
            .from('whatsapp_seller_integrations')
            .update({ status: 'error', last_error: 'Token expirado ou inválido' })
            .eq('id', integration.id);

          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Token expirado ou inválido' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await supabase
          .from('whatsapp_seller_integrations')
          .update({ status: 'connected', last_error: null })
          .eq('id', integration.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('[WHATSAPP-CLOUD-CONNECT] Test error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Erro ao testar conexão' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[WHATSAPP-CLOUD-CONNECT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
