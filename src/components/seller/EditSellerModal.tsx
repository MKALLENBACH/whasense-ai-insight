import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/supabaseApi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Pencil, Mail } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

interface Seller {
  id: string;
  user_id: string;
  name: string;
  email: string;
  created_at: string;
  is_active: boolean;
}

interface EditSellerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seller: Seller;
  onSuccess: () => void;
}

const editSellerSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: z.string().email("Email inválido").max(255),
});

const EditSellerModal = ({ open, onOpenChange, seller, onSuccess }: EditSellerModalProps) => {
  const [name, setName] = useState(seller.name);
  const [email, setEmail] = useState(seller.email);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (open) {
      setName(seller.name);
      setEmail(seller.email);
      setErrors({});
    }
  }, [open, seller]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const result = editSellerSchema.safeParse({ name, email });

    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    try {
      // Update profile
      const { error: profileError } = await supabase
        .from("profiles")
        .update({ name, email })
        .eq("id", seller.id);

      if (profileError) throw profileError;

      // If email changed, update auth user email via edge function
      if (email !== seller.email) {
        const { data, error: updateError } = await invokeFunction<{ error?: string }>("update-seller-email", {
          body: { userId: seller.user_id, newEmail: email },
        });

        if (updateError || data?.error) {
          throw new Error(data?.error || updateError?.message || "Erro ao atualizar e-mail");
        }
      }

      toast.success("Vendedor atualizado com sucesso!");
      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error("Error updating seller:", error);
      toast.error(error?.message || "Erro ao atualizar vendedor");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    setIsResending(true);
    try {
      const { data, error } = await invokeFunction<{ error?: string }>("resend-seller-welcome", {
        body: { userId: seller.user_id },
      });

      if (error || data?.error) {
        throw new Error(data?.error || error?.message || "Erro ao reenviar e-mail");
      }

      toast.success("E-mail de boas-vindas reenviado com nova senha temporária!");
    } catch (error: any) {
      console.error("Error resending email:", error);
      toast.error(error?.message || "Erro ao reenviar e-mail");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Pencil className="h-5 w-5" />
            Editar Vendedor
          </DialogTitle>
          <DialogDescription>
            Atualize as informações do vendedor.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nome</Label>
            <Input
              id="edit-name"
              placeholder="Nome do vendedor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-email">Email</Label>
            <Input
              id="edit-email"
              type="email"
              placeholder="email@exemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isSubmitting}
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
          </div>

          <div className="pt-2 border-t">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleResendEmail}
              disabled={isResending || isSubmitting}
            >
              {isResending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Reenviando...
                </>
              ) : (
                <>
                  <Mail className="mr-2 h-4 w-4" />
                  Reenviar e-mail com nova senha
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-1 text-center">
              Uma nova senha temporária será gerada e enviada
            </p>
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditSellerModal;
