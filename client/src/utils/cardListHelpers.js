import { VARIABLE_LIMITS } from '../../../shared/templateElements.js';

function _toInt(val, fallback = 0) {
  const n = parseInt(val, 10);
  return Number.isFinite(n) ? n : fallback;
}

function _clamp(val, min, max) {
  return Math.min(Math.max(val, min), max);
}

/**
 * Derives a friendly singular noun from a plural card list label.
 * E.g. "Speakers" -> "speaker", "Guests" -> "guest", "Team" -> "team member".
 */
export function singularLabel(label) {
  const clean = String(label || '').trim();
  if (!clean) return 'person';
  const lower = clean.toLowerCase();

  const known = {
    speakers: 'speaker',
    guests: 'guest',
    sponsors: 'sponsor',
    partners: 'partner',
    sessions: 'session',
    tracks: 'track',
    team: 'team member',
    members: 'member',
    panelists: 'panelist',
    presenters: 'presenter',
    performers: 'performer',
    artists: 'artist',
    mentors: 'mentor',
    judges: 'judge',
    winners: 'winner',
    organizers: 'organizer',
    hosts: 'host',
    attendees: 'attendee',
    people: 'person',
  };

  if (known[lower]) return known[lower];
  if (lower.endsWith('ies')) return lower.slice(0, -3) + 'y';
  if (lower.endsWith('ses')) return lower.slice(0, -2);
  if (lower.endsWith('s') && !lower.endsWith('ss')) return lower.slice(0, -1);
  return lower;
}

export const SAMPLE_NAMES = [
  'Dr. Jane Smith',
  'Alex Rivera',
  'Taylor Chen',
  'Morgan Lee',
  'Sam Jordan',
];

export const SAMPLE_ROLES = [
  'Keynote Speaker',
  'Design Director',
  'Lead Architect',
  'Product VP',
  'Research Fellow',
];

export const SAMPLE_BIOS = [
  'Pioneering AI interfaces and machine creativity.',
  'Award-winning product designer and strategist.',
  'Building distributed systems at global scale.',
  'Leading user-centric mobile experiences.',
  'Author, researcher and systems practitioner.',
];

export const SAMPLE_TIMES = [
  '09:00 AM',
  '11:30 AM',
  '02:00 PM',
  '03:45 PM',
  '05:15 PM',
];

export const SAMPLE_TITLES = [
  'Future of Creative Tools',
  'Designing at Hyper-Scale',
  'Engineering Resilience',
  'Creative Systems & Culture',
  'Open Platforms & Growth',
];

export const SAMPLE_COMPANIES = [
  'Acme Labs',
  'Design Co',
  'Global Tech',
  'Future Studio',
  'Apex Innovations',
];

export const SAMPLE_PHOTOS = [
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=400&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&auto=format&fit=crop&q=80',
];

/**
 * Generates realistic sample entries for card list preview.
 * @param {object} card - card definition with fields
 * @param {number} count - number of entries to generate (2, 3, or 5)
 */
export function makeSampleEntries(card, count = 3) {
  const fields = Array.isArray(card?.fields) ? card.fields : [];
  const safeCount = Math.max(1, Math.min(12, Number(count) || 3));
  const result = [];

  for (let i = 0; i < safeCount; i++) {
    const entry = {};
    fields.forEach((f) => {
      const key = f.key || '';
      const type = f.type || 'text';
      if (type === 'image') {
        entry[key] = SAMPLE_PHOTOS[i % SAMPLE_PHOTOS.length];
        return;
      }
      const k = key.toLowerCase();
      if (k.includes('time')) {
        entry[key] = SAMPLE_TIMES[i % SAMPLE_TIMES.length];
      } else if (k.includes('title') || k.includes('topic') || k.includes('session')) {
        entry[key] = SAMPLE_TITLES[i % SAMPLE_TITLES.length];
      } else if (k.includes('role') || k.includes('position') || k.includes('headline')) {
        entry[key] = SAMPLE_ROLES[i % SAMPLE_ROLES.length];
      } else if (k.includes('company') || k.includes('org') || k.includes('sponsor')) {
        entry[key] = SAMPLE_COMPANIES[i % SAMPLE_COMPANIES.length];
      } else if (k.includes('bio') || k.includes('desc')) {
        entry[key] = SAMPLE_BIOS[i % SAMPLE_BIOS.length];
      } else if (k.includes('name') || k.includes('speaker') || k.includes('person') || k.includes('author')) {
        entry[key] = SAMPLE_NAMES[i % SAMPLE_NAMES.length];
      } else {
        entry[key] = `${f.label || f.key} ${i + 1}`;
      }
    });
    result.push(entry);
  }

  return result;
}

