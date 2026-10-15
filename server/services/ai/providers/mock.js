import { designsFor, recipeIds, RECIPE_VARIANTS, relativeLuminance, contrastRatio } from '../../../../shared/designRecipes.js';
import { iconForWords, isSamplePlaceholder, contentArea, resolveColorToken } from '../../../../shared/templateElements.js';
import { eventTypeById, isValidEventType, guessEventType } from '../../../../shared/eventTypes.js';
import {
  matchCategoryFromText,
  preferredArchetypesFor,
  sanitizeAndTruncateDesign,
  sanitizeString,
  selectArchetypeAndVariant,
  stripInstructionWords,
  trimToWords,
} from '../schema.js';

/**
 * Mock LLM Provider
 * Parses user input locally without network calls, returning realistic,
 * schema-compliant poster content. Respects "never invent facts" rule.
 */

/** The words the user led with, which is as close to a real headline as a mock can get. */
function firstClauseOf(text) {
  return text.split(/[,.\n]|(?:\s+(?:on|at|in|from)\s+)/i)[0].trim();
}

/* ------------------------------------------------------------------------- *
 * Mode "ai": one ready design, picked and written from the same keywords.
 * ------------------------------------------------------------------------- */

const DESIGN_SAMPLES = [
  {
    match: ['blood', 'donation'],
    category: 'health',
    title: { main: 'Blood Donation Camp', sub: 'Every unit saves a life' },
    tagline: 'Give blood, share life, inspire hope',
    slogan: { line1: '', line2: '' },
    bullets: [
      'Free health checkup for donors',
      'Certificate and refreshments provided',
      'Certified medical team present',
    ],
    cta: { line: 'Registration desk at front entrance', button: 'Registration desk open at 9 AM' },
    imageQuery: 'blood donation volunteer medical',
  },
  {
    match: ['tree', 'plant', 'environment', 'cleanliness'],
    category: 'awareness',
    title: { main: 'Tree Planting Drive', sub: 'Grow the city we share' },
    tagline: 'Small hands, greener tomorrows',
    slogan: { line1: '', line2: '' },
    bullets: [
      'Tools and saplings provided',
      'Volunteers meet at main gate',
      'Certificates for school groups',
    ],
    cta: { line: 'Volunteers meet at main gate', button: 'Registration desk at main gate' },
    imageQuery: 'tree planting volunteer garden',
  },
  {
    match: ['diwali', 'deepavali', 'lights festival'],
    category: 'festival',
    title: { main: 'Diwali Night of Lights', sub: 'An evening for the whole family' },
    tagline: 'Lamps, music and sweets under one roof',
    slogan: { line1: '', line2: '' },
    bullets: [
      'Rangoli and lantern stalls',
      'Live classical music performances',
      'Sweets for every guest',
    ],
    cta: { line: 'Stalls open for all families', button: 'Stalls open from 5 PM' },
    imageQuery: 'diwali lamps festival lights',
  },
  {
    match: ['sports', 'marathon', 'tournament', 'cricket', 'run', 'athletic'],
    category: 'sports',
    title: { main: 'Annual Sports Day', sub: 'Cheer for your team' },
    tagline: 'A day of races, relays and records',
    slogan: { line1: '', line2: '' },
    bullets: [
      'Track and field events morning',
      'Team relays after lunch',
      'Prize ceremony at close',
    ],
    cta: { line: 'Wear your team colours', button: 'Registration desk open from 7 AM' },
    imageQuery: 'sports running stadium athletes',
  },
  {
    match: ['award', 'awards', 'honour', 'recognition', 'gala'],
    category: 'celebration',
    title: { main: 'Excellence Awards Night', sub: 'Celebrating what we built' },
    tagline: 'An evening of thanks and recognition',
    slogan: { line1: '', line2: '' },
    bullets: [
      'Twelve categories on stage',
      'Guest of honour address',
      'Dinner follows the ceremony',
    ],
    cta: { line: 'Tables seat eight guests', button: 'Reception starts at 6 PM' },
    imageQuery: 'awards ceremony stage trophy',
  },
];

function sampleFor(lower) {
  return DESIGN_SAMPLES.find((sample) => sample.match.some((word) => lower.includes(word))) || null;
}

