import { z } from 'zod';
import {
  FONT_RANGE,
  LAYOUT_ITEM_KEYS,
  LAYOUT_OPTIONS,
  ITEM_OFFSET_LIMIT,
  MAX_ZONES,
  SIZE_LIMITS,
  TEMPLATE_CATEGORIES,
} from '../services/template/zones.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid template ID');

// Numbers only: a string here is rejected instead of coerced, so text can never reach a size.
const fontValue = (field) =>
  z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .min(FONT_RANGE.min, `Text size must be at least ${FONT_RANGE.min}`)
    .max(FONT_RANGE.max, `Text size cannot be above ${FONT_RANGE.max}`);

// Geometry is numbers here; sizes, bounds and overlaps are checked by the shared zone rules.
const pixelValue = z.number({ error: 'Area position and size must be numbers' });

const zoneSchema = z.object({
  id: z.string().trim().min(1).max(80),
  type: z.enum(['header', 'footer', 'content', 'image']),
  x: pixelValue,
  y: pixelValue,
  w: pixelValue,
  h: pixelValue,
  locked: z.boolean().optional(),
  minFont: fontValue('Smallest text size').optional(),
  maxFont: fontValue('Largest text size').optional(),
});

const sizeSchema = z.object({
  width: z
    .number()
    .int('Poster width must be a whole number')
    .min(SIZE_LIMITS.minWidth, `Poster width must be at least ${SIZE_LIMITS.minWidth}`)
    .max(SIZE_LIMITS.maxWidth, `Poster width cannot be above ${SIZE_LIMITS.maxWidth}`),
  height: z
    .number()
    .int('Poster height must be a whole number')
    .min(SIZE_LIMITS.minHeight, `Poster height must be at least ${SIZE_LIMITS.minHeight}`)
    .max(SIZE_LIMITS.maxHeight, `Poster height cannot be above ${SIZE_LIMITS.maxHeight}`),
});

// A word nudge is a whole-pixel move inside the text area; the shared rules clamp and complete it.
const itemOffsetValue = (field) =>
  z
    .number({ error: `${field} must be a number` })
    .int(`${field} must be a whole number`)
    .min(-ITEM_OFFSET_LIMIT, `${field} cannot be further than ${ITEM_OFFSET_LIMIT} pixels`)
    .max(ITEM_OFFSET_LIMIT, `${field} cannot be further than ${ITEM_OFFSET_LIMIT} pixels`);

const itemOffsetSchema = z.object({
  dx: itemOffsetValue('Sideways move').optional(),
  dy: itemOffsetValue('Up or down move').optional(),
});

const itemOffsetsSchema = z.object(
  LAYOUT_ITEM_KEYS.reduce((acc, key) => {
    acc[key] = itemOffsetSchema.optional();
    return acc;
  }, {})
);

const layoutSchema = z.object({
  alignment: z.enum(LAYOUT_OPTIONS.alignment).optional(),
  spacing: z.enum(LAYOUT_OPTIONS.spacing).optional(),
  imagePlacement: z.enum(LAYOUT_OPTIONS.imagePlacement).optional(),
  infoStyle: z.enum(LAYOUT_OPTIONS.infoStyle).optional(),
  decoration: z.enum(LAYOUT_OPTIONS.decoration).optional(),
  itemOffsets: itemOffsetsSchema.optional(),
});

const zonesSchema = z
  .array(zoneSchema)
  .min(1, 'A template needs a header, a footer and a content area.')
  .max(MAX_ZONES, `A template can have at most ${MAX_ZONES} areas.`)
  .refine(
    (zones) => zones.every((zone) => zone.minFont === undefined || zone.maxFont === undefined || zone.minFont <= zone.maxFont),
    'Smallest text size must not be larger than the largest text size.'
  );

export const templateParamsSchema = z.object({ id: objectId });

const templateWriteSchema = z.object({
  name: z.string().trim().min(2).max(120),
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
  size: sizeSchema.optional(),
  zones: zonesSchema,
  layout: layoutSchema.optional(),
});

export const createTemplateSchema = templateWriteSchema;

export const updateTemplateSchema = z
  .object({
    name: templateWriteSchema.shape.name.optional(),
    category: templateWriteSchema.shape.category,
    size: sizeSchema.optional(),
    zones: zonesSchema.optional(),
    layout: layoutSchema.optional(),
    note: z.string().trim().max(120).optional(),
    expectedVersion: z.coerce.number().int().min(1, 'Invalid version number').optional(),
  })
  .refine((value) => ['name', 'category', 'size', 'zones', 'layout'].some((key) => value[key] !== undefined), {
    message: 'Provide at least one change',
  });

export const restoreTemplateSchema = z.object({
  version: z.coerce.number().int().min(1, 'Invalid version number'),
});
