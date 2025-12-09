import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  Smartphone, 
  RefreshCw, 
  Power, 
  CheckCircle2, 
  XCircle, 
  Clock,
  QrCode,
  Loader2
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

type SessionStatus = 'connected' | 'disconnected' | 'pending' | 'expired';

interface SessionData {
  sessionId?: string;
  sessionStatus: SessionStatus;
  qrCodeBase64?: string;
  phoneNumber?: string;
  lastConnectedAt?: string;
  expiresAt?: string;
  isActive?: boolean;
  hasSession?: boolean;
}

const WhatsAppConnectPage = () => {
  const { user } = useAuth();
  const [sessionData, setSessionData] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [qrTimeLeft, setQrTimeLeft] = useState<number>(0);

  const fetchSessionStatus = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await supabase.functions.invoke('whatsapp-session', {
        body: {},
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      // Handle the invoke call with query params differently
      const statusResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session?action=status`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await statusResponse.json();
      setSessionData(data);
    } catch (error) {
      console.error('Error fetching session status:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const initSession = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session?action=init`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      setSessionData(data);
      
      if (data.sessionStatus === 'pending') {
        toast.info('Escaneie o QR Code com seu WhatsApp');
      }
    } catch (error) {
      console.error('Error initializing session:', error);
      toast.error('Erro ao iniciar sessão');
    } finally {
      setActionLoading(false);
    }
  };

  const simulateConnect = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session?action=simulate-connect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ phoneNumber: '+5511999999999' }),
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('WhatsApp conectado com sucesso!');
        setSessionData(prev => ({
          ...prev,
          sessionStatus: 'connected',
          isActive: true,
          phoneNumber: data.phoneNumber,
        }));
      }
    } catch (error) {
      console.error('Error simulating connect:', error);
      toast.error('Erro ao conectar');
    } finally {
      setActionLoading(false);
    }
  };

  const disconnect = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session?action=disconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      if (data.success) {
        toast.success('WhatsApp desconectado');
        setSessionData(prev => ({
          ...prev,
          sessionStatus: 'disconnected',
          isActive: false,
        }));
      }
    } catch (error) {
      console.error('Error disconnecting:', error);
      toast.error('Erro ao desconectar');
    } finally {
      setActionLoading(false);
    }
  };

  const reconnect = async () => {
    setActionLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/whatsapp-session?action=reconnect`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const data = await response.json();
      setSessionData(data);
      
      if (data.sessionStatus === 'pending') {
        toast.info('Novo QR Code gerado. Escaneie com seu WhatsApp.');
      }
    } catch (error) {
      console.error('Error reconnecting:', error);
      toast.error('Erro ao reconectar');
    } finally {
      setActionLoading(false);
    }
  };

  // Fetch initial status
  useEffect(() => {
    fetchSessionStatus();
  }, [fetchSessionStatus]);

  // Poll for status changes when pending
  useEffect(() => {
    if (sessionData?.sessionStatus === 'pending') {
      const interval = setInterval(fetchSessionStatus, 3000);
      return () => clearInterval(interval);
    }
  }, [sessionData?.sessionStatus, fetchSessionStatus]);

  // QR code timer
  useEffect(() => {
    if (sessionData?.expiresAt && sessionData.sessionStatus === 'pending') {
      const updateTimer = () => {
        const expiresAt = new Date(sessionData.expiresAt!).getTime();
        const now = Date.now();
        const diff = Math.max(0, Math.floor((expiresAt - now) / 1000));
        setQrTimeLeft(diff);
        
        if (diff === 0) {
          setSessionData(prev => prev ? { ...prev, sessionStatus: 'expired' } : null);
        }
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 1000);
      return () => clearInterval(interval);
    }
  }, [sessionData?.expiresAt, sessionData?.sessionStatus]);

  const getStatusBadge = (status: SessionStatus) => {
    switch (status) {
      case 'connected':
        return (
          <Badge className="bg-success/10 text-success border-success/20">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Conectado
          </Badge>
        );
      case 'pending':
        return (
          <Badge className="bg-warning/10 text-warning border-warning/20">
            <Clock className="h-3 w-3 mr-1" />
            Aguardando
          </Badge>
        );
      case 'expired':
        return (
          <Badge className="bg-muted text-muted-foreground border-muted">
            <Clock className="h-3 w-3 mr-1" />
            Expirado
          </Badge>
        );
      default:
        return (
          <Badge className="bg-destructive/10 text-destructive border-destructive/20">
            <XCircle className="h-3 w-3 mr-1" />
            Desconectado
          </Badge>
        );
    }
  };

  if (loading) {
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
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Conectar WhatsApp</h1>
            <p className="text-muted-foreground">Vincule seu número para receber mensagens</p>
          </div>
        </div>

        <Card className="border-2">
          <CardHeader className="text-center pb-2">
            <div className="flex justify-center mb-4">
              {getStatusBadge(sessionData?.sessionStatus || 'disconnected')}
            </div>
            <CardTitle>
              {sessionData?.sessionStatus === 'connected' 
                ? 'WhatsApp Conectado' 
                : sessionData?.sessionStatus === 'pending'
                ? 'Escaneie o QR Code'
                : 'Conecte seu WhatsApp'}
            </CardTitle>
            <CardDescription>
              {sessionData?.sessionStatus === 'connected' 
                ? `Número: ${sessionData.phoneNumber}`
                : sessionData?.sessionStatus === 'pending'
                ? 'Abra o WhatsApp no seu celular e escaneie o código'
                : 'Clique em conectar para gerar o QR Code'}
            </CardDescription>
          </CardHeader>

          <CardContent className="flex flex-col items-center gap-6 pt-4">
            {/* QR Code Display */}
            {sessionData?.sessionStatus === 'pending' && sessionData.qrCodeBase64 && (
              <div className="relative">
                <div className="p-4 bg-white rounded-2xl shadow-lg">
                  <img 
                    src={sessionData.qrCodeBase64} 
                    alt="QR Code" 
                    className="w-64 h-64"
                  />
                </div>
                {qrTimeLeft > 0 && (
                  <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-background border rounded-full px-3 py-1 text-sm font-medium">
                    <Clock className="h-3 w-3 inline mr-1" />
                    {Math.floor(qrTimeLeft / 60)}:{(qrTimeLeft % 60).toString().padStart(2, '0')}
                  </div>
                )}
              </div>
            )}

            {/* Connected State */}
            {sessionData?.sessionStatus === 'connected' && (
              <div className="text-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-success/10 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="h-12 w-12 text-success" />
                </div>
                {sessionData.lastConnectedAt && (
                  <p className="text-sm text-muted-foreground">
                    Conectado desde {format(new Date(sessionData.lastConnectedAt), "dd 'de' MMMM 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            )}

            {/* Disconnected State */}
            {(sessionData?.sessionStatus === 'disconnected' || !sessionData?.hasSession) && (
              <div className="text-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <QrCode className="h-12 w-12 text-muted-foreground" />
                </div>
                <div className="text-sm text-muted-foreground space-y-2">
                  <p>1. Clique em "Conectar" abaixo</p>
                  <p>2. Abra o WhatsApp no seu celular</p>
                  <p>3. Vá em Configurações → Dispositivos conectados</p>
                  <p>4. Escaneie o QR Code que aparecerá</p>
                </div>
              </div>
            )}

            {/* Expired State */}
            {sessionData?.sessionStatus === 'expired' && (
              <div className="text-center space-y-4">
                <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center mx-auto">
                  <Clock className="h-12 w-12 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  O QR Code expirou. Clique em reconectar para gerar um novo.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3 justify-center">
              {(sessionData?.sessionStatus === 'disconnected' || !sessionData?.hasSession) && (
                <Button onClick={initSession} disabled={actionLoading} size="lg">
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Smartphone className="h-4 w-4 mr-2" />
                  )}
                  Conectar
                </Button>
              )}

              {sessionData?.sessionStatus === 'pending' && (
                <>
                  <Button onClick={simulateConnect} disabled={actionLoading} variant="outline">
                    {actionLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 mr-2" />
                    )}
                    Simular Conexão (Teste)
                  </Button>
                  <Button onClick={reconnect} disabled={actionLoading} variant="ghost">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Novo QR Code
                  </Button>
                </>
              )}

              {(sessionData?.sessionStatus === 'expired') && (
                <Button onClick={reconnect} disabled={actionLoading} size="lg">
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Reconectar
                </Button>
              )}

              {sessionData?.sessionStatus === 'connected' && (
                <>
                  <Button onClick={reconnect} disabled={actionLoading} variant="outline">
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reconectar
                  </Button>
                  <Button onClick={disconnect} disabled={actionLoading} variant="destructive">
                    <Power className="h-4 w-4 mr-2" />
                    Desconectar
                  </Button>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Info Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Smartphone className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-1">
                <h3 className="font-medium">Sobre a conexão</h3>
                <p className="text-sm text-muted-foreground">
                  Sua sessão permanecerá ativa mesmo após você sair do sistema. 
                  Ela só será desconectada se você clicar em "Desconectar" ou se 
                  o WhatsApp for desconectado no celular.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default WhatsAppConnectPage;
