import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Seller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
}

interface SellerWithLeadCount extends Seller {
  activeLeads: number;
  maxLeads: number | null;
  isAtLimit: boolean;
}

interface ReassignLeadModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId: string;
  currentAssignedTo: string | null;
  companyId: string;
  onSuccess: () => void;
}

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const ReassignLeadModal = ({
  open,
  onOpenChange,
  customerId,
  currentAssignedTo,
  companyId,
  onSuccess,
}: ReassignLeadModalProps) => {
  const [sellers, setSellers] = useState<SellerWithLeadCount[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReassigning, setIsReassigning] = useState<string | null>(null);
  const [confirmSeller, setConfirmSeller] = useState<SellerWithLeadCount | null>(null);

  useEffect(() => {
    const fetchSellers = async () => {
      if (!open || !companyId) return;
      
      setIsLoading(true);
      try {
        // Get seller user_ids
        const { data: sellerRoles } = await supabase
          .from("user_roles")
          .select("user_id")
          .eq("role", "seller");

        if (!sellerRoles || sellerRoles.length === 0) {
          setSellers([]);
          return;
        }

        const sellerUserIds = sellerRoles.map((r) => r.user_id);

        // Get active sellers in company
        const { data: profiles, error } = await supabase
          .from("profiles")
          .select("id, user_id, name, email, is_active")
          .eq("company_id", companyId)
          .eq("is_active", true)
          .in("user_id", sellerUserIds);

        if (error) throw error;

        // Get company operation settings for max leads
        const { data: settings } = await supabase
          .from("manager_operation_settings")
          .select("max_active_leads_per_seller")
          .eq("company_id", companyId)
          .maybeSingle();

        const maxLeads = settings?.max_active_leads_per_seller || 0; // 0 = unlimited

        // Get active lead counts for each seller
        const sellersWithCounts: SellerWithLeadCount[] = await Promise.all(
          (profiles || []).map(async (seller) => {
            const { count } = await supabase
              .from("sale_cycles")
              .select("*", { count: "exact", head: true })
              .eq("seller_id", seller.user_id)
              .in("status", ["pending", "in_progress"]);

            const activeLeads = count || 0;
            const isAtLimit = maxLeads > 0 && activeLeads >= maxLeads;

            return {
              ...seller,
              activeLeads,
              maxLeads: maxLeads > 0 ? maxLeads : null,
              isAtLimit,
            };
          })
        );

        setSellers(sellersWithCounts);
      } catch (error) {
        console.error("Error fetching sellers:", error);
        toast.error("Erro ao carregar vendedores");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellers();
  }, [open, companyId]);

  const handleReassignClick = (seller: SellerWithLeadCount) => {
    if (seller.isAtLimit) {
      // Show confirmation modal
      setConfirmSeller(seller);
    } else {
      // Proceed directly
      executeReassign(seller.id, seller.user_id);
    }
  };

  const executeReassign = async (sellerId: string, sellerUserId: string) => {
    setIsReassigning(sellerId);
    setConfirmSeller(null);
    try {
      // 1. Close current active cycle with "relocated" status
      const { data: activeCycles } = await supabase
        .from("sale_cycles")
        .select("id")
        .eq("customer_id", customerId)
        .in("status", ["pending", "in_progress"]);

      if (activeCycles && activeCycles.length > 0) {
        for (const cycle of activeCycles) {
          await supabase
            .from("sale_cycles")
            .update({ 
              status: "relocated" as any,
              closed_at: new Date().toISOString()
            })
            .eq("id", cycle.id);
        }
      }

      // 2. Update customer assignment
      const { error } = await supabase
        .from("customers")
        .update({ 
          assigned_to: sellerUserId,
          seller_id: sellerUserId,
          lead_status: "pending"
        })
        .eq("id", customerId);

      if (error) throw error;

      // 3. Create new cycle for the new seller
      await supabase
        .from("sale_cycles")
        .insert({
          customer_id: customerId,
          seller_id: sellerUserId,
          status: "pending",
          cycle_type: "pre_sale"
        });

      toast.success("Lead realocado com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (error) {
      console.error("Error reassigning lead:", error);
      toast.error("Erro ao realocar lead");
    } finally {
      setIsReassigning(null);
    }
  };

  const availableSellers = sellers.filter(
    (s) => s.user_id !== currentAssignedTo
  );

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Realocar Lead</DialogTitle>
            <DialogDescription>
              Selecione o vendedor que receberá este lead
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : availableSellers.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Nenhum vendedor disponível para realocação</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[300px]">
              <div className="space-y-2">
                {availableSellers.map((seller) => (
                  <div
                    key={seller.id}
                    className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/10 text-primary text-sm">
                          {getInitials(seller.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm">{seller.name}</p>
                          {seller.isAtLimit && (
                            <Badge variant="destructive" className="text-xs px-1.5 py-0">
                              Limite
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <p className="text-xs text-muted-foreground">
                            {seller.email}
                          </p>
                          {seller.maxLeads !== null && (
                            <span className={`text-xs ${seller.isAtLimit ? 'text-destructive' : 'text-muted-foreground'}`}>
                              ({seller.activeLeads}/{seller.maxLeads} leads)
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant={seller.isAtLimit ? "outline" : "default"}
                      onClick={() => handleReassignClick(seller)}
                      disabled={isReassigning !== null}
                    >
                      {isReassigning === seller.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : seller.isAtLimit ? (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog for sellers at limit */}
      <AlertDialog open={confirmSeller !== null} onOpenChange={(open) => !open && setConfirmSeller(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Limite de Leads Atingido
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                O vendedor <strong>{confirmSeller?.name}</strong> está com o limite de leads atingido 
                ({confirmSeller?.activeLeads}/{confirmSeller?.maxLeads}).
              </p>
              <p>
                Deseja realocar o lead mesmo assim?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Não</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => confirmSeller && executeReassign(confirmSeller.id, confirmSeller.user_id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sim, realocar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ReassignLeadModal;
