import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { fetchWithAuth } from '@/lib/supabaseApi';

interface SimulationOptions {
  customerId: string;
  sellerId: string;
  enabled: boolean;
  minDelay?: number; // minimum delay in ms
  maxDelay?: number; // maximum delay in ms
}

interface Message {
  direction: 'incoming' | 'outgoing';
  content: string;
}

export function useCustomerSimulation(options: SimulationOptions) {
  const { customerId, sellerId, enabled, minDelay = 5000, maxDelay = 15000 } = options;
  const [isSimulating, setIsSimulating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const conversationHistoryRef = useRef<Message[]>([]);

  const updateHistory = useCallback((messages: Message[]) => {
    conversationHistoryRef.current = messages;
  }, []);

  const simulateCustomerResponse = useCallback(async (sellerMessage?: string) => {
    if (!enabled || !customerId || !sellerId) return null;

    try {
      setIsSimulating(true);
      
      const { data, error } = await fetchWithAuth<{ success: boolean; message: string; messageId: string }>(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/simulate-customer`,
        {
          method: 'POST',
          body: JSON.stringify({
            customerId,
            sellerId,
            sellerMessage,
            conversationHistory: conversationHistoryRef.current,
          }),
        }
      );

      if (error) throw error;
      
      if (data?.success) {
        return {
          message: data.message,
          messageId: data.messageId,
        };
      }
      
      return null;
    } catch (error) {
      console.error('Error simulating customer response:', error);
      return null;
    } finally {
      setIsSimulating(false);
    }
  }, [enabled, customerId, sellerId]);

  const triggerResponseAfterSellerMessage = useCallback(async (sellerMessage: string) => {
    if (!enabled) return null;

    // Random delay between 1-4 seconds for response after seller message
    const delay = Math.random() * 3000 + 1000;
    
    return new Promise<{ message: string; messageId: string } | null>((resolve) => {
      setTimeout(async () => {
        const result = await simulateCustomerResponse(sellerMessage);
        resolve(result);
      }, delay);
    });
  }, [enabled, simulateCustomerResponse]);

  const startContinuousSimulation = useCallback(() => {
    if (!enabled || timeoutRef.current) return;

    const scheduleNext = () => {
      const delay = Math.random() * (maxDelay - minDelay) + minDelay;
      
      timeoutRef.current = setTimeout(async () => {
        // Only send if no recent messages (check last message timestamp)
        await simulateCustomerResponse();
        scheduleNext();
      }, delay);
    };

    scheduleNext();
  }, [enabled, minDelay, maxDelay, simulateCustomerResponse]);

  const stopContinuousSimulation = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopContinuousSimulation();
    };
  }, [stopContinuousSimulation]);

  return {
    isSimulating,
    simulateCustomerResponse,
    triggerResponseAfterSellerMessage,
    startContinuousSimulation,
    stopContinuousSimulation,
    updateHistory,
  };
}
