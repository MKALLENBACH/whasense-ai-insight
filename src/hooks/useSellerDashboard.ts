import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface SellerKPIs {
  pendingLeads: number;
  inProgressLeads: number;
  wonSales: number;
  hotLeads: number;
  avgResponseTime: number;
  riskCyclesCount: number;
}

export interface Priority {
  id: string;
  customerId: string;
  customerName: string;
  temperature: "hot" | "warm" | "cold";
  status: string;
  urgencyType: string;
  lastMessageAt: string;
}

export interface FunnelStage {
  stage: string;
  label: string;
  leads: {
    id: string;
    customerId: string;
    customerName: string;
    temperature: "hot" | "warm" | "cold";
    lastActivity: string;
  }[];
}

export interface MonthlyConversion {
  month: string;
  won: number;
  lost: number;
  rate: number;
}

export interface PersonalPerformance {
  messagesSent: number;
  avgResponseTime: number;
  bestDayOfWeek: string;
  comparedToTeam: number;
}

export interface RecentCycle {
  id: string;
  customerId: string;
  customerName: string;
  phase: string;
  status: string;
  temperature: "hot" | "warm" | "cold";
  createdAt: string;
}

const FUNNEL_STAGES = [
  { stage: "abertura", label: "Abertura" },
  { stage: "descoberta", label: "Descoberta" },
  { stage: "diagnostico", label: "Diagnóstico" },
  { stage: "apresentacao_solucao", label: "Apresentação" },
  { stage: "validacao", label: "Validação" },
  { stage: "proposta", label: "Proposta" },
  { stage: "fechamento", label: "Fechamento" },
  { stage: "pos_venda", label: "Pós-venda" },
  { stage: "reativacao", label: "Reativação" },
];

const DAY_NAMES = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];

