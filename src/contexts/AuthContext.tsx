import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/types";
import { memoryCache, CACHE_KEYS, CACHE_TTL } from "@/lib/cache";

// IDs dos planos no banco
const INACTIVE_PLAN_ID = "fadfe68e-1f50-4e59-8815-40fc9d590fa8";
const FREE_PLAN_ID = "8af5c9e1-02a3-4705-b312-6f33bcc0d965";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
  requiresPasswordChange: boolean;
}

export interface PlanFeatures {
  canAccess360: boolean;
  canUseGamification: boolean;
  canUseFollowups: boolean;
  canAccessFullDashboard: boolean;
}

export interface CompanyPlanInfo {
  planId: string | null;
  planName: string | null;
  isActive: boolean;
  hasValidPlan: boolean;
  sellerLimit: number | null;
  features: PlanFeatures | null;
  freeStartDate: string | null;
  freeEndDate: string | null;
}

interface SellerLimitInfo {
  isExceeded: boolean;
  currentActiveCount: number;
  allowedLimit: number;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  companyPlan: CompanyPlanInfo | null;
  sellerLimitInfo: SellerLimitInfo | null;
  login: (email: string, password: string) => Promise<{ role: UserRole }>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshCompanyPlan: () => Promise<void>;
  refreshSellerLimit: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isManager: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  hasRestrictedAccess: boolean;
  hasSellerLimitExceeded: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [companyPlan, setCompanyPlan] = useState<CompanyPlanInfo | null>(null);
  const [sellerLimitInfo, setSellerLimitInfo] = useState<SellerLimitInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapDbRoleToAppRole = (dbRole: string): UserRole => {
    if (dbRole === "manager") return "gestor";
    if (dbRole === "admin") return "admin";
    return "vendedor";
  };

  const fetchUserRole = async (userId: string): Promise<UserRole> => {
    // Check cache first
    const cacheKey = CACHE_KEYS.userRole(userId);
    const cached = memoryCache.get<UserRole>(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user role:", error);
      return "vendedor";
    }

    const role = mapDbRoleToAppRole(data?.role || "seller");
    memoryCache.set(cacheKey, role, CACHE_TTL.session);
    return role;
  };

  const fetchUserProfile = async (userId: string): Promise<{ name: string; email: string; companyId: string | null; isActive: boolean } | null> => {
    // Check cache first
    const cacheKey = CACHE_KEYS.profile(userId);
    const cached = memoryCache.get<{ name: string; email: string; companyId: string | null; isActive: boolean }>(cacheKey);
    if (cached) return cached;

    const { data, error } = await supabase
      .from("profiles")
      .select("name, email, company_id, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }

    const profile = data ? { name: data.name, email: data.email, companyId: data.company_id, isActive: data.is_active } : null;
    if (profile) {
      memoryCache.set(cacheKey, profile, CACHE_TTL.medium);
    }
    return profile;
  };

  const fetchCompanyPlan = async (companyId: string | null, skipCache = false): Promise<CompanyPlanInfo | null> => {
    if (!companyId) {
      return null;
    }

    // Check cache first (unless skipCache is true)
    const cacheKey = CACHE_KEYS.companyPlan(companyId);
    if (!skipCache) {
      const cached = memoryCache.get<CompanyPlanInfo>(cacheKey);
      if (cached) return cached;
    }

    const { data: company, error } = await supabase
      .from("companies")
      .select("id, plan_id, is_active, free_start_date, free_end_date, plans:plan_id(id, name, seller_limit, features)")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !company) {
      console.error("Error fetching company plan:", error);
      return null;
    }

    // Check if FREE trial has expired
    const isFreePlan = company.plan_id === FREE_PLAN_ID;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (isFreePlan && company.free_end_date) {
      const endDate = new Date(company.free_end_date);
      endDate.setHours(23, 59, 59, 999);
      
      if (today > endDate) {
        // Trial expired - auto-convert to no plan
        console.log("FREE trial expired, removing plan");
        await supabase
          .from("companies")
          .update({ plan_id: null })
          .eq("id", companyId);
        
        // Clear cache since plan changed
        memoryCache.invalidate(cacheKey);
        
        return {
          planId: null,
          planName: null,
          isActive: company.is_active,
          hasValidPlan: false,
          sellerLimit: null,
          features: null,
          freeStartDate: company.free_start_date,
          freeEndDate: company.free_end_date,
        };
      }
    }

    const planData = company.plans as unknown as { id: string; name: string; seller_limit: number | null; features: PlanFeatures | null } | null;
    const hasValidPlan = company.is_active && 
                         company.plan_id !== null && 
                         company.plan_id !== INACTIVE_PLAN_ID;

    const planInfo: CompanyPlanInfo = {
      planId: company.plan_id,
      planName: planData?.name || null,
      isActive: company.is_active,
      hasValidPlan,
      sellerLimit: planData?.seller_limit ?? null,
      features: planData?.features || null,
      freeStartDate: company.free_start_date,
      freeEndDate: company.free_end_date,
    };

    // Cache the result
    memoryCache.set(cacheKey, planInfo, CACHE_TTL.medium);
    
    return planInfo;
  };

