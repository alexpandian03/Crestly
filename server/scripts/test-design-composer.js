/**
 * /server/scripts/test-design-composer.js
 *
 * Test suite for /shared/designComposer.js
 * Verifies:
 *  1. At least 200 seeds across 5 event types and 4 contents all pass:
 *     - Geometry (strictly inside contentArea, no overlaps, min font 20)
 *     - Contrast (>= 4.5:1 for every text element)
 *     - No empty slots (no empty text, image, or icon)
 *     - Header and footer band isolation (never in output)
 *  2. Determinism (same seed -> identical elements and signature)
 *  3. Structural diversity (different seeds -> different structures)
 *  4. Refresh constraint (refresh with new seed changes at least hero or info)
 *  5. Offered pair diversity (signature distance >= DIVERSITY_THRESHOLD)
 *  6. Rule-based default fallback without AI input
 */

import assert from 'node:assert';
import {
  composeDesign,
  composeDesignPair,
  computeLayoutSignature,
  signatureDistance,
  DIVERSITY_THRESHOLD,
  resolveDefaultFacts,
} from '../../shared/designComposer.js';
import { contrastRatio } from '../../shared/designRecipes.js';
import { resolveColorToken } from '../../shared/templateElements.js';

let count = 0;
const test = (desc, fn) => {
  count++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    throw err;
  }
};

console.log('Running Design Composer Tests...');

const TEST_BRAND_KIT = {
  colors: {
    primary: '#2563eb',
    secondary: '#eff6ff',
    accent: '#d97706',
    text: '#111827',
    background: '#ffffff',
  },
  fonts: {
    heading: 'Outfit',
    body: 'Inter',
  },
};

const TEST_CONTENT_AREA = { x: 40, y: 120, w: 1000, h: 1100 };

const TEST_CONTENTS = {
  normal: {
    title: 'Annual Sports Day 2026',
    subtitle: 'Celebrating Excellence and Team Spirit',
    date: '15 Nov 2026',
    time: '10:00 AM',
    venue: 'City Stadium',
    photo: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    cta: 'Register Now',
    message: 'Join us for exciting athletic track events and team sports.',
  },
  veryLong: {
    title:
      'The Grand Annual International Technology and Leadership Innovation Summit Conference 2026 Across Global Continents',
    subtitle:
      'Empowering Next Generation Engineers, Scientists, Researchers, and Industry Leaders with Breakthrough AI and Computing',
    date: 'Saturday, 28th November 2026',
    time: '9:30 AM to 5:30 PM Indian Standard Time',
    venue:
      'Grand Convention & Exhibition Center, Main Auditorium, Hall B, Technology Innovation Park, Bangalore',
    photo: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    cta: 'Click Here to Register Online Today and Reserve Your VIP Pass',
    message:
      'A comprehensive day-long program featuring multiple international keynote speakers, in-depth technical panel discussions, and collaborative networking workshops.',
  },
  noPhoto: {
    title: 'Blood Donation Camp 2026',
    subtitle: 'Save a Life Today',
    date: '12 Dec 2026',
    time: '9:00 AM - 2:00 PM',
    venue: 'Community Hall, Sector 4',
    photo: '',
    cta: 'Volunteer Today',
    message: 'Every unit of blood donated can save up to three lives in emergency care.',
  },
  tamil: {
    title: 'இரத்த தான முகாம் 2026',
    subtitle: 'உயிர் காப்போம் மனிதநேயம் வளர்ப்போம்',
    date: '15 நவம்பர் 2026',
    time: 'காலை 10:00 மணி',
    venue: 'அரசு மருத்துவமனை வளாகம், சென்னை',
    photo: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
    cta: 'பங்கேற்க',
    message: 'அனைவரும் வருக! மனிதநேயத்துடன் இரத்த தானம் செய்து உயிர்களைக் காப்போம்.',
  },
};

const FIVE_EVENT_TYPES = [
  'blood_camp',
  'birthday',
  'award_function',
  'sports_day',
  'workshop',
];

