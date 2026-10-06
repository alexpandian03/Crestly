/**
 * WCAG contrast helpers for brand colour pickers and for the poster renderer.
 * Colours may be written as #rgb, #rrggbb or rgb()/rgba() — the same shapes the
 * brand kit stores.
 */

const HEX_SHORT = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*[, ]\s*([\d.]+%?)\s*(?:[,/]\s*([\d.]+%?)\s*)?\)$/i;

function channel(raw, scale) {
  if (raw === undefined || raw === null || raw === '') return scale;
  const text = String(raw).trim();
  if (text.endsWith('%')) return Math.round((parseFloat(text) / 100) * 255);
  return Math.round(Math.min(255, Math.max(0, parseFloat(text) || 0)));
}

/** Returns { r, g, b, a } or null when the value is not a usable colour. */
export function parseColor(value) {
  if (typeof value !== 'string') return null;
  const text = value.trim().toLowerCase();
  if (!text) return null;

  const short = HEX_SHORT.exec(text);
  if (short) {
    const [, r, g, b] = short;
    return { r: parseInt(r + r, 16), g: parseInt(g + g, 16), b: parseInt(b + b, 16), a: 1 };
  }

  const long = HEX_LONG.exec(text);
  if (long) {
    const [, r, g, b] = long;
    return { r: parseInt(r, 16), g: parseInt(g, 16), b: parseInt(b, 16), a: 1 };
  }

  const fn = RGB_FN.exec(text);
  if (fn) {
    const [, r, g, b, a] = fn;
    const alpha = a === undefined ? 1 : a.endsWith('%') ? parseFloat(a) / 100 : parseFloat(a);
    return { r: channel(r, 0), g: channel(g, 0), b: channel(b, 0), a: Math.min(1, Math.max(0, alpha || 0)) };
  }

  return null;
}

export function toHex(value, fallback = '') {
  const rgb = parseColor(value);
  if (!rgb) return fallback;
  const hex = (n) => n.toString(16).padStart(2, '0');
  return `#${hex(rgb.r)}${hex(rgb.g)}${hex(rgb.b)}`;
}

/** Paints `color` (which may be translucent) over an opaque `base`. */
export function blendOver(color, base) {
  const top = parseColor(color);
  if (!top) return base || '';
  if (top.a >= 1) return `rgb(${top.r}, ${top.g}, ${top.b})`;
  const bottom = parseColor(base) || { r: 255, g: 255, b: 255, a: 1 };
  const mix = (a, b) => Math.round(a * top.a + b * (1 - top.a));
  return `rgb(${mix(top.r, bottom.r)}, ${mix(top.g, bottom.g)}, ${mix(top.b, bottom.b)})`;
}

export function relativeLuminance(value) {
  const rgb = parseColor(value);
  if (!rgb) return null;
  const [r, g, b] = blendOver(value, '#ffffff')
    .match(/[\d.]+/g)
    .map((n) => {
      const c = Number(n) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1 (identical) to 21 (black on white). Returns null for unreadable input. */
export function contrastRatio(foreground, background) {
  const l1 = relativeLuminance(foreground);
  const l2 = relativeLuminance(background);
  if (l1 === null || l2 === null) return null;
  const light = Math.max(l1, l2);
  const dark = Math.min(l1, l2);
  return (light + 0.05) / (dark + 0.05);
}

/** 'AAA' | 'AA' | 'AA large' | 'Fail' */
export function wcagLevel(foreground, background, { large = false } = {}) {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) return 'Unknown';
  if (ratio >= 4.5 || (large && ratio >= 3)) {
    return ratio >= 7 ? 'AAA' : 'AA';
  }
  if (large) return 'AA large';
  return 'Fail';
}

export function contrastLabel(foreground, background, options) {
  const ratio = contrastRatio(foreground, background);
  if (ratio === null) return 'Contrast unknown';
  const level = wcagLevel(foreground, background, options);
  const text = ratio.toFixed(2);
  if (level === 'AAA') return `${text}:1 — very readable (AAA)`;
  if (level === 'AA') return `${text}:1 — readable (AA)`;
  if (level === 'AA large') return `${text}:1 — only large print (AA)`;
  return `${text}:1 — too low, hard to read`;
}

/**
 * First colour from `candidates` that reaches `min` against `background`,
 * falling back to whichever candidate has the best contrast. Returns null when
 * nothing can be measured.
 */
export function pickReadableColor(candidates, background, min = 3) {
  const usable = (Array.isArray(candidates) ? candidates : [candidates])
    .map((c) => (typeof c === 'string' ? c.trim() : ''))
    .filter(Boolean);
  if (usable.length === 0) return null;

  const scored = usable
    .map((color) => ({ color, ratio: contrastRatio(color, background) }))
    .filter((entry) => entry.ratio !== null);
  if (scored.length === 0) return null;

  const pass = scored.find((entry) => entry.ratio >= min);
  if (pass) return pass.color;
  return scored.slice().sort((a, b) => b.ratio - a.ratio)[0].color;
}
