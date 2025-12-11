import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ManagerKPIs {
  pendingLeads: number;
  inProgressLeads: number;
  wonSales: number;
  lostSales: number;
  conversionRate: number;
  avgResponseTime: number;
  hotLeads: number;
}

export interface FollowupMetrics {
  enabled: boolean;
  totalSent: number;
  last24h: number;
  last7days: number;
}

export interface PostSaleMetrics {
  totalCycles: number;
  activeCycles: number;
  closedCycles: number;
  avgResolutionTime: number;
  topIssues: { issue: string; count: number }[];
  satisfactionTrend: "positive" | "neutral" | "negative";
}

export interface LeadDistribution {
  bySeller: { name: string; pending: number; inProgress: number }[];
  byTemperature: { temperature: string; count: number }[];
}

export interface RiskCycle {
  id: string;
  customerName: string;
  sellerName: string;
  riskType: string;
  phase: string;
  customerId: string;
}

export interface ObjectionData {
  type: string;
  count: number;
}

export interface SellerPerformance {
  id: string;
  name: string;
  totalLeads: number;
  wonSales: number;
  lostSales: number;
  conversionRate: number;
  avgResponseTime: number;
  hotLeadsHandled: number;
}

export interface SalesTimelinePoint {
  date: string;
  won: number;
  lost: number;
}

export interface RecentSale {
  id: string;
  customerName: string;
  sellerName: string;
  status: "won" | "lost";
  reason: string | null;
  closedAt: string;
  cycleId: string;
}

