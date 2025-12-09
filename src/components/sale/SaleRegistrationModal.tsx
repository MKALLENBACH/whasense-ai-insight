import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Trophy, 
  XCircle, 
  Loader2, 
  Sparkles, 
  DollarSign,
  Clock,
  Users,
  Shield,
  HelpCircle,
  CheckCircle2
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SaleRegistrationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  sellerId: string;
  customerName: string;
  cycleId?: string;
  onSuccess?: (status: "won" | "lost", reason?: string, summary?: string) => void;
  isEditMode?: boolean;
  existingSaleId?: string;
  existingStatus?: "won" | "lost";
  existingReason?: string;
}

const lossReasons = [
  { value: "price", label: "Preço", icon: DollarSign, description: "Achou caro demais" },
  { value: "delay", label: "Demora", icon: Clock, description: "Prazo não atendeu" },
  { value: "competition", label: "Concorrência", icon: Users, description: "Fechou com outro" },
  { value: "trust", label: "Desconfiança", icon: Shield, description: "Não confiou na oferta" },
  { value: "other", label: "Outro", icon: HelpCircle, description: "Outro motivo" },
];

const reasonLabels: Record<string, string> = {
  price: "Preço",
  delay: "Demora",
  competition: "Concorrência",
  trust: "Desconfiança",
  other: "Outro",
};

const SaleRegistrationModal = ({
  open,
  onOpenChange,
  customerId,
  sellerId,
  customerName,
  cycleId,
  onSuccess,
  isEditMode = false,
  existingSaleId,
  existingStatus,
  existingReason,
}: SaleRegistrationModalProps) => {
  const [activeTab, setActiveTab] = useState<"won" | "lost">("won");
  const [selectedReason, setSelectedReason] = useState<string>("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingSuggestion, setIsLoadingSuggestion] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<{
    suggested_reason: string;
    explanation: string;
  } | null>(null);

  // Fetch AI suggestion when switching to "lost" tab
  useEffect(() => {
    if (activeTab === "lost" && open) {
      fetchLossReasonSuggestion();
    }
  }, [activeTab, open]);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      if (isEditMode && existingStatus) {
        setActiveTab(existingStatus);
        setSelectedReason(existingReason || "");
      } else {
        setActiveTab("won");
        setSelectedReason("");
      }
      setDescription("");
      setAiSuggestion(null);
    }
  }, [open, isEditMode, existingStatus, existingReason]);

  const fetchLossReasonSuggestion = async () => {
    setIsLoadingSuggestion(true);
    try {
      const { data, error } = await supabase.functions.invoke("loss-reason", {
        body: { customer_id: customerId, seller_id: sellerId },
      });

      if (error) throw error;

      setAiSuggestion(data);
      // Auto-select the suggested reason
      if (data?.suggested_reason) {
        setSelectedReason(data.suggested_reason);
      }
    } catch (error) {
      console.error("Error fetching loss reason suggestion:", error);
    } finally {
      setIsLoadingSuggestion(false);
    }
  };

  const handleSubmit = async () => {
    if (activeTab === "lost" && !selectedReason) {
      toast.error("Selecione um motivo para a perda");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditMode && existingSaleId) {
        // Update existing sale (manager only)
        const { error } = await supabase
          .from("sales")
          .update({
            status: activeTab,
            reason: activeTab === "lost" ? selectedReason : null,
          })
          .eq("id", existingSaleId);

        if (error) throw error;

        toast.success("Status atualizado com sucesso!");
      } else {
        // Create new sale
        const { data, error } = await supabase.functions.invoke("register-sale", {
          body: {
            seller_id: sellerId,
            customer_id: customerId,
            status: activeTab,
            reason: activeTab === "lost" ? selectedReason : null,
            description: activeTab === "lost" ? description : null,
          },
        });

        if (error) throw error;

        toast.success(
          activeTab === "won" 
            ? "🎉 Venda registrada com sucesso!" 
            : "Perda registrada com sucesso"
        );
      }
      
      onOpenChange(false);
      onSuccess?.(activeTab, activeTab === "lost" ? selectedReason : undefined, activeTab === "won" ? description : undefined);
    } catch (error) {
      console.error("Error registering sale:", error);
      toast.error(isEditMode ? "Erro ao atualizar status" : "Erro ao registrar venda");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditMode ? "Editar Status" : "Registrar Resultado"}
            <Badge variant="outline">{customerName}</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "won" | "lost")}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="won" className="gap-2">
              <Trophy className="h-4 w-4" />
              Venda Fechada
            </TabsTrigger>
            <TabsTrigger value="lost" className="gap-2">
              <XCircle className="h-4 w-4" />
              Venda Perdida
            </TabsTrigger>
          </TabsList>

          {/* Won Tab */}
          <TabsContent value="won" className="space-y-4 mt-4">
            <Card className="border-success/30 bg-success/5">
              <CardContent className="pt-6">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center">
                    <Trophy className="h-8 w-8 text-success" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Parabéns pela venda!</h3>
                    <p className="text-sm text-muted-foreground">
                      Registre a venda para atualizar suas métricas
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full bg-success hover:bg-success/90"
              size="lg"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Confirmar Venda
            </Button>
          </TabsContent>

          {/* Lost Tab */}
          <TabsContent value="lost" className="space-y-4 mt-4">
            {/* AI Suggestion */}
            {isLoadingSuggestion ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center gap-3">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    <span className="text-sm">Analisando conversa...</span>
                  </div>
                </CardContent>
              </Card>
            ) : aiSuggestion ? (
              <Card className="border-primary/30 bg-primary/5">
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">
                        Sugestão da IA: {reasonLabels[aiSuggestion.suggested_reason] || aiSuggestion.suggested_reason}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {aiSuggestion.explanation}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : null}

            {/* Loss Reasons */}
            <div className="space-y-3">
              <Label>Motivo da perda</Label>
              <RadioGroup
                value={selectedReason}
                onValueChange={setSelectedReason}
                className="grid grid-cols-1 gap-2"
              >
                {lossReasons.map((reason) => {
                  const Icon = reason.icon;
                  const isSelected = selectedReason === reason.value;
                  const isSuggested = aiSuggestion?.suggested_reason === reason.value;

                  return (
                    <div key={reason.value}>
                      <RadioGroupItem
                        value={reason.value}
                        id={reason.value}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={reason.value}
                        className={cn(
                          "flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-all",
                          "hover:bg-muted/50",
                          isSelected && "border-primary bg-primary/5",
                          isSuggested && !isSelected && "border-primary/50"
                        )}
                      >
                        <Icon className={cn(
                          "h-5 w-5",
                          isSelected ? "text-primary" : "text-muted-foreground"
                        )} />
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{reason.label}</span>
                            {isSuggested && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                Sugerido pela IA
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">{reason.description}</p>
                        </div>
                      </Label>
                    </div>
                  );
                })}
              </RadioGroup>
            </div>

            {/* Custom Description */}
            <div className="space-y-2">
              <Label htmlFor="description">Descrição adicional (opcional)</Label>
              <Textarea
                id="description"
                placeholder="Descreva mais detalhes sobre a perda..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !selectedReason}
              className="w-full"
              variant="destructive"
              size="lg"
            >
              {isSubmitting ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Registrar Perda
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SaleRegistrationModal;
