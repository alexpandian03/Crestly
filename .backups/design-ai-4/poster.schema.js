import { z } from 'zod';
import { CONTENT_LIMITS } from '../services/poster/content.js';
import { VARIABLE_KEY_PATTERN, VARIABLE_LIMITS, ICON_NAMES } from '../../shared/templateElements.js';
import { RECIPE_VARIANTS, recipeIds } from '../../shared/designRecipes.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

/** Which of the four arrangements of a design, as a number or the text of one. */
const variantValue = z
  .coerce
  .number()
  .int('Choose one of the four arrangements of this design')
  .refine((value) => RECIPE_VARIANTS.includes(value), 'Choose one of the four arrangements of this design');

/** A design built from a recipe: its name, which arrangement, and which small mark. */
const recipeChoiceSchema = z.object({
  recipeId: z.enum(recipeIds(), 'Choose one of the designs this app offers'),
  variant: variantValue.optional(),
  icon: z.enum(ICON_NAMES, 'Choose one of the pictures this app can draw').optional(),
});

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
  /* "ai" writes a whole design from a recipe; nothing sent means the words-only path. */
  mode: z.enum(['ai', 'template'], 'Choose either a design written for you or one of your own templates').default('template'),
  avoidRecipeIds: z
    .array(z.enum(recipeIds(), 'Choose one of the designs this app offers'))
    .max(recipeIds().length, 'There are only this many designs to leave out')
    .optional(),
  variant: variantValue.optional(),
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
  /* Filled-in words and photos. Which blanks exist, how long each answer may be and whose
     photo it is are checked against the poster's own design in the shared rules. */
  extras: z
    .record(
      z.string().trim().regex(VARIABLE_KEY_PATTERN, 'A fill-in name must be 2-24 lower-case letters, numbers or underscores'),
      z.string().max(VARIABLE_LIMITS.maxLength.max, `A filled-in answer cannot be longer than ${VARIABLE_LIMITS.maxLength.max} characters`)
    )
    .optional(),
  images: z
    .record(
      z.string().trim().regex(VARIABLE_KEY_PATTERN, 'A fill-in name must be 2-24 lower-case letters, numbers or underscores'),
      z.string().trim().max(600, 'That photo address is too long')
    )
    .optional(),
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
  /* A poster made from a design recipe keeps that design: the server re-builds the items from
     this tenant's own brand kit, so nothing about the look arrives as text to store. */
  recipe: recipeChoiceSchema.optional(),
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

export const applyLatestDesignSchema = z.object({
  expectedVersion: versionNumber,
});
