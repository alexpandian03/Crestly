import assert from 'node:assert/strict';
import {
  DESIGN_BLOCK_ROLES,
  HERO_BLOCKS,
  INFO_BLOCKS,
  MESSAGE_BLOCKS,
  CTA_BLOCKS,
  BACKGROUND_BLOCKS,
  DECORATION_BLOCKS,
  TYPE_PAIRING_BLOCKS,
  COLOUR_ASSIGNMENT_BLOCKS,
  DESIGN_BLOCKS,
  DESIGN_BLOCKS_BY_ID,
  blockById,
  blocksByRole,
  blocksForCategory,
  isCompatible,
  layoutBlock,
  extractBlockContent,
  RECIPE_VERSION,
} from '../../shared/designBlocks.js';
import {
  EVENT_TYPES,
  EVENT_TYPE_IDS,
  neededSectionsFor,
} from '../../shared/eventTypes.js';
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

console.log('Running Design Blocks Tests...');

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
    photo: '', // Empty photo
    cta: 'Volunteer Today',
    message: 'Every unit of blood donated can save up to three lives in emergency care.',
  },
  tamil: {
    title: 'இரத்த தான முகாம் 2026',
    subtitle: 'உயிர் காப்போம் மனிதநேயம் வளர்ப்போம்',
    date: '15 நவம்பர் 2026',
    time: 'காலை 10:00 மணி',
    venue: 'அரசு மருத்துவமனை வளாகம், சென்னை',
    photo: '',
    cta: 'பங்கேற்கவும்',
    message: 'அனைவரும் வருக, இரத்த தானம் செய்து நல்வாழ்வு காப்போம்.',
  },
};

// 1. BLOCK COUNTS AND ROLES
test('1. Block Counts: meets or exceeds minimum counts for all 8 roles', () => {
  assert.equal(DESIGN_BLOCK_ROLES.length, 8);

  assert.ok(HERO_BLOCKS.length >= 6, `hero blocks: expected >= 6, got ${HERO_BLOCKS.length}`);
  assert.ok(INFO_BLOCKS.length >= 6, `info blocks: expected >= 6, got ${INFO_BLOCKS.length}`);
  assert.ok(MESSAGE_BLOCKS.length >= 4, `message blocks: expected >= 4, got ${MESSAGE_BLOCKS.length}`);
  assert.ok(CTA_BLOCKS.length >= 3, `cta blocks: expected >= 3, got ${CTA_BLOCKS.length}`);
  assert.ok(BACKGROUND_BLOCKS.length >= 6, `background blocks: expected >= 6, got ${BACKGROUND_BLOCKS.length}`);
  assert.ok(DECORATION_BLOCKS.length >= 5, `decoration blocks: expected >= 5, got ${DECORATION_BLOCKS.length}`);
  assert.ok(TYPE_PAIRING_BLOCKS.length >= 4, `typePairing blocks: expected >= 4, got ${TYPE_PAIRING_BLOCKS.length}`);
  assert.ok(
    COLOUR_ASSIGNMENT_BLOCKS.length >= 4,
    `colourAssignment blocks: expected >= 4, got ${COLOUR_ASSIGNMENT_BLOCKS.length}`
  );

  // Message and CTA must include "none"
  assert.ok(MESSAGE_BLOCKS.some((b) => b.id.includes('none')), 'Message must include none block');
  assert.ok(CTA_BLOCKS.some((b) => b.id.includes('none')), 'CTA must include none block');

  // Total blocks
  assert.equal(
    DESIGN_BLOCKS.length,
    HERO_BLOCKS.length +
      INFO_BLOCKS.length +
      MESSAGE_BLOCKS.length +
      CTA_BLOCKS.length +
      BACKGROUND_BLOCKS.length +
      DECORATION_BLOCKS.length +
      TYPE_PAIRING_BLOCKS.length +
      COLOUR_ASSIGNMENT_BLOCKS.length
  );
});

