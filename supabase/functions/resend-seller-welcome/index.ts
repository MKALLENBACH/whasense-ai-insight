import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RESEND-SELLER-WELCOME] ${step}${detailsStr}`);
};

// Generate random password (12 characters)
const generateRandomPassword = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get the authorization header to identify the manager
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the JWT and get user
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if the user is a manager
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleData?.role !== 'manager') {
      return new Response(
        JSON.stringify({ error: 'Only managers can resend seller emails' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get manager's company
    const { data: managerProfile } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!managerProfile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'Manager must belong to a company' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body = await req.json();
    const { userId } = body;

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get seller profile and verify they belong to same company
    const { data: sellerProfile } = await supabase
      .from('profiles')
      .select('name, email, company_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (!sellerProfile) {
      return new Response(
        JSON.stringify({ error: 'Seller not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (sellerProfile.company_id !== managerProfile.company_id) {
      return new Response(
        JSON.stringify({ error: 'Seller does not belong to your company' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get company name
    const { data: company } = await supabase
      .from('companies')
      .select('name')
      .eq('id', managerProfile.company_id)
      .single();

    // Generate new password and update user
    const newPassword = generateRandomPassword();
    
    logStep('Resetting password for seller', { userId, email: sellerProfile.email });

    const { error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { 
        password: newPassword,
        user_metadata: { requires_password_change: true }
      }
    );

    if (updateError) {
      logStep('Error updating password', updateError);
      throw updateError;
    }

    // Send welcome email with new password
    logStep('Sending welcome email', { email: sellerProfile.email });

    const emailResponse = await fetch(
      `${supabaseUrl}/functions/v1/send-seller-welcome`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
        },
        body: JSON.stringify({
          email: sellerProfile.email,
          name: sellerProfile.name,
          temporaryPassword: newPassword,
          companyName: company?.name || 'sua empresa',
        }),
      }
    );

    if (!emailResponse.ok) {
      const errorBody = await emailResponse.text();
      logStep('Failed to send email', { status: emailResponse.status, error: errorBody });
      // Don't fail - password was reset successfully
    } else {
      logStep('Email sent successfully');
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Nova senha gerada e e-mail enviado' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('Error', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
