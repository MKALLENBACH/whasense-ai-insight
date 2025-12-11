import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Webhook, CheckCircle2, AlertCircle, Copy, Building2, Phone, ExternalLink }from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface CompanyWhatsAppSetting {
  id: string;
  company_id: string;
  waba_id: string | null;
  phone_number_id: string | null;
  display_phone_number: string | null;
  status: string;
  last_check: string | null;
  last_error: string | null;
  company?: { name: string };
}

export default function AdminWebhookPage() {
  const [loading, setLoading] = useState(true);
  const [companies, setCompanies] = useState<CompanyWhatsAppSetting[]>([]);

  const webhookUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-cloud-webhook`;

  useEffect(() => {
    fetchConnectedCompanies();
  }, []);

  const fetchConnectedCompanies = async () => {
    try {
      const { data, error } = await supabase
        .from('company_whatsapp_settings')
        .select(`
          *,
          company:companies(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies((data || []) as unknown as CompanyWhatsAppSetting[]);
    } catch (error) {
      console.error('Error fetching companies:', error);
      toast.error('Erro ao carregar empresas conectadas');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiada!`);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'connected':
        return <Badge className="bg-green-500"><CheckCircle2 className="h-3 w-3 mr-1" />Conectado</Badge>;
      case 'error':
        return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      default:
        return <Badge variant="outline">Desconectado</Badge>;
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Webhook className="h-7 w-7 text-primary" />
            Webhook Global WhatsApp
          </h1>
          <p className="text-muted-foreground">
            Configuração do webhook central que recebe mensagens de TODAS as empresas
          </p>
        </div>

        {/* Webhook URL Card */}
        <Card>
          <CardHeader>
            <CardTitle>URL do Webhook</CardTitle>
            <CardDescription>
              Configure esta URL no App do Whasense no Meta Business Manager
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Callback URL</Label>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={webhookUrl}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(webhookUrl, 'URL')}
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copiar
                </Button>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Campos para Subscrever</Label>
                <div className="bg-muted p-3 rounded-md font-mono text-xs">
                  messages, message_deliveries, message_reads
                </div>
              </div>
              <div className="space-y-2">
                <Label>Verification Token</Label>
                <p className="text-sm text-muted-foreground">
                  Cada empresa define seu próprio verification_token nas configurações
                </p>
              </div>
            </div>

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Importante</AlertTitle>
              <AlertDescription>
                Este webhook recebe mensagens de TODAS as empresas conectadas. O roteamento é feito
                automaticamente com base no <strong>phone_number_id</strong> ou <strong>waba_id</strong> de cada mensagem.
              </AlertDescription>
            </Alert>

            <div className="pt-2">
              <a 
                href="https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/set-up" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
              >
                Ver documentação da Meta <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Connected Companies */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Empresas Conectadas
            </CardTitle>
            <CardDescription>
              Lista de empresas com WhatsApp Business API configurado
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : companies.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma empresa conectou o WhatsApp ainda
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Empresa</TableHead>
                    <TableHead>Número</TableHead>
                    <TableHead>WABA ID</TableHead>
                    <TableHead>Phone Number ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Verificação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companies.map((company) => (
                    <TableRow key={company.id}>
                      <TableCell className="font-medium">
                        {company.company?.name || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {company.display_phone_number ? (
                          <span className="flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {company.display_phone_number}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {company.waba_id || '-'}
                        </code>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {company.phone_number_id || '-'}
                        </code>
                      </TableCell>
                      <TableCell>{getStatusBadge(company.status)}</TableCell>
                      <TableCell>
                        {company.last_check 
                          ? new Date(company.last_check).toLocaleString('pt-BR')
                          : '-'
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