// 2. BLOCK DECLARATIONS
test('2. Block Declarations: every block declares required metadata fields', () => {
  for (const block of DESIGN_BLOCKS) {
    assert.ok(typeof block.id === 'string' && block.id.length > 0, `${block.id} must have non-empty id`);
    assert.ok(DESIGN_BLOCK_ROLES.includes(block.role), `${block.id} must have valid role`);
    assert.ok(Array.isArray(block.suits) && block.suits.length > 0, `${block.id} must have suits array`);
    assert.ok(typeof block.needsPhoto === 'boolean', `${block.id} must declare needsPhoto boolean`);
    assert.ok(Array.isArray(block.compatibleWith), `${block.id} must declare compatibleWith array`);
    assert.ok(Array.isArray(block.incompatibleWith), `${block.id} must declare incompatibleWith array`);
    assert.ok(Array.isArray(block.slots), `${block.id} must declare slots array`);
    assert.ok(typeof block.minTextLength === 'number', `${block.id} must declare minTextLength number`);
    assert.ok(typeof block.maxTextLength === 'number', `${block.id} must declare maxTextLength number`);
    assert.equal(block.recipeVersion, 2, `${block.id} must declare recipeVersion 2`);
    assert.ok(typeof block.tree === 'function', `${block.id} must declare tree() function`);

    // Verify slots priorities
    for (const slot of block.slots) {
      assert.ok(typeof slot.name === 'string', `${block.id} slot name must be string`);
      assert.ok(typeof slot.priority === 'number', `${block.id} slot priority must be number`);
    }

    // Colour assignment blocks use brand tokens only
    if (block.role === 'colourAssignment') {
      assert.ok(block.tokens, `${block.id} must declare tokens object`);
      for (const [key, token] of Object.entries(block.tokens)) {
        assert.ok(
          token.startsWith('brand:'),
          `${block.id} token ${key} must use brand token only, got "${token}"`
        );
      }
    }
  }
});

