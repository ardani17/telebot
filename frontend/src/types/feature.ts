export interface Feature {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FeatureAccess {
  id: string;
  userId: string;
  featureId: string;
  grantedAt: string;
  user: {
    id: string;
    telegramId: string;
    name: string;
    username?: string;
  };
  feature: Feature;
}

export interface FeatureStats {
  totalFeatures: number;
  enabledFeatures: number;
  disabledFeatures: number;
  totalAssignments: number;
  mostUsedFeatures: Array<{
    featureName: string;
    userCount: number;
    usageCount: number;
  }>;
  featureUsageByDate: Array<{
    date: string;
    count: number;
    featureName: string;
  }>;
}

export interface UpdateFeatureData {
  isEnabled: boolean;
}

export interface FeatureAccessData {
  telegramId: string;
  featureName: string;
}