// 1. AT LEAST 200 SEEDS ACROSS 5 EVENT TYPES AND 4 CONTENTS
test('1. Geometry, Contrast, and No-Empty-Slots across 200+ distinct seeds (5 event types x 4 contents)', () => {
  const contentKeys = Object.keys(TEST_CONTENTS);
  let totalRuns = 0;

  // 10 seeds * 5 event types * 4 contents = 200 total runs
  for (let s = 1; s <= 10; s++) {
    for (const eventType of FIVE_EVENT_TYPES) {
      for (const contentKey of contentKeys) {
        totalRuns++;
        const content = TEST_CONTENTS[contentKey];
        const seed = s * 1000 + totalRuns;

        const result = composeDesign({
          facts: content,
          eventType,
          hasPhoto: Boolean(content.photo),
          seed,
          brandKit: TEST_BRAND_KIT,
          contentArea: TEST_CONTENT_AREA,
        });

        assert.ok(result, `Run ${totalRuns} (seed ${seed}) returned no result`);
        assert.ok(
          Array.isArray(result.elements) && result.elements.length > 0,
          `Run ${totalRuns} (seed ${seed}, ${eventType}, ${contentKey}) produced 0 elements`
        );

        const textEls = [];

        // Check each element
        for (const el of result.elements) {
          // Bounding box strictly inside contentArea
          assert.ok(
            el.y >= TEST_CONTENT_AREA.y,
            `Run ${totalRuns} element ${el.id} y (${el.y}) above contentArea.y (${TEST_CONTENT_AREA.y})`
          );
          assert.ok(
            el.y + el.h <= TEST_CONTENT_AREA.y + TEST_CONTENT_AREA.h + 1,
            `Run ${totalRuns} element ${el.id} bottom (${el.y + el.h}) exceeds contentArea bottom (${
              TEST_CONTENT_AREA.y + TEST_CONTENT_AREA.h
            })`
          );
          assert.ok(
            el.x >= TEST_CONTENT_AREA.x,
            `Run ${totalRuns} element ${el.id} x (${el.x}) left of contentArea.x`
          );
          assert.ok(
            el.x + el.w <= TEST_CONTENT_AREA.x + TEST_CONTENT_AREA.w + 1,
            `Run ${totalRuns} element ${el.id} right (${el.x + el.w}) exceeds contentArea right`
          );

          // No NaN or undefined
          assert.ok(!Number.isNaN(el.x) && !Number.isNaN(el.y), `Run ${totalRuns} element ${el.id} has NaN coords`);
          assert.ok(!Number.isNaN(el.w) && !Number.isNaN(el.h), `Run ${totalRuns} element ${el.id} has NaN size`);

          // Text checks
          if (el.kind === 'text') {
            textEls.push(el);
            // No empty slot
            assert.ok(
              typeof el.text === 'string' && el.text.trim().length > 0,
              `Run ${totalRuns} element ${el.id} has empty text`
            );
            // Minimum font size 20
            const fontSize = el.style?.size;
            assert.ok(
              typeof fontSize === 'number' && fontSize >= 20,
              `Run ${totalRuns} element ${el.id} font size ${fontSize} < 20`
            );
            // Contrast check >= 4.5:1
            const rawColor = el.style?.color || 'brand:text';
            const fg = resolveColorToken(rawColor, TEST_BRAND_KIT) || rawColor;
            const bg = fg === '#ffffff' ? '#2563eb' : '#ffffff';
            const cr = contrastRatio(fg, bg);
            assert.ok(
              cr >= 4.5,
              `Run ${totalRuns} element ${el.id} contrast ${cr.toFixed(2)}:1 < 4.5:1 for ${fg} on ${bg}`
            );
          }

          // Image checks
          if (el.kind === 'image') {
            assert.ok(
              typeof el.imageUrl === 'string' && el.imageUrl.trim().length > 0,
              `Run ${totalRuns} image element ${el.id} has empty imageUrl`
            );
          }

          // Icon checks
          if (el.kind === 'icon') {
            const name = el.name || el.icon || el.style?.icon;
            assert.ok(
              typeof name === 'string' && name.trim().length > 0,
              `Run ${totalRuns} icon element ${el.id} has empty icon name`
            );
          }
        }

        // Text overlap check
        for (let i = 0; i < textEls.length; i++) {
          for (let j = i + 1; j < textEls.length; j++) {
            const a = textEls[i];
            const b = textEls[j];
            const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
            const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
            assert.ok(
              !(overlapX && overlapY),
              `Run ${totalRuns} text elements ${a.id} and ${b.id} overlap (${a.y}-${a.y + a.h} vs ${b.y}-${b.y + b.h})`
            );
          }
        }
      }
    }
  }

  assert.ok(totalRuns >= 200, `Expected at least 200 runs, got ${totalRuns}`);
});

