/**
 * Turns a brand kit into render values for <PosterCanvas>.
 *
 * Locked header and footer bands stay fixed from the organization's Brand Kit.
 * The content area fills the strip between the two locked bands.
 */
import { effectivePage, templateSizeOf } from '../../../shared/templateElements.js';

export const BRAND_RENDER_DEFAULTS = {
  preset: 'custom',
  textStyle: { fontFamily: 'Outfit', size: 24, weight: 600, color: '#0f172a', uppercase: false, letterSpacing: 0 },
  background: {
    type: 'color',
    color: '#ffffff',
    gradientFrom: '#059669',
    gradientTo: '#0f172a',
    gradientAngle: 135,
    imageUrl: '',
    overlayColor: '#0b0f17',
    overlayOpacity: 0.4,
  },
  header: {
    height: 80,
    alignment: 'left',
    background: {
      type: 'color',
      color: 'rgba(15, 23, 42, 0.95)',
      gradientFrom: '#059669',
      gradientTo: '#0f172a',
      gradientAngle: 135,
      imageUrl: '',
      overlayColor: '#0b0f17',
      overlayOpacity: 0.5,
    },
    border: { show: false, color: '#e2e8f0', thickness: 1 },
    logo: { show: true, position: 'left', size: 48 },
    orgName: { show: true, style: { fontFamily: 'Outfit', size: 28, weight: 700, color: '#ffffff', uppercase: false, letterSpacing: 0 } },
    tagline: { show: false, style: { fontFamily: 'Inter', size: 14, weight: 400, color: '#cbd5e1', uppercase: false, letterSpacing: 0 } },
  },
  footer: {
    height: 70,
    background: {
      type: 'color',
      color: 'rgba(15, 23, 42, 0.95)',
      gradientFrom: '#059669',
      gradientTo: '#0f172a',
      gradientAngle: 135,
      imageUrl: '',
      overlayColor: '#0b0f17',
      overlayOpacity: 0.5,
    },
    layout: 2,
    style: { fontFamily: 'Inter', size: 20, weight: 400, color: '#ffffff', uppercase: false, letterSpacing: 0 },
    divider: { show: true, color: '#334155', thickness: 1 },
  },
};

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const plain = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const colorOr = (v, fallback) => (typeof v === 'string' && /^#|^rgba?\(/.test(v.trim()) ? v.trim() : fallback);

export function isAtDefault(stored, defaults) {
  if (stored === undefined || stored === null) return true;
  if (!isObj(stored) || !isObj(defaults)) return stored === defaults;
  return Object.keys(defaults).every((key) => isAtDefault(stored[key], defaults[key]));
}

export function alpha(value, opacity) {
  const o = Math.min(1, Math.max(0, Number(opacity) || 0));
  if (typeof value !== 'string') return `rgba(15, 23, 42, ${o})`;
  const v = value.trim();
  if (v.startsWith('#')) {
    const hex = v.slice(1);
    const r = parseInt(hex.length === 3 ? hex[0] + hex[0] : hex.slice(0, 2), 16) || 0;
    const g = parseInt(hex.length === 3 ? hex[1] + hex[1] : hex.slice(2, 4), 16) || 0;
    const b = parseInt(hex.length === 3 ? hex[2] + hex[2] : hex.slice(4, 6), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${o})`;
  }
  return v;
}

export function normalizeBackground(input, fallbackColor) {
  const bg = isObj(input) ? input : {};
  const type = ['color', 'gradient', 'image'].includes(bg.type) ? bg.type : 'color';
  return {
    type,
    color: colorOr(bg.color, fallbackColor),
    gradientFrom: colorOr(bg.gradientFrom, '#059669'),
    gradientTo: colorOr(bg.gradientTo, '#0f172a'),
    gradientAngle: Number.isFinite(bg.gradientAngle) ? bg.gradientAngle : 135,
    imageUrl: plain(bg.imageUrl, 800),
    overlayOpacity: Number.isFinite(bg.overlayOpacity) ? bg.overlayOpacity : 0.4,
  };
}

export function gradientCss(bg) {
  return `linear-gradient(${bg.gradientAngle || 135}deg, ${bg.gradientFrom || '#059669'}, ${bg.gradientTo || '#0f172a'})`;
}

export function surfaceOf(bg, base = '#0b0f17') {
  if (!bg) return base;
  if (bg.type === 'color') return colorOr(bg.color, base);
  if (bg.type === 'gradient') return colorOr(bg.gradientFrom, base);
  return base;
}

export const PATTERN_OPACITY_DEFAULT = 0.04;
export const PATTERN_OPACITY_MAX = 0.06;

export function patternLayer(_pattern, _color, _scale = 1, _opacity = PATTERN_OPACITY_DEFAULT) {
  return null;
}

export function transformCloudinaryUrl(url, { w = 0, h = 0 } = {}) {
  if (typeof url !== 'string' || !url.includes('res.cloudinary.com')) return url;
  if (!w && !h) return url;
  const parts = [];
  if (w > 0) parts.push(`w_${Math.round(w)}`);
  if (h > 0) parts.push(`h_${Math.round(h)}`);
  parts.push('c_limit');
  return url.replace('/upload/', `/upload/${parts.join(',')}/`);
}

export function resolvePosterBrand(brandKit, template) {
  const kit = isObj(brandKit) ? brandKit : {};
  const size = templateSizeOf(template);
  const width = size.width;
  const height = size.height;

  const primary = colorOr(kit?.colors?.primary, '#059669');
  const accent = colorOr(kit?.colors?.accent, '#10b981');
  const canvasColor = colorOr(kit?.colors?.background, '#ffffff');

  const scale = Math.min(2, Math.max(0.7, width / 1080));
  const px = (n) => Math.round(n * scale);

  const logoUrl = plain(kit?.logos?.find((l) => l?.isPrimary)?.url || kit?.logos?.[0]?.url, 600);
  const page = effectivePage(kit, template);

  const headerH = kit?.header?.height ? px(kit.header.height) : px(140);
  const footerH = kit?.footer?.height ? px(kit.footer.height) : px(130);

  const headerBg = normalizeBackground(kit?.header?.background, '#0f172a');
  const footerBg = normalizeBackground(kit?.footer?.background, '#0b0f17');

  const header = {
    present: true,
    top: 0,
    left: 0,
    width,
    height: headerH,
    bg: headerBg,
    alignment: kit?.header?.alignment || 'left',
    logo: {
      show: kit?.header?.showLogo !== false && (kit?.header?.logo?.show !== false) && Boolean(logoUrl),
      url: logoUrl,
      position: kit?.header?.logo?.position || 'left',
      pxHeight: px(kit?.header?.logo?.size || 48),
    },
    orgName: {
      show: kit?.header?.showOrgName !== false && (kit?.header?.orgName?.show !== false),
      text: kit?.header?.orgName?.text || kit?.orgName || '',
      style: {
        fontFamily: kit?.fonts?.heading || 'Outfit',
        size: px(kit?.header?.orgName?.style?.size || 28),
        weight: kit?.header?.orgName?.style?.weight || 700,
        color: kit?.header?.orgName?.style?.color || '#ffffff',
      },
    },
    tagline: {
      show: Boolean(kit?.header?.tagline?.show && (kit?.header?.tagline?.text || kit?.tagline)),
      text: kit?.header?.tagline?.text || kit?.tagline || '',
      style: {
        fontFamily: kit?.fonts?.body || 'Inter',
        size: px(kit?.header?.tagline?.style?.size || 14),
        weight: kit?.header?.tagline?.style?.weight || 400,
        color: kit?.header?.tagline?.style?.color || '#cbd5e1',
      },
    },
    border: {
      show: Boolean(kit?.header?.border?.show),
      color: kit?.header?.border?.color || '#e2e8f0',
      thickness: px(kit?.header?.border?.thickness || 1),
    },
    padX: px(36),
    gap: px(16),
  };

  const footer = {
    present: true,
    top: Math.max(0, height - footerH),
    bottom: height,
    left: 0,
    width,
    height: footerH,
    bg: footerBg,
    layout: kit?.footer?.layout || 2,
    style: {
      fontFamily: kit?.fonts?.body || 'Inter',
      size: px(kit?.footer?.style?.size || 20),
      color: kit?.footer?.style?.color || '#ffffff',
    },
    linkColor: primary,
    divider: {
      show: kit?.footer?.divider?.show !== false,
      color: kit?.footer?.divider?.color || '#334155',
      thickness: px(kit?.footer?.divider?.thickness || 1),
    },
    address: plain(kit?.footer?.address, 120),
    phone: plain(kit?.footer?.phone, 40),
    email: plain(kit?.footer?.email, 120),
    website: plain(kit?.footer?.website, 120),
    social: Array.isArray(kit?.footer?.social)
      ? kit.footer.social.map((s) => ({ platform: plain(s?.platform, 20), url: plain(s?.url, 200) })).filter((s) => s.platform && s.url)
      : [],
    legalText: plain(kit?.footer?.legalText, 160),
    padX: px(36),
    gap: px(16),
  };

  const contentY = header.height;
  const contentH = Math.max(100, footer.top - contentY);

  const content = {
    x: 0,
    y: contentY,
    w: width,
    h: contentH,
    watermark: {
      show: Boolean(page?.watermark?.show && page?.watermark?.url),
      url: page?.watermark?.url || '',
      opacity: page?.watermark?.opacity || 0.08,
    },
    decorationColor: accent,
  };

  return {
    scale,
    canvas: {
      color: canvasColor,
      bg: { type: 'color', color: canvasColor },
      textColor: kit?.colors?.text || '#111827',
    },
    fonts: [kit?.fonts?.heading || 'Outfit', kit?.fonts?.body || 'Inter'],
    header,
    content,
    footer,
    primary,
    accent,
  };
}

export function canvasBaseColor(brandKit, template) {
  return resolvePosterBrand(brandKit, template).canvas.color;
}
