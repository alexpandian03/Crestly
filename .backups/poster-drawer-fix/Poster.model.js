import mongoose from 'mongoose';

const MAX_VERSIONS = 20;

const posterVersionSchema = new mongoose.Schema(
  {
    content: {
      title: { type: String, required: true, trim: true, maxlength: 60 },
      tagline: { type: String, default: '', trim: true, maxlength: 100 },
      date: { type: String, default: '', trim: true, maxlength: 30 },
      time: { type: String, default: '', trim: true, maxlength: 20 },
      venue: { type: String, default: '', trim: true, maxlength: 80 },
      details: {
        type: [{ type: String, trim: true, maxlength: 90 }],
        default: [],
      },
      imageUrl: { type: String, default: '' },
    },
    note: { type: String, trim: true, maxlength: 120, default: '' },
    versionNumber: { type: Number, min: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false }
);

const posterSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'clientId is required for Poster'],
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'userId is required for Poster'],
    },
    templateId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Template',
      required: [true, 'templateId is required for Poster'],
    },
    title: { type: String, required: [true, 'title is required'], trim: true, maxlength: 60 },
    prompt: { type: String, required: [true, 'prompt is required'], trim: true, maxlength: 1000 },
    content: {
      title: { type: String, required: true, trim: true, maxlength: 60 },
      tagline: { type: String, default: '', trim: true, maxlength: 100 },
      date: { type: String, default: '', trim: true, maxlength: 30 },
      time: { type: String, default: '', trim: true, maxlength: 20 },
      venue: { type: String, default: '', trim: true, maxlength: 80 },
      details: {
        type: [{ type: String, trim: true, maxlength: 90 }],
        default: [],
      },
      imageUrl: { type: String, default: '' },
    },
    versions: {
      type: [posterVersionSchema],
      default: [],
    },
    currentVersion: { type: Number, default: 1, min: 1 },
    status: {
      type: String,
      enum: ['draft', 'pending', 'approved'],
      default: 'draft',
    },
    thumbnailUrl: { type: String, default: '' },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

posterSchema.index({ clientId: 1, userId: 1, updatedAt: -1 });
posterSchema.index({ clientId: 1, status: 1, updatedAt: -1 });
posterSchema.index({ title: 'text', prompt: 'text' });

posterSchema.pre('save', function capVersions(next) {
  if (this.isModified('versions') && this.versions.length > MAX_VERSIONS) {
    this.versions = this.versions.slice(-MAX_VERSIONS);
  }
  next();
});

posterSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const POSTER_CONTENT_LIMITS = {
  title: 60,
  tagline: 100,
  date: 30,
  time: 20,
  venue: 80,
  detail: 90,
  details: 4,
};

export const POSTER_MAX_VERSIONS = MAX_VERSIONS;

export default mongoose.model('Poster', posterSchema);
