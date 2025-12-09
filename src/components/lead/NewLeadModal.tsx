import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus, Building2, Plus, Phone, Mail, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import NewCompanyModal from "./NewCompanyModal";

interface Company {
  id: string;
  name: string;
  segment: string | null;
}

interface NewLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  phoneNumber: string;
  customerId?: string;
  isEditMode?: boolean;
  existingData?: {
    name: string;
    email: string | null;
    companyId: string | null;
  };
  onSuccess: () => void;
  onSkip?: () => void;
}

const NewLeadModal = ({
  open,
  onOpenChange,
  phoneNumber,
  customerId,
  isEditMode = false,
  existingData,
  onSuccess,
  onSkip,
}: NewLeadModalProps) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState<string | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingCompanies, setIsFetchingCompanies] = useState(false);
  const [showNewCompanyModal, setShowNewCompanyModal] = useState(false);

  useEffect(() => {
    if (open) {
      fetchCompanies();
      if (isEditMode && existingData) {
        setName(existingData.name !== "Lead não identificado" ? existingData.name : "");
        setEmail(existingData.email || "");
        setSelectedCompanyId(existingData.companyId);
      } else {
        setName("");
        setEmail("");
        setSelectedCompanyId(null);
      }
    }
  }, [open, isEditMode, existingData]);

  const fetchCompanies = async () => {
    setIsFetchingCompanies(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, segment")
        .order("name");

      if (error) throw error;
      setCompanies(data || []);
    } catch (error) {
      console.error("Error fetching companies:", error);
    } finally {
      setIsFetchingCompanies(false);
    }
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    setIsLoading(true);
    try {
      if (isEditMode && customerId) {
        // Update existing customer
        const { error } = await supabase
          .from("customers")
          .update({
            name: name.trim(),
            email: email.trim() || null,
            company_id: selectedCompanyId,
            is_incomplete: false,
          })
          .eq("id", customerId);

        if (error) throw error;
        toast.success("Lead atualizado com sucesso!");
      } else {
        // Create new customer
        const { error } = await supabase
          .from("customers")
          .insert({
            name: name.trim(),
            phone: phoneNumber,
            email: email.trim() || null,
            company_id: selectedCompanyId || user?.companyId,
            seller_id: user?.id,
            is_incomplete: false,
            lead_status: "pending",
          });

        if (error) throw error;
        toast.success("Lead cadastrado com sucesso!");
      }

      onSuccess();
      onOpenChange(false);
    } catch (error) {
      console.error("Error saving lead:", error);
      toast.error("Erro ao salvar lead");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSkip = async () => {
    if (isEditMode) {
      onOpenChange(false);
      return;
    }

    // Create incomplete lead
    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("customers")
        .insert({
          name: "Lead não identificado",
          phone: phoneNumber,
          email: null,
          company_id: user?.companyId,
          seller_id: user?.id,
          is_incomplete: true,
          lead_status: "pending",
        });

      if (error) throw error;
      toast.info("Lead criado como incompleto");
      onSkip?.();
      onOpenChange(false);
    } catch (error) {
      console.error("Error creating incomplete lead:", error);
      toast.error("Erro ao criar lead");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyCreated = (newCompany: { id: string; name: string }) => {
    setCompanies((prev) => [...prev, { ...newCompany, segment: null }].sort((a, b) => a.name.localeCompare(b.name)));
    setSelectedCompanyId(newCompany.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-primary" />
              {isEditMode ? "Completar Dados do Lead" : "Novo Lead Detectado"}
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Complete as informações do lead para melhor acompanhamento."
                : "Uma nova mensagem foi recebida de um número não cadastrado. Preencha os dados do lead."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="flex items-center gap-1">
                <User className="h-3.5 w-3.5" />
                Nome *
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome do lead"
              />
            </div>

            {/* Phone (readonly) */}
            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                Telefone
              </Label>
              <Input
                id="phone"
                value={phoneNumber}
                readOnly
                className="bg-muted"
              />
            </div>

            {/* Email */}
            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" />
                Email (opcional)
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            {/* Company */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Building2 className="h-3.5 w-3.5" />
                Empresa
              </Label>
              <div className="flex gap-2">
                <Select
                  value={selectedCompanyId || ""}
                  onValueChange={(value) => setSelectedCompanyId(value || null)}
                  disabled={isFetchingCompanies}
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Selecione uma empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => (
                      <SelectItem key={company.id} value={company.id}>
                        {company.name}
                        {company.segment && (
                          <span className="text-muted-foreground ml-2">• {company.segment}</span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => setShowNewCompanyModal(true)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={handleSkip}
              disabled={isLoading}
            >
              {isEditMode ? "Cancelar" : "Preencher Depois"}
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isLoading || !name.trim()}
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <NewCompanyModal
        open={showNewCompanyModal}
        onOpenChange={setShowNewCompanyModal}
        onSuccess={handleCompanyCreated}
      />
    </>
  );
};

export default NewLeadModal;
