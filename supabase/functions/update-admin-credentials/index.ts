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
    const adminSecret = Deno.env.get("ADMIN_CREATION_SECRET");

    const body = await req.json();
    const { secret, userId, newEmail, newPassword } = body;

    // Verify admin secret
    if (secret !== adminSecret) {
      console.log("[UPDATE-ADMIN] Invalid secret");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    console.log(`[UPDATE-ADMIN] Updating user ${userId}`);

    // Update user in auth
    const updateData: Record<string, unknown> = {};
    if (newEmail) {
      updateData.email = newEmail;
      updateData.email_confirm = true;
    }
    if (newPassword) {
      updateData.password = newPassword;
    }

    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      updateData
    );

    if (error) {
      console.log(`[UPDATE-ADMIN] Error: ${error.message}`);
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Also update the profile email if provided
    if (newEmail) {
      await supabaseAdmin
        .from("profiles")
        .upsert({
          user_id: userId,
          email: newEmail,
          name: "Admin Whasense",
        }, { onConflict: "user_id" });
    }

    console.log(`[UPDATE-ADMIN] Success`);
    return new Response(
      JSON.stringify({ success: true, email: data.user?.email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.log(`[UPDATE-ADMIN] Error: ${error}`);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
