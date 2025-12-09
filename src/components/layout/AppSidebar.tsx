import { MessageSquare, LayoutDashboard, History, Bell, LogOut, Zap, Smartphone, Users } from "lucide-react";
import { NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const AppSidebar = () => {
  const { user, logout } = useAuth();
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

    // Subscribe to realtime changes
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
  }

  const vendedorLinks: NavLinkItem[] = [
    { to: "/dashboard-vendedor", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/conversas", icon: MessageSquare, label: "Conversas" },
    { to: "/alertas", icon: Bell, label: "Alertas", badge: alertCount },
    { to: "/whatsapp-connect", icon: Smartphone, label: "WhatsApp" },
  ];

  const gestorLinks: NavLinkItem[] = [
    { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    { to: "/gestor/vendedores", icon: Users, label: "Vendedores" },
    { to: "/historico", icon: History, label: "Histórico" },
    { to: "/dashboard/whatsapp-status", icon: Smartphone, label: "Status WhatsApp" },
  ];

  const links = user?.role === "gestor" ? gestorLinks : vendedorLinks;

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
