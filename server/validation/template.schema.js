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
import {
  CARD_LIST_LIMITS,
  ELEMENT_FIELDS,
  ELEMENT_KINDS,
  ELEMENT_LIMITS,
  IMAGE_FITS,
  IMAGE_MASKS,
  SHAPE_TYPES,
  TEXT_ALIGNS,
  VARIABLE_KEY_PATTERN,
  VARIABLE_LIMITS,
  validateElements,
  validateTemplateSections,
} from '../../shared/templateElements.js';
import { templatePageSchema } from './brandKit.schema.js';
import { EVENT_TYPE_IDS } from '../../shared/eventTypes.js';

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

/**
 * Editor items. This layer checks the shape of what arrived; every value rule (colours,
 * fonts, counts, sizes, where an item may sit, whose photo it is) lives in
 * /shared/templateElements.js so the browser and the API refuse the same things with the
 * same words.
 */
const elementStyleSchema = z.object({
  fontFamily: z.string().optional(),
  size: z.number().optional(),
  minSize: z.number().optional(),
  weight: z.number().optional(),
  color: z.string().optional(),
  align: z.enum(TEXT_ALIGNS, { error: 'Words can only sit on the left, in the middle or on the right.' }).optional(),
  lineHeight: z.number().optional(),
  letterSpacing: z.number().optional(),
  uppercase: z.boolean().optional(),
  italic: z.boolean().optional(),
  opacity: z.number().optional(),
  fit: z.enum(IMAGE_FITS, { error: 'A photo can only fill its space or fit inside it.' }).optional(),
  radius: z.number().optional(),
  strokeWidth: z.number().optional(),
  showIcon: z.boolean().optional(),
  showLabel: z.boolean().optional(),
});

const elementShapeSchema = z.object({
  type: z.enum(SHAPE_TYPES, { error: 'A shape can only be a box, a circle, a line, a triangle, a star, a hexagon or a diamond.' }).optional(),
  fill: z.string().optional(),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
});

const itemPixel = (what) => z.number({ error: `An item's ${what} must be a number` });

