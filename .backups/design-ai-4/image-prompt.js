import { brandOf, tint, shade } from '../../../shared/designRecipes.js';

/* The words an illustration is asked for. A person's own description never reaches the picture
   service: only these fixed frames around a few plain words taken from the poster's headline. */

export const IMAGE_SUBJECT_LIMITS = { min: 3, max: 60 };

/** One sentence, always the same shape, so nothing outside it can steer the picture service. */
export const IMAGE_PROMPT_TEMPLATE =
  'A clean flat illustration of {subject}, no text, no logos, no people\'s faces, colors {palette}';

/**
 * Some ideas should not be drawn at all. The list is deliberately short and broad: it only
 * needs to catch what a poster headline can plausibly contain, and the fixed prompt already
 * refuses words, marks and faces.
 */
/* Only ideas that would come back as something we must not show. A poster about a hard subject
   stays allowed: "blood donation" and "road safety" draw a plain illustration, so those words
   are not on this list. */
const UNSAFE_TOPICS = [
  'gun', 'guns', 'rifle', 'knife', 'knives', 'weapon', 'weapons', 'bomb', 'bombs', 'explosive',
  'shoot', 'shooting', 'kill', 'killing', 'murder', 'corpse', 'gore', 'bloodbath', 'torture',
  'suicide', 'self-harm', 'rape', 'sexual', 'sex', 'nude', 'naked', 'porn', 'pornography', 'erotic',
  'drug', 'drugs', 'cocaine', 'heroin', 'meth', 'overdose', 'booze', 'drunk', 'intoxicated',
  'gambling', 'casino', 'betting', 'jackpot', 'hate', 'racist', 'racism', 'nazi', 'swastika',
  'terror', 'terrorist', 'extremist',
  'logo', 'logos', 'trademark', 'brand mark', 'portrait', 'likeness', 'selfie', 'mugshot',
  'celebrity', 'president', 'prime minister',
];

const UNSAFE_MESSAGE =
  'That is not something we can draw. Keep the poster words to what the event is about.';

/** Letters, numbers and spaces only, cut to a headline's room; everything else is dropped. */
export function cleanSubject(value) {
  const raw = typeof value === 'string' ? value : '';
  const flat = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/[‘’“”]/g, "'")
    .replace(/[^A-Za-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, IMAGE_SUBJECT_LIMITS.max)
    .trim();
  return flat;
}

/** Whole-word match, so "class" never trips on "classic". */
function mentionsUnsafeTopic(subject) {
  const words = subject.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const phrase = ` ${words.join(' ')} `;
  return UNSAFE_TOPICS.some((topic) =>
    topic.includes(' ') ? phrase.includes(` ${topic} `) : words.includes(topic)
  );
}

/**
 * Refuses a subject that cannot be drawn safely, in plain words and before anything is asked
 * of the picture service.
 */
export function screenSubject(subject) {
  const value = cleanSubject(subject);
  if (value.length < IMAGE_SUBJECT_LIMITS.min) {
    return { ok: false, reason: 'Give the poster a headline first, then we can draw a picture for it.' };
  }
  if (mentionsUnsafeTopic(value)) {
    return { ok: false, reason: UNSAFE_MESSAGE };
  }
  return { ok: true, subject: value };
}

/** The brand's own colours, as the few hex values that go into the prompt. */
export function paletteOf(brandKit) {
  const brand = brandOf(brandKit);
  const colors = [brand.primary, brand.secondary, brand.accent, tint(brand.primary, 0.55), shade(brand.primary, 0.35)];
  const seen = [];
  for (const color of colors) {
    const hex = String(color || '').trim().toLowerCase();
    if (/^#[0-9a-f]{6}$/.test(hex) && !seen.includes(hex)) seen.push(hex);
  }
  return seen.slice(0, 4);
}

/** The one prompt builder. Only a cleaned subject and brand hexes can ever reach the service. */
export function buildImagePrompt({ subject, brandKit }) {
  const clean = cleanSubject(subject);
  const palette = paletteOf(brandKit);
  return IMAGE_PROMPT_TEMPLATE.replace('{subject}', clean || 'a community gathering')
    .replace('{palette}', palette.length ? palette.join(', ') : 'the brand colors');
}

/** The shapes a picture service is given, nearest first for a poster's own proportions. */
const RATIOS = [
  { value: '9:16', ratio: 9 / 16 },
  { value: '3:4', ratio: 3 / 4 },
  { value: '4:5', ratio: 4 / 5 },
  { value: '1:1', ratio: 1 },
  { value: '5:4', ratio: 5 / 4 },
  { value: '4:3', ratio: 4 / 3 },
  { value: '16:9', ratio: 16 / 9 },
];

/**
 * Which shape to ask for, from the poster's own canvas. The picture area always crops to fill,
 * so a close ratio simply means less of the drawing is thrown away.
 */
export function aspectRatioFor(size) {
  const width = Number(size?.width) || 1080;
  const height = Number(size?.height) || 1350;
  const want = width / height;
  let best = RATIOS[3];
  let bestGap = Infinity;
  for (const option of RATIOS) {
    /* Compared as a logarithm so halving the shape and doubling it cost the same. */
    const gap = Math.abs(Math.log(want / option.ratio));
    if (gap < bestGap) {
      best = option;
      bestGap = gap;
    }
  }
  return best.value;
}
