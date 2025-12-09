import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEMO_COMPANY_NAME = "Loja Demo";
const DEMO_PASSWORD = "123456";

const DEMO_USERS = [
  { email: "gestor@demo.com", name: "Administrador Demo", role: "manager" as const },
  { email: "vendedor1@demo.com", name: "Vendedor 1", role: "seller" as const },
  { email: "vendedor2@demo.com", name: "Vendedor 2", role: "seller" as const },
];

const DEMO_CUSTOMERS = [
  { name: "Maria Silva", phone: "+5511999001001", temperature: "hot" },
  { name: "João Santos", phone: "+5511999002002", temperature: "warm" },
  { name: "Ana Oliveira", phone: "+5511999003003", temperature: "cold" },
  { name: "Pedro Costa", phone: "+5511999004004", temperature: "warm" },
  { name: "Carla Souza", phone: "+5511999005005", temperature: "hot" },
  { name: "Lucas Lima", phone: "+5511999006006", temperature: "cold" },
];

const INITIAL_MESSAGES = [
  "Olá! Vi o anúncio de vocês, podem me dar mais informações?",
  "Boa tarde, qual o preço do produto?",
  "Vocês fazem entrega?",
  "Oi, estou interessado, mas preciso pensar...",
  "Qual o prazo de entrega?",
  "Tem desconto para pagamento à vista?",
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: string[] = [];

    // 1. Create or get company
    let companyId: string;
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name', DEMO_COMPANY_NAME)
      .single();

    if (existingCompany) {
      companyId = existingCompany.id;
      results.push(`Empresa "${DEMO_COMPANY_NAME}" já existe: ${companyId}`);
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ name: DEMO_COMPANY_NAME })
        .select('id')
        .single();

      if (companyError) throw companyError;
      companyId = newCompany.id;
      results.push(`Empresa "${DEMO_COMPANY_NAME}" criada: ${companyId}`);
    }

    // 2. Create users
    const userIds: { [email: string]: string } = {};
    const sellerIds: string[] = [];

    for (const user of DEMO_USERS) {
      // Check if user exists
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      if (existingUser) {
        userIds[user.email] = existingUser.id;
        if (user.role === 'seller') sellerIds.push(existingUser.id);
        results.push(`Usuário "${user.email}" já existe: ${existingUser.id}`);
        continue;
      }

      // Create user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: DEMO_PASSWORD,
        email_confirm: true,
        user_metadata: { name: user.name },
      });

      if (authError) {
        results.push(`Erro ao criar "${user.email}": ${authError.message}`);
        continue;
      }

      const userId = authData.user.id;
      userIds[user.email] = userId;
      if (user.role === 'seller') sellerIds.push(userId);

      // Update profile with company
      await supabase
        .from('profiles')
        .update({ company_id: companyId, name: user.name })
        .eq('user_id', userId);

      // Create role
      await supabase
        .from('user_roles')
        .upsert({
          user_id: userId,
          role: user.role,
        }, { onConflict: 'user_id' });

      results.push(`Usuário "${user.email}" criado: ${userId} (${user.role})`);
    }

    // 3. Create WhatsApp sessions for sellers
    for (const sellerId of sellerIds) {
      const { error: sessionError } = await supabase
        .from('whatsapp_sessions')
        .upsert({
          seller_id: sellerId,
          status: 'connected',
          is_active: true,
          phone_number: '+5511999' + Math.floor(Math.random() * 900000 + 100000),
          last_connected_at: new Date().toISOString(),
        }, { onConflict: 'seller_id' });

      if (!sessionError) {
        results.push(`Sessão WhatsApp criada para vendedor ${sellerId}`);
      }
    }

    // 4. Create demo customers and initial messages for each seller
    for (let sellerIndex = 0; sellerIndex < sellerIds.length; sellerIndex++) {
      const sellerId = sellerIds[sellerIndex];
      const customersForSeller = DEMO_CUSTOMERS.slice(sellerIndex * 3, (sellerIndex + 1) * 3);

      for (const customer of customersForSeller) {
        // Check if customer already exists
        const { data: existingCustomer } = await supabase
          .from('customers')
          .select('id')
          .eq('phone', customer.phone)
          .eq('seller_id', sellerId)
          .single();

        let customerId: string;
        if (existingCustomer) {
          customerId = existingCustomer.id;
          results.push(`Cliente "${customer.name}" já existe`);
        } else {
          const { data: newCustomer, error: customerError } = await supabase
            .from('customers')
            .insert({
              name: customer.name,
              phone: customer.phone,
              seller_id: sellerId,
              company_id: companyId,
            })
            .select('id')
            .single();

          if (customerError) {
            results.push(`Erro ao criar cliente "${customer.name}": ${customerError.message}`);
            continue;
          }
          customerId = newCustomer.id;
          results.push(`Cliente "${customer.name}" criado para vendedor ${sellerIndex + 1}`);

          // Create initial message from customer
          const randomMessage = INITIAL_MESSAGES[Math.floor(Math.random() * INITIAL_MESSAGES.length)];
          await supabase
            .from('messages')
            .insert({
              customer_id: customerId,
              seller_id: sellerId,
              content: randomMessage,
              direction: 'incoming',
              timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            });
        }
      }
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      credentials: {
        gestor: { email: "gestor@demo.com", password: DEMO_PASSWORD },
        vendedor1: { email: "vendedor1@demo.com", password: DEMO_PASSWORD },
        vendedor2: { email: "vendedor2@demo.com", password: DEMO_PASSWORD },
      },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in seed-demo-data:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