const elementSchema = z.object({
  id: z
    .string()
    .trim()
    .max(ELEMENT_LIMITS.idChars, { error: `An item's name cannot be longer than ${ELEMENT_LIMITS.idChars} characters.` })
    .optional(),
  kind: z.enum(ELEMENT_KINDS, { error: 'That is not a kind of item this editor can place.' }),
  field: z.enum(ELEMENT_FIELDS, { error: 'That is not a part of the poster this editor can place.' }).optional(),
  // The picture an icon draws; only the names this app knows are allowed, checked in /shared.
  name: z
    .string()
    .trim()
    .max(ELEMENT_LIMITS.nameChars, { error: `An icon's name cannot be longer than ${ELEMENT_LIMITS.nameChars} characters.` })
    .optional(),
  x: itemPixel('position'),
  y: itemPixel('position'),
  w: itemPixel('size'),
  h: itemPixel('size'),
  z: z.number().int({ error: 'The stacking order must be a whole number' }).optional(),
  locked: z.boolean().optional(),
  rotation: z
    .number({ error: 'Rotation must be a number' })
    .min(-180, 'Rotation must be between -180 and 180 degrees')
    .max(180, 'Rotation must be between -180 and 180 degrees')
    .optional(),
  mask: z.enum(IMAGE_MASKS, { error: 'Invalid image mask' }).optional(),
  groupId: z.string().trim().max(50).optional(),
  hidden: z.boolean().optional(),
  src: z.string().max(600).optional(),
  style: elementStyleSchema.optional(),
  text: z
    .string()
    .max(ELEMENT_LIMITS.textChars, { error: `A text box cannot hold more than ${ELEMENT_LIMITS.textChars} characters.` })
    .optional(),
  imageUrl: z.string().max(600, { error: 'That photo address is too long.' }).optional(),
  shape: elementShapeSchema.optional(),
  // A fill-in slot keeps its own name and the words shown for it; the shared rules check the values.
  variable: z.boolean().optional(),
  key: z
    .string()
    .trim()
    .regex(VARIABLE_KEY_PATTERN, {
      error: `A fill-in name must be ${VARIABLE_LIMITS.key.min}-${VARIABLE_LIMITS.key.max} lower-case letters, numbers or underscores.`,
    })
    .optional(),
  label: z.string().max(VARIABLE_LIMITS.labelChars, { error: `A fill-in name shown to the user cannot be longer than ${VARIABLE_LIMITS.labelChars} characters.` }).optional(),
  hint: z.string().max(VARIABLE_LIMITS.hintChars, { error: `A hint cannot be longer than ${VARIABLE_LIMITS.hintChars} characters.` }).optional(),
  sample: z.string().max(80, { error: 'A sample cannot be longer than 80 characters.' }).optional(),
  sampleImage: z.string().max(600, { error: 'That photo address is too long.' }).optional(),
  maxLength: z
    .number({ error: 'The room a fill-in has must be a number' })
    .int({ error: 'The room a fill-in has must be a whole number' })
    .min(VARIABLE_LIMITS.maxLength.min, `A fill-in must allow at least ${VARIABLE_LIMITS.maxLength.min} characters`)
    .max(VARIABLE_LIMITS.maxLength.max, `A fill-in cannot allow more than ${VARIABLE_LIMITS.maxLength.max} characters`)
    .optional(),
  aspectRatio: z.string().trim().max(20).optional(),
  // Ticked by an administrator: the sample picture in this space becomes each new poster's starting picture.
  defaultImage: z.boolean().optional(),
  columns: z.number().int().min(CARD_LIST_LIMITS.columns.min).max(CARD_LIST_LIMITS.columns.max).optional(),
  gapX: z.number().optional(),
  gapY: z.number().optional(),
  minCount: z.number().int().min(CARD_LIST_LIMITS.minCount.min).max(CARD_LIST_LIMITS.minCount.max).optional(),
  maxCount: z.number().int().min(CARD_LIST_LIMITS.maxCount.min).max(CARD_LIST_LIMITS.maxCount.max).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  card: z
    .object({
      w: z.number().optional(),
      h: z.number().optional(),
      fields: z
        .array(
          z.object({
            key: z.string().trim().regex(VARIABLE_KEY_PATTERN).optional(),
            type: z.enum(['text', 'image']).optional(),
            label: z.string().max(CARD_LIST_LIMITS.fieldLabelChars).optional(),
            maxLength: z.number().int().min(VARIABLE_LIMITS.maxLength.min).max(VARIABLE_LIMITS.maxLength.max).optional(),
          })
        )
        .max(CARD_LIST_LIMITS.maxFields, `A card can have at most ${CARD_LIST_LIMITS.maxFields} fields.`)
        .optional(),
      items: z.array(z.any()).optional(),
    })
    .optional(),
  fieldKey: z.string().trim().optional(),
});

/**
 * The one item rule set every template write goes through: create, update, duplicate and
 * restore. `context` carries the tenant (for photo ownership) and, once it is known, the
 * brand kit and poster size that decide where items may sit.
 */
export function templateElementsSchema(context = {}) {
  return z
    .array(elementSchema)
    .max(ELEMENT_LIMITS.maxItems, { error: `A template can hold at most ${ELEMENT_LIMITS.maxItems} items.` })
    .superRefine((elements, ctx) => {
      for (const problem of validateElements(elements, context)) {
        ctx.addIssue({ code: 'custom', message: problem });
      }
    });
}

const sectionHeaderFooterSchema = (_context = {}, sectionName = 'header') =>
  z.object({
    mode: z.enum(['brand', 'custom'], { error: `${sectionName} mode must be brand or custom` }).default('brand'),
    height: z
      .number({ error: `${sectionName} height must be a number` })
      .int(`${sectionName} height must be a whole number`)
      .min(60, `${sectionName} height must be at least 60`)
      .max(260, `${sectionName} height cannot be above 260`)
      .default(sectionName === 'header' ? 80 : 70),
    background: z.any().optional(),
    elements: z
      .array(elementSchema)
      .max(15, `The ${sectionName} can hold at most 15 items.`)
      .optional()
      .default([]),
  });

const sectionContentSchema = (context = {}) =>
  z.object({
    page: templatePageSchema(context.clientId).optional(),
    elements: z
      .array(elementSchema)
      .max(ELEMENT_LIMITS.maxItems, `A template can hold at most ${ELEMENT_LIMITS.maxItems} items.`)
      .optional()
      .default([]),
  });

