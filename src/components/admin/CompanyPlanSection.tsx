import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { CreditCard, Users, Infinity, Loader2, Save, Calendar, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { format, addDays } from "date-fns";

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

const FREE_PLAN_ID = "8af5c9e1-02a3-4705-b312-6f33bcc0d965";

const CompanyPlanSection = ({
  companyId,
  currentPlanId,
  onPlanUpdated,
}: CompanyPlanSectionProps) => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>(currentPlanId || "");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [freeStartDate, setFreeStartDate] = useState<string>("");
  const [freeEndDate, setFreeEndDate] = useState<string>("");
  const [currentFreeStartDate, setCurrentFreeStartDate] = useState<string | null>(null);
  const [currentFreeEndDate, setCurrentFreeEndDate] = useState<string | null>(null);

  useEffect(() => {
    fetchPlans();
    fetchCompanyTrialDates();
  }, [companyId]);

  useEffect(() => {
    setSelectedPlanId(currentPlanId || "");
  }, [currentPlanId]);

  // When Free plan is selected, set default dates
  useEffect(() => {
    if (selectedPlanId === FREE_PLAN_ID && !freeStartDate && !currentFreeStartDate) {
      const today = format(new Date(), "yyyy-MM-dd");
      const endDate = format(addDays(new Date(), 7), "yyyy-MM-dd");
      setFreeStartDate(today);
      setFreeEndDate(endDate);
    }
  }, [selectedPlanId, freeStartDate, currentFreeStartDate]);

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

  const fetchCompanyTrialDates = async () => {
    try {
      const { data, error } = await supabase
        .from("companies")
        .select("free_start_date, free_end_date")
        .eq("id", companyId)
        .single();

      if (error) throw error;
      
      if (data?.free_start_date) {
        setCurrentFreeStartDate(data.free_start_date);
        setFreeStartDate(data.free_start_date);
      }
      if (data?.free_end_date) {
        setCurrentFreeEndDate(data.free_end_date);
        setFreeEndDate(data.free_end_date);
      }
    } catch (error) {
      console.error("Error fetching company trial dates:", error);
    }
  };

  const handleSave = async () => {
    const isFreePlan = selectedPlanId === FREE_PLAN_ID;
    
    // Validate free plan dates
    if (isFreePlan) {
      if (!freeStartDate || !freeEndDate) {
        toast.error("Datas de início e fim do trial são obrigatórias para o plano Free");
        return;
      }
      if (new Date(freeEndDate) <= new Date(freeStartDate)) {
        toast.error("Data de fim deve ser posterior à data de início");
        return;
      }
    }

    setIsSaving(true);
    try {
      const updateData: Record<string, unknown> = { 
        plan_id: selectedPlanId || null 
      };
      
      if (isFreePlan) {
        updateData.free_start_date = freeStartDate;
        updateData.free_end_date = freeEndDate;
      }

      const { error } = await supabase
        .from("companies")
        .update(updateData)
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
  const isFreePlan = selectedPlanId === FREE_PLAN_ID;
  const isTrialExpired = currentFreeEndDate && new Date(currentFreeEndDate) < new Date();

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
                      - {plan.monthly_price === 0 ? "Grátis" : `${formatCurrency(plan.monthly_price)}/mês`}
                    </span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Free Plan Date Fields */}
        {isFreePlan && (
          <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4 space-y-4">
            <div className="flex items-center gap-2 text-cyan-400">
              <Calendar className="h-4 w-4" />
              <span className="font-medium">Período de Trial</span>
            </div>
            
            {isTrialExpired && currentPlanId === FREE_PLAN_ID && (
              <div className="flex items-center gap-2 text-amber-400 bg-amber-500/10 p-3 rounded">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-sm">Trial expirado! A empresa será convertida para "Sem Plano".</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Data de Início *</Label>
                <Input
                  type="date"
                  value={freeStartDate}
                  onChange={(e) => setFreeStartDate(e.target.value)}
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-slate-300">Data de Fim *</Label>
                <Input
                  type="date"
                  value={freeEndDate}
                  onChange={(e) => setFreeEndDate(e.target.value)}
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Após a data de fim, o plano será automaticamente convertido para "Sem Plano".
            </p>
          </div>
        )}

        {selectedPlan && (
          <div className="bg-slate-900/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Plano</span>
              <span className="text-white font-medium">{selectedPlan.name}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">Preço Mensal</span>
              <span className="text-white font-medium">
                {selectedPlan.monthly_price === 0 ? "Grátis" : formatCurrency(selectedPlan.monthly_price)}
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
          disabled={isSaving || (selectedPlanId === currentPlanId && !isFreePlan)}
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