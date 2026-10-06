import { z } from 'zod';
import {
  BACKGROUND_PATTERNS,
  BACKGROUND_POSITIONS,
  BACKGROUND_TYPES,
  BRAND_FONTS,
  BRAND_IMAGE_KINDS,
  BRAND_PRESETS,
  CONTENT_BACKGROUND_TYPES,
  CONTENT_DECORATIONS,
  FOOTER_LAYOUTS,
  HEADER_ALIGNMENTS,
  IMAGE_FITS,
  LOGO_POSITIONS,
  MAX_SOCIAL_LINKS,
  RANGES,
  SOCIAL_PLATFORMS,
  TEXT_LIMITS,
  TEXT_WEIGHTS,
  brandImagePrefix,
  isBrandColor,
  isBrandImageHost,
  isTenantBrandImage,
  normalizeBrandColor,
  sanitizePlainText,
} from '../services/brand/style.js';

const numberField = (label, { min, max }, { integer = true } = {}) => {
  const base = integer ? z.number().int(`${label} must be a whole number.`) : z.number();
  return base.refine(
    (value) => value >= min && value <= max,
    `${label} must be between ${min} and ${max}.`
  );
};

const color = (label) =>
  z
    .string()
    .trim()
    .refine(isBrandColor, `${label} must be a color like #10b981.`)
    .transform(normalizeBrandColor);

const maybeColor = (label) => color(label).optional();

const plainText = (max) => z.string().transform((value) => sanitizePlainText(value, max));

const fontName = (label) =>
  plainText(60).refine(
    (value) => BRAND_FONTS.includes(value),
    `${label} must be one of: ${BRAND_FONTS.join(', ')}.`
  );

const httpsUrl = (label, max = 500) =>
  plainText(max).refine(
    (value) => value === '' || /^https:\/\//i.test(value),
    `${label} must be a web address that starts with https://`
  );

const textStyleSchema = () =>
  z.object({
    fontFamily: fontName('Font').optional(),
    size: numberField('Text size', RANGES.fontSize).optional(),
    weight: z
      .number()
      .refine((value) => TEXT_WEIGHTS.includes(value), 'Text weight must be 400, 500, 600 or 700.')
      .optional(),
    color: maybeColor('Text color'),
    uppercase: z.boolean().optional(),
    letterSpacing: numberField('Letter spacing', RANGES.letterSpacing, { integer: false }).optional(),
  });

const backgroundSchema = ({ clientId, types, withPattern, label }) => {
  const shape = {
    type: z.enum(types, { error: `${label} background type is not supported.` }).optional(),
    color: maybeColor(`${label} background color`),
    gradientFrom: maybeColor('Gradient start color'),
    gradientTo: maybeColor('Gradient end color'),
    gradientAngle: numberField('Gradient angle', RANGES.gradientAngle).optional(),
    imageUrl: brandImageUrl(clientId, `${label} image`).optional(),
    overlayColor: maybeColor('Overlay color'),
    overlayOpacity: numberField('Overlay opacity', RANGES.overlayOpacity, { integer: false }).optional(),
  };
  if (withPattern) {
    shape.fit = z.enum(IMAGE_FITS, { error: 'Photo display must be cover or contain.' }).optional();
    shape.position = z.enum(BACKGROUND_POSITIONS, { error: 'Photo position is not supported.' }).optional();
    shape.pattern = z.enum(BACKGROUND_PATTERNS, { error: 'Pattern is not supported.' }).optional();
  }
  return z.object(shape);
};

/** Pre-upgrade pages still send a bare color string where a background object now lives. */
const backgroundOrColor = ({ clientId, types, withPattern, label }) =>
  z.preprocess(
    (value) => (typeof value === 'string' ? { color: value } : value),
    backgroundSchema({ clientId, types, withPattern, label })
  );

function brandImageUrl(clientId, label) {
  const prefix = brandImagePrefix();
  return httpsUrl(label)
    .refine(
      (value) => value === '' || isBrandImageHost(value),
      `${label} must be uploaded to your own image library (${prefix}...).`
    )
    .refine(
      (value) => value === '' || isTenantBrandImage(value, clientId),
      `That photo does not belong to your organization. Upload it again.`
    );
}