export const templateSectionsSchema = (context = {}) =>
  z
    .object({
      header: sectionHeaderFooterSchema(context, 'header').optional(),
      content: sectionContentSchema(context).optional(),
      footer: sectionHeaderFooterSchema(context, 'footer').optional(),
    })
    .superRefine((sections, ctx) => {
      for (const problem of validateTemplateSections(sections, context)) {
        ctx.addIssue({ code: 'custom', message: problem });
      }
    });

function elementContextOf(req) {
  return { cloudName: process.env.CLOUDINARY_CLOUD_NAME, clientId: req?.clientId };
}

const templateWriteSchema = (context) => ({
  name: z.string().trim().min(2).max(120),
  category: z.enum(TEMPLATE_CATEGORIES).optional(),
  size: sizeSchema.optional(),
  /* A layout created from the Templates page arrives with just a name; the API gives it the
     standard areas itself. Anything that does send areas still has to send a usable set. */
  zones: zonesSchema.optional(),
  layout: layoutSchema.optional(),
  page: templatePageSchema(context.clientId).optional(),
  elements: templateElementsSchema(context).optional(),
  sections: templateSectionsSchema(context).optional(),
  header: sectionHeaderFooterSchema(context, 'header').optional(),
  footer: sectionHeaderFooterSchema(context, 'footer').optional(),
  content: sectionContentSchema(context).optional(),
  brandKit: z.any().optional(),
  /** Event types this template is designed for. Empty array = applies to all types. */
  eventTypes: z
    .array(z.enum(EVENT_TYPE_IDS, { error: 'Unknown event type' }))
    .max(EVENT_TYPE_IDS.length, 'Too many event types')
    .optional(),
});

export const createTemplateSchemaFor = (req) => z.object(templateWriteSchema(elementContextOf(req)));

export const updateTemplateSchemaFor = (req) => {
  const shape = templateWriteSchema(elementContextOf(req));
  return z
    .object({
      name: shape.name.optional(),
      category: shape.category,
      size: shape.size,
      zones: shape.zones.optional(),
      layout: shape.layout,
      page: shape.page,
      elements: shape.elements,
      sections: shape.sections,
      header: shape.header,
      footer: shape.footer,
      content: shape.content,
      brandKit: shape.brandKit,
      eventTypes: shape.eventTypes,
      note: z.string().trim().max(120).optional(),
      expectedVersion: z.coerce.number().int().min(1, 'Invalid version number').optional(),
    })
    .refine(
      (value) =>
        ['name', 'category', 'size', 'zones', 'layout', 'page', 'elements', 'sections', 'header', 'footer', 'content', 'eventTypes', 'brandKit'].some(
          (key) => value[key] !== undefined
        ),
      { message: 'Provide at least one change' }
    );
};

export const restoreTemplateSchema = z.object({
  version: z.coerce.number().int().min(1, 'Invalid version number'),
});

export const templateDraftSchemaFor = (req) => {
  const shape = templateWriteSchema(elementContextOf(req));
  const draftDataSchema = z
    .object({
      name: shape.name.optional(),
      category: shape.category,
      size: shape.size,
      zones: shape.zones.optional(),
      layout: shape.layout,
      page: shape.page,
      elements: shape.elements,
      sections: shape.sections,
      header: shape.header,
      footer: shape.footer,
      content: shape.content,
    })
    .passthrough();

  return z
    .object({
      basedOnVersion: z.coerce.number().int().min(1, 'Current version is required'),
      data: draftDataSchema.optional(),
      name: shape.name.optional(),
      category: shape.category,
      size: shape.size,
      zones: shape.zones.optional(),
      layout: shape.layout,
      page: shape.page,
      elements: shape.elements,
      sections: shape.sections,
      header: shape.header,
      footer: shape.footer,
      content: shape.content,
    })
    .passthrough()
    .superRefine((val, ctx) => {
      const dataToValidate = val.data !== undefined ? val.data : val;
      const parsed = draftDataSchema.safeParse(dataToValidate);
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          ctx.addIssue(issue);
        }
      }
    });
};
