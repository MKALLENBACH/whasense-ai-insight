import AppLayout from "@/components/layout/AppLayout";
import { mockConversations } from "@/data/mockData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { Search, History, CheckCircle2, XCircle, Clock } from "lucide-react";
import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const HistoryPage = () => {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredConversations = mockConversations.filter(
    (c) =>
      c.contact.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.contact.phone.includes(searchQuery) ||
      c.contact.company?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "won":
        return (
          <Badge variant="default" className="bg-success hover:bg-success/90">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Ganha
          </Badge>
        );
      case "lost":
        return (
          <Badge variant="destructive">
            <XCircle className="h-3 w-3 mr-1" />
            Perdida
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            <Clock className="h-3 w-3 mr-1" />
            Em andamento
          </Badge>
        );
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Histórico de Conversas</h1>
            <p className="text-muted-foreground">
              Visualize todas as conversas da equipe
            </p>
          </div>
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
            <History className="h-6 w-6 text-primary" />
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, telefone ou empresa..."
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
            <CardTitle>Todas as Conversas ({filteredConversations.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contato</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Temperatura</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Última Mensagem</TableHead>
                  <TableHead>Quando</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredConversations.map((conversation) => (
                  <TableRow key={conversation.id} className="cursor-pointer hover:bg-muted/50">
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                          {conversation.contact.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium">{conversation.contact.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {conversation.contact.phone}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {conversation.contact.company || (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <LeadTemperatureBadge
                        temperature={conversation.leadTemperature}
                        size="sm"
                      />
                    </TableCell>
                    <TableCell>{getStatusBadge(conversation.saleStatus)}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {conversation.lastMessage}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatDistanceToNow(conversation.lastMessageTime, {
                        addSuffix: true,
                        locale: ptBR,
                      })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {filteredConversations.length === 0 && (
              <div className="text-center py-12">
                <Search className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <p className="text-muted-foreground">Nenhuma conversa encontrada</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default HistoryPage;
