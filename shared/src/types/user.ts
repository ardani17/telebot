export interface User {
  id: string;
  telegramId: string;
  name: string;
  username?: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  USER = 'USER'
}

export interface UserFeatureAccess {
  id: string;
  userId: string;
  featureId: string;
  grantedAt: Date;
  grantedBy: string;
}

export interface CreateUserRequest {
  telegramId: string;
  name: string;
  username?: string;
  role?: UserRole;
  featureIds?: string[];
}

export interface UpdateUserRequest {
  name?: string;
  username?: string;
  role?: UserRole;
  isActive?: boolean;
  featureIds?: string[];
}

export interface UserWithFeatures extends User {
  features: Feature[];
}

export interface Feature {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateFeatureRequest {
  name: string;
  description: string;
  isEnabled?: boolean;
}

export interface UpdateFeatureRequest {
  name?: string;
  description?: string;
  isEnabled?: boolean;
}
