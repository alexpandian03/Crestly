/**
 * /shared/textFit.js
 *
 * Pure, deterministic text fitting and line-wrapping engine without a browser.
 * Calculates exact font character-width ratios per brand font family and Tamil fonts.
 *
 * Rules:
 *  1. Average character-width ratios per font family.
 *  2. Never break a word (a long word shrinks the font size so it fits).
 *  3. Tamil text forces line height 1.4 and uses Tamil font advance metrics.
 *  4. Shrink to fit down to 20 px on a 1080 px poster.
 *  5. Headlines never exceed 2 lines.
 *  6. If text overflows at minimum size (20 px), drop the lowest-priority lines.
 *     Priority order (highest to lowest):
 *       headline > date > time > venue > subtitle > bullets > call to action > slogan
 *  7. Pure and deterministic: same input produces identical output.
 */

import { hasTamil, tamilAdvanceRatio, TAMIL_LINE_HEIGHT } from './textScripts.js';

/**
 * Average character-width ratios (ratio of advance width to font size) for Latin glyphs.
 */
export const FONT_CHAR_WIDTH_RATIOS = {
  Outfit: 0.56,
  Inter: 0.54,
  Montserrat: 0.60,
  Poppins: 0.58,
  'Playfair Display': 0.52,
  'Plus Jakarta Sans': 0.56,
  Cinzel: 0.65,
  Roboto: 0.53,
  'Open Sans': 0.55,
  Lato: 0.53,
  'DM Sans': 0.55,
  Nunito: 0.56,

  // Tamil font families
  'Noto Sans Tamil': 0.68,
  'Noto Serif Tamil': 0.65,
  'Hind Madurai': 0.63,
  'Mukta Malar': 0.64,
  Catamaran: 0.58,
  'Baloo Thambi 2': 0.66,

  // Brand token aliases
  'brand:heading': 0.58,
  'brand:body': 0.54,
  'brand:primary': 0.56,
  'brand:secondary': 0.54,
  'brand:text': 0.54,

  default: 0.55,
};

/**
 * Priority order for poster content fields (higher number = higher priority).
 * Lowest priority is dropped first when overflowing:
 * slogan (1) -> cta (2) -> bullets (3) -> subtitle (4) -> venue (5) -> time (6) -> date (7) -> headline (8)
 */
export const FIELD_PRIORITY = {
  headline: 8,
  title: 8,
  heading: 8,
  date: 7,
  time: 6,
  venue: 5,
  location: 5,
  subtitle: 4,
  tagline: 4,
  bullets: 3,
  details: 3,
  'call to action': 2,
  cta: 2,
  button: 2,
  slogan: 1,
  default: 3,
};

export const PRIORITY_ORDER = [
  'headline',
  'date',
  'time',
  'venue',
  'subtitle',
  'bullets',
  'call to action',
  'slogan',
];

/**
 * Resolves priority score for a field/role name.
 */
export function getPriority(role) {
  if (!role) return FIELD_PRIORITY.default;
  const key = String(role).toLowerCase().trim();
  if (FIELD_PRIORITY[key] !== undefined) return FIELD_PRIORITY[key];
  const found = Object.keys(FIELD_PRIORITY).find((k) => key.includes(k) || k.includes(key));
  return found ? FIELD_PRIORITY[found] : FIELD_PRIORITY.default;
}

/**
 * Resolves the character width ratio for a font family and text.
 */
