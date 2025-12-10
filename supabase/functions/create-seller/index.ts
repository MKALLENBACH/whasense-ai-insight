import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CREATE-SELLER] ${step}${detailsStr}`);
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
    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (roleError || roleData?.role !== 'manager') {
      return new Response(
        JSON.stringify({ error: 'Only managers can create sellers' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get manager's company with plan info
    const { data: managerProfile, error: profileError } = await supabase
      .from('profiles')
      .select('company_id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (profileError || !managerProfile?.company_id) {
      return new Response(
        JSON.stringify({ error: 'Manager must belong to a company' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const companyId = managerProfile.company_id;

    // Get company's plan and name
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('plan_id, name')
      .eq('id', companyId)
      .single();

    if (companyError) {
      logStep('Error fetching company', companyError);
    }

    // Check seller limit if company has a plan
    if (company?.plan_id) {
      const { data: plan, error: planError } = await supabase
        .from('plans')
        .select('seller_limit, name')
        .eq('id', company.plan_id)
        .single();

      if (planError) {
        logStep('Error fetching plan', planError);
      }

      // If plan has a seller limit (not unlimited)
      if (plan && plan.seller_limit !== null) {
        // Count current active sellers
        const { data: companyProfiles } = await supabase
          .from('profiles')
          .select('user_id')
          .eq('company_id', companyId);

        if (companyProfiles && companyProfiles.length > 0) {
          const userIds = companyProfiles.map(p => p.user_id);
          
          const { data: sellerRoles, error: rolesError } = await supabase
            .from('user_roles')
            .select('user_id')
            .in('user_id', userIds)
            .eq('role', 'seller');

          if (rolesError) {
            logStep('Error counting sellers', rolesError);
          }

          const currentSellerCount = sellerRoles?.length || 0;

          logStep('Seller limit check', { plan: plan.name, limit: plan.seller_limit, current: currentSellerCount });

          if (currentSellerCount >= plan.seller_limit) {
            return new Response(
              JSON.stringify({ 
                error: `Seu plano "${plan.name}" permite somente ${plan.seller_limit} vendedores. Contate Whasense para fazer upgrade.`,
                code: 'SELLER_LIMIT_REACHED',
                limit: plan.seller_limit,
                current: currentSellerCount
              }),
              { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }
      }
    }

    const body = await req.json();
    const { name, email } = body;

    // Validate input
    if (!name || !email) {
      return new Response(
        JSON.stringify({ error: 'name and email are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate random password (12 characters with letters, numbers, and special chars)
    const generateRandomPassword = () => {
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
      let password = '';
      for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return password;
    };
    
    const password = generateRandomPassword();

    logStep('Creating seller', { name, email, companyId });

    // Create the seller user with requires_password_change flag
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { 
        name,
        requires_password_change: true,
      },
    });

    if (createError) {
      logStep('Error creating user', createError);
      if (createError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw createError;
    }

    logStep('Auth user created', { userId: newUser.user.id });

    // Update the profile with company_id (may have been created by trigger)
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .upsert({
        user_id: newUser.user.id,
        company_id: companyId,
        name,
        email,
        is_active: true,
      }, { onConflict: 'user_id' });

    if (updateProfileError) {
      logStep('Error updating profile', updateProfileError);
    } else {
      logStep('Profile created/updated', { userId: newUser.user.id, companyId });
    }

    // Insert user role as seller
    const { error: roleInsertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'seller',
      });

    if (roleInsertError) {
      logStep('Error inserting role', roleInsertError);
    }

    // Send welcome email with credentials
    try {
      logStep('Sending welcome email to seller', { email, name });
      
      const emailResponse = await fetch(
        `${supabaseUrl}/functions/v1/send-seller-welcome`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            email,
            name,
            temporaryPassword: password,
            companyName: company?.name || 'sua empresa',
          }),
        }
      );

      if (!emailResponse.ok) {
        const errorBody = await emailResponse.text();
        logStep('Failed to send welcome email', { status: emailResponse.status, error: errorBody });
      } else {
        logStep('Welcome email sent successfully', { email });
      }
    } catch (emailError) {
      logStep('Error sending welcome email', { error: String(emailError) });
      // Don't fail the request if email fails
    }

    logStep('Seller created successfully', { userId: newUser.user.id, email });

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: {
          id: newUser.user.id,
          email: newUser.user.email,
          name,
        },
        message: 'Vendedor criado com sucesso!' 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep('Error in create-seller', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});