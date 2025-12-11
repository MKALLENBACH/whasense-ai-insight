import { MessageSquare, LayoutDashboard, History, Bell, LogOut, Zap, Smartphone, Users, Bot, Target, Trophy, Building2, CreditCard, AlertTriangle, Settings, Inbox } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { usePlanPermissions } from "@/hooks/usePlanPermissions";

const AppSidebar = () => {
  const { user, logout, hasRestrictedAccess, hasSellerLimitExceeded, sellerLimitInfo } = useAuth();
  const permissions = usePlanPermissions();
  const [alertCount, setAlertCount] = useState(0);

  useEffect(() => {
    const fetchAlertCount = async () => {
      if (!user?.id) return;
      
      const { count, error } = await supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('seller_id', user.id);
      
      if (!error && count !== null) {
        setAlertCount(count);
      }
    };

    fetchAlertCount();

    const channel = supabase
      .channel('sidebar-alerts')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'alerts'
        },
        () => {
          fetchAlertCount();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  interface NavLinkItem {
    to: string;
    icon: typeof MessageSquare;
    label: string;
    badge?: number;
    featureKey?: 'canAccess360' | 'canUseGamification' | 'canUseFollowups';
  }

  // Links para vendedor - filtrados por features
  const getAllVendedorLinks = (): NavLinkItem[] => [
    { to: "/dashboard-vendedor", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/inbox", icon: Inbox, label: "Inbox Pai" },
    { to: "/conversas", icon: MessageSquare, label: "Meus Leads" },
    { to: "/clientes", icon: Building2, label: "Clientes 360°", featureKey: 'canAccess360' },
    { to: "/vendedor/performance", icon: Trophy, label: "Performance", featureKey: 'canUseGamification' },
    { to: "/alertas", icon: Bell, label: "Alertas", badge: alertCount },
    { to: "/vendedor/whatsapp", icon: Smartphone, label: "WhatsApp" },
  ];

  // Links para gestor - filtrados por features
  const getAllGestorLinks = (): NavLinkItem[] => [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/inbox", icon: Inbox, label: "Inbox Pai" },
    { to: "/conversas", icon: MessageSquare, label: "Conversas" },
    { to: "/clientes", icon: Building2, label: "Clientes 360°", featureKey: 'canAccess360' },
    { to: "/gestor/vendedores", icon: Users, label: "Vendedores" },
    { to: "/gestor/metas", icon: Target, label: "Metas", featureKey: 'canUseGamification' },
    { to: "/gestor/followups", icon: Bot, label: "Follow-ups", featureKey: 'canUseFollowups' },
    { to: "/gestor/configuracoes", icon: Settings, label: "Configurações" },
    { to: "/financeiro", icon: CreditCard, label: "Financeiro" },
    { to: "/historico", icon: History, label: "Histórico" },
    { to: "/gestor/whatsapp-status", icon: Smartphone, label: "Status WhatsApp" },
  ];
  // Se gestor com acesso restrito por plano inativo, mostra apenas Financeiro
  const gestorRestrictedLinks: NavLinkItem[] = [
    { to: "/financeiro", icon: CreditCard, label: "Financeiro" },
  ];

  // Se gestor com limite de vendedores excedido, mostra dashboard, vendedores e financeiro
  const gestorSellerLimitLinks: NavLinkItem[] = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/gestor/vendedores", icon: Users, label: "Vendedores" },
    { to: "/financeiro", icon: CreditCard, label: "Financeiro" },
  ];

  // Filtra links baseado nas permissões do plano
  const filterByFeatures = (links: NavLinkItem[]): NavLinkItem[] => {
    return links.filter(link => {
      if (!link.featureKey) return true;
      if (permissions.hasFullAccess) return true;
      return permissions[link.featureKey];
    });
  };

  // Determina quais links mostrar
  const getLinks = () => {
    if (user?.role === "gestor") {
      if (hasRestrictedAccess) {
        return gestorRestrictedLinks;
      }
      if (hasSellerLimitExceeded) {
        return gestorSellerLimitLinks;
      }
      return filterByFeatures(getAllGestorLinks());
    }
    return filterByFeatures(getAllVendedorLinks());
  };

  const links = getLinks();

  // Determina qual aviso mostrar
  const getWarning = () => {
    if (user?.role !== "gestor") return null;
    
    if (hasRestrictedAccess) {
      return {
        title: "Plano Inativo",
        message: "Regularize seu plano para ter acesso completo.",
        color: "yellow"
      };
    }
    
    if (hasSellerLimitExceeded && sellerLimitInfo) {
      return {
        title: "Limite Excedido",
        message: `Desative ${sellerLimitInfo.currentActiveCount - sellerLimitInfo.allowedLimit} vendedor(es) para liberar o acesso.`,
        color: "red"
      };
    }
    
    return null;
  };

  const warning = getWarning();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-sidebar text-sidebar-foreground flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-sidebar-border">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
          <Zap className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tight">Whasense</h1>
          <p className="text-xs text-sidebar-foreground/60">Inteligência em vendas</p>
        </div>
      </div>

      {/* Restricted Access Warning */}
      {warning && (
        <div className={cn(
          "mx-3 mt-4 p-3 rounded-lg border",
          warning.color === "yellow" 
            ? "bg-yellow-500/10 border-yellow-500/30" 
            : "bg-destructive/10 border-destructive/30"
        )}>
          <div className="flex items-start gap-2">
            <AlertTriangle className={cn(
              "h-4 w-4 mt-0.5 flex-shrink-0",
              warning.color === "yellow" ? "text-yellow-500" : "text-destructive"
            )} />
            <div>
              <p className={cn(
                "text-xs font-medium",
                warning.color === "yellow" ? "text-yellow-500" : "text-destructive"
              )}>
                {warning.title}
              </p>
              <p className={cn(
                "text-xs mt-0.5",
                warning.color === "yellow" ? "text-yellow-500/80" : "text-destructive/80"
              )}>
                {warning.message}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )
            }
          >
            <link.icon className="h-5 w-5" />
            {link.label}
            {link.badge !== undefined && link.badge > 0 && (
              <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive text-xs font-semibold text-destructive-foreground">
                {link.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-sidebar-border p-4">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sidebar-accent text-sm font-semibold">
            {user?.name?.charAt(0) || "U"}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-sidebar-foreground/60 capitalize">{user?.role}</p>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={logout}
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  );
};

export default AppSidebar;
