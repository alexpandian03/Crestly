/**
 * Turns a brand kit into render values for <PosterCanvas>.
 *
 * One rule drives every branch: a control that is still at its shipped default
 * keeps the legacy rendering (the old palette, typography and decorations), so
 * brand kits created before the style blocks look exactly like they did before.
 * A control the brand actually set is honoured. On top of that, every colour is
 * checked against the surface it sits on (utils/contrast) so text can never
 * become invisible.
 *
 * The locked header and footer always draw: a design that declares no areas of its
 * own gets its bands from the brand kit, through the same shared rule that placed
 * its items, so the words always live in the strip between them.
 */
import { blendOver, parseColor, pickReadableColor } from './contrast.js';
import { resolveTemplateRender } from './templateRender.js';
import { contentArea, effectivePage } from '../../../shared/templateElements.js';

/** Mirrors BRAND_KIT_DEFAULTS in server/services/brand/style.js. */
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
      overlayOpacity: 0.4,
    },
    logo: { show: true, size: 56, position: 'left' },
    orgName: {
      show: true,
      text: '',
      style: { fontFamily: 'Outfit', size: 26, weight: 700, color: '#ffffff', uppercase: false, letterSpacing: 0 },
    },
    tagline: {
      show: false,
      text: '',
      style: { fontFamily: 'Inter', size: 14, weight: 400, color: '#e2e8f0', uppercase: false, letterSpacing: 1 },
    },
    border: { show: false, color: '#059669', thickness: 2 },
  },
  content: {
    background: {
      type: 'color',
      color: '#ffffff',
      gradientFrom: '#059669',
      gradientTo: '#0f172a',
      gradientAngle: 135,
      imageUrl: '',
      overlayColor: '#0b0f17',
      overlayOpacity: 0.4,
      position: 'center',
      pattern: 'none',
    },
    decoration: 'none',
    decorationColor: '#059669',
    watermark: { show: false, opacity: 0.08 },
    headingColor: '#0f172a',
    bodyColor: '#334155',
    accentColor: '#059669',
    headingFont: 'Outfit',
    bodyFont: 'Inter',
    infoCard: { background: '#f8fafc', border: '#e2e8f0', radius: 16, iconColor: '#059669' },
    defaultImageUrl: '',
  },
  footer: {
    height: 70,
    layout: 2,
    background: {
      type: 'color',
      color: 'rgba(11, 15, 23, 0.98)',
      gradientFrom: '#059669',
      gradientTo: '#0f172a',
      gradientAngle: 135,
      imageUrl: '',
      overlayColor: '#0b0f17',
      overlayOpacity: 0.4,
    },
    address: '',
    phone: '',
    email: '',
    website: '',
    social: [],
    legalText: '© All rights reserved.',
    style: { fontFamily: 'Inter', size: 13, weight: 400, color: '#e2e8f0', uppercase: false, letterSpacing: 0 },
    linkColor: '#10b981',
    divider: { show: false, color: '#1f2937', thickness: 1 },
  },
};

const LEGACY = {
  headerBg: 'rgba(15,23,42,0.95)',
  footerBg: 'rgba(11,15,23,0.98)',
  cardBg: 'rgba(255,255,255,0.04)',
  cardBorder: 'rgba(255,255,255,0.09)',
};

const BACKGROUND_TYPES = ['color', 'gradient', 'image', 'pattern'];
const POSITIONS = ['top', 'bottom', 'left', 'right', 'center'];
const WEIGHTS = [400, 500, 600, 700, 800, 900];

const isObj = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

function sameValue(stored, fallback) {
  if (stored === undefined || stored === null || stored === '') return true;
  if (isObj(stored) || isObj(fallback)) {
    return isObj(stored) && isObj(fallback) && Object.keys(fallback).every((key) => sameValue(stored[key], fallback[key]));
  }
  if (typeof stored === 'number' || typeof fallback === 'number') return Number(stored) === Number(fallback);
  if (typeof stored === 'boolean' || typeof fallback === 'boolean') return Boolean(stored) === Boolean(fallback);
  return String(stored).trim().toLowerCase().replace(/\s+/g, '') === String(fallback).trim().toLowerCase().replace(/\s+/g, '');
}

