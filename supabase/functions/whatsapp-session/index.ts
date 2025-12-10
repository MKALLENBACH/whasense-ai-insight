import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a mock QR code base64 (in real implementation, this would come from Baileys)
function generateMockQRCode(sessionId: string): string {
  // This creates a simple data URL that represents a QR code placeholder
  // In production, this would be the actual QR code from WhatsApp Web
  const qrData = `whatsapp://session/${sessionId}/${Date.now()}`;
  // Return a mock base64 QR code image
  return `data:image/svg+xml;base64,${btoa(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
      <rect width="200" height="200" fill="white"/>
      <g fill="black">
        ${generateQRPattern(sessionId)}
      </g>
      <text x="100" y="190" text-anchor="middle" font-size="8" fill="#666">
        Session: ${sessionId.slice(0, 8)}
      </text>
    </svg>
  `)}`;
}

function generateQRPattern(seed: string): string {
  // Generate a deterministic pattern based on the seed
  let pattern = '';
  const size = 7;
  const cellSize = 20;
  const offset = 30;
  
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      // Use seed to determine if cell should be filled
      const hash = (seed.charCodeAt(i % seed.length) + j * 7 + i * 11) % 3;
      if (hash !== 0) {
        pattern += `<rect x="${offset + j * cellSize}" y="${offset + i * cellSize}" width="${cellSize - 2}" height="${cellSize - 2}"/>`;
      }
    }
  }
  
  // Add corner squares (typical QR code pattern)
  const corners = [
    { x: 10, y: 10 },
    { x: 150, y: 10 },
    { x: 10, y: 150 }
  ];
  
  corners.forEach(({ x, y }) => {
    pattern += `<rect x="${x}" y="${y}" width="40" height="40"/>`;
    pattern += `<rect x="${x + 5}" y="${y + 5}" width="30" height="30" fill="white"/>`;
    pattern += `<rect x="${x + 10}" y="${y + 10}" width="20" height="20"/>`;
  });
  
  return pattern;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'init': {
        // Initialize a new session or get existing pending session
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000); // QR expires in 2 minutes

        // Check if session already exists
        const { data: existingSession } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('seller_id', user.id)
          .maybeSingle();

        if (existingSession?.status === 'connected' && existingSession?.is_active) {
          return new Response(JSON.stringify({
            sessionId: existingSession.id,
            sessionStatus: 'connected',
            phoneNumber: existingSession.phone_number,
            lastConnectedAt: existingSession.last_connected_at,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Generate new QR code
        const qrCodeBase64 = generateMockQRCode(sessionId);

        if (existingSession) {
          // Update existing session
          await supabase
            .from('whatsapp_sessions')
            .update({
              status: 'pending',
              session_data: { qrSessionId: sessionId },
              expires_at: expiresAt.toISOString(),
              is_active: false,
            })
            .eq('seller_id', user.id);
        } else {
          // Create new session
          await supabase
            .from('whatsapp_sessions')
            .insert({
              seller_id: user.id,
              status: 'pending',
              session_data: { qrSessionId: sessionId },
              expires_at: expiresAt.toISOString(),
            });
        }

        return new Response(JSON.stringify({
          qrCodeBase64,
          sessionStatus: 'pending',
          sessionId,
          expiresAt: expiresAt.toISOString(),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'status': {
        // Get current session status
        const { data: session } = await supabase
          .from('whatsapp_sessions')
          .select('*')
          .eq('seller_id', user.id)
          .maybeSingle();

        if (!session) {
          return new Response(JSON.stringify({
            sessionStatus: 'disconnected',
            hasSession: false,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if session expired
        if (session.expires_at && new Date(session.expires_at) < new Date() && session.status === 'pending') {
          await supabase
            .from('whatsapp_sessions')
            .update({ status: 'expired' })
            .eq('id', session.id);
          
          return new Response(JSON.stringify({
            sessionStatus: 'expired',
            hasSession: true,
            lastConnectedAt: session.last_connected_at,
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        return new Response(JSON.stringify({
          sessionId: session.id,
          sessionStatus: session.status,
          isActive: session.is_active,
          phoneNumber: session.phone_number,
          lastConnectedAt: session.last_connected_at,
          expiresAt: session.expires_at,
          hasSession: true,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'simulate-connect': {
        // Simulate scanning QR code (for testing purposes)
        const body = await req.json();
        const phoneNumber = body.phoneNumber || '+5511999999999';

        const { error } = await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'connected',
            is_active: true,
            phone_number: phoneNumber,
            last_connected_at: new Date().toISOString(),
            expires_at: null,
          })
          .eq('seller_id', user.id);

        if (error) {
          throw error;
        }

        return new Response(JSON.stringify({
          success: true,
          sessionStatus: 'connected',
          phoneNumber,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'disconnect': {
        // Disconnect session
        await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'disconnected',
            is_active: false,
          })
          .eq('seller_id', user.id);

        return new Response(JSON.stringify({
          success: true,
          sessionStatus: 'disconnected',
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'reconnect': {
        // Same as init but preserves some session data
        const sessionId = crypto.randomUUID();
        const expiresAt = new Date(Date.now() + 2 * 60 * 1000);
        const qrCodeBase64 = generateMockQRCode(sessionId);

        await supabase
          .from('whatsapp_sessions')
          .update({
            status: 'pending',
            session_data: { qrSessionId: sessionId },
            expires_at: expiresAt.toISOString(),
            is_active: false,
          })
          .eq('seller_id', user.id);

        return new Response(JSON.stringify({
          qrCodeBase64,
          sessionStatus: 'pending',
          sessionId,
          expiresAt: expiresAt.toISOString(),
        }), {
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
    console.error('Error in whatsapp-session:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