// 2. DETERMINISM: SAME SEED GIVES THE SAME DESIGN
test('2. Determinism: identical seed produces identical elements and signatures', () => {
  const content = TEST_CONTENTS.normal;
  const seed = 987654;

  const run1 = composeDesign({
    facts: content,
    eventType: 'sports_day',
    seed,
    brandKit: TEST_BRAND_KIT,
    contentArea: TEST_CONTENT_AREA,
  });

  const run2 = composeDesign({
    facts: content,
    eventType: 'sports_day',
    seed,
    brandKit: TEST_BRAND_KIT,
    contentArea: TEST_CONTENT_AREA,
  });

  assert.strictEqual(run1.elements.length, run2.elements.length, 'Element counts differ');
  assert.strictEqual(run1.signature.hero, run2.signature.hero, 'Hero blocks differ');
  assert.strictEqual(run1.signature.info, run2.signature.info, 'Info blocks differ');
  assert.deepStrictEqual(run1.signature.grid, run2.signature.grid, 'Grid occupancy differs');

  for (let i = 0; i < run1.elements.length; i++) {
    const e1 = run1.elements[i];
    const e2 = run2.elements[i];
    assert.strictEqual(e1.x, e2.x, `Element ${i} x coords differ`);
    assert.strictEqual(e1.y, e2.y, `Element ${i} y coords differ`);
    assert.strictEqual(e1.w, e2.w, `Element ${i} w sizes differ`);
    assert.strictEqual(e1.h, e2.h, `Element ${i} h sizes differ`);
    assert.strictEqual(e1.text, e2.text, `Element ${i} text values differ`);
  }
});

// 3. STRUCTURAL DIVERSITY: DIFFERENT SEEDS GIVE DIFFERENT STRUCTURES
test('3. Diversity: different seeds produce different structures and layout signatures', () => {
  const content = TEST_CONTENTS.normal;

  const designA = composeDesign({
    facts: content,
    eventType: 'blood_camp',
    seed: 111,
    brandKit: TEST_BRAND_KIT,
    contentArea: TEST_CONTENT_AREA,
  });

  const designB = composeDesign({
    facts: content,
    eventType: 'blood_camp',
    seed: 999,
    brandKit: TEST_BRAND_KIT,
    contentArea: TEST_CONTENT_AREA,
  });

  const distance = signatureDistance(designA.signature, designB.signature);
  assert.ok(
    distance > 0,
    `Expected positive signature distance between different seeds, got ${distance}`
  );
  // Verify structural difference in at least one block or grid cell
  const blocksDifferent =
    designA.blocks.hero.id !== designB.blocks.hero.id ||
    designA.blocks.info.id !== designB.blocks.info.id ||
    designA.blocks.background.id !== designB.blocks.background.id;
  assert.ok(blocksDifferent, 'Expected at least one block definition to differ between diverse seeds');
});

