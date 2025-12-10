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

    const body = await req.json();
    const { to, message, customer_id, cycle_id, template_name, template_language, template_components } = body;

    console.log('[WHATSAPP-CLOUD-SEND] Request:', { to, customer_id, hasMessage: !!message });

    // Get seller's integration
    const { data: integration, error: integrationError } = await supabase
      .from('whatsapp_seller_integrations')
      .select('*')
      .eq('seller_id', user.id)
      .eq('status', 'connected')
      .maybeSingle();

    if (integrationError || !integration) {
      console.log('[WHATSAPP-CLOUD-SEND] No active integration for seller:', user.id);
      return new Response(JSON.stringify({ 
        error: 'WhatsApp não conectado. Configure sua integração em Configurações > WhatsApp.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build the message payload
    let messagePayload: any = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''), // Remove non-digits
    };

    if (template_name) {
      // Send template message
      messagePayload.type = 'template';
      messagePayload.template = {
        name: template_name,
        language: { code: template_language || 'pt_BR' },
        components: template_components || [],
      };
    } else {
      // Send text message
      messagePayload.type = 'text';
      messagePayload.text = { body: message };
    }

    console.log('[WHATSAPP-CLOUD-SEND] Sending to Meta API:', messagePayload);

    // Send via WhatsApp Cloud API
    const sendResponse = await fetch(
      `https://graph.facebook.com/v17.0/${integration.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${integration.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const sendResult = await sendResponse.json();
    console.log('[WHATSAPP-CLOUD-SEND] Meta API response:', sendResult);

    if (!sendResponse.ok) {
      // Check if token expired
      if (sendResult.error?.code === 190) {
        await supabase
          .from('whatsapp_seller_integrations')
          .update({ status: 'error', last_error: 'Token expirado' })
          .eq('id', integration.id);
      }

      return new Response(JSON.stringify({ 
        error: sendResult.error?.message || 'Erro ao enviar mensagem' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get company_id from profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .single();

    // Save the outgoing message to database
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        customer_id,
        seller_id: user.id,
        content: message || `[Template: ${template_name}]`,
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        cycle_id,
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('[WHATSAPP-CLOUD-SEND] Message save error:', messageError);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message_id: savedMessage?.id,
      whatsapp_message_id: sendResult.messages?.[0]?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[WHATSAPP-CLOUD-SEND] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
