/**
 * /server/scripts/test-ai-choices.js
 *
 * Test suite for AI Choices (ONE Gemini call, validation, enums,
 * fallback model, rule-based fallback, and daily limits).
 *
 * Assertions:
 *  1. Invalid enums rejected (replaced by composer's choice).
 *  2. Hex colours and URLs in output are rejected.
 *  3. Facts are identical across all variants.
 *  4. Fallback model and rule-based fallback work.
 *  5. Daily limit works with atomic MongoDB update.
 *  6. Same description and seed give the same result.
 */

import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import {
  BLOCK_ENUMS,
  VALID_MOODS,
  VALID_ANGLES,
  validateAiChoices,
  createRuleBasedChoices,
  hasForbiddenContent,
} from '../../shared/aiChoices.js';
import { generateAiChoices, checkChoicesDailyLimit } from '../services/ai/choices.js';
import { consumeRateLimit } from '../services/rateLimit.js';
import RateCounter from '../models/RateCounter.model.js';

let count = 0;
const test = async (desc, fn) => {
  count++;
  try {
    await fn();
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    throw err;
  }
};

console.log('Running AI Choices Tests...');

const TEST_PROMPT = 'Annual Sports Day on 18 Oct 2026, 8:00 AM at City Stadium. Join us for track races and team relays.';

