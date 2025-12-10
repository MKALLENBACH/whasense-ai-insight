import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/types";

// ID do plano "Inativo" no banco
const INACTIVE_PLAN_ID = "fadfe68e-1f50-4e59-8815-40fc9d590fa8";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}

interface CompanyPlanInfo {
  planId: string | null;
  planName: string | null;
  isActive: boolean;
  hasValidPlan: boolean;
  sellerLimit: number | null;
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
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user role:", error);
      return "vendedor";
    }

    return mapDbRoleToAppRole(data?.role || "seller");
  };

  const fetchUserProfile = async (userId: string): Promise<{ name: string; email: string; companyId: string | null; isActive: boolean } | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("name, email, company_id, is_active")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }

    return data ? { name: data.name, email: data.email, companyId: data.company_id, isActive: data.is_active } : null;
  };

  const fetchCompanyPlan = async (companyId: string | null): Promise<CompanyPlanInfo | null> => {
    if (!companyId) {
      return null;
    }

    const { data: company, error } = await supabase
      .from("companies")
      .select("id, plan_id, is_active, plans:plan_id(id, name, seller_limit)")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !company) {
      console.error("Error fetching company plan:", error);
      return null;
    }

    const planData = company.plans as { id: string; name: string; seller_limit: number | null } | null;
    const hasValidPlan = company.is_active && 
                         company.plan_id !== null && 
                         company.plan_id !== INACTIVE_PLAN_ID;

    return {
      planId: company.plan_id,
      planName: planData?.name || null,
      isActive: company.is_active,
      hasValidPlan,
      sellerLimit: planData?.seller_limit ?? null,
    };
  };

  const fetchSellerLimitInfo = async (companyId: string | null, sellerLimit: number | null): Promise<SellerLimitInfo | null> => {
    if (!companyId || sellerLimit === null) {
      return null;
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
      return { isExceeded: false, currentActiveCount: 0, allowedLimit: sellerLimit };
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

    return {
      isExceeded: activeSellerCount > sellerLimit,
      currentActiveCount: activeSellerCount,
      allowedLimit: sellerLimit,
    };
  };

  const refreshCompanyPlan = async () => {
    if (user?.companyId) {
      const planInfo = await fetchCompanyPlan(user.companyId);
      setCompanyPlan(planInfo);
      
      // Also refresh seller limit info
      if (planInfo) {
        const limitInfo = await fetchSellerLimitInfo(user.companyId, planInfo.sellerLimit);
        setSellerLimitInfo(limitInfo);
      }
    }
  };

  const refreshSellerLimit = async () => {
    if (user?.companyId && companyPlan) {
      const limitInfo = await fetchSellerLimitInfo(user.companyId, companyPlan.sellerLimit);
      setSellerLimitInfo(limitInfo);
    }
  };

  const updateAuthUser = async (supabaseUser: User) => {
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

    setUser({
      id: supabaseUser.id,
      name: profile?.name || supabaseUser.email?.split("@")[0] || "Usuário",
      email: profile?.email || supabaseUser.email || "",
      role,
      companyId: profile?.companyId || null,
    });
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        
        if (session?.user) {
          setTimeout(() => {
            updateAuthUser(session.user);
          }, 0);
        } else {
          setUser(null);
          setCompanyPlan(null);
          setSellerLimitInfo(null);
        }
        setIsLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session?.user) {
        updateAuthUser(session.user);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
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