export function getFontRatio(font, text = '') {
  const isTamilText = hasTamil(String(text || ''));
  const fontName = String(font || '').trim();

  let ratio = FONT_CHAR_WIDTH_RATIOS[fontName];
  if (!ratio) {
    const key = Object.keys(FONT_CHAR_WIDTH_RATIOS).find(
      (k) => k.toLowerCase() === fontName.toLowerCase()
    );
    ratio = key ? FONT_CHAR_WIDTH_RATIOS[key] : FONT_CHAR_WIDTH_RATIOS.default;
  }

  // If text contains Tamil, use Noto Sans Tamil ratio if font is not a Tamil family
  if (isTamilText) {
    const isTamilFont = [
      'Noto Sans Tamil',
      'Noto Serif Tamil',
      'Hind Madurai',
      'Mukta Malar',
      'Catamaran',
      'Baloo Thambi 2',
    ].some((tf) => tf.toLowerCase() === fontName.toLowerCase());

    if (!isTamilFont) {
      ratio = FONT_CHAR_WIDTH_RATIOS['Noto Sans Tamil'];
    }
    const advance = tamilAdvanceRatio(text);
    ratio *= advance;
  }

  return ratio;
}

/**
 * Measures character width in pixels for a given font setting.
 */
export function charWidthFor(fontSize, font, text = '', options = {}) {
  const baseRatio = getFontRatio(font, text);
  const weight = Number(options.weight) || 400;
  const weightFactor = weight >= 700 ? 1.05 : 1;
  const uppercaseFactor = options.uppercase ? 1.1 : 1;
  const letterSpacing = Math.max(0, Number(options.letterSpacing) || 0);

  return fontSize * baseRatio * weightFactor * uppercaseFactor + letterSpacing;
}

/**
 * Wraps text into lines on word boundaries without ever breaking a word.
 * Returns array of line strings.
 */