// 3. EVENT TYPES AND NEEDED SECTIONS
test('3. Event Types: all 10 event types exist and each lists the sections it needs', () => {
  const expectedEventTypes = [
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

  assert.equal(EVENT_TYPE_IDS.length, 10);
  for (const id of expectedEventTypes) {
    assert.ok(EVENT_TYPES[id], `EVENT_TYPES must contain ${id}`);
    const needed = neededSectionsFor(id);
    assert.ok(Array.isArray(needed) && needed.length > 0, `${id} must list neededSections`);
    assert.ok(needed.includes('hero'), `${id} must need hero section`);
    assert.ok(needed.includes('info'), `${id} must need info section`);
  }
});

// 4. GEOMETRY CHECKS: INSIDE CONTENT AREA
test('4. Geometry: every block alone stays strictly inside content area across all 4 contents', () => {
  for (const block of DESIGN_BLOCKS) {
    for (const [contentKey, c] of Object.entries(TEST_CONTENTS)) {
      const elements = layoutBlock(block, c, {
        contentArea: TEST_CONTENT_AREA,
        brandKit: TEST_BRAND_KIT,
      });

      for (const el of elements) {
        assert.ok(
          el.x >= TEST_CONTENT_AREA.x,
          `${block.id} (${contentKey}) element x=${el.x} is off left edge of contentArea ${TEST_CONTENT_AREA.x}`
        );
        assert.ok(
          el.y >= TEST_CONTENT_AREA.y,
          `${block.id} (${contentKey}) element y=${el.y} is off top edge of contentArea ${TEST_CONTENT_AREA.y}`
        );
        assert.ok(
          el.x + el.w <= TEST_CONTENT_AREA.x + TEST_CONTENT_AREA.w + 1,
          `${block.id} (${contentKey}) element right=${el.x + el.w} exceeds contentArea right ${TEST_CONTENT_AREA.x + TEST_CONTENT_AREA.w}`
        );
        assert.ok(
          el.y + el.h <= TEST_CONTENT_AREA.y + TEST_CONTENT_AREA.h + 1,
          `${block.id} (${contentKey}) element bottom=${el.y + el.h} exceeds contentArea bottom ${TEST_CONTENT_AREA.y + TEST_CONTENT_AREA.h}`
        );
      }
    }
  }
});

// 5. GEOMETRY CHECKS: NO OVERLAPS
test('5. Geometry: no text elements overlap on any block across all 4 contents', () => {
  for (const block of DESIGN_BLOCKS) {
    for (const [contentKey, c] of Object.entries(TEST_CONTENTS)) {
      const elements = layoutBlock(block, c, {
        contentArea: TEST_CONTENT_AREA,
        brandKit: TEST_BRAND_KIT,
      });

      const textElements = elements.filter((el) => el.kind === 'text');
      for (let i = 0; i < textElements.length; i++) {
        for (let j = i + 1; j < textElements.length; j++) {
          const a = textElements[i];
          const b = textElements[j];

          const overlaps = !(
            a.x + a.w <= b.x ||
            b.x + b.w <= a.x ||
            a.y + a.h <= b.y ||
            b.y + b.h <= a.y
          );

          assert.ok(
            !overlaps,
            `${block.id} (${contentKey}) overlapping text elements: "${a.text}" vs "${b.text}"`
          );
        }
      }
    }
  }
});

// 6. GEOMETRY CHECKS: NO EMPTY BLOCKS
test('6. Geometry: no empty blocks produced across all 4 contents (including no-photo)', () => {
  for (const block of DESIGN_BLOCKS) {
    for (const [contentKey, c] of Object.entries(TEST_CONTENTS)) {
      const elements = layoutBlock(block, c, {
        contentArea: TEST_CONTENT_AREA,
        brandKit: TEST_BRAND_KIT,
      });

      for (const el of elements) {
        if (el.kind === 'text') {
          assert.ok(
            typeof el.text === 'string' && el.text.trim().length > 0,
            `${block.id} (${contentKey}) has empty text element`
          );
        } else if (el.kind === 'image') {
          assert.ok(
            typeof el.imageUrl === 'string' && el.imageUrl.trim().length > 0,
            `${block.id} (${contentKey}) has empty image element`
          );
        } else if (el.kind === 'icon') {
          const name = el.name || el.icon;
          assert.ok(
            typeof name === 'string' && name.trim().length > 0,
            `${block.id} (${contentKey}) has empty icon element`
          );
        }
      }
    }
  }
});

// 7. GEOMETRY CHECKS: MINIMUM FONT 20
test('7. Geometry: minimum font size is 20 across all 4 contents', () => {
  for (const block of DESIGN_BLOCKS) {
    for (const [contentKey, c] of Object.entries(TEST_CONTENTS)) {
      const elements = layoutBlock(block, c, {
        contentArea: TEST_CONTENT_AREA,
        brandKit: TEST_BRAND_KIT,
      });

      for (const el of elements) {
        if (el.kind === 'text') {
          const size = el.style?.size;
          assert.ok(
            typeof size === 'number' && size >= 20,
            `${block.id} (${contentKey}) text size ${size} is less than minimum 20px`
          );
        }
      }
    }
  }
});

// 8. GEOMETRY CHECKS: CONTRAST AT LEAST 4.5:1
test('8. Geometry: contrast is at least 4.5:1 for every text element against backing surface', () => {
  for (const block of DESIGN_BLOCKS) {
    for (const [contentKey, c] of Object.entries(TEST_CONTENTS)) {
      const elements = layoutBlock(block, c, {
        contentArea: TEST_CONTENT_AREA,
        brandKit: TEST_BRAND_KIT,
      });

      for (const el of elements) {
        if (el.kind === 'text') {
          const rawColor = el.style?.color || 'brand:text';
          const fg = resolveColorToken(rawColor, TEST_BRAND_KIT) || rawColor;
          // Determine backing surface color
          const bg = fg === '#ffffff' ? '#2563eb' : '#ffffff';
          const cr = contrastRatio(fg, bg);

          assert.ok(
            cr >= 4.5,
            `${block.id} (${contentKey}) contrast ratio ${cr.toFixed(2)}:1 is below WCAG AA 4.5:1 for ${fg} on ${bg}`
          );
        }
      }
    }
  }
});

// 9. LOOKUP HELPERS AND COMPATIBILITY
test('9. Helpers: blockById, blocksByRole, blocksForCategory, and isCompatible work accurately', () => {
  // blockById
  const hero = blockById('hero-bold-headline');
  assert.ok(hero);
  assert.equal(hero.id, 'hero-bold-headline');
  assert.equal(blockById('non-existent'), undefined);

  // blocksByRole
  const infoBlocks = blocksByRole('info');
  assert.equal(infoBlocks.length, INFO_BLOCKS.length);
  for (const b of infoBlocks) {
    assert.equal(b.role, 'info');
  }

  // blocksForCategory
  const sportsBlocks = blocksForCategory('sports');
  assert.ok(sportsBlocks.length > 0);
  assert.ok(sportsBlocks.some((b) => b.suits.includes('sports') || b.suits.includes('*')));

  // isCompatible
  assert.ok(isCompatible('hero-bold-headline', 'info-triple-pill'));
  // Incompatible check
  assert.equal(isCompatible('background-split-vertical', 'hero-photo-split'), false);
});

console.log('\nAll 9 Design Blocks test suites passed successfully!');
