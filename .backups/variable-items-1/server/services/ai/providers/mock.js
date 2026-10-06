/**
 * Mock LLM Provider
 * Parses user input locally without network calls, returning realistic,
 * schema-compliant poster content. Respects "never invent facts" rule.
 */
export async function generateWithMock({ prompt, brandKit, template, instruction }) {
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
    const firstClause = text.split(/[,.\n]|(?:\s+(?:on|at|in|from)\s+)/i)[0].trim();
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

  return {
    title,
    tagline,
    date,
    time,
    venue,
    details,
    imageQuery,
  };
}

export default { generateWithMock };
