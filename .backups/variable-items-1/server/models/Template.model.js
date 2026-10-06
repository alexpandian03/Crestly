import mongoose from 'mongoose';
import {
  FONT_RANGE,
  ITEM_OFFSET_DEFAULT,
  ITEM_OFFSET_LIMIT,
  LAYOUT_OPTIONS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_MAX_VERSIONS,
  TEMPLATE_SIZE_DEFAULT,
  layoutDefaultsFor,
} from '../services/template/zones.js';
import {
  ELEMENT_FIELDS,
  ELEMENT_FONTS,
  ELEMENT_KINDS,
  ELEMENT_LIMITS,
  ELEMENT_SHAPE_DEFAULTS,
  ELEMENT_STYLE_DEFAULTS,
  ELEMENT_WEIGHTS,
  IMAGE_FITS,
  LEGACY_EDITOR_VERSION,
  SHAPE_TYPES,
  TEMPLATE_DOC_MAX_BYTES,
  TEXT_ALIGNS,
  jsonBytes,
} from '../../shared/templateElements.js';

const zoneSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Zone ID is required'],
      trim: true,
    },
    type: {
      type: String,
      enum: {
        values: ['header', 'footer', 'content', 'image'],
        message: '{VALUE} is not a valid zone type',
      },
      required: [true, 'Zone type is required'],
    },
    x: {
      type: Number,
      required: [true, 'Zone x-coordinate is required'],
      min: 0,
    },
    y: {
      type: Number,
      required: [true, 'Zone y-coordinate is required'],
      min: 0,
    },
    w: {
      type: Number,
      required: [true, 'Zone width is required'],
      min: 10,
    },
    h: {
      type: Number,
      required: [true, 'Zone height is required'],
      min: 10,
    },
    locked: {
      type: Boolean,
      default: false,
    },
    minFont: {
      type: Number,
      default: 12,
      min: FONT_RANGE.min,
      max: FONT_RANGE.max,
    },
    maxFont: {
      type: Number,
      default: 48,
      min: FONT_RANGE.min,
      max: FONT_RANGE.max,
    },
  },
  { _id: false }
);

const itemOffsetSchema = new mongoose.Schema(
  {
    dx: {
      type: Number,
      default: ITEM_OFFSET_DEFAULT.dx,
      min: -ITEM_OFFSET_LIMIT,
      max: ITEM_OFFSET_LIMIT,
    },
    dy: {
      type: Number,
      default: ITEM_OFFSET_DEFAULT.dy,
      min: -ITEM_OFFSET_LIMIT,
      max: ITEM_OFFSET_LIMIT,
    },
  },
  { _id: false }
);

/** One nudge per word group, so a layout preset is the starting point and not a cage. */
const itemOffsetsSchema = new mongoose.Schema(
  {
    headline: { type: itemOffsetSchema, default: () => ({ ...ITEM_OFFSET_DEFAULT }) },
    description: { type: itemOffsetSchema, default: () => ({ ...ITEM_OFFSET_DEFAULT }) },
    date: { type: itemOffsetSchema, default: () => ({ ...ITEM_OFFSET_DEFAULT }) },
    time: { type: itemOffsetSchema, default: () => ({ ...ITEM_OFFSET_DEFAULT }) },
    venue: { type: itemOffsetSchema, default: () => ({ ...ITEM_OFFSET_DEFAULT }) },
    details: { type: itemOffsetSchema, default: () => ({ ...ITEM_OFFSET_DEFAULT }) },
  },
  { _id: false }
);

const layoutSchema = new mongoose.Schema(
  {
    alignment: { type: String, enum: LAYOUT_OPTIONS.alignment },
    spacing: { type: String, enum: LAYOUT_OPTIONS.spacing },
    imagePlacement: { type: String, enum: LAYOUT_OPTIONS.imagePlacement },
    infoStyle: { type: String, enum: LAYOUT_OPTIONS.infoStyle },
    decoration: { type: String, enum: LAYOUT_OPTIONS.decoration },
    itemOffsets: { type: itemOffsetsSchema, default: () => ({}) },
  },
  { _id: false }
);

/* One thing the editor places inside the content area. The header and footer are painted
   by the brand kit, so they are never items. Ranges mirror /shared/templateElements.js. */
