import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * WhatsApp Cloud API Webhook - Global Webhook for Whasense SaaS
 * 
 * This is the SINGLE webhook for ALL companies using Whasense.
 * It routes messages to the correct company based on WABA ID or Phone Number ID.
 * 
 * Flow:
 * 1. Receives all WhatsApp events from Meta
 * 2. Identifies which company owns the number (via waba_id or phone_number_id)
 * 3. Creates/updates customer (lead) in that company
 * 4. Saves the message
 * 5. If lead is assigned to a seller, triggers AI analysis
 * 6. If lead is unassigned, it goes to "Inbox Pai" for seller pickup
 */

serve(async (req) => {
  const url = new URL(req.url);

  // ========================================
  // WEBHOOK VERIFICATION (GET) - Meta validation
  // ========================================
  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge');

    console.log('[WEBHOOK] Verification request:', { mode, token: token?.substring(0, 10) + '...' });

    if (mode === 'subscribe' && token && challenge) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      // Find ANY company with this verification token
      const { data: settings } = await supabase
        .from('company_whatsapp_settings')
        .select('id, company_id')
        .eq('verification_token', token)
        .maybeSingle();

      if (settings) {
        console.log('[WEBHOOK] Verification SUCCESS for company:', settings.company_id);
        return new Response(challenge, { status: 200 });
      }
    }

    console.log('[WEBHOOK] Verification FAILED - invalid token');
    return new Response('Forbidden', { status: 403 });
  }

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // ========================================
  // PROCESS WEBHOOK EVENTS (POST)
  // ========================================
  if (req.method === 'POST') {
    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseServiceKey);

      const body = await req.json();
      console.log('[WEBHOOK] Received event:', JSON.stringify(body).substring(0, 500));

      // Process each entry from Meta
      for (const entry of body.entry || []) {
        const wabaId = entry.id; // WABA ID comes at entry level
        
        for (const change of entry.changes || []) {
          if (change.field !== 'messages') continue;

          const value = change.value;
          const phoneNumberId = value?.metadata?.phone_number_id;

          if (!phoneNumberId && !wabaId) {
            console.log('[WEBHOOK] No phone_number_id or waba_id in webhook');
            continue;
          }

          // ========================================
          // ROUTE TO CORRECT COMPANY
          // Try to find company by phone_number_id first, then by waba_id
          // ========================================
          let companySettings = null;
          
          if (phoneNumberId) {
            const { data } = await supabase
              .from('company_whatsapp_settings')
              .select('company_id, id, status')
              .eq('phone_number_id', phoneNumberId)
              .eq('status', 'connected')
              .maybeSingle();
            companySettings = data;
          }
          
          if (!companySettings && wabaId) {
            const { data } = await supabase
              .from('company_whatsapp_settings')
              .select('company_id, id, status')
              .eq('waba_id', wabaId)
              .eq('status', 'connected')
              .maybeSingle();
            companySettings = data;
          }

          if (!companySettings) {
            console.log('[WEBHOOK] No company found for phone:', phoneNumberId, 'waba:', wabaId);
            continue;
          }

          const companyId = companySettings.company_id;
          console.log('[WEBHOOK] Routing to company:', companyId);

          // Update last_check timestamp
          await supabase
            .from('company_whatsapp_settings')
            .update({ 
              last_check: new Date().toISOString(),
              last_error: null 
            })
            .eq('id', companySettings.id);

          // ========================================
          // PROCESS INCOMING MESSAGES
          // ========================================
          for (const message of value.messages || []) {
            const contactPhone = message.from;
            const messageId = message.id;
            const timestamp = message.timestamp;
            const messageType = message.type;

            console.log('[WEBHOOK] Processing message:', { 
              from: contactPhone, 
              type: messageType, 
              company: companyId 
            });

            // Extract message content based on type
            let content = '';
            let attachmentType = null;
            let attachmentUrl = null;
            let attachmentName = null;

            switch (messageType) {
              case 'text':
                content = message.text?.body || '';
                break;
              case 'image':
                content = message.image?.caption || '[Imagem]';
                attachmentType = 'image';
                // Media URL needs to be fetched separately from Meta API
                break;
              case 'audio':
                content = '[Áudio]';
                attachmentType = 'audio';
                break;
              case 'video':
                content = message.video?.caption || '[Vídeo]';
                attachmentType = 'video';
                break;
              case 'document':
                content = message.document?.filename || '[Documento]';
                attachmentType = 'document';
                attachmentName = message.document?.filename;
                break;
              case 'sticker':
                content = '[Sticker]';
                break;
              case 'location':
                content = `[Localização: ${message.location?.latitude}, ${message.location?.longitude}]`;
                break;
              case 'contacts':
                content = '[Contato compartilhado]';
                break;
              case 'button':
                content = message.button?.text || '[Botão]';
                break;
              case 'interactive':
                content = message.interactive?.button_reply?.title || 
                         message.interactive?.list_reply?.title || 
                         '[Interativo]';
                break;
              default:
                content = `[${messageType}]`;
            }

            // ========================================
            // FIND OR CREATE CUSTOMER (LEAD)
            // ========================================
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
              console.log('[WEBHOOK] Found existing customer:', customerId, 'assigned:', assignedSellerId);
            } else {
              // Create new lead WITHOUT seller assignment (goes to Inbox Pai)
              const { data: newCustomer, error: customerError } = await supabase
                .from('customers')
                .insert({
                  name: `Cliente ${contactPhone.slice(-4)}`,
                  phone: contactPhone,
                  seller_id: null,
                  assigned_to: null,
                  company_id: companyId,
                  is_incomplete: true,
                  lead_status: 'pending',
                })
                .select('id')
                .single();

              if (customerError) {
                console.error('[WEBHOOK] Customer creation error:', customerError);
                continue;
              }
              customerId = newCustomer.id;
              assignedSellerId = null;
              console.log('[WEBHOOK] Created new lead (Inbox Pai):', customerId);
            }

            // ========================================
            // GET OR CREATE SALE CYCLE
            // ========================================
            let cycleId: string;
            const { data: existingCycle } = await supabase
              .from('sale_cycles')
              .select('id, seller_id')
              .eq('customer_id', customerId)
              .in('status', ['pending', 'in_progress'])
              .maybeSingle();

            if (existingCycle) {
              cycleId = existingCycle.id;
              if (!assignedSellerId && existingCycle.seller_id) {
                assignedSellerId = existingCycle.seller_id;
              }
            } else {
              // Create cycle - need a placeholder seller_id for unassigned leads
              let fallbackSellerId = assignedSellerId;
              
              if (!fallbackSellerId) {
                // Get any manager from the company as placeholder
                const { data: anyManager } = await supabase
                  .from('profiles')
                  .select('user_id')
                  .eq('company_id', companyId)
                  .limit(1)
                  .maybeSingle();
                
                fallbackSellerId = anyManager?.user_id || null;
              }

              if (!fallbackSellerId) {
                console.error('[WEBHOOK] No user found in company for cycle creation');
                continue;
              }

              const { data: newCycle, error: cycleError } = await supabase
                .from('sale_cycles')
                .insert({
                  customer_id: customerId,
                  seller_id: fallbackSellerId,
                  status: 'pending',
                  start_message_timestamp: new Date(parseInt(timestamp) * 1000).toISOString(),
                })
                .select('id')
                .single();

              if (cycleError) {
                console.error('[WEBHOOK] Cycle creation error:', cycleError);
                continue;
              }
              cycleId = newCycle.id;
            }

            // ========================================
            // SAVE MESSAGE
            // ========================================
            let messageSellerId = assignedSellerId;
            if (!messageSellerId) {
              // Get any user from company as placeholder for unassigned leads
              const { data: anyUser } = await supabase
                .from('profiles')
                .select('user_id')
                .eq('company_id', companyId)
                .limit(1)
                .maybeSingle();
              messageSellerId = anyUser?.user_id;
            }

            if (!messageSellerId) {
              console.error('[WEBHOOK] No user found for message seller_id');
              continue;
            }

            const { data: savedMessage, error: messageError } = await supabase
              .from('messages')
              .insert({
                customer_id: customerId,
                seller_id: messageSellerId,
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
              console.error('[WEBHOOK] Message save error:', messageError);
              continue;
            }

            console.log('[WEBHOOK] Message saved:', savedMessage.id);

            // ========================================
            // AI ANALYSIS (only for assigned leads)
            // ========================================
            const { data: customerCheck } = await supabase
              .from('customers')
              .select('assigned_to')
              .eq('id', customerId)
              .single();

            if (customerCheck?.assigned_to) {
              try {
                console.log('[WEBHOOK] Triggering AI for assigned lead');
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
                console.error('[WEBHOOK] AI analysis error:', analyzeError);
              }
            } else {
              console.log('[WEBHOOK] Lead in Inbox Pai - AI deferred until assignment');
            }
          }

          // ========================================
          // PROCESS STATUS UPDATES (delivery, read receipts)
          // ========================================
          for (const status of value.statuses || []) {
            console.log('[WEBHOOK] Status update:', status.status, 'for:', status.recipient_id);
            // TODO: Update message delivery/read status in database
          }
        }
      }

      // Always return 200 to Meta to acknowledge receipt
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error: unknown) {
      console.error('[WEBHOOK] Error:', error);
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
