import { z } from 'zod';
import { CONTENT_LIMITS } from '../services/poster/content.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

export const generatePosterRequestSchema = z.object({
  templateId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid template ID format')
    .optional(),
  prompt: z
    .string()
    .trim()
    .min(5, 'Description must be at least 5 characters long')
    .max(1000, 'Description cannot exceed 1000 characters'),
  instruction: z
    .enum(['shorter', 'minimal', 'more professional', 'emphasize date', 'change image'])
    .optional(),
});

const contentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(CONTENT_LIMITS.title, `Title cannot exceed ${CONTENT_LIMITS.title} characters`),
  tagline: z.string().trim().max(CONTENT_LIMITS.tagline, `Tagline cannot exceed ${CONTENT_LIMITS.tagline} characters`).optional(),
  date: z.string().trim().max(CONTENT_LIMITS.date, `Date cannot exceed ${CONTENT_LIMITS.date} characters`).optional(),
  time: z.string().trim().max(CONTENT_LIMITS.time, `Time cannot exceed ${CONTENT_LIMITS.time} characters`).optional(),
  venue: z.string().trim().max(CONTENT_LIMITS.venue, `Venue cannot exceed ${CONTENT_LIMITS.venue} characters`).optional(),
  details: z
    .array(z.string().trim().max(CONTENT_LIMITS.detail, `Each extra line cannot exceed ${CONTENT_LIMITS.detail} characters`))
    .max(CONTENT_LIMITS.maxDetails, `A poster can have at most ${CONTENT_LIMITS.maxDetails} extra lines`)
    .optional(),
  imageUrl: z.string().trim().max(500, 'Image address is too long').optional(),
});

const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Please use a real date');

export const createPosterSchema = z.object({
  templateId: objectId,
  prompt: z
    .string()
    .trim()
    .min(5, 'Description must be at least 5 characters long')
    .max(1000, 'Description cannot exceed 1000 characters'),
  content: contentSchema,
});

export const posterListQuerySchema = z.object({
  clientId: objectId.optional(),
  q: z.string().trim().max(120, 'Search text is too long').optional(),
  category: z.string().trim().max(40).optional(),
  status: z.enum(['draft', 'pending', 'approved']).optional(),
  from: dateString.optional(),
  to: dateString.optional(),
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(24, 'Show at most 24 posters per page').optional(),
});

export const posterIdParamsSchema = z.object({ id: objectId });

const versionNumber = z.coerce.number().int().min(1, 'Invalid version number').optional();

export const updatePosterSchema = z.object({
  content: contentSchema,
  note: z.string().trim().max(120, 'Note is too long').optional(),
  expectedVersion: z.coerce.number().int().min(1, 'Invalid version number'),
});

export const regeneratePosterSchema = z.object({
  content: contentSchema,
  instruction: z
    .enum(['shorter', 'minimal', 'more professional', 'emphasize date', 'change image'])
    .optional(),
  expectedVersion: versionNumber,
});

export const restorePosterSchema = z.object({
  versionNumber: z.coerce.number().int().min(1, 'Invalid version number'),
  expectedVersion: versionNumber,
});
