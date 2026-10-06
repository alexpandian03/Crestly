import mongoose from 'mongoose';
import {
  BACKGROUND_POSITIONS,
  BRAND_KIT_DEFAULTS,
  IMAGE_FITS,
} from '../services/brand/style.js';

const { header: headerDefaults, content: contentDefaults, footer: footerDefaults } = BRAND_KIT_DEFAULTS;

const textStylePaths = (base) => ({
  fontFamily: { type: String, default: base.fontFamily },
  size: { type: Number, default: base.size },
  weight: { type: Number, default: base.weight },
  color: { type: String, default: base.color },
  uppercase: { type: Boolean, default: base.uppercase },
  letterSpacing: { type: Number, default: base.letterSpacing },
});

const backgroundPaths = (base) => ({
  type: { type: String, default: base.type },
  color: { type: String, default: base.color },
  gradientFrom: { type: String, default: base.gradientFrom },
  gradientTo: { type: String, default: base.gradientTo },
  gradientAngle: { type: Number, default: base.gradientAngle },
  imageUrl: { type: String, default: base.imageUrl },
  overlayColor: { type: String, default: base.overlayColor },
  overlayOpacity: { type: Number, default: base.overlayOpacity },
  ...(base.fit
    ? {
        fit: { type: String, default: base.fit, enum: IMAGE_FITS },
        position: { type: String, default: base.position, enum: BACKGROUND_POSITIONS },
        pattern: { type: String, default: base.pattern },
      }
    : {}),
});

const socialSchema = new mongoose.Schema(
  {
    platform: { type: String, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

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
    preset: { type: String, default: BRAND_KIT_DEFAULTS.preset },
    textStyle: textStylePaths(BRAND_KIT_DEFAULTS.textStyle),
    header: {
      height: { type: Number, default: headerDefaults.height },
      background: backgroundPaths(headerDefaults.background),
      alignment: {
        type: String,
        enum: ['left', 'center', 'right'],
        default: headerDefaults.alignment,
      },
      showLogo: { type: Boolean, default: headerDefaults.logo.show },
      showOrgName: { type: Boolean, default: headerDefaults.orgName.show },
      logo: {
        show: { type: Boolean, default: headerDefaults.logo.show },
        size: { type: Number, default: headerDefaults.logo.size },
        position: { type: String, default: headerDefaults.logo.position },
      },
      orgName: {
        show: { type: Boolean, default: headerDefaults.orgName.show },
        text: { type: String, default: '' },
        style: textStylePaths(headerDefaults.orgName.style),
      },
      tagline: {
        show: { type: Boolean, default: headerDefaults.tagline.show },
        text: { type: String, default: '', maxlength: 80 },
        style: textStylePaths(headerDefaults.tagline.style),
      },
      border: {
        show: { type: Boolean, default: headerDefaults.border.show },
        color: { type: String, default: headerDefaults.border.color },
        thickness: { type: Number, default: headerDefaults.border.thickness },
      },
    },
    content: {
      background: backgroundPaths(contentDefaults.background),
      decoration: { type: String, default: contentDefaults.decoration },
      decorationColor: { type: String, default: contentDefaults.decorationColor },
      watermark: {
        show: { type: Boolean, default: contentDefaults.watermark.show },
        opacity: { type: Number, default: contentDefaults.watermark.opacity },
      },
      headingColor: { type: String, default: contentDefaults.headingColor },
      bodyColor: { type: String, default: contentDefaults.bodyColor },
      accentColor: { type: String, default: contentDefaults.accentColor },
      headingFont: { type: String, default: contentDefaults.headingFont },
      bodyFont: { type: String, default: contentDefaults.bodyFont },
      infoCard: {
        background: { type: String, default: contentDefaults.infoCard.background },
        border: { type: String, default: contentDefaults.infoCard.border },
        radius: { type: Number, default: contentDefaults.infoCard.radius },
        iconColor: { type: String, default: contentDefaults.infoCard.iconColor },
      },
      defaultImageUrl: { type: String, default: contentDefaults.defaultImageUrl },
    },
    footer: {
      height: { type: Number, default: footerDefaults.height },
      background: backgroundPaths(footerDefaults.background),
      layout: { type: Number, default: footerDefaults.layout },
      address: { type: String, default: '', maxlength: 120 },
      phone: { type: String, default: '', maxlength: 40 },
      email: { type: String, default: '', maxlength: 120 },
      website: { type: String, default: '', maxlength: 120 },
      social: { type: [socialSchema], default: [] },
      contactText: { type: String, default: '', maxlength: 120 },
      socials: { type: [String], default: [] },
      legalText: { type: String, default: footerDefaults.legalText, maxlength: 160 },
      style: textStylePaths(footerDefaults.style),
      linkColor: { type: String, default: footerDefaults.linkColor },
      divider: {
        show: { type: Boolean, default: footerDefaults.divider.show },
        color: { type: String, default: footerDefaults.divider.color },
        thickness: { type: Number, default: footerDefaults.divider.thickness },
      },
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
