import mongoose from 'mongoose';
import {
  FONT_RANGE,
  LAYOUT_OPTIONS,
  TEMPLATE_CATEGORIES,
  TEMPLATE_MAX_VERSIONS,
  TEMPLATE_SIZE_DEFAULT,
  layoutDefaultsFor,
} from '../services/template/zones.js';

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

const layoutSchema = new mongoose.Schema(
  {
    alignment: { type: String, enum: LAYOUT_OPTIONS.alignment },
    spacing: { type: String, enum: LAYOUT_OPTIONS.spacing },
    imagePlacement: { type: String, enum: LAYOUT_OPTIONS.imagePlacement },
    infoStyle: { type: String, enum: LAYOUT_OPTIONS.infoStyle },
    decoration: { type: String, enum: LAYOUT_OPTIONS.decoration },
  },
  { _id: false }
);

const templateVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, min: 1 },
    name: { type: String, trim: true, maxlength: 120 },
    zones: { type: [zoneSchema], default: [] },
    layout: { type: layoutSchema, default: () => ({}) },
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
