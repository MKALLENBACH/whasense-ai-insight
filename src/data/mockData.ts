import { Conversation, Message, AIInsight, DashboardMetrics, Alert, Sale } from "@/types";

export const mockConversations: Conversation[] = [
  {
    id: "1",
    contact: {
      id: "c1",
      name: "Maria Silva",
      phone: "+55 11 99999-1234",
      company: "Tech Solutions",
    },
    lastMessage: "Qual o prazo de entrega?",
    lastMessageTime: new Date(Date.now() - 5 * 60 * 1000),
    unreadCount: 2,
    leadTemperature: "hot",
    saleStatus: "pending",
    assignedTo: "user1",
  },
  {
    id: "2",
    contact: {
      id: "c2",
      name: "João Santos",
      phone: "+55 11 98888-5678",
      company: "Consultoria ABC",
    },
    lastMessage: "Preciso pensar mais um pouco...",
    lastMessageTime: new Date(Date.now() - 30 * 60 * 1000),
    unreadCount: 0,
    leadTemperature: "warm",
    saleStatus: "pending",
    assignedTo: "user1",
  },
  {
    id: "3",
    contact: {
      id: "c3",
      name: "Ana Costa",
      phone: "+55 21 97777-9012",
      company: "Startup XYZ",
    },
    lastMessage: "Vocês têm desconto para grandes volumes?",
    lastMessageTime: new Date(Date.now() - 2 * 60 * 60 * 1000),
    unreadCount: 1,
    leadTemperature: "hot",
    saleStatus: "pending",
    assignedTo: "user1",
  },
  {
    id: "4",
    contact: {
      id: "c4",
      name: "Carlos Oliveira",
      phone: "+55 31 96666-3456",
    },
    lastMessage: "Obrigado pela informação",
    lastMessageTime: new Date(Date.now() - 24 * 60 * 60 * 1000),
    unreadCount: 0,
    leadTemperature: "cold",
    saleStatus: "pending",
    assignedTo: "user1",
  },
  {
    id: "5",
    contact: {
      id: "c5",
      name: "Fernanda Lima",
      phone: "+55 41 95555-7890",
      company: "E-commerce Plus",
    },
    lastMessage: "Fechado! Pode enviar o contrato",
    lastMessageTime: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    unreadCount: 0,
    leadTemperature: "hot",
    saleStatus: "won",
    assignedTo: "user1",
  },
];

export const mockMessages: Record<string, Message[]> = {
  "1": [
    {
      id: "m1",
      conversationId: "1",
      content: "Olá! Vi seu anúncio e tenho interesse no produto.",
      sender: "contact",
      timestamp: new Date(Date.now() - 60 * 60 * 1000),
      isRead: true,
    },
    {
      id: "m2",
      conversationId: "1",
      content: "Olá Maria! Fico feliz com seu interesse. Como posso ajudar?",
      sender: "user",
      timestamp: new Date(Date.now() - 55 * 60 * 1000),
      isRead: true,
    },
    {
      id: "m3",
      conversationId: "1",
      content: "Quero saber mais sobre as funcionalidades e os planos disponíveis.",
      sender: "contact",
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      isRead: true,
    },
    {
      id: "m4",
      conversationId: "1",
      content: "Temos 3 planos: Básico (R$99/mês), Pro (R$199/mês) e Enterprise (personalizado). O plano Pro é o mais popular!",
      sender: "user",
      timestamp: new Date(Date.now() - 25 * 60 * 1000),
      isRead: true,
    },
    {
      id: "m5",
      conversationId: "1",
      content: "Interessante! O plano Pro parece bom. Qual o prazo de entrega?",
      sender: "contact",
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      isRead: false,
    },
  ],
};

export const mockAIInsight: AIInsight = {
  emotion: "Interessado e Ansioso",
  emotionScore: 85,
  purchaseIntent: 78,
  objections: ["Prazo de entrega", "Custo-benefício"],
  suggestedResponses: [
    "A ativação é imediata após a confirmação do pagamento! 🚀",
    "Para o plano Pro, você tem acesso liberado em até 24 horas.",
    "Posso garantir uma condição especial se fecharmos hoje!",
  ],
  leadTemperature: "hot",
  keyTopics: ["planos", "preço", "prazo"],
};

export const mockDashboardMetrics: DashboardMetrics = {
  totalConversations: 156,
  activeConversations: 34,
  hotLeads: 12,
  warmLeads: 18,
  coldLeads: 4,
  wonSales: 23,
  lostSales: 8,
  conversionRate: 74.2,
  avgResponseTime: 4.5,
};

export const mockAlerts: Alert[] = [
  {
    id: "a1",
    type: "hot_lead",
    message: "Maria Silva demonstrou alta intenção de compra!",
    conversationId: "1",
    createdAt: new Date(Date.now() - 5 * 60 * 1000),
    isRead: false,
  },
  {
    id: "a2",
    type: "objection",
    message: "João Santos mencionou objeção de preço",
    conversationId: "2",
    createdAt: new Date(Date.now() - 45 * 60 * 1000),
    isRead: false,
  },
  {
    id: "a3",
    type: "opportunity",
    message: "Ana Costa perguntou sobre desconto - oportunidade de upsell!",
    conversationId: "3",
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    isRead: true,
  },
];

export const mockSales: Sale[] = [
  {
    id: "s1",
    conversationId: "5",
    contactName: "Fernanda Lima",
    value: 2388,
    status: "won",
    closedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    notes: "Plano Pro anual",
  },
  {
    id: "s2",
    conversationId: "6",
    contactName: "Roberto Almeida",
    value: 1188,
    status: "won",
    closedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  },
  {
    id: "s3",
    conversationId: "7",
    contactName: "Patricia Mendes",
    value: 0,
    status: "lost",
    closedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    notes: "Escolheu concorrente",
  },
];