function avoidSet(avoidRecipeIds) {
  const allowed = recipeIds();
  return new Set(
    (Array.isArray(avoidRecipeIds) ? avoidRecipeIds : [])
      .map((id) => String(id).trim())
      .filter((id) => allowed.includes(id))
  );
}

function formatVenue(raw) {
  const trimmed = String(raw || '').trim();
  if (!trimmed) return '';
  if (/^school\s+ground$/i.test(trimmed)) {
    return 'School ground';
  }
  const words = trimmed.split(/\s+/).filter(Boolean);
  return words
    .map((w, i) => {
      if (i === 0) return w.charAt(0).toUpperCase() + w.slice(1);
      // Keep capitalized if typed with capital
      if (w[0] === w[0].toUpperCase() && w[0] !== w[0].toLowerCase()) return w;
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/** Extract venue from known venue patterns or at/in clauses. */
export function extractVenue(text) {
  const t = String(text || '').trim();
  if (/no\s+venue/i.test(t)) {
    return '';
  }

  // Tamil venue detection
  if (/[\u0B80-\u0BFF]/.test(t)) {
    const tamilPlaces = ['மண்டபம்', 'அரங்கம்', 'மைதானம்', 'வளாகம்', 'திடல்', 'பூங்கா', 'நிலையம்', 'நகர்', 'சென்னை', 'மதுரை', 'கோவை', 'திருச்சி', 'சேலம்'];
    const clauses = t.split(/[\n,;.]/).map((c) => c.trim()).filter(Boolean);
    for (const c of clauses) {
      if (tamilPlaces.some((p) => c.includes(p))) {
        return c;
      }
    }
  }

  // 1. Look for "at <place>" or "in <place>" or "venue: <place>" first
  const atIn = t.match(/\b(?:at|in|venue:?)\s+([A-Za-z0-9][A-Za-z0-9\s,'-]{1,45}?)(?:,\s*|\.\s*|\s+(?:on|from|with|including|for)\b|$)/i);
  if (atIn) {
    let raw = atIn[1].replace(/^(?:the)\s+/i, '').trim();
    if (!/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}(?:st|nd|rd|th)?|\d{1,2}:\d{2})\b/i.test(raw)) {
      return formatVenue(raw);
    }
  }

// 2. Specific places
  const knownPlaces = [
    'community hall', 'village hall', 'town hall', 'city hall', 'banquet hall', 'memorial hall',
    'community center', 'community centre', 'community grounds',
    'school ground', 'college ground', 'town square', 'city center', 'city centre',
    'main stadium', 'campus auditorium', 'auditorium', 'grand ballroom',
    'green valley park', 'central park', 'sports complex', 'sports ground', 'park'
  ];
  for (const place of knownPlaces) {
    const rx = new RegExp(`\\b([A-Za-z0-9'\\s]{0,25}?\\b${place})\\b`, 'i');
    const m = t.match(rx);
    if (m) {
      let raw = m[1].replace(/^(?:at|in|on|the)\s+/i, '').trim();
      return formatVenue(raw);
    }
  }
  return '';
}

/** Turn phrases like "Include registration desk and medals" or clauses into up to 3 short bullets (<=6 words). */
export function extractBullets(text, fallbackBullets = []) {
  const t = String(text || '').trim();
  const includeMatch = t.match(/\b(?:include|including|featuring|with|add|make|create|have)\s+([A-Za-z0-9\s,'&/-]+?)(?:\.|$|(?:\s+on\s+\d+)|\s+at\s+[A-Z])/i);
  if (includeMatch) {
    const rawPhrase = includeMatch[1].trim();
    const parts = rawPhrase
      .split(/,|\band\b|&/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 2 && !/^(?:on|at|from)\s+/i.test(p));
    if (parts.length > 0) {
      const extracted = parts.slice(0, 3).map((part) => {
        const cleaned = stripInstructionWords(part);
        return trimToWords(cleaned, 6);
      }).filter((b) => b && !isSamplePlaceholder(b));
      if (extracted.length > 0) return extracted;
    }
  }

  // Extract descriptive clauses from the user's description
  const headline = firstClauseOf(t).toLowerCase();
  const venue = extractVenue(t).toLowerCase();

  let rawClauses = [];
  const sentences = t
    .split(/[\n;.]/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const s of sentences) {
    const parts = s.split(/,\s*/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      rawClauses.push(...parts);
    } else {
      rawClauses.push(s);
    }
  }

  const extracted = [];
  for (const clause of rawClauses) {
    const lowerClause = clause.toLowerCase();
    if (lowerClause === headline || (headline.length > 5 && lowerClause.includes(headline))) continue;
    if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}(?:st|nd|rd|th)?|\d{4})\b/i.test(clause)) continue;
    if (/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(clause)) continue;
    if (venue && lowerClause.includes(venue)) continue;
    if (/\b(?:at|in|venue:?|location:?)\s+/i.test(clause)) continue;

    const cleaned = stripInstructionWords(clause);
    if (!cleaned || cleaned.length < 3) continue;
    if (isSamplePlaceholder(cleaned)) continue;

    const bullet = trimToWords(cleaned.charAt(0).toUpperCase() + cleaned.slice(1), 6);
    if (bullet && !extracted.includes(bullet)) {
      extracted.push(bullet);
      if (extracted.length >= 3) break;
    }
  }

  if (extracted.length > 0) {
    return extracted;
  }

  const safeFallbacks = (fallbackBullets || [])
    .filter((b) => b && !isSamplePlaceholder(b))
    .slice(0, 3)
    .map((b) => {
      const cleaned = stripInstructionWords(b);
      return trimToWords(cleaned, 6);
    })
    .filter(Boolean);

  if (safeFallbacks.length > 0) {
    return safeFallbacks;
  }

  return ['Open to all participants', 'Everyone welcome to join'];
}

/** Extract CTA text from the description, never using "JOIN US", "COME CELEBRATE" or "FIND OUT MORE". */
export function extractCta(text) {
  const t = String(text || '').trim();
  const deskMatch = t.match(/\b([A-Za-z\s]*?desk\s+(?:open\s+)?(?:from|at)\s+\d+\s*(?:AM|PM|am|pm)?)\b/i);
  if (deskMatch) {
    const w = deskMatch[1].trim();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  const regMatch = t.match(/\b(registration\s+(?:desk\s+)?(?:open\s+)?(?:from|at)\s+\d+\s*(?:AM|PM|am|pm)?)\b/i);
  if (regMatch) {
    const w = regMatch[1].trim();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  const doorMatch = t.match(/\b(tickets?\s+(?:available\s+)?at\s+(?:the\s+)?door)\b/i);
  if (doorMatch) {
    return 'Tickets at the door';
  }
  const stallsMatch = t.match(/\b(stalls?\s+open\s+(?:from|at)\s+\d+\s*(?:AM|PM|am|pm)?)\b/i);
  if (stallsMatch) {
    const w = stallsMatch[1].trim();
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  return 'Open to all';
}

export function extractKicker(text, title = '', category = 'general', sample = null) {
  if (sample?.title?.sub) {
    return trimToWords(sample.title.sub, 4);
  }
  const t = String(text || '').trim();
  const colonMatch = t.match(/^([A-Za-z0-9\s]{3,20}):\s+/);
  if (colonMatch) {
    const candidate = stripInstructionWords(colonMatch[1].trim());
    if (candidate && !isSamplePlaceholder(candidate)) {
      return trimToWords(candidate, 4);
    }
  }
  switch (category) {
    case 'sports': return 'Annual Sports';
    case 'festival': return 'Festival Celebration';
    case 'health': return 'Community Health';
    case 'awards': return 'Staff Recognition';
    case 'workshop': return 'Training Workshop';
    case 'notice': return 'Official Notice';
    default: {
      const lower = (t + ' ' + title).toLowerCase();
      if (lower.includes('art') || lower.includes('music') || lower.includes('dance')) return 'Arts & Culture';
      if (lower.includes('food') || lower.includes('bake') || lower.includes('cook')) return 'Food & Community';
      if (lower.includes('book') || lower.includes('read') || lower.includes('library')) return 'Community Reading';
      if (lower.includes('fair')) return 'Community Fair';
      if (lower.includes('meet') || lower.includes('gather')) return 'Community Meetup';
      if (lower.includes('youth') || lower.includes('kids') || lower.includes('student')) return 'Youth Initiative';
      if (lower.includes('clean') || lower.includes('green') || lower.includes('plant')) return 'Green Initiative';
      return 'Community Gathering';
    }
  }
}

export function extractSubtitle(text, title = '', category = 'general', sample = null) {
  if (sample?.tagline) {
    return trimToWords(sample.tagline, 10);
  }

  const t = String(text || '').trim();
  const headline = (title || firstClauseOf(t)).toLowerCase();
  const venue = extractVenue(t).toLowerCase();

  const clauses = t
    .split(/[\n;.]/)
    .map((c) => c.trim())
    .filter(Boolean);

  for (const clause of clauses) {
    const lower = clause.toLowerCase();
    if (lower === headline || (headline.length > 5 && lower.includes(headline))) continue;
    if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}(?:st|nd|rd|th)?|\d{4})\b/i.test(clause)) continue;
    if (/\b\d{1,2}(?::\d{2})?\s*(?:am|pm)\b/i.test(clause)) continue;
    if (venue && lower.includes(venue)) continue;
    if (/\b(?:at|in|venue:?|location:?)\s+/i.test(clause)) continue;
    const cleaned = stripInstructionWords(clause);
    if (!cleaned || cleaned.length < 5) continue;
    if (isSamplePlaceholder(cleaned)) continue;

    return trimToWords(cleaned.charAt(0).toUpperCase() + cleaned.slice(1), 10);
  }

  const dashMatch = t.match(/^[^-–—]+[-–—]\s*([^.,;\n]+)/);
  if (dashMatch) {
    const candidate = stripInstructionWords(dashMatch[1].trim());
    if (candidate && !isSamplePlaceholder(candidate) && candidate.length >= 5) {
      return trimToWords(candidate.charAt(0).toUpperCase() + candidate.slice(1), 10);
    }
  }

  switch (category) {
    case 'sports': return 'Celebrating athletic excellence and community spirit';
    case 'festival': return 'Celebrate the season with festive joy and community';
    case 'health': return 'Promoting wellness and care for every neighbor';
    case 'awards': return 'Honouring dedication and outstanding achievement';
    case 'workshop': return 'Gain practical skills and hands-on experience';
    case 'notice': return 'Important operational updates and schedule details';
    default: {
      const cleanTitle = title || firstClauseOf(t);
      if (cleanTitle && cleanTitle.length > 5 && !isSamplePlaceholder(cleanTitle)) {
        return `A special gathering celebrating ${cleanTitle.toLowerCase()}`;
      }
      return 'Bringing our community together';
    }
  }
}

function defaultKeywords(category, sampleKeywords) {
  if (sampleKeywords) return trimToWords(sampleKeywords, 4);
  switch (category) {
    case 'sports': return 'athletics sports competition';
    case 'festival': return 'cultural festival celebration';
    case 'health': return 'community health wellness';
    case 'awards': return 'ceremony award trophy';
    case 'workshop': return 'workshop seminar team';
    case 'notice': return 'official notice sign';
    default: return 'community celebration event';
  }
}

export function extractKeywordsFromText(text, category, sampleKeywords) {
  if (sampleKeywords) return trimToWords(sampleKeywords, 4);
  const t = String(text || '').trim();
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'from',
    'up', 'about', 'into', 'over', 'after', 'beneath', 'under', 'above', 'please', 'include', 'add',
    'make', 'create', 'featuring', 'open', 'all', 'join', 'us', 'come', 'celebrate',
    'am', 'pm', 'date', 'time', 'venue', 'location', 'free', 'admission', 'ticket', 'registration'
  ]);
  const words = t
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w));

  if (words.length >= 2) {
    return words.slice(0, 4).join(' ');
  }
  return defaultKeywords(category, sampleKeywords);
}

