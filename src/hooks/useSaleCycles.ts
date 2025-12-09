import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SaleCycle } from "@/components/sale/SaleCycleHistory";

interface UseSaleCyclesOptions {
  customerId: string;
  sellerId?: string;
}

export const useSaleCycles = ({ customerId, sellerId }: UseSaleCyclesOptions) => {
  const [cycles, setCycles] = useState<SaleCycle[]>([]);
  const [activeCycle, setActiveCycle] = useState<SaleCycle | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchCycles = useCallback(async () => {
    if (!customerId) return;

    try {
      const { data, error } = await supabase
        .from("sale_cycles")
        .select("*")
        .eq("customer_id", customerId)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Type assertion to handle the database response
      const typedCycles = (data || []).map((c) => ({
        ...c,
        last_activity_at: c.last_activity_at || null,
      })) as SaleCycle[];
      setCycles(typedCycles);

      // Find active cycle (pending or in_progress)
      const active = typedCycles.find(
        (c) => c.status === "pending" || c.status === "in_progress"
      );
      setActiveCycle(active || null);
    } catch (error) {
      console.error("Error fetching cycles:", error);
    } finally {
      setIsLoading(false);
    }
  }, [customerId]);

  useEffect(() => {
    fetchCycles();

    // Subscribe to changes
    const channel = supabase
      .channel(`cycles-${customerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "sale_cycles",
          filter: `customer_id=eq.${customerId}`,
        },
        () => {
          fetchCycles();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [customerId, fetchCycles]);

  const createCycle = useCallback(async () => {
    if (!customerId || !sellerId) return null;

    try {
      const { data, error } = await supabase
        .from("sale_cycles")
        .insert({
          customer_id: customerId,
          seller_id: sellerId,
          status: "pending",
        })
        .select()
        .single();

      if (error) throw error;

      await fetchCycles();
      return data as SaleCycle;
    } catch (error) {
      console.error("Error creating cycle:", error);
      return null;
    }
  }, [customerId, sellerId, fetchCycles]);

  const getOrCreateActiveCycle = useCallback(async () => {
    if (activeCycle) return activeCycle;
    return await createCycle();
  }, [activeCycle, createCycle]);

  const closeCycle = useCallback(
    async (
      cycleId: string,
      status: "won" | "lost",
      reason?: string,
      summary?: string
    ) => {
      try {
        const { error } = await supabase
          .from("sale_cycles")
          .update({
            status,
            closed_at: new Date().toISOString(),
            lost_reason: status === "lost" ? reason : null,
            won_summary: status === "won" ? summary : null,
          })
          .eq("id", cycleId);

        if (error) throw error;

        // Also update customer lead_status
        await supabase
          .from("customers")
          .update({ lead_status: status })
          .eq("id", customerId);

        await fetchCycles();
        return true;
      } catch (error) {
        console.error("Error closing cycle:", error);
        return false;
      }
    },
    [customerId, fetchCycles]
  );

  const updateCycleStatus = useCallback(
    async (cycleId: string, status: "pending" | "in_progress") => {
      try {
        const { error } = await supabase
          .from("sale_cycles")
          .update({ status })
          .eq("id", cycleId);

        if (error) throw error;

        // Also update customer lead_status
        await supabase
          .from("customers")
          .update({ lead_status: status })
          .eq("id", customerId);

        await fetchCycles();
        return true;
      } catch (error) {
        console.error("Error updating cycle status:", error);
        return false;
      }
    },
    [customerId, fetchCycles]
  );

  const getCycleNumber = useCallback(
    (cycleId: string) => {
      const index = [...cycles].reverse().findIndex((c) => c.id === cycleId);
      return index >= 0 ? index + 1 : 1;
    },
    [cycles]
  );

  return {
    cycles,
    activeCycle,
    isLoading,
    fetchCycles,
    createCycle,
    getOrCreateActiveCycle,
    closeCycle,
    updateCycleStatus,
    getCycleNumber,
  };
};
