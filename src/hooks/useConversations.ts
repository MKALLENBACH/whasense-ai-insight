import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { ConversationData, AlertData } from "@/components/conversation/ConversationCard";

interface UseConversationsProps {
  accessToken: string | undefined;
}

export const useConversations = ({ accessToken }: UseConversationsProps) => {
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
      const [conversationsResponse, alertsResponse] = await Promise.all([
        supabase.functions.invoke('list-conversations', {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
        supabase
          .from('alerts')
          .select('id, customer_id, alert_type, severity, message')
      ]);

      if (conversationsResponse.error) throw conversationsResponse.error;

      setConversations(conversationsResponse.data?.conversations || []);
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
  }, [accessToken]);

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchConversations();
  }, [fetchConversations]);

  // Initial fetch
  useEffect(() => {
    if (accessToken) {
      fetchConversations();
    } else {
      setIsLoading(false);
    }
  }, [accessToken, fetchConversations]);

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel('conversations-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alerts' }, fetchConversations)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sale_cycles' }, fetchConversations)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchConversations]);

  // Filter helpers
  const getStatus = (c: ConversationData) => c.cycleStatus || c.leadStatus || 'pending';
  const getCycleType = (c: ConversationData) => c.cycleType || 'pre_sale';

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
    pendingConversations,
    completedConversations,
    postSaleConversations,
    filterBySearch,
  };
};
