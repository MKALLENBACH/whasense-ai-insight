import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL, memoryCache } from '@/lib/cache';

interface Profile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  company_id: string | null;
  is_active: boolean;
  seller_followups_enabled: boolean;
  created_at: string;
  updated_at: string;
}

export function useCachedProfile(userId: string | undefined) {
  const queryFn = useCallback(async (): Promise<Profile | null> => {
    if (!userId) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }, [userId]);

  const result = useCachedQuery({
    cacheKey: CACHE_KEYS.profile(userId || 'none'),
    queryFn,
    ttl: CACHE_TTL.medium,
    enabled: !!userId,
  });

  return {
    ...result,
    profile: result.data,
  };
}

// Utility to invalidate profile cache
export function invalidateProfileCache(userId: string) {
  memoryCache.invalidate(CACHE_KEYS.profile(userId));
}
