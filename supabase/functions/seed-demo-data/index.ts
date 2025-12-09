import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const DEMO_COMPANY_NAME = "Exercit Esportes";
const DEMO_PASSWORD = "123456";

const DEMO_USERS = [
  { email: "gestor@exercit.com", name: "Carlos Gerente", role: "manager" as const },
  { email: "vendedor1@exercit.com", name: "Ana Vendedora", role: "seller" as const },
  { email: "vendedor2@exercit.com", name: "Pedro Vendedor", role: "seller" as const },
];

// 10 clientes com perfis variados e objetivos fitness diferentes
const DEMO_CUSTOMERS = [
  { 
    name: "Rafael Mendes", 
    phone: "+5511999101001", 
    objective: "ganho_massa",
    profile: "iniciante_inseguro",
    initialMessage: "Oi, estou começando na academia agora e não sei qual whey comprar. Vocês podem me ajudar?" 
  },
  { 
    name: "Juliana Costa", 
    phone: "+5511999102002", 
    objective: "emagrecimento",
    profile: "cliente_motivada",
    initialMessage: "Boa tarde! Quero emagrecer e vi que vocês vendem termogênicos. Qual o melhor pra queimar gordura?" 
  },
  { 
    name: "Fernando Silva", 
    phone: "+5511999103003", 
    objective: "performance",
    profile: "cliente_tecnico",
    initialMessage: "E aí! Preciso de creatina monohidratada creapure, vocês tem? Qual a pureza?" 
  },
  { 
    name: "Mariana Santos", 
    phone: "+5511999104004", 
    objective: "home_gym",
    profile: "cliente_com_pressa",
    initialMessage: "Oi, preciso montar uma academia em casa urgente. Quanto custa um kit com halteres e barra?" 
  },
  { 
    name: "Bruno Oliveira", 
    phone: "+5511999105005", 
    objective: "suplementacao_completa",
    profile: "cliente_economico",
    initialMessage: "Opa, to procurando um combo de suplementos bom e barato. Whey + creatina, tem desconto?" 
  },
  { 
    name: "Camila Rodrigues", 
    phone: "+5511999106006", 
    objective: "roupas_fitness",
    profile: "cliente_pesquisando",
    initialMessage: "Oi! Vocês vendem leggings de academia? Queria ver os modelos e preços" 
  },
  { 
    name: "Lucas Ferreira", 
    phone: "+5511999107007", 
    objective: "ganho_massa",
    profile: "cliente_super_quente",
    initialMessage: "Fala! To precisando de hipercalórico e BCAA pra ontem. Vocês entregam rápido?" 
  },
  { 
    name: "Patricia Almeida", 
    phone: "+5511999108008", 
    objective: "recuperacao",
    profile: "cliente_desconfiada",
    initialMessage: "Boa noite. Vi uns preços de colágeno aqui mas não sei se é original. Vocês são loja autorizada?" 
  },
  { 
    name: "Diego Martins", 
    phone: "+5511999109009", 
    objective: "equipamentos",
    profile: "cliente_indeciso",
    initialMessage: "Oi, to na dúvida entre comprar elásticos de resistência ou halteres ajustáveis. O que vocês recomendam?" 
  },
  { 
    name: "Amanda Lima", 
    phone: "+5511999110010", 
    objective: "pre_treino",
    profile: "cliente_recorrente",
    initialMessage: "Oi pessoal! Comprei o C4 de vocês mês passado e amei. Tem alguma novidade de pré-treino?" 
  },
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
      .maybeSingle();

    if (existingCompany) {
      companyId = existingCompany.id;
      results.push(`✅ Empresa "${DEMO_COMPANY_NAME}" já existe: ${companyId}`);
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ 
          name: DEMO_COMPANY_NAME,
          segment: "Fitness e Suplementação",
          description: "Loja especializada em suplementos, equipamentos e roupas fitness"
        })
        .select('id')
        .single();

      if (companyError) throw companyError;
      companyId = newCompany.id;
      results.push(`✅ Empresa "${DEMO_COMPANY_NAME}" criada: ${companyId}`);
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
        results.push(`✅ Usuário "${user.email}" já existe`);
        
        // Ensure profile has company
        await supabase
          .from('profiles')
          .update({ company_id: companyId, name: user.name })
          .eq('user_id', existingUser.id);
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
        results.push(`❌ Erro ao criar "${user.email}": ${authError.message}`);
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

      results.push(`✅ Usuário "${user.email}" criado (${user.role})`);
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
        results.push(`✅ Sessão WhatsApp ativa para vendedor`);
      }
    }

    // 4. Create demo customers with cycles and initial messages
    let customerCount = 0;
    for (let i = 0; i < DEMO_CUSTOMERS.length; i++) {
      const customer = DEMO_CUSTOMERS[i];
      // Distribute customers between sellers
      const sellerId = sellerIds[i % sellerIds.length];

      // Check if customer already exists by phone
      const { data: existingCustomer } = await supabase
        .from('customers')
        .select('id')
        .eq('phone', customer.phone)
        .maybeSingle();

      let customerId: string;
      if (existingCustomer) {
        customerId = existingCustomer.id;
        results.push(`⏭️ Cliente "${customer.name}" já existe`);
      } else {
        const { data: newCustomer, error: customerError } = await supabase
          .from('customers')
          .insert({
            name: customer.name,
            phone: customer.phone,
            seller_id: sellerId,
            company_id: companyId,
            lead_status: 'pending',
          })
          .select('id')
          .single();

        if (customerError) {
          results.push(`❌ Erro ao criar cliente "${customer.name}": ${customerError.message}`);
          continue;
        }
        customerId = newCustomer.id;
        customerCount++;

        // Create a sale cycle for this customer
        const { data: cycle, error: cycleError } = await supabase
          .from('sale_cycles')
          .insert({
            customer_id: customerId,
            seller_id: sellerId,
            status: 'pending',
          })
          .select('id')
          .single();

        if (cycleError) {
          console.error('Error creating cycle:', cycleError);
          continue;
        }

        // Create initial message from customer
        const { data: message, error: messageError } = await supabase
          .from('messages')
          .insert({
            customer_id: customerId,
            seller_id: sellerId,
            content: customer.initialMessage,
            direction: 'incoming',
            timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString(),
            cycle_id: cycle.id,
          })
          .select('id')
          .single();

        if (messageError) {
          console.error('Error creating message:', messageError);
          continue;
        }

        // Trigger analysis for this message
        try {
          await fetch(`${supabaseUrl}/functions/v1/analyze-message`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({
              message: customer.initialMessage,
              message_id: message.id,
              cycleMessages: [{ from: 'client', text: customer.initialMessage }],
            }),
          });
        } catch (e) {
          console.error('Failed to analyze initial message:', e);
        }

        results.push(`✅ Cliente "${customer.name}" criado (${customer.objective})`);
      }
    }

    // 5. Create some alerts for demo
    if (customerCount > 0) {
      const { data: customers } = await supabase
        .from('customers')
        .select('id, seller_id')
        .eq('company_id', companyId)
        .limit(5);

      for (const cust of customers || []) {
        await supabase
          .from('alerts')
          .upsert({
            customer_id: cust.id,
            seller_id: cust.seller_id,
            alert_type: ['hot_lead', 'waiting_response', 'open_objection'][Math.floor(Math.random() * 3)],
            severity: ['info', 'warning', 'critical'][Math.floor(Math.random() * 3)],
            message: ['Lead quente! Responda rápido', 'Cliente aguardando resposta', 'Objeção de preço detectada'][Math.floor(Math.random() * 3)],
          }, { onConflict: 'customer_id,alert_type' });
      }
      results.push(`✅ Alertas de demo criados`);
    }

    return new Response(JSON.stringify({
      success: true,
      results,
      customerCount,
      credentials: {
        gestor: { email: "gestor@exercit.com", password: DEMO_PASSWORD },
        vendedor1: { email: "vendedor1@exercit.com", password: DEMO_PASSWORD },
        vendedor2: { email: "vendedor2@exercit.com", password: DEMO_PASSWORD },
      },
      instructions: [
        "1. Faça login como vendedor para ver as conversas",
        "2. Clique em 'Simular Cliente' para gerar respostas automáticas",
        "3. A IA analisará cada mensagem e sugerirá respostas",
        "4. Os clientes têm perfis variados (iniciante, técnico, quente, econômico...)",
        "5. Teste registrar vendas ganhas ou perdidas para ver os ciclos"
      ]
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
