/**
 * Event type configuration for PosterAI.
 */

export const EVENT_TYPE_IDS = [
  'blood_camp',
  'birthday',
  'award_function',
  'sports_day',
  'school_annual_day',
  'temple_festival',
  'wedding',
  'workshop',
  'meeting',
  'general',
];

export const AI_FILLABLE_SECTION_KINDS = new Set(['field', 'text']);

export const EVENT_TYPES = Object.fromEntries(
  EVENT_TYPE_IDS.map((id) => [
    id,
    {
      id,
      label: id.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      neededSections: ['hero', 'info', 'message', 'cta'],
      sections: [
        { id: 'title', kind: 'field', label: 'Event title', min: 0, max: 60 },
        { id: 'date', kind: 'field', label: 'Date', min: 0, max: 30 },
        { id: 'time', kind: 'field', label: 'Time', min: 0, max: 20 },
        { id: 'venue', kind: 'field', label: 'Venue', min: 0, max: 80 },
        { id: 'tagline', kind: 'field', label: 'Tagline', min: 0, max: 100 },
        { id: 'details', kind: 'field', label: 'Key highlights', min: 0, max: 4 },
      ],
    },
  ])
);

export function eventTypeById(id) {
  const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
  return EVENT_TYPES[key];
}

export function isValidEventType(id) {
  return Boolean(eventTypeById(id));
}

export function aiSectionsOf(eventType) {
  const cfg = typeof eventType === 'string' ? eventTypeById(eventType) : eventType;
  if (!cfg) return [];
  return cfg.sections.filter((s) => AI_FILLABLE_SECTION_KINDS.has(s.kind));
}

export function guessEventType(description) {
  if (!description || typeof description !== 'string') return 'general';
  const text = description.toLowerCase();

  const rules = [
    { id: 'blood_camp', keywords: ['blood', 'donation camp', 'blood camp', 'blood drive'] },
    { id: 'birthday', keywords: ['birthday', 'birth day', 'happy birthday', 'bday'] },
    { id: 'award_function', keywords: ['award', 'prize', 'felicitation', 'recognition'] },
    { id: 'sports_day', keywords: ['sports', 'athletic', 'tournament', 'match', 'race'] },
    { id: 'school_annual_day', keywords: ['annual day', 'school day', 'graduation', 'convocation'] },
    { id: 'temple_festival', keywords: ['temple', 'festival', 'puja', 'pooja'] },
    { id: 'wedding', keywords: ['wedding', 'marriage', 'bride', 'groom'] },
    { id: 'workshop', keywords: ['workshop', 'seminar', 'training', 'webinar'] },
    { id: 'meeting', keywords: ['meeting', 'assembly', 'conference'] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.id;
    }
  }
  return 'general';
}

export function neededSectionsFor(eventType) {
  const cfg = typeof eventType === 'string' ? eventTypeById(eventType) : eventType;
  return cfg?.neededSections || ['hero', 'info', 'message', 'cta'];
}