/**
 * Intelligently tidies raw pasted strings into structured card entries.
 * Strictly extracts data from what the user pasted without inventing any facts or names.
 *
 * @param {string} text - Raw text pasted by user
 * @param {Array} fields - Card field definitions [{ key, type, label, maxLength }]
 * @param {number} maxCount - Max entries allowed
 * @returns {{ entries: Array, count: number }}
 */
export function tidyPastedText(text, fields = [], maxCount = 12) {
  const raw = String(text || '').trim();
  if (!raw) return { entries: [], count: 0 };

  const textFields = (fields || []).filter((f) => f.type !== 'image');
  if (!textFields.length) return { entries: [], count: 0 };

  // Split into raw non-empty lines
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (!lines.length) return { entries: [], count: 0 };

  const entries = [];
  const limit = Math.max(1, Math.min(12, Number(maxCount) || 12));

  // Helper to clean leading bullets and numbers
  const cleanLine = (str) => {
    return str
      .replace(/^[-•*–—\s]+\s*/, '') // bullets
      .replace(/^\[?\d+[.)\]]\s*/, '') // numbers: "1.", "1)", "[1]"
      .trim();
  };

  // Determine if lines contain separators like tabs, dashes, colons, or pipes
  for (const line of lines) {
    if (entries.length >= limit) break;
    const cleaned = cleanLine(line);
    if (!cleaned) continue;

    let parts = [];
    if (cleaned.includes('\t')) {
      parts = cleaned.split('\t').map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(' | ')) {
      parts = cleaned.split(' | ').map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(' - ') || cleaned.includes(' – ') || cleaned.includes(' — ')) {
      parts = cleaned.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(': ') && !cleaned.toLowerCase().startsWith('http')) {
      parts = cleaned.split(/:\s+/).map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(', ') && textFields.length > 1) {
      parts = cleaned.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
    } else {
      parts = [cleaned];
    }

    const entry = {};
    textFields.forEach((f, idx) => {
      const partVal = parts[idx] || '';
      const maxL = f.maxLength || VARIABLE_LIMITS.maxLength.default;
      entry[f.key] = partVal.slice(0, maxL).trim();
    });

    // Also initialize any image fields with empty string
    fields.forEach((f) => {
      if (f.type === 'image' && entry[f.key] === undefined) {
        entry[f.key] = '';
      }
    });

    entries.push(entry);
  }

  return { entries, count: entries.length };
}

/**
 * Standard preset card lists for quick start in the template editor.
 */
