/**
 * /shared/aiChoices.js
 *
 * Pure, isomorphic AI Choices validation, schema enums, and deterministic
 * rule-based fallback copy generator for PosterAI.
 *
 * Guarantees:
 *  1. Enums built dynamically from shared block definitions.
 *  2. The model NEVER returns colours, fonts, positions, sizes, HTML, SVG or URLs.
 *  3. Dates, times, venues, and names only from user's text; variants never alter facts.
 *  4. Drop invalid variants; if fewer than 3 survive, fill from rule-based fallback.
 *  5. Invalid block enums are replaced by composer's choice.
 *  6. Pure ESM, zero dependencies.
 */

import {
  HERO_BLOCKS,
  INFO_BLOCKS,
  MESSAGE_BLOCKS,
  CTA_BLOCKS,
  BACKGROUND_BLOCKS,
  DECORATION_BLOCKS,
} from './designBlocks.js';
import { extractEventFacts, deduplicateFields } from './fallbackParser.js';
import { textFit } from './textFit.js';
import { hasTamil } from './textScripts.js';
import { composeDesign } from './designComposer.js';

export const VALID_MOODS = [
  'formal',
  'friendly',
  'urgent',
  'emotional',
  'festive',
  'warm',
  'energetic',
  'modern',
  'minimal',
];

export const VALID_ANGLES = [
  'formal',
  'friendly',
  'urgent',
  'emotional',
  'short',
  'detailed',
];

export const BLOCK_ENUMS = {
  hero: HERO_BLOCKS.map((b) => b.id),
  info: INFO_BLOCKS.map((b) => b.id),
  message: MESSAGE_BLOCKS.map((b) => b.id),
  cta: CTA_BLOCKS.map((b) => b.id),
  background: BACKGROUND_BLOCKS.map((b) => b.id),
  decoration: DECORATION_BLOCKS.map((b) => b.id),
};

const HEX_COLOR_REGEX = /#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})\b/;
const URL_REGEX = /(https?:\/\/|www\.)\S+/i;
const HTML_REGEX = /<[^>]+>/;

/**
 * Checks if a string contains forbidden output (hex colour, URL, HTML/SVG).
 */
export function hasForbiddenContent(value) {
  if (typeof value !== 'string') return false;
  return HEX_COLOR_REGEX.test(value) || URL_REGEX.test(value) || HTML_REGEX.test(value);
}

/**
 * Checks an object recursively for forbidden content (hex colour, URL, HTML).
 */
export function containsForbiddenRecursively(obj) {
  if (!obj) return false;
  if (typeof obj === 'string') return hasForbiddenContent(obj);
  if (Array.isArray(obj)) return obj.some(containsForbiddenRecursively);
  if (typeof obj === 'object') {
    return Object.values(obj).some(containsForbiddenRecursively);
  }
  return false;
}

/**
 * Sanitize plain string: remove tags, normalize whitespace, truncate.
 */
