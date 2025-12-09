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

  const fetchData = useCallback(async () => {
    if (!user?.companyId) return;

    setIsLoading(true);
    try {
      // Get all sellers in the company
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, name, company_id")
        .eq("company_id", user.companyId);

      const sellerIds = profiles?.map((p) => p.user_id) || [];

      // Get user roles to filter only sellers
      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", sellerIds);

      const actualSellerIds = roles?.filter((r) => r.role === "seller").map((r) => r.user_id) || [];
      const sellerProfiles = profiles?.filter((p) => actualSellerIds.includes(p.user_id)) || [];

      // Get all customers for the company
      const { data: customers } = await supabase
        .from("customers")
        .select("id, name, lead_status, seller_id")
        .eq("company_id", user.companyId);

      const customerIds = customers?.map((c) => c.id) || [];

      // Get all sale cycles
      const { data: cycles } = await supabase
        .from("sale_cycles")
        .select("*")
        .in("customer_id", customerIds.length > 0 ? customerIds : [""]);

      // Separate active and closed cycles
      const activeCycles = cycles?.filter(c => c.status === "pending" || c.status === "in_progress") || [];
      const closedCycles = cycles?.filter(c => c.status === "won" || c.status === "lost") || [];

      // Get all sales
      const { data: sales } = await supabase
        .from("sales")
        .select("*")
        .eq("company_id", user.companyId)
        .order("created_at", { ascending: false });

      // Get all messages
      const { data: messages } = await supabase
        .from("messages")
        .select("id, customer_id, seller_id, direction, timestamp, cycle_id")
        .in("customer_id", customerIds.length > 0 ? customerIds : [""]);

      const messageIds = messages?.map((m) => m.id) || [];

      // Get all insights
      const { data: insights } = await supabase
        .from("insights")
        .select("*")
        .in("message_id", messageIds.length > 0 ? messageIds : [""]);

      // Calculate KPIs - use active cycles only for operational metrics
      const activeCustomerIds = activeCycles.map(c => c.customer_id);
      const pendingLeads = activeCycles.filter((c) => c.status === "pending").length;
      const inProgressLeads = activeCycles.filter((c) => c.status === "in_progress").length;
      
      // Historical metrics from all sales
      const wonSales = sales?.filter((s) => s.status === "won").length || 0;
      const lostSales = sales?.filter((s) => s.status === "lost").length || 0;
      const totalSales = wonSales + lostSales;
      const conversionRate = totalSales > 0 ? Math.round((wonSales / totalSales) * 100) : 0;

      // Calculate avg response time (simplified: count messages with quick responses)
      let totalResponseTime = 0;
      let responseCount = 0;
      const sortedMessages = [...(messages || [])].sort(
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

      // Get hot leads (pending/in_progress with hot temperature)
      // Get hot leads from ACTIVE cycles only
      const activeMessageIds = messages
        ?.filter(m => activeCycles.some(c => c.id === m.cycle_id))
        .map(m => m.id) || [];
      
      const activeInsights = insights?.filter(i => activeMessageIds.includes(i.message_id)) || [];

      const messageToCustomer = new Map<string, string>();
      messages?.forEach((m) => messageToCustomer.set(m.id, m.customer_id));

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

      // Lead distribution by seller - ONLY ACTIVE CYCLES
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

      // Risk cycles - find cycles with issues (only active cycles)
      const risks: RiskCycle[] = [];

      for (const cycle of activeCycles) {
        const customer = customers?.find((c) => c.id === cycle.customer_id);
        const seller = sellerProfiles.find((p) => p.user_id === cycle.seller_id);
        const cycleMessages =
          messages?.filter((m) => m.customer_id === cycle.customer_id) || [];
        const lastMessage = cycleMessages.sort(
          (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];

        let riskType = "";

        // Check for unanswered messages
        if (lastMessage?.direction === "incoming") {
          const minutesSince =
            (Date.now() - new Date(lastMessage.timestamp).getTime()) / 60000;
          if (minutesSince > 30) {
            riskType = "Sem resposta há " + Math.round(minutesSince) + " min";
          }
        }

        // Check for hot lead
        if (!riskType && customerTemperatures.get(cycle.customer_id) === "hot") {
          riskType = "Lead quente";
        }

        // Check for open objection
        if (!riskType) {
          const cycleInsights = insights?.filter((i) =>
            cycleMessages.some((m) => m.id === i.message_id)
          );
          const hasOpenObjection = cycleInsights?.some((i) => i.objection);
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

      // From lost reasons
      cycles
        ?.filter((c) => c.status === "lost" && c.lost_reason)
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

      // From insights objections
      insights
        ?.filter((i) => i.objection)
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
        const sellerSales = sales?.filter((s) => s.seller_id === seller.user_id) || [];
        const sellerCustomers = customers?.filter((c) => c.seller_id === seller.user_id) || [];
        const sellerWon = sellerSales.filter((s) => s.status === "won").length;
        const sellerLost = sellerSales.filter((s) => s.status === "lost").length;
        const sellerTotal = sellerWon + sellerLost;
        const sellerActiveIds = sellerCustomers
          .filter((c) => c.lead_status === "pending" || c.lead_status === "in_progress")
          .map((c) => c.id);
        const sellerHot = sellerActiveIds.filter(
          (id) => customerTemperatures.get(id) === "hot"
        ).length;

        // Calculate seller response time
        const sellerMessages =
          messages?.filter((m) => m.seller_id === seller.user_id) || [];
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
              (new Date(curr.timestamp).getTime() - new Date(prev.timestamp).getTime()) /
              60000;
            if (diff < 60) {
              sellerResponseTime += diff;
              sellerResponseCount++;
            }
          }
        }

        return {
          id: seller.user_id,
          name: seller.name,
          totalLeads: sellerCustomers.length,
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

      setSellerPerformance(performance.filter((p) => p.totalLeads > 0));

      // Sales timeline (last 30 days)
      const today = new Date();
      const timeline: SalesTimelinePoint[] = [];
      for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split("T")[0];
        const dayWon =
          sales?.filter((s) => s.status === "won" && s.created_at.startsWith(dateStr)).length ||
          0;
        const dayLost =
          sales?.filter((s) => s.status === "lost" && s.created_at.startsWith(dateStr)).length ||
          0;
        timeline.push({
          date: dateStr,
          won: dayWon,
          lost: dayLost,
        });
      }
      setSalesTimeline(timeline);

      // Recent sales - use already defined closedCycles
      const recent: RecentSale[] = [];
      const sortedClosedCycles = closedCycles
        .sort(
          (a, b) =>
            new Date(b.closed_at || b.created_at).getTime() -
            new Date(a.closed_at || a.created_at).getTime()
        )
        .slice(0, 20);

      for (const cycle of sortedClosedCycles) {
        const customer = customers?.find((c) => c.id === cycle.customer_id);
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
    refresh: fetchData,
  };
}