/** Deterministic by keyword: the same description always gives the same design and words. */
function designAnswer({ text, date, time, venue, avoidRecipeIds, variant, instruction }) {
  const lower = text.toLowerCase();
  const sample = sampleFor(lower);
  const category = sample ? sample.category : (matchCategoryFromText(text) || 'general');

  const selection = selectArchetypeAndVariant({
    text,
    avoidRecipeIds,
    variant,
    instruction,
  });
  let archetype = selection.archetype;
  const forcedVariant = selection.variant;

  const wantsPhoto = lower.includes('sport') || lower.includes('fest') || lower.includes('pongal') || lower.includes('cultural') || lower.includes('blood') || lower.includes('diwali') || lower.includes('market') || lower.includes('food') || lower.includes('music') || lower.includes('concert') || lower.includes('bakes') || lower.includes('bakery') || lower.includes('party') || lower.includes('hackathon') || lower.includes('exhibition') || lower.includes('dance') || Boolean(sample?.imageQuery);
  const avoids = (Array.isArray(avoidRecipeIds) ? avoidRecipeIds : []).map((id) => String(id).toLowerCase());
  if (wantsPhoto && !avoids.includes('photo-hero') && !instruction) {
    archetype = 'photo-hero';
  }

  const words = [text, venue].filter(Boolean).join(' ');
  const venueVal = venue || 'Venue to be announced';
  const cta = extractCta(text);

  let title = '';
  const headline = firstClauseOf(text);
  if (headline && headline.length >= 4 && !isSamplePlaceholder(headline)) {
    title = headline;
  } else if (sample?.title?.main) {
    title = sample.title.main;
  } else {
    title = 'Featured Community Event';
  }

  const kicker = sample?.title?.sub
    ? trimToWords(sample.title.sub, 4)
    : extractKicker(text, title, category, sample);

  const subtitle = sample?.tagline
    ? trimToWords(sample.tagline, 10)
    : extractSubtitle(text, title, category, sample);

  const bullets = extractBullets(text, sample?.bullets || ['Everyone is welcome to join']);
  const photoKeywords = extractKeywordsFromText(text, category, sample?.imageQuery);

  const iconWords = [words, title, photoKeywords].filter(Boolean).join(' ');
  const icon = iconForWords(iconWords, category);

  const rawAnswer = {
    archetype,
    variant: forcedVariant,
    fields: {
      kicker,
      title,
      subtitle,
      bullets,
      date: date || '',
      time: time || '',
      venue: venueVal,
      cta,
      photoKeywords,
    },
    icon,
  };

  return sanitizeAndTruncateDesign(rawAnswer, {
    avoidRecipeIds,
    variant: forcedVariant,
    prompt: text,
    instruction,
  });
}


