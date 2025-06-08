import { Feature } from './feature'

export interface User {
  id: string
  telegramId: string
  name: string
  username?: string
  password?: boolean // Backend returns true/false to indicate if password is set
  role: 'USER' | 'ADMIN'
  isActive: boolean
  createdAt: string
  updatedAt: string
  featureAccess: UserFeatureAccess[]
}

export interface UserFeatureAccess {
  id: string
  userId: string
  featureId: string
  grantedAt: string
  feature: Feature
}

export interface CreateUserData {
  telegramId: string
  name: string
  username?: string
  password?: string
  role?: 'USER' | 'ADMIN'
}

export interface UpdateUserData {
  name?: string
  username?: string
  password?: string
  role?: 'USER' | 'ADMIN'
  isActive?: boolean
} 