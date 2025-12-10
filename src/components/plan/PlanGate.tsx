import { ReactNode, useState } from "react";
import { usePlanPermissions, PlanPermissions } from "@/hooks/usePlanPermissions";
import { PlanFeatures } from "@/contexts/AuthContext";
import { FeatureBlockedModal } from "./FeatureBlockedModal";

interface PlanGateProps {
  children: ReactNode;
  feature: keyof PlanFeatures;
  featureName: string;
  requiredPlan?: string;
  fallback?: ReactNode;
}

// Map features to required plans
const FEATURE_REQUIRED_PLAN: Record<keyof PlanFeatures, string> = {
  canAccess360: "Enterprise",
  canUseGamification: "Pro",
  canUseFollowups: "Premium",
  canAccessFullDashboard: "Starter",
};

export function PlanGate({ 
  children, 
  feature, 
  featureName,
  requiredPlan,
  fallback 
}: PlanGateProps) {
  const permissions = usePlanPermissions();
  const [showModal, setShowModal] = useState(false);

  const hasAccess = permissions[feature] || permissions.hasFullAccess;

  if (hasAccess) {
    return <>{children}</>;
  }

  // If fallback provided, show it
  if (fallback) {
    return <>{fallback}</>;
  }

  // Default behavior: show modal on click
  return (
    <>
      <div 
        onClick={() => setShowModal(true)} 
        className="cursor-pointer"
      >
        {children}
      </div>
      <FeatureBlockedModal
        open={showModal}
        onOpenChange={setShowModal}
        featureName={featureName}
        requiredPlan={requiredPlan || FEATURE_REQUIRED_PLAN[feature]}
      />
    </>
  );
}

// Hook to check access and get a function to show modal
export function useFeatureGate(feature: keyof PlanFeatures) {
  const permissions = usePlanPermissions();
  const hasAccess = permissions[feature] || permissions.hasFullAccess;
  
  return {
    hasAccess,
    requiredPlan: FEATURE_REQUIRED_PLAN[feature],
  };
}