/**
 * Procedural mock generator for variants=3.
 * Returns 3 different text versions (different kicker, subtitle, bullets, and CTA, same facts).
 * Strictly preserves Tamil language and never invents date, time, venue, or price.
 */
export function generateMockVariants({ text = '', date = '', time = '', venue = '', instruction = '' } = {}) {
  const isTamil = /[\u0B80-\u0BFF]/.test(text);
  const clauses = text
    .split(/[\n;.]|(?:\s*[-–—]\s*)/)
    .map((c) => c.trim())
    .filter(Boolean);

  let mainTitle = '';
  if (isTamil) {
    const tamilClause = clauses.find((c) => /[\u0B80-\u0BFF]/.test(c) && c.length >= 3);
    mainTitle = tamilClause || clauses[0] || 'சிறப்பு நிகழ்வு';
  } else {
    const first = firstClauseOf(text);
    mainTitle = first.length > 5 ? first : 'Community Event';
  }

  const commonDate = date || '';
  const commonTime = time || '';
  const commonVenue = venue || 'Venue to be announced';

  if (isTamil) {
    return {
      variants: [
        {
          kicker: 'சிறப்பு நிகழ்வு',
          title: mainTitle,
          subtitle: 'அனைவரும் வருகை தந்து சிறப்பிக்க வேண்டுகிறோம்',
          bullets: ['இலவச அனுமதி', 'முன்பதிவு அவசியம்', 'சிறப்பு ஏற்பாடுகள் உண்டு'],
          date: commonDate,
          time: commonTime,
          venue: commonVenue,
          cta: 'அனைவரும் வருக',
          photoKeywords: 'community celebration event',
        },
        {
          kicker: 'முக்கிய அறிவிப்பு',
          title: mainTitle,
          subtitle: 'நம் சமூகத்தின் பெருமைமிகு கொண்டாட்டம்',
          bullets: ['அனைத்து வயதினருக்கும் அனுமதி', 'நேரலை மற்றும் சிறப்பு நிகழ்வுகள்', 'உடனடி பதிவு'],
          date: commonDate,
          time: commonTime,
          venue: commonVenue,
          cta: 'இன்றே பதியுங்கள்',
          photoKeywords: 'community celebration event',
        },
        {
          kicker: 'அன்புடன் அழைக்கிறோம்',
          title: mainTitle,
          subtitle: 'ஒன்றிணைவோம் மகிழ்வோம் சமூகமாய் வாழ்வோம்',
          bullets: ['சிறப்பு விருந்தினர்கள் பங்கேற்பு', 'சான்றிதழ் வழங்கப்படும்', 'உணவு வசதி செய்யப்பட்டுள்ளது'],
          date: commonDate,
          time: commonTime,
          venue: commonVenue,
          cta: 'பதிவு செய்ய',
          photoKeywords: 'community celebration event',
        },
      ],
    };
  }

  return {
    variants: [
      {
        kicker: 'Special Event',
        title: mainTitle,
        subtitle: 'Join us for an inspiring gathering and celebration',
        bullets: ['Registration open to everyone', 'Special guest presentations', 'Refreshments provided'],
        date: commonDate,
        time: commonTime,
        venue: commonVenue,
        cta: 'Open to all',
        photoKeywords: 'event celebration community',
      },
      {
        kicker: 'Community Showcase',
        title: mainTitle,
        subtitle: 'Experience extraordinary moments together with us',
        bullets: ['Interactive sessions and activities', 'Connect with community leaders', 'Certificates awarded'],
        date: commonDate,
        time: commonTime,
        venue: commonVenue,
        cta: 'Register today',
        photoKeywords: 'event people meeting',
      },
      {
        kicker: 'Official Invitation',
        title: mainTitle,
        subtitle: 'Mark your calendar for this exclusive gathering',
        bullets: ['All age groups welcome', 'Early arrivals get priority seating', 'Door prizes and giveaways'],
        date: commonDate,
        time: commonTime,
        venue: commonVenue,
        cta: 'Save your spot',
        photoKeywords: 'gathering conference celebration',
      },
    ],
  };
}

