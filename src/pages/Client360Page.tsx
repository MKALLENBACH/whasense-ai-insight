import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AppLayout from "@/components/layout/AppLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Building2,
  Users,
  TrendingUp,
  MessageSquare,
  Phone,
  Calendar,
  Thermometer,
  AlertTriangle,
  Trophy,
  XCircle,
  ChevronRight,
  Edit,
  UserPlus,
  ArrowLeft,
  Sparkles,
  BarChart3,
  LineChart,
  DollarSign,
  Brain,
  Mic,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import Client360Header from "@/components/client360/Client360Header";
import Client360BuyersList from "@/components/client360/Client360BuyersList";
import Client360Timeline from "@/components/client360/Client360Timeline";
import Client360Cycles from "@/components/client360/Client360Cycles";
import Client360Objections from "@/components/client360/Client360Objections";
import Client360Emotions from "@/components/client360/Client360Emotions";
import Client360Financial from "@/components/client360/Client360Financial";
import Client360AISummary from "@/components/client360/Client360AISummary";
import EditClientModal from "@/components/client360/EditClientModal";
import NewBuyerModal from "@/components/client360/NewBuyerModal";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
  notes: string | null;
  created_at: string;
  company_id: string;
}

interface Buyer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  role: string | null;
  client_id: string;
}

interface SaleCycle {
  id: string;
  status: string;
  created_at: string;
  closed_at: string | null;
  lost_reason: string | null;
  won_summary: string | null;
  buyer_id: string | null;
  customer_id: string;
}

const Client360Page = () => {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { user, isManager, isSeller } = useAuth();
  
  const [client, setClient] = useState<Client | null>(null);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [cycles, setCycles] = useState<SaleCycle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewBuyerModal, setShowNewBuyerModal] = useState(false);
  const [stats, setStats] = useState({
    totalBuyers: 0,
    totalCycles: 0,
    totalSales: 0,
    avgTemperature: "cold" as "hot" | "warm" | "cold",
    predominantEmotion: "neutral",
  });

  useEffect(() => {
    if (clientId && user?.id) {
      fetchClientData();
    }
  }, [clientId, user?.id, isSeller]);

  const fetchClientData = async () => {
    if (!clientId || !user?.id) return;
    
    setIsLoading(true);
    try {
      // For sellers, first verify they have access to this client
      if (isSeller) {
        // Check if seller has any messages with customers linked to this client
        const { data: accessCheck, error: accessError } = await supabase
          .from("messages")
          .select(`
            id,
            customers!inner (
              client_id
            )
          `)
          .eq("seller_id", user.id)
          .limit(1);
        
        // Filter by client_id in customers
        const hasAccess = accessCheck?.some(m => (m.customers as any)?.client_id === clientId);
        
        if (!hasAccess) {
          setClient(null);
          setIsLoading(false);
          return;
        }
      }

      // Fetch client
      const { data: clientData, error: clientError } = await supabase
        .from("clients")
        .select("*")
        .eq("id", clientId)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!clientData) {
        setClient(null);
        setIsLoading(false);
        return;
      }
      setClient(clientData);

      // Fetch buyers
      const { data: buyersData, error: buyersError } = await supabase
        .from("buyers")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });

      if (buyersError) throw buyersError;
      setBuyers(buyersData || []);

      // Fetch cycles for this client (filtered by seller if not manager)
      let cyclesQuery = supabase
        .from("sale_cycles")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      
      if (isSeller) {
        cyclesQuery = cyclesQuery.eq("seller_id", user.id);
      }

      const { data: cyclesData, error: cyclesError } = await cyclesQuery;

      if (!cyclesError && cyclesData) {
        setCycles(cyclesData);
        
        // Calculate stats (based on filtered cycles for sellers)
        const wonCycles = cyclesData.filter(c => c.status === "won");
        setStats({
          totalBuyers: buyersData?.length || 0,
          totalCycles: cyclesData.length,
          totalSales: wonCycles.length,
          avgTemperature: "warm", // Would calculate from insights
          predominantEmotion: "neutral",
        });
      }
    } catch (error) {
      console.error("Error fetching client data:", error);
      toast.error("Erro ao carregar dados do cliente");
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <AppLayout>
        <div className="p-6 space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </AppLayout>
    );
  }

  if (!client) {
    return (
      <AppLayout>
        <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h2 className="text-xl font-semibold mb-2">Cliente não encontrado</h2>
          <p className="text-muted-foreground mb-4">
            {isSeller 
              ? "Você não tem acesso a este cliente ou ele não existe."
              : "O cliente solicitado não existe ou foi removido."}
          </p>
          <Button onClick={() => navigate("/clientes")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar para Clientes
          </Button>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/clientes")}
          className="mb-2"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para Clientes
        </Button>

        {/* Header Section */}
        <Client360Header
          client={client}
          stats={stats}
          onEdit={isManager ? () => setShowEditModal(true) : undefined}
          onNewBuyer={isManager ? () => setShowNewBuyerModal(true) : undefined}
        />

        {/* Tabs for different sections */}
        <Tabs defaultValue="buyers" className="space-y-4">
          <TabsList className="grid grid-cols-4 lg:grid-cols-8 gap-1">
            <TabsTrigger value="buyers" className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Compradores</span>
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-1">
              <MessageSquare className="h-4 w-4" />
              <span className="hidden sm:inline">Timeline</span>
            </TabsTrigger>
            <TabsTrigger value="cycles" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Ciclos</span>
            </TabsTrigger>
            <TabsTrigger value="objections" className="flex items-center gap-1">
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Objeções</span>
            </TabsTrigger>
            <TabsTrigger value="emotions" className="flex items-center gap-1">
              <LineChart className="h-4 w-4" />
              <span className="hidden sm:inline">Emoções</span>
            </TabsTrigger>
            <TabsTrigger value="financial" className="flex items-center gap-1">
              <DollarSign className="h-4 w-4" />
              <span className="hidden sm:inline">Financeiro</span>
            </TabsTrigger>
            <TabsTrigger value="ai" className="flex items-center gap-1">
              <Brain className="h-4 w-4" />
              <span className="hidden sm:inline">IA 360°</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="buyers">
            <Client360BuyersList 
              buyers={buyers} 
              clientId={clientId!}
              onRefresh={fetchClientData}
            />
          </TabsContent>

          <TabsContent value="timeline">
            <Client360Timeline clientId={clientId!} />
          </TabsContent>

          <TabsContent value="cycles">
            <Client360Cycles clientId={clientId!} cycles={cycles} buyers={buyers} />
          </TabsContent>

          <TabsContent value="objections">
            <Client360Objections clientId={clientId!} />
          </TabsContent>

          <TabsContent value="emotions">
            <Client360Emotions clientId={clientId!} />
          </TabsContent>

          <TabsContent value="financial">
            <Client360Financial clientId={clientId!} />
          </TabsContent>

          <TabsContent value="ai">
            <Client360AISummary clientId={clientId!} client={client} />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <EditClientModal
        open={showEditModal}
        onOpenChange={setShowEditModal}
        client={client}
        onSuccess={fetchClientData}
      />

      <NewBuyerModal
        open={showNewBuyerModal}
        onOpenChange={setShowNewBuyerModal}
        clientId={clientId!}
        companyId={client.company_id}
        onSuccess={fetchClientData}
      />
    </AppLayout>
  );
};

export default Client360Page;
