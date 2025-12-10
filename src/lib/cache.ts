// In-memory cache with TTL support
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

class MemoryCache {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private defaultTTL = 5 * 60 * 1000; // 5 minutes default

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTTL;
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + ttl,
    });
  }

  invalidate(key: string): void {
    this.cache.delete(key);
  }

  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key);
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }

  // Check if key exists and is not expired
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    return true;
  }
}

// Singleton instance
export const memoryCache = new MemoryCache();

// Cache keys constants
export const CACHE_KEYS = {
  profile: (userId: string) => `profile:${userId}`,
  companySettings: (companyId: string) => `company_settings:${companyId}`,
  companyPlan: (companyId: string) => `company_plan:${companyId}`,
  companySubscription: (companyId: string) => `company_subscription:${companyId}`,
  userRole: (userId: string) => `user_role:${userId}`,
  sellerLimit: (companyId: string) => `seller_limit:${companyId}`,
  plans: () => `plans:all`,
  aiScript: (companyId: string) => `ai_script:${companyId}`,
} as const;

// TTL constants (in milliseconds)
export const CACHE_TTL = {
  short: 1 * 60 * 1000,      // 1 minute
  medium: 5 * 60 * 1000,     // 5 minutes
  long: 15 * 60 * 1000,      // 15 minutes
  session: 30 * 60 * 1000,   // 30 minutes
} as const;