export async function generateWithMock({
  prompt,
  brandKit,
  template,
  instruction,
  variables = [],
  mode = 'content',
  avoidRecipeIds = [],
  variant = null,
  eventType = null,
  contentArea = null,
  variants = 1,
}) {
  const text = (prompt || '').trim();

  // 1. Extract Date
  let date = '';
  const dateMatch = text.match(
    /\b(\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)(?:\s*,?\s*\d{4})?)\b/i
  ) || text.match(
    /\b((?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?(?:\s*,?\s*\d{4})?)\b/i
  ) || text.match(
    /\b(on\s+([A-Za-z0-9,\s]+?)(?:,\s*|\s+at|\s+from|\s+in|$))/i
  );

  if (dateMatch) {
    date = (dateMatch[1] || dateMatch[2] || '').replace(/^on\s+/i, '').trim();
    if (date.length > 30) date = date.slice(0, 30);
  }

  // 2. Extract Time
  let time = '';
  const timeMatch = text.match(/\b(\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)(?:\s*-\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))?)\b/i);
  if (timeMatch) {
    time = timeMatch[1].trim();
  }

  // 3. Extract Venue
  let venue = extractVenue(text);
  if (!venue && /no\s+venue/i.test(text)) {
    venue = '';
  } else if (!venue) {
    venue = 'Venue to be announced';
  }

  // 3a. Mode "variants": 3 variants in ONE call
  if (mode === 'variants' || variants === 3) {
    return generateMockVariants({ text, date, time, venue, instruction });
  }

  // 3b. Mode "ai": one ready design, written from the same extracted facts.
  if (mode === 'design') {
    return designAnswer({ text, date, time, venue, avoidRecipeIds, variant, instruction });
  }

  // 3c. Mode "fill": AI Fill returns JSON ONLY for requested variable texts.
  if (mode === 'fill') {
    const slots = Array.isArray(variables) ? variables.filter((s) => s?.key) : [];
    const fillResult = {};
    const cleanVenue = venue === 'Venue to be announced' ? '' : venue;

    for (const slot of slots) {
      const key = slot.key;
      const k = key.toLowerCase();
      const lbl = (slot.label || '').toLowerCase();
      const max = Number(slot.maxLength) || 80;

      let val = '';
      if (k.includes('date') || lbl.includes('date')) {
        val = date;
      } else if (k.includes('time') || lbl.includes('time') || lbl.includes('hour')) {
        val = time;
      } else if (k.includes('venue') || k.includes('place') || k.includes('location') || lbl.includes('venue') || lbl.includes('location')) {
        val = cleanVenue;
      } else if (k.includes('kicker') || lbl.includes('kicker') || lbl.includes('category')) {
        val = extractKicker(text, '', matchCategoryFromText(text) || 'general', null);
      } else if (k.includes('title') || k.includes('headline') || lbl.includes('headline') || lbl.includes('title')) {
        if (k.includes('sub') || lbl.includes('sub')) {
          val = '';
        } else {
          const firstClause = firstClauseOf(text);
          val = firstClause.length > 3 ? firstClause : (text.slice(0, 40) || 'Event');
        }
      } else if (k.includes('subtitle') || lbl.includes('subtitle') || k.includes('tagline') || lbl.includes('tagline')) {
        val = extractSubtitle(text, '', matchCategoryFromText(text) || 'general', null);
      } else if (k.includes('cta') || lbl.includes('call to action') || lbl.includes('action')) {
        val = extractCta(text)?.line || '';
      } else if (k.includes('button') || lbl.includes('button')) {
        val = extractCta(text)?.button || '';
      } else if (k.includes('sponsor') || lbl.includes('sponsor')) {
        const sm = text.match(/\b(?:sponsor(?:ed by)?|partner(?:ed by)?)\s+([A-Za-z0-9\s,'&-]+?)(?:,\s*|\.\s*|\s+(?:on|at)\b|$)/i);
        val = sm ? sm[1].trim() : '';
      } else if (k.includes('hashtag') || lbl.includes('hashtag')) {
        const hm = text.match(/#([A-Za-z0-9_]+)/);
        val = hm ? hm[0] : '';
      } else {
        const km = text.match(new RegExp(`\\b${key}:?\\s+([^,\\n.]+)`, 'i'));
        val = km ? km[1].trim() : '';
      }

      fillResult[key] = sanitizeString(val).slice(0, max);
    }
    return fillResult;
  }

  // 4. Extract or derive Title
  let title = '';
  const lower = text.toLowerCase();
  if (lower.includes('sport') || lower.includes('athletic')) {
    title = 'Annual Sports Day';
  } else if (lower.includes('pongal')) {
    title = 'Tamil Pongal Harvest';
  } else if (lower.includes('cultural') || lower.includes('fest')) {
    title = 'Annual Cultural Fest';
  } else if (lower.includes('diwali') || lower.includes('deepavali')) {
    title = 'Diwali Night of Lights';
  } else if (lower.includes('blood donation')) {
    title = 'Blood Donation Camp';
  } else if (lower.includes('conference') || lower.includes('summit')) {
    title = 'Annual Leadership Summit';
  } else if (lower.includes('webinar') || lower.includes('workshop')) {
    title = 'Interactive Masterclass';
  } else if (lower.includes('hackathon')) {
    title = 'Developer Hackathon 2026';
  } else {
    const firstClause = firstClauseOf(text);
    title = firstClause.length > 5 ? firstClause : 'Featured Community Event';
  }
  title = title
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .slice(0, 60);

  // 5. Derive Kicker & Subtitle
  const sample = sampleFor(lower);
  const category = sample ? sample.category : (matchCategoryFromText(text) || 'general');
  let kicker = extractKicker(text, title, category, sample);
  let subtitle = extractSubtitle(text, title, category, sample);
  if (lower.includes('sport') || lower.includes('athletic')) {
    kicker = 'Cheer For Your Team';
    subtitle = 'A day of races, relays and records';
  } else if (lower.includes('pongal')) {
    kicker = 'Harvest Celebration';
    subtitle = 'Celebrating tradition, community and harvest';
  } else if (lower.includes('cultural') || lower.includes('fest')) {
    kicker = 'Annual Cultural Showcase';
    subtitle = 'Music, dance and dramatic performances';
  } else if (lower.includes('diwali')) {
    kicker = 'Festival Of Lights';
    subtitle = 'Lamps, music and sweets under one roof';
  } else if (lower.includes('blood donation')) {
    kicker = 'Give Blood Save Lives';
    subtitle = 'Give Blood, Share Life, Inspire Hope';
  } else if (lower.includes('tech') || lower.includes('code') || lower.includes('ai')) {
    kicker = 'Innovation Summit';
    subtitle = 'Architecting Scalable Autonomous Systems';
  } else if (lower.includes('health') || lower.includes('wellness') || lower.includes('yoga')) {
    kicker = 'Mind & Body Wellness';
    subtitle = 'Prioritizing Wellness for Every Individual';
  }

  // 6. Derive Details (3 items built from user words)
  let details = extractBullets(text).slice(0, 3);

  // 7. Derive CTA
  const cta = extractCta(text);

  // 8. Derive imageQuery
  let imageQuery = 'community event celebration';
  if (lower.includes('sport') || lower.includes('athletic') || lower.includes('run')) {
    imageQuery = 'sports running stadium athletes';
  } else if (lower.includes('pongal') || lower.includes('harvest')) {
    imageQuery = 'pongal harvest celebration festival';
  } else if (lower.includes('cultural') || lower.includes('fest')) {
    imageQuery = 'cultural festival stage dance';
  } else if (lower.includes('diwali') || lower.includes('light')) {
    imageQuery = 'diwali lamps festival lights';
  } else if (lower.includes('blood donation')) {
    imageQuery = 'blood donation volunteer medical';
  } else if (lower.includes('tech') || lower.includes('ai')) {
    imageQuery = 'technology engineering conference';
  }

  // 9. Fill template variable fields using kicker, subtitle, bullets, cta
  const extras = {};
  for (const slot of Array.isArray(variables) ? variables : []) {
    const key = typeof slot?.key === 'string' ? slot.key.trim() : '';
    if (!key) continue;
    const room = Math.max(10, Number(slot.maxLength) || 80);
    const k = key.toLowerCase();
    const lbl = (slot.label || '').toLowerCase();

    if (k.includes('sub') && (k.includes('title') || lbl.includes('above') || lbl.includes('kicker') || lbl.includes('lead'))) {
      extras[key] = kicker.slice(0, room);
    } else if (k.includes('subtitle') || lbl.includes('subtitle') || k.includes('tagline') || lbl.includes('tagline') || lbl.includes('under')) {
      extras[key] = subtitle.slice(0, room);
    } else if (k.includes('button') || lbl.includes('button')) {
      extras[key] = (cta.button || cta.line || 'Register now').slice(0, room);
    } else if (k.includes('cta') || lbl.includes('call') || lbl.includes('action')) {
      extras[key] = (cta.line || cta.button || 'Registration open').slice(0, room);
    } else if (k.includes('slogan') || lbl.includes('slogan')) {
      extras[key] = subtitle.slice(0, room);
    } else if (k.includes('bullet') || lbl.includes('bullet') || k.includes('detail') || lbl.includes('detail')) {
      extras[key] = (details[0] || '').slice(0, room);
    } else {
      extras[key] = '';
    }
  }

  const contentResult = {
    title,
    tagline: subtitle,
    date,
    time,
    venue,
    details,
    imageQuery,
    ...(Object.keys(extras).length ? { extras } : {}),
  };

  const ctaVal = typeof cta === 'string' ? cta : (cta?.button || 'Open to all');
  Object.defineProperties(contentResult, {
    cta: { value: { line: ctaVal, button: ctaVal }, writable: true, enumerable: false, configurable: true },
    subtitle: { value: subtitle, writable: true, enumerable: false, configurable: true },
    kicker: { value: kicker, writable: true, enumerable: false, configurable: true },
  });

  return contentResult;
}

export default { generateWithMock };
