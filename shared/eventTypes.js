/**
 * Event type configuration for PosterAI.
 *
 * Each type has:
 *   id        — snake_case identifier stored on templates and posters
 *   label     — plain-language name shown to non-technical users
 *   sections  — ordered list of content sections the AI may fill and the form shows
 *
 * Section kinds:
 *   field     — a single text field (title, date, time, venue, tagline, details)
 *   cardlist  — a repeating card of people / items (the user adds entries)
 *   photo     — a variable image slot (one per entry or standalone)
 *   text      — a free-text block (label + plain textarea, no card structure)
 *
 * min / max control how many entries are allowed for cardlist / photo sections.
 * For field/text sections min and max are the character limits (min defaults 0).
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

/**
 * All section ids that the AI is allowed to fill (field and text kinds only —
 * cardlist and photo entries are always supplied by the user, never invented).
 */
export const AI_FILLABLE_SECTION_KINDS = new Set(['field', 'text']);

/** Event types config map, keyed by id. */
export const EVENT_TYPES = {
  blood_camp: {
    id: 'blood_camp',
    label: 'Blood Donation Camp',
    sections: [
      { id: 'title',    kind: 'field', label: 'Event title',    min: 0, max: 60 },
      { id: 'date',     kind: 'field', label: 'Date',           min: 0, max: 30 },
      { id: 'time',     kind: 'field', label: 'Time',           min: 0, max: 20 },
      { id: 'venue',    kind: 'field', label: 'Venue',          min: 0, max: 80 },
      { id: 'tagline',  kind: 'field', label: 'Tagline',        min: 0, max: 100 },
      { id: 'details',  kind: 'field', label: 'Key highlights', min: 0, max: 4 },
    ],
  },

  birthday: {
    id: 'birthday',
    label: 'Birthday',
    sections: [
      { id: 'mainPhoto', kind: 'photo', label: 'Main photo',       min: 0, max: 1 },
      { id: 'name',      kind: 'field', label: "Person's name",    min: 0, max: 60 },
      { id: 'tagline',   kind: 'field', label: 'Wishes / tagline', min: 0, max: 100 },
      { id: 'details',   kind: 'field', label: 'Key highlights',   min: 0, max: 4 },
      { id: 'program',   kind: 'text',  label: 'Programme',        min: 0, max: 400 },
      { id: 'host',      kind: 'field', label: 'Hosted by',        min: 0, max: 80 },
    ],
  },

  award_function: {
    id: 'award_function',
    label: 'Award Function',
    sections: [
      { id: 'title',     kind: 'field',    label: 'Event title',     min: 0, max: 60 },
      { id: 'date',      kind: 'field',    label: 'Date',            min: 0, max: 30 },
      { id: 'time',      kind: 'field',    label: 'Time',            min: 0, max: 20 },
      { id: 'venue',     kind: 'field',    label: 'Venue',           min: 0, max: 80 },
      { id: 'guests',    kind: 'cardlist', label: 'Chief guests',    min: 0, max: 6 },
      { id: 'awardees',  kind: 'cardlist', label: 'Awardees',        min: 0, max: 12 },
      { id: 'committee', kind: 'cardlist', label: 'Organising team', min: 0, max: 12 },
      { id: 'details',   kind: 'field',    label: 'Key highlights',  min: 0, max: 4 },
    ],
  },

  sports_day: {
    id: 'sports_day',
    label: 'Sports Day',
    sections: [
      { id: 'title',    kind: 'field',    label: 'Event title',     min: 0, max: 60 },
      { id: 'date',     kind: 'field',    label: 'Date',            min: 0, max: 30 },
      { id: 'time',     kind: 'field',    label: 'Time',            min: 0, max: 20 },
      { id: 'venue',    kind: 'field',    label: 'Venue',           min: 0, max: 80 },
      { id: 'tagline',  kind: 'field',    label: 'Tagline',         min: 0, max: 100 },
      { id: 'committee',kind: 'cardlist', label: 'Organising team', min: 0, max: 12 },
      { id: 'details',  kind: 'field',    label: 'Key highlights',  min: 0, max: 4 },
    ],
  },

  school_annual_day: {
    id: 'school_annual_day',
    label: 'School Annual Day',
    sections: [
      { id: 'title',     kind: 'field',    label: 'Event title',        min: 0, max: 60 },
      { id: 'date',      kind: 'field',    label: 'Date',               min: 0, max: 30 },
      { id: 'time',      kind: 'field',    label: 'Time',               min: 0, max: 20 },
      { id: 'venue',     kind: 'field',    label: 'Venue',              min: 0, max: 80 },
      { id: 'guests',    kind: 'cardlist', label: 'Chief guests',       min: 0, max: 6 },
      { id: 'committee', kind: 'cardlist', label: 'Organising team',    min: 0, max: 12 },
      { id: 'program',   kind: 'text',     label: 'Programme schedule', min: 0, max: 600 },
      { id: 'details',   kind: 'field',    label: 'Key highlights',     min: 0, max: 4 },
    ],
  },

  temple_festival: {
    id: 'temple_festival',
    label: 'Temple Festival',
    sections: [
      { id: 'title',    kind: 'field',    label: 'Festival name',   min: 0, max: 60 },
      { id: 'date',     kind: 'field',    label: 'Date',            min: 0, max: 30 },
      { id: 'time',     kind: 'field',    label: 'Time',            min: 0, max: 20 },
      { id: 'venue',    kind: 'field',    label: 'Venue / temple',  min: 0, max: 80 },
      { id: 'tagline',  kind: 'field',    label: 'Tagline',         min: 0, max: 100 },
      { id: 'committee',kind: 'cardlist', label: 'Organising team', min: 0, max: 12 },
      { id: 'program',  kind: 'text',     label: 'Programme',       min: 0, max: 600 },
      { id: 'details',  kind: 'field',    label: 'Key highlights',  min: 0, max: 4 },
    ],
  },

  wedding: {
    id: 'wedding',
    label: 'Wedding',
    sections: [
      { id: 'title',    kind: 'field', label: 'Bride & Groom names', min: 0, max: 60 },
      { id: 'date',     kind: 'field', label: 'Wedding date',        min: 0, max: 30 },
      { id: 'time',     kind: 'field', label: 'Time',                min: 0, max: 20 },
      { id: 'venue',    kind: 'field', label: 'Venue',               min: 0, max: 80 },
      { id: 'tagline',  kind: 'field', label: 'Wishes / tagline',    min: 0, max: 100 },
      { id: 'mainPhoto',kind: 'photo', label: 'Couple photo',        min: 0, max: 1 },
      { id: 'details',  kind: 'field', label: 'Key details',         min: 0, max: 4 },
    ],
  },

  workshop: {
    id: 'workshop',
    label: 'Workshop / Seminar',
    sections: [
      { id: 'title',    kind: 'field',    label: 'Workshop title',   min: 0, max: 60 },
      { id: 'date',     kind: 'field',    label: 'Date',             min: 0, max: 30 },
      { id: 'time',     kind: 'field',    label: 'Time',             min: 0, max: 20 },
      { id: 'venue',    kind: 'field',    label: 'Venue',            min: 0, max: 80 },
      { id: 'tagline',  kind: 'field',    label: 'Tagline',          min: 0, max: 100 },
      { id: 'guests',   kind: 'cardlist', label: 'Speakers',         min: 0, max: 6 },
      { id: 'program',  kind: 'text',     label: 'Agenda / topics',  min: 0, max: 600 },
      { id: 'details',  kind: 'field',    label: 'Key highlights',   min: 0, max: 4 },
    ],
  },

  meeting: {
    id: 'meeting',
    label: 'Meeting / Assembly',
    sections: [
      { id: 'title',   kind: 'field', label: 'Meeting title',   min: 0, max: 60 },
      { id: 'date',    kind: 'field', label: 'Date',            min: 0, max: 30 },
      { id: 'time',    kind: 'field', label: 'Time',            min: 0, max: 20 },
      { id: 'venue',   kind: 'field', label: 'Venue',           min: 0, max: 80 },
      { id: 'tagline', kind: 'field', label: 'Tagline',         min: 0, max: 100 },
      { id: 'details', kind: 'field', label: 'Key highlights',  min: 0, max: 4 },
    ],
  },

  general: {
    id: 'general',
    label: 'General Event',
    sections: [
      { id: 'title',    kind: 'field', label: 'Event title',    min: 0, max: 60 },
      { id: 'date',     kind: 'field', label: 'Date',           min: 0, max: 30 },
      { id: 'time',     kind: 'field', label: 'Time',           min: 0, max: 20 },
      { id: 'venue',    kind: 'field', label: 'Venue',          min: 0, max: 80 },
      { id: 'tagline',  kind: 'field', label: 'Tagline',        min: 0, max: 100 },
      { id: 'details',  kind: 'field', label: 'Key highlights', min: 0, max: 4 },
    ],
  },
};