const headerSchema = (clientId) =>
  z.object({
    height: numberField('Top band height', RANGES.headerHeight).optional(),
    background: backgroundOrColor({
      clientId,
      types: BACKGROUND_TYPES,
      label: 'Top band',
    }).optional(),
    alignment: z.enum(HEADER_ALIGNMENTS, { error: 'Alignment is not supported.' }).optional(),
    showLogo: z.boolean().optional(),
    showOrgName: z.boolean().optional(),
    logo: z
      .object({
        show: z.boolean().optional(),
        size: numberField('Logo size', RANGES.logoSize).optional(),
        position: z.enum(LOGO_POSITIONS, 'Logo position is not supported.').optional(),
      })
      .optional(),
    orgName: z
      .object({
        show: z.boolean().optional(),
        text: plainText(TEXT_LIMITS.orgNameText).optional(),
        style: textStyleSchema().optional(),
      })
      .optional(),
    tagline: z
      .object({
        show: z.boolean().optional(),
        text: plainText(TEXT_LIMITS.tagline).optional(),
        style: textStyleSchema().optional(),
      })
      .optional(),
    border: z
      .object({
        show: z.boolean().optional(),
        color: maybeColor('Border color'),
        thickness: numberField('Border thickness', RANGES.borderThickness).optional(),
      })
      .optional(),
  });

const contentSchema = (clientId) =>
  z.object({
    background: backgroundOrColor({
      clientId,
      types: CONTENT_BACKGROUND_TYPES,
      withPattern: true,
      label: 'Content',
    }).optional(),
    decoration: z.enum(CONTENT_DECORATIONS, 'Decoration is not supported.').optional(),
    decorationColor: maybeColor('Decoration color'),
    watermark: z
      .object({
        show: z.boolean().optional(),
        opacity: numberField('Watermark opacity', RANGES.watermarkOpacity, { integer: false }).optional(),
      })
      .optional(),
    headingColor: maybeColor('Heading color'),
    bodyColor: maybeColor('Body text color'),
    accentColor: maybeColor('Accent color'),
    headingFont: fontName('Heading font').optional(),
    bodyFont: fontName('Body font').optional(),
    infoCard: z
      .object({
        background: maybeColor('Info card background'),
        border: maybeColor('Info card border'),
        radius: numberField('Corner roundness', RANGES.cardRadius).optional(),
        iconColor: maybeColor('Icon color'),
      })
      .optional(),
    defaultImageUrl: brandImageUrl(clientId, 'Default photo').optional(),
  });

const footerSchema = (clientId) =>
  z.object({
    height: numberField('Bottom band height', RANGES.footerHeight).optional(),
    background: backgroundOrColor({
      clientId,
      types: BACKGROUND_TYPES,
      label: 'Bottom band',
    }).optional(),
    layout: z
      .number()
      .refine((value) => FOOTER_LAYOUTS.includes(value), 'Bottom band layout must be 1, 2 or 3 columns.')
      .optional(),
    address: plainText(TEXT_LIMITS.address).optional(),
    phone: plainText(TEXT_LIMITS.phone).optional(),
    email: plainText(TEXT_LIMITS.email)
      .refine(
        (value) => value === '' || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value),
        'Enter a valid email address.'
      )
      .optional(),
    website: plainText(TEXT_LIMITS.website).optional(),
    social: z
      .array(
        z.object({
          platform: z.enum(SOCIAL_PLATFORMS, 'That social network is not supported.'),
          url: httpsUrl('Social link', 300).refine((value) => value !== '', 'Add the link for this social profile.'),
        })
      )
      .max(MAX_SOCIAL_LINKS, `You can list at most ${MAX_SOCIAL_LINKS} social profiles.`)
      .optional(),
    contactText: plainText(TEXT_LIMITS.address).optional(),
    socials: z.array(plainText(120)).max(MAX_SOCIAL_LINKS, `You can list at most ${MAX_SOCIAL_LINKS} social profiles.`).optional(),
    legalText: plainText(TEXT_LIMITS.legalText).optional(),
    style: textStyleSchema().optional(),
    linkColor: maybeColor('Link color'),
    divider: z
      .object({
        show: z.boolean().optional(),
        color: maybeColor('Divider color'),
        thickness: numberField('Divider thickness', RANGES.dividerThickness).optional(),
      })
      .optional(),
  });

/**
 * Full-shape validation of a partial brand kit save. Built per request because the
 * image URLs are checked against the tenant's own Cloudinary folder.
 */
