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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    console.log('Webhook received:', JSON.stringify(body));

    const { 
      phoneNumber,      // Customer phone number
      message,          // Message content
      timestamp,        // When the message was sent
      messageId,        // Unique message ID from WhatsApp
      type = 'text'     // Message type (text, image, audio, etc.)
    } = body;

    if (!phoneNumber || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Find the session by phone number to get the seller
    const { data: session, error: sessionError } = await supabase
      .from('whatsapp_sessions')
      .select('seller_id, phone_number')
      .eq('phone_number', phoneNumber)
      .eq('is_active', true)
      .single();

    if (sessionError || !session) {
      // Try to find by partial match (removing country code variations)
      const cleanPhone = phoneNumber.replace(/\D/g, '').slice(-11);
      const { data: sessionByClean } = await supabase
        .from('whatsapp_sessions')
        .select('seller_id, phone_number')
        .eq('is_active', true)
        .ilike('phone_number', `%${cleanPhone}`);

      if (!sessionByClean || sessionByClean.length === 0) {
        console.log('No active session found for phone:', phoneNumber);
        return new Response(JSON.stringify({ 
          error: 'No active session found for this phone number',
          phoneNumber 
        }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    const sellerId = session?.seller_id;

    // Get seller's company_id for the customer
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', sellerId)
      .single();

    // Find or create customer
    let customerId: string;
    const { data: existingCustomer } = await supabase
      .from('customers')
      .select('id')
      .eq('phone', phoneNumber)
      .eq('seller_id', sellerId)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
    } else {
      // Create new customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: `Cliente ${phoneNumber.slice(-4)}`,
          phone: phoneNumber,
          seller_id: sellerId,
          company_id: sellerProfile?.company_id,
        })
        .select('id')
        .single();

      if (customerError) {
        throw customerError;
      }
      customerId = newCustomer.id;
    }

    // Save the message
    const { data: savedMessage, error: messageError } = await supabase
      .from('messages')
      .insert({
        customer_id: customerId,
        seller_id: sellerId,
        content: message,
        direction: 'incoming',
        timestamp: timestamp || new Date().toISOString(),
      })
      .select('id')
      .single();

    if (messageError) {
      throw messageError;
    }

    // Trigger AI analysis asynchronously
    try {
      const analyzeResponse = await fetch(`${supabaseUrl}/functions/v1/analyze-message`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({
          message,
          message_id: savedMessage.id,
        }),
      });

      const analysisResult = await analyzeResponse.json();
      console.log('AI Analysis result:', analysisResult);
    } catch (analyzeError) {
      console.error('Failed to analyze message:', analyzeError);
      // Don't fail the webhook if analysis fails
    }

    return new Response(JSON.stringify({
      success: true,
      messageId: savedMessage.id,
      customerId,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
