import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL, memoryCache } from '@/lib/cache';
import type { Tables } from '@/integrations/supabase/types';

type AIScript = Tables<'ai_scripts'>;

export function useCachedAIScript(companyId: string | undefined) {
  const queryFn = useCallback(async (): Promise<AIScript | null> => {
    if (!companyId) return null;
    
    const { data, error } = await supabase
      .from('ai_scripts')
      .select('*')
      .eq('company_id', companyId)
      .eq('is_active', true)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }, [companyId]);

  const result = useCachedQuery({
    cacheKey: CACHE_KEYS.aiScript(companyId || 'none'),
    queryFn,
    ttl: CACHE_TTL.long, // AI scripts don't change often
    enabled: !!companyId,
  });

  return {
    ...result,
    aiScript: result.data,
  };
}

// Utility to invalidate AI script cache
export function invalidateAIScriptCache(companyId: string) {
  memoryCache.invalidate(CACHE_KEYS.aiScript(companyId));
}