  const fetchSellerLimitInfo = async (companyId: string | null, sellerLimit: number | null, skipCache = false): Promise<SellerLimitInfo | null> => {
    if (!companyId || sellerLimit === null) {
      return null;
    }

    // Check cache first (unless skipCache is true)
    const cacheKey = CACHE_KEYS.sellerLimit(companyId);
    if (!skipCache) {
      const cached = memoryCache.get<SellerLimitInfo>(cacheKey);
      if (cached && cached.allowedLimit === sellerLimit) return cached;
    }

    // Count active sellers in the company
    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, is_active")
      .eq("company_id", companyId)
      .eq("is_active", true);

    if (profilesError) {
      console.error("Error fetching profiles for seller count:", profilesError);
      return null;
    }

    if (!profiles || profiles.length === 0) {
      const limitInfo = { isExceeded: false, currentActiveCount: 0, allowedLimit: sellerLimit };
      memoryCache.set(cacheKey, limitInfo, CACHE_TTL.short);
      return limitInfo;
    }

    const userIds = profiles.map(p => p.user_id);

    // Get roles to count only sellers
    const { data: roles, error: rolesError } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", userIds)
      .eq("role", "seller");

    if (rolesError) {
      console.error("Error fetching roles:", rolesError);
      return null;
    }

    const activeSellerCount = roles?.length || 0;

    const limitInfo: SellerLimitInfo = {
      isExceeded: activeSellerCount > sellerLimit,
      currentActiveCount: activeSellerCount,
      allowedLimit: sellerLimit,
    };

    // Cache with short TTL since seller count can change frequently
    memoryCache.set(cacheKey, limitInfo, CACHE_TTL.short);

    return limitInfo;
  };

  const refreshCompanyPlan = async () => {
    if (user?.companyId) {
      // Skip cache to force refresh
      memoryCache.invalidate(CACHE_KEYS.companyPlan(user.companyId));
      const planInfo = await fetchCompanyPlan(user.companyId, true);
      setCompanyPlan(planInfo);
      
      // Also refresh seller limit info
      if (planInfo) {
        memoryCache.invalidate(CACHE_KEYS.sellerLimit(user.companyId));
        const limitInfo = await fetchSellerLimitInfo(user.companyId, planInfo.sellerLimit, true);
        setSellerLimitInfo(limitInfo);
      }
    }
  };

  const refreshSellerLimit = async () => {
    console.log("refreshSellerLimit called", { companyId: user?.companyId, sellerLimit: companyPlan?.sellerLimit });
    if (user?.companyId && companyPlan) {
      // Skip cache to force refresh
      memoryCache.invalidate(CACHE_KEYS.sellerLimit(user.companyId));
      const limitInfo = await fetchSellerLimitInfo(user.companyId, companyPlan.sellerLimit, true);
      console.log("New seller limit info:", limitInfo);
      setSellerLimitInfo(limitInfo);
    }
  };