export function wrapWords(text, fontSize, font, boxWidth, options = {}) {
  const w = Math.max(10, boxWidth);

  if (typeof text === 'string' && text.includes('\n')) {
    const rawLines = text.split('\n');
    const result = [];
    for (const rLine of rawLines) {
      const trimmed = rLine.trim();
      if (!trimmed) continue;
      const wrapped = wrapWords(trimmed, fontSize, font, boxWidth, options);
      result.push(...wrapped);
    }
    return result;
  }

  const charWidth = charWidthFor(fontSize, font, text, options);
  const charsPerLine = Math.max(1, Math.floor(w / charWidth));

  const words = String(text || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return [];

  const lines = [];
  let currentLine = '';

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else {
      const candidate = `${currentLine} ${word}`;
      if (candidate.length <= charsPerLine) {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Core text-fitting function.
 *
 * @param {string|string[]|object[]} text - Text content, array of lines, or prioritized item objects
 * @param {string} [font='Inter'] - Font family name
 * @param {number} [initialSize=32] - Starting font size
 * @param {number} [boxWidth=1000] - Available width in pixels
 * @param {object} [options={}] - Fitting options
 * @param {number} [options.minSize=20] - Minimum font size (default 20px on 1080px poster)
 * @param {number} [options.posterWidth=1080] - Reference poster width for min size scaling
 * @param {number} [options.maxLines=null] - Maximum lines allowed (headlines default to 2)
 * @param {number} [options.maxHeight=null] - Maximum allowed box height
 * @param {string} [options.role='regular'] - Field role (headline, date, time, venue, etc.)
 * @param {boolean} [options.isHeadline=false] - If true, enforces max 2 lines
 * @param {number} [options.lineHeight=null] - Line height multiplier (Tamil defaults to 1.4)
 * @param {number} [options.weight=400] - Font weight
 * @param {boolean} [options.uppercase=false] - Uppercase transform
 * @param {number} [options.letterSpacing=0] - Letter spacing in pixels
 * @returns {{
 *   lines: string[],
 *   height: number,
 *   lineCount: number,
 *   size: number,
 *   lineHeight: number,
 *   droppedLines: string[]
 * }}
 */
export function textFit(text, font = 'Inter', initialSize = 32, boxWidth = 1000, options = {}) {
  // Check if text is an array of prioritized objects { role, text }
  if (Array.isArray(text) && text.length > 0 && typeof text[0] === 'object' && text[0] !== null) {
    const maxHeight = options.maxHeight || options.boxHeight || Number.POSITIVE_INFINITY;
    const fitted = fitPrioritizedFields(text, boxWidth, maxHeight, { ...options, font, initialSize });
    const lines = fitted.flatMap((f) => (Array.isArray(f.lines) ? f.lines : [String(f.text || '')]));
    const totalH = fitted.reduce((sum, f) => sum + (f.height || 0), 0);
    return {
      lines,
      height: totalH,
      lineCount: lines.length,
      size: fitted[0]?.size || initialSize,
      lineHeight: fitted[0]?.lineHeight || 1.2,
      items: fitted,
      droppedLines: fitted.dropped ? fitted.dropped.map((d) => String(d.text)) : [],
    };
  }

  // Check if text is array of strings with options.roles
  if (Array.isArray(text) && Array.isArray(options.roles)) {
    const items = text.map((t, idx) => ({
      text: t,
      role: options.roles[idx] || 'default',
    }));
    return textFit(items, font, initialSize, boxWidth, { ...options, roles: undefined });
  }

  const rawText = Array.isArray(text) ? text.filter(Boolean) : String(text || '').trim();
  const isEmpty = Array.isArray(rawText) ? rawText.length === 0 : !rawText;

  if (isEmpty) {
    return {
      lines: [],
      height: 0,
      lineCount: 0,
      size: initialSize,
      lineHeight: 1.2,
      droppedLines: [],
    };
  }

  const isTamil = hasTamil(Array.isArray(rawText) ? rawText.join(' ') : rawText);
  const effectiveLineHeight = isTamil
    ? Math.max(TAMIL_LINE_HEIGHT, Number(options.lineHeight) || TAMIL_LINE_HEIGHT)
    : (Number(options.lineHeight) || (options.isHeadline || options.role === 'headline' ? 1.05 : 1.2));

  const posterWidth = Number(options.posterWidth) || 1080;
  const minSize = Math.max(10, options.minSize !== undefined ? options.minSize : Math.round(20 * (posterWidth / 1080)));

  const isHeadline = Boolean(options.isHeadline || options.role === 'headline' || options.role === 'title');
  const maxLines = options.maxLines || (isHeadline ? 2 : null);
  const maxHeight = options.maxHeight || options.boxHeight || null;

  let size = Math.max(minSize, Math.round(Number(initialSize) || 32));
  const availableWidth = Math.max(10, boxWidth);

  // Helper to extract words for single-word overflow check
  const allWords = (Array.isArray(rawText) ? rawText.join(' ') : rawText)
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  // 1. Shrink font size if any single word exceeds boxWidth (never break a word)
  for (const word of allWords) {
    while (size > minSize) {
      const cw = charWidthFor(size, font, word, options);
      if (Math.ceil(word.length * cw) <= availableWidth) {
        break;
      }
      size -= 1;
    }
  }

  // 2. Shrink font size to fit maxLines and maxHeight constraints
  const getRenderedLines = (s) => {
    if (Array.isArray(rawText)) {
      const lines = [];
      for (const item of rawText) {
        const wrapped = wrapWords(item, s, font, availableWidth, options);
        lines.push(...wrapped);
      }
      return lines;
    }
    return wrapWords(rawText, s, font, availableWidth, options);
  };

  let renderedLines = getRenderedLines(size);

  while (size > minSize) {
    const exceedsLines = maxLines && renderedLines.length > maxLines;
    const currentH = Math.round(renderedLines.length * size * effectiveLineHeight);
    const exceedsHeight = maxHeight && currentH > maxHeight;

    if (!exceedsLines && !exceedsHeight) {
      break;
    }

    size -= 1;
    renderedLines = getRenderedLines(size);
  }

  // Ensure size never drops below minSize (20 px on 1080 px poster)
  size = Math.max(minSize, size);

  // 3. If it still does not fit at minSize, drop lowest-priority lines
  const droppedLines = [];
  let finalLines = [...renderedLines];

  const currentHeight = () => Math.round(finalLines.length * size * effectiveLineHeight);

  if (maxLines && finalLines.length > maxLines) {
    while (finalLines.length > maxLines) {
      const dropped = finalLines.pop();
      if (dropped) droppedLines.push(dropped);
    }
  }

  if (maxHeight && currentHeight() > maxHeight) {
    while (finalLines.length > 1 && currentHeight() > maxHeight) {
      const dropped = finalLines.pop();
      if (dropped) droppedLines.push(dropped);
    }
  }

  return {
    lines: finalLines,
    height: Math.max(0, currentHeight()),
    lineCount: finalLines.length,
    size,
    lineHeight: effectiveLineHeight,
    droppedLines,
  };
}

/**
 * Filters and fits a collection of poster content fields according to the priority order.
 * Drops lowest-priority fields first if total height exceeds availableHeight.
 *
 * Priority order:
 *  headline > date > time > venue > subtitle > bullets > call to action > slogan
 *
 * @param {Array<{role: string, text: string|string[], font?: string, size?: number}>} items
 * @param {number} boxWidth
 * @param {number} availableHeight
 * @param {object} [options={}]
 * @returns {Array<object>} Kept items with calculated heights and sizes
 */
export function fitPrioritizedFields(items, boxWidth, availableHeight, options = {}) {
  if (!Array.isArray(items) || items.length === 0) return [];

  // Prune empty items
  const candidates = items
    .filter((it) => it && (Array.isArray(it.text) ? it.text.filter(Boolean).length > 0 : String(it.text || '').trim()))
    .map((it, idx) => {
      const role = String(it.role || it.field || 'default').toLowerCase();
      const priority = getPriority(role);
      return { ...it, role, priority, originalIndex: idx };
    });

  if (candidates.length === 0) return [];

  // Active items candidate pool
  let active = [...candidates];
  const posterWidth = Number(options.posterWidth) || 1080;
  const minSize = Math.max(10, options.minSize !== undefined ? options.minSize : Math.round(20 * (posterWidth / 1080)));
  const gap = Number(options.gap !== undefined ? options.gap : 12);

  while (active.length > 1) {
    // Measure all active items at minSize or initial size
    let totalH = 0;
    for (let i = 0; i < active.length; i++) {
      const item = active[i];
      const fit = textFit(item.text, item.font || options.font || 'Inter', item.size || options.initialSize || 24, boxWidth, {
        role: item.role,
        isHeadline: item.role === 'headline',
        minSize,
        posterWidth,
      });
      totalH += fit.height;
      if (i > 0) totalH += gap;
    }

    if (totalH <= availableHeight) {
      break;
    }

    // Drop lowest-priority item (smallest priority score)
    let lowestIdx = 0;
    for (let i = 1; i < active.length; i++) {
      if (active[i].priority < active[lowestIdx].priority) {
        lowestIdx = i;
      }
    }
    active.splice(lowestIdx, 1);
  }

  // Restore original ordering
  active.sort((a, b) => a.originalIndex - b.originalIndex);

  const result = active.map((item) => {
    const fit = textFit(item.text, item.font || options.font || 'Inter', item.size || options.initialSize || 24, boxWidth, {
      role: item.role,
      isHeadline: item.role === 'headline',
      minSize,
      posterWidth,
    });
    return {
      ...item,
      lines: fit.lines,
      height: fit.height,
      size: fit.size,
      lineHeight: fit.lineHeight,
    };
  });

  result.dropped = candidates.filter((c) => !active.some((a) => a.originalIndex === c.originalIndex));

  return result;
}

export default {
  textFit,
  getFontRatio,
  charWidthFor,
  wrapWords,
  fitPrioritizedFields,
  getPriority,
  FONT_CHAR_WIDTH_RATIOS,
  FIELD_PRIORITY,
  PRIORITY_ORDER,
};
