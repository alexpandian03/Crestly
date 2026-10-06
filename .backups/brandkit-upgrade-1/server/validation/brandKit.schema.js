import { z } from 'zod';

export const updateBrandKitSchema = z.object({
  orgName: z.string().trim().min(1, 'Organization name cannot be empty').max(100).optional(),
  logos: z
    .array(
      z.object({
        url: z.string().url('Logo must be a valid URL'),
        label: z.string().optional().default('Primary Logo'),
        isPrimary: z.boolean().optional().default(false),
      })
    )
    .optional(),
  colors: z
    .object({
      primary: z.string().optional(),
      secondary: z.string().optional(),
      accent: z.string().optional(),
      text: z.string().optional(),
      background: z.string().optional(),
    })
    .optional(),
  fonts: z
    .object({
      heading: z.string().optional(),
      body: z.string().optional(),
    })
    .optional(),
  header: z
    .object({
      height: z.number().min(30).max(200).optional(),
      background: z.string().optional(),
      alignment: z.enum(['left', 'center', 'right']).optional(),
      showLogo: z.boolean().optional(),
      showOrgName: z.boolean().optional(),
    })
    .optional(),
  footer: z
    .object({
      height: z.number().min(30).max(200).optional(),
      background: z.string().optional(),
      contactText: z.string().optional(),
      website: z.string().optional(),
      socials: z.array(z.string()).optional(),
      legalText: z.string().optional(),
    })
    .optional(),
  defaultPosterSize: z
    .object({
      width: z.number().min(200).max(4000).optional(),
      height: z.number().min(200).max(4000).optional(),
    })
    .optional(),
});
