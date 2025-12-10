import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Building2, Plus, Search } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Client {
  id: string;
  name: string;
  cnpj: string | null;
  segment: string | null;
}

interface LinkClientModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  customerName: string;
  onSuccess: () => void;
}

const LinkClientModal = ({ 
  open, 
  onOpenChange, 
  customerId, 
  customerName,
  onSuccess 
}: LinkClientModalProps) => {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // New client form
  const [name, setName] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [segment, setSegment] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open && user?.companyId) {
      fetchClients();
    }
  }, [open, user?.companyId]);

  const fetchClients = async () => {
    if (!user?.companyId) return;
    
    const { data, error } = await supabase
      .from("clients")
      .select("id, name, cnpj, segment")
      .eq("company_id", user.companyId)
      .order("name");
    
    if (!error && data) {
      setClients(data);
    }
  };

  const handleLinkClient = async (clientId: string) => {
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ client_id: clientId })
        .eq("id", customerId);

      if (error) throw error;

      toast.success("Cliente vinculado com sucesso!");
      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error linking client:", error);
      toast.error("Erro ao vincular cliente");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAndLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    if (!user?.companyId) {
      toast.error("Empresa não encontrada");
      return;
    }

    setIsLoading(true);
    try {
      // Create the client
      const { data: newClient, error: createError } = await supabase
        .from("clients")
        .insert({
          company_id: user.companyId,
          name: name.trim(),
          cnpj: cnpj.trim() || null,
          segment: segment.trim() || null,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (createError) throw createError;

      // Link to customer
      const { error: linkError } = await supabase
        .from("customers")
        .update({ client_id: newClient.id })
        .eq("id", customerId);

      if (linkError) throw linkError;

      toast.success("Empresa criada e vinculada com sucesso!");
      onSuccess();
      onOpenChange(false);
      
      // Reset form
      setName("");
      setCnpj("");
      setSegment("");
      setNotes("");
      setShowCreateForm(false);
    } catch (error) {
      console.error("Error creating and linking client:", error);
      toast.error("Erro ao criar empresa");
    } finally {
      setIsLoading(false);
    }
  };

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.cnpj?.includes(searchQuery)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vincular Empresa</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Vincular <strong>{customerName}</strong> a uma empresa
          </p>
        </DialogHeader>

        {!showCreateForm ? (
          <div className="space-y-4">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar empresa..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            {/* Client list */}
            <ScrollArea className="h-[200px] border rounded-md">
              {filteredClients.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-sm">
                  {clients.length === 0 
                    ? "Nenhuma empresa cadastrada" 
                    : "Nenhuma empresa encontrada"}
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {filteredClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => handleLinkClient(client.id)}
                      disabled={isLoading}
                      className="w-full flex items-center gap-3 p-2 rounded-md hover:bg-accent text-left transition-colors disabled:opacity-50"
                    >
                      <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm truncate">{client.name}</p>
                        {client.cnpj && (
                          <p className="text-xs text-muted-foreground">{client.cnpj}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Create new button */}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setShowCreateForm(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Criar Nova Empresa
            </Button>
          </div>
        ) : (
          <form onSubmit={handleCreateAndLink} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome da Empresa *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome da empresa cliente"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cnpj">CNPJ</Label>
              <Input
                id="cnpj"
                value={cnpj}
                onChange={(e) => setCnpj(e.target.value)}
                placeholder="00.000.000/0000-00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="segment">Segmento</Label>
              <Input
                id="segment"
                value={segment}
                onChange={(e) => setSegment(e.target.value)}
                placeholder="Ex: Varejo, Indústria, Serviços..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Anotações sobre a empresa..."
                rows={2}
              />
            </div>
            <div className="flex gap-2">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setShowCreateForm(false)}
                className="flex-1"
              >
                Voltar
              </Button>
              <Button type="submit" disabled={isLoading} className="flex-1">
                {isLoading ? "Criando..." : "Criar e Vincular"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default LinkClientModal;