async function runAllTests() {
  await connectDB();

  // 1. INVALID ENUMS REJECTED AND REPLACED BY COMPOSER CHOICE
  await test('1. Invalid enums rejected: replaced by valid composer choices', () => {
    const malformedRaw = {
      facts: {
        title: 'Annual Sports Day',
        date: '18 Oct 2026',
        time: '8:00 AM',
        venue: 'City Stadium',
        details: ['Track events', 'Team relays'],
      },
      mood: 'apocalyptic_rage', // Invalid mood
      blockPreferences: {
        hero: 'hero-fake-nonexistent', // Invalid hero enum
        info: 'info-invalid-xyz', // Invalid info enum
        message: 'message-none',
        cta: 'cta-pill-button',
        background: 'bg-alien-invasion', // Invalid bg enum
        decoration: 'decoration-unknown', // Invalid dec enum
      },
      reason: 'A great sports day layout for community athletes.',
      copyVariants: [
        {
          angle: 'unsupported_angle_123', // Invalid angle
          subtitle: 'Come cheer for your favorite athletes',
          slogan: { line1: 'Run Fast', line2: 'Win Big' },
          quote: '',
          bullets: ['Track events', 'Team relays'],
          cta: { line: 'Registration desk at main entrance', button: 'Register' },
          ribbonText: 'Sports Meet',
        },
        {
          angle: 'formal',
          subtitle: 'Official Annual Athletic Meet',
          slogan: { line1: 'Strength and Honor', line2: 'Compete with Integrity' },
          quote: '',
          bullets: ['Track events', 'Team relays'],
          cta: { line: 'Registration desk at main entrance', button: 'Register' },
          ribbonText: 'Official',
        },
      ],
    };

    const validated = validateAiChoices(malformedRaw, {
      prompt: TEST_PROMPT,
      eventType: 'sports_day',
      seed: 42,
    });

    assert.ok(validated.data, 'Validation must return sanitized data');

    // Mood replaced with valid enum
    assert.ok(
      VALID_MOODS.includes(validated.data.mood),
      `Mood "${validated.data.mood}" must be one of: ${VALID_MOODS.join(', ')}`
    );

    // Block preferences replaced with valid enums
    assert.ok(
      BLOCK_ENUMS.hero.includes(validated.data.blockPreferences.hero),
      `Hero "${validated.data.blockPreferences.hero}" is not a valid enum`
    );
    assert.ok(
      BLOCK_ENUMS.info.includes(validated.data.blockPreferences.info),
      `Info "${validated.data.blockPreferences.info}" is not a valid enum`
    );
    assert.ok(
      BLOCK_ENUMS.background.includes(validated.data.blockPreferences.background),
      `Background "${validated.data.blockPreferences.background}" is not a valid enum`
    );
    assert.ok(
      BLOCK_ENUMS.decoration.includes(validated.data.blockPreferences.decoration),
      `Decoration "${validated.data.blockPreferences.decoration}" is not a valid enum`
    );

    // All variants must have valid angles
    for (const v of validated.data.copyVariants) {
      assert.ok(
        VALID_ANGLES.includes(v.angle),
        `Variant angle "${v.angle}" is not in: ${VALID_ANGLES.join(', ')}`
      );
    }
  });

  // 1b. CLEAN GEMINI JSON RETURNS OK WITH ZERO ERRORS
  await test('1b. Clean model output matching schema passes validation with 0 errors', () => {
    const cleanRaw = {
      facts: {
        title: 'Annual Sports Meet 2026',
        subtitle: 'Track and Field Meet',
        date: '18 Oct',
        time: '8:00 AM',
        venue: 'City Stadium',
        details: ['100m sprint', 'Relay race'],
        contact: 'Call 9876543210',
        language: 'en',
        eventType: 'sports_day',
      },
      mood: 'energetic',
      blockPreferences: {
        hero: 'hero-bold-headline',
        info: 'info-triple-pill',
        message: 'message-highlights-bullets',
        cta: 'cta-pill-button',
        background: 'background-solid',
        decoration: 'decoration-corner-accents',
      },
      reason: 'An energetic, bold layout perfectly suited for high-impact sports day activities.',
      copyVariants: [
        {
          angle: 'formal',
          subtitle: 'Official Athletic Championship',
          slogan: { line1: 'Excellence in Motion', line2: 'Compete with Honor' },
          quote: '',
          bullets: ['100m sprint', 'Relay race'],
          cta: { line: 'Join us at the arena', button: 'Register' },
          ribbonText: 'Championship',
        },
        {
          angle: 'friendly',
          subtitle: 'Come Cheer for Your Community',
          slogan: { line1: 'Fun for Everyone', line2: 'Run and Celebrate' },
          quote: '',
          bullets: ['100m sprint', 'Relay race'],
          cta: { line: 'Bring your friends', button: 'Come Along' },
          ribbonText: 'Community',
        },
        {
          angle: 'urgent',
          subtitle: 'Registration Closes Soon',
          slogan: { line1: 'Secure Your Lane', line2: 'Limited Entries' },
          quote: '',
          bullets: ['100m sprint', 'Relay race'],
          cta: { line: 'Register before Friday', button: 'Sign Up' },
          ribbonText: 'Hurry',
        },
        {
          angle: 'short',
          subtitle: '',
          slogan: { line1: '', line2: '' },
          quote: '',
          bullets: [],
          cta: { line: '', button: 'Details' },
          ribbonText: '',
        },
      ],
    };

    const validated = validateAiChoices(cleanRaw, {
      prompt: TEST_PROMPT,
      eventType: 'sports_day',
      seed: 42,
    });

    assert.strictEqual(validated.ok, true, `Validation failed unexpectedly: ${validated.errors.join(', ')}`);
    assert.strictEqual(validated.errors.length, 0);
    assert.strictEqual(validated.data.copyVariants.length, 4);
    assert.strictEqual(validated.data.blockPreferences.hero, 'hero-bold-headline');
    assert.strictEqual(validated.data.blockPreferences.info, 'info-triple-pill');
    assert.strictEqual(validated.data.mood, 'energetic');
  });

  // 2. A HEX COLOUR OR URL IN THE OUTPUT IS REJECTED
  await test('2. Hex colours and URLs in output are rejected', () => {
    const contaminatedRaw = {
      facts: {
        title: 'Blood Donation Camp',
        date: '15 Nov 2026',
        time: '10:00 AM',
        venue: 'City Hospital',
      },
      mood: 'urgent',
      blockPreferences: {
        hero: 'hero-bold-headline',
        info: 'info-three-column-grid',
        message: 'message-none',
        cta: 'cta-pill-button',
        background: 'bg-clean-canvas',
        decoration: 'decoration-none',
      },
      reason: 'Clean urgent layout for blood drive.',
      copyVariants: [
        {
          angle: 'urgent',
          subtitle: 'Our primary color is #2563EB and secondary is #EFF6FF', // Contains hex color!
          slogan: { line1: 'Donate Blood', line2: 'Save Lives' },
          quote: '',
          bullets: ['Certified doctors', 'Refreshments'],
          cta: { line: 'Registration desk open', button: 'Donate' },
          ribbonText: 'Urgent',
        },
        {
          angle: 'friendly',
          subtitle: 'Visit https://blood-donation-scam.com for more info', // Contains URL!
          slogan: { line1: 'Every Drop Counts', line2: 'Join Us Today' },
          quote: '',
          bullets: ['Certified doctors', 'Refreshments'],
          cta: { line: 'Visit http://phishing.org/register', button: 'Donate' }, // Contains URL!
          ribbonText: 'Welcome',
        },
        {
          angle: 'formal',
          subtitle: 'Click here <script>alert("hack")</script> for event details', // Contains HTML!
          slogan: { line1: 'Noble Cause', line2: 'Community Health' },
          quote: '',
          bullets: ['Certified doctors', 'Refreshments'],
          cta: { line: 'Hospital Conference Hall', button: 'Donate' },
          ribbonText: 'Official',
        },
        {
          angle: 'emotional',
          subtitle: 'Give the gift of life to those in critical emergency care', // Clean variant!
          slogan: { line1: 'A Small Act of Kindness', line2: 'A Lifetime of Difference' },
          quote: '',
          bullets: ['Certified doctors', 'Refreshments'],
          cta: { line: 'Community Auditorium Sector 4', button: 'Be a Donor' },
          ribbonText: 'Life Saver',
        },
      ],
    };

    const validated = validateAiChoices(contaminatedRaw, {
      prompt: 'Blood Donation Camp on 15 Nov 2026, 10:00 AM at City Hospital.',
      eventType: 'blood_camp',
      seed: 123,
    });

    // Verify that variants with hex colors or URLs were dropped
    for (const v of validated.data.copyVariants) {
      assert.ok(
        !hasForbiddenContent(v.subtitle),
        `Variant subtitle contains forbidden content: ${v.subtitle}`
      );
      assert.ok(
        !hasForbiddenContent(v.slogan.line1),
        `Variant slogan.line1 contains forbidden content: ${v.slogan.line1}`
      );
      assert.ok(
        !hasForbiddenContent(v.cta.line),
        `Variant cta.line contains forbidden content: ${v.cta.line}`
      );
      assert.ok(
        !hasForbiddenContent(v.cta.button),
        `Variant cta.button contains forbidden content: ${v.cta.button}`
      );
    }

    // Fewer than 3 survived, so it must have filled with rule-based fallback to at least 4
    assert.ok(
      validated.data.copyVariants.length >= 4,
      `Expected at least 4 variants after fallback fill, got ${validated.data.copyVariants.length}`
    );
  });

  // 3. FACTS IDENTICAL ACROSS VARIANTS
  await test('3. Facts identical across variants: title, date, time, venue never mutate or invent', () => {
    const choices = createRuleBasedChoices({
      prompt: TEST_PROMPT,
      eventType: 'sports_day',
      seed: 55,
    });

    const { title, date, time, venue } = choices.facts;
    assert.strictEqual(title, 'Annual Sports Day');
    assert.strictEqual(date, '18 Oct');
    assert.strictEqual(time, '8:00 AM');
    assert.strictEqual(venue, 'City Stadium');

    // Verify each copyVariant maintains facts integrity
    for (const v of choices.copyVariants) {
      // Slogans and subtitles must not invent conflicting venues or dates
      assert.ok(!v.subtitle.includes('2030'), 'Variant invented a fake date');
      assert.ok(!v.slogan.line1.includes('$'), 'Variant invented a price');
      assert.ok(!v.slogan.line2.includes('$'), 'Variant invented a price');
    }
  });

  // 4. FALLBACK MODEL AND RULE-BASED FALLBACK WORK
  await test('4. Fallback model and rule-based fallback work reliably', async () => {
    // Test rule-based fallback directly
    const fallback = createRuleBasedChoices({
      prompt: 'Employee of the year awards on 5 Dec, 6 PM, auditorium.',
      eventType: 'award_function',
      seed: 77,
    });

    assert.strictEqual(fallback.facts.title, 'Employee of the Year Awards');
    assert.strictEqual(fallback.facts.date, '5 Dec');
    assert.strictEqual(fallback.facts.time, '6 PM');
    assert.strictEqual(fallback.facts.venue, 'Auditorium');
    assert.ok(BLOCK_ENUMS.hero.includes(fallback.blockPreferences.hero));
    assert.ok(BLOCK_ENUMS.info.includes(fallback.blockPreferences.info));
    assert.ok(fallback.copyVariants.length >= 4);
    assert.ok(fallback.reason.length <= 90);

    // Test generateAiChoices with fallback behavior
    const aiChoices = await generateAiChoices({
      prompt: 'Technical workshop on React and Node.js on 22 Nov, 10 AM, Innovation Lab.',
      eventType: 'workshop',
      seed: 88,
    });

    assert.ok(aiChoices.facts.title);
    assert.ok(aiChoices.facts.date);
    assert.ok(aiChoices.copyVariants.length >= 4);
    assert.ok(aiChoices.reason.length <= 90);
  });

  // 5. DAILY LIMIT WORKS WITH ATOMIC UPDATE
  await test('5. Daily limit: enforced per-user with atomic update in MongoDB', async () => {
    const testUserId = `test-user-limit-${Date.now()}`;
    const windowMs = 60 * 1000;
    const limit = 3;

    try {
      // Consume 3 times
      const r1 = await consumeRateLimit({ key: `test-daily:${testUserId}`, limit, windowMs });
      assert.strictEqual(r1.allowed, true);
      assert.strictEqual(r1.count, 1);

      const r2 = await consumeRateLimit({ key: `test-daily:${testUserId}`, limit, windowMs });
      assert.strictEqual(r2.allowed, true);
      assert.strictEqual(r2.count, 2);

      const r3 = await consumeRateLimit({ key: `test-daily:${testUserId}`, limit, windowMs });
      assert.strictEqual(r3.allowed, true);
      assert.strictEqual(r3.count, 3);

      // 4th time exceeds limit
      const r4 = await consumeRateLimit({ key: `test-daily:${testUserId}`, limit, windowMs });
      assert.strictEqual(r4.allowed, false);
      assert.strictEqual(r4.count, 4);
      assert.strictEqual(r4.remaining, 0);
    } finally {
      await RateCounter.deleteMany({ key: `test-daily:${testUserId}` });
    }
  });

  // 6. SAME DESCRIPTION AND SEED GIVE THE SAME RESULT
  await test('6. Determinism: identical description and seed produce identical choices', async () => {
    const prompt = 'Blood donation camp on 12 Dec 2026, 9 AM - 2 PM, Sector 4 Community Hall.';
    const seed = 314159;

    const result1 = await generateAiChoices({
      prompt,
      eventType: 'blood_camp',
      seed,
    });

    const result2 = await generateAiChoices({
      prompt,
      eventType: 'blood_camp',
      seed,
    });

    assert.deepStrictEqual(result1.facts, result2.facts, 'Facts must be identical');
    assert.strictEqual(result1.mood, result2.mood, 'Mood must be identical');
    assert.deepStrictEqual(result1.blockPreferences, result2.blockPreferences, 'Block preferences must be identical');
    assert.strictEqual(result1.reason, result2.reason, 'Reason must be identical');
    assert.deepStrictEqual(result1.copyVariants, result2.copyVariants, 'Copy variants must be identical');
  });

  console.log(`\nAll ${count} AI Choices test suites passed successfully!`);
  await mongoose.disconnect();
}

runAllTests().catch((err) => {
  console.error('Test run failed:', err);
  process.exit(1);
});
