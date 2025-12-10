import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL, memoryCache } from '@/lib/cache';
import type { Tables } from '@/integrations/supabase/types';

type Plan = Tables<'plans'>;

export function useCachedPlans(onlyActive = true) {
  const queryFn = useCallback(async (): Promise<Plan[]> => {
    let query = supabase.from('plans').select('*');
    
    if (onlyActive) {
      query = query.eq('is_active', true);
    }
    
    const { data, error } = await query.order('monthly_price', { ascending: true });
    
    if (error) throw error;
    return data || [];
  }, [onlyActive]);

  const result = useCachedQuery({
    cacheKey: `${CACHE_KEYS.plans()}:${onlyActive}`,
    queryFn,
    ttl: CACHE_TTL.long, // Plans don't change often
  });

  return {
    ...result,
    plans: result.data || [],
  };
}

// Utility to invalidate plans cache
export function invalidatePlansCache() {
  memoryCache.invalidatePattern('^plans:');
}
