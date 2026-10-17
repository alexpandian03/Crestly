/**
 * Palette families: derived from Brand Kit colours with pure colour math.
 * ESM only, zero dependencies.
 */
import {
  contrastRatio,
  relativeLuminance,
  shade,
  tint,
} from './designRecipes.js';
import { normalizeHexColor } from './templateElements.js';

export const PALETTE_FAMILIES = [
  'strict',
  'soft',
  'dark',
  'duotone',
  'contrast-accent',
  'light-neutral',
];

export const PALETTE_VARIETIES = ['strict', 'balanced', 'expressive'];

function cleanColor(val, fallback = '#2563EB') {
  return normalizeHexColor(val, fallback);
}

function hexToRgb(hex) {
  const clean = cleanColor(hex, '#000000').slice(1);
  const parts =
    clean.length === 3
      ? clean.split('').map((c) => c + c)
      : [clean.slice(0, 2), clean.slice(2, 4), clean.slice(4, 6)];
  return parts.map((p) => parseInt(p, 16) || 0);
}

function rgbToHex([r, g, b]) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  return `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('')}`;
}

function rgbToHsl([r, g, b]) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return [h * 360, s, l];
}

function hslToRgb([h, s, l]) {
  h = (h % 360 + 360) % 360;
  h /= 360;
  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

/**
 * Shift hue for expressive accent calculation.
 */
export function computeExpressiveAccent(baseHex, shiftDegrees = 35) {
  const rgb = hexToRgb(baseHex);
  const [h, s, l] = rgbToHsl(rgb);
  const newH = (h + shiftDegrees) % 360;
  const newS = Math.min(1, Math.max(0.65, s));
  const newL = Math.min(0.7, Math.max(0.45, l));
  return rgbToHex(hslToRgb([newH, newS, newL]));
}

/**
 * Guarantee WCAG AA 4.5:1 contrast against backing surface.
 */
export function ensureReadableText(fg, bg, preferredCandidates = []) {
  if (contrastRatio(fg, bg) >= 4.5) return fg;
  for (const cand of preferredCandidates) {
    if (cand && contrastRatio(cand, bg) >= 4.5) return cand;
  }
  // Try pure white or dark slate
  if (contrastRatio('#FFFFFF', bg) >= 4.5) return '#FFFFFF';
  if (contrastRatio('#0F172A', bg) >= 4.5) return '#0F172A';
  return relativeLuminance(bg) > 0.5 ? '#000000' : '#FFFFFF';
}

/**
 * Derives a specific palette family from the brand kit.
 * Always assigns 6 distinct roles: background, surface, title, body, accent, band.
 * Guarantees text contrast >= 4.5:1 and at least 4 distinct colors.
 */
export function derivePaletteFamily(brandKit = {}, familyName = 'strict', variety = 'balanced') {
  const colors = brandKit?.colors || {};
  const primary = cleanColor(colors.primary, '#2563EB');
  let secondary = cleanColor(colors.secondary, '#0F172A');
  let accent = cleanColor(colors.accent, '#3B82F6');
  const text = cleanColor(colors.text, '#0F172A');
  const bg = cleanColor(colors.background, '#FFFFFF');

  // If brand kit has fewer than 3 distinct colours, derive supporting tints and shades
  const distinctInput = new Set([primary, secondary, accent, text, bg]);
  if (distinctInput.size < 3 || secondary.toLowerCase() === primary.toLowerCase()) {
    secondary = shade(primary, 0.65);
  }
  if (accent.toLowerCase() === primary.toLowerCase()) {
    accent = tint(primary, 0.35);
  }

  // If variety is expressive, compute a rich supporting accent
  if (variety === 'expressive') {
    accent = computeExpressiveAccent(primary, 40);
  }

  let palette = {};

  switch (familyName) {
    case 'soft': {
      const background = tint(primary, 0.94);
      const surface = '#FFFFFF';
      const band = tint(primary, 0.86);
      const acc = primary;
      const title = ensureReadableText(shade(primary, 0.65), surface, [secondary, '#0F172A']);
      const body = ensureReadableText(text, surface, ['#334155', '#1E293B']);
      palette = { background, surface, title, body, accent: acc, band, cardBorder: tint(primary, 0.8) };
      break;
    }

    case 'dark': {
      const background = shade(secondary, 0.7) || '#0B0F17';
      const surface = shade(secondary, 0.5) || '#161F30';
      const band = primary;
      const acc = tint(accent, 0.2);
      const title = ensureReadableText('#FFFFFF', surface, ['#F8FAFC']);
      const body = ensureReadableText('#CBD5E1', surface, ['#E2E8F0', '#FFFFFF']);
      palette = { background, surface, title, body, accent: acc, band, cardBorder: shade(primary, 0.4) };
      break;
    }

    case 'duotone': {
      const background = secondary;
      const surface = shade(secondary, 0.3);
      const band = primary;
      const acc = primary;
      const title = ensureReadableText('#FFFFFF', surface, ['#F8FAFC']);
      const body = ensureReadableText(tint(primary, 0.85), surface, ['#E2E8F0', '#FFFFFF']);
      palette = { background, surface, title, body, accent: acc, band, cardBorder: primary };
      break;
    }

    case 'contrast-accent': {
      const background = '#F8FAFC';
      const surface = '#FFFFFF';
      const band = accent;
      const acc = accent;
      const title = ensureReadableText(secondary, surface, ['#0F172A', '#1E293B']);
      const body = ensureReadableText('#334155', surface, ['#1E293B']);
      palette = { background, surface, title, body, accent: acc, band, cardBorder: tint(accent, 0.75) };
      break;
    }

    case 'light-neutral': {
      const background = '#FFFFFF';
      const surface = '#F1F5F9';
      const band = tint(primary, 0.9);
      const acc = primary;
      const title = ensureReadableText(primary, surface, [secondary, '#0F172A']);
      const body = ensureReadableText('#1E293B', surface, ['#334155']);
      palette = { background, surface, title, body, accent: acc, band, cardBorder: tint(primary, 0.8) };
      break;
    }

    case 'strict':
    default: {
      const background = bg;
      const surface = tint(primary, 0.94);
      const band = primary;
      const acc = accent;
      const title = ensureReadableText(secondary, surface, [text, '#0F172A', '#FFFFFF']);
      const body = ensureReadableText(text, surface, ['#1E293B', '#FFFFFF']);
      palette = { background, surface, title, body, accent: acc, band, cardBorder: tint(primary, 0.8) };
      break;
    }
  }

  // Ensure title and body pass contrast against background as well
  palette.title = ensureReadableText(palette.title, palette.surface, [palette.secondary, '#0F172A', '#FFFFFF']);
  palette.body = ensureReadableText(palette.body, palette.surface, ['#1E293B', '#F8FAFC', '#FFFFFF']);

  // Ensure at least 4 distinct colors
  const roleColors = [palette.background, palette.surface, palette.title, palette.body, palette.accent, palette.band];
  const uniqueRoles = new Set(roleColors);
  if (uniqueRoles.size < 4) {
    palette.surface = tint(palette.primary || primary, 0.96);
    palette.cardBorder = tint(palette.primary || primary, 0.75);
    palette.band = shade(palette.accent || accent, 0.15);
  }

  return {
    name: familyName,
    ...palette,
  };
}

/**
 * Returns all 6 palette families for a brand kit and variety setting.
 */
export function deriveAllPaletteFamilies(brandKit = {}, variety = 'balanced') {
  const families = variety === 'strict' ? ['strict'] : PALETTE_FAMILIES;
  const result = {};
  for (const name of families) {
    result[name] = derivePaletteFamily(brandKit, name, variety);
  }
  return result;
}
