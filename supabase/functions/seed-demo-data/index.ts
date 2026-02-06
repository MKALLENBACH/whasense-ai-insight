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

// 20 clientes com perfis variados e objetivos fitness diferentes
const DEMO_CUSTOMERS = [
  { name: "Rafael Mendes", phone: "+5511999101001", objective: "ganho_massa", profile: "iniciante" },
  { name: "Juliana Costa", phone: "+5511999102002", objective: "emagrecimento", profile: "motivada" },
  { name: "Fernando Silva", phone: "+5511999103003", objective: "performance", profile: "tecnico" },
  { name: "Mariana Santos", phone: "+5511999104004", objective: "home_gym", profile: "pressa" },
  { name: "Bruno Oliveira", phone: "+5511999105005", objective: "suplementacao", profile: "economico" },
  { name: "Camila Rodrigues", phone: "+5511999106006", objective: "roupas", profile: "pesquisando" },
  { name: "Lucas Ferreira", phone: "+5511999107007", objective: "ganho_massa", profile: "super_quente" },
  { name: "Patricia Almeida", phone: "+5511999108008", objective: "recuperacao", profile: "desconfiada" },
  { name: "Diego Martins", phone: "+5511999109009", objective: "equipamentos", profile: "indeciso" },
  { name: "Amanda Lima", phone: "+5511999110010", objective: "pre_treino", profile: "recorrente" },
  { name: "Thiago Souza", phone: "+5511999111011", objective: "ganho_massa", profile: "tecnico" },
  { name: "Beatriz Fernandes", phone: "+5511999112012", objective: "emagrecimento", profile: "motivada" },
  { name: "Ricardo Gomes", phone: "+5511999113013", objective: "performance", profile: "super_quente" },
  { name: "Larissa Pereira", phone: "+5511999114014", objective: "roupas", profile: "pesquisando" },
  { name: "Gustavo Carvalho", phone: "+5511999115015", objective: "suplementacao", profile: "economico" },
  { name: "Fernanda Ribeiro", phone: "+5511999116016", objective: "home_gym", profile: "pressa" },
  { name: "Anderson Castro", phone: "+5511999117017", objective: "recuperacao", profile: "desconfiada" },
  { name: "Carolina Nascimento", phone: "+5511999118018", objective: "pre_treino", profile: "recorrente" },
  { name: "Marcelo Barbosa", phone: "+5511999119019", objective: "ganho_massa", profile: "iniciante" },
  { name: "Aline Moreira", phone: "+5511999120020", objective: "emagrecimento", profile: "indeciso" },
];

