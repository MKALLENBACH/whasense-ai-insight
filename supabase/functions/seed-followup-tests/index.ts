import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { companyId, sellerId, count = 5, hoursAgo = 25 } = await req.json();

    if (!companyId || !sellerId) {
      return new Response(
        JSON.stringify({ error: "companyId e sellerId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se a empresa existe
    const { data: company } = await supabase
      .from("companies")
      .select("id, name")
      .eq("id", companyId)
      .single();

    if (!company) {
      return new Response(
        JSON.stringify({ error: "Empresa não encontrada" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se o vendedor existe
    const { data: seller } = await supabase
      .from("profiles")
      .select("id, name, user_id")
      .eq("user_id", sellerId)
      .single();

    if (!seller) {
      return new Response(
        JSON.stringify({ error: "Vendedor não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const createdCustomers = [];
    const createdCycles = [];
    const createdMessages = [];

    // Calcular timestamp antigo para simular mensagens antigas
    const oldTimestamp = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();

    for (let i = 0; i < count; i++) {
      const customerName = `Teste Followup ${i + 1} - ${Date.now()}`;
      const customerPhone = `5511999${String(i).padStart(6, "0")}`;

      // Criar customer
      const { data: customer, error: customerError } = await supabase
        .from("customers")
        .insert({
          name: customerName,
          phone: customerPhone,
          company_id: companyId,
          seller_id: sellerId,
          assigned_to: sellerId,
          lead_status: "in_progress",
        })
        .select()
        .single();

      if (customerError) {
        console.error("Erro ao criar customer:", customerError);
        continue;
      }

      createdCustomers.push(customer);

      // Criar ciclo de venda
      const { data: cycle, error: cycleError } = await supabase
        .from("sale_cycles")
        .insert({
          customer_id: customer.id,
          seller_id: sellerId,
          status: "in_progress",
          cycle_type: "pre_sale",
        })
        .select()
        .single();

      if (cycleError) {
        console.error("Erro ao criar ciclo:", cycleError);
        continue;
      }

      createdCycles.push(cycle);

      // Criar mensagem do cliente (antiga)
      const clientMessageTimestamp = new Date(Date.now() - (hoursAgo + 1) * 60 * 60 * 1000).toISOString();
      const { data: clientMessage } = await supabase
        .from("messages")
        .insert({
          customer_id: customer.id,
          seller_id: sellerId,
          cycle_id: cycle.id,
          content: `Olá, gostaria de saber mais sobre os produtos. (Msg teste ${i + 1})`,
          direction: "incoming",
          timestamp: clientMessageTimestamp,
        })
        .select()
        .single();

      if (clientMessage) createdMessages.push(clientMessage);

      // Criar resposta do vendedor (antiga - para triggear followup)
      const { data: sellerMessage } = await supabase
        .from("messages")
        .insert({
          customer_id: customer.id,
          seller_id: sellerId,
          cycle_id: cycle.id,
          content: `Olá! Claro, posso te ajudar. Qual produto você está buscando? (Resp teste ${i + 1})`,
          direction: "outgoing",
          timestamp: oldTimestamp,
        })
        .select()
        .single();

      if (sellerMessage) createdMessages.push(sellerMessage);

      // Atualizar last_activity_at do ciclo
      await supabase
        .from("sale_cycles")
        .update({ last_activity_at: oldTimestamp })
        .eq("id", cycle.id);
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `Criados ${createdCustomers.length} clientes de teste para follow-up`,
        data: {
          customers: createdCustomers.length,
          cycles: createdCycles.length,
          messages: createdMessages.length,
          hoursAgo,
          company: company.name,
          seller: seller.name,
        },
        instructions: [
          "1. Verifique se follow-ups estão habilitados na empresa (allow_followups = true)",
          "2. Verifique se follow-ups estão habilitados nas configurações (company_settings.followups_enabled = true)",
          "3. Verifique se o vendedor tem follow-ups habilitados (profiles.seller_followups_enabled = true)",
          "4. O delay configurado é company_settings.followup_delay_hours (padrão 24h)",
          `5. As mensagens criadas têm ${hoursAgo}h de idade - devem triggerar follow-up se delay < ${hoursAgo}h`,
          "6. Execute a função generate-followups para processar os follow-ups",
        ],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Erro:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
