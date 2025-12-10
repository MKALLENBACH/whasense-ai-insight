import { ReactNode, useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import AppSidebar from "./AppSidebar";
import { FreeTrialExpiringModal } from "@/components/plan/FreeTrialExpiringModal";
import { differenceInDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";

const FREE_PLAN_ID = "8af5c9e1-02a3-4705-b312-6f33bcc0d965";

interface AppLayoutProps {
  children: ReactNode;
}

const AppLayout = ({ children }: AppLayoutProps) => {
  const { isAuthenticated, isManager, companyPlan } = useAuth();
  const [showExpiringModal, setShowExpiringModal] = useState(false);

  useEffect(() => {
    // Show modal only for managers on FREE plan with 1 day or less remaining
    if (isManager && companyPlan?.planId === FREE_PLAN_ID && companyPlan?.freeEndDate) {
      const freeEndDate = new Date(companyPlan.freeEndDate);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const daysRemaining = differenceInDays(freeEndDate, today);
      
      // Check if modal was already dismissed today
      const dismissedKey = `free_trial_modal_dismissed_${today.toISOString().split('T')[0]}`;
      const wasDismissedToday = sessionStorage.getItem(dismissedKey);
      
      if (daysRemaining <= 1 && !wasDismissedToday) {
        setShowExpiringModal(true);
      }
    }
  }, [isManager, companyPlan]);

  const handleCloseExpiringModal = () => {
    // Mark as dismissed for this session
    const today = new Date().toISOString().split('T')[0];
    sessionStorage.setItem(`free_trial_modal_dismissed_${today}`, 'true');
    setShowExpiringModal(false);
  };

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Calculate days remaining for modal
  const freeEndDate = companyPlan?.freeEndDate ? new Date(companyPlan.freeEndDate) : null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daysRemaining = freeEndDate ? Math.max(0, differenceInDays(freeEndDate, today)) : 0;
  const formattedEndDate = freeEndDate ? format(freeEndDate, "dd/MM/yyyy", { locale: ptBR }) : "";

  return (
    <div className="min-h-screen bg-background">
      <AppSidebar />
      <main className="pl-64">
        <div className="p-6">{children}</div>
      </main>
      
      <FreeTrialExpiringModal
        open={showExpiringModal}
        onClose={handleCloseExpiringModal}
        daysRemaining={daysRemaining}
        endDate={formattedEndDate}
      />
    </div>
  );
};

export default AppLayout;
