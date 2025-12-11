import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * WhatsApp Cloud API - Send Messages
 * 
 * Sends messages via WhatsApp Cloud API using company-level settings.
 * Supports:
 * - Text messages
 * - Template messages
 * - Media messages (future)
 * - Button messages (future)
 * 
 * Both managers and sellers can send messages.
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

    // Get user's company
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

    // Get company WhatsApp settings
    const { data: whatsappSettings, error: settingsError } = await supabase
      .from('company_whatsapp_settings')
      .select('*')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    if (settingsError || !whatsappSettings) {
      console.log('[WHATSAPP-SEND] No company WhatsApp settings for:', profile.company_id);
      return new Response(JSON.stringify({ 
        error: 'WhatsApp não configurado. Peça ao gestor para configurar o WhatsApp da empresa.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (whatsappSettings.status !== 'connected') {
      return new Response(JSON.stringify({ 
        error: 'WhatsApp não está conectado. Peça ao gestor para verificar a conexão.' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { 
      to, 
      message, 
      customer_id, 
      cycle_id, 
      template_name, 
      template_language, 
      template_components,
      media_type,
      media_url,
      media_caption
    } = body;

    if (!to) {
      return new Response(JSON.stringify({ error: 'Destinatário obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[WHATSAPP-SEND] Request:', { 
      to, 
      customer_id, 
      hasMessage: !!message, 
      hasTemplate: !!template_name,
      company: profile.company_id 
    });

    // Build the message payload
    const phoneNumber = to.replace(/\D/g, ''); // Remove non-digits
    let messagePayload: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: phoneNumber,
    };

    let contentForDb = '';

    if (template_name) {
      // Template message
      messagePayload.type = 'template';
      messagePayload.template = {
        name: template_name,
        language: { code: template_language || 'pt_BR' },
        components: template_components || [],
      };
      contentForDb = `[Template: ${template_name}]`;
    } else if (media_type && media_url) {
      // Media message
      messagePayload.type = media_type;
      messagePayload[media_type] = {
        link: media_url,
        caption: media_caption || undefined,
      };
      contentForDb = media_caption || `[${media_type}]`;
    } else if (message) {
      // Text message
      messagePayload.type = 'text';
      messagePayload.text = { body: message };
      contentForDb = message;
    } else {
      return new Response(JSON.stringify({ error: 'Mensagem, template ou mídia obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('[WHATSAPP-SEND] Sending to Meta API v19.0');

    // Send via WhatsApp Cloud API (v19.0 as per spec)
    const sendResponse = await fetch(
      `https://graph.facebook.com/v19.0/${whatsappSettings.phone_number_id}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${whatsappSettings.permanent_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(messagePayload),
      }
    );

    const sendResult = await sendResponse.json();
    console.log('[WHATSAPP-SEND] Meta API response:', sendResult);

    if (!sendResponse.ok) {
      // Check if token expired
      if (sendResult.error?.code === 190) {
        await supabase
          .from('company_whatsapp_settings')
          .update({ 
            status: 'error', 
            last_error: 'Token expirado',
            last_check: new Date().toISOString()
          })
          .eq('id', whatsappSettings.id);
      }

      return new Response(JSON.stringify({ 
        error: sendResult.error?.message || 'Erro ao enviar mensagem' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Save the outgoing message to database
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        customer_id,
        seller_id: user.id,
        content: contentForDb,
        direction: 'outgoing',
        timestamp: new Date().toISOString(),
        cycle_id,
        attachment_type: media_type || null,
        attachment_url: media_url || null,
      })
      .select('id')
      .single();

    if (messageError) {
      console.error('[WHATSAPP-SEND] Message save error:', messageError);
    }

    // Update cycle last activity
    if (cycle_id) {
      await supabase
        .from('sale_cycles')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', cycle_id);
    }

    return new Response(JSON.stringify({ 
      success: true,
      message_id: savedMessage?.id,
      whatsapp_message_id: sendResult.messages?.[0]?.id,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('[WHATSAPP-SEND] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
