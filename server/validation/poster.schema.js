import { z } from 'zod';
import { CONTENT_LIMITS } from '../services/poster/content.js';
import { VARIABLE_KEY_PATTERN, VARIABLE_LIMITS, ICON_NAMES } from '../../shared/templateElements.js';
import { RECIPE_VARIANTS, recipeIds, designById } from '../../shared/designRecipes.js';
import { ARCHETYPE_IDS } from '../../shared/archetypes.js';
import { EVENT_TYPE_IDS } from '../../shared/eventTypes.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid ID');

/** Accepts canonical archetype / recipe names as well as legacy aliases (hero, photoTop, etc.) */
const archetypeOrRecipeId = z
  .string()
  .trim()
  .refine(
    (value) => Boolean(designById(value) || ARCHETYPE_IDS.includes(value.toLowerCase())),
    'Choose one of the designs this app offers'
  )
  .transform((value) => designById(value)?.id || value.toLowerCase());

/** Which of the four arrangements of a design, as a number or the text of one. */
const variantValue = z
  .coerce
  .number()
  .int('Choose one of the four arrangements of this design')
  .refine((value) => RECIPE_VARIANTS.includes(value), 'Choose one of the four arrangements of this design');

/** A design built from a recipe: its name, which arrangement, and which small mark. */
const recipeChoiceSchema = z
  .object({
    archetype: archetypeOrRecipeId.optional(),
    recipeId: archetypeOrRecipeId.optional(),
    variant: variantValue.optional(),
    icon: z.enum(ICON_NAMES, 'Choose one of the pictures this app can draw').optional(),
  })
  .refine((data) => Boolean(data.archetype || data.recipeId), 'Choose one of the designs this app offers')
  .transform((data) => {
    const id = data.archetype || data.recipeId;
    return {
      ...data,
      archetype: id,
      recipeId: id,
    };
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
  /* "ai" writes a whole design from a recipe; template fills blanks; "choices" generates AI choices; "paging" returns paged designs. */
  mode: z.enum(['ai', 'template', 'choices', 'paging'], 'Choose either a design written for you, your own template, choices, or paging').default('template'),
  avoidRecipeIds: z
    .array(archetypeOrRecipeId)
    .max(30, 'There are only this many designs to leave out')
    .optional(),
  archetype: archetypeOrRecipeId.optional(),
  recipeId: archetypeOrRecipeId.optional(),
  variant: variantValue.optional(),
  imageUrl: z.string().trim().max(1000, 'Image address is too long').optional(),
  /** The event type chosen by the user or suggested by the AI. */
  eventType: z.enum(EVENT_TYPE_IDS, { error: 'Unknown event type' }).optional(),
  /** Request 1-3 variants in a single generation call. */
  variants: z.coerce.number().int().min(1).max(3).optional(),
  seed: z.union([z.number(), z.string()]).optional(),
  pageSize: z.coerce.number().int().min(1).max(12).optional().default(2),
  seen: z.array(z.string()).optional().default([]),
  copyVariants: z.array(z.any()).optional(),
  facts: z.record(z.any()).optional(),
  mood: z.string().optional(),
  reason: z.string().optional(),
  blockPreferences: z.record(z.string()).optional(),
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
  lists: z
    .record(
      z.string().trim().regex(VARIABLE_KEY_PATTERN, 'A list name must be 2-24 lower-case letters, numbers or underscores'),
      z.array(z.record(z.string(), z.any()))
    )
    .optional(),
});

const dateString = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(Date.parse(value)), 'Please use a real date');

