import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  const url = new URL(req.url);

  // Handle webhook verification (GET request from Meta)
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[WHATSAPP-CLOUD-WEBHOOK] Verification request:', { mode, token });

    if (mode === 'subscribe' && token && challenge) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Find integration with this verification token
      const { data: integration } = await supabase
        .from('whatsapp_seller_integrations')
        .select('id')
        .eq('verification_token', token)
        .maybeSingle();

      if (integration) {
        console.log('[WHATSAPP-CLOUD-WEBHOOK] Verification successful');
        return new Response(challenge, { status: 200 });
      }
    }

    console.log('[WHATSAPP-CLOUD-WEBHOOK] Verification failed');
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Handle incoming webhook (POST request from Meta)
  if (req.method === 'POST') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const body = await req.json();
      console.log('[WHATSAPP-CLOUD-WEBHOOK] Received:', JSON.stringify(body));

      // Process each entry
      for (const entry of body.entry || []) {
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          const phoneNumberId = value?.metadata?.phone_number_id;

          if (!phoneNumberId) {
            console.log('[WHATSAPP-CLOUD-WEBHOOK] No phone_number_id in webhook');
            continue;
          }

          // Find the seller integration by phone_number_id
          const { data: integration, error: integrationError } = await supabase
            .from('whatsapp_seller_integrations')
            .select('seller_id, company_id, id')
            .eq('phone_number_id', phoneNumberId)
            .maybeSingle();

          if (integrationError || !integration) {
            console.log('[WHATSAPP-CLOUD-WEBHOOK] No integration found for phone:', phoneNumberId);
            continue;
          }

          const companyId = integration.company_id;

          // Update last_webhook_at
          await supabase
            .from('whatsapp_seller_integrations')
            .update({ last_webhook_at: new Date().toISOString() })
            .eq('id', integration.id);

          // Process messages
          for (const message of value.messages || []) {
            const contactPhone = message.from;
            const messageId = message.id;
            const timestamp = message.timestamp;
            const messageType = message.type;

            console.log('[WHATSAPP-CLOUD-WEBHOOK] Processing message:', { 
              from: contactPhone, 
              type: messageType, 
              company: companyId 
            });

            // Extract message content based on type
            let content = '';
            let attachmentType = null;
            let attachmentUrl = null;
            let attachmentName = null;

            if (messageType === 'text') {
              content = message.text?.body || '';
            } else if (messageType === 'image') {
              content = message.image?.caption || '[Imagem]';
              attachmentType = 'image';
            } else if (messageType === 'audio') {
              content = '[Áudio]';
              attachmentType = 'audio';
            } else if (messageType === 'video') {
              content = message.video?.caption || '[Vídeo]';
              attachmentType = 'video';
            } else if (messageType === 'document') {
              content = message.document?.filename || '[Documento]';
              attachmentType = 'document';
              attachmentName = message.document?.filename;
            } else if (messageType === 'sticker') {
              content = '[Sticker]';
            } else if (messageType === 'location') {
              content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
            } else if (messageType === 'contacts') {
              content = '[Contato compartilhado]';
            } else {
              content = `[${messageType}]`;
            }

            // CORREÇÃO: Buscar cliente por telefone E company_id (não seller_id)
            let customerId: string;
            let assignedSellerId: string | null = null;
            
            const { data: existingCustomer } = await supabase
              .from('customers')
              .select('id, assigned_to, seller_id')
              .eq('phone', contactPhone)
              .eq('company_id', companyId)
              .maybeSingle();

            if (existingCustomer) {
              customerId = existingCustomer.id;
              assignedSellerId = existingCustomer.assigned_to || existingCustomer.seller_id;
            } else {
              // Create new customer WITHOUT seller assignment (goes to Inbox Pai)
              const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                  name: `Cliente ${contactPhone.slice(-4)}`,
                  phone: contactPhone,
                  seller_id: null, // No seller assigned initially
                  assigned_to: null, // Goes to Inbox Pai
                  company_id: companyId,
                  is_incomplete: true,
                  lead_status: 'pending',
                })
                .select('id')
                .single();

              if (customerError) {
                console.error('[WHATSAPP-CLOUD-WEBHOOK] Customer creation error:', customerError);
                continue;
              }
              customerId = newCustomer.id;
              assignedSellerId = null;
            }

            // Get or create active cycle
            // CORREÇÃO: Ciclo só tem seller_id se lead estiver atribuído
            let cycleId: string;
            const { data: existingCycle } = await supabase
              .from('sale_cycles')
              .select('id, seller_id')
              .eq('customer_id', customerId)
              .in('status', ['pending', 'in_progress'])
              .maybeSingle();

            if (existingCycle) {
              cycleId = existingCycle.id;
              // Use the seller from existing cycle if exists
              if (!assignedSellerId && existingCycle.seller_id) {
                assignedSellerId = existingCycle.seller_id;
              }
            } else {
              // CORREÇÃO: Criar ciclo com seller_id correto (do assigned_to ou null)
              const { data: newCycle, error: cycleError } = await supabase
                .from('sale_cycles')
                .insert({
                  customer_id: customerId,
                  seller_id: assignedSellerId || integration.seller_id, // Usa assigned ou fallback para integração
                  status: 'in_progress',
                  start_message_timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                })
                .select('id')
                .single();

              if (cycleError) {
                console.error('[WHATSAPP-CLOUD-WEBHOOK] Cycle creation error:', cycleError);
                continue;
              }
              cycleId = newCycle.id;
            }

            // Save message
            // CORREÇÃO: Mensagem usa seller da integração para tracking, mas não para atribuição
            const { data: savedMessage, error: messageError } = await supabase
              .from('messages')
              .insert({
                customer_id: customerId,
                seller_id: assignedSellerId || integration.seller_id, // Usa assigned ou integração
                content,
                direction: 'incoming',
                timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                cycle_id: cycleId,
                attachment_type: attachmentType,
                attachment_url: attachmentUrl,
                attachment_name: attachmentName,
              })
              .select('id')
              .single();

            if (messageError) {
              console.error('[WHATSAPP-CLOUD-WEBHOOK] Message save error:', messageError);
              continue;
            }

            console.log('[WHATSAPP-CLOUD-WEBHOOK] Message saved:', savedMessage.id);

            // Check if customer is assigned - only run AI if assigned
            const { data: customerCheck } = await supabase
              .from('customers')
              .select('assigned_to')
              .eq('id', customerId)
              .single();

            // Only trigger AI analysis if lead is assigned to a seller
            if (customerCheck?.assigned_to) {
              try {
                console.log('[WHATSAPP-CLOUD-WEBHOOK] Triggering AI for assigned lead');
                await fetch(`${supabaseUrl}/functions/v1/analyze-message`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                  },
                  body: JSON.stringify({
                    message: content,
                    message_id: savedMessage.id,
                  }),
                });
              } catch (analyzeError) {
                console.error('[WHATSAPP-CLOUD-WEBHOOK] AI analysis error:', analyzeError);
              }
            } else {
              console.log('[WHATSAPP-CLOUD-WEBHOOK] Skipping AI - lead not assigned (Inbox Pai)');
            }
          }

          // Process status updates (delivery, read receipts)
          for (const status of value.statuses || []) {
            console.log('[WHATSAPP-CLOUD-WEBHOOK] Status update:', status);
          }
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error: unknown) {
      console.error('[WHATSAPP-CLOUD-WEBHOOK] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      // Always return 200 to prevent Meta from retrying
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  }

  return new Response('Method not allowed', { status: 405 });
});
