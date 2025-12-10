import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Create admin client with service role
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Verify the requesting user is an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if requesting user is admin
    const { data: roleData, error: roleCheckError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (roleCheckError || !roleData) {
      console.error("Role check error:", roleCheckError);
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { action, companyName, companyCnpj, companySegment, managerName, managerEmail, managerPassword } = body;

    if (action === "create_company_with_manager") {
      console.log("Creating company:", companyName);

      // 1. Create company
      const { data: newCompany, error: companyError } = await supabaseAdmin
        .from("companies")
        .insert({
          name: companyName,
          cnpj: companyCnpj || null,
          segment: companySegment || null,
        })
        .select()
        .single();

      if (companyError) {
        console.error("Company creation error:", companyError);
        return new Response(
          JSON.stringify({ error: "Erro ao criar empresa: " + companyError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Company created:", newCompany.id);

      // 2. Create user in Supabase Auth
      const { data: authData, error: authCreateError } = await supabaseAdmin.auth.admin.createUser({
        email: managerEmail,
        password: managerPassword,
        email_confirm: true,
        user_metadata: { name: managerName },
      });

      if (authCreateError) {
        console.error("Auth creation error:", authCreateError);
        // Rollback company
        await supabaseAdmin.from("companies").delete().eq("id", newCompany.id);
        return new Response(
          JSON.stringify({ error: "Erro ao criar usuário: " + authCreateError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const userId = authData.user.id;
      console.log("User created:", userId);

      // 3. Create profile
      const { error: profileError } = await supabaseAdmin
        .from("profiles")
        .insert({
          user_id: userId,
          name: managerName,
          email: managerEmail,
          company_id: newCompany.id,
        });

      if (profileError) {
        console.error("Profile creation error:", profileError);
        // Profile might already exist from trigger, try update
        await supabaseAdmin
          .from("profiles")
          .update({
            name: managerName,
            company_id: newCompany.id,
          })
          .eq("user_id", userId);
      }

      // 4. Create manager role
      const { error: roleError } = await supabaseAdmin
        .from("user_roles")
        .insert({
          user_id: userId,
          role: "manager",
        });

      if (roleError) {
        console.error("Role creation error:", roleError);
        return new Response(
          JSON.stringify({ error: "Erro ao definir role: " + roleError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Manager role created successfully");

      return new Response(
        JSON.stringify({
          success: true,
          company: newCompany,
          manager: { id: userId, email: managerEmail, name: managerName },
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Invalid action" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
