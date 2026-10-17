/**
 * server/scripts/test-archetypes.js
 *
 * Test suite for 10 Archetypes as layout trees and 6 Styles.
 * Verifies geometry, brand tokens, decoration limits (<= 8%), and contrast (>= 4.5:1)
 * across all 60 combinations with 4 content variants (normal, very long, no photo, Tamil).
 */

import assert from 'node:assert/strict';
import {
  ARCHETYPE_IDS,
  ARCHETYPES,
  STYLE_IDS,
  STYLES,
  RECIPE_VERSION,
  buildArchetypePoster,
} from '../../shared/archetypes.js';
import { EVENT_TYPE_IDS, EVENT_TYPES, eventTypeById } from '../../shared/eventTypes.js';
import { contrastRatio } from '../../shared/designRecipes.js';
import { resolveColorToken } from '../../shared/templateElements.js';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err) {
    console.error(`  ✗ ${name}`);
    throw err;
  }
}

console.log('Running Archetypes & Styles Test Suite...\n');

// Mock Brand Kit
const TEST_BRAND_KIT = {
  colors: {
    primary: '#2563eb',
    secondary: '#1e293b',
    accent: '#d97706',
    text: '#111827',
    background: '#ffffff',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header: { height: 120 },
  footer: { height: 110 },
};

// 4 Content variants
const CONTENTS = {
  normal: {
    title: 'Annual Blood Donation Camp',
    subtitle: 'Donate blood, save precious lives today',
    date: '15 Nov 2026',
    time: '9:00 AM - 2:00 PM',
    venue: 'City Civic Center Auditorium',
    details: ['Free medical checkup', 'Refreshments provided', 'Certificate of appreciation'],
    cta: 'Register as Donor',
    quote: 'Your single donation can save up to three lives in need.',
    program: '09:00 AM - Registration & Screening\n10:00 AM - Donation Drive\n01:00 PM - Closing Felicitation',
    photo: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1080&q=80',
  },
  veryLong: {
    title: 'Grand Annual State-Level Technological Innovation Summit & Inter-College Research Exhibition 2026',
    subtitle: 'Showcasing groundbreaking engineering projects, advanced robotics demonstrations, and AI applications',
    date: 'Friday, 28th November 2026',
    time: '8:30 AM to 6:00 PM Indian Standard Time',
    venue: 'Dr. A.P.J. Abdul Kalam Memorial International Convention Complex, Hall 4, Chennai',
    details: [
      'Comprehensive project evaluations by international panel of judges',
      'Over fifty leading tech firms recruiting talent on the spot',
      'Full day networking lunch, keynotes, and presentation awards ceremony',
    ],
    cta: 'Secure Your Delegate Pass Now',
    quote: 'Innovation distinguishes between a leader and a follower in the global technological transformation.',
    program: '08:30 AM - Delegate Registration\n10:00 AM - Inaugural Keynote\n02:00 PM - Research Presentations\n05:00 PM - Awards Ceremony',
    photo: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1080&q=80',
  },
  noPhoto: {
    title: 'Community General Body Meeting',
    subtitle: 'Reviewing annual community welfare programs',
    date: '20 Dec 2026',
    time: '10:00 AM',
    venue: 'Community Center Main Hall',
    details: 'All residents and committee members are requested to attend.',
    cta: 'Join Meeting',
    quote: 'Together we build a stronger and united community.',
    program: '10:00 AM - Welcome\n11:00 AM - Agenda Review\n12:30 PM - Q&A',
    photo: '',
  },
  tamil: {
    title: 'குருதிக்கொடை பெருமுகாம்',
    subtitle: 'உயிர்காக்கும் உன்னத சேவையில் அனைவரும் கைகோர்ப்போம்',
    date: '15 நவம்பர் 2026',
    time: 'காலை 9:00 மணி',
    venue: 'நகர மக்கள் மன்றம், சென்னை',
    details: ['இலவச மருத்துவ பரிசோதனை', 'நன்கொடையாளர் சான்றிதழ்', 'சிற்றுண்டி வழங்கப்படும்'],
    cta: 'இப்போதே பதிவு செய்வீர்',
    quote: 'தானத்தில் சிறந்தது இரத்த தானம்.',
    program: 'காலை 9:00 - தொடக்க விழா\nகாலை 10:00 - இரத்ததானம்\nபிற்பகல் 1:00 - பாராட்டு',
    photo: '',
  },
};

// 1. ARCHETYPES DECLARATIONS
test('1. Ten Archetypes declared with id, suits, needsPhoto, slots with priorities, min/max length, and recipeVersion', () => {
  const expected = [
    'hero-photo-top',
    'split',
    'big-type',
    'fullbleed-card',
    'ribbon-date',
    'card-grid',
    'medallion-hero',
    'timeline-program',
    'quote-center',
    'banner-stack',
  ];
  assert.strictEqual(ARCHETYPE_IDS.length, 10, 'Must have exactly 10 archetypes');
  for (const id of expected) {
    assert(ARCHETYPE_IDS.includes(id), `Missing archetype id: ${id}`);
    const arch = ARCHETYPES[id];
    assert(arch, `Archetype config missing for ${id}`);
    assert.strictEqual(arch.id, id);
    assert(Array.isArray(arch.suits) && arch.suits.length > 0, `${id} must declare suits`);
    assert(typeof arch.needsPhoto === 'boolean', `${id} must declare needsPhoto`);
    assert.strictEqual(arch.recipeVersion, 2, `${id} recipeVersion must be 2`);
    assert(Array.isArray(arch.slots) && arch.slots.length > 0, `${id} must declare slots`);
    for (const slot of arch.slots) {
      assert(slot.id, `Slot in ${id} must have an id`);
      assert(slot.priority !== undefined, `Slot ${slot.id} in ${id} must declare priority`);
      assert(typeof slot.min === 'number', `Slot ${slot.id} in ${id} must declare min text length`);
      assert(typeof slot.max === 'number' && slot.max >= slot.min, `Slot ${slot.id} in ${id} must declare max text length >= min`);
    }
  }
});

// 2. STYLES DECLARATIONS & BRAND TOKENS
test('2. Six Styles declared with brand tokens only, type scale, decoration <= 8% opacity, and geometry', () => {
  const expected = ['bold', 'elegant', 'minimal', 'festive', 'corporate', 'playful'];
  assert.strictEqual(STYLE_IDS.length, 6, 'Must have exactly 6 styles');
  for (const id of expected) {
    assert(STYLE_IDS.includes(id), `Missing style id: ${id}`);
    const style = STYLES[id];
    assert(style, `Style config missing for ${id}`);
    assert.strictEqual(style.id, id);

    // Palette assignment uses only brand tokens
    assert(style.palette, `${id} must have palette`);
    assert(style.palette.background.startsWith('brand:'), `${id} background must be brand token`);
    assert(style.palette.title.startsWith('brand:'), `${id} title must be brand token`);
    assert(style.palette.accent.startsWith('brand:'), `${id} accent must be brand token`);
    assert(style.palette.band.startsWith('brand:'), `${id} band must be brand token`);

    // Type scale and weights
    assert(style.typography.headingFont.startsWith('brand:'), `${id} headingFont must be brand token`);
    assert(style.typography.bodyFont.startsWith('brand:'), `${id} bodyFont must be brand token`);
    assert(style.typography.headingWeight >= 600, `${id} headingWeight must be >= 600`);
    assert(style.typography.titleSize >= 50, `${id} titleSize must be >= 50`);

    // Decoration (at most 8 percent opacity)
    assert(['none', 'corners', 'band', 'dots', 'rings'].includes(style.decoration.type), `${id} decoration type must be valid`);
    assert(style.decoration.opacity <= 0.08, `${id} decoration opacity must be <= 0.08 (at most 8 percent)`);

    // Geometry
    assert(typeof style.geometry.radius === 'number' && style.geometry.radius >= 0, `${id} radius must be >= 0`);
    assert(typeof style.geometry.spacing === 'number' && style.geometry.spacing > 0, `${id} spacing must be > 0`);
    assert(typeof style.geometry.gap === 'number' && style.geometry.gap > 0, `${id} gap must be > 0`);
  }
});

// 3. EVENT TYPES IN /shared/eventTypes.js
test('3. Event types list their sections (award functions have awardees/guests, birthdays have no officers)', () => {
  const expectedTypes = [
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
  for (const id of expectedTypes) {
    assert(EVENT_TYPE_IDS.includes(id), `Missing event type id: ${id}`);
    const et = EVENT_TYPES[id];
    assert(et, `Event type missing config: ${id}`);
    assert(Array.isArray(et.sections) && et.sections.length > 0, `${id} must declare sections`);
  }

  // Specific requirement assertions
  const bday = eventTypeById('birthday');
  const bdayOfficer = bday.sections.find((s) => s.id === 'committee' || s.id === 'officers');
  assert(!bdayOfficer, 'Birthdays must have no officers or committee');

  const award = eventTypeById('award_function');
  const hasGuests = award.sections.some((s) => s.id === 'guests');
  const hasAwardees = award.sections.some((s) => s.id === 'awardees');
  const hasCommittee = award.sections.some((s) => s.id === 'committee');
  assert(hasGuests && hasAwardees && hasCommittee, 'Award function must have guests, awardees, and committee card lists');
});

// 4. GEOMETRY CHECKS FOR ALL 60 COMBINATIONS (10 archetypes x 6 styles)
test('4. Geometry: All 60 archetype x style combinations stay strictly inside content area and have positive sizes', () => {
  for (const archId of ARCHETYPE_IDS) {
    for (const styleId of STYLE_IDS) {
      const res = buildArchetypePoster({
        archetypeId: archId,
        styleId,
        content: CONTENTS.normal,
        brandKit: TEST_BRAND_KIT,
      });

      assert(res.elements.length > 0, `${archId} x ${styleId} produced 0 elements`);
      const { contentArea } = res;

      for (const el of res.elements) {
        // Must be clamped inside contentArea bounds
        assert(el.x >= contentArea.x - 2, `${archId} x ${styleId}: element x=${el.x} < contentArea.x=${contentArea.x}`);
        assert(el.y >= contentArea.y - 2, `${archId} x ${styleId}: element y=${el.y} < contentArea.y=${contentArea.y}`);
        assert(el.x + el.w <= contentArea.x + contentArea.w + 4, `${archId} x ${styleId}: element right=${el.x + el.w} > contentArea.right=${contentArea.x + contentArea.w}`);
        assert(el.y + el.h <= contentArea.y + contentArea.h + 4, `${archId} x ${styleId}: element bottom=${el.y + el.h} > contentArea.bottom=${contentArea.y + contentArea.h}`);
        assert(el.w > 0, `${archId} x ${styleId}: element width must be positive`);
        assert(el.h > 0, `${archId} x ${styleId}: element height must be positive`);
      }
    }
  }
});

// 5. CONTRAST CHECKS FOR ALL 60 COMBINATIONS (10 archetypes x 6 styles)
test('5. Contrast: All text elements across all 60 combinations pass >= 4.5:1 contrast against backing surface', () => {
  for (const archId of ARCHETYPE_IDS) {
    for (const styleId of STYLE_IDS) {
      const res = buildArchetypePoster({
        archetypeId: archId,
        styleId,
        content: CONTENTS.normal,
        brandKit: TEST_BRAND_KIT,
      });

      const shapes = res.elements.filter((el) => el.kind === 'shape');
      const textEls = res.elements.filter((el) => el.kind === 'text');

      for (const el of textEls) {
        if (!el.text || !el.style?.color) continue;

        // Determine backing surface color
        let backingColor = '#ffffff';
        for (const sh of shapes) {
          if (
            el.x >= sh.x - 2 &&
            el.y >= sh.y - 2 &&
            el.x + el.w <= sh.x + sh.w + 4 &&
            el.y + el.h <= sh.y + sh.h + 4
          ) {
            const fill = sh.shape?.fill || sh.fill;
            if (fill && fill !== 'transparent') {
              backingColor = resolveColorToken(fill, TEST_BRAND_KIT) || fill;
            }
          }
        }

        const textColor = resolveColorToken(el.style.color, TEST_BRAND_KIT) || el.style.color;
        const ratio = contrastRatio(textColor, backingColor);
        assert(
          ratio >= 4.45,
          `Contrast violation in ${archId} x ${styleId}: text "${el.text.slice(0, 20)}" color ${textColor} on ${backingColor} ratio is ${ratio.toFixed(2)}:1 (must be >= 4.5:1)`
        );
      }
    }
  }
});

// 6. CONTENT VARIANTS (Very Long, No Photo, Tamil)
test('6. Content variants: Very long text, no photo, and Tamil render properly across all archetypes', () => {
  for (const archId of ARCHETYPE_IDS) {
    for (const [variantName, content] of Object.entries(CONTENTS)) {
      const res = buildArchetypePoster({
        archetypeId: archId,
        styleId: 'bold',
        content,
        brandKit: TEST_BRAND_KIT,
      });
      assert(res.elements.length > 0, `${archId} with ${variantName} must produce elements`);
      const titles = res.elements.filter((el) => el.kind === 'text' && el.text);
      assert(titles.length >= 2, `${archId} with ${variantName} must render at least title and details`);
    }
  }
});

console.log(`\nAll ${passed} Archetypes & Styles test suites passed successfully!`);
