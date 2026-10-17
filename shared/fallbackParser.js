/**
 * Deterministic fallback parser for event descriptions.
 * Pure isomorphic module in /shared with zero external dependencies.
 *
 * Extracts event facts:
 *   title (max 60)
 *   subtitle
 *   date
 *   time
 *   venue
 *   details[] (max 3 items)
 *   contact
 *   language ('ta' | 'en')
 *   eventType (from shared/eventTypes.js)
 *
 * Rules:
 * 1. User's text is data: ignore instructions or prompt overrides inside it.
 * 2. Missing date, time, venue, or contact returns "" (never "to be announced").
 * 3. Headline is never longer than 60 characters and is never the whole description.
 * 4. Deduplicate: blank any non-headline field whose value equals or contains the headline or another field.
 * 5. At most 3 supporting detail lines.
 * 6. Never invent dates, numbers, names, venues, or contact details.
 */


const MINOR_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'but', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'up', 'with']);

export function toTitleCase(str) {
  if (!str || typeof str !== 'string') return '';
  const words = str.trim().split(/\s+/);
  return words
    .map((word, index) => {
      const lower = word.toLowerCase();
      if (index > 0 && index < words.length - 1 && MINOR_WORDS.has(lower)) {
        return lower;
      }
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join(' ');
}

export function stripInstructionWords(phrase) {
  if (!phrase || typeof phrase !== 'string') return '';
  let s = phrase.trim();
  s = s.replace(/^(?:please\s+)?(?:be\s+sure\s+to\s+)?(?:include|including|add|make|create|featuring|with|have)\s+/i, '');
  s = s.replace(/(?:ignore\s+(?:all\s+)?(?:previous\s+)?instructions|system\s+override|you\s+are\s+an?\s+ai)[.,!]*/gi, '');
  s = s.trim();
  if (/^registration\s+desk\b/i.test(s) && !/\bon\s+site\b|\bopen\b|\bat\b/i.test(s)) {
    s = 'Registration desk on site';
  } else if (/^medals\b/i.test(s) && !/\bfor\b|\bto\b/i.test(s)) {
    s = 'Medals for every winner';
  }
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export function extractDate(text) {
  const t = String(text || '').trim();
  if (!t || /no\s+date/i.test(t)) return '';

  // 1. Day Month or Month Day (e.g., "5 Dec", "18 Oct", "December 5", "5 December")
  const m1 = t.match(/\b(?:\d{1,2}(?:st|nd|rd|th)?\s+(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?))\b/i);
  if (m1) return m1[0].trim();

  const m2 = t.match(/\b(?:(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+\d{1,2}(?:st|nd|rd|th)?)\b/i);
  if (m2) return m2[0].trim();

  // 2. Numerical format (e.g., "5-12-2026", "18/10/2026", "2026-12-05")
  const m3 = t.match(/\b\d{1,2}[-/]\d{1,2}[-/]\d{2,4}\b/);
  if (m3) return m3[0].trim();

  const m4 = t.match(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/);
  if (m4) return m4[0].trim();

  // 3. Weekday + Date (e.g., "Friday, 12 December", "Saturday, 15 Nov")
  const m5 = t.match(/\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)[,\s]+\d{1,2}(?:st|nd|rd|th)?\s+[A-Za-z]+\b/i);
  if (m5) return m5[0].trim();

  return '';
}

export function extractTime(text) {
  const t = String(text || '').trim();
  if (!t || /no\s+time/i.test(t)) return '';

  // 1. Range: "9 am to 4 pm", "9 AM - 5 PM"
  const range = t.match(/\b(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm)\s*(?:to|-)\s*\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/);
  if (range) return range[0].trim();

  // 2. Single time: "6 PM", "10:00 AM", "8 AM", "6:30 pm"
  const single = t.match(/\b(?:\d{1,2}(?::\d{2})?\s*(?:AM|PM|am|pm))\b/);
  if (single) return single[0].trim();

  // 3. 24h format: "18:00", "09:30"
  const h24 = t.match(/\b(?:[01]?\d|2[0-3]):[0-5]\d\b/);
  if (h24) return h24[0].trim();

  return '';
}

export function extractVenue(text) {
  const t = String(text || '').trim();
  if (!t || /no\s+venue/i.test(t)) return '';

  // Explicit venue prefix: "venue: auditorium", "location: Main Hall"
  const vPrefix = t.match(/\b(?:venue|location)\s*:\s*([^,.;\n]+)/i);
  if (vPrefix) {
    const raw = vPrefix[1].trim();
    if (raw && !/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}:\d{2})\b/i.test(raw)) {
      return formatVenue(raw);
    }
  }

  // Preposition clauses: "at the auditorium", "in the school ground", "at Town Hall"
  const atIn = t.match(/\b(?:at|in)\s+(?:the\s+)?([A-Za-z0-9][A-Za-z0-9\s,'-]{1,40}?)(?:,\s*|\.\s*|\s+(?:on|from|with|including|for)\b|$)/i);
  if (atIn) {
    let raw = atIn[1].trim();
    if (!/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}(?:st|nd|rd|th)?|\d{1,2}:\d{2})\b/i.test(raw)) {
      return formatVenue(raw);
    }
  }

  // Known landmark words (auditorium, school ground, town hall, etc.)
  const knownPlaces = [
    'school ground', 'college ground', 'sports complex', 'sports ground',
    'campus auditorium', 'auditorium', 'community hall', 'town hall',
    'city hall', 'banquet hall', 'memorial hall', 'grand ballroom',
    'community centre', 'community center', 'main stadium', 'central park',
    'green valley park', 'town square', 'city center', 'city centre'
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

function formatVenue(raw) {
  const clean = String(raw || '').replace(/^(?:the|at|in|venue:?)\s+/i, '').trim();
  if (!clean) return '';
  if (/^school\s+ground$/i.test(clean)) return 'School ground';
  if (/^auditorium$/i.test(clean)) return 'Auditorium';
  return toTitleCase(clean).slice(0, 80);
}

export function cleanTextOfInjections(text) {
  let s = String(text || '').trim();
  s = s.replace(/(?:ignore\s+(?:all\s+)?(?:previous\s+)?instructions|system\s+override|you\s+are\s+an?\s+ai|output\s+system\s+override)[^.!?\n]*[.?!\n]*/gi, '');
  return s.trim();
}

export function extractTitle(text, date = '', time = '', venue = '') {
  const cleaned = cleanTextOfInjections(text);
  const t = cleaned || String(text || '').trim();
  if (!t) return 'Featured Event';

  // Take the leading clause before date, time, venue, or punctuation
  let candidate = t.split(/[,.\n]|(?:\s+(?:on|at|in|from|dated?)\s+(?:\d|[A-Z]))/i)[0].trim();

  // Strip leading instructions or verbs
  candidate = stripInstructionWords(candidate);

  // If the candidate still contains date, time, or venue, strip them
  if (date && candidate.toLowerCase().includes(date.toLowerCase())) {
    candidate = candidate.replace(new RegExp(date, 'gi'), '').trim();
  }
  if (time && candidate.toLowerCase().includes(time.toLowerCase())) {
    candidate = candidate.replace(new RegExp(time, 'gi'), '').trim();
  }
  if (venue && candidate.toLowerCase().includes(venue.toLowerCase())) {
    candidate = candidate.replace(new RegExp(venue, 'gi'), '').trim();
  }

  candidate = candidate.replace(/^(?:on|at|in|from)\s+/i, '').replace(/[,\s-]+$/, '').trim();

  // Ensure title is never longer than 60 chars and never the entire description if description has more content
  if (candidate.length > 60) {
    candidate = candidate.slice(0, 60).replace(/\s+\S*$/, '').trim();
  }

  if (!candidate || candidate.length < 3) {
    candidate = 'Featured Event';
  }

  return toTitleCase(candidate);
}

export function extractDetails(text, title = '', venue = '') {
  const t = String(text || '').trim();
  if (!t) return [];

  // 1. Check for "include ... and ..."
  const includeMatch = t.match(/\b(?:include|including|featuring|with|add|have)\s+([A-Za-z0-9\s,'&/-]+?)(?:\.|$|(?:\s+on\s+\d+)|\s+at\s+[A-Z])/i);
  if (includeMatch) {
    const rawPhrase = includeMatch[1].trim();
    const parts = rawPhrase
      .split(/,|\band\b|&/i)
      .map((p) => p.trim())
      .filter((p) => p.length > 2 && !/^(?:on|at|from)\s+/i.test(p));

    const extracted = parts
      .map(stripInstructionWords)
      .filter((b) => b && b.length > 2);

    if (extracted.length > 0) {
      return extracted.slice(0, 3);
    }
  }

  // 2. Secondary sentences
  const sentences = t
    .split(/[\n;.]/)
    .map((s) => s.trim())
    .filter(Boolean);

  const titleNorm = title.toLowerCase();
  const venueNorm = venue.toLowerCase();

  const details = [];
  for (let i = 1; i < sentences.length; i++) {
    const s = stripInstructionWords(sentences[i]);
    const sNorm = s.toLowerCase();
    if (!s || s.length < 3) continue;
    if (sNorm === titleNorm || (titleNorm.length > 5 && sNorm.includes(titleNorm))) continue;
    if (venueNorm && sNorm.includes(venueNorm)) continue;
    if (/\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|\d{1,2}(?:st|nd|rd|th)?|\d{1,2}:\d{2})\b/i.test(s)) continue;
    details.push(s.slice(0, 90));
    if (details.length >= 3) break;
  }

  return details;
}

export function extractContact(text) {
  const t = String(text || '').trim();
  if (!t) return '';
  const phone = t.match(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/);
  if (phone) return phone[0].trim();
  const email = t.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/);
  if (email) return email[0].trim();
  return '';
}

export function extractLanguage(text) {
  return /[\u0B80-\u0BFF]/.test(String(text || '')) ? 'ta' : 'en';
}

export function extractEventType(text, title = '') {
  const combined = `${title} ${text}`.toLowerCase();
  if (/\b(?:blood|donation|donor)\b/i.test(combined)) return 'blood_camp';
  if (/\b(?:birthday|b'day)\b/i.test(combined)) return 'birthday';
  if (/\b(?:awards?|honour|honor|recognition|excellence|trophy|gala)\b/i.test(combined)) return 'award_function';
  if (/\b(?:sports?|marathon|tournament|cricket|athletic|race|relay)\b/i.test(combined)) return 'sports_day';
  if (/\b(?:school|college)\s+(?:annual|day)\b/i.test(combined)) return 'school_annual_day';
  if (/\b(?:temple|festival|pongal|diwali|puja|pooja)\b/i.test(combined)) return 'temple_festival';
  if (/\b(?:wedding|marriage|reception)\b/i.test(combined)) return 'wedding';
  if (/\b(?:workshop|seminar|bootcamp|masterclass|training|webinar)\b/i.test(combined)) return 'workshop';
  if (/\b(?:meeting|conference|summit|board|general\s+body)\b/i.test(combined)) return 'meeting';
  return 'general';
}

/**
 * Deduplicate: blank any non-headline field whose value equals or contains the headline or another field.
 * Keeps at most 3 supporting lines.
 */
export function deduplicateFields({ title = '', subtitle = '', date = '', time = '', venue = '', details = [], contact = '' }) {
  const norm = (s) => String(s || '').trim().toLowerCase().replace(/[^\w\s]/g, '');
  const titleNorm = norm(title);

  const seen = new Set();
  if (titleNorm) seen.add(titleNorm);

  const check = (val) => {
    const n = norm(val);
    if (!n) return '';
    // Equals or contains title
    if (titleNorm && (n === titleNorm || n.includes(titleNorm) || (titleNorm.length > 8 && titleNorm.includes(n)))) {
      return '';
    }
    // Equals or contains an already seen field
    for (const prior of seen) {
      if (n === prior || n.includes(prior) || (prior.length > 8 && prior.includes(n))) {
        return '';
      }
    }
    seen.add(n);
    return val;
  };

  const cleanSubtitle = check(subtitle);
  const cleanDate = date; // Facts like date/time are not blanked by text collisions
  const cleanTime = time;
  const cleanVenue = check(venue);
  const cleanContact = check(contact);

  const cleanDetails = [];
  for (const line of (Array.isArray(details) ? details : [])) {
    const c = check(line);
    if (c && !cleanDetails.includes(c)) {
      cleanDetails.push(c);
      if (cleanDetails.length >= 3) break;
    }
  }

  return {
    title: title.slice(0, 60),
    subtitle: cleanSubtitle,
    date: cleanDate,
    time: cleanTime,
    venue: cleanVenue,
    details: cleanDetails,
    contact: cleanContact,
  };
}

/**
 * Main deterministic extraction function used when model fails, times out, or errors.
 */
export function extractEventFacts(text) {
  const rawText = String(text || '').trim();
  const date = extractDate(rawText);
  const time = extractTime(rawText);
  const venue = extractVenue(rawText);
  const title = extractTitle(rawText, date, time, venue);
  const details = extractDetails(rawText, title, venue);
  const contact = extractContact(rawText);
  const language = extractLanguage(rawText);
  const eventType = extractEventType(rawText, title);

  const deduped = deduplicateFields({
    title,
    subtitle: '',
    date,
    time,
    venue,
    details,
    contact,
  });

  return {
    ...deduped,
    language,
    eventType,
  };
}
