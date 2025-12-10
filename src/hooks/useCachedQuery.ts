import { useCallback, useEffect, useState } from 'react';
import { memoryCache, CACHE_TTL } from '@/lib/cache';

interface UseCachedQueryOptions<T> {
  cacheKey: string;
  queryFn: () => Promise<T>;
  ttl?: number;
  enabled?: boolean;
  staleWhileRevalidate?: boolean;
}

interface UseCachedQueryResult<T> {
  data: T | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  invalidate: () => void;
}

export function useCachedQuery<T>({
  cacheKey,
  queryFn,
  ttl = CACHE_TTL.medium,
  enabled = true,
  staleWhileRevalidate = true,
}: UseCachedQueryOptions<T>): UseCachedQueryResult<T> {
  const [data, setData] = useState<T | null>(() => memoryCache.get<T>(cacheKey));
  const [isLoading, setIsLoading] = useState(!memoryCache.has(cacheKey));
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async (showLoading = true) => {
    if (showLoading && !staleWhileRevalidate) {
      setIsLoading(true);
    }
    setError(null);

    try {
      const result = await queryFn();
      memoryCache.set(cacheKey, result, ttl);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Query failed'));
    } finally {
      setIsLoading(false);
    }
  }, [cacheKey, queryFn, ttl, staleWhileRevalidate]);

  const refetch = useCallback(async () => {
    memoryCache.invalidate(cacheKey);
    await fetchData(true);
  }, [cacheKey, fetchData]);

  const invalidate = useCallback(() => {
    memoryCache.invalidate(cacheKey);
    setData(null);
  }, [cacheKey]);

  useEffect(() => {
    if (!enabled) return;

    const cached = memoryCache.get<T>(cacheKey);
    if (cached) {
      setData(cached);
      setIsLoading(false);
      
      // Revalidate in background if staleWhileRevalidate is enabled
      if (staleWhileRevalidate) {
        fetchData(false);
      }
    } else {
      fetchData(true);
    }
  }, [cacheKey, enabled, fetchData, staleWhileRevalidate]);

  return { data, isLoading, error, refetch, invalidate };
}
