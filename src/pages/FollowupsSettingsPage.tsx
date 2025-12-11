import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Loader2, AlertCircle, Bot, Clock, Users } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface Seller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  seller_followups_enabled: boolean;
}

interface CompanySettings {
  id?: string;
  company_id: string;
  followups_enabled: boolean;
  followup_delay_hours: number;
}

const FollowupsSettingsPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [allowFollowups, setAllowFollowups] = useState(false);
  const [settings, setSettings] = useState<CompanySettings | null>(null);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [delayHours, setDelayHours] = useState(24);

  useEffect(() => {
    if (user?.companyId) {
      fetchData();
    }
  }, [user?.companyId]);

  const fetchData = async () => {
    if (!user?.companyId) return;
    
    setIsLoading(true);
    try {
      // Fetch company allow_followups status
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .select("allow_followups")
        .eq("id", user.companyId)
        .single();

      if (companyError) throw companyError;
      setAllowFollowups(company?.allow_followups ?? false);

      // Fetch company settings
      const { data: settingsData, error: settingsError } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", user.companyId)
        .maybeSingle();

      if (settingsError) throw settingsError;
      
      if (settingsData) {
        setSettings(settingsData as CompanySettings);
        setDelayHours(settingsData.followup_delay_hours);
      } else {
        // Create default settings if not exists
        const { data: newSettings, error: createError } = await supabase
          .from("company_settings")
          .insert({
            company_id: user.companyId,
            followups_enabled: true,
            followup_delay_hours: 24,
          })
          .select()
          .single();

        if (createError) throw createError;
        setSettings(newSettings as CompanySettings);
        setDelayHours(24);
      }

      // Fetch sellers
      const { data: sellersData, error: sellersError } = await supabase
        .from("profiles")
        .select("id, user_id, name, email, seller_followups_enabled")
        .eq("company_id", user.companyId);

      if (sellersError) throw sellersError;
      
      // Filter only sellers (not managers)
      const { data: sellerRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .eq("role", "seller");

      if (rolesError) throw rolesError;

      const sellerUserIds = new Set(sellerRoles?.map(r => r.user_id) || []);
      const filteredSellers = (sellersData || []).filter(s => sellerUserIds.has(s.user_id));
      
      setSellers(filteredSellers as Seller[]);
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Erro ao carregar configurações");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleFollowups = async (enabled: boolean) => {
    if (!settings) return;
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("company_settings")
        .update({ followups_enabled: enabled })
        .eq("id", settings.id);

      if (error) throw error;

      setSettings({ ...settings, followups_enabled: enabled });
      toast.success(enabled ? "Follow-ups ativados" : "Follow-ups desativados");
    } catch (error) {
      console.error("Error updating settings:", error);
      toast.error("Erro ao atualizar configuração");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateDelay = async () => {
    if (!settings) return;
    
    const hours = Math.max(24, delayHours);
    setDelayHours(hours);
    
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("company_settings")
        .update({ followup_delay_hours: hours })
        .eq("id", settings.id);

      if (error) throw error;

      setSettings({ ...settings, followup_delay_hours: hours });
      toast.success("Tempo de follow-up atualizado");
    } catch (error) {
      console.error("Error updating delay:", error);
      toast.error("Erro ao atualizar tempo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleSellerFollowup = async (sellerId: string, enabled: boolean) => {
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ seller_followups_enabled: enabled })
        .eq("id", sellerId);

      if (error) throw error;

      setSellers(sellers.map(s => 
        s.id === sellerId ? { ...s, seller_followups_enabled: enabled } : s
      ));
      toast.success(enabled ? "Follow-ups ativados para vendedor" : "Follow-ups desativados para vendedor");
    } catch (error) {
      console.error("Error updating seller followup:", error);
      toast.error("Erro ao atualizar vendedor");
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Follow-ups Automáticos</h1>
          <p className="text-muted-foreground">Configure os follow-ups automáticos da sua equipe</p>
        </div>

        {!allowFollowups ? (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Follow-ups desativados</AlertTitle>
            <AlertDescription>
              Os follow-ups automáticos estão desativados pelo Admin Whasense. Entre em contato para ativar.
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {/* Main Toggle */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5" />
                  Controle Principal
                </CardTitle>
                <CardDescription>
                  Ative ou desative follow-ups automáticos para toda a sua empresa
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="followups-enabled" className="text-base">
                      Ativar follow-ups automáticos
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      A IA enviará mensagens de follow-up quando clientes ficarem sem responder
                    </p>
                  </div>
                  <Switch
                    id="followups-enabled"
                    checked={settings?.followups_enabled ?? false}
                    onCheckedChange={handleToggleFollowups}
                    disabled={isSaving}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Delay Configuration */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" />
                  Tempo de Espera
                </CardTitle>
                <CardDescription>
                  Configure após quantas horas sem resposta o follow-up será enviado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-end gap-4">
                  <div className="space-y-2 flex-1 max-w-xs">
                    <Label htmlFor="delay-hours">Horas sem resposta do cliente</Label>
                    <Input
                      id="delay-hours"
                      type="number"
                      min={24}
                      value={delayHours}
                      onChange={(e) => setDelayHours(parseInt(e.target.value) || 24)}
                      disabled={!settings?.followups_enabled}
                    />
                    <p className="text-xs text-muted-foreground">Mínimo: 24 horas</p>
                  </div>
                  <Button 
                    onClick={handleUpdateDelay}
                    disabled={isSaving || !settings?.followups_enabled}
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Salvar
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Per-Seller Control */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Controle por Vendedor
                </CardTitle>
                <CardDescription>
                  Ative ou desative follow-ups individualmente para cada vendedor
                </CardDescription>
              </CardHeader>
              <CardContent>
                {sellers.length === 0 ? (
                  <p className="text-muted-foreground text-center py-4">
                    Nenhum vendedor cadastrado
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead className="text-right">Follow-ups</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellers.map((seller) => (
                        <TableRow key={seller.id}>
                          <TableCell className="font-medium">{seller.name}</TableCell>
                          <TableCell className="text-muted-foreground">{seller.email}</TableCell>
                          <TableCell className="text-right">
                            <Switch
                              checked={seller.seller_followups_enabled}
                              onCheckedChange={(checked) => handleToggleSellerFollowup(seller.id, checked)}
                              disabled={!settings?.followups_enabled}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AppLayout>
  );
};

export default FollowupsSettingsPage;