export const CARD_LIST_PRESETS = [
  {
    id: 'preset-speakers',
    label: 'Speakers / People',
    description: 'Photo avatar, speaker name, and title/role',
    data: {
      key: 'speakers',
      label: 'Speakers',
      hint: 'Add event speakers, their names and roles',
      columns: 2,
      gapX: 20,
      gapY: 16,
      minCount: 0,
      maxCount: 8,
      align: 'center',
      previewCount: 2,
      card: {
        w: 420,
        h: 140,
        fields: [
          { key: 'photo', type: 'image', label: 'Photo' },
          { key: 'name', type: 'text', label: 'Name', maxLength: 30 },
          { key: 'role', type: 'text', label: 'Title', maxLength: 40 },
        ],
        items: [
          {
            id: 'c-bg',
            kind: 'shape',
            shape: { type: 'rect', fill: '#f8fafc' },
            style: { radius: 12, border: '#e2e8f0', strokeWidth: 1 },
            x: 0,
            y: 0,
            w: 420,
            h: 140,
          },
          {
            id: 'c-photo',
            kind: 'image',
            fieldKey: 'photo',
            imageUrl: '{{photo}}',
            mask: 'circle',
            style: { radius: 45, fit: 'cover' },
            x: 20,
            y: 25,
            w: 90,
            h: 90,
          },
          {
            id: 'c-name',
            kind: 'text',
            fieldKey: 'name',
            text: '{{name}}',
            style: { fontFamily: 'brand:heading', size: 20, weight: 700, color: 'brand:heading', align: 'left' },
            x: 130,
            y: 35,
            w: 270,
            h: 32,
          },
          {
            id: 'c-role',
            kind: 'text',
            fieldKey: 'role',
            text: '{{role}}',
            style: { fontFamily: 'brand:body', size: 14, weight: 500, color: 'brand:text', opacity: 0.8, align: 'left' },
            x: 130,
            y: 72,
            w: 270,
            h: 28,
          },
        ],
      },
    },
  },
  {
    id: 'preset-schedule',
    label: 'Schedule / Sessions',
    description: 'Time badge, session name, and presenter',
    data: {
      key: 'schedule',
      label: 'Schedule',
      hint: 'Add time slots, session topics and speakers',
      columns: 2,
      gapX: 16,
      gapY: 14,
      minCount: 0,
      maxCount: 8,
      align: 'left',
      previewCount: 2,
      card: {
        w: 420,
        h: 120,
        fields: [
          { key: 'time', type: 'text', label: 'Time', maxLength: 20 },
          { key: 'title', type: 'text', label: 'Session', maxLength: 40 },
          { key: 'speaker', type: 'text', label: 'Speaker', maxLength: 30 },
        ],
        items: [
          {
            id: 'c-bg',
            kind: 'shape',
            shape: { type: 'rect', fill: '#f8fafc' },
            style: { radius: 10, border: '#e2e8f0', strokeWidth: 1 },
            x: 0,
            y: 0,
            w: 420,
            h: 120,
          },
          {
            id: 'c-time-pill',
            kind: 'shape',
            shape: { type: 'rect', fill: 'brand:primary' },
            style: { radius: 6 },
            x: 18,
            y: 18,
            w: 80,
            h: 24,
          },
          {
            id: 'c-time',
            kind: 'text',
            fieldKey: 'time',
            text: '{{time}}',
            style: { fontFamily: 'brand:body', size: 11, weight: 700, color: '#ffffff', align: 'center' },
            x: 18,
            y: 20,
            w: 80,
            h: 20,
          },
          {
            id: 'c-title',
            kind: 'text',
            fieldKey: 'title',
            text: '{{title}}',
            style: { fontFamily: 'brand:heading', size: 16, weight: 700, color: 'brand:heading', align: 'left' },
            x: 110,
            y: 18,
            w: 290,
            h: 26,
          },
          {
            id: 'c-speaker',
            kind: 'text',
            fieldKey: 'speaker',
            text: '{{speaker}}',
            style: { fontFamily: 'brand:body', size: 13, weight: 500, color: 'brand:text', opacity: 0.75, align: 'left' },
            x: 110,
            y: 50,
            w: 290,
            h: 24,
          },
        ],
      },
    },
  },
  {
    id: 'preset-sponsors',
    label: 'Sponsors / Partners',
    description: 'Logo slot and sponsor company name',
    data: {
      key: 'sponsors',
      label: 'Sponsors',
      hint: 'Add sponsor logos and names',
      columns: 3,
      gapX: 16,
      gapY: 16,
      minCount: 0,
      maxCount: 9,
      align: 'center',
      previewCount: 3,
      card: {
        w: 280,
        h: 100,
        fields: [
          { key: 'logo', type: 'image', label: 'Logo' },
          { key: 'name', type: 'text', label: 'Name', maxLength: 30 },
        ],
        items: [
          {
            id: 'c-bg',
            kind: 'shape',
            shape: { type: 'rect', fill: '#ffffff' },
            style: { radius: 8, border: '#e2e8f0', strokeWidth: 1 },
            x: 0,
            y: 0,
            w: 280,
            h: 100,
          },
          {
            id: 'c-logo',
            kind: 'image',
            fieldKey: 'logo',
            imageUrl: '{{logo}}',
            style: { fit: 'contain' },
            x: 16,
            y: 15,
            w: 70,
            h: 70,
          },
          {
            id: 'c-name',
            kind: 'text',
            fieldKey: 'name',
            text: '{{name}}',
            style: { fontFamily: 'brand:heading', size: 15, weight: 600, color: 'brand:heading', align: 'left' },
            x: 100,
            y: 35,
            w: 165,
            h: 28,
          },
        ],
      },
    },
  },
  {
    id: 'preset-blank',
    label: 'Blank card',
    description: 'Draw a custom card from scratch',
    data: {
      key: 'items',
      label: 'Items',
      hint: 'Custom card entries',
      columns: 2,
      gapX: 16,
      gapY: 16,
      minCount: 0,
      maxCount: 6,
      align: 'center',
      previewCount: 2,
      card: {
        w: 360,
        h: 120,
        fields: [
          { key: 'title', type: 'text', label: 'Title', maxLength: 30 },
        ],
        items: [
          {
            id: 'c-bg',
            kind: 'shape',
            shape: { type: 'rect', fill: '#f8fafc' },
            style: { radius: 10, border: '#e2e8f0', strokeWidth: 1 },
            x: 0,
            y: 0,
            w: 360,
            h: 120,
          },
          {
            id: 'c-title',
            kind: 'text',
            fieldKey: 'title',
            text: '{{title}}',
            style: { fontFamily: 'brand:heading', size: 18, weight: 700, color: 'brand:heading', align: 'center' },
            x: 20,
            y: 45,
            w: 320,
            h: 30,
          },
        ],
      },
    },
  },
];
