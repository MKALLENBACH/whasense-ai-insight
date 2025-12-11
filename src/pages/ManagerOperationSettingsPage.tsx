import { useState, useEffect } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Settings, Users, SortAsc, XCircle } from "lucide-react";

interface OperationSettings {
  distribution_method: string;
  allow_free_pull: boolean;
  require_approval: boolean;
  max_active_leads_per_seller: number;
  manager_can_reassign: boolean;
  manager_can_move_leads: boolean;
  notify_on_lead_loss: boolean;
  inbox_ordering: string;
}

interface CompanySettings {
  id?: string;
  auto_close_delay_hours: number;
  followups_enabled: boolean;
}

const defaultSettings: OperationSettings = {
  distribution_method: 'manual',
  allow_free_pull: true,
  require_approval: false,
  max_active_leads_per_seller: 0,
  manager_can_reassign: true,
  manager_can_move_leads: true,
  notify_on_lead_loss: true,
  inbox_ordering: 'last_message',
};

const ManagerOperationSettingsPage = () => {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [settings, setSettings] = useState<OperationSettings>(defaultSettings);
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [autoCloseDelayHours, setAutoCloseDelayHours] = useState(24);

  useEffect(() => {
    fetchSettings();
  }, [user?.companyId]);

  const fetchSettings = async () => {
    if (!user?.companyId) return;

    try {
      // Fetch operation settings
      const { data, error } = await supabase
        .from('manager_operation_settings')
        .select('*')
        .eq('company_id', user.companyId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings({
          distribution_method: data.distribution_method,
          allow_free_pull: data.allow_free_pull,
          require_approval: data.require_approval,
          max_active_leads_per_seller: data.max_active_leads_per_seller,
          manager_can_reassign: data.manager_can_reassign,
          manager_can_move_leads: data.manager_can_move_leads,
          notify_on_lead_loss: data.notify_on_lead_loss,
          inbox_ordering: data.inbox_ordering,
        });
      }

      // Fetch company settings for auto-close
      const { data: compSettings, error: compSettingsError } = await supabase
        .from('company_settings')
        .select('id, auto_close_delay_hours, followups_enabled')
        .eq('company_id', user.companyId)
        .maybeSingle();

      if (compSettingsError) throw compSettingsError;

      if (compSettings) {
        setCompanySettings(compSettings as CompanySettings);
        setAutoCloseDelayHours(compSettings.auto_close_delay_hours ?? 24);
      } else {
        // Create default company settings if not exists
        const { data: newSettings, error: createError } = await supabase
          .from('company_settings')
          .insert({
            company_id: user.companyId,
            followups_enabled: true,
            followup_delay_hours: 24,
            auto_close_delay_hours: 24,
          })
          .select('id, auto_close_delay_hours, followups_enabled')
          .single();

        if (createError) throw createError;
        setCompanySettings(newSettings as CompanySettings);
        setAutoCloseDelayHours(24);
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.companyId) return;

    setIsSaving(true);
    try {
      // Save operation settings
      const { error } = await supabase
        .from('manager_operation_settings')
        .upsert({
          company_id: user.companyId,
          ...settings,
          ai_after_assignment_only: true, // Always true - AI only runs after assignment
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'company_id',
        });

      if (error) throw error;

      // Save auto-close settings
      if (companySettings?.id) {
        const hours = Math.max(1, autoCloseDelayHours);
        const { error: compError } = await supabase
          .from('company_settings')
          .update({ auto_close_delay_hours: hours })
          .eq('id', companySettings.id);

        if (compError) throw compError;
        setCompanySettings({ ...companySettings, auto_close_delay_hours: hours });
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-[calc(100vh-3rem)]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Configurações da Operação</h1>
            <p className="text-muted-foreground">
              Gerencie como os leads são distribuídos e processados na sua equipe
            </p>
          </div>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Salvar Alterações
          </Button>
        </div>

        {/* Distribution Method */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Método de Distribuição de Leads
            </CardTitle>
            <CardDescription>
              Como os leads devem ser distribuídos para os vendedores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={settings.distribution_method}
              onValueChange={(value) => setSettings({ ...settings, distribution_method: value })}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="manual" id="manual" className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="manual" className="font-medium cursor-pointer">
                    Manual — Inbox Pai
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Todos os leads entram no Inbox Pai. Vendedores puxam manualmente os leads que desejam atender.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border opacity-50 cursor-not-allowed">
                <RadioGroupItem value="round_robin" id="round_robin" disabled className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="round_robin" className="font-medium text-muted-foreground">
                    Automática — Round Robin
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Em breve: Leads são distribuídos automaticamente entre vendedores disponíveis.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border opacity-50 cursor-not-allowed">
                <RadioGroupItem value="hybrid" id="hybrid" disabled className="mt-1" />
                <div className="flex-1">
                  <Label htmlFor="hybrid" className="font-medium text-muted-foreground">
                    Híbrida
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Em breve: Combinação de distribuição automática com opção de puxar leads.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Attribution Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Regras de Atribuição
            </CardTitle>
            <CardDescription>
              Controle como os vendedores podem assumir leads
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="allow_free_pull"
                checked={settings.allow_free_pull}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, allow_free_pull: checked as boolean })
                }
              />
              <div>
                <Label htmlFor="allow_free_pull" className="cursor-pointer">
                  Permitir que vendedores puxem livremente
                </Label>
                <p className="text-sm text-muted-foreground">
                  Vendedores podem assumir qualquer lead do Inbox Pai sem aprovação
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="require_approval"
                checked={settings.require_approval}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, require_approval: checked as boolean })
                }
                disabled
              />
              <div className="opacity-50">
                <Label htmlFor="require_approval" className="cursor-pointer">
                  Exigir aprovação do gestor
                </Label>
                <p className="text-sm text-muted-foreground">
                  Em breve: Leads precisam ser aprovados antes de serem atribuídos
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="limit_leads"
                checked={settings.max_active_leads_per_seller > 0}
                onCheckedChange={(checked) => 
                  setSettings({ 
                    ...settings, 
                    max_active_leads_per_seller: checked ? 10 : 0 
                  })
                }
              />
              <div className="flex-1">
                <Label htmlFor="limit_leads" className="cursor-pointer">
                  Limitar leads ativos por vendedor
                </Label>
                <p className="text-sm text-muted-foreground">
                  Impede que um vendedor acumule muitos leads (0 = ilimitado)
                </p>
              </div>
              {settings.max_active_leads_per_seller > 0 && (
                <Input
                  type="number"
                  value={settings.max_active_leads_per_seller}
                  onChange={(e) => setSettings({ 
                    ...settings, 
                    max_active_leads_per_seller: parseInt(e.target.value) || 0 
                  })}
                  className="w-20"
                  min={1}
                />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Reassignment Rules */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Regras de Reatribuição
            </CardTitle>
            <CardDescription>
              Controle como leads podem ser movidos entre vendedores
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-3">
              <Checkbox
                id="manager_can_reassign"
                checked={settings.manager_can_reassign}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, manager_can_reassign: checked as boolean })
                }
              />
              <div>
                <Label htmlFor="manager_can_reassign" className="cursor-pointer">
                  Gestor pode reassumir leads
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permite devolver leads ao Inbox Pai
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="manager_can_move_leads"
                checked={settings.manager_can_move_leads}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, manager_can_move_leads: checked as boolean })
                }
              />
              <div>
                <Label htmlFor="manager_can_move_leads" className="cursor-pointer">
                  Gestor pode mover lead entre vendedores
                </Label>
                <p className="text-sm text-muted-foreground">
                  Permite transferir leads diretamente para outro vendedor
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Checkbox
                id="notify_on_lead_loss"
                checked={settings.notify_on_lead_loss}
                onCheckedChange={(checked) => 
                  setSettings({ ...settings, notify_on_lead_loss: checked as boolean })
                }
              />
              <div>
                <Label htmlFor="notify_on_lead_loss" className="cursor-pointer">
                  Notificar vendedor ao perder lead
                </Label>
                <p className="text-sm text-muted-foreground">
                  Envia alerta quando um lead é removido do vendedor
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Inbox Ordering */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <SortAsc className="h-5 w-5" />
              Ordenação do Inbox Pai
            </CardTitle>
            <CardDescription>
              Como os leads devem ser ordenados no Inbox Pai
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup
              value={settings.inbox_ordering}
              onValueChange={(value) => setSettings({ ...settings, inbox_ordering: value })}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="last_message" id="order_last" className="mt-1" />
                <div>
                  <Label htmlFor="order_last" className="font-medium cursor-pointer">
                    Última mensagem
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Leads com mensagens mais recentes aparecem primeiro
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="time_without_response" id="order_waiting" className="mt-1" />
                <div>
                  <Label htmlFor="order_waiting" className="font-medium cursor-pointer">
                    Tempo sem resposta
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Leads esperando há mais tempo aparecem primeiro
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="newest" id="order_newest" className="mt-1" />
                <div>
                  <Label htmlFor="order_newest" className="font-medium cursor-pointer">
                    Novos primeiro
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Leads criados mais recentemente aparecem primeiro
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Auto-Close Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              Encerramento Automático de Ciclos
            </CardTitle>
            <CardDescription>
              {companySettings?.followups_enabled 
                ? "Após o follow-up ser enviado, encerra o ciclo automaticamente se o cliente não responder"
                : "Encerra o ciclo automaticamente se o cliente não responder após a última mensagem do vendedor"
              }
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="space-y-2 flex-1 max-w-xs">
                <Label htmlFor="auto-close-hours">
                  {companySettings?.followups_enabled 
                    ? "Horas após o follow-up sem resposta"
                    : "Horas sem resposta do cliente"
                  }
                </Label>
                <Input
                  id="auto-close-hours"
                  type="number"
                  min={1}
                  value={autoCloseDelayHours}
                  onChange={(e) => setAutoCloseDelayHours(parseInt(e.target.value) || 24)}
                />
                <p className="text-xs text-muted-foreground">
                  Mínimo: 1 hora • O ciclo será encerrado como "perdido" com motivo: falta de resposta
                </p>
              </div>
            </div>
            <p className="text-sm text-muted-foreground border-l-2 border-primary/30 pl-3">
              {companySettings?.followups_enabled ? (
                <>
                  <strong>Follow-up ativo:</strong> O sistema aguardará o envio do follow-up automático e, após o tempo configurado sem resposta do cliente, encerrará o ciclo automaticamente.
                </>
              ) : (
                <>
                  <strong>Follow-up desativado:</strong> Após a última mensagem do vendedor ficar sem resposta pelo tempo configurado, o ciclo será encerrado automaticamente.
                </>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ManagerOperationSettingsPage;