// Conversas realistas de academia
const CONVERSATION_TEMPLATES = [
  // Lead QUENTE - Ganho de Massa (vai ganhar)
  {
    status: 'won',
    temperature: 'hot',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Oi! Preciso de whey e creatina para ganhar massa muscular. Vocês tem?" },
      { direction: 'outgoing', content: "Olá! Temos sim! Temos o combo perfeito: Whey Isolado 900g + Creatina Creapure 300g. É o mais vendido para quem quer ganho de massa! 💪" },
      { direction: 'incoming', content: "Qual o preço do combo?" },
      { direction: 'outgoing', content: "O combo sai por R$189,90 com frete grátis! Parcela em até 3x sem juros. Posso separar pra você?" },
      { direction: 'incoming', content: "Fechado! Como faço pra pagar?" },
      { direction: 'outgoing', content: "Perfeito! Vou te enviar o link de pagamento agora. Qual seu endereço completo para entrega?" },
    ]
  },
  // Lead QUENTE - Emagrecimento (vai ganhar)
  {
    status: 'won',
    temperature: 'hot',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Boa tarde! Quero começar a tomar termogênico. Qual vocês recomendam?" },
      { direction: 'outgoing', content: "Boa tarde! Para emagrecimento, nosso campeão de vendas é o Lipo 6 Black Ultra Concentrate. Acelera o metabolismo e dá energia pro treino! 🔥" },
      { direction: 'incoming', content: "Esse é bom mesmo? Já vi em outras lojas" },
      { direction: 'outgoing', content: "É excelente! E aqui você leva por R$149,90 com brinde de coqueteleira. Garantia de produto original!" },
      { direction: 'incoming', content: "Manda o link que vou comprar agora" },
    ]
  },
  // Lead MORNO - Objeção de preço
  {
    status: 'in_progress',
    temperature: 'warm',
    sentiment: 'neutro',
    objection: 'preco',
    messages: [
      { direction: 'incoming', content: "Oi, quero ver os preços de whey protein" },
      { direction: 'outgoing', content: "Olá! Temos várias opções de whey. Concentrado a partir de R$89,90 e Isolado a partir de R$159,90. Qual seu objetivo?" },
      { direction: 'incoming', content: "Quero o isolado, mas tá caro né... vou pesquisar mais" },
      { direction: 'outgoing', content: "Entendo! Mas olha, estamos com promoção de 10% de desconto para primeira compra. Fica R$143,90 com frete grátis! Quer aproveitar?" },
    ]
  },
  // Lead MORNO - Dúvida técnica
  {
    status: 'in_progress',
    temperature: 'warm',
    sentiment: 'neutro',
    messages: [
      { direction: 'incoming', content: "Qual a diferença entre creatina mono e creapure?" },
      { direction: 'outgoing', content: "Ótima pergunta! A Creapure é uma creatina alemã com 99.9% de pureza, certificada. A mono comum tem em média 95% de pureza. Para resultados melhores, recomendo Creapure!" },
      { direction: 'incoming', content: "E quanto custa cada uma?" },
      { direction: 'outgoing', content: "Creatina comum 300g: R$79,90 / Creapure 300g: R$119,90. A diferença de R$40 vale muito pela qualidade e absorção!" },
      { direction: 'incoming', content: "Vou pensar e te aviso" },
    ]
  },
  // Lead FRIO - Só pesquisando
  {
    status: 'pending',
    temperature: 'cold',
    sentiment: 'neutro',
    messages: [
      { direction: 'incoming', content: "Vocês tem legging de academia?" },
      { direction: 'outgoing', content: "Temos sim! Vários modelos a partir de R$89,90. Posso te mandar o catálogo?" },
    ]
  },
  // Lead FRIO - Sem resposta
  {
    status: 'pending',
    temperature: 'cold',
    sentiment: 'neutro',
    messages: [
      { direction: 'incoming', content: "Boa noite, quanto é o haltere de 10kg?" },
      { direction: 'outgoing', content: "Boa noite! O par de halteres de 10kg sai por R$189,90. Temos também kit completo com vários pesos. Quer que eu te mande as opções?" },
    ]
  },
  // Lead PERDIDO - Preço
  {
    status: 'lost',
    temperature: 'cold',
    sentiment: 'negativo',
    objection: 'preco',
    lostReason: 'Encontrou preço menor no concorrente',
    messages: [
      { direction: 'incoming', content: "Quanto custa o BCAA 2:1:1?" },
      { direction: 'outgoing', content: "O BCAA 2:1:1 com 120 cápsulas sai por R$89,90!" },
      { direction: 'incoming', content: "Achei mais barato em outra loja, R$69. Obrigado" },
      { direction: 'outgoing', content: "Entendo! Mas aqui você tem garantia de produto original e frete grátis. Consigo fazer por R$79,90, o que acha?" },
      { direction: 'incoming', content: "Não, valeu. Já comprei na outra" },
    ]
  },
  // Lead PERDIDO - Desconfiança
  {
    status: 'lost',
    temperature: 'cold',
    sentiment: 'negativo',
    objection: 'confianca',
    lostReason: 'Cliente não confiou na loja',
    messages: [
      { direction: 'incoming', content: "Vocês são loja autorizada? Tenho medo de comprar produto falso" },
      { direction: 'outgoing', content: "Somos sim! Trabalhamos apenas com produtos originais, temos CNPJ e nota fiscal. Posso te mostrar nosso certificado de distribuidor autorizado!" },
      { direction: 'incoming', content: "Não sei, vou comprar na loja física mesmo. Mais seguro" },
    ]
  },
  // Lead QUENTE - Equipamentos
  {
    status: 'won',
    temperature: 'hot',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Preciso montar uma academia em casa URGENTE. O que vocês tem?" },
      { direction: 'outgoing', content: "Perfeito! Temos kits completos para home gym! Kit Iniciante (halteres + barra + anilhas): R$899 / Kit Intermediário com banco: R$1.499. Entrega em 3 dias!" },
      { direction: 'incoming', content: "Quero o intermediário! Aceita cartão?" },
      { direction: 'outgoing', content: "Aceita sim! Parcela em até 10x. Vou te passar o link agora!" },
      { direction: 'incoming', content: "Manda!" },
    ]
  },
  // Lead MORNO - Pré-treino
  {
    status: 'in_progress',
    temperature: 'warm',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Oi! Comprei o C4 de vocês mês passado e amei! Tem algum pré-treino novo?" },
      { direction: 'outgoing', content: "Que bom que gostou! Chegou o C4 Ultimate, versão mais forte. E também o Insane Labz que tá fazendo sucesso! Quer experimentar?" },
      { direction: 'incoming', content: "Me conta mais sobre o Insane" },
      { direction: 'outgoing', content: "O Insane Labz é pra quem quer treino intenso! Tem 350mg de cafeína, foco extremo. R$169,90 o pote. Nossos clientes estão adorando!" },
    ]
  },
  // Lead QUENTE - Combo grande
  {
    status: 'won',
    temperature: 'hot',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Opa! Preciso de whey, creatina, pré-treino e BCAA. Tem desconto no combo?" },
      { direction: 'outgoing', content: "Eaí! Temos o Super Combo Hipertrofia com tudo isso por R$449,90 (economia de R$120)! É o mais completo! 💪" },
      { direction: 'incoming', content: "Caramba, bom preço! Vocês entregam rápido?" },
      { direction: 'outgoing', content: "Entregamos em 2-3 dias úteis! E rastreio por WhatsApp. Quer fechar?" },
      { direction: 'incoming', content: "Bora! Me manda o pix" },
    ]
  },
  // Lead PERDIDO - Demora
  {
    status: 'lost',
    temperature: 'warm',
    sentiment: 'negativo',
    objection: 'demora',
    lostReason: 'Prazo de entrega não atendeu',
    messages: [
      { direction: 'incoming', content: "Qual o prazo de entrega pra Manaus?" },
      { direction: 'outgoing', content: "Para Manaus o prazo é de 10-15 dias úteis por transportadora." },
      { direction: 'incoming', content: "Muito tempo, preciso pra semana que vem. Vou ver outro lugar, obrigado" },
    ]
  },
  // Lead EM PROGRESSO - Colágeno
  {
    status: 'in_progress',
    temperature: 'warm',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Boa noite! Quero começar a tomar colágeno. Qual marca é boa?" },
      { direction: 'outgoing', content: "Boa noite! Recomendo o Colágeno Verisol, que é específico para pele. Temos sachês (R$89,90/30 dias) ou cápsulas (R$69,90/60 caps). Qual prefere?" },
      { direction: 'incoming', content: "Prefiro sachê. Tem sabor?" },
      { direction: 'outgoing', content: "Tem sim! Morango, limão e natural. O de morango é o mais vendido! Posso separar pra você?" },
    ]
  },
  // Lead QUENTE - Roupas
  {
    status: 'won',
    temperature: 'hot',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Oi! Vi no insta de vocês umas leggings muito lindas! Ainda tem?" },
      { direction: 'outgoing', content: "Oi! Temos sim! A coleção nova está incrível. Legging de compressão R$129,90, Top esportivo R$69,90. Qual tamanho você usa?" },
      { direction: 'incoming', content: "M nos dois! Quero a legging preta e o top rosa" },
      { direction: 'outgoing', content: "Ótima escolha! Kit legging + top fica R$179,90 com 10% de desconto. Posso enviar link?" },
      { direction: 'incoming', content: "Manda sim! Vou pagar agora" },
    ]
  },
  // Lead PENDENTE - Hipercalórico
  {
    status: 'pending',
    temperature: 'warm',
    sentiment: 'neutro',
    messages: [
      { direction: 'incoming', content: "Bom dia! Sou muito magro e quero ganhar peso. O que vocês indicam?" },
      { direction: 'outgoing', content: "Bom dia! Para ganho de peso, recomendo Hipercalórico + Creatina. O Mass Titanium tem 1500 calorias por dose! Combo sai R$199,90. Quer saber mais?" },
    ]
  },
  // Lead EM PROGRESSO - Glutamina
  {
    status: 'in_progress',
    temperature: 'warm',
    sentiment: 'positivo',
    messages: [
      { direction: 'incoming', content: "Glutamina serve pra que exatamente?" },
      { direction: 'outgoing', content: "A Glutamina ajuda na recuperação muscular e imunidade! Ideal pra quem treina pesado. Temos de 300g por R$89,90. Você treina quantas vezes por semana?" },
      { direction: 'incoming', content: "Treino 5x por semana, pesado" },
      { direction: 'outgoing', content: "Então vai te ajudar muito! Toma 5g após o treino. Com esse volume de treino, vai sentir diferença na recuperação. Quer levar?" },
    ]
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const adminSecret = Deno.env.get('ADMIN_CREATION_SECRET');
    if (!adminSecret) {
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { secret } = await req.json();
    if (secret !== adminSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: string[] = [];

    // 1. Get Free plan for trial
    const { data: freePlan } = await supabase
      .from('plans')
      .select('id')
      .eq('name', 'Free')
      .maybeSingle();

    // 2. Clean up existing demo data
    const { data: existingCompany } = await supabase
      .from('companies')
      .select('id')
      .eq('name', DEMO_COMPANY_NAME)
      .maybeSingle();

    if (existingCompany) {
      console.log('Cleaning up existing data for company:', existingCompany.id);
      
      // Delete in order of dependencies
      const { data: customers } = await supabase
        .from('customers')
        .select('id')
        .eq('company_id', existingCompany.id);
      
      if (customers && customers.length > 0) {
        const customerIds = customers.map(c => c.id);
        
        // Delete insights via messages
        const { data: messages } = await supabase
          .from('messages')
          .select('id')
          .in('customer_id', customerIds);
        
        if (messages && messages.length > 0) {
          await supabase.from('insights').delete().in('message_id', messages.map(m => m.id));
        }
        
        await supabase.from('messages').delete().in('customer_id', customerIds);
        await supabase.from('alerts').delete().in('customer_id', customerIds);
        await supabase.from('sale_cycles').delete().in('customer_id', customerIds);
        await supabase.from('sales').delete().in('customer_id', customerIds);
        await supabase.from('customers').delete().eq('company_id', existingCompany.id);
      }
      
      results.push(`🧹 Dados existentes limpos`);
    }

    // 3. Create or update company with Free trial
    let companyId: string;
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + 7);
    
    if (existingCompany) {
      companyId = existingCompany.id;
      await supabase
        .from('companies')
        .update({
          segment: "Fitness e Suplementação",
          description: "Loja especializada em suplementos, equipamentos e roupas fitness",
          plan_id: freePlan?.id || null,
          is_active: true,
          free_start_date: new Date().toISOString().split('T')[0],
          free_end_date: trialEndDate.toISOString().split('T')[0],
        })
        .eq('id', companyId);
      results.push(`✅ Empresa "${DEMO_COMPANY_NAME}" atualizada com trial`);
    } else {
      const { data: newCompany, error: companyError } = await supabase
        .from('companies')
        .insert({ 
          name: DEMO_COMPANY_NAME,
          segment: "Fitness e Suplementação",
          description: "Loja especializada em suplementos, equipamentos e roupas fitness",
          plan_id: freePlan?.id || null,
          is_active: true,
          free_start_date: new Date().toISOString().split('T')[0],
          free_end_date: trialEndDate.toISOString().split('T')[0],
        })
        .select('id')
        .single();

      if (companyError) throw companyError;
      companyId = newCompany.id;
      results.push(`✅ Empresa "${DEMO_COMPANY_NAME}" criada com trial de 7 dias`);
    }

    // 4. Create users
    const userIds: { [email: string]: string } = {};
    const sellerIds: string[] = [];

    for (const user of DEMO_USERS) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existingUser = existingUsers?.users?.find(u => u.email === user.email);

      if (existingUser) {
        userIds[user.email] = existingUser.id;
        if (user.role === 'seller') sellerIds.push(existingUser.id);
        
        await supabase
          .from('profiles')
          .update({ company_id: companyId, name: user.name, is_active: true })
          .eq('user_id', existingUser.id);
        results.push(`✅ Usuário "${user.email}" atualizado`);
        continue;
      }

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

      await supabase
        .from('profiles')
        .update({ company_id: companyId, name: user.name, is_active: true })
        .eq('user_id', userId);

      await supabase
        .from('user_roles')
        .upsert({ user_id: userId, role: user.role }, { onConflict: 'user_id' });

      results.push(`✅ Usuário "${user.email}" criado (${user.role})`);
    }

    // 5. Create WhatsApp sessions for sellers
    for (const sellerId of sellerIds) {
      await supabase
        .from('whatsapp_sessions')
        .upsert({
          seller_id: sellerId,
          status: 'connected',
          is_active: true,
          phone_number: '+5511999' + Math.floor(Math.random() * 900000 + 100000),
          last_connected_at: new Date().toISOString(),
        }, { onConflict: 'seller_id' });
    }
    results.push(`✅ Sessões WhatsApp criadas`);

    // 6. Create customers and conversations
    let customersCreated = 0;
    let cyclesCreated = 0;
    let messagesCreated = 0;
    let insightsCreated = 0;
    let salesCreated = 0;
    let alertsCreated = 0;

    for (let i = 0; i < DEMO_CUSTOMERS.length; i++) {
      const customer = DEMO_CUSTOMERS[i];
      const sellerId = sellerIds[i % sellerIds.length];
      const conversation = CONVERSATION_TEMPLATES[i % CONVERSATION_TEMPLATES.length];
      
      // Create customer
      const { data: newCustomer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name: customer.name,
          phone: customer.phone,
          seller_id: sellerId,
          assigned_to: sellerId,
          company_id: companyId,
          lead_status: conversation.status,
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        continue;
      }
      customersCreated++;

      // Create sale cycle
      const cycleCreatedAt = new Date();
      cycleCreatedAt.setDate(cycleCreatedAt.getDate() - Math.floor(Math.random() * 30));
      
      const { data: cycle, error: cycleError } = await supabase
        .from('sale_cycles')
        .insert({
          customer_id: newCustomer.id,
          seller_id: sellerId,
          status: conversation.status,
          created_at: cycleCreatedAt.toISOString(),
          closed_at: ['won', 'lost'].includes(conversation.status) ? new Date().toISOString() : null,
          lost_reason: conversation.lostReason || null,
          last_activity_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (cycleError) {
        console.error('Error creating cycle:', cycleError);
        continue;
      }
      cyclesCreated++;

      // Create messages
      for (let j = 0; j < conversation.messages.length; j++) {
        const msg = conversation.messages[j];
        const msgTimestamp = new Date(cycleCreatedAt);
        msgTimestamp.setMinutes(msgTimestamp.getMinutes() + (j * 5));

        const { data: message, error: msgError } = await supabase
          .from('messages')
          .insert({
            customer_id: newCustomer.id,
            seller_id: sellerId,
            content: msg.content,
            direction: msg.direction,
            timestamp: msgTimestamp.toISOString(),
            cycle_id: cycle.id,
          })
          .select('id')
          .single();

        if (msgError) {
          console.error('Error creating message:', msgError);
          continue;
        }
        messagesCreated++;

        // Create insight for incoming messages
        if (msg.direction === 'incoming') {
          const { error: insightError } = await supabase
            .from('insights')
            .insert({
              message_id: message.id,
              temperature: conversation.temperature as 'hot' | 'warm' | 'cold',
              sentiment: conversation.sentiment || 'neutro',
              objection: conversation.objection || null,
              suggestion: getSuggestion(conversation.temperature, conversation.objection),
              intention: getIntention(conversation.status),
              insight_type: 'message_analysis',
            });

          if (!insightError) insightsCreated++;
        }
      }

      // Create sales record for won/lost
      if (['won', 'lost'].includes(conversation.status)) {
        const saleDate = new Date();
        saleDate.setDate(saleDate.getDate() - Math.floor(Math.random() * 30));
        
        const { error: saleError } = await supabase
          .from('sales')
          .insert({
            customer_id: newCustomer.id,
            seller_id: sellerId,
            company_id: companyId,
            status: conversation.status as 'won' | 'lost',
            reason: conversation.lostReason || null,
            created_at: saleDate.toISOString(),
          });

        if (!saleError) salesCreated++;
      }

      // Create alerts for pending/in_progress
      if (['pending', 'in_progress'].includes(conversation.status)) {
        const alertType = conversation.temperature === 'hot' ? 'hot_lead' : 
                         conversation.objection ? 'open_objection' : 'waiting_response';
        const severity = conversation.temperature === 'hot' ? 'critical' : 
                        conversation.objection ? 'warning' : 'info';
        
        const { error: alertError } = await supabase
          .from('alerts')
          .insert({
            customer_id: newCustomer.id,
            seller_id: sellerId,
            cycle_id: cycle.id,
            alert_type: alertType,
            severity: severity,
            message: getAlertMessage(alertType, customer.name),
          });

        if (!alertError) alertsCreated++;
      }
    }

    results.push(`✅ ${customersCreated} clientes criados`);
    results.push(`✅ ${cyclesCreated} ciclos de venda criados`);
    results.push(`✅ ${messagesCreated} mensagens criadas`);
    results.push(`✅ ${insightsCreated} insights de IA criados`);
    results.push(`✅ ${salesCreated} registros de venda criados`);
    results.push(`✅ ${alertsCreated} alertas criados`);

    return new Response(JSON.stringify({
      success: true,
      results,
      summary: {
        customers: customersCreated,
        cycles: cyclesCreated,
        messages: messagesCreated,
        insights: insightsCreated,
        sales: salesCreated,
        alerts: alertsCreated,
      },
      credentials: {
        manager: { email: "gestor@exercit.com", password: "123456" },
        seller1: { email: "vendedor1@exercit.com", password: "123456" },
        seller2: { email: "vendedor2@exercit.com", password: "123456" },
      },
      instructions: [
        "1. Faça login como gestor para ver o dashboard completo",
        "2. Faça login como vendedor para ver as conversas",
        "3. O trial de 7 dias está ativo com todas as funcionalidades",
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

function getSuggestion(temperature: string, objection?: string): string {
  if (objection === 'preco') {
    return "Ofereça desconto ou destaque o custo-benefício e qualidade do produto";
  }
  if (objection === 'confianca') {
    return "Mostre certificados, avaliações de clientes e garantias";
  }
  if (objection === 'demora') {
    return "Verifique opções de envio expresso ou retirada";
  }
  if (temperature === 'hot') {
    return "Cliente pronto para comprar! Facilite o fechamento com link de pagamento";
  }
  if (temperature === 'warm') {
    return "Mantenha contato e ofereça informações adicionais sobre o produto";
  }
  return "Faça follow-up amigável para reengajar o cliente";
}

function getIntention(status: string): string {
  if (status === 'won') return 'compra_confirmada';
  if (status === 'lost') return 'desistencia';
  if (status === 'in_progress') return 'considerando';
  return 'pesquisa_inicial';
}

function getAlertMessage(alertType: string, customerName: string): string {
  switch (alertType) {
    case 'hot_lead':
      return `🔥 Lead quente! ${customerName} está pronto para comprar`;
    case 'open_objection':
      return `⚠️ ${customerName} tem objeção aberta - resolver rapidamente`;
    case 'waiting_response':
      return `⏰ ${customerName} aguardando resposta`;
    default:
      return `Atenção necessária para ${customerName}`;
  }
}