/** Returns all event types as an array, in a stable display order. */
export function allEventTypes() {
  return EVENT_TYPE_IDS.map((id) => EVENT_TYPES[id]);
}

/**
 * Returns the config for a given event type id, or undefined if unknown.
 * Case-insensitive and trims whitespace.
 */
export function eventTypeById(id) {
  const key = typeof id === 'string' ? id.trim().toLowerCase() : '';
  return EVENT_TYPES[key];
}

/**
 * Returns true when the given id is a known event type.
 */
export function isValidEventType(id) {
  return Boolean(eventTypeById(id));
}

/**
 * The sections of an event type filtered to only those the AI may fill
 * (field and text kinds). Cardlist and photo sections are always user-supplied.
 */
export function aiSectionsOf(eventType) {
  const cfg = typeof eventType === 'string' ? eventTypeById(eventType) : eventType;
  if (!cfg) return [];
  return cfg.sections.filter((s) => AI_FILLABLE_SECTION_KINDS.has(s.kind));
}

/**
 * Given a user description, guess the most likely event type.
 * Returns an event type id string. Falls back to 'general'.
 *
 * This is a pure keyword heuristic — no AI call. The AI confirm step on the
 * server may override this with a better guess.
 */
export function guessEventType(description) {
  if (!description || typeof description !== 'string') return 'general';
  const text = description.toLowerCase();

  const rules = [
    { id: 'blood_camp',       keywords: ['blood', 'donation camp', 'blood camp', 'blood drive'] },
    { id: 'birthday',         keywords: ['birthday', 'birth day', "happy birthday", 'bday', 'பிறந்தநாள்'] },
    { id: 'award_function',   keywords: ['award', 'prize', 'felicitation', 'honour', 'recognition', 'achievement'] },
    { id: 'sports_day',       keywords: ['sports', 'athletic', 'games day', 'tournament', 'match', 'race', 'நாள்'] },
    { id: 'school_annual_day',keywords: ['annual day', 'school day', 'graduation', 'convocation', 'valedictory'] },
    { id: 'temple_festival',  keywords: ['temple', 'festival', 'puja', 'pooja', 'thiruvizha', 'குரு பூஜை', 'உத்சவம்'] },
    { id: 'wedding',          keywords: ['wedding', 'marriage', 'திருமணம்', 'bride', 'groom', 'kalyanam'] },
    { id: 'workshop',         keywords: ['workshop', 'seminar', 'training', 'webinar', 'session', 'conference'] },
    { id: 'meeting',          keywords: ['meeting', 'assembly', 'general body', 'gbm', 'agm', 'அமர்வு'] },
  ];

  for (const rule of rules) {
    if (rule.keywords.some((kw) => text.includes(kw))) {
      return rule.id;
    }
  }
  return 'general';
}