const elementStyleSchema = new mongoose.Schema(
  {
    fontFamily: {
      type: String,
      enum: { values: ELEMENT_FONTS, message: '{VALUE} is not one of the fonts this app offers' },
      default: ELEMENT_STYLE_DEFAULTS.fontFamily,
    },
    size: {
      type: Number,
      default: ELEMENT_STYLE_DEFAULTS.size,
      min: ELEMENT_LIMITS.fontSize.min,
      max: ELEMENT_LIMITS.fontSize.max,
    },
    minSize: {
      type: Number,
      default: ELEMENT_STYLE_DEFAULTS.minSize,
      min: ELEMENT_LIMITS.fontSize.min,
      max: ELEMENT_LIMITS.fontSize.max,
    },
    weight: {
      type: Number,
      enum: { values: ELEMENT_WEIGHTS, message: '{VALUE} is not a weight this app offers' },
      default: ELEMENT_STYLE_DEFAULTS.weight,
    },
    color: { type: String, trim: true, default: ELEMENT_STYLE_DEFAULTS.color },
    align: { type: String, enum: TEXT_ALIGNS, default: ELEMENT_STYLE_DEFAULTS.align },
    lineHeight: {
      type: Number,
      default: ELEMENT_STYLE_DEFAULTS.lineHeight,
      min: ELEMENT_LIMITS.lineHeight.min,
      max: ELEMENT_LIMITS.lineHeight.max,
    },
    letterSpacing: {
      type: Number,
      default: ELEMENT_STYLE_DEFAULTS.letterSpacing,
      min: ELEMENT_LIMITS.letterSpacing.min,
      max: ELEMENT_LIMITS.letterSpacing.max,
    },
    uppercase: { type: Boolean, default: false },
    italic: { type: Boolean, default: false },
    opacity: {
      type: Number,
      default: ELEMENT_STYLE_DEFAULTS.opacity,
      min: ELEMENT_LIMITS.opacity.min,
      max: ELEMENT_LIMITS.opacity.max,
    },
    fit: { type: String, enum: IMAGE_FITS, default: ELEMENT_STYLE_DEFAULTS.fit },
    radius: {
      type: Number,
      default: ELEMENT_STYLE_DEFAULTS.radius,
      min: ELEMENT_LIMITS.radius.min,
      max: ELEMENT_LIMITS.radius.max,
    },
    showIcon: { type: Boolean, default: true },
    showLabel: { type: Boolean, default: true },
  },
  { _id: false }
);

const elementShapeSchema = new mongoose.Schema(
  {
    type: { type: String, enum: SHAPE_TYPES, default: ELEMENT_SHAPE_DEFAULTS.type },
    fill: { type: String, trim: true, default: '' },
    stroke: { type: String, trim: true, default: '' },
    strokeWidth: {
      type: Number,
      default: ELEMENT_SHAPE_DEFAULTS.strokeWidth,
      min: ELEMENT_LIMITS.strokeWidth.min,
      max: ELEMENT_LIMITS.strokeWidth.max,
    },
  },
  { _id: false }
);

const elementSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: [true, 'Every item needs its own name'],
      trim: true,
      maxlength: ELEMENT_LIMITS.idChars,
    },
    kind: {
      type: String,
      enum: { values: ELEMENT_KINDS, message: '{VALUE} is not a kind of item this editor can place' },
      required: [true, 'Every item needs a kind'],
    },
    field: {
      type: String,
      enum: { values: ELEMENT_FIELDS, message: '{VALUE} is not a part of the poster this editor can place' },
    },
    x: { type: Number, required: [true, 'Every item needs a position'], min: 0 },
    y: { type: Number, required: [true, 'Every item needs a position'], min: 0 },
    w: { type: Number, required: [true, 'Every item needs a size'], min: 0 },
    h: { type: Number, required: [true, 'Every item needs a size'], min: 0 },
    z: { type: Number, default: 0, min: ELEMENT_LIMITS.z.min, max: ELEMENT_LIMITS.z.max },
    locked: { type: Boolean, default: false },
    style: { type: elementStyleSchema, default: () => ({}) },
    text: { type: String, trim: true, maxlength: ELEMENT_LIMITS.textChars, default: '' },
    imageUrl: { type: String, trim: true, maxlength: 600, default: '' },
    shape: { type: elementShapeSchema, default: undefined },
  },
  { _id: false }
);

const templateVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, min: 1 },
    name: { type: String, trim: true, maxlength: 120 },
    zones: { type: [zoneSchema], default: [] },
    layout: { type: layoutSchema, default: () => ({}) },
    elements: { type: [elementSchema], default: [] },
    editorVersion: { type: Number, min: 1, default: LEGACY_EDITOR_VERSION },
    size: {
      width: { type: Number },
      height: { type: Number },
    },
    note: { type: String, trim: true, maxlength: 120, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const templateSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'clientId is required for Template'],
      index: true,
    },
    name: {
      type: String,
      required: [true, 'Template name is required'],
      trim: true,
      maxlength: [120, 'Template name cannot exceed 120 characters'],
    },
    category: {
      type: String,
      enum: {
        values: TEMPLATE_CATEGORIES,
        message: '{VALUE} is not a valid category',
      },
      trim: true,
      default: 'Event',
    },
    size: {
      width: {
        type: Number,
        default: TEMPLATE_SIZE_DEFAULT.width,
      },
      height: {
        type: Number,
        default: TEMPLATE_SIZE_DEFAULT.height,
      },
    },
    zones: {
      type: [zoneSchema],
      default: [],
    },
    layout: {
      type: layoutSchema,
      default: () => ({ ...layoutDefaultsFor([]) }),
    },
    /* Items placed by the editor. A template saved before the editor exists has none and is
       converted from its zones on read, so nothing is rewritten until an admin saves. */
    elements: {
      type: [elementSchema],
      default: [],
    },
    editorVersion: {
      type: Number,
      default: LEGACY_EDITOR_VERSION,
      min: 1,
    },
    versions: {
      type: [templateVersionSchema],
      default: [],
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Missing or partial layout choices are filled from the zone set before every save, so
// templates created outside the API (seeds, scripts, older code) stay complete.
templateSchema.pre('validate', function fillLayout(next) {
  for (const [key, value] of Object.entries(layoutDefaultsFor(this.zones || []))) {
    if (!this.get(`layout.${key}`)) this.set(`layout.${key}`, value);
  }
  next();
});

function plainError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

// Item count and the size of the whole document (items plus history) are checked here, so an
// unusable template is refused with a plain sentence instead of a database error.
templateSchema.pre('validate', function checkEditorLimits(next) {
  if ((this.elements || []).length > ELEMENT_LIMITS.maxItems) {
    return next(plainError(`A template can hold at most ${ELEMENT_LIMITS.maxItems} items.`));
  }
  for (const entry of this.versions || []) {
    if ((entry.elements || []).length > ELEMENT_LIMITS.maxItems) {
      return next(plainError(`A template can hold at most ${ELEMENT_LIMITS.maxItems} items.`));
    }
  }
  if (jsonBytes(this.toObject({ depopulate: true, versionKey: false })) > TEMPLATE_DOC_MAX_BYTES) {
    return next(plainError('This template is too big to save. Remove a few items and try again.'));
  }
  return next();
});

templateSchema.pre('save', function capVersions(next) {
  if (this.isModified('versions') && this.versions.length > TEMPLATE_MAX_VERSIONS) {
    this.versions = this.versions.slice(-TEMPLATE_MAX_VERSIONS);
  }
  next();
});

templateSchema.index({ clientId: 1, isActive: 1 });
templateSchema.index(
  { clientId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 }, name: 'clientId_name_unique' }
);

templateSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export function getDefaultTemplateData(clientId, clientName = 'Default') {
  return {
    clientId,
    name: `${clientName} Standard Event Poster`,
    category: 'Event',
    size: { width: 1080, height: 1350 },
    zones: [
      {
        id: 'zone-header',
        type: 'header',
        x: 0,
        y: 0,
        w: 1080,
        h: 140,
        locked: true,
      },
      {
        id: 'zone-content',
        type: 'content',
        x: 70,
        y: 170,
        w: 940,
        h: 640,
        locked: false,
        minFont: 16,
        maxFont: 54,
      },
      {
        id: 'zone-image',
        type: 'image',
        x: 70,
        y: 830,
        w: 940,
        h: 370,
        locked: false,
      },
      {
        id: 'zone-footer',
        type: 'footer',
        x: 0,
        y: 1220,
        w: 1080,
        h: 130,
        locked: true,
      },
    ],
    layout: layoutDefaultsFor([{ type: 'image' }]),
    version: 1,
    versions: [],
    isActive: true,
    isDefault: true,
  };
}

const Template = mongoose.models.Template || mongoose.model('Template', templateSchema);

export default Template;