/** True when the stored value adds nothing over the shipped default. */
export function isAtDefault(stored, defaults) {
  return sameValue(stored, defaults);
}

function plain(value, max = 200) {
  return String(value ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, max);
}

function colorOr(value, fallback) {
  return parseColor(value) ? String(value).trim() : fallback;
}

/** rgba() of any supported colour string, multiplied by `opacity`. */
export function alpha(value, opacity) {
  const rgb = parseColor(value);
  if (!rgb) return value;
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${Math.min(1, Math.max(0, rgb.a * opacity))})`;
}

const numberOr = (value, fallback, min, max) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
};

export function normalizeBackground(input, fallbackColor) {
  const raw = typeof input === 'string' ? { type: 'color', color: input } : input;
  return {
    type: BACKGROUND_TYPES.includes(raw?.type) ? raw.type : 'color',
    color: colorOr(raw?.color, colorOr(fallbackColor, '#0b0f17')),
    gradientFrom: colorOr(raw?.gradientFrom, '#059669'),
    gradientTo: colorOr(raw?.gradientTo, '#0f172a'),
    gradientAngle: numberOr(raw?.gradientAngle, 135, 0, 360),
    imageUrl: plain(raw?.imageUrl, 500),
    overlayColor: colorOr(raw?.overlayColor, '#0b0f17'),
    overlayOpacity: numberOr(raw?.overlayOpacity, 0.4, 0, 1),
    /* Background photos always fill their area; only the focus is adjustable. */
    position: POSITIONS.includes(raw?.position) ? raw.position : 'center',
    pattern: ['dots', 'lines', 'grid'].includes(raw?.pattern) ? raw.pattern : 'none',
  };
}

export function gradientCss(bg) {
  return `linear-gradient(${bg.gradientAngle}deg, ${bg.gradientFrom} 0%, ${bg.gradientTo} 100%)`;
}

/** Opaque colour that best represents the plate the text sits on. */
export function surfaceOf(bg, base = '#0b0f17') {
  if (bg.type === 'gradient') {
    /* the middle of the ramp; the overlay is only painted for image plates */
    return blendOver(bg.gradientTo, bg.gradientFrom);
  }
  if (bg.type === 'image') {
    return blendOver(alpha(bg.overlayColor, bg.overlayOpacity), bg.imageUrl ? '#808080' : colorOr(bg.color, base));
  }
  return blendOver(bg.color, base);
}

/**
 * A pattern is a whisper behind the whole poster, never a fill inside a box: the
 * layer is painted edge to edge under every band and under the words, and its
 * strength is capped so it can never cross text.
 */
export const PATTERN_OPACITY_DEFAULT = 0.04;
export const PATTERN_OPACITY_MAX = 0.06;

/** CSS-only content patterns (dots / lines / grid). */
export function patternLayer(pattern, color, scale = 1, opacity = PATTERN_OPACITY_DEFAULT) {
  const strength = Math.min(PATTERN_OPACITY_MAX, Math.max(0, numberOr(opacity, PATTERN_OPACITY_DEFAULT, 0, 1)));
  const c = alpha(color, strength);
  const line = Math.max(1, Math.round(scale));
  if (pattern === 'dots') {
    const dot = Math.max(1, Math.round(2 * scale));
    const tile = Math.round(16 * scale);
    return {
      backgroundImage: `radial-gradient(${c} ${dot}px, transparent ${dot + 1}px)`,
      backgroundSize: `${tile}px ${tile}px`,
    };
  }
  if (pattern === 'lines') {
    const tile = Math.round(14 * scale);
    return { backgroundImage: `repeating-linear-gradient(0deg, ${c} 0 ${line}px, transparent ${line}px ${tile}px)` };
  }
  if (pattern === 'grid') {
    const tile = Math.round(18 * scale);
    return {
      backgroundImage: `repeating-linear-gradient(0deg, ${c} 0 ${line}px, transparent ${line}px ${tile}px), repeating-linear-gradient(90deg, ${c} 0 ${line}px, transparent ${line}px ${tile}px)`,
    };
  }
  return {};
}

function styleOf(style, defaults, { scale = 1, fontFamily = '' } = {}) {
  return {
    fontFamily,
    size: Math.round(numberOr(style?.size, defaults.size, 8, 200) * scale * 100) / 100,
    weight: WEIGHTS.includes(Number(style?.weight)) ? Number(style.weight) : defaults.weight,
    color: colorOr(style?.color, defaults.color),
    uppercase: style?.uppercase === undefined ? Boolean(defaults.uppercase) : Boolean(style.uppercase),
    letterSpacing: Math.round(numberOr(style?.letterSpacing, defaults.letterSpacing, 0, 12) * scale * 100) / 100,
  };
}

function readable(preferred, surface, candidates, min = 3) {
  return pickReadableColor([preferred, ...candidates].filter(Boolean), surface, min) || preferred;
}

export function resolvePosterBrand(brandKit, template) {
  const kit = isObj(brandKit) ? brandKit : {};
  const D = BRAND_RENDER_DEFAULTS;
  const rendered = resolveTemplateRender(template);
  const zones = Array.isArray(template?.zones) ? template.zones : [];
  const width = rendered.size.width;
  const height = rendered.size.height;

  const headerZone = zones.find((z) => z?.type === 'header');
  const footerZone = zones.find((z) => z?.type === 'footer');
  const contentZone = zones.find((z) => z?.type === 'content');

  /* An assistant design carries items but no areas of its own. Its bands still come from
   * the brand kit, through the very rule that laid those items out, so the two locked
   * bands always draw and the content area is exactly the strip between them. */
  const brandStrip = headerZone || footerZone ? null : contentArea(kit, { size: rendered.size });

  const primary = colorOr(kit?.colors?.primary, '#059669');
  const accent = colorOr(kit?.colors?.accent, '#10b981');
  const legacyText = colorOr(kit?.colors?.text, '#ffffff');
  const canvasColor = colorOr(kit?.colors?.background, '#0b0f17');
  const legacyHeadingFont = plain(kit?.fonts?.heading, 40) || 'Outfit';
  const legacyBodyFont = plain(kit?.fonts?.body, 40) || 'Inter';

  /* Brand pixel values are authored against the 1080 reference canvas. */
  const scale = Math.min(2, Math.max(0.7, width / 1080));
  const px = (n) => Math.round(n * scale);

  const globalFont = isAtDefault(kit.textStyle, D.textStyle) ? '' : plain(kit?.textStyle?.fontFamily, 40);

  /** stored value when the brand set it, legacy value when it is untouched. */
  const pick = (section, key, legacyValue) =>
    isAtDefault(kit?.[section]?.[key], D[section][key]) ? legacyValue : kit[section][key];
  const colorPick = (section, key, legacyValue) => colorOr(pick(section, key, legacyValue), legacyValue);
  const fontPick = (value, sectionDefault, legacyFont) => {
    const explicit = plain(value, 40);
    if (sameValue(explicit, sectionDefault)) return globalFont || legacyFont || sectionDefault;
    return explicit;
  };

  const logoUrl = plain(kit?.logos?.find((l) => l?.isPrimary)?.url || kit?.logos?.[0]?.url, 600);

  const page = effectivePage(kit, template);
  const customBg = template?.page?.background?.mode === 'custom';
  const customDec = template?.page?.decoration?.mode === 'custom';
  const customWatermark = template?.page?.watermark?.mode === 'custom';
  const customCard = template?.page?.infoCard?.mode === 'custom';

  // ---------- surfaces ----------
  const canvasBgUntouched = isAtDefault(kit?.background, D.background);
  const canvasBg = normalizeBackground(canvasBgUntouched ? canvasColor : kit.background, canvasColor);
  /** solid colour the whole canvas falls back to, from the brand's own background */
  const canvasPlate = canvasBgUntouched
    ? canvasColor
    : canvasBg.type === 'color'
      ? canvasBg.color
      : canvasColor;

  const contentBgUntouched = customBg ? false : isAtDefault(kit?.content?.background, D.content.background);
  const contentBg = customBg
    ? normalizeBackground(page.background, canvasPlate)
    : normalizeBackground(contentBgUntouched ? canvasPlate : kit.content.background, canvasPlate);
  const headerBg = normalizeBackground(pick('header', 'background', LEGACY.headerBg), LEGACY.headerBg);
  const footerBg = normalizeBackground(pick('footer', 'background', LEGACY.footerBg), LEGACY.footerBg);

  const contentSurface = surfaceOf(contentBg, canvasPlate);
  const headerSurface = surfaceOf(headerBg, canvasPlate);
  const footerSurface = surfaceOf(footerBg, canvasPlate);

  // ---------- content band ----------
  const headingColor = readable(colorPick('content', 'headingColor', legacyText), contentSurface, ['#ffffff', '#0b0f17']);
  const bodyColor = readable(
    colorPick('content', 'bodyColor', headingColor),
    contentSurface,
    [headingColor, legacyText, '#ffffff', '#0b0f17']
  );
  const accentColor = readable(colorPick('content', 'accentColor', accent), contentSurface, [accent, primary, '#ffffff', '#0b0f17'], 2);

  const cardDefaults = D.content.infoCard;
  const cardStyled = customCard ? true : !isAtDefault(kit?.content?.infoCard, cardDefaults);
  const cardBackground = customCard
    ? colorOr(page.infoCard?.background, cardDefaults.background)
    : cardStyled
      ? colorOr(kit?.content?.infoCard?.background, cardDefaults.background)
      : LEGACY.cardBg;
  const cardIconColor = customCard
    ? colorOr(page.infoCard?.iconColor, cardDefaults.iconColor)
    : cardStyled
      ? colorOr(kit?.content?.infoCard?.iconColor, cardDefaults.iconColor)
      : accentColor;
  const card = {
    styled: cardStyled,
    background: cardBackground,
    border: customCard
      ? colorOr(page.infoCard?.border, cardDefaults.border)
      : cardStyled
        ? colorOr(kit?.content?.infoCard?.border, cardDefaults.border)
        : LEGACY.cardBorder,
    radius: customCard
      ? numberOr(page.infoCard?.radius, cardDefaults.radius, 0, 32)
      : cardStyled
        ? numberOr(kit?.content?.infoCard?.radius, cardDefaults.radius, 0, 32)
        : null,
    iconColor: cardIconColor,
    iconBg: alpha(cardIconColor, 0.16),
    textColor: cardStyled
      ? readable(headingColor, blendOver(cardBackground, contentSurface), [bodyColor, '#ffffff', '#0b0f17'])
      : bodyColor,
  };

  const contentFonts = {
    heading: fontPick(kit?.content?.headingFont, 'Outfit', legacyHeadingFont),
    body: fontPick(kit?.content?.bodyFont, 'Inter', legacyBodyFont),
  };

  const watermark = {
    show: customWatermark
      ? Boolean(page.watermark?.show) && Boolean(logoUrl)
      : Boolean(kit?.content?.watermark?.show) && Boolean(logoUrl),
    opacity: customWatermark
      ? numberOr(page.watermark?.opacity, D.content.watermark.opacity, 0, 0.3)
      : numberOr(kit?.content?.watermark?.opacity, D.content.watermark.opacity, 0, 0.3),
    url: logoUrl,
  };

  /* The automatic accent shapes are the pre-style look; any styled content
   * block means the brand chose its own decoration. */
  const contentUntouched = isAtDefault(kit.content, D.content);
  const declaredContent = rendered.zones.content;
  const declaresContent = Boolean(contentZone);
  const patternSpansPoster = !contentBgUntouched && contentBg.type === 'pattern';
  const decoration = customDec
    ? page.decoration
    : contentUntouched
      ? 'legacy'
      : ['none', 'band', 'circle', 'corners'].includes(kit?.content?.decoration)
        ? kit.content.decoration
        : 'none';
  const decorationColor = customDec
    ? colorOr(page.decorationColor, accent)
    : colorPick('content', 'decorationColor', accent);

  const content = {
    /* A template's content rectangle is the text box; a design with no areas of its own
     * spans the whole poster between the bands, and only the old symmetric inset is used
     * for a legacy kit that declares neither. */
    x: declaresContent
      ? Math.max(0, Math.min(declaredContent.x, width - 120))
      : brandStrip
        ? 0
        : Math.round(Math.min(Math.max(contentZone?.x ?? width * 0.065, width * 0.03), width * 0.12)),
    declaredY: declaredContent.y,
    declaredBottom: declaredContent.y + declaredContent.h,
    declaredW: declaredContent.w,
    y: 0,
    w: width,
    h: height,
    /* The pattern is not a fill for this box: it is reported here and painted as one
     * edge-to-edge layer behind everything, so it never crosses an item or the text. */
    bg: { ...contentBg, pattern: 'none' },
    pattern: contentBgUntouched ? 'none' : contentBg.pattern,
    patternColor: decorationColor,
    bgUntouched: contentBgUntouched,
    /* A background photo is the poster's backdrop, so it is painted across the
     * whole canvas instead of only the inset area behind the text. A pattern's own
     * base colour does the same, so its lines never stop at the text box's edge. */
    bgFullBleed:
      patternSpansPoster ||
      (!contentBgUntouched && contentBg.type === 'image' && Boolean(contentBg.imageUrl)),
    surface: contentSurface,
    headingColor,
    bodyColor,
    accentColor,
    fonts: contentFonts,
    decoration,
    decorationColor,
    watermark,
    card,
    defaultImageUrl: plain(kit?.content?.defaultImageUrl, 600),
  };
  content.w = Math.max(120, Math.min(declaresContent ? content.declaredW : width - content.x * 2, width - content.x));

  // ---------- header band ----------
  const headerStyleOf = (block, defaults, legacyFont) =>
    styleOf(block, defaults, { scale, fontFamily: fontPick(block?.fontFamily, defaults.fontFamily, legacyFont) });

  const orgNameDefaults = D.header.orgName.style;
  const orgNameStyle = headerStyleOf(kit?.header?.orgName?.style, orgNameDefaults, legacyHeadingFont);
  const orgNameColor = readable(
    isAtDefault(kit?.header?.orgName?.style?.color, orgNameDefaults.color) ? legacyText : colorOr(kit?.header?.orgName?.style?.color, orgNameDefaults.color),
    headerSurface,
    ['#ffffff', '#0b0f17']
  );
  const taglineDefaults = D.header.tagline.style;
  const taglineStyle = headerStyleOf(kit?.header?.tagline?.style, taglineDefaults, legacyHeadingFont);
  const taglineColor = readable(
    colorOr(kit?.header?.tagline?.style?.color, taglineDefaults.color),
    headerSurface,
    [orgNameColor, '#ffffff', '#0b0f17'],
    2.2
  );

  const borderUntouched = isAtDefault(kit?.header?.border, D.header.border);
  const headerHeight = isAtDefault(kit?.header?.height, D.header.height) ? null : numberOr(kit.header.height, null, 1, 400);
  const headerH = Math.round(
    brandStrip
      ? brandStrip.y
      : Math.min(height * 0.4, Math.max(48, headerHeight ? px(headerHeight) : headerZone?.h ?? 140))
  );
  const logoBlock = isAtDefault(kit?.header?.logo, D.header.logo) ? null : kit.header.logo;
  const logoPositionValue = ['left', 'right', 'top', 'bottom'].includes(logoBlock?.position) ? logoBlock.position : D.header.logo.position;
  const taglineShown = Boolean(kit?.header?.tagline?.show) && Boolean(plain(kit?.header?.tagline?.text, 80));
  const hairline = borderUntouched ? Math.max(1, px(2)) : Math.max(0, px(numberOr(kit?.header?.border?.thickness, 2, 0, 8)));
  const logoBaseSize = px(numberOr(logoBlock?.size, D.header.logo.size, 24, 160));
  const headerGap = px(16);
  const taglineGap = Math.max(2, Math.round(orgNameStyle.size * 0.22));
  /* BrandText renders at lineHeight 1.18, so the band budget is in line boxes. */
  const headerTextBoxes =
    Math.round(orgNameStyle.size * 1.18) +
    (taglineShown ? Math.round(taglineStyle.size * 1.18) + taglineGap : 0);
  /* The logo never pushes the band's own text out of the band. */
  const logoHeight =
    logoPositionValue === 'top' || logoPositionValue === 'bottom'
      ? Math.max(16, Math.min(logoBaseSize, headerH - hairline - headerTextBoxes - headerGap - px(4)))
      : Math.max(16, Math.min(logoBaseSize, headerH - hairline - px(6)));

  const header = {
    present: Boolean(headerZone) || Boolean(brandStrip),
    top: Math.max(0, headerZone?.y ?? 0),
    left: headerZone?.x ?? 0,
    width: headerZone?.w ?? width,
    height: headerH,
    bg: headerBg,
    surface: headerSurface,
    alignment: ['left', 'center', 'right'].includes(kit?.header?.alignment) ? kit.header.alignment : D.header.alignment,
    logo: {
      show: Boolean(logoBlock ? logoBlock.show : (kit?.header?.showLogo ?? true)) && Boolean(logoUrl),
      size: logoBaseSize,
      pxHeight: logoHeight,
      position: logoPositionValue,
      url: logoUrl,
    },
    orgName: {
      show: Boolean(kit?.header?.orgName?.show ?? kit?.header?.showOrgName ?? true),
      text: plain(kit?.header?.orgName?.text, 100) || plain(kit.orgName, 100) || 'Brand Organization',
      style: { ...orgNameStyle, color: orgNameColor },
    },
    tagline: {
      show: taglineShown,
      text: plain(kit?.header?.tagline?.text, 80),
      style: { ...taglineStyle, color: taglineColor },
    },
    border: {
      show: borderUntouched ? true : Boolean(kit?.header?.border?.show),
      color: borderUntouched ? alpha(primary, 0.25) : colorOr(kit?.header?.border?.color, primary),
      thickness: hairline,
    },
    padX: px(36),
    gap: headerGap,
  };

  // ---------- footer band ----------
  const dividerUntouched = isAtDefault(kit?.footer?.divider, D.footer.divider);
  const footerStyleDefaults = D.footer.style;
  const footerStyleRaw = styleOf(kit?.footer?.style, footerStyleDefaults, {
    scale,
    fontFamily: fontPick(kit?.footer?.style?.fontFamily, footerStyleDefaults.fontFamily, legacyBodyFont),
  });
  const footerTextColor = readable(
    isAtDefault(kit?.footer?.style?.color, footerStyleDefaults.color) ? legacyText : colorOr(kit?.footer?.style?.color, footerStyleDefaults.color),
    footerSurface,
    ['#ffffff', '#0b0f17']
  );
  const linkColor = readable(colorPick('footer', 'linkColor', accent), footerSurface, [accent, footerTextColor, '#ffffff'], 2);

  const footerHeight = isAtDefault(kit?.footer?.height, D.footer.height) ? null : numberOr(kit.footer.height, null, 1, 400);
  const footerZoneH = footerZone?.h ?? 130;
  const footerBottom = Math.min(height, (footerZone?.y ?? height - footerZoneH) + footerZoneH);
  const wantedFooterH = brandStrip
    ? Math.max(0, height - brandStrip.y - brandStrip.h)
    : Math.min(height * 0.4, Math.max(48, footerHeight ? px(footerHeight) : footerZoneH));
  const footerTop = Math.max(header.top + headerH, footerBottom - wantedFooterH);

  const footerLayout = Number(pick('footer', 'layout', 2));
  const footer = {
    present: Boolean(footerZone) || Boolean(brandStrip),
    top: footerTop,
    bottom: footerBottom,
    left: footerZone?.x ?? 0,
    width: footerZone?.w ?? width,
    height: brandStrip ? Math.max(0, footerBottom - footerTop) : Math.max(48, footerBottom - footerTop),
    bg: footerBg,
    surface: footerSurface,
    layout: [1, 2, 3].includes(footerLayout) ? footerLayout : 2,
    style: { ...footerStyleRaw, color: footerTextColor },
    linkColor,
    divider: {
      show: dividerUntouched ? true : Boolean(kit?.footer?.divider?.show),
      color: dividerUntouched ? alpha(primary, 0.19) : colorOr(kit?.footer?.divider?.color, D.footer.divider.color),
      thickness: dividerUntouched ? Math.max(1, px(2)) : Math.max(0, px(numberOr(kit?.footer?.divider?.thickness, 1, 0, 8))),
    },
    address: plain(kit?.footer?.address, 120),
    phone: plain(kit?.footer?.phone, 40),
    email: plain(kit?.footer?.email, 120),
    website: plain(kit?.footer?.website, 120),
    social: (Array.isArray(kit?.footer?.social) ? kit.footer.social : [])
      .map((s) => ({ platform: plain(s?.platform, 20).toLowerCase(), url: plain(s?.url, 300) }))
      .filter((s) => s.platform && s.url)
      .slice(0, 6),
    legalText: plain(kit?.footer?.legalText, 160),
    legacyContact: plain(kit?.footer?.contactText, 200),
    legacySocials: (Array.isArray(kit?.footer?.socials) ? kit.footer.socials : []).map((s) => plain(s, 60)).filter(Boolean),
    padX: px(36),
    gap: px(16),
  };
  /* A kit that only ever filled the pre-style contact fields keeps the old
   * single-line footer. */
  footer.legacyPresentation =
    footer.social.length === 0 &&
    !footer.address &&
    !footer.phone &&
    !footer.email &&
    Boolean(footer.legacyContact || footer.legacySocials.length);

  // ---------- content area between the bands ----------
  const bandTop = header.top + header.height;
  const bandBottom = footer.present ? footer.top : height;
  content.y = Math.min(Math.max(bandTop, declaresContent ? content.declaredY : bandTop), Math.max(0, height - 80));
  const declaredBottom = declaresContent ? content.declaredBottom : bandBottom;
  content.h = Math.max(80, Math.min(bandBottom, declaredBottom) - content.y);
  content.gapTop = Math.max(0, bandTop - (declaresContent ? content.declaredY : bandTop));

  const fonts = [
    contentFonts.heading,
    contentFonts.body,
    header.orgName.style.fontFamily,
    header.tagline.style.fontFamily,
    footer.style.fontFamily,
  ].filter(Boolean);

  const canvasColorFinal =
    !contentBgUntouched && (contentBg.type === 'color' || contentBg.type === 'pattern')
      ? contentBg.color
      : canvasPlate;

  return {
    scale,
    canvas: {
      color: canvasColorFinal,
      bg: canvasBg,
      bgUntouched: canvasBgUntouched,
      textColor: bodyColor,
    },
    fonts: [...new Set(fonts)],
    header,
    content,
    footer,
    primary,
    accent,
  };
}

/** Base fill the exporters use so JPG/PDF match the canvas. */
export function canvasBaseColor(brandKit, template) {
  return resolvePosterBrand(brandKit, template || { size: { width: 1080, height: 1350 }, zones: [] }).canvas.color;
}
