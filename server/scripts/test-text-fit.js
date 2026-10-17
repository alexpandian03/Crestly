import assert from 'node:assert/strict';
import {
  textFit,
  wrapWords,
  getFontRatio,
  charWidthFor,
  fitPrioritizedFields,
  getPriority,
  FIELD_PRIORITY,
  PRIORITY_ORDER,
  FONT_CHAR_WIDTH_RATIOS,
} from '../../shared/textFit.js';
import {
  layout,
  stack,
  text,
  estimateTextHeight,
} from '../../shared/layoutEngine.js';

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

console.log('Running TextFit Tests...');

// 1. SHORT AND LONG ENGLISH
test('1. Short and Long English: estimates lines and heights accurately without browser', () => {
  // Short English
  const shortText = 'Annual Tech Conference 2026';
  const shortFit = textFit(shortText, 'Outfit', 32, 800);
  assert.equal(shortFit.lines.length, 1);
  assert.equal(shortFit.lines[0], shortText);
  assert.equal(shortFit.size, 32);
  assert.ok(shortFit.height > 0);
  assert.equal(shortFit.height, Math.round(1 * 32 * shortFit.lineHeight));

  // Long English paragraph
  const longText =
    'Join us for our flagship international engineering symposium featuring world-class keynote speakers, innovative technical workshops, industry panel sessions, and networking opportunities for professionals across technology sectors.';
  const longFit = textFit(longText, 'Inter', 24, 400);
  assert.ok(longFit.lines.length >= 4, `Expected >= 4 lines, got ${longFit.lines.length}`);
  assert.ok(longFit.height > 100);
  // Ensure no word was cut or broken mid-word
  for (const line of longFit.lines) {
    for (const w of line.split(' ')) {
      assert.ok(longText.includes(w), `Word "${w}" should be an intact whole word`);
    }
  }
});

// 2. TAMIL SAMPLE (Line height 1.4 and Tamil advance metrics)
test('2. Tamil Sample: enforces 1.4 line height and Tamil font metrics', () => {
  const tamilText = 'இரத்த தான முகாம் 2026';
  const tamilFit = textFit(tamilText, 'Noto Sans Tamil', 28, 500);

  // Line height MUST be 1.4
  assert.equal(tamilFit.lineHeight, 1.4);
  assert.equal(tamilFit.height, Math.round(tamilFit.lines.length * 28 * 1.4));

  // Multiline Tamil
  const multiTamil = 'சென்னை புத்தகக் காட்சி 2026\nஅனைவரும் வருக';
  const multiFit = textFit(multiTamil, 'Noto Sans Tamil', 24, 800);
  assert.equal(multiFit.lineHeight, 1.4);
  assert.equal(multiFit.lines.length, 2);
  assert.equal(multiFit.lines[0], 'சென்னை புத்தகக் காட்சி 2026');
  assert.equal(multiFit.lines[1], 'அனைவரும் வருக');

  // Latin font with Tamil text falls back to Tamil metrics and enforces 1.4
  const latinTamilFit = textFit(tamilText, 'Outfit', 28, 500);
  assert.equal(latinTamilFit.lineHeight, 1.4);
});

// 3. LONG SINGLE WORD (Never breaks a word; shrinks size)
test('3. Long Single Word: never breaks a word, shrinks font size to fit', () => {
  const longWord = 'SUPERDISCOUNTCONFERENCEANDEXHIBITION';
  const boxWidth = 350;
  const initialSize = 48;
  const minSize = 10;

  const fit = textFit(longWord, 'Outfit', initialSize, boxWidth, { minSize });

  // Must remain a single line (word never broken)
  assert.equal(fit.lines.length, 1);
  assert.equal(fit.lines[0], longWord);

  // Size must have shrunk from initialSize 48 to fit in 350px width
  assert.ok(fit.size < initialSize, `Expected size < ${initialSize}, got ${fit.size}`);
  assert.ok(fit.size >= minSize, `Expected size >= ${minSize}, got ${fit.size}`);

  // Test with wrapWords directly: even if narrow, single word is never split
  const wrapped = wrapWords(longWord, 48, 'Outfit', 100);
  assert.equal(wrapped.length, 1);
  assert.equal(wrapped[0], longWord);
});

// 4. LONG HEADLINE (Max 2 lines)
test('4. Long Headline: constrained to max 2 lines, shrinks size', () => {
  const longHeadline =
    'The Grand Annual International Tech Symposium and Global Innovation Leadership Summit 2026';
  const boxWidth = 500;
  const initialSize = 64;

  const fit = textFit(longHeadline, 'Outfit', initialSize, boxWidth, {
    role: 'headline',
  });

  // Max 2 lines strictly enforced for headline
  assert.ok(fit.lines.length <= 2, `Headline must have <= 2 lines, got ${fit.lines.length}`);
  assert.ok(fit.size < initialSize, `Headline size must shrink to fit in 2 lines, got ${fit.size}`);
});

