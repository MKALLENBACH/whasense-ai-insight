import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Loader2, UserCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Seller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  is_active: boolean;
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
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isReassigning, setIsReassigning] = useState<string | null>(null);

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

        setSellers(profiles || []);
      } catch (error) {
        console.error("Error fetching sellers:", error);
        toast.error("Erro ao carregar vendedores");
      } finally {
        setIsLoading(false);
      }
    };

    fetchSellers();
  }, [open, companyId]);

  const handleReassign = async (sellerId: string, sellerUserId: string) => {
    setIsReassigning(sellerId);
    try {
      const { error } = await supabase
        .from("customers")
        .update({ 
          assigned_to: sellerUserId,
          seller_id: sellerUserId 
        })
        .eq("id", customerId);

      if (error) throw error;

      // Update sale_cycles as well
      await supabase
        .from("sale_cycles")
        .update({ seller_id: sellerUserId })
        .eq("customer_id", customerId)
        .in("status", ["pending", "in_progress"]);

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
                      <p className="font-medium text-sm">{seller.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {seller.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleReassign(seller.id, seller.user_id)}
                    disabled={isReassigning !== null}
                  >
                    {isReassigning === seller.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
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
  );
};

export default ReassignLeadModal;
