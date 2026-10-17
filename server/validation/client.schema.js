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
    /* Which ways of making posters this organization may use. */
    designModes: z
      .object({
        ai: z.boolean().optional(),
        templates: z.boolean().optional(),
      })
      .optional(),
    designPalette: z.enum(['strict', 'balanced', 'expressive']).optional(),
    requireMfaForAdmins: z.boolean().optional(),
    sessionLength: z.enum(['8h', '7d', '30d']).optional(),
    allowedEmailDomains: z.union([z.array(z.string()), z.string()]).optional(),
    minPasswordLength: z.number().int().min(10).max(16).optional(),
    requireApprovalForPosters: z.boolean().optional(),
    requireEmailVerification: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change')
  .refine(
    (value) => !(value.designModes?.ai === false && value.designModes?.templates === false),
    'Keep at least one way of making posters switched on'
  );
