import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Brazilian first names
const firstNames = [
  "Ana", "Bruno", "Carla", "Daniel", "Eduardo", "Fernanda", "Gabriel", "Helena",
  "Igor", "Juliana", "Lucas", "Mariana", "Nicolas", "Olivia", "Pedro", "Rafaela",
  "Samuel", "Tatiana", "Victor", "Yasmin", "André", "Beatriz", "Carlos", "Diana",
  "Felipe", "Giovana", "Henrique", "Isabella", "João", "Larissa", "Matheus", "Natália",
  "Otávio", "Paula", "Ricardo", "Sofia", "Thiago", "Valentina", "Wagner", "Zara",
  "Antônio", "Camila", "Diego", "Elisa", "Fábio", "Gabriela", "Hugo", "Isadora",
  "Júlio", "Karina"
];

const lastNames = [
  "Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Alves", "Pereira",
  "Lima", "Gomes", "Costa", "Ribeiro", "Martins", "Carvalho", "Almeida", "Lopes",
  "Soares", "Fernandes", "Vieira", "Barbosa", "Rocha", "Dias", "Nascimento", "Andrade",
  "Moreira", "Nunes", "Marques", "Machado", "Mendes", "Freitas", "Cardoso", "Ramos",
  "Gonçalves", "Santana", "Teixeira", "Moura", "Castro", "Araújo", "Correia", "Pinto",
  "Monteiro", "Cavalcanti", "Batista", "Campos", "Cunha", "Azevedo", "Borges", "Melo",
  "Xavier", "Nogueira"
];

