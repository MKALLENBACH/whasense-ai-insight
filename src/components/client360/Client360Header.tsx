import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Building2,
  Users,
  TrendingUp,
  Edit,
  UserPlus,
  Calendar,
  Thermometer,
  Heart,
  Trophy,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import LeadTemperatureBadge from "@/components/LeadTemperatureBadge";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
  notes: string | null;
  created_at: string;
}

interface Stats {
  totalBuyers: number;
  totalCycles: number;
  totalSales: number;
  avgTemperature: "hot" | "warm" | "cold";
  predominantEmotion: string;
}

interface Client360HeaderProps {
  client: Client;
  stats: Stats;
  onEdit: () => void;
  onNewBuyer: () => void;
}

const Client360Header = ({ client, stats, onEdit, onNewBuyer }: Client360HeaderProps) => {
  return (
    <Card className="overflow-hidden">
      <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-6">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          {/* Client Info */}
          <div className="flex items-start gap-4">
            <div className="h-16 w-16 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{client.name}</h1>
              <div className="flex flex-wrap items-center gap-2 mt-1 text-sm text-muted-foreground">
                {client.cnpj && (
                  <span>CNPJ: {client.cnpj}</span>
                )}
                {client.segment && (
                  <Badge variant="secondary">{client.segment}</Badge>
                )}
              </div>
              <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
                <Calendar className="h-3 w-3" />
                Primeiro contato: {format(new Date(client.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onEdit}>
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            <Button size="sm" onClick={onNewBuyer}>
              <UserPlus className="h-4 w-4 mr-2" />
              Novo Comprador
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <CardContent className="p-6 pt-0">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 -mt-4">
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">Compradores</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalBuyers}</p>
          </div>
          
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="h-4 w-4 text-warning" />
              <span className="text-xs text-muted-foreground">Ciclos</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalCycles}</p>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-success" />
              <span className="text-xs text-muted-foreground">Vendas</span>
            </div>
            <p className="text-2xl font-bold">{stats.totalSales}</p>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Thermometer className="h-4 w-4 text-destructive" />
              <span className="text-xs text-muted-foreground">Temperatura</span>
            </div>
            <LeadTemperatureBadge temperature={stats.avgTemperature} size="sm" />
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="h-4 w-4 text-pink-500" />
              <span className="text-xs text-muted-foreground">Emoção</span>
            </div>
            <p className="text-sm font-medium capitalize">{stats.predominantEmotion}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default Client360Header;
