import { z } from 'zod';

export const clientParamsSchema = z.object({
  id: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid client ID'),
});

export const createClientSchema = z.object({
  name: z.string().trim().min(2, 'Client name must be at least 2 characters').max(120),
  plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional().default('starter'),
});

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(2).max(120).optional(),
    plan: z.enum(['free', 'starter', 'pro', 'enterprise']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change');
