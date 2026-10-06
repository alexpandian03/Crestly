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
    slogan: { line1: 'One hour today', line2: 'A lifetime for someone else' },
    bullets: [
      'Free health checkup for every donor',
      'Donor certificate and refreshments',
      'Run by certified medical professionals',
    ],
    cta: { line: 'Register at the front desk', button: 'Sign up to donate' },
    imageQuery: 'blood donation volunteer medical',
  },
  {
    match: ['tree', 'plant', 'environment'],
    category: 'awareness',
    title: { main: 'Tree Planting Drive', sub: 'Grow the city we share' },
    tagline: 'Small hands, greener tomorrows',
    slogan: { line1: 'Plant one tree', line2: 'Leave the air a little cleaner' },
    bullets: [
      'Tools and saplings are provided',
      'Volunteers meet at the main gate',
      'Certificates for school groups',
    ],
    cta: { line: 'Bring your family along', button: 'Join the drive' },
    imageQuery: 'tree planting volunteer garden',
  },
  {
    match: ['diwali', 'deepavali', 'lights festival'],
    category: 'festival',
    title: { main: 'Diwali Night of Lights', sub: 'An evening for the whole family' },
    tagline: 'Lamps, music and sweets under one roof',
    slogan: { line1: 'Light a lamp', line2: 'Share a moment of joy' },
    bullets: [
      'Rangoli and lantern stalls',
      'Live classical music',
      'Sweets for every guest',
    ],
    cta: { line: 'Doors open in the evening', button: 'Come celebrate' },
    imageQuery: 'diwali lamps festival lights',
  },
  {
    match: ['sports', 'marathon', 'tournament', 'cricket', 'run'],
    category: 'sports',
    title: { main: 'Annual Sports Day', sub: 'Cheer for your team' },
    tagline: 'A day of races, relays and records',
    slogan: { line1: 'Run together', line2: 'Cheer louder' },
    bullets: [
      'Track and field events all morning',
      'Team relays after lunch',
      'Prize ceremony at the close',
    ],
    cta: { line: 'Wear your team colours', button: 'Enter a team' },
    imageQuery: 'sports running stadium athletes',
  },
  {
    match: ['award', 'awards', 'honour', 'recognition', 'gala'],
    category: 'celebration',
    title: { main: 'Excellence Awards Night', sub: 'Celebrating what we built' },
    tagline: 'An evening of thanks and recognition',
    slogan: { line1: 'Names that made the year', line2: 'A room full of thanks' },
    bullets: [
      'Twelve categories, one stage',
      'Guest of honour address',
      'Dinner follows the ceremony',
    ],
    cta: { line: 'Tables seat eight', button: 'Reserve a seat' },
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

/** Deterministic by keyword: the same description always gives the same design and words. */
function designAnswer({ text, date, time, venue, avoidRecipeIds, variant }) {
  const lower = text.toLowerCase();
  const sample = sampleFor(lower);
  const category = sample ? sample.category : 'general';
  const avoided = avoidSet(avoidRecipeIds);
  const suited = designsFor(category).filter((design) => !avoided.has(design.id));
  const design = suited.length > 0 ? suited[0] : designsFor(category)[0];
  const forced = RECIPE_VARIANTS.includes(Number(variant)) ? Number(variant) : 0;
  /* The mark reads the words of the event first and the kind of event only as a fallback, so an
     awards night never gets the parcel a gift fair gets. */
  const words = [text, venue].filter(Boolean).join(' ');

  if (!sample) {
    const headline = firstClauseOf(text);
    return {
      recipeId: design.id,
      variant: forced,
      title: { main: headline.length > 5 ? headline : 'Featured Community Event', sub: '' },
      tagline: 'Empowering communities, transforming futures',
      slogan: { line1: 'Together we can', line2: 'make it happen' },
      bullets: ['Everyone is welcome'],
      info: { date, time, venue },
      cta: { line: 'Find out more with our team', button: 'Join us' },
      icon: iconForWords(words, category),
      imageQuery: 'community event celebration',
    };
  }

  return {
    recipeId: design.id,
    variant: forced,
    title: { main: sample.title.main, sub: sample.title.sub },
    tagline: sample.tagline,
    slogan: sample.slogan,
    bullets: sample.bullets,
    info: { date, time, venue },
    cta: sample.cta,
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
  let venue = '';
  const venueMatch = text.match(/(?:at|in|venue:?)\s+([A-Z][A-Za-z0-9\s,'-]+?)(?:,\s*|\.|$)/i) ||
                     text.match(/Town\s+Hall|Civic\s+Center|Convention\s+Center|Auditorium|Main\s+Campus|Room\s+\d+/i);
  if (venueMatch) {
    venue = (venueMatch[1] || venueMatch[0] || '').trim();
    if (venue.length > 80) venue = venue.slice(0, 80);
  }

  // 3b. Mode "ai": one ready design, written from the same extracted facts.
  if (mode === 'design') {
    return designAnswer({ text, date, time, venue, avoidRecipeIds, variant });
  }

  // 4. Extract or derive Title
  let title = '';
  // Check for common event phrases
  const lower = text.toLowerCase();
  if (lower.includes('blood donation')) {
    title = 'Blood Donation Camp';
  } else if (lower.includes('conference') || lower.includes('summit')) {
    title = 'Annual Leadership Summit';
  } else if (lower.includes('webinar') || lower.includes('workshop')) {
    title = 'Interactive Masterclass';
  } else if (lower.includes('hackathon')) {
    title = 'Developer Hackathon 2026';
  } else {
    // Take the first clause before comma or preposition
    const firstClause = firstClauseOf(text);
    title = firstClause.length > 5 ? firstClause : 'Featured Community Event';
  }
  // Capitalize title
  title = title
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ')
    .slice(0, 60);

  // 5. Derive Tagline
  let tagline = 'Empowering Communities, Transforming Futures';
  if (lower.includes('blood donation')) {
    tagline = 'Give Blood, Share Life, Inspire Hope';
  } else if (lower.includes('tech') || lower.includes('code') || lower.includes('ai')) {
    tagline = 'Architecting Scalable Autonomous Systems';
  } else if (lower.includes('health') || lower.includes('wellness')) {
    tagline = 'Prioritizing Wellness for Every Individual';
  }

  // 6. Derive Details (max 4 items)
  let details = [
    'Complimentary registration and participation certificate',
    'Interactive keynote and practical walkthroughs',
    'Networking session with industry practitioners',
  ];

  if (lower.includes('blood donation')) {
    details = [
      'Free comprehensive health checkup for all donors',
      'Official donor certificate and recognition badge',
      'Nutritious refreshments provided post-donation',
      'Supported by certified medical professionals',
    ];
  } else if (instruction === 'shorter' || instruction === 'minimal') {
    details = ['Join our exclusive session', 'Free registration'];
  }

  // 7. Derive imageQuery
  let imageQuery = 'community event celebration';
  if (lower.includes('blood donation')) {
    imageQuery = 'blood donation volunteer medical';
  } else if (lower.includes('tech') || lower.includes('ai')) {
    imageQuery = 'technology engineering conference';
  } else if (lower.includes('music') || lower.includes('concert')) {
    imageQuery = 'music concert stage lights';
  }

  // 8. Fill the blanks this template leaves, one labelled sample line each.
  const extras = {};
  for (const slot of Array.isArray(variables) ? variables : []) {
    const key = typeof slot?.key === 'string' ? slot.key.trim() : '';
    if (!key) continue;
    const room = Math.max(10, Number(slot.maxLength) || 80);
    extras[key] = `Sample ${slot.label || key}`.slice(0, room);
  }

  return {
    title,
    tagline,
    date,
    time,
    venue,
    details,
    imageQuery,
    ...(Object.keys(extras).length ? { extras } : {}),
  };
}

export default { generateWithMock };