function cleanStr(val, max = 200) {
  if (typeof val !== 'string') return '';
  return val
    .replace(/<[^>]*>/g, '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

/**
 * Validates a single copy variant.
 * Returns true if valid, false if invalid.
 */
export function isValidCopyVariant(variant, _facts = {}) {
  if (!variant || typeof variant !== 'object') return false;

  // 1. Angle enum
  const angle = String(variant.angle || '').trim().toLowerCase();
  if (!VALID_ANGLES.includes(angle)) return false;

  // 2. Forbidden content (no hex colors, URLs, HTML)
  if (containsForbiddenRecursively(variant)) return false;

  // 3. Slogan structure
  const slogan = variant.slogan;
  if (!slogan || typeof slogan !== 'object') return false;
  const line1 = cleanStr(slogan.line1, 80);

  // 4. Bullets (max 3 items)
  if (variant.bullets !== undefined && !Array.isArray(variant.bullets)) return false;
  const bullets = Array.isArray(variant.bullets) ? variant.bullets : [];
  if (bullets.length > 3) return false;
  for (const b of bullets) {
    if (typeof b !== 'string' || b.length > 90) return false;
  }

  // 5. CTA structure
  const cta = variant.cta;
  if (!cta || typeof cta !== 'object') return false;

  // 6. Text estimation check using textFit
  const subtitle = cleanStr(variant.subtitle, 120);
  if (subtitle.length > 120) return false;

  const font = hasTamil(subtitle) ? 'Noto Sans Tamil' : 'Inter';
  const subFit = textFit(subtitle, font, 24, 800, { maxLines: 3 });
  if (subFit.lines.length > 3) return false;

  if (line1) {
    const s1Fit = textFit(line1, font, 28, 800, { maxLines: 2 });
    if (s1Fit.lines.length > 2) return false;
  }

  return true;
}

/**
 * Creates deterministic rule-based copy variants from facts.
 */
export function createRuleBasedCopyVariants(facts = {}, count = 5) {
  const isTamil = Boolean(facts.isTamil || hasTamil(facts.title || '') || hasTamil(facts.subtitle || ''));
  const userSub = cleanStr(facts.subtitle || '', 100);
  const details = Array.isArray(facts.details) ? facts.details.slice(0, 3) : [];
  const contact = cleanStr(facts.contact || '', 60);

  const baseAngles = ['formal', 'friendly', 'urgent', 'emotional', 'short', 'detailed'];
  const variants = [];

  for (let i = 0; i < Math.min(count, baseAngles.length); i++) {
    const angle = baseAngles[i];
    let v;

    if (isTamil) {
      switch (angle) {
        case 'formal':
          v = {
            angle: 'formal',
            subtitle: userSub || 'அனைவரும் வருக என அன்புடன் அழைக்கிறோம்',
            slogan: { line1: 'மனிதநேய சேவை', line2: 'அனைவரும் ஒன்றிணைவோம்' },
            quote: '',
            bullets: details.length > 0 ? details : ['அனைவருக்கும் அனுமதி இலவசம்', 'சிறப்பு விருந்தினர்கள் வருகை'],
            cta: { line: contact || 'மேலும் விவரங்களுக்கு தொடர்பு கொள்ளவும்', button: 'பதிவு செய்ய' },
            ribbonText: 'அழைப்பிதழ்',
          };
          break;
        case 'friendly':
          v = {
            angle: 'friendly',
            subtitle: userSub || 'உங்களை அன்போடு வரவேற்கிறோம்',
            slogan: { line1: 'மகிழ்ச்சியான தருணம்', line2: 'இணைந்து கொண்டாடுவோம்' },
            quote: '',
            bullets: details.length > 0 ? details : ['அனைவருக்கும் வரவேற்பு', 'இனிப்பு மற்றும் தேநீர்'],
            cta: { line: 'உங்கள் வருகையை எதிர்நோக்குகிறோம்', button: 'வாருங்கள்' },
            ribbonText: 'அன்புடன் வருக',
          };
          break;
        case 'urgent':
          v = {
            angle: 'urgent',
            subtitle: userSub || 'உடனடியாக பதிவு செய்திடுங்கள்',
            slogan: { line1: 'இன்றே முன்வருவோம்', line2: 'உயிர்களைக் காப்போம்' },
            quote: '',
            bullets: details.length > 0 ? details : ['முன்பதிவு அவசியம்', 'நேரத்தை தவறவிடாதீர்கள்'],
            cta: { line: contact || 'உடனடி பதிவுக்கு தொடர்பு கொள்ளவும்', button: 'இப்போதே பதிவு' },
            ribbonText: 'முக்கிய அறிவிப்பு',
          };
          break;
        case 'short':
          v = {
            angle: 'short',
            subtitle: userSub || '',
            slogan: { line1: '', line2: '' },
            quote: '',
            bullets: [],
            cta: { line: '', button: 'தகவல்' },
            ribbonText: '',
          };
          break;
        case 'detailed':
        default:
          v = {
            angle: 'detailed',
            subtitle: userSub || 'முழு விபரம் மற்றும் நிகழ்வு நிரல்',
            slogan: { line1: 'ஒன்றிணைந்து சாதிப்போம்', line2: 'சிறப்பான முன்னேற்றம்' },
            quote: '',
            bullets: details.length > 0 ? details : ['விரிவான அமர்வுகள்', 'சான்றிதழ் வழங்கப்படும்'],
            cta: { line: contact || 'முன் கூட்டியே பதிவு செய்து கொள்ளவும்', button: 'விவரங்களை அறிய' },
            ribbonText: 'முழு விவரம்',
          };
          break;
      }
    } else {
      switch (angle) {
        case 'formal':
          v = {
            angle: 'formal',
            subtitle: userSub || 'Cordially Inviting You to the Event',
            slogan: { line1: 'Excellence & Commitment', line2: 'A Distinguished Gathering' },
            quote: '',
            bullets: details.length > 0 ? details : ['Official Presentation Ceremony', 'Networking & Refreshments'],
            cta: { line: contact || 'For inquiries, please contact the organizers', button: 'Learn More' },
            ribbonText: 'Official Event',
          };
          break;
        case 'friendly':
          v = {
            angle: 'friendly',
            subtitle: userSub || 'Celebrate and Connect Together',
            slogan: { line1: 'Come Be Part of the Story', line2: 'Everyone is Welcome' },
            quote: '',
            bullets: details.length > 0 ? details : ['Open to all participants', 'Engaging activities & sessions'],
            cta: { line: 'We look forward to seeing you there!', button: 'Join Us' },
            ribbonText: 'Welcome',
          };
          break;
        case 'urgent':
          v = {
            angle: 'urgent',
            subtitle: userSub || 'Reserve Your Spot Today',
            slogan: { line1: 'Act Now, Make an Impact', line2: 'Limited Capacity Available' },
            quote: '',
            bullets: details.length > 0 ? details : ['Priority entry for registered guests', 'Schedule starting promptly'],
            cta: { line: contact || 'Register online to secure attendance', button: 'Register Now' },
            ribbonText: 'Important',
          };
          break;
        case 'short':
          v = {
            angle: 'short',
            subtitle: userSub || '',
            slogan: { line1: '', line2: '' },
            quote: '',
            bullets: [],
            cta: { line: '', button: 'View Details' },
            ribbonText: '',
          };
          break;
        case 'detailed':
        default:
          v = {
            angle: 'detailed',
            subtitle: userSub || 'Full Program Schedule & Details',
            slogan: { line1: 'Knowledge, Inspiration, Unity', line2: 'Experience the Highlights' },
            quote: '',
            bullets: details.length > 0 ? details : ['Comprehensive agenda', 'Certificates & materials provided'],
            cta: { line: contact || 'Reach out to the coordinating team', button: 'Event Schedule' },
            ribbonText: 'Program Guide',
          };
          break;
      }
    }

    variants.push(v);
  }

  return variants;
}

/**
 * Validates and sanitizes AI choices output.
 * Replaces invalid enums with composer defaults, drops invalid copyVariants,
 * fills missing variants from rule-based fallback if < 3 survive.
 *
 * @param {object} raw - Parsed LLM JSON
 * @param {object} context
 * @param {string} context.prompt - Original user description
 * @param {string} [context.eventType] - Event type
 * @param {object} [context.brandKit] - Brand Kit
 * @param {number|string} [context.seed] - Seed
 * @returns {{ ok: boolean, data: object, errors: string[] }}
 */
export function validateAiChoices(raw, context = {}) {
  const errors = [];
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, data: null, errors: ['Output must be a JSON object'] };
  }

  const userPrompt = String(context.prompt || '').trim();
  const seed = context.seed !== undefined ? context.seed : 42;

  // 1. Facts Validation (Step 2 validator rules)
  let rawFacts = raw.facts && typeof raw.facts === 'object' ? raw.facts : {};
  // If facts is empty or missing title, extract deterministically
  if (!rawFacts.title) {
    const fallbackFacts = extractEventFacts(userPrompt);
    rawFacts = { ...fallbackFacts, ...rawFacts };
  }

  // Check forbidden content in facts
  if (containsForbiddenRecursively(rawFacts)) {
    errors.push('Facts contain forbidden content (hex colors, URLs, or HTML)');
  }

  const title = cleanStr(rawFacts.title || 'Event', 60);
  const subtitle = cleanStr(rawFacts.subtitle || '', 100);
  const date = cleanStr(rawFacts.date || '', 30);
  const time = cleanStr(rawFacts.time || '', 20);
  const venue = cleanStr(rawFacts.venue || '', 80);
  const contact = cleanStr(rawFacts.contact || '', 80);
  const language = cleanStr(rawFacts.language || (hasTamil(userPrompt) ? 'ta' : 'en'), 10);
  const eventType = cleanStr(rawFacts.eventType || context.eventType || 'general', 30);

  const rawDetails = Array.isArray(rawFacts.details) ? rawFacts.details : [];
  const deduped = deduplicateFields({
    title,
    subtitle,
    date,
    time,
    venue,
    details: rawDetails.map((d) => cleanStr(d, 90)).filter(Boolean),
    contact,
  });
  const details = deduped.details;

  const cleanFacts = {
    title,
    subtitle,
    date,
    time,
    venue,
    details,
    contact,
    language,
    eventType,
    isTamil: language === 'ta' || hasTamil(userPrompt) || hasTamil(title),
  };

  // 2. Mood Validation
  let mood = String(raw.mood || '').trim().toLowerCase();
  if (!VALID_MOODS.includes(mood)) {
    errors.push(`Invalid mood "${raw.mood}" - must be one of: ${VALID_MOODS.join(', ')}`);
    mood = 'formal';
  }

  // 3. Block Preferences Validation (replace invalid enums with composer choice)
  const defaultDesign = composeDesign({
    facts: cleanFacts,
    eventType: cleanFacts.eventType,
    seed,
  });

  const rawPrefs = raw.blockPreferences && typeof raw.blockPreferences === 'object' ? raw.blockPreferences : {};
  const blockPreferences = {};

  const roles = ['hero', 'info', 'message', 'cta', 'background', 'decoration'];
  for (const role of roles) {
    const val = rawPrefs[role];
    if (typeof val === 'string' && BLOCK_ENUMS[role].includes(val)) {
      blockPreferences[role] = val;
    } else {
      if (val !== undefined && val !== null) {
        errors.push(`Invalid ${role} block preference "${val}" - replaced by composer choice`);
      }
      blockPreferences[role] = defaultDesign.blocks[role]?.id || BLOCK_ENUMS[role][0];
    }
  }

  // 4. Reason Validation (one plain sentence, max 90 characters)
  let reason = cleanStr(raw.reason || 'Selected based on event details and design structure.', 90);
  if (reason.length > 90) {
    reason = reason.slice(0, 87) + '...';
  }

  // 5. Copy Variants Validation (4 to 6 items)
  const rawVariants = Array.isArray(raw.copyVariants) ? raw.copyVariants : [];
  const validVariants = [];

  for (const v of rawVariants) {
    if (isValidCopyVariant(v, cleanFacts)) {
      validVariants.push({
        angle: String(v.angle).trim().toLowerCase(),
        subtitle: cleanStr(v.subtitle || '', 100),
        slogan: {
          line1: cleanStr(v.slogan?.line1 || '', 80),
          line2: cleanStr(v.slogan?.line2 || '', 80),
        },
        quote: cleanStr(v.quote || '', 120),
        bullets: (Array.isArray(v.bullets) ? v.bullets : []).map((b) => cleanStr(b, 90)).slice(0, 3),
        cta: {
          line: cleanStr(v.cta?.line || '', 80),
          button: cleanStr(v.cta?.button || 'Register Now', 40),
        },
        ribbonText: cleanStr(v.ribbonText || '', 30),
      });
    } else {
      errors.push('Dropped an invalid copy variant that contained invalid fields or forbidden content');
    }
  }

  // If fewer than 3 survive, fill from rule-based fallback
  if (validVariants.length < 3) {
    const fallbacks = createRuleBasedCopyVariants(cleanFacts, 5);
    const existingAngles = new Set(validVariants.map((v) => v.angle));

    for (const fb of fallbacks) {
      if (!existingAngles.has(fb.angle)) {
        validVariants.push(fb);
        existingAngles.add(fb.angle);
        if (validVariants.length >= 4) break;
      }
    }
  }

  // Ensure 4 to 6 items
  const finalVariants = validVariants.slice(0, 6);

  const sanitized = {
    facts: cleanFacts,
    mood,
    blockPreferences,
    reason,
    copyVariants: finalVariants,
  };

  return {
    ok: errors.length === 0,
    data: sanitized,
    errors,
  };
}

