import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useCachedQuery } from './useCachedQuery';
import { CACHE_KEYS, CACHE_TTL, memoryCache } from '@/lib/cache';

interface CompanySettings {
  id: string;
  company_id: string;
  followups_enabled: boolean;
  followup_delay_hours: number;
  created_at: string;
  updated_at: string;
}

export function useCachedCompanySettings(companyId: string | undefined) {
  const queryFn = useCallback(async (): Promise<CompanySettings | null> => {
    if (!companyId) return null;
    
    const { data, error } = await supabase
      .from('company_settings')
      .select('*')
      .eq('company_id', companyId)
      .maybeSingle();
    
    if (error) throw error;
    return data;
  }, [companyId]);

  const result = useCachedQuery({
    cacheKey: CACHE_KEYS.companySettings(companyId || 'none'),
    queryFn,
    ttl: CACHE_TTL.long,
    enabled: !!companyId,
  });

  return {
    ...result,
    settings: result.data,
  };
}

// Utility to invalidate company settings cache
export function invalidateCompanySettingsCache(companyId: string) {
  memoryCache.invalidate(CACHE_KEYS.companySettings(companyId));
}