// 5. MINIMUM SIZE RESPECTED (Down to 20px on 1080px poster)
test('5. Minimum Size Respected: never shrinks below 20 px on a 1080 px poster', () => {
  const massiveText =
    'This is an extremely long block of text that could never possibly fit in a tiny 80 pixel box without shrinking below minimum limits.';
  const tinyBoxWidth = 80;
  const initialSize = 50;

  const fit = textFit(massiveText, 'Inter', initialSize, tinyBoxWidth, {
    posterWidth: 1080,
  });

  // Must not shrink below 20 px
  assert.ok(fit.size >= 20, `Font size must not drop below 20 px, got ${fit.size}`);
});

// 6. LOWEST PRIORITY DROPPED FIRST
test('6. Lowest Priority Dropped First: priority order headline > date > time > venue > subtitle > bullets > call to action > slogan', () => {
  // Check priority scores
  assert.ok(FIELD_PRIORITY.headline > FIELD_PRIORITY.date);
  assert.ok(FIELD_PRIORITY.date > FIELD_PRIORITY.time);
  assert.ok(FIELD_PRIORITY.time > FIELD_PRIORITY.venue);
  assert.ok(FIELD_PRIORITY.venue > FIELD_PRIORITY.subtitle);
  assert.ok(FIELD_PRIORITY.subtitle > FIELD_PRIORITY.bullets);
  assert.ok(FIELD_PRIORITY.bullets > FIELD_PRIORITY['call to action']);
  assert.ok(FIELD_PRIORITY['call to action'] > FIELD_PRIORITY.slogan);

  // All 8 fields
  const fields = [
    { role: 'headline', text: 'Tech Summit 2026' },
    { role: 'date', text: '15 Nov 2026' },
    { role: 'time', text: '10:00 AM' },
    { role: 'venue', text: 'Grand Convention Center' },
    { role: 'subtitle', text: 'Shaping the Future of Cloud AI' },
    { role: 'bullets', text: 'Keynotes & Workshops' },
    { role: 'call to action', text: 'Register Today' },
    { role: 'slogan', text: 'Empowering Innovators Everywhere' },
  ];

  // Restrict height so lowest priority must drop
  // 1. Moderate height constraint: slogan drops first
  const fitModerate = fitPrioritizedFields(fields, 800, 240, { gap: 10, minSize: 20 });
  const keptRolesModerate = fitModerate.map((f) => f.role);

  assert.ok(!keptRolesModerate.includes('slogan'), 'Slogan must be dropped first');
  assert.ok(keptRolesModerate.includes('headline'), 'Headline must be kept');
  assert.ok(keptRolesModerate.includes('date'), 'Date must be kept');

  // 2. Tighter height constraint: slogan, call to action, bullets drop before higher priority
  const fitTight = fitPrioritizedFields(fields, 800, 140, { gap: 8, minSize: 20 });
  const keptRolesTight = fitTight.map((f) => f.role);

  assert.ok(!keptRolesTight.includes('slogan'), 'Slogan must be dropped');
  assert.ok(!keptRolesTight.includes('call to action'), 'Call to action must be dropped before subtitle/venue');
  assert.ok(keptRolesTight.includes('headline'), 'Headline has highest priority and must be kept');

  // 3. Ultra tight height: only headline remains
  const fitUltraTight = fitPrioritizedFields(fields, 800, 40, { gap: 4, minSize: 20 });
  assert.equal(fitUltraTight.length, 1);
  assert.equal(fitUltraTight[0].role, 'headline');
});

// 7. DETERMINISTIC
test('7. Deterministic: identical input always produces identical output', () => {
  const textVal = 'Annual Community Sports Festival';
  const result1 = textFit(textVal, 'Montserrat', 36, 600, { role: 'headline' });

  for (let i = 0; i < 50; i++) {
    const result2 = textFit(textVal, 'Montserrat', 36, 600, { role: 'headline' });
    assert.deepEqual(result1.lines, result2.lines);
    assert.equal(result1.height, result2.height);
    assert.equal(result1.size, result2.size);
    assert.equal(result1.lineHeight, result2.lineHeight);
  }
});

// 8. LAYOUT ENGINE INTEGRATION: Text leaves report their real height
test('8. Layout Engine Integration: text leaves report their real height', () => {
  const tree = stack({
    width: 600,
    gap: 20,
    padding: 0,
    children: [
      text('Tamil Event\nஇரத்த தான முகாம்', {
        style: { fontFamily: 'Noto Sans Tamil', size: 30 },
      }),
      text('A very long multi-word description that wraps across multiple lines in a 600px container to test accurate height calculation.', {
        style: { fontFamily: 'Inter', size: 24 },
      }),
    ],
  });

  const elements = layout(tree, {
    contentArea: { x: 0, y: 100, w: 1080, h: 1000 },
    margin: 0,
  });

  assert.equal(elements.length, 2);

  // First element is Tamil: 2 lines * 30px * 1.4 line height = 84px
  assert.equal(elements[0].style.lineHeight, 1.4);
  assert.equal(elements[0].h, 84);

  // Second element position is placed right after first element + gap
  assert.equal(elements[1].y, elements[0].y + elements[0].h + 20);
  assert.ok(elements[1].h > 40);
});

console.log('\nAll 8 TextFit tests passed successfully!');
