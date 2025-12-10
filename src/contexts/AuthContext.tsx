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
  hasValidPlan: boolean; // true se tem plano e não é "Inativo"
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  companyPlan: CompanyPlanInfo | null;
  login: (email: string, password: string) => Promise<{ role: UserRole }>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  refreshCompanyPlan: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isManager: boolean;
  isSeller: boolean;
  isAdmin: boolean;
  hasRestrictedAccess: boolean; // true se empresa está com plano inativo/sem plano
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [companyPlan, setCompanyPlan] = useState<CompanyPlanInfo | null>(null);
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

  const fetchUserProfile = async (userId: string): Promise<{ name: string; email: string; companyId: string | null } | null> => {
    const { data, error } = await supabase
      .from("profiles")
      .select("name, email, company_id")
      .eq("user_id", userId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching user profile:", error);
      return null;
    }

    return data ? { name: data.name, email: data.email, companyId: data.company_id } : null;
  };

  const fetchCompanyPlan = async (companyId: string | null): Promise<CompanyPlanInfo | null> => {
    if (!companyId) {
      return null;
    }

    const { data: company, error } = await supabase
      .from("companies")
      .select("id, plan_id, is_active, plans:plan_id(id, name)")
      .eq("id", companyId)
      .maybeSingle();

    if (error || !company) {
      console.error("Error fetching company plan:", error);
      return null;
    }

    const planData = company.plans as { id: string; name: string } | null;
    const hasValidPlan = company.is_active && 
                         company.plan_id !== null && 
                         company.plan_id !== INACTIVE_PLAN_ID;

    return {
      planId: company.plan_id,
      planName: planData?.name || null,
      isActive: company.is_active,
      hasValidPlan,
    };
  };

  const refreshCompanyPlan = async () => {
    if (user?.companyId) {
      const planInfo = await fetchCompanyPlan(user.companyId);
      setCompanyPlan(planInfo);
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

    // Check if user's company is active (skip for admins)
    if (role !== "admin") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("company_id")
        .eq("user_id", data.user.id)
        .maybeSingle();

      if (profile?.company_id) {
        const { data: company } = await supabase
          .from("companies")
          .select("is_active, plan_id")
          .eq("id", profile.company_id)
          .maybeSingle();

        // Vendedores não podem acessar se empresa inativa ou plano Inativo
        if (role === "vendedor") {
          const isInactivePlan = !company?.plan_id || company.plan_id === INACTIVE_PLAN_ID;
          if (!company?.is_active || isInactivePlan) {
            await supabase.auth.signOut();
            throw new Error("Sua empresa está com o plano inativo. Entre em contato com seu gestor.");
          }
        }

        // Gestores podem acessar mesmo com plano inativo (verão apenas /financeiro)
        // Mas se is_active = false (bloqueado pelo admin), não podem acessar
        if (role === "gestor" && company && !company.is_active) {
          // Verificar se é bloqueio por admin ou por plano
          const isInactivePlan = !company.plan_id || company.plan_id === INACTIVE_PLAN_ID;
          if (!isInactivePlan) {
            // Bloqueado pelo admin, não pelo plano
            await supabase.auth.signOut();
            throw new Error("Sua empresa está inativa. Entre em contato com o suporte.");
          }
          // Se for plano inativo, permite login mas com acesso restrito
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
  };

  // Determina se o acesso é restrito (plano inativo ou sem plano)
  const hasRestrictedAccess = (() => {
    // Admin nunca tem restrição
    if (user?.role === "admin") return false;
    // Se não tem empresa, não restringe
    if (!user?.companyId) return false;
    // Se tem empresa mas plano é inválido
    return companyPlan ? !companyPlan.hasValidPlan : true;
  })();

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        companyPlan,
        login,
        signup,
        logout,
        refreshCompanyPlan,
        isAuthenticated: !!session,
        isLoading,
        isManager: user?.role === "gestor",
        isSeller: user?.role === "vendedor",
        isAdmin: user?.role === "admin",
        hasRestrictedAccess,
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
