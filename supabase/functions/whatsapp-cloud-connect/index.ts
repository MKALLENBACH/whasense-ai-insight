import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * WhatsApp Cloud API Connection Manager
 * 
 * Handles:
 * - Connect: Validate credentials and save to company_whatsapp_settings
 * - Test: Verify existing connection is still valid
 * - Disconnect: Remove WhatsApp settings
 * 
 * Only managers can access this endpoint.
 */

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Validate JWT
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

    // Get user's company and role
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    if (!profile?.company_id) {
      return new Response(JSON.stringify({ error: 'Empresa não encontrada' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check if user is manager
    const { data: userRole } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userRole?.role !== 'manager' && userRole?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Apenas gestores podem configurar o WhatsApp' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { action } = body;

    console.log(`[WHATSAPP-CONNECT] Action: ${action}, User: ${user.id}, Company: ${profile.company_id}`);

    // ========================================
    // ACTION: CONNECT
    // ========================================
    if (action === 'connect') {
      const { phone_number_id, waba_id, permanent_token, verification_token } = body;

      if (!phone_number_id || !waba_id || !permanent_token || !verification_token) {
        return new Response(JSON.stringify({ error: 'Todos os campos são obrigatórios' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Validate the access token by fetching phone number info (v19.0 as per spec)
      console.log('[WHATSAPP-CONNECT] Validating access token with Meta API v19.0...');
      
      try {
        const phoneInfoResponse = await fetch(
          `https://graph.facebook.com/v19.0/${phone_number_id}?fields=display_phone_number,verified_name`,
          {
            headers: {
              'Authorization': `Bearer ${permanent_token}`,
            },
          }
        );

        if (!phoneInfoResponse.ok) {
          const errorData = await phoneInfoResponse.json();
          console.error('[WHATSAPP-CONNECT] Token validation failed:', errorData);
          return new Response(JSON.stringify({ 
            success: false, 
            error: errorData.error?.message || 'Token inválido ou Phone Number ID incorreto' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const phoneInfo = await phoneInfoResponse.json();
        console.log('[WHATSAPP-CONNECT] Phone info:', phoneInfo);

        // Subscribe app to WABA webhooks
        console.log('[WHATSAPP-CONNECT] Subscribing to webhooks...');
        const subscribeResponse = await fetch(
          `https://graph.facebook.com/v19.0/${waba_id}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${permanent_token}`,
            },
          }
        );

        if (!subscribeResponse.ok) {
          const errorData = await subscribeResponse.json();
          console.warn('[WHATSAPP-CONNECT] Webhook subscription warning:', errorData);
          // Continue - might already be subscribed via Whasense app
        } else {
          console.log('[WHATSAPP-CONNECT] Webhook subscription successful');
        }

        // Upsert company WhatsApp settings
        const { data, error: upsertError } = await supabase
          .from('company_whatsapp_settings')
          .upsert({
            company_id: profile.company_id,
            waba_id,
            phone_number_id,
            permanent_token,
            verification_token,
            display_phone_number: phoneInfo.display_phone_number || null,
            status: 'connected',
            last_check: new Date().toISOString(),
            last_error: null,
          }, {
            onConflict: 'company_id',
          })
          .select()
          .single();

        if (upsertError) {
          console.error('[WHATSAPP-CONNECT] Upsert error:', upsertError);
          throw upsertError;
        }

        console.log('[WHATSAPP-CONNECT] Connection saved successfully');

        return new Response(JSON.stringify({ 
          success: true, 
          settings: {
            id: data.id,
            status: data.status,
            display_phone_number: data.display_phone_number,
          }
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (fetchError) {
        console.error('[WHATSAPP-CONNECT] Fetch error:', fetchError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Erro ao validar credenciais com a Meta' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========================================
    // ACTION: TEST
    // ========================================
    if (action === 'test') {
      const { data: settings } = await supabase
        .from('company_whatsapp_settings')
        .select('*')
        .eq('company_id', profile.company_id)
        .single();

      if (!settings) {
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'WhatsApp não configurado' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      try {
        const testResponse = await fetch(
          `https://graph.facebook.com/v19.0/${settings.phone_number_id}?fields=display_phone_number`,
          {
            headers: {
              'Authorization': `Bearer ${settings.permanent_token}`,
            },
          }
        );

        if (!testResponse.ok) {
          await supabase
            .from('company_whatsapp_settings')
            .update({ 
              status: 'error', 
              last_error: 'Token expirado ou inválido',
              last_check: new Date().toISOString()
            })
            .eq('id', settings.id);

          return new Response(JSON.stringify({ 
            success: false, 
            error: 'Token expirado ou inválido' 
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        await supabase
          .from('company_whatsapp_settings')
          .update({ 
            status: 'connected', 
            last_error: null,
            last_check: new Date().toISOString()
          })
          .eq('id', settings.id);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });

      } catch (error) {
        console.error('[WHATSAPP-CONNECT] Test error:', error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Erro ao testar conexão' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // ========================================
    // ACTION: DISCONNECT
    // ========================================
    if (action === 'disconnect') {
      const { error: deleteError } = await supabase
        .from('company_whatsapp_settings')
        .delete()
        .eq('company_id', profile.company_id);

      if (deleteError) {
        console.error('[WHATSAPP-CONNECT] Disconnect error:', deleteError);
        return new Response(JSON.stringify({ 
          success: false, 
          error: 'Erro ao desconectar' 
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Ação inválida' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[WHATSAPP-CONNECT] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
