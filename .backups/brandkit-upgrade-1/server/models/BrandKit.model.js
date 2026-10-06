import mongoose from 'mongoose';

const brandKitSchema = new mongoose.Schema(
  {
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Client',
      required: [true, 'clientId is required for BrandKit'],
      unique: true,
      index: true,
    },
    orgName: {
      type: String,
      required: [true, 'Organization name is required'],
      trim: true,
      maxlength: [100, 'Organization name cannot exceed 100 characters'],
    },
    logos: [
      {
        url: { type: String, required: true },
        label: { type: String, default: 'Primary Logo' },
        isPrimary: { type: Boolean, default: false },
      },
    ],
    colors: {
      primary: { type: String, default: '#059669' }, // Emerald-600
      secondary: { type: String, default: '#0f172a' }, // Slate-900
      accent: { type: String, default: '#10b981' }, // Emerald-500
      text: { type: String, default: '#ffffff' }, // White
      background: { type: String, default: '#0b0f17' }, // Deep Dark
    },
    fonts: {
      heading: { type: String, default: 'Outfit' },
      body: { type: String, default: 'Inter' },
    },
    header: {
      height: { type: Number, default: 80 },
      background: { type: String, default: 'rgba(15, 23, 42, 0.95)' },
      alignment: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: 'left',
      },
      showLogo: { type: Boolean, default: true },
      showOrgName: { type: Boolean, default: true },
    },
    footer: {
      height: { type: Number, default: 70 },
      background: { type: String, default: 'rgba(11, 15, 23, 0.98)' },
      contactText: { type: String, default: '+1 (555) 019-2834' },
      website: { type: String, default: 'www.brand.com' },
      socials: { type: [String], default: ['@brand', 'linkedin.com/company/brand'] },
      legalText: { type: String, default: '© All rights reserved.' },
    },
    defaultPosterSize: {
      width: { type: Number, default: 1080 },
      height: { type: Number, default: 1350 }, // 4:5 portrait standard
    },
  },
  {
    timestamps: true,
  }
);

brandKitSchema.set('toJSON', {
  transform: (doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

const BrandKit = mongoose.models.BrandKit || mongoose.model('BrandKit', brandKitSchema);

export default BrandKit;
