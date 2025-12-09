import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Building2 } from "lucide-react";

interface NewCompanyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: (company: { id: string; name: string }) => void;
}

const NewCompanyModal = ({ open, onOpenChange, onSuccess }: NewCompanyModalProps) => {
  const [name, setName] = useState("");
  const [segment, setSegment] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error("Nome da empresa é obrigatório");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("companies")
        .insert({
          name: name.trim(),
          segment: segment.trim() || null,
          description: description.trim() || null,
        })
        .select()
        .single();

      if (error) throw error;

      toast.success("Empresa cadastrada com sucesso!");
      onSuccess({ id: data.id, name: data.name });
      onOpenChange(false);
      
      // Reset form
      setName("");
      setSegment("");
      setDescription("");
    } catch (error) {
      console.error("Error creating company:", error);
      toast.error("Erro ao criar empresa");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            Nova Empresa
          </DialogTitle>
          <DialogDescription>
            Cadastre uma nova empresa para vincular aos leads.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="company-name">Nome da Empresa *</Label>
            <Input
              id="company-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Acme Corp"
            />
          </div>

          {/* Segment */}
          <div className="space-y-2">
            <Label htmlFor="segment">Segmento</Label>
            <Input
              id="segment"
              value={segment}
              onChange={(e) => setSegment(e.target.value)}
              placeholder="Ex: Tecnologia, Varejo, Saúde..."
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Breve descrição da empresa..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim()}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Criar Empresa
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default NewCompanyModal;
