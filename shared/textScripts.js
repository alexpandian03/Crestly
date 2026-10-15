/**
 * Writing-system rules shared by the API and the browser: what words need once they stop
 * being Latin. Plain ESM on purpose — no imports, nothing that draws, no environment reads —
 * so the same numbers size a design on the server and paint a line of text in the editor.
 *
 * Tamil letters hang below the writing line and join into clusters. The leading Latin text is
 * set at cuts those tails off, letter-spacing pulls a cluster apart, and capitalising changes
 * nothing in Tamil while turning the English half of a mixed line into shouty capitals.
 */

/** The Tamil block, U+0B80 to U+0BFF. */
const TAMIL_LETTER = /[\u0B80-\u0BFF]/;

/** Signs that hang on a Tamil letter instead of standing beside it. */
const TAMIL_DEPENDENT_SIGN = /[\u0BBE-\u0BCD\u0BD7\u0B82\u0B83]/;

/** The tightest leading Tamil may be set at. */
export const TAMIL_LINE_HEIGHT = 1.4;

/** The face a Tamil line falls back to, so Tamil always has a shape to draw. */
export const TAMIL_FALLBACK_FONT = 'Noto Sans Tamil';

/** The families offered to users that carry Tamil shapes themselves. */
export const TAMIL_FONT_FAMILIES = [
  'Noto Sans Tamil',
  'Noto Serif Tamil',
  'Hind Madurai',
  'Mukta Malar',
  'Catamaran',
  'Baloo Thambi 2',
];

/** True when a piece of words holds at least one Tamil letter. */
export function hasTamil(text) {
  return typeof text === 'string' && TAMIL_LETTER.test(text);
}

/** True when any of a line, a list of lines or a set of words holds Tamil. */
export function wordsHaveTamil(words) {
  if (Array.isArray(words)) return words.some((word) => hasTamil(String(word ?? '')));
  return hasTamil(String(words ?? ''));
}

/**
 * How much wider a line of these words sets than pure Latin at the same size: a dependent sign
 * adds almost no advance, a letter adds about a Latin one. The ratio is shared over the whole
 * line, so half-Tamil words are measured as half-wider rather than as if every letter were Tamil.
 */
export function tamilAdvanceRatio(text) {
  const letters = String(text ?? '').replace(/\s/g, '');
  if (!letters) return 1;
  let wide = 0;
  let narrow = 0;
  for (const char of letters) {
    if (TAMIL_DEPENDENT_SIGN.test(char)) narrow += 1;
    else if (TAMIL_LETTER.test(char)) wide += 1;
  }
  if (wide + narrow === 0) return 1;
  return 1 + (wide * 0.26 + narrow * 0.06) / letters.length;
}

/** The font list a line of Latin words is drawn with. */
export function plainFontStack(fontFamily) {
  return `'${String(fontFamily || '').trim() || 'Inter'}', sans-serif`;
}

/** The same, with the Tamil face before sans-serif so Tamil always has a shape to draw. */
export function tamilFontStack(fontFamily) {
  return `'${String(fontFamily || '').trim() || 'Inter'}', '${TAMIL_FALLBACK_FONT}', sans-serif`;
}

/** The stack one piece of words needs: Tamil gets the fallback face, Latin keeps the old string. */
export function fontStackFor(fontFamily, text) {
  return hasTamil(String(text ?? '')) ? tamilFontStack(fontFamily) : plainFontStack(fontFamily);
}

/**
 * What Tamil forces on a stored style: no capitals, no letter-spacing, leading that fits the tails.
 * Nothing comes back for Latin text, so an unchanged line keeps the look its author set.
 */
export function tamilStyleRules(text, style = {}) {
  if (!wordsHaveTamil(text)) return {};
  const lineHeight = Number(style.lineHeight);
  return {
    lineHeight: Math.max(TAMIL_LINE_HEIGHT, Number.isFinite(lineHeight) ? lineHeight : 0),
    letterSpacing: 0,
    uppercase: false,
  };
}

/** The same rules in the shape CSS takes, ready to spread over the properties being painted. */
export function tamilCssOverrides(text, style = {}) {
  if (!wordsHaveTamil(text)) return {};
  const { lineHeight, letterSpacing } = tamilStyleRules(text, style);
  return { lineHeight, letterSpacing, textTransform: 'none' };
}

/** The same three rules folded into a stored style, so a saved design paints as it measures. */
export function withScriptRules(style = {}, text = '') {
  return { ...style, ...tamilStyleRules(text, style) };
}

/** Every font a line of Tamil needs, so the fallback is never asked for and never loaded. */
export function tamilFallbackFor(fonts, text) {
  const list = Array.isArray(fonts) ? [...fonts] : [fonts];
  if (!wordsHaveTamil(text)) return list;
  if (!list.includes(TAMIL_FALLBACK_FONT)) list.push(TAMIL_FALLBACK_FONT);
  return list;
}
