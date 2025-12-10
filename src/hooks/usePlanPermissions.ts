import { useAuth, PlanFeatures, CompanyPlanInfo } from "@/contexts/AuthContext";

export interface PlanPermissions extends PlanFeatures {
  planName: string | null;
  sellerLimit: number | null;
  isInactive: boolean;
  isNoPlan: boolean;
  isTrialExpired: boolean;
  hasFullAccess: boolean;
}

// Plan seller limits
const SELLER_LIMITS: Record<string, number | null> = {
  'Free': null, // unlimited during trial
  'Starter': 2,
  'Pro': 5,
  'Premium': 10,
  'Enterprise': null, // unlimited
  'Inativo': 0,
};

// Default features for no plan / inactive
const DEFAULT_FEATURES: PlanFeatures = {
  canAccess360: false,
  canUseGamification: false,
  canUseFollowups: false,
  canAccessFullDashboard: false,
};

export function usePlanPermissions(): PlanPermissions {
  const { companyPlan, user } = useAuth();

  const planName = companyPlan?.planName || null;
  const isInactive = planName === 'Inativo';
  const isNoPlan = !planName || !companyPlan?.hasValidPlan;
  const isFree = planName === 'Free';
  
  // Check if trial expired is handled by AuthContext (hasValidPlan becomes false)
  const isTrialExpired = isFree && isNoPlan;
  
  // Get features from plan or use defaults
  const features: PlanFeatures = companyPlan?.features 
    ? companyPlan.features
    : DEFAULT_FEATURES;

  // Seller limit based on plan
  const sellerLimit = planName ? (SELLER_LIMITS[planName] ?? null) : 0;

  // Has full access (Enterprise, Free during trial, or Admin)
  const hasFullAccess = planName === 'Enterprise' || (isFree && !isTrialExpired) || user?.role === 'admin';

  // If inactive or no plan, override all features to false
  const effectiveFeatures: PlanFeatures = (isInactive || isNoPlan) 
    ? DEFAULT_FEATURES 
    : features;

  return {
    planName,
    sellerLimit,
    isInactive,
    isNoPlan,
    isTrialExpired,
    hasFullAccess,
    ...effectiveFeatures,
  };
}

// Helper to check if a specific feature is allowed
export function useFeatureAccess(feature: keyof PlanFeatures): boolean {
  const permissions = usePlanPermissions();
  return permissions[feature] || permissions.hasFullAccess;
}
