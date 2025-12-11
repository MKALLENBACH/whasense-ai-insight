import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, MessageSquare, CheckCircle2, AlertCircle, XCircle, Eye, EyeOff, ExternalLink, RefreshCw, Shield, Building2, Users, Inbox } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface CompanyWhatsAppSettings {
  id: string;
  company_id: string;
  waba_id: string | null;
  phone_number_id: string | null;
  permanent_token: string | null;
  verification_token: string | null;
  display_phone_number: string | null;
  status: string;
  last_check: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export default function CompanyWhatsAppSettingsPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settings, setSettings] = useState<CompanyWhatsAppSettings | null>(null);
  const [showToken, setShowToken] = useState(false);
  const [distributionMode, setDistributionMode] = useState<string>('manual');
  
  const [formData, setFormData] = useState({
    phone_number_id: '',
    waba_id: '',
    permanent_token: '',
    verification_token: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      if (!user?.id) return;
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (profile?.company_id) {
        setCompanyId(profile.company_id);
        await fetchSettings(profile.company_id);
        await fetchOperationSettings(profile.company_id);
      }
      setLoading(false);
    };
    
    fetchData();
  }, [user?.id]);

  const fetchSettings = async (compId: string) => {
    try {
      const { data, error } = await supabase
        .from('company_whatsapp_settings')
        .select('*')
        .eq('company_id', compId)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setSettings(data as CompanyWhatsAppSettings);
        setFormData({
          phone_number_id: data.phone_number_id || '',
          waba_id: data.waba_id || '',
          permanent_token: data.permanent_token || '',
          verification_token: data.verification_token || '',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const fetchOperationSettings = async (compId: string) => {
    try {
      const { data } = await supabase
        .from('manager_operation_settings')
        .select('distribution_method')
        .eq('company_id', compId)
        .maybeSingle();
      
      if (data) {
        setDistributionMode(data.distribution_method);
      }
    } catch (error) {
      console.error('Error fetching operation settings:', error);
    }
  };

  const handleSave = async () => {
    if (!companyId) {
      toast.error('Empresa não encontrada');
      return;
    }

    if (!formData.phone_number_id || !formData.waba_id || 
        !formData.permanent_token || !formData.verification_token) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      // Validate the access token by fetching phone number info (v19.0)
      const phoneInfoResponse = await fetch(
        `https://graph.facebook.com/v19.0/${formData.phone_number_id}?fields=display_phone_number,verified_name`,
        {
          headers: {
            'Authorization': `Bearer ${formData.permanent_token}`,
          },
        }
      );

      let displayPhoneNumber = null;
      
      if (phoneInfoResponse.ok) {
        const phoneInfo = await phoneInfoResponse.json();
        displayPhoneNumber = phoneInfo.display_phone_number;
        
        // Subscribe to webhooks
        await fetch(
          `https://graph.facebook.com/v19.0/${formData.waba_id}/subscribed_apps`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${formData.permanent_token}`,
            },
          }
        );
      } else {
        const errorData = await phoneInfoResponse.json();
        console.error('Token validation failed:', errorData);
        toast.error(errorData.error?.message || 'Token inválido ou Phone Number ID incorreto');
        setSaving(false);
        return;
      }

      // Upsert company settings
      const { error: upsertError } = await supabase
        .from('company_whatsapp_settings')
        .upsert({
          company_id: companyId,
          phone_number_id: formData.phone_number_id,
          waba_id: formData.waba_id,
          permanent_token: formData.permanent_token,
          verification_token: formData.verification_token,
          display_phone_number: displayPhoneNumber,
          status: 'connected',
          last_check: new Date().toISOString(),
          last_error: null,
        }, {
          onConflict: 'company_id',
        });

      if (upsertError) throw upsertError;

      toast.success('WhatsApp configurado com sucesso!');
      await fetchSettings(companyId);
    } catch (error: any) {
      console.error('Error saving:', error);
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!settings) return;
    
    setTesting(true);
    try {
      const testResponse = await fetch(
        `https://graph.facebook.com/v19.0/${settings.phone_number_id}?fields=display_phone_number`,
        {
          headers: {
            'Authorization': `Bearer ${settings.permanent_token}`,
          },
        }
      );

      if (!testResponse.ok) {
        await supabase
          .from('company_whatsapp_settings')
          .update({ 
            status: 'error', 
            last_error: 'Token expirado ou inválido',
            last_check: new Date().toISOString()
          })
          .eq('id', settings.id);

        toast.error('Token expirado ou inválido');
        await fetchSettings(companyId!);
        return;
      }

      await supabase
        .from('company_whatsapp_settings')
        .update({ 
          status: 'connected', 
          last_error: null,
          last_check: new Date().toISOString()
        })
        .eq('id', settings.id);

      toast.success('Conexão verificada com sucesso!');
      await fetchSettings(companyId!);
    } catch (error) {
      console.error('Test error:', error);
      toast.error('Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!settings) return;
    
    if (!confirm('Tem certeza que deseja desconectar o WhatsApp da empresa?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('company_whatsapp_settings')
        .delete()
        .eq('id', settings.id);

      if (error) throw error;

      toast.success('WhatsApp desconectado');
      setSettings(null);
      setFormData({
        phone_number_id: '',
        waba_id: '',
        permanent_token: '',
        verification_token: '',
      });
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'pending':
        return <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Pendente</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case 'disconnected':
        return <Badge variant="outline"><XCircle className="h-3 w-3 mr-1" />Desconectado</Badge>;
      default:
        return <Badge variant="outline">Desconhecido</Badge>;
    }
  };

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-cloud-webhook`;

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6 max-w-2xl mx-auto">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            WhatsApp da Empresa
          </h1>
          <p className="text-muted-foreground">
            Configure o número oficial do WhatsApp Business da sua empresa
          </p>
        </div>

        {/* Security Notice */}
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Integração via WhatsApp Cloud API</AlertTitle>
          <AlertDescription>
            Esta é a integração oficial da Meta. Apenas gestores podem configurar as credenciais. 
            Os vendedores utilizam automaticamente o número configurado para receber e responder leads via <strong>Inbox Pai</strong>.
          </AlertDescription>
        </Alert>

        {/* Connection Status */}
        {settings && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  Status da Conexão
                </CardTitle>
                {getStatusBadge(settings.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {settings.display_phone_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Número conectado: </span>
                  <span className="font-medium">{settings.display_phone_number}</span>
                </div>
              )}
              {settings.last_check && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Última verificação: </span>
                  <span>{new Date(settings.last_check).toLocaleString('pt-BR')}</span>
                </div>
              )}
              {settings.last_error && settings.status === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro na conexão</AlertTitle>
                  <AlertDescription>{settings.last_error}</AlertDescription>
                </Alert>
              )}
              <div className="flex gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
                  Testar Conexão
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={saving}>
                  Desconectar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Lead Distribution Mode */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Distribuição de Leads
            </CardTitle>
            <CardDescription>
              Como os leads que chegam pelo WhatsApp serão distribuídos para os vendedores
            </CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={distributionMode} onValueChange={setDistributionMode} className="space-y-3">
              <div className="flex items-start space-x-3 p-3 rounded-lg border">
                <RadioGroupItem value="manual" id="manual" className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="manual" className="font-medium flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    Inbox Pai (Manual)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Leads entram em uma lista de espera. Vendedores visualizam os leads disponíveis e clicam em "Puxar lead" para assumir o atendimento.
                  </p>
                </div>
              </div>
              <div className="flex items-start space-x-3 p-3 rounded-lg border opacity-50">
                <RadioGroupItem value="round_robin" id="round_robin" disabled className="mt-1" />
                <div className="space-y-1">
                  <Label htmlFor="round_robin" className="font-medium text-muted-foreground">
                    Round Robin (Em breve)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Leads são automaticamente distribuídos entre os vendedores de forma equilibrada.
                  </p>
                </div>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Configuration Form */}
        <Card>
          <CardHeader>
            <CardTitle>Credenciais da API WhatsApp</CardTitle>
            <CardDescription>
              Configure as credenciais do WhatsApp Business API da empresa. 
              <a 
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/get-started" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline ml-1 inline-flex items-center gap-1"
              >
                Ver documentação <ExternalLink className="h-3 w-3" />
              </a>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="waba_id">WABA ID (WhatsApp Business Account ID) *</Label>
              <Input
                id="waba_id"
                placeholder="Ex: 123456789012345"
                value={formData.waba_id}
                onChange={(e) => setFormData({ ...formData, waba_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Encontre em: Meta Business Suite → WhatsApp → Configurações da API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone_number_id">Phone Number ID *</Label>
              <Input
                id="phone_number_id"
                placeholder="Ex: 123456789012345"
                value={formData.phone_number_id}
                onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="permanent_token">Permanent Token (Access Token) *</Label>
              <div className="relative">
                <Input
                  id="permanent_token"
                  type={showToken ? "text" : "password"}
                  placeholder="Token de acesso permanente"
                  value={formData.permanent_token}
                  onChange={(e) => setFormData({ ...formData, permanent_token: e.target.value })}
                  className="pr-10"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="absolute right-0 top-0 h-full px-3"
                  onClick={() => setShowToken(!showToken)}
                >
                  {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Use um token de acesso permanente do sistema para maior estabilidade
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="verification_token">Verification Token *</Label>
              <Input
                id="verification_token"
                placeholder="Token para verificação do webhook"
                value={formData.verification_token}
                onChange={(e) => setFormData({ ...formData, verification_token: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Crie um token único para validar os webhooks da Meta (ex: whasense_webhook_2024)
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Validando e salvando...
                </>
              ) : settings ? (
                'Atualizar Configurações'
              ) : (
                'Conectar WhatsApp'
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Webhook Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Configuração do Webhook</CardTitle>
            <CardDescription>
              Configure este webhook no painel da Meta para receber mensagens de TODAS as empresas
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook (Global)</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => {
                    navigator.clipboard.writeText(webhookUrl);
                    toast.success('URL copiada!');
                  }}
                >
                  Copiar
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Este é o webhook global do Whasense. Todas as empresas usam a mesma URL.
              </p>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label>Campos para Subscrever</Label>
              <div className="bg-muted p-3 rounded-md font-mono text-xs">
                messages, message_deliveries, message_reads
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Ao configurar o webhook na Meta, use o <strong>Verification Token</strong> definido acima.
                O webhook deve estar configurado no App oficial do Whasense no Business Manager.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
