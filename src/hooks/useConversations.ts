import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ConversationData, AlertData } from "@/components/conversation/ConversationCard";

interface UseConversationsProps {
  accessToken: string | undefined;
  sellerId?: string | null; // For manager filtering
}

export const useConversations = ({ accessToken, sellerId }: UseConversationsProps) => {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [alerts, setAlerts] = useState<AlertData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchConversations = useCallback(async () => {
    if (!accessToken) {
      setIsLoading(false);
      return;
    }

    try {
      // Build URL with seller_id filter if provided
      let url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/list-conversations`;
      if (sellerId) {
        url += `?seller_id=${sellerId}`;
      }

      const [conversationsResponse, alertsResponse] = await Promise.all([
        fetch(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }).then(res => res.json()),
        supabase
          .from('alerts')
          .select('id, customer_id, alert_type, severity, message')
      ]);

      setConversations(conversationsResponse?.conversations || []);
      setAlerts(alertsResponse.data || []);
    } catch (error: any) {
      if (error?.message?.includes('401') || error?.message?.includes('token') || error?.message?.includes('auth')) {
        console.log('Session expired, skipping fetch');
      } else {
        console.error('Error fetching conversations:', error);
        toast.error('Erro ao carregar conversas');
      }
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [accessToken, sellerId]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  // Reset loading state when sellerId changes
  useEffect(() => {
    if (sellerId !== undefined) {
      setIsLoading(true);
    }
  }, [sellerId]);

  // Initial fetch
  useEffect(() => {
    if (accessToken) {
      fetchConversations();
    } else {
      setIsLoading(false);
    }
  }, [accessToken, sellerId, fetchConversations]);

  // Realtime subscriptions with debounce
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const debouncedFetch = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        fetchConversations();
      }, 500); // 500ms debounce
    };

    const channel = supabase
      .channel('conversations-updates')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'customers' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, debouncedFetch)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, debouncedFetch)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'sale_cycles' }, debouncedFetch)
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  // Filter helpers
  const getStatus = (c: ConversationData) => c.cycleStatus || c.leadStatus || 'pending';
  const getCycleType = (c: ConversationData) => c.cycleType || 'pre_sale';

  // Active conversations (pending/in_progress for both pre_sale and post_sale)
  const activeConversations = conversations.filter(c => {
    const status = getStatus(c);
    return status === 'pending' || status === 'in_progress';
  });

  const pendingConversations = conversations.filter(c => {
    const status = getStatus(c);
    const cycleType = getCycleType(c);
    return cycleType === 'pre_sale' && (status === 'pending' || status === 'in_progress');
  });

  const completedConversations = conversations.filter(c => {
    const status = getStatus(c);
    const cycleType = getCycleType(c);
    return cycleType === 'pre_sale' && (status === 'won' || status === 'lost');
  });

  const postSaleConversations = conversations.filter(c => {
    const cycleType = getCycleType(c);
    return cycleType === 'post_sale';
  });

  const filterBySearch = useCallback((convs: ConversationData[], searchQuery: string) => {
    if (!searchQuery.trim()) return convs;
    const query = searchQuery.toLowerCase();
    return convs.filter(c => 
      c.customer.name.toLowerCase().includes(query) ||
      c.customer.phone?.toLowerCase().includes(query) ||
      c.customer.companyName?.toLowerCase().includes(query) ||
      c.sellerName?.toLowerCase().includes(query)
    );
  }, []);

  return {
    conversations,
    alerts,
    isLoading,
    isRefreshing,
    handleRefresh,
    fetchConversations,
    activeConversations,
    pendingConversations,
    completedConversations,
    postSaleConversations,
    filterBySearch,
  };
};
