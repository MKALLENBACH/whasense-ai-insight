export type UserRole = "vendedor" | "gestor" | "admin";

export type LeadTemperature = "cold" | "warm" | "hot";

export type SaleStatus = "pending" | "won" | "lost";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  avatar?: string;
  company?: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  sender: "contact" | "user";
  timestamp: Date;
  isRead: boolean;
}

export interface AIInsight {
  emotion: string;
  emotionScore: number;
  purchaseIntent: number;
  objections: string[];
  suggestedResponses: string[];
  leadTemperature: LeadTemperature;
  keyTopics: string[];
}

export interface Conversation {
  id: string;
  contact: Contact;
  lastMessage: string;
  lastMessageTime: Date;
  unreadCount: number;
  leadTemperature: LeadTemperature;
  saleStatus: SaleStatus;
  assignedTo: string;
  aiInsight?: AIInsight;
}

export interface Sale {
  id: string;
  conversationId: string;
  contactName: string;
  value: number;
  status: "won" | "lost";
  closedAt: Date;
  notes?: string;
}

export interface DashboardMetrics {
  totalConversations: number;
  activeConversations: number;
  hotLeads: number;
  warmLeads: number;
  coldLeads: number;
  wonSales: number;
  lostSales: number;
  conversionRate: number;
  avgResponseTime: number;
}

export interface Alert {
  id: string;
  type: "hot_lead" | "objection" | "long_wait" | "opportunity";
  message: string;
  conversationId: string;
  createdAt: Date;
  isRead: boolean;
}
