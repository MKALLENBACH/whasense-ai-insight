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
import { Loader2, MessageSquare, CheckCircle2, AlertCircle, XCircle, Eye, EyeOff, ExternalLink, RefreshCw } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface WhatsAppIntegration {
  id: string;
  phone_number_id: string;
  whatsapp_business_account_id: string;
  access_token: string;
  verification_token: string;
  display_phone_number: string | null;
  status: 'connected' | 'pending' | 'error' | 'disconnected';
  last_error: string | null;
  last_webhook_at: string | null;
  created_at: string;
  updated_at: string;
}

export default function SellerWhatsAppSettingsPage() {
  const { user } = useAuth();
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [integration, setIntegration] = useState<WhatsAppIntegration | null>(null);
  const [showToken, setShowToken] = useState(false);
  
  const [formData, setFormData] = useState({
    phone_number_id: '',
    whatsapp_business_account_id: '',
    access_token: '',
    verification_token: '',
  });

  useEffect(() => {
    const fetchCompanyId = async () => {
      if (!user?.id) return;
      const { data } = await supabase
        .from('profiles')
        .select('company_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (data?.company_id) setCompanyId(data.company_id);
    };
    fetchCompanyId();
    fetchIntegration();
  }, [user?.id]);

  const fetchIntegration = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('whatsapp_seller_integrations')
        .select('*')
        .eq('seller_id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setIntegration(data as WhatsAppIntegration);
        setFormData({
          phone_number_id: data.phone_number_id,
          whatsapp_business_account_id: data.whatsapp_business_account_id,
          access_token: data.access_token,
          verification_token: data.verification_token,
        });
      }
    } catch (error) {
      console.error('Error fetching integration:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!user?.id || !companyId) {
      toast.error('Usuário não autenticado');
      return;
    }

    if (!formData.phone_number_id || !formData.whatsapp_business_account_id || 
        !formData.access_token || !formData.verification_token) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-cloud-connect', {
        body: {
          action: 'connect',
          phone_number_id: formData.phone_number_id,
          whatsapp_business_account_id: formData.whatsapp_business_account_id,
          access_token: formData.access_token,
          verification_token: formData.verification_token,
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('WhatsApp conectado com sucesso!');
        fetchIntegration();
      } else {
        toast.error(data.error || 'Erro ao conectar WhatsApp');
      }
    } catch (error: any) {
      console.error('Error saving integration:', error);
      toast.error(error.message || 'Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!integration) return;
    
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke('whatsapp-cloud-connect', {
        body: {
          action: 'test',
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('Conexão verificada com sucesso!');
        fetchIntegration();
      } else {
        toast.error(data.error || 'Falha na verificação');
      }
    } catch (error: any) {
      console.error('Error testing connection:', error);
      toast.error(error.message || 'Erro ao testar conexão');
    } finally {
      setTesting(false);
    }
  };

  const handleDisconnect = async () => {
    if (!integration) return;
    
    if (!confirm('Tem certeza que deseja desconectar seu WhatsApp?')) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('whatsapp_seller_integrations')
        .delete()
        .eq('id', integration.id);

      if (error) throw error;

      toast.success('WhatsApp desconectado');
      setIntegration(null);
      setFormData({
        phone_number_id: '',
        whatsapp_business_account_id: '',
        access_token: '',
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
          <h1 className="text-2xl font-bold">Configurações WhatsApp</h1>
          <p className="text-muted-foreground">
            Conecte seu número do WhatsApp Business via API Oficial da Meta
          </p>
        </div>

        {integration && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageSquare className="h-5 w-5 text-green-500" />
                  Status da Conexão
                </CardTitle>
                {getStatusBadge(integration.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {integration.display_phone_number && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Número: </span>
                  <span className="font-medium">{integration.display_phone_number}</span>
                </div>
              )}
              {integration.last_webhook_at && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Último webhook: </span>
                  <span>{new Date(integration.last_webhook_at).toLocaleString('pt-BR')}</span>
                </div>
              )}
              {integration.last_error && integration.status === 'error' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Erro na conexão</AlertTitle>
                  <AlertDescription>{integration.last_error}</AlertDescription>
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

        <Card>
          <CardHeader>
            <CardTitle>Credenciais da API WhatsApp</CardTitle>
            <CardDescription>
              Configure as credenciais do seu WhatsApp Business API. 
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
              <Label htmlFor="phone_number_id">Phone Number ID *</Label>
              <Input
                id="phone_number_id"
                placeholder="Ex: 123456789012345"
                value={formData.phone_number_id}
                onChange={(e) => setFormData({ ...formData, phone_number_id: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Encontre em: Meta Business Suite → WhatsApp → Configurações da API
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="waba_id">WhatsApp Business Account ID *</Label>
              <Input
                id="waba_id"
                placeholder="Ex: 123456789012345"
                value={formData.whatsapp_business_account_id}
                onChange={(e) => setFormData({ ...formData, whatsapp_business_account_id: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="access_token">Access Token *</Label>
              <div className="relative">
                <Input
                  id="access_token"
                  type={showToken ? "text" : "password"}
                  placeholder="Token de acesso permanente"
                  value={formData.access_token}
                  onChange={(e) => setFormData({ ...formData, access_token: e.target.value })}
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
                Crie um token único para validar os webhooks da Meta
              </p>
            </div>

            <Button onClick={handleSave} disabled={saving} className="w-full">
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Conectando...
                </>
              ) : integration ? (
                'Atualizar Configurações'
              ) : (
                'Conectar Meu WhatsApp'
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configuração do Webhook</CardTitle>
            <CardDescription>
              Configure este webhook no painel da Meta para receber mensagens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>URL do Webhook</Label>
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
            </div>

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
                Ao configurar o webhook na Meta, use o mesmo Verification Token definido acima.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
