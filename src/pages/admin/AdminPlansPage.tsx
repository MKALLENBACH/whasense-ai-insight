import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  CreditCard,
  Plus,
  Edit,
  Loader2,
  Users,
  Infinity,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  description: string | null;
  monthly_price: number;
  annual_price: number;
  seller_limit: number | null;
  is_active: boolean;
  visible_to_managers: boolean;
  created_at: string;
  stripe_monthly_price_id: string | null;
  stripe_annual_price_id: string | null;
}

const AdminPlansPage = () => {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState("");
  const [annualPrice, setAnnualPrice] = useState("");
  const [sellerLimit, setSellerLimit] = useState("");
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [visibleToManagers, setVisibleToManagers] = useState(true);
  const [stripeMonthlyPriceId, setStripeMonthlyPriceId] = useState("");
  const [stripeAnnualPriceId, setStripeAnnualPriceId] = useState("");

  useEffect(() => {
    fetchPlans();
  }, []);

  const fetchPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("plans")
        .select("*")
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

  const resetForm = () => {
    setName("");
    setDescription("");
    setMonthlyPrice("");
    setAnnualPrice("");
    setSellerLimit("");
    setIsUnlimited(false);
    setIsActive(true);
    setVisibleToManagers(true);
    setStripeMonthlyPriceId("");
    setStripeAnnualPriceId("");
    setEditingPlan(null);
  };

  const openCreateModal = () => {
    resetForm();
    setIsModalOpen(true);
  };

  const openEditModal = (plan: Plan) => {
    setEditingPlan(plan);
    setName(plan.name);
    setDescription(plan.description || "");
    setMonthlyPrice(plan.monthly_price.toString());
    setAnnualPrice(plan.annual_price.toString());
    setIsUnlimited(plan.seller_limit === null);
    setSellerLimit(plan.seller_limit?.toString() || "");
    setIsActive(plan.is_active);
    setVisibleToManagers(plan.visible_to_managers);
    setStripeMonthlyPriceId(plan.stripe_monthly_price_id || "");
    setStripeAnnualPriceId(plan.stripe_annual_price_id || "");
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast.error("Nome do plano é obrigatório");
      return;
    }

    setIsSaving(true);

    try {
      const planData = {
        name: name.trim(),
        description: description.trim() || null,
        monthly_price: parseFloat(monthlyPrice) || 0,
        annual_price: parseFloat(annualPrice) || 0,
        seller_limit: isUnlimited ? null : (parseInt(sellerLimit) || 1),
        is_active: isActive,
        visible_to_managers: visibleToManagers,
        stripe_monthly_price_id: stripeMonthlyPriceId.trim() || null,
        stripe_annual_price_id: stripeAnnualPriceId.trim() || null,
      };

      if (editingPlan) {
        const { error } = await supabase
          .from("plans")
          .update(planData)
          .eq("id", editingPlan.id);

        if (error) throw error;
        toast.success("Plano atualizado com sucesso!");
      } else {
        const { error } = await supabase
          .from("plans")
          .insert(planData);

        if (error) throw error;
        toast.success("Plano criado com sucesso!");
      }

      setIsModalOpen(false);
      resetForm();
      fetchPlans();
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Erro ao salvar plano");
    } finally {
      setIsSaving(false);
    }
  };

  const togglePlanStatus = async (plan: Plan) => {
    try {
      const { error } = await supabase
        .from("plans")
        .update({ is_active: !plan.is_active })
        .eq("id", plan.id);

      if (error) throw error;

      setPlans((prev) =>
        prev.map((p) =>
          p.id === plan.id ? { ...p, is_active: !p.is_active } : p
        )
      );

      toast.success(
        plan.is_active
          ? "Plano desativado com sucesso"
          : "Plano ativado com sucesso"
      );
    } catch (error) {
      console.error("Error toggling plan status:", error);
      toast.error("Erro ao alterar status do plano");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">Planos</h1>
            <p className="text-slate-400">
              Gerencie os planos disponíveis para as empresas
            </p>
          </div>

          <Button
            onClick={openCreateModal}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            <Plus className="h-4 w-4 mr-2" />
            Criar Plano
          </Button>
        </div>

        {/* Plans Table */}
        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
              </div>
            ) : plans.length === 0 ? (
              <div className="text-center py-12">
                <CreditCard className="h-12 w-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">Nenhum plano cadastrado</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700 hover:bg-transparent">
                    <TableHead className="text-slate-400">Plano</TableHead>
                    <TableHead className="text-slate-400">Preço Mensal</TableHead>
                    <TableHead className="text-slate-400">Preço Anual</TableHead>
                    <TableHead className="text-slate-400 text-center">Limite Vendedores</TableHead>
                    <TableHead className="text-slate-400 text-center">Visível Gestor</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                    <TableHead className="text-slate-400 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {plans.map((plan) => (
                    <TableRow
                      key={plan.id}
                      className={`border-slate-700 ${!plan.is_active ? "opacity-60" : ""}`}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                              plan.is_active ? "bg-orange-500/10" : "bg-slate-700"
                            }`}
                          >
                            <CreditCard
                              className={`h-4 w-4 ${
                                plan.is_active ? "text-orange-500" : "text-slate-500"
                              }`}
                            />
                          </div>
                          <div>
                            <p className="font-medium text-white">{plan.name}</p>
                            {plan.description && (
                              <p className="text-sm text-slate-400 line-clamp-1">
                                {plan.description}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-white font-medium">
                        {formatCurrency(plan.monthly_price)}
                      </TableCell>
                      <TableCell className="text-slate-300">
                        {formatCurrency(plan.annual_price)}
                      </TableCell>
                      <TableCell className="text-center">
                        {plan.seller_limit === null ? (
                          <Badge className="bg-purple-500/20 text-purple-400 border-purple-500/30">
                            <Infinity className="h-3 w-3 mr-1" />
                            Ilimitado
                          </Badge>
                        ) : (
                          <div className="flex items-center justify-center gap-1">
                            <Users className="h-4 w-4 text-slate-500" />
                            <span className="text-white">{plan.seller_limit}</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge
                          className={
                            plan.visible_to_managers
                              ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
                              : "bg-slate-700 text-slate-400"
                          }
                        >
                          {plan.visible_to_managers ? "Sim" : "Não"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={plan.is_active}
                            onCheckedChange={() => togglePlanStatus(plan)}
                          />
                          <Badge
                            variant={plan.is_active ? "default" : "secondary"}
                            className={
                              plan.is_active
                                ? "bg-emerald-500/20 text-emerald-400"
                                : "bg-slate-700 text-slate-400"
                            }
                          >
                            {plan.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-slate-400 hover:text-white"
                          onClick={() => openEditModal(plan)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Create/Edit Modal */}
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="bg-slate-800 border-slate-700 text-white max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-orange-500" />
                {editingPlan ? "Editar Plano" : "Criar Plano"}
              </DialogTitle>
              <DialogDescription className="text-slate-400">
                {editingPlan
                  ? "Atualize as informações do plano"
                  : "Configure um novo plano para empresas"}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label className="text-slate-300">Nome do Plano *</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Pro, Premium, Enterprise"
                  className="bg-slate-900/50 border-slate-700 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-slate-300">Descrição</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Breve descrição do plano..."
                  className="bg-slate-900/50 border-slate-700 text-white"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-slate-300">Preço Mensal (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={monthlyPrice}
                    onChange={(e) => setMonthlyPrice(e.target.value)}
                    placeholder="0.00"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-slate-300">Preço Anual (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={annualPrice}
                    onChange={(e) => setAnnualPrice(e.target.value)}
                    placeholder="0.00"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-slate-300">Limite de Vendedores</Label>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="unlimited"
                    checked={isUnlimited}
                    onCheckedChange={(checked) => {
                      setIsUnlimited(checked === true);
                      if (checked) setSellerLimit("");
                    }}
                  />
                  <label
                    htmlFor="unlimited"
                    className="text-sm text-slate-300 cursor-pointer"
                  >
                    Ilimitado (Premium)
                  </label>
                </div>

                {!isUnlimited && (
                  <Input
                    type="number"
                    min="1"
                    value={sellerLimit}
                    onChange={(e) => setSellerLimit(e.target.value)}
                    placeholder="Número máximo de vendedores"
                    className="bg-slate-900/50 border-slate-700 text-white"
                  />
                )}
              </div>

              {/* Stripe Price IDs */}
              <div className="space-y-3 pt-2 border-t border-slate-700">
                <Label className="text-slate-300 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Integração Stripe
                </Label>
                
                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Price ID Mensal</Label>
                  <Input
                    value={stripeMonthlyPriceId}
                    onChange={(e) => setStripeMonthlyPriceId(e.target.value)}
                    placeholder="price_xxxxx (do Stripe)"
                    className="bg-slate-900/50 border-slate-700 text-white font-mono text-sm"
                  />
                </div>

                <div className="space-y-2">
                  <Label className="text-xs text-slate-400">Price ID Anual</Label>
                  <Input
                    value={stripeAnnualPriceId}
                    onChange={(e) => setStripeAnnualPriceId(e.target.value)}
                    placeholder="price_xxxxx (do Stripe)"
                    className="bg-slate-900/50 border-slate-700 text-white font-mono text-sm"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <Label className="text-slate-300">Plano Ativo</Label>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-slate-300">Visível para Gestores</Label>
                  <p className="text-xs text-slate-500">Mostrar como opção de plano no frontend</p>
                </div>
                <Switch
                  checked={visibleToManagers}
                  onCheckedChange={setVisibleToManagers}
                />
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsModalOpen(false)}
                  className="text-slate-400 hover:text-white"
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving || !name.trim()}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : editingPlan ? (
                    "Salvar Alterações"
                  ) : (
                    "Criar Plano"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </AdminLayout>
  );
};

export default AdminPlansPage;