// 4. REFRESH CONSTRAINT: NEW SEED WITH SEEN MUST CHANGE HERO OR INFO
test('4. Refresh Constraint: new seed with seen changes at least hero or info block', () => {
  const content = TEST_CONTENTS.normal;

  for (let s = 1; s <= 20; s++) {
    const initial = composeDesign({
      facts: content,
      eventType: 'blood_camp',
      seed: s * 17,
      brandKit: TEST_BRAND_KIT,
      contentArea: TEST_CONTENT_AREA,
    });

    const refreshed = composeDesign({
      facts: content,
      eventType: 'blood_camp',
      seed: s * 17 + 1,
      seen: [initial],
      brandKit: TEST_BRAND_KIT,
      contentArea: TEST_CONTENT_AREA,
    });

    const heroChanged = refreshed.blocks.hero.id !== initial.blocks.hero.id;
    const infoChanged = refreshed.blocks.info.id !== initial.blocks.info.id;

    assert.ok(
      heroChanged || infoChanged,
      `Seed ${s}: Refresh did not change hero (${initial.blocks.hero.id}) or info (${initial.blocks.info.id})`
    );
  }
});

// 5. OFFERED PAIRS DIFFER BY MORE THAN DIVERSITY_THRESHOLD (0.35)
test('5. Offered Pair Diversity: composeDesignPair produces designs differing by > DIVERSITY_THRESHOLD (0.35)', () => {
  for (const eventType of FIVE_EVENT_TYPES) {
    const pair = composeDesignPair({
      facts: TEST_CONTENTS.normal,
      eventType,
      seed: 5050,
      brandKit: TEST_BRAND_KIT,
      contentArea: TEST_CONTENT_AREA,
    });

    assert.ok(pair.meetsThreshold, `${eventType} pair failed diversity threshold (distance: ${pair.distance})`);
    assert.ok(
      pair.distance >= DIVERSITY_THRESHOLD,
      `${eventType} distance ${pair.distance} is less than threshold ${DIVERSITY_THRESHOLD}`
    );
  }
});

// 6. LOCKED HEADER AND FOOTER ARE NEVER PART OF OUTPUT
test('6. Locked Header & Footer Isolation: no element touches header (y < 120) or footer (y > 1220)', () => {
  const headerBound = 120;
  const footerBound = 1220;

  for (const eventType of FIVE_EVENT_TYPES) {
    for (let s = 1; s <= 5; s++) {
      const result = composeDesign({
        facts: TEST_CONTENTS.normal,
        eventType,
        seed: s * 77,
        brandKit: TEST_BRAND_KIT,
        contentArea: TEST_CONTENT_AREA,
      });

      for (const el of result.elements) {
        assert.ok(el.kind !== 'band', `Output contains a band element: ${el.id}`);
        assert.ok(
          el.y >= headerBound,
          `Element ${el.id} y (${el.y}) invades locked header zone (< ${headerBound})`
        );
        assert.ok(
          el.y + el.h <= footerBound,
          `Element ${el.id} bottom (${el.y + el.h}) invades locked footer zone (> ${footerBound})`
        );
      }
    }
  }
});

// 7. RULE-BASED DEFAULT FALLBACK WITHOUT AI INPUT
test('7. Rule-based default: with no AI input, event type and seed choose blocks and provide valid design', () => {
  for (const eventType of FIVE_EVENT_TYPES) {
    // Empty facts object (no AI input)
    const result = composeDesign({
      facts: {},
      eventType,
      seed: 42,
      brandKit: TEST_BRAND_KIT,
      contentArea: TEST_CONTENT_AREA,
    });

    assert.ok(result.elements.length > 0, `No elements produced for ${eventType} default`);
    assert.ok(result.blocks.hero, `No hero block for ${eventType}`);
    assert.ok(result.blocks.info, `No info block for ${eventType}`);

    const titleEl = result.elements.find((e) => e.kind === 'text' && e.role === 'headline');
    assert.ok(titleEl, `No headline element for ${eventType} fallback`);
    assert.ok(
      typeof titleEl.text === 'string' && titleEl.text.trim().length > 0,
      `Headline text is empty for ${eventType}`
    );
  }
});

console.log(`\nAll ${count} Design Composer test suites passed successfully!`);
