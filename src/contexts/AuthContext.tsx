import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { UserRole } from "@/types";

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  companyId: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  session: Session | null;
  login: (email: string, password: string) => Promise<{ role: UserRole }>;
  signup: (email: string, password: string, name: string, role: UserRole) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isLoading: boolean;
  isManager: boolean;
  isSeller: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapDbRoleToAppRole = (dbRole: string): UserRole => {
    return dbRole === "manager" ? "gestor" : "vendedor";
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

  const updateAuthUser = async (supabaseUser: User) => {
    const [role, profile] = await Promise.all([
      fetchUserRole(supabaseUser.id),
      fetchUserProfile(supabaseUser.id),
    ]);

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
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        login,
        signup,
        logout,
        isAuthenticated: !!session,
        isLoading,
        isManager: user?.role === "gestor",
        isSeller: user?.role === "vendedor",
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
