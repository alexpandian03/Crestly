import { designsFor, recipeIds, RECIPE_VARIANTS } from '../../../../shared/designRecipes.js';
import { iconForWords } from '../../../../shared/templateElements.js';

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
    'school ground', 'college ground', 'town square', 'city center', 'city centre',
    'town hall', 'main stadium', 'campus auditorium', 'auditorium', 'community grounds',
    'grand ballroom', 'green valley park', 'central park', 'sports complex'
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

/** Turn phrases like "Include registration desk and medals" into up to 3 short bullets (<=6 words). */
export function extractBullets(text, fallbackBullets = []) {
  const t = String(text || '').trim();
  const includeMatch = t.match(/\b(?:include|including|featuring|with)\s+([A-Za-z0-9\s,'&/-]+?)(?:\.|$|(?:\s+on\s+\d+)|\s+at\s+[A-Z])/i);
  if (includeMatch) {
    const rawPhrase = includeMatch[1].trim();
    const parts = rawPhrase
      .split(/,|\band\b|&/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 2 && !/^(?:on|at|from)\s+/i.test(p));
    if (parts.length > 0) {
      return parts.slice(0, 3).map((part) => {
        let p = part;
        if (/^medals\b/i.test(p) && !/for/i.test(p)) {
          p = 'Medals for winners';
        }
        const words = p.split(/\s+/).filter(Boolean);
        const capped = words.map((w, i) => (i === 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w)).join(' ');
        return capped.split(/\s+/).slice(0, 6).join(' ');
      });
    }
  }
  return (fallbackBullets || []).slice(0, 3).map((b) => {
    const w = String(b || '').trim().split(/\s+/).filter(Boolean);
    return w.slice(0, 6).join(' ');
  });
}

/** Extract CTA text from the description, never using "JOIN US", "COME CELEBRATE" or "FIND OUT MORE". */
export function extractCta(text) {
  const t = String(text || '').trim();
  const deskMatch = t.match(/\b([A-Za-z\s]*?desk[A-Za-z0-9\s]*?(?:from\s+\d+\s*(?:AM|PM|am|pm))?)\b/i);
  if (deskMatch) {
    const w = deskMatch[1].trim();
    const cap = w.charAt(0).toUpperCase() + w.slice(1);
    return { line: '', button: cap };
  }
  const regMatch = t.match(/\b(registration\s+[A-Za-z0-9\s]+?(?:from\s+\d+\s*(?:AM|PM|am|pm))?)\b/i);
  if (regMatch) {
    const w = regMatch[1].trim();
    const cap = w.charAt(0).toUpperCase() + w.slice(1);
    return { line: '', button: cap };
  }
  const lower = t.toLowerCase();
  if (lower.includes('sport') || lower.includes('athletic')) {
    return { line: 'Registration desk open from 7 AM', button: 'Registration desk open from 7 AM' };
  }
  if (lower.includes('diwali') || lower.includes('market') || lower.includes('festival')) {
    return { line: 'Stalls and entry open for all', button: 'Stalls open from 5 PM' };
  }
  if (lower.includes('blood') || lower.includes('donation')) {
    return { line: 'Registration desk at front entrance', button: 'Register at the front desk' };
  }
  if (lower.includes('award')) {
    return { line: 'Reception and seating from 6 PM', button: 'Reception starts at 6 PM' };
  }
  if (lower.includes('cultural') || lower.includes('fest')) {
    return { line: 'Registration desk open from 9 AM', button: 'Registration desk open from 9 AM' };
  }
  if (lower.includes('pongal')) {
    return { line: 'Community celebrations begin at sunrise', button: 'Entry open for all families' };
  }
  if (lower.includes('yoga')) {
    return { line: 'Morning session begins at 6 AM', button: 'Entry open for all participants' };
  }
  return { line: 'Registration desk open at entrance', button: 'Registration desk open at entrance' };
}

/** Deterministic by keyword: the same description always gives the same design and words. */
function designAnswer({ text, date, time, venue, avoidRecipeIds, variant }) {
  const lower = text.toLowerCase();
  const sample = sampleFor(lower);
  const category = sample ? sample.category : 'general';
  const avoided = avoidSet(avoidRecipeIds);
  const suited = designsFor(category).filter((design) => !avoided.has(design.id));

  // For events with photos (sports, cultural fest, festival, harvest/pongal, or having image query), prioritize photo recipes
  const wantsPhoto = lower.includes('sport') || lower.includes('fest') || lower.includes('pongal') || lower.includes('cultural') || lower.includes('blood') || lower.includes('diwali') || Boolean(sample?.imageQuery);
  let design;
  if (wantsPhoto) {
    const photoDesign = suited.find((d) => d.needsPhoto);
    design = photoDesign || (suited.length > 0 ? suited[0] : designsFor(category)[0]);
  } else {
    design = suited.length > 0 ? suited[0] : designsFor(category)[0];
  }

  const forced = RECIPE_VARIANTS.includes(Number(variant)) ? Number(variant) : 0;
  const words = [text, venue].filter(Boolean).join(' ');
  const venueVal = venue || 'Venue to be announced';
  const cta = extractCta(text);

  if (!sample) {
    const headline = firstClauseOf(text);
    const bullets = extractBullets(text, ['Everyone is welcome to join']);
    return {
      recipeId: design.id,
      variant: forced,
      title: { main: headline.length > 5 ? headline : 'Featured Community Event', sub: '' },
      tagline: 'Empowering communities, transforming futures',
      slogan: { line1: '', line2: '' },
      bullets,
      info: { date, time, venue: venueVal },
      cta,
      icon: iconForWords(words, category),
      imageQuery: lower.includes('pongal')
        ? 'pongal harvest celebration festival'
        : lower.includes('cultural')
          ? 'cultural festival celebration stage'
          : 'community event celebration',
    };
  }

  const bullets = extractBullets(text, sample.bullets);

  return {
    recipeId: design.id,
    variant: forced,
    title: { main: sample.title.main, sub: sample.title.sub },
    tagline: sample.tagline,
    slogan: sample.slogan || { line1: '', line2: '' },
    bullets,
    info: { date, time, venue: venueVal },
    cta,
    icon: iconForWords([words, sample.title.main, sample.imageQuery].join(' '), category),
    imageQuery: sample.imageQuery,
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

  // 3b. Mode "ai": one ready design, written from the same extracted facts.
  if (mode === 'design') {
    return designAnswer({ text, date, time, venue, avoidRecipeIds, variant });
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
  let kicker = 'Featured Event';
  let subtitle = 'Empowering Communities, Transforming Futures';
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
  let details = extractBullets(text, [
    'Complimentary registration and certificate',
    'Interactive keynote and practical walkthroughs',
    'Networking session with industry practitioners',
  ]).slice(0, 3);

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

  return {
    title,
    tagline: subtitle,
    subtitle,
    kicker,
    date,
    time,
    venue,
    details,
    cta,
    imageQuery,
    ...(Object.keys(extras).length ? { extras } : {}),
  };
}

export default { generateWithMock };
