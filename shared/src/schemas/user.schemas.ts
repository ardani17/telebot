import { z } from 'zod';
import { UserRole } from '../types/user';

// User schemas
export const userSchema = z.object({
  id: z.string().uuid(),
  telegramId: z.string().min(1, 'Telegram ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long'),
  username: z.string().optional(),
  role: z.nativeEnum(UserRole),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createUserSchema = z.object({
  telegramId: z
    .string()
    .min(1, 'Telegram ID is required')
    .regex(/^\d+$/, 'Telegram ID must be numeric'),
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim(),
  username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  role: z.nativeEnum(UserRole).default(UserRole.USER),
  featureIds: z.array(z.string().uuid()).optional(),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name too long').trim().optional(),
  username: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores')
    .optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
  featureIds: z.array(z.string().uuid()).optional(),
});

export const userQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(10),
  sortBy: z.enum(['name', 'telegramId', 'role', 'createdAt', 'updatedAt']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.coerce.boolean().optional(),
});

// Feature schemas
export const featureSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1, 'Feature name is required'),
  description: z.string(),
  isEnabled: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

export const createFeatureSchema = z.object({
  name: z.string().min(1, 'Feature name is required').max(50, 'Feature name too long').trim(),
  description: z.string().min(1, 'Description is required').max(500, 'Description too long').trim(),
  isEnabled: z.boolean().default(true),
});

export const updateFeatureSchema = z.object({
  name: z
    .string()
    .min(1, 'Feature name is required')
    .max(50, 'Feature name too long')
    .trim()
    .optional(),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(500, 'Description too long')
    .trim()
    .optional(),
  isEnabled: z.boolean().optional(),
});

// User feature access schemas
export const userFeatureAccessSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  featureId: z.string().uuid(),
  grantedAt: z.date(),
  grantedBy: z.string().uuid(),
});

export const grantFeatureAccessSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  featureIds: z
    .array(z.string().uuid('Invalid feature ID'))
    .min(1, 'At least one feature must be selected'),
});

export const revokeFeatureAccessSchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  featureIds: z
    .array(z.string().uuid('Invalid feature ID'))
    .min(1, 'At least one feature must be selected'),
});

// Validation helpers
export const telegramIdSchema = z
  .string()
  .min(1, 'Telegram ID is required')
  .regex(/^\d+$/, 'Telegram ID must be numeric');

export const uuidSchema = z.string().uuid('Invalid UUID format');

// Type exports for use in other modules
export type UserInput = z.infer<typeof userSchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserQueryInput = z.infer<typeof userQuerySchema>;
export type FeatureInput = z.infer<typeof featureSchema>;
export type CreateFeatureInput = z.infer<typeof createFeatureSchema>;
export type UpdateFeatureInput = z.infer<typeof updateFeatureSchema>;
export type GrantFeatureAccessInput = z.infer<typeof grantFeatureAccessSchema>;
export type RevokeFeatureAccessInput = z.infer<typeof revokeFeatureAccessSchema>;