export function useManagerDashboard() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [kpis, setKpis] = useState<ManagerKPIs>({
    pendingLeads: 0,
    inProgressLeads: 0,
    wonSales: 0,
    lostSales: 0,
    conversionRate: 0,
    avgResponseTime: 0,
    hotLeads: 0,
  });
  const [leadDistribution, setLeadDistribution] = useState<LeadDistribution>({
    bySeller: [],
    byTemperature: [],
  });
  const [riskCycles, setRiskCycles] = useState<RiskCycle[]>([]);
  const [objections, setObjections] = useState<ObjectionData[]>([]);
  const [sellerPerformance, setSellerPerformance] = useState<SellerPerformance[]>([]);
  const [salesTimeline, setSalesTimeline] = useState<SalesTimelinePoint[]>([]);
  const [recentSales, setRecentSales] = useState<RecentSale[]>([]);
  const [followupMetrics, setFollowupMetrics] = useState<FollowupMetrics>({
    enabled: false,
    totalSent: 0,
    last24h: 0,
    last7days: 0,
  });
  const [postSaleMetrics, setPostSaleMetrics] = useState<PostSaleMetrics>({
    totalCycles: 0,
    activeCycles: 0,
    closedCycles: 0,
    avgResolutionTime: 0,
    topIssues: [],
    satisfactionTrend: "neutral",
  });

  const fetchData = useCallback(async () => {
    if (!user?.companyId) return;

    setIsLoading(true);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      // OTIMIZAÇÃO: Primeira rodada de queries paralelas
      const [
        profilesResult,
        customersResult,
        companyResult,
        settingsResult,
      ] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, name, company_id")
          .eq("company_id", user.companyId),
        supabase
          .from("customers")
          .select("id, name, lead_status, seller_id, assigned_to")
          .eq("company_id", user.companyId)
          .limit(1000),
        supabase
          .from("companies")
          .select("allow_followups")
          .eq("id", user.companyId)
          .maybeSingle(),
        supabase
          .from("company_settings")
          .select("followups_enabled")
          .eq("company_id", user.companyId)
          .maybeSingle(),
      ]);

      const profiles = profilesResult.data || [];
      const customers = customersResult.data || [];
      const companyData = companyResult.data;
      const settingsData = settingsResult.data;
      const sellerIds = profiles.map((p) => p.user_id);
      const customerIds = customers.map((c) => c.id);

      // Segunda rodada de queries paralelas
      const [rolesResult, cyclesResult, salesResult, messagesResult] = await Promise.all([
        sellerIds.length > 0
          ? supabase
              .from("user_roles")
              .select("user_id, role")
              .in("user_id", sellerIds)
          : Promise.resolve({ data: [] }),
        customerIds.length > 0
          ? supabase
              .from("sale_cycles")
              .select("*")
              .in("customer_id", customerIds)
              .in("status", ["pending", "in_progress", "won", "lost"])
              .order("created_at", { ascending: false })
              .limit(500)
          : Promise.resolve({ data: [] }),
        supabase
          .from("sales")
          .select("*")
          .eq("company_id", user.companyId)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false })
          .limit(200),
        customerIds.length > 0
          ? supabase
              .from("messages")
              .select("id, customer_id, seller_id, direction, timestamp, cycle_id")
              .in("customer_id", customerIds)
              .gte("timestamp", sevenDaysAgo.toISOString())
              .order("timestamp", { ascending: false })
              .limit(1000)
          : Promise.resolve({ data: [] }),
      ]);

      const roles = rolesResult.data || [];
      const cycles = cyclesResult.data || [];
      const sales = salesResult.data || [];
      const messages = messagesResult.data || [];

      const actualSellerIds = roles.filter((r) => r.role === "seller").map((r) => r.user_id);
      const sellerProfiles = profiles.filter((p) => actualSellerIds.includes(p.user_id));

      // Terceira rodada: insights
      const messageIds = messages.map((m) => m.id);
      const insightsResult = messageIds.length > 0
        ? await supabase
            .from("insights")
            .select("*")
            .in("message_id", messageIds)
        : { data: [] };
      
      const insights = insightsResult.data || [];

      // Separate cycles by type and status
      const preSaleCycles = cycles.filter(c => (c as any).cycle_type !== 'post_sale');
      const postSaleCycles = cycles.filter(c => (c as any).cycle_type === 'post_sale');
      
      // CORREÇÃO: Filtrar apenas leads ATRIBUÍDOS (não do Inbox Pai)
      const assignedCustomerIds = new Set(
        customers.filter(c => c.assigned_to !== null).map(c => c.id)
      );
      const inboxPaiCustomerIds = new Set(
        customers.filter(c => c.assigned_to === null).map(c => c.id)
      );
      
      // Ciclos ativos são apenas de clientes atribuídos
      const activeCycles = preSaleCycles.filter(c => 
        (c.status === "pending" || c.status === "in_progress") &&
        assignedCustomerIds.has(c.customer_id)
      );
      const closedCycles = preSaleCycles.filter(c => c.status === "won" || c.status === "lost");

      // Calculate KPIs - apenas leads atribuídos
      const activeCustomerIds = activeCycles.map(c => c.customer_id);
      const pendingLeads = activeCycles.filter((c) => c.status === "pending").length;
      const inProgressLeads = activeCycles.filter((c) => c.status === "in_progress").length;
      const inboxPaiCount = inboxPaiCustomerIds.size; // Leads no Inbox Pai
      
      const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
      const last30DaysSales = sales.filter(s => s.created_at >= thirtyDaysAgoStr);
      const wonSales = last30DaysSales.filter((s) => s.status === "won").length;
      const lostSales = last30DaysSales.filter((s) => s.status === "lost").length;
      const totalSales = wonSales + lostSales;
      const conversionRate = totalSales > 0 ? Math.round((wonSales / totalSales) * 100) : 0;

      // Calculate avg response time
      const last30DaysMessages = messages.filter(m => m.timestamp >= thirtyDaysAgoStr);
      let totalResponseTime = 0;
      let responseCount = 0;
      const sortedMessages = [...last30DaysMessages].sort(
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

      // Get hot leads from ACTIVE cycles only
      const activeMessageIds = messages
        .filter(m => activeCycles.some(c => c.id === m.cycle_id))
        .map(m => m.id);
      
      const activeInsights = insights.filter(i => activeMessageIds.includes(i.message_id));

      const messageToCustomer = new Map<string, string>();
      messages.forEach((m) => messageToCustomer.set(m.id, m.customer_id));

      const customerTemperatures = new Map<string, string>();
      activeInsights
        .filter((i) => i.temperature)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .forEach((i) => {
          const customerId = messageToCustomer.get(i.message_id);
          if (customerId && !customerTemperatures.has(customerId)) {
            customerTemperatures.set(customerId, i.temperature!);
          }
        });

      const hotLeads = activeCustomerIds.filter(
        (id) => customerTemperatures.get(id) === "hot"
      ).length;

      setKpis({
        pendingLeads,
        inProgressLeads,
        wonSales,
        lostSales,
        conversionRate,
        avgResponseTime,
        hotLeads,
      });

      // Lead distribution by seller
      const bySeller = sellerProfiles.map((seller) => {
        const sellerActiveCycles = activeCycles.filter((c) => c.seller_id === seller.user_id);
        return {
          name: seller.name,
          pending: sellerActiveCycles.filter((c) => c.status === "pending").length,
          inProgress: sellerActiveCycles.filter((c) => c.status === "in_progress").length,
        };
      });

      // Lead distribution by temperature
      const tempCounts = { hot: 0, warm: 0, cold: 0 };
      activeCustomerIds.forEach((id) => {
        const temp = customerTemperatures.get(id) || "cold";
        if (temp === "hot") tempCounts.hot++;
        else if (temp === "warm") tempCounts.warm++;
        else tempCounts.cold++;
      });

      setLeadDistribution({
        bySeller: bySeller.filter((s) => s.pending + s.inProgress > 0),
        byTemperature: [
          { temperature: "Quente", count: tempCounts.hot },
          { temperature: "Morno", count: tempCounts.warm },
          { temperature: "Frio", count: tempCounts.cold },
        ],
      });

      // Risk cycles
      const risks: RiskCycle[] = [];

      for (const cycle of activeCycles) {
        const customer = customers.find((c) => c.id === cycle.customer_id);
        const seller = sellerProfiles.find((p) => p.user_id === cycle.seller_id);
        const cycleMessages = messages.filter((m) => m.customer_id === cycle.customer_id);
        const lastMessage = cycleMessages.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

        let riskType = "";

        if (lastMessage?.direction === "incoming") {
          const minutesSince =
            (Date.now() - new Date(lastMessage.timestamp).getTime()) / 60000;
          if (minutesSince > 30) {
            riskType = "Sem resposta há " + Math.round(minutesSince) + " min";
          }
        }

        if (!riskType && customerTemperatures.get(cycle.customer_id) === "hot") {
          riskType = "Lead quente";
        }

        if (!riskType) {
          const cycleInsights = insights.filter((i) =>
            cycleMessages.some((m) => m.id === i.message_id)
          );
          const hasOpenObjection = cycleInsights.some((i) => i.objection);
          if (hasOpenObjection) {
            riskType = "Objeção aberta";
          }
        }

        if (riskType && customer && seller) {
          risks.push({
            id: cycle.id,
            customerName: customer.name,
            sellerName: seller.name,
            riskType,
            phase: cycle.status === "pending" ? "Abertura" : "Em progresso",
            customerId: cycle.customer_id,
          });
        }
      }

      setRiskCycles(risks.slice(0, 10));

      // Objections analysis
      const objectionCounts: Record<string, number> = {
        preço: 0,
        confiança: 0,
        demora: 0,
        concorrência: 0,
        outra: 0,
      };

      cycles
        .filter((c) => c.status === "lost" && c.lost_reason)
        .forEach((c) => {
          const reason = c.lost_reason!.toLowerCase();
          if (reason.includes("preço") || reason.includes("caro")) objectionCounts["preço"]++;
          else if (reason.includes("confiança") || reason.includes("confiar"))
            objectionCounts["confiança"]++;
          else if (reason.includes("demora") || reason.includes("tempo"))
            objectionCounts["demora"]++;
          else if (reason.includes("concorr")) objectionCounts["concorrência"]++;
          else objectionCounts["outra"]++;
        });

      insights
        .filter((i) => i.objection)
        .forEach((i) => {
          const obj = i.objection!.toLowerCase();
          if (obj.includes("preço") || obj.includes("caro")) objectionCounts["preço"]++;
          else if (obj.includes("confiança") || obj.includes("confiar"))
            objectionCounts["confiança"]++;
          else if (obj.includes("demora") || obj.includes("tempo")) objectionCounts["demora"]++;
          else if (obj.includes("concorr")) objectionCounts["concorrência"]++;
          else objectionCounts["outra"]++;
        });

      setObjections(
        Object.entries(objectionCounts)
          .map(([type, count]) => ({ type, count }))
          .filter((o) => o.count > 0)
          .sort((a, b) => b.count - a.count)
      );

      // Seller performance
      const performance: SellerPerformance[] = sellerProfiles.map((seller) => {
        const sellerSales = sales.filter((s) => s.seller_id === seller.user_id);
        // CORREÇÃO: Usar ciclos ativos de pré-venda, não lead_status do customer
        const sellerActiveCycles = activeCycles.filter((c) => c.seller_id === seller.user_id);
        const sellerActiveCustomerIds = sellerActiveCycles.map((c) => c.customer_id);
        const sellerWon = sellerSales.filter((s) => s.status === "won").length;
        const sellerLost = sellerSales.filter((s) => s.status === "lost").length;
        const sellerTotal = sellerWon + sellerLost;
        const sellerHot = sellerActiveCustomerIds.filter(
          (id) => customerTemperatures.get(id) === "hot"
        ).length;

        const sellerMessages = messages.filter((m) => m.seller_id === seller.user_id);
        let sellerResponseTime = 0;
        let sellerResponseCount = 0;
        const sortedSellerMsgs = [...sellerMessages].sort(
          (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );

        for (let i = 1; i < sortedSellerMsgs.length; i++) {
          const prev = sortedSellerMsgs[i - 1];
          const curr = sortedSellerMsgs[i];
          if (
            prev.customer_id === curr.customer_id &&
            prev.direction === "incoming" &&
            curr.direction === "outgoing"
          ) {
            const diff =
              (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) / 60000;
            if (diff < 60) {
              sellerResponseTime += diff;
              sellerResponseCount++;
            }
          }
        }

        return {
          id: seller.user_id,
          name: seller.name,
          totalLeads: sellerActiveCycles.length,
          wonSales: sellerWon,
          lostSales: sellerLost,
          conversionRate: sellerTotal > 0 ? Math.round((sellerWon / sellerTotal) * 100) : 0,
          avgResponseTime:
            sellerResponseCount > 0
              ? Math.round(sellerResponseTime / sellerResponseCount)
              : 0,
          hotLeadsHandled: sellerHot,
        };
      });

      setSellerPerformance(performance.filter((p) => p.totalLeads > 0 || p.wonSales > 0 || p.lostSales > 0));

      // Sales timeline (last 30 days)
      const timelineBaseDate = new Date();
      const timeline: SalesTimelinePoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(timelineBaseDate);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayWon = sales.filter((s) => s.status === "won" && s.created_at.startsWith(dateStr)).length;
        const dayLost = sales.filter((s) => s.status === "lost" && s.created_at.startsWith(dateStr)).length;
        timeline.push({ date: dateStr, won: dayWon, lost: dayLost });
      }
      setSalesTimeline(timeline);

      // Recent sales
      const recent: RecentSale[] = [];
      const sortedClosedCycles = closedCycles
        .sort(
          (a, b) =>
            new Date(b.closed_at || b.created_at).getTime() -
            new Date(a.closed_at || a.created_at).getTime()
        )
        .slice(0, 20);

      for (const cycle of sortedClosedCycles) {
        const customer = customers.find((c) => c.id === cycle.customer_id);
        const seller = sellerProfiles.find((p) => p.user_id === cycle.seller_id);
        if (customer && seller) {
          recent.push({
            id: cycle.id,
            customerName: customer.name,
            sellerName: seller.name,
            status: cycle.status as "won" | "lost",
            reason: cycle.lost_reason,
            closedAt: cycle.closed_at || cycle.created_at,
            cycleId: cycle.id,
          });
        }
      }
      setRecentSales(recent);

      // Follow-up metrics
      const followupsEnabled = companyData?.allow_followups && settingsData?.followups_enabled;

      if (followupsEnabled && actualSellerIds.length > 0) {
        const now = new Date();
        const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const last7days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const { data: followupMsgs } = await supabase
          .from("messages")
          .select("id, timestamp, content")
          .in("seller_id", actualSellerIds)
          .eq("direction", "outgoing")
          .ilike("content", "%[Follow-up automático]%");

        const totalSent = followupMsgs?.length || 0;
        const last24hCount = followupMsgs?.filter(m => new Date(m.timestamp) >= last24h).length || 0;
        const last7daysCount = followupMsgs?.filter(m => new Date(m.timestamp) >= last7days).length || 0;

        setFollowupMetrics({
          enabled: true,
          totalSent,
          last24h: last24hCount,
          last7days: last7daysCount,
        });
      } else {
        setFollowupMetrics({
          enabled: false,
          totalSent: 0,
          last24h: 0,
          last7days: 0,
        });
      }

      // Post-sale metrics
      const activePostSale = postSaleCycles.filter(c => c.status === "in_progress" || c.status === "pending");
      const closedPostSale = postSaleCycles.filter(c => (c as any).status === "closed");
      
      let totalResolutionTime = 0;
      let resolutionCount = 0;
      closedPostSale.forEach(cycle => {
        if (cycle.closed_at && cycle.created_at) {
          const hours = (new Date(cycle.closed_at).getTime() - new Date(cycle.created_at).getTime()) / (1000 * 60 * 60);
          totalResolutionTime += hours;
          resolutionCount++;
        }
      });
      const avgResolutionTime = resolutionCount > 0 ? Math.round(totalResolutionTime / resolutionCount) : 0;

      const postSaleMessageIds = messages
        .filter(m => postSaleCycles.some(c => c.id === m.cycle_id))
        .map(m => m.id);
      
      const postSaleInsights = insights.filter(i => postSaleMessageIds.includes(i.message_id));
      
      let positiveCount = 0;
      let negativeCount = 0;
      postSaleInsights.forEach(insight => {
        const sentiment = insight.sentiment?.toLowerCase();
        if (sentiment === "positive" || sentiment === "excited") positiveCount++;
        if (sentiment === "negative" || sentiment === "angry") negativeCount++;
      });
      
      let satisfactionTrend: "positive" | "neutral" | "negative" = "neutral";
      if (positiveCount > negativeCount * 2) satisfactionTrend = "positive";
      else if (negativeCount > positiveCount) satisfactionTrend = "negative";

      const issuesCounts: Record<string, number> = {};
      const issueLabels: Record<string, string> = {
        problem: "Problema com produto",
        question: "Dúvida de uso",
        complaint: "Reclamação",
        delay: "Prazo/Demora",
        trust: "Confiança",
        price: "Preço",
        quality: "Qualidade",
        support: "Suporte",
        delivery: "Entrega",
        defect: "Defeito",
        refund: "Reembolso",
        exchange: "Troca",
        none: "",
      };
      
      postSaleInsights.forEach(insight => {
        const objection = insight.objection;
        if (objection && objection !== "none") {
          const issue = issueLabels[objection.toLowerCase()] || objection;
          issuesCounts[issue] = (issuesCounts[issue] || 0) + 1;
        }
      });
      
      const topIssues = Object.entries(issuesCounts)
        .map(([issue, count]) => ({ issue, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setPostSaleMetrics({
        totalCycles: postSaleCycles.length,
        activeCycles: activePostSale.length,
        closedCycles: closedPostSale.length,
        avgResolutionTime,
        topIssues,
        satisfactionTrend,
      });

    } catch (error) {
      console.error("Error fetching manager dashboard:", error);
    } finally {
      setIsLoading(false);
    }
  }, [user?.companyId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.companyId) return;

    const channel = supabase
      .channel("manager-dashboard")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "sale_cycles" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.companyId, fetchData]);

  return {
    isLoading,
    kpis,
    leadDistribution,
    riskCycles,
    objections,
    sellerPerformance,
    salesTimeline,
    recentSales,
    followupMetrics,
    postSaleMetrics,
    refresh: fetchData,
  };
}