export function useSellerDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<SellerKPIs>({
    pendingLeads: 0,
    inProgressLeads: 0,
    wonSales: 0,
    hotLeads: 0,
    avgResponseTime: 0,
    riskCyclesCount: 0,
  });
  const [priorities, setPriorities] = useState<Priority[]>([]);
  const [funnel, setFunnel] = useState<FunnelStage[]>([]);
  const [monthlyConversion, setMonthlyConversion] = useState<MonthlyConversion[]>([]);
  const [personalPerformance, setPersonalPerformance] = useState<PersonalPerformance>({
    messagesSent: 0,
    avgResponseTime: 0,
    bestDayOfWeek: "",
    comparedToTeam: 0,
  });
  const [recentCycles, setRecentCycles] = useState<RecentCycle[]>([]);

  const fetchData = useCallback(async () => {
    if (!user?.id) return;

    setIsLoading(true);
    try {
      const sellerId = user.id;

      // OTIMIZAÇÃO: Executar todas as queries em paralelo
      const [messagesResult, cyclesResult, salesResult] = await Promise.all([
        supabase
          .from("messages")
          .select("id, customer_id, direction, timestamp, cycle_id")
          .eq("seller_id", sellerId)
          .order("timestamp", { ascending: false })
          .limit(1000),
        supabase
          .from("sale_cycles")
          .select("*")
          .eq("seller_id", sellerId)
          .order("created_at", { ascending: false })
          .limit(500),
        supabase
          .from("sales")
          .select("*")
          .eq("seller_id", sellerId)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      const messages = messagesResult.data || [];
      const cycles = cyclesResult.data || [];
      const sales = salesResult.data || [];

      const customerIds = [...new Set(messages.map((m) => m.customer_id))];

      // Segunda rodada de queries paralelas
      // CORREÇÃO: Buscar customers onde assigned_to = sellerId
      const [customersResult, insightsResult] = await Promise.all([
        supabase
          .from("customers")
          .select("id, name, lead_status, assigned_to")
          .eq("assigned_to", sellerId) // CRÍTICO: Só leads atribuídos ao vendedor
          .limit(500),
        messages.length > 0
          ? supabase
              .from("insights")
              .select("*")
              .in("message_id", messages.map((m) => m.id))
          : Promise.resolve({ data: [] }),
      ]);

      const customers = customersResult.data || [];
      const insights = insightsResult.data || [];

      // Build temperature map
      const messageToCustomer = new Map<string, string>();
      messages.forEach((m) => messageToCustomer.set(m.id, m.customer_id));

      const customerTemperatures = new Map<string, string>();
      insights
        .filter((i) => i.temperature)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .forEach((i) => {
          const customerId = messageToCustomer.get(i.message_id);
          if (customerId && !customerTemperatures.has(customerId)) {
            customerTemperatures.set(customerId, i.temperature!);
          }
        });

      // Calculate KPIs - only count customers with active PRE-SALE cycles
      // Post-sale cycles (closed) should not count towards pending/in_progress
      const activeCyclesPreSale = cycles.filter(
        (c) => (c.status === "pending" || c.status === "in_progress") && c.cycle_type !== "post_sale"
      );
      const customersWithActivePreSale = new Set(activeCyclesPreSale.map((c) => c.customer_id));
      
      const activeCustomers = customers.filter((c) => customersWithActivePreSale.has(c.id));
      const pendingLeads = activeCyclesPreSale.filter((c) => c.status === "pending").length;
      const inProgressLeads = activeCyclesPreSale.filter((c) => c.status === "in_progress").length;
      const wonSales = sales.filter((s) => s.status === "won").length;
      const hotLeads = activeCustomers.filter(
        (c) => customerTemperatures.get(c.id) === "hot"
      ).length;

      // Calculate avg response time
      let totalResponseTime = 0;
      let responseCount = 0;
      const sortedMessages = [...messages].sort(
        (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      for (let i = 1; i < sortedMessages.length; i++) {
        const prev = sortedMessages[i - 1];
        const curr = sortedMessages[i];
        if (
          prev.customer_id === curr.customer_id &&
          prev.direction === "incoming" &&
          curr.direction === "outgoing"
        ) {
          const diff =
            (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000;
          if (diff < 60) {
            totalResponseTime += diff;
            responseCount++;
          }
        }
      }
      const avgResponseTime = responseCount > 0 ? Math.round(totalResponseTime / responseCount) : 0;

      // Count risk cycles
      let riskCyclesCount = 0;
      // Use only active pre-sale cycles for priorities
      const activeCycles = activeCyclesPreSale;
      const priorityList: Priority[] = [];

      for (const cycle of activeCycles) {
        const customer = customers.find((c) => c.id === cycle.customer_id);
        if (!customer) continue;

        const cycleMessages = messages.filter((m) => m.customer_id === cycle.customer_id);
        const lastMessage = cycleMessages.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

        let urgencyType = "";

        // Check for unanswered messages
        if (lastMessage?.direction === "incoming") {
          const minutesSince =
            (Date.now() - new Date(lastMessage.timestamp).getTime()) / 60000;
          if (minutesSince > 5) {
            urgencyType = "Cliente aguardando";
            riskCyclesCount++;
          }
        }

        // Check for hot lead
        const temp = customerTemperatures.get(cycle.customer_id) || "cold";
        if (!urgencyType && temp === "hot") {
          urgencyType = "Lead quente";
        }

        // Check for open objection
        if (!urgencyType) {
          const cycleInsights = insights.filter((i) =>
            cycleMessages.some((m) => m.id === i.message_id)
          );
          const hasOpenObjection = cycleInsights.some((i) => i.objection);
          if (hasOpenObjection) {
            urgencyType = "Objeção aberta";
          }
        }

        // Check for stale conversation
        if (!urgencyType && lastMessage) {
          const minutesSince =
            (Date.now() - new Date(lastMessage.timestamp).getTime()) / 60000;
          if (minutesSince > 120) {
            urgencyType = "Conversa parada";
          }
        }

        if (urgencyType) {
          priorityList.push({
            id: cycle.id,
            customerId: customer.id,
            customerName: customer.name,
            temperature: temp as "hot" | "warm" | "cold",
            status: cycle.status,
            urgencyType,
            lastMessageAt: lastMessage?.timestamp || cycle.created_at,
          });
        }
      }

      // Sort by urgency
      priorityList.sort((a, b) => {
        const urgencyOrder: Record<string, number> = {
          "Cliente aguardando": 4,
          "Lead quente": 3,
          "Objeção aberta": 2,
          "Conversa parada": 1,
        };
        return (urgencyOrder[b.urgencyType] || 0) - (urgencyOrder[a.urgencyType] || 0);
      });

      setKpis({
        pendingLeads,
        inProgressLeads,
        wonSales,
        hotLeads,
        avgResponseTime,
        riskCyclesCount,
      });

      setPriorities(priorityList.slice(0, 10));

      // Build funnel stages
      const funnelData: FunnelStage[] = FUNNEL_STAGES.map((s) => ({
        ...s,
        leads: [],
      }));

      for (const cycle of activeCycles) {
        const customer = customers.find((c) => c.id === cycle.customer_id);
        if (!customer) continue;

        const cycleMessages = messages.filter((m) => m.customer_id === cycle.customer_id);
        const lastMessage = cycleMessages.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        const temp = customerTemperatures.get(cycle.customer_id) || "cold";

        let stageIndex = 0;
        const msgCount = cycleMessages.length;
        if (msgCount > 20) stageIndex = 5;
        else if (msgCount > 15) stageIndex = 4;
        else if (msgCount > 10) stageIndex = 3;
        else if (msgCount > 5) stageIndex = 2;
        else if (msgCount > 2) stageIndex = 1;

        if (cycle.status === "in_progress" && stageIndex < 2) stageIndex = 2;

        funnelData[stageIndex].leads.push({
          id: cycle.id,
          customerId: customer.id,
          customerName: customer.name,
          temperature: temp as "hot" | "warm" | "cold",
          lastActivity: lastMessage?.timestamp || cycle.created_at,
        });
      }

      setFunnel(funnelData.filter((s) => s.leads.length > 0));

      // Monthly conversion (last 6 months)
      const monthlyData: MonthlyConversion[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const monthLabel = date.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });

        const monthWon = sales.filter(
          (s) => s.status === "won" && s.created_at.startsWith(monthStr)
        ).length;
        const monthLost = sales.filter(
          (s) => s.status === "lost" && s.created_at.startsWith(monthStr)
        ).length;
        const total = monthWon + monthLost;

        monthlyData.push({
          month: monthLabel,
          won: monthWon,
          lost: monthLost,
          rate: total > 0 ? Math.round((monthWon / total) * 100) : 0,
        });
      }
      setMonthlyConversion(monthlyData);

      // Personal performance
      const messagesSent = messages.filter((m) => m.direction === "outgoing").length;

      // Best day of week
      const dayCount = [0, 0, 0, 0, 0, 0, 0];
      messages
        .filter((m) => m.direction === "outgoing")
        .forEach((m) => {
          const day = new Date(m.timestamp).getDay();
          dayCount[day]++;
        });
      const bestDayIndex = dayCount.indexOf(Math.max(...dayCount));
      const bestDayOfWeek = dayCount[bestDayIndex] > 0 ? DAY_NAMES[bestDayIndex] : "N/A";

      setPersonalPerformance({
        messagesSent,
        avgResponseTime,
        bestDayOfWeek,
        comparedToTeam: 0,
      });

      // Recent cycles
      const recent: RecentCycle[] = [];
      const allCycles = cycles.slice(0, 20);

      for (const cycle of allCycles) {
        const customer = customers.find((c) => c.id === cycle.customer_id);
        if (!customer) continue;

        const temp = customerTemperatures.get(cycle.customer_id) || "cold";
        const cycleMessages = messages.filter((m) => m.customer_id === cycle.customer_id).length;

        let phase = "Abertura";
        if (cycle.status === "won") phase = "Ganho";
        else if (cycle.status === "lost") phase = "Perdido";
        else if (cycleMessages > 10) phase = "Apresentação";
        else if (cycleMessages > 5) phase = "Descoberta";
        else if (cycleMessages > 2) phase = "Abertura";

        recent.push({
          id: cycle.id,
          customerId: customer.id,
          customerName: customer.name,
          phase,
          status: cycle.status,
          temperature: temp as "hot" | "warm" | "cold",
          createdAt: cycle.created_at,
        });
      }
      setRecentCycles(recent);
    } catch (error) {
      console.error("Error fetching seller dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel("seller-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_cycles" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchData]);

  return {
    isLoading,
    kpis,
    priorities,
    funnel,
    monthlyConversion,
    personalPerformance,
    recentCycles,
    refresh: fetchData,
  };
}