export function updateBrandKitSchema({ clientId } = {}) {
  const tenant = String(clientId || '');
  return z.object({
    orgName: plainText(TEXT_LIMITS.orgNameText)
      .refine((value) => value.length > 0, 'Organization name cannot be empty')
      .optional(),
    logos: z
      .array(
        z.object({
          url: z.string().url('Logo must be a valid URL'),
          label: plainText(60).optional(),
          isPrimary: z.boolean().optional(),
        })
      )
      .max(6, 'You can upload at most 6 logos.')
      .optional(),
    colors: z
      .object({
        primary: maybeColor('Primary color'),
        secondary: maybeColor('Secondary color'),
        accent: maybeColor('Accent color'),
        text: maybeColor('Text color'),
        background: maybeColor('Background color'),
      })
      .optional(),
    fonts: z
      .object({
        heading: fontName('Heading font').optional(),
        body: fontName('Body font').optional(),
      })
      .optional(),
    preset: z.enum(BRAND_PRESETS, 'That style preset is not supported.').optional(),
    textStyle: textStyleSchema().optional(),
    header: headerSchema(tenant).optional(),
    content: contentSchema(tenant).optional(),
    footer: footerSchema(tenant).optional(),
    defaultPosterSize: z
      .object({
        width: numberField('Poster width', { min: 200, max: 4000 }).optional(),
        height: numberField('Poster height', { min: 200, max: 4000 }).optional(),
      })
      .optional(),
  });
}

export const brandImageSignSchema = z.object({
  kind: z.enum(BRAND_IMAGE_KINDS, 'Choose which part of the brand this photo belongs to.'),
});

export function templatePageSchema(clientId) {
  const modeSchema = z.enum(['brand', 'custom']).default('brand');

  const contentBgSchema = backgroundOrColor({
    clientId,
    types: CONTENT_BACKGROUND_TYPES,
    withPattern: true,
    label: 'Content',
  });

  const pageBackground = z.preprocess(
    (val) => (typeof val === 'string' ? { mode: 'custom', color: val } : val || { mode: 'brand' }),
    z.object({
      mode: modeSchema.optional(),
    }).passthrough().transform((val, ctx) => {
      const mode = val.mode || 'brand';
      if (mode === 'custom') {
        const res = contentBgSchema.safeParse(val);
        if (!res.success) {
          for (const issue of res.error.issues) ctx.addIssue(issue);
          return val;
        }
        return { ...res.data, mode: 'custom' };
      }
      return { ...val, mode: 'brand' };
    })
  );

  const pageDecoration = z.preprocess(
    (val) => {
      if (!val || typeof val !== 'object') return { mode: 'brand' };
      const out = { ...val };
      if (out.type && !out.decoration) out.decoration = out.type;
      return out;
    },
    z.object({
      mode: modeSchema.optional(),
    }).passthrough().transform((val, ctx) => {
      const mode = val.mode || 'brand';
      if (mode === 'custom') {
        const out = { ...val, mode: 'custom' };
        if (val.decoration !== undefined) {
          const res = z.enum(CONTENT_DECORATIONS, 'Decoration is not supported.').safeParse(val.decoration);
          if (!res.success) {
            for (const issue of res.error.issues) ctx.addIssue(issue);
          } else {
            out.decoration = res.data;
          }
        }
        if (val.decorationColor !== undefined) {
          const res = maybeColor('Decoration color').safeParse(val.decorationColor);
          if (!res.success) {
            for (const issue of res.error.issues) ctx.addIssue(issue);
          } else {
            out.decorationColor = res.data;
          }
        }
        return out;
      }
      return { ...val, mode: 'brand' };
    })
  );

  const pageWatermark = z.preprocess(
    (val) => (val && typeof val === 'object' ? val : { mode: 'brand' }),
    z.object({
      mode: modeSchema.optional(),
    }).passthrough().transform((val, ctx) => {
      const mode = val.mode || 'brand';
      if (mode === 'custom') {
        const wmSchema = z.object({
          show: z.boolean().optional(),
          opacity: numberField('Watermark opacity', RANGES.watermarkOpacity, { integer: false }).optional(),
        });
        const res = wmSchema.safeParse(val);
        if (!res.success) {
          for (const issue of res.error.issues) ctx.addIssue(issue);
          return val;
        }
        return { ...res.data, mode: 'custom' };
      }
      return { ...val, mode: 'brand' };
    })
  );

  const pageInfoCard = z.preprocess(
    (val) => (val && typeof val === 'object' ? val : { mode: 'brand' }),
    z.object({
      mode: modeSchema.optional(),
    }).passthrough().transform((val, ctx) => {
      const mode = val.mode || 'brand';
      if (mode === 'custom') {
        const cardSchema = z.object({
          background: maybeColor('Info card background'),
          border: maybeColor('Info card border'),
          radius: numberField('Corner roundness', RANGES.cardRadius).optional(),
          iconColor: maybeColor('Icon color'),
        });
        const res = cardSchema.safeParse(val);
        if (!res.success) {
          for (const issue of res.error.issues) ctx.addIssue(issue);
          return val;
        }
        return { ...res.data, mode: 'custom' };
      }
      return { ...val, mode: 'brand' };
    })
  );

  return z.object({
    background: pageBackground.optional(),
    decoration: pageDecoration.optional(),
    watermark: pageWatermark.optional(),
    infoCard: pageInfoCard.optional(),
  });
}