// Initial customer messages about fitness products
const initialMessages = [
  "Oi, vi o anúncio de vocês no Instagram! Quero saber mais sobre whey protein",
  "Bom dia! Vocês têm creatina em estoque?",
  "Olá! Qual o melhor suplemento para ganho de massa?",
  "Boa tarde, quanto custa o kit iniciante?",
  "Oi! Estou procurando pré-treino sem cafeína, tem?",
  "Olá, vocês fazem entrega para todo Brasil?",
  "Boa noite! Quero montar uma academia em casa, o que vocês recomendam?",
  "Oi! Qual a diferença entre whey concentrado e isolado?",
  "Olá, vi que vocês vendem halteres. Tem kit completo?",
  "Bom dia! Preciso de suplementos para emagrecer",
  "Oi, vocês têm BCAA? Qual o preço?",
  "Olá! Quero começar a tomar suplementos, por onde começo?",
  "Boa tarde! Vocês vendem roupas de academia também?",
  "Oi! O whey de vocês é importado ou nacional?",
  "Olá, quanto tempo demora a entrega?",
  "Bom dia! Preciso de um tapete para yoga, tem?",
  "Oi! Vocês parcelam no cartão?",
  "Olá! Qual suplemento vocês recomendam para definição?",
  "Boa noite! Tem promoção essa semana?",
  "Oi, vi que vocês vendem luvas de musculação",
  "Olá! Preciso de um cinto para agachamento",
  "Bom dia! Vocês têm multivitamínico?",
  "Oi! Qual o prazo de validade dos produtos?",
  "Olá, vocês aceitam PIX?",
  "Boa tarde! Quero comprar um rack para home gym",
  "Oi! Tem glutamina em cápsulas?",
  "Olá! Vocês vendem elásticos de resistência?",
  "Bom dia! Qual o melhor pré-treino de vocês?",
  "Oi, preciso de orientação sobre dosagem de creatina",
  "Olá! Vocês têm whey zero lactose?",
  "Boa noite! Quanto custa o frete para São Paulo?",
  "Oi! Vocês vendem omega 3?",
  "Olá, qual a forma de pagamento?",
  "Bom dia! Tem colágeno em pó?",
  "Oi! Vocês fazem combo com desconto?",
  "Olá! Preciso de suplemento para articulação",
  "Boa tarde! Vocês têm termogênico?",
  "Oi, qual o whey mais vendido de vocês?",
  "Olá! Vocês vendem barras de proteína?",
  "Bom dia! Tem camiseta de treino masculina?",
  "Oi! Preciso de step para exercícios em casa",
  "Olá, vocês têm proteína vegana?",
  "Boa noite! Qual o preço do combo whey + creatina?",
  "Oi! Vocês vendem squeeze ou coqueteleira?",
  "Olá! Tem melatonina para dormir melhor?",
  "Bom dia! Preciso de corda de pular profissional",
  "Oi, vocês têm ZMA?",
  "Olá! Qual suplemento ajuda na recuperação muscular?",
  "Boa tarde! Vocês vendem anilhas?",
  "Oi! Quero saber mais sobre os produtos de vocês"
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ADMIN_CREATION_SECRET = Deno.env.get('ADMIN_CREATION_SECRET');
    
    const { secret, companyId, sellerCount = 2, customerCount = 50 } = await req.json();
    
    // Validate secret
    if (!ADMIN_CREATION_SECRET || secret !== ADMIN_CREATION_SECRET) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get company info
    const { data: company, error: companyError } = await supabase
      .from('companies')
      .select('id, name')
      .eq('id', companyId)
      .single();
    
    if (companyError || !company) {
      throw new Error(`Company not found: ${companyError?.message}`);
    }
    
    console.log(`Seeding data for company: ${company.name}`);
    
    const createdSellers: any[] = [];
    const createdCustomers: any[] = [];
    
    // Create sellers
    for (let i = 0; i < sellerCount; i++) {
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${firstName} ${lastName}`;
      const email = `vendedor.${firstName.toLowerCase()}.${Date.now()}${i}@demo.whasense.com.br`;
      const password = `Demo@${Date.now()}${i}`;
      
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name }
      });
      
      if (authError) {
        console.error(`Error creating seller ${i + 1}:`, authError);
        continue;
      }
      
      // Create profile
      await supabase.from('profiles').insert({
        user_id: authUser.user.id,
        email,
        name,
        company_id: companyId,
        is_active: true
      });
      
      // Create role
      await supabase.from('user_roles').insert({
        user_id: authUser.user.id,
        role: 'seller'
      });
      
      // Create WhatsApp session
      await supabase.from('whatsapp_sessions').insert({
        seller_id: authUser.user.id,
        status: 'connected',
        is_active: true,
        phone_number: `5551${900000000 + i}`
      });
      
      createdSellers.push({ id: authUser.user.id, name, email });
      console.log(`Created seller: ${name}`);
    }
    
    // Get one seller for message reference (needed for messages table)
    const { data: existingSellers } = await supabase
      .from('profiles')
      .select('user_id, name')
      .eq('company_id', companyId)
      .eq('is_active', true);
    
    const allSellers = existingSellers || [];
    if (allSellers.length === 0) {
      throw new Error('No sellers found in company');
    }
    
    // Use first seller as default for message records
    const defaultSellerId = allSellers[0].user_id;
    
    // Create customers with messages in Inbox Pai (assigned_to = null)
    for (let i = 0; i < customerCount; i++) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const name = `${firstName} ${lastName}`;
      const phone = `5511${900000000 + Math.floor(Math.random() * 99999999)}`;
      
      // Create customer (unassigned - will appear in Inbox Pai)
      const { data: customer, error: customerError } = await supabase
        .from('customers')
        .insert({
          name,
          phone,
          company_id: companyId,
          seller_id: defaultSellerId, // Reference seller but not assigned
          assigned_to: null, // This makes it appear in Inbox Pai
          lead_status: 'pending',
          is_incomplete: false
        })
        .select()
        .single();
      
      if (customerError) {
        console.error(`Error creating customer ${i + 1}:`, customerError);
        continue;
      }
      
      // Create sale cycle
      const { data: cycle, error: cycleError } = await supabase
        .from('sale_cycles')
        .insert({
          customer_id: customer.id,
          seller_id: defaultSellerId,
          status: 'pending',
          cycle_type: 'sale'
        })
        .select()
        .single();
      
      if (cycleError) {
        console.error(`Error creating cycle for customer ${i + 1}:`, cycleError);
        continue;
      }
      
      // Create initial message
      const messageContent = initialMessages[i % initialMessages.length];
      const { data: message, error: messageError } = await supabase
        .from('messages')
        .insert({
          customer_id: customer.id,
          seller_id: defaultSellerId,
          cycle_id: cycle.id,
          content: messageContent,
          direction: 'incoming',
          timestamp: new Date(Date.now() - Math.random() * 3600000).toISOString() // Random time in last hour
        })
        .select()
        .single();
      
      if (messageError) {
        console.error(`Error creating message for customer ${i + 1}:`, messageError);
        continue;
      }
      
      // Update cycle with start message
      await supabase
        .from('sale_cycles')
        .update({
          start_message_id: message.id,
          start_message_timestamp: message.timestamp,
          last_activity_at: message.timestamp
        })
        .eq('id', cycle.id);
      
      createdCustomers.push({ id: customer.id, name, phone, message: messageContent });
      console.log(`Created customer ${i + 1}: ${name}`);
    }
    
    return new Response(JSON.stringify({
      success: true,
      company: company.name,
      sellersCreated: createdSellers.length,
      customersCreated: createdCustomers.length,
      sellers: createdSellers,
      message: `Created ${createdSellers.length} sellers and ${createdCustomers.length} customers in Inbox Pai`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    console.error('Error seeding data:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