export const createPosterSchema = z
  .object({
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
    archetype: archetypeOrRecipeId.optional(),
    recipeId: archetypeOrRecipeId.optional(),
    variant: variantValue.optional(),
    /** Event type chosen when the poster was created. */
    eventType: z.enum(EVENT_TYPE_IDS, { error: 'Unknown event type' }).optional(),
  })
  .transform((data) => {
    let recipe = data.recipe;
    const topId = data.archetype || data.recipeId;
    if (!recipe && topId) {
      recipe = {
        archetype: topId,
        recipeId: topId,
        variant: data.variant ?? 0,
      };
    } else if (recipe && topId) {
      recipe.archetype = recipe.archetype || topId;
      recipe.recipeId = recipe.recipeId || topId;
      if (recipe.variant === undefined && data.variant !== undefined) {
        recipe.variant = data.variant;
      }
    }
    return {
      ...data,
      recipe,
      archetype: recipe?.archetype || topId,
      recipeId: recipe?.recipeId || topId,
      variant: recipe?.variant ?? data.variant,
    };
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

export const updatePosterSchema = z
  .object({
    content: contentSchema,
    note: z.string().trim().max(120, 'Note is too long').optional(),
    expectedVersion: z.coerce.number().int().min(1, 'Invalid version number'),
    recipe: recipeChoiceSchema.optional(),
    archetype: archetypeOrRecipeId.optional(),
    recipeId: archetypeOrRecipeId.optional(),
    variant: variantValue.optional(),
  })
  .transform((data) => {
    let recipe = data.recipe;
    const topId = data.archetype || data.recipeId;
    if (!recipe && topId) {
      recipe = {
        archetype: topId,
        recipeId: topId,
        variant: data.variant ?? 0,
      };
    } else if (recipe && topId) {
      recipe.archetype = recipe.archetype || topId;
      recipe.recipeId = recipe.recipeId || topId;
      if (recipe.variant === undefined && data.variant !== undefined) {
        recipe.variant = data.variant;
      }
    }
    return {
      ...data,
      recipe,
      archetype: recipe?.archetype || topId,
      recipeId: recipe?.recipeId || topId,
      variant: recipe?.variant ?? data.variant,
    };
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

/**
 * One illustration for a design that shows a picture. Only the design's name and the words
 * already standing as the poster's headline are accepted; nothing else about the poster, and no
 * free description, can reach the picture service.
 */
export const posterImageRequestSchema = z
  .object({
    archetype: archetypeOrRecipeId.optional(),
    recipeId: archetypeOrRecipeId.optional(),
    title: z
      .string()
      .trim()
      .min(3, 'Give the poster a headline first, then we can draw a picture for it')
      .max(CONTENT_LIMITS.title, `The headline cannot exceed ${CONTENT_LIMITS.title} characters`),
  })
  .refine((data) => Boolean(data.archetype || data.recipeId), 'Choose one of the designs this app offers')
  .transform((data) => {
    const id = data.archetype || data.recipeId;
    return {
      ...data,
      archetype: id,
      recipeId: id,
    };
  });

export const posterDraftSchema = z
  .object({
    basedOnVersion: z.coerce.number().int().min(1, 'Current version number is required'),
    data: z
      .object({
        content: contentSchema.optional(),
        title: z.string().trim().optional(),
        recipe: recipeChoiceSchema.optional(),
        archetype: archetypeOrRecipeId.optional(),
        recipeId: archetypeOrRecipeId.optional(),
        variant: variantValue.optional(),
      })
      .passthrough()
      .optional(),
    content: contentSchema.optional(),
    title: z.string().trim().optional(),
    recipe: recipeChoiceSchema.optional(),
    archetype: archetypeOrRecipeId.optional(),
    recipeId: archetypeOrRecipeId.optional(),
    variant: variantValue.optional(),
  })
  .refine(
    (data) => data.data !== undefined || data.content !== undefined,
    { message: 'Provide draft content to save' }
  );

export const parseCardListSchema = z.object({
  text: z
    .string({ required_error: 'Pasted text is required' })
    .trim()
    .min(1, 'Please paste some text to tidy')
    .max(20000, 'Pasted text is too long'),
  listDefinition: z.record(z.any()).optional(),
  cardList: z.record(z.any()).optional(),
});