/**
 * Creates full rule-based fallback AI Choices without any LLM call.
 */
export function createRuleBasedChoices({
  prompt = '',
  eventType = 'general',
  brandKit = null,
  seed = 42,
  _requestId = 'fallback',
} = {}) {
  const extracted = extractEventFacts(prompt);
  const cleanFacts = {
    title: extracted.title || 'Event Title',
    subtitle: extracted.subtitle || '',
    date: extracted.date || '',
    time: extracted.time || '',
    venue: extracted.venue || '',
    details: extracted.details || [],
    contact: extracted.contact || '',
    language: extracted.language || (hasTamil(prompt) ? 'ta' : 'en'),
    eventType: extracted.eventType || eventType || 'general',
    isTamil: Boolean(extracted.isTamil || hasTamil(prompt)),
  };

  const design = composeDesign({
    facts: cleanFacts,
    eventType: cleanFacts.eventType,
    brandKit,
    seed,
  });

  const moodMap = {
    blood_camp: 'urgent',
    birthday: 'festive',
    award_function: 'formal',
    sports_day: 'energetic',
    workshop: 'modern',
    temple_festival: 'festive',
    wedding: 'warm',
    meeting: 'formal',
    school_annual_day: 'formal',
    general: 'modern',
  };

  const mood = moodMap[cleanFacts.eventType] || 'modern';

  const blockPreferences = {
    hero: design.blocks.hero.id,
    info: design.blocks.info.id,
    message: design.blocks.message?.id || 'message-none',
    cta: design.blocks.cta?.id || 'cta-none',
    background: design.blocks.background.id,
    decoration: design.blocks.decoration?.id || 'decoration-none',
  };

  const reason = 'Selected based on event details and design structure.';
  const copyVariants = createRuleBasedCopyVariants(cleanFacts, 5);

  return {
    facts: cleanFacts,
    mood,
    blockPreferences,
    reason,
    copyVariants,
    provider: 'fallback',
  };
}

export default {
  VALID_MOODS,
  VALID_ANGLES,
  BLOCK_ENUMS,
  hasForbiddenContent,
  containsForbiddenRecursively,
  isValidCopyVariant,
  createRuleBasedCopyVariants,
  validateAiChoices,
  createRuleBasedChoices,
};
