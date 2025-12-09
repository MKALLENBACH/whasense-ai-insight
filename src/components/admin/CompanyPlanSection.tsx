import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Users, Infinity, Loader2, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  seller_limit: number | null;
}

interface CompanyPlanSectionProps {
  companyId: string;
  currentPlanId: string | null;
  onPlanUpdated: () => void;
}

const CompanyPlanSection = ({
  companyId,
  currentPlanId,
  onPlanUpdated,
}: CompanyPlanSectionProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId || "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchPlans();
  }, []);

  useEffect(() => {
    setSelectedPlanId(currentPlanId || "");
  }, [currentPlanId]);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("id, name, description, monthly_price, seller_limit")
        .eq("is_active", true)
        .order("monthly_price", { ascending: true });

      if (error) throw error;
      setPlans(data || []);
    } catch (error) {
      console.error("Error fetching plans:", error);
      toast.error("Erro ao carregar planos");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ plan_id: selectedPlanId || null })
        .eq("id", companyId);

      if (error) throw error;

      toast.success("Plano atualizado com sucesso!");
      onPlanUpdated();
    } catch (error) {
      console.error("Error updating plan:", error);
      toast.error("Erro ao atualizar plano");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800 border-slate-700">
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-800 border-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-white">
          <CreditCard className="h-5 w-5 text-orange-500" />
          Plano da Empresa
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label className="text-slate-300">Selecionar Plano</Label>
          <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
            <SelectTrigger className="bg-slate-900/50 border-slate-700 text-white">
              <SelectValue placeholder="Selecione um plano" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-700">
              {plans.map((plan) => (
                <SelectItem
                  key={plan.id}
                  value={plan.id}
                  className="text-white hover:bg-slate-700"
                >
                  <div className="flex items-center gap-2">
                    <span>{plan.name}</span>
                    <span className="text-slate-400 text-sm">
                      - {formatCurrency(plan.monthly_price)}/mês
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedPlan && (
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Plano</span>
              <span className="text-white font-medium">{selectedPlan.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Preço Mensal</span>
              <span className="text-white font-medium">
                {formatCurrency(selectedPlan.monthly_price)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Limite de Vendedores</span>
              {selectedPlan.seller_limit === null ? (
                <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                  <Infinity className="h-3 w-3 mr-1" />
                  Ilimitado
                </Badge>
              ) : (
                <div className="flex items-center gap-1">
                  <Users className="h-4 w-4 text-slate-500" />
                  <span className="text-white">{selectedPlan.seller_limit}</span>
                </div>
              )}
            </div>
            {selectedPlan.description && (
              <div className="pt-2 border-t border-slate-700">
                <p className="text-sm text-slate-400">{selectedPlan.description}</p>
              </div>
            )}
          </div>
        )}

        <Button
          onClick={handleSave}
          disabled={isSaving || selectedPlanId === currentPlanId}
          className="w-full bg-orange-500 hover:bg-orange-600"
        >
          {isSaving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Salvar Plano
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default CompanyPlanSection;
