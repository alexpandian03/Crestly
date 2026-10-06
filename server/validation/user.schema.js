import { z } from 'zod';
import { passwordSchema } from './auth.schema.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const listUsersQuerySchema = z.object({
  clientId: objectId.optional(),
});

export const userParamsSchema = z.object({ id: objectId });

export const createUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Please enter a valid email address'),
  password: passwordSchema,
  role: z.enum(['superadmin', 'clientadmin', 'user']),
  clientId: objectId.optional(),
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    role: z.enum(['clientadmin', 'user']).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'Provide at least one change');
