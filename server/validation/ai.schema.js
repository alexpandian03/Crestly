import { z } from 'zod';

export const generatePosterSchema = z.object({
  description: z
    .string()
    .trim()
    .min(5, 'Please provide at least a few words describing your event or announcement')
    .max(2000, 'Description cannot exceed 2000 characters'),
  templateId: z.string().optional(),
  tone: z.enum(['professional', 'energetic', 'formal', 'minimal', 'creative']).optional().default('professional'),
});