  const updateAuthUser = async (supabaseUser: User) => {
    try {
      const [role, profile] = await Promise.all([
        fetchUserRole(supabaseUser.id),
        fetchUserProfile(supabaseUser.id),
      ]);

      // Fetch company plan info
      const planInfo = await fetchCompanyPlan(profile?.companyId || null);
      setCompanyPlan(planInfo);

      // Fetch seller limit info
      if (planInfo && profile?.companyId) {
        const limitInfo = await fetchSellerLimitInfo(profile.companyId, planInfo.sellerLimit);
        setSellerLimitInfo(limitInfo);
      }

      // Check if user requires password change from metadata
      const requiresPasswordChange = supabaseUser.user_metadata?.requires_password_change === true;

      setUser({
        id: supabaseUser.id,
        name: profile?.name || supabaseUser.email?.split("@")[0] || "Usuário",
        email: profile?.email || supabaseUser.email || "",
        role,
        companyId: profile?.companyId || null,
        requiresPasswordChange,
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let isMounted = true;
    let hasInitialized = false;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!isMounted) return;
        
        setSession(session);
        
        // Only handle sign in/out events after initial load
        // INITIAL_SESSION is handled by getSession
        if (event === 'SIGNED_IN' && hasInitialized) {
          updateAuthUser(session!.user);
        } else if (event === 'SIGNED_OUT') {
          memoryCache.clear();
          setUser(null);
          setCompanyPlan(null);
          setSellerLimitInfo(null);
          setIsLoading(false);
        } else if (event === 'TOKEN_REFRESHED' && session?.user) {
          // Token refresh doesn't need to re-fetch user data, just update session
          setIsLoading(false);
        }
      }
    );

    // Initial load - only runs once
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return;
      
      hasInitialized = true;
      setSession(session);
      
      if (session?.user) {
        updateAuthUser(session.user);
      } else {
        setIsLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string): Promise<{ role: UserRole }> => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      if (error.message.includes("Invalid login credentials")) {
        throw new Error("Email ou senha incorretos");
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Erro ao fazer login");
    }

    const role = await fetchUserRole(data.user.id);

    // Check if user profile is active
    const profile = await fetchUserProfile(data.user.id);
    if (profile && !profile.isActive && role === "vendedor") {
      await supabase.auth.signOut();
      throw new Error("Sua conta está desativada. Entre em contato com seu gestor.");
    }

    // Check if user's company is active (skip for admins)
    if (role !== "admin" && profile?.companyId) {
      const { data: company } = await supabase
        .from("companies")
        .select("is_active, plan_id")
        .eq("id", profile.companyId)
        .maybeSingle();

      // Vendedores não podem acessar se empresa inativa ou plano Inativo
      if (role === "vendedor") {
        const isInactivePlan = !company?.plan_id || company.plan_id === INACTIVE_PLAN_ID;
        if (!company?.is_active || isInactivePlan) {
          await supabase.auth.signOut();
          throw new Error("Sua empresa está com o plano inativo. Entre em contato com seu gestor.");
        }

        // Check seller limit exceeded
        const planInfo = await fetchCompanyPlan(profile.companyId);
        if (planInfo && planInfo.sellerLimit !== null) {
          const limitInfo = await fetchSellerLimitInfo(profile.companyId, planInfo.sellerLimit);
          if (limitInfo?.isExceeded) {
            await supabase.auth.signOut();
            throw new Error("A empresa excedeu o limite de vendedores do plano. Entre em contato com seu gestor.");
          }
        }
      }

      // Gestores podem acessar mesmo com plano inativo (verão apenas /financeiro)
      // Mas se is_active = false (bloqueado pelo admin), não podem acessar
      if (role === "gestor" && company && !company.is_active) {
        const isInactivePlan = !company.plan_id || company.plan_id === INACTIVE_PLAN_ID;
        if (!isInactivePlan) {
          await supabase.auth.signOut();
          throw new Error("Sua empresa está inativa. Entre em contato com o suporte.");
        }
      }
    }

    return { role };
  };

  const signup = async (email: string, password: string, name: string, role: UserRole) => {
    const redirectUrl = `${window.location.origin}/`;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          name,
        },
      },
    });

    if (error) {
      if (error.message.includes("User already registered")) {
        throw new Error("Este email já está cadastrado");
      }
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error("Erro ao criar conta");
    }

    const dbRole = role === "gestor" ? "manager" : "seller";

    const { error: roleError } = await supabase
      .from("user_roles")
      .insert({
        user_id: data.user.id,
        role: dbRole,
      });

    if (roleError) {
      console.error("Error inserting user role:", roleError);
      throw new Error("Erro ao configurar perfil");
    }
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(error.message);
    }
    // Clear all cache on logout
    memoryCache.clear();
    setUser(null);
    setSession(null);
    setCompanyPlan(null);
    setSellerLimitInfo(null);
  };

  // Determina se o acesso é restrito (plano inativo ou sem plano)
  const hasRestrictedAccess = (() => {
    if (user?.role === "admin") return false;
    if (!user?.companyId) return false;
    return companyPlan ? !companyPlan.hasValidPlan : true;
  })();

  // Determina se o limite de vendedores foi excedido
  const hasSellerLimitExceeded = (() => {
    if (user?.role === "admin") return false;
    if (user?.role !== "gestor") return false;
    return sellerLimitInfo?.isExceeded || false;
  })();

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        companyPlan,
        sellerLimitInfo,
        login,
        signup,
        logout,
        refreshCompanyPlan,
        refreshSellerLimit,
        isAuthenticated: !!session,
        isLoading,
        isManager: user?.role === "gestor",
        isSeller: user?.role === "vendedor",
        isAdmin: user?.role === "admin",
        hasRestrictedAccess,
        hasSellerLimitExceeded,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
