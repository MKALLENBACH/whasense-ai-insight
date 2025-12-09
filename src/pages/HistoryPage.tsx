import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";
import { 
  Search, 
  History, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Loader2,
  RefreshCw,
  MessageSquare,
  Smile,
  Frown,
  Meh,
  Angry,
  HelpCircle,
  Sparkles,
  ExternalLink,
  AlertTriangle
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { LeadTemperature } from "@/types";

interface ConversationHistory {
  id: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  };
  seller: {
    name: string;
    email: string;
  } | null;
  lastMessage: string;
  lastMessageTime: string;
  messageCount: number;
  insight: {
    sentiment: string;
    intention: string;
    objection: string;
    temperature: string;
    suggestion: string;
    next_action: string;
  } | null;
  sale: {
    id: string;
    status: string;
    reason: string | null;
    createdAt: string;
  } | null;
}

const sentimentConfig: Record<string, { icon: typeof Smile; label: string; className: string }> = {
  positive: { icon: Smile, label: "Positivo", className: "text-success" },
  excited: { icon: Sparkles, label: "Empolgado", className: "text-success" },
  neutral: { icon: Meh, label: "Neutro", className: "text-muted-foreground" },
  negative: { icon: Frown, label: "Negativo", className: "text-warning" },
  angry: { icon: Angry, label: "Irritado", className: "text-destructive" },
  insecure: { icon: HelpCircle, label: "Inseguro", className: "text-warning" },
};

const objectionLabels: Record<string, string> = {
  price: "Preço",
  delay: "Prazo",
  trust: "Confiança",
  doubt: "Dúvida",
  competition: "Concorrência",
  none: "-",
};

const HistoryPage = () => {
  const navigate = useNavigate();
  const { session } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [conversations, setConversations] = useState<ConversationHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchHistory = async () => {
    if (!session?.access_token) return;

    try {
      const { data, error } = await supabase.functions.invoke('conversation-history', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (error) throw error;
      setConversations(data?.conversations || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, [session]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchHistory();
  };

  const filteredConversations = conversations.filter(
    (c) =>
      c.customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.customer.phone?.includes(searchQuery) ||
      c.customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.seller?.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (sale: ConversationHistory['sale']) => {
    if (!sale) {
      return (
        <Badge variant="secondary">
          <Clock className="h-3 w-3 mr-1" />
          Em andamento
        </Badge>
      );
    }
    
    if (sale.status === "won") {
      return (
        <Badge variant="default" className="bg-success hover:bg-success/90">
          <CheckCircle2 className="h-3 w-3 mr-1" />
          Ganha
        </Badge>
      );
    }
    
    return (
      <Badge variant="destructive">
        <XCircle className="h-3 w-3 mr-1" />
        Perdida
      </Badge>
    );
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="h-[calc(100vh-3rem)] flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Carregando histórico...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Histórico de Conversas</h1>
            <p className="text-muted-foreground">
              Visualize todas as conversas com insights e resultados
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="icon"
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
            </Button>
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <History className="h-6 w-6 text-primary" />
            </div>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, telefone, email ou vendedor..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Todas as Conversas ({filteredConversations.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredConversations.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Emoção</TableHead>
                    <TableHead>Objeção</TableHead>
                    <TableHead>Temperatura</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Última Msg</TableHead>
                    <TableHead>Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredConversations.map((conversation) => {
                    const sentiment = conversation.insight?.sentiment || "neutral";
                    const sentimentInfo = sentimentConfig[sentiment] || sentimentConfig.neutral;
                    const SentimentIcon = sentimentInfo.icon;
                    const objection = conversation.insight?.objection || "none";
                    const temperature = (conversation.insight?.temperature || "cold") as LeadTemperature;

                    return (
                      <TableRow 
                        key={conversation.id} 
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => navigate(`/chat/${conversation.id}`)}
                      >
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                              {getInitials(conversation.customer.name)}
                            </div>
                            <div>
                              <p className="font-medium">{conversation.customer.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {conversation.customer.phone || conversation.customer.email || "-"}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {conversation.seller ? (
                            <span className="text-sm">{conversation.seller.name}</span>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className={cn("flex items-center gap-1.5", sentimentInfo.className)}>
                            <SentimentIcon className="h-4 w-4" />
                            <span className="text-xs">{sentimentInfo.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {objection !== "none" ? (
                            <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/30">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              {objectionLabels[objection] || objection}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <LeadTemperatureBadge
                            temperature={temperature}
                            size="sm"
                          />
                        </TableCell>
                        <TableCell>{getStatusBadge(conversation.sale)}</TableCell>
                        <TableCell>
                          <div className="max-w-[150px]">
                            <p className="text-sm truncate">{conversation.lastMessage}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(conversation.lastMessageTime), {
                                addSuffix: true,
                                locale: ptBR,
                              })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/chat/${conversation.id}`);
                            }}
                            className="gap-1"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Abrir
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? "Nenhuma conversa encontrada" : "Nenhuma conversa registrada ainda"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {searchQuery ? "Tente outro termo de busca" : "As conversas aparecerão aqui conforme forem registradas"}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default HistoryPage;
