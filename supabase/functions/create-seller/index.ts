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

    // Get manager's company
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

    const body = await req.json();
    const { name, email, password } = body;

    // Validate input
    if (!name || !email || !password) {
      return new Response(
        JSON.stringify({ error: 'name, email, and password are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('Creating seller:', { name, email, companyId: managerProfile.company_id });

    // Create the seller user
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });

    if (createError) {
      console.error('Error creating user:', createError);
      if (createError.message.includes('already been registered')) {
        return new Response(
          JSON.stringify({ error: 'Este email já está cadastrado' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      throw createError;
    }

    // Update the profile with company_id
    const { error: updateProfileError } = await supabase
      .from('profiles')
      .update({ company_id: managerProfile.company_id })
      .eq('user_id', newUser.user.id);

    if (updateProfileError) {
      console.error('Error updating profile:', updateProfileError);
    }

    // Insert user role as seller
    const { error: roleInsertError } = await supabase
      .from('user_roles')
      .insert({
        user_id: newUser.user.id,
        role: 'seller',
      });

    if (roleInsertError) {
      console.error('Error inserting role:', roleInsertError);
    }

    console.log('Seller created successfully:', newUser.user.id);

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
    console.error('Error in create-seller:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
