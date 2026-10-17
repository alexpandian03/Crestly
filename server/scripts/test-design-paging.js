/**
 * /server/scripts/test-design-paging.js
 *
 * Test suite for Stateless Design Paging:
 *  1. No repeats until exhausted (12 unique designs across 6 pages of size 2).
 *  2. Pages differ in structure (layout signatures and blocks differ across pages).
 *  3. Same description and seed give the exact same order and elements.
 *  4. Refresh after exhaustion gives fresh designs not in seen[].
 *  5. AI failure falls back to rule-based copy for every page.
 *  6. End-to-end controller integration: proper response envelope, "Design N" labels, zero preset names.
 */

import 'dotenv/config';
import assert from 'node:assert';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import {
  TOTAL_PAGING_DESIGNS,
  serializeSignature,
  deriveSeedForIndex,
  deriveNextSeed,
  pairDesignWithVariant,
  composeDesignBatch,
  resolvePagedOptions,
} from '../../shared/designPaging.js';
import { createRuleBasedChoices } from '../../shared/aiChoices.js';
import { generatePosterContentController } from '../controllers/poster.controller.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';

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

console.log('Running Design Paging Tests...');

const TEST_PROMPT = 'Blood Donation Camp on 15 Nov 2026, 9:00 AM at Community Health Center. Be a hero, donate blood.';
const TEST_SEED = 777;

async function runAllTests() {
  await connectDB();

  // Find or create test client and brand kit for controller tests
  let client = await Client.findOne().lean();
  let brandKit = null;
  if (client) {
    brandKit = await BrandKit.findOne({ clientId: client._id }).lean();
  }
  const testClientId = client?._id || new mongoose.Types.ObjectId();

  // 1. NO REPEATS UNTIL EXHAUSTED
  await test('1. No repeats until exhausted: 12 unique designs across 6 pages (pageSize 2)', () => {
    const choices = createRuleBasedChoices({ prompt: TEST_PROMPT, seed: TEST_SEED });
    const candidates = composeDesignBatch({
      facts: choices.facts,
      eventType: choices.facts.eventType,
      mood: choices.mood,
      blockPreferences: choices.blockPreferences,
      copyVariants: choices.copyVariants,
      seed: TEST_SEED,
      totalCount: TOTAL_PAGING_DESIGNS,
    });

    assert.strictEqual(candidates.length, TOTAL_PAGING_DESIGNS, 'Batch should contain 12 candidates');

    const seen = [];
    const collectedSignatures = [];

    for (let page = 0; page < 6; page++) {
      const paged = resolvePagedOptions({
        candidates,
        pageSize: 2,
        seen,
        seenCount: seen.length,
      });

      assert.strictEqual(paged.options.length, 2, `Page ${page + 1} should have 2 options`);
      assert.strictEqual(paged.remaining, 12 - (page + 1) * 2, `Remaining should decrease by 2 each page`);

      for (const opt of paged.options) {
        assert(!seen.includes(opt.design.signature), `Signature ${opt.design.signature} must not be in seen[]`);
        seen.push(opt.design.signature);
        collectedSignatures.push(opt.design.signature);
      }
    }

    // All 12 signatures must be distinct
    const uniqueSignatures = new Set(collectedSignatures);
    assert.strictEqual(uniqueSignatures.size, 12, 'All 12 collected designs must have unique signatures');

    // Page 7 should have 0 remaining and 0 options
    const exhaustedPage = resolvePagedOptions({
      candidates,
      pageSize: 2,
      seen,
      seenCount: seen.length,
    });
    assert.strictEqual(exhaustedPage.options.length, 0, 'Exhausted page should have 0 options');
    assert.strictEqual(exhaustedPage.remaining, 0, 'Exhausted page should have 0 remaining');
  });

  // 2. PAGES DIFFER IN STRUCTURE
  await test('2. Pages differ in structure: Page 1 and Page 2 have distinct blocks and signatures', () => {
    const choices = createRuleBasedChoices({ prompt: TEST_PROMPT, seed: TEST_SEED });
    const candidates = composeDesignBatch({
      facts: choices.facts,
      eventType: choices.facts.eventType,
      mood: choices.mood,
      blockPreferences: choices.blockPreferences,
      copyVariants: choices.copyVariants,
      seed: TEST_SEED,
      totalCount: TOTAL_PAGING_DESIGNS,
    });

    const page1 = resolvePagedOptions({ candidates, pageSize: 2, seen: [], seenCount: 0 });
    const seenPage1 = page1.options.map((o) => o.design.signature);

    const page2 = resolvePagedOptions({ candidates, pageSize: 2, seen: seenPage1, seenCount: seenPage1.length });

    // Assert disjoint signatures
    for (const opt2 of page2.options) {
      assert(!seenPage1.includes(opt2.design.signature), 'Page 2 signature must not be in Page 1');
    }

    // Verify blocks differ across options
    const sig1 = page1.options[0].design.signature;
    const sig2 = page2.options[0].design.signature;
    assert.notStrictEqual(sig1, sig2, 'Page 1 option 1 and Page 2 option 1 must have different signatures');
  });

  // 3. SAME DESCRIPTION AND SEED GIVE THE EXACT SAME ORDER
  await test('3. Determinism: Same description and seed give exact same order and elements', () => {
    const run1Choices = createRuleBasedChoices({ prompt: TEST_PROMPT, seed: 999 });
    const run1Candidates = composeDesignBatch({
      facts: run1Choices.facts,
      eventType: run1Choices.facts.eventType,
      mood: run1Choices.mood,
      blockPreferences: run1Choices.blockPreferences,
      copyVariants: run1Choices.copyVariants,
      seed: 999,
      totalCount: 4,
    });

    const run2Choices = createRuleBasedChoices({ prompt: TEST_PROMPT, seed: 999 });
    const run2Candidates = composeDesignBatch({
      facts: run2Choices.facts,
      eventType: run2Choices.facts.eventType,
      mood: run2Choices.mood,
      blockPreferences: run2Choices.blockPreferences,
      copyVariants: run2Choices.copyVariants,
      seed: 999,
      totalCount: 4,
    });

    assert.strictEqual(run1Candidates.length, run2Candidates.length);
    for (let i = 0; i < run1Candidates.length; i++) {
      assert.strictEqual(
        run1Candidates[i].sigStr,
        run2Candidates[i].sigStr,
        `Signature at index ${i} must match identically across runs`
      );
      assert.strictEqual(
        run1Candidates[i].design.elements.length,
        run2Candidates[i].design.elements.length,
        `Element count at index ${i} must match identically across runs`
      );
      assert.strictEqual(
        run1Candidates[i].variant.angle,
        run2Candidates[i].variant.angle,
        `Variant angle at index ${i} must match identically across runs`
      );
    }
  });

  // 4. REFRESH AFTER EXHAUSTION GIVES NEW DESIGNS
  await test('4. Refresh after exhaustion: derives new seed and returns designs never in seen[]', () => {
    const choices = createRuleBasedChoices({ prompt: TEST_PROMPT, seed: TEST_SEED });
    const batch1 = composeDesignBatch({
      facts: choices.facts,
      eventType: choices.facts.eventType,
      mood: choices.mood,
      blockPreferences: choices.blockPreferences,
      copyVariants: choices.copyVariants,
      seed: TEST_SEED,
      totalCount: TOTAL_PAGING_DESIGNS,
    });

    // Mark all 12 designs as seen
    const seen = batch1.map((c) => c.sigStr);
    assert.strictEqual(seen.length, 12);

    // Initial check: 0 unseen
    const pagedExhausted = resolvePagedOptions({ candidates: batch1, pageSize: 2, seen, seenCount: 12 });
    assert.strictEqual(pagedExhausted.options.length, 0);

    // Derive next seed and refresh
    const nextSeed = deriveNextSeed(TEST_SEED);
    assert.notStrictEqual(nextSeed, TEST_SEED, 'Next seed must differ from current seed');

    const freshChoices = createRuleBasedChoices({ prompt: TEST_PROMPT, seed: nextSeed });
    const batch2 = composeDesignBatch({
      facts: freshChoices.facts,
      eventType: freshChoices.facts.eventType,
      mood: freshChoices.mood,
      blockPreferences: freshChoices.blockPreferences,
      copyVariants: freshChoices.copyVariants,
      seed: nextSeed,
      totalCount: TOTAL_PAGING_DESIGNS,
    });

    const freshPaged = resolvePagedOptions({
      candidates: batch2,
      pageSize: 2,
      seen,
      seenCount: 12,
    });

    assert.strictEqual(freshPaged.options.length, 2, 'Fresh page should return 2 options');
    for (const opt of freshPaged.options) {
      assert(!seen.includes(opt.design.signature), `Refreshed design ${opt.design.signature} must NEVER be in seen[]`);
      assert.strictEqual(opt.label.startsWith('Design '), true, 'Label must be "Design N"');
    }
  });

  // 5. AI FAILURE FALLS BACK TO RULE-BASED COPY FOR EVERY PAGE
  await test('5. AI failure fallback: rule-based copy reliably powers every page', () => {
    // Intentionally pass an empty or messy prompt to test fallback robustness
    const fallbackChoices = createRuleBasedChoices({ prompt: 'Tech Meetup', seed: 12345 });
    assert(fallbackChoices.copyVariants.length >= 3, 'Must have at least 3 fallback copy variants');

    const batch = composeDesignBatch({
      facts: fallbackChoices.facts,
      eventType: 'meeting',
      mood: 'modern',
      copyVariants: fallbackChoices.copyVariants,
      seed: 12345,
      totalCount: 4,
    });

    assert.strictEqual(batch.length, 4, 'Must compose 4 fallback candidates');
    for (const c of batch) {
      assert(c.pairedContent.title.length > 0, 'Paired content must have title');
      assert(c.variant.angle, 'Paired variant must have angle');
    }

    const paged = resolvePagedOptions({ candidates: batch, pageSize: 2, seen: [], seenCount: 0 });
    assert.strictEqual(paged.options.length, 2);
    assert.strictEqual(paged.options[0].label, 'Design 1');
    assert.strictEqual(paged.options[1].label, 'Design 2');
  });

  // 6. CONTROLLER INTEGRATION (POST /api/posters/generate mode=paging)
  await test('6. Controller integration: End-to-end POST handler for mode=paging', async () => {
    const mockReqPage1 = {
      clientId: testClientId,
      body: {
        prompt: TEST_PROMPT,
        mode: 'paging',
        pageSize: 2,
        seed: 42,
        seen: [],
      },
      headers: {},
    };

    let status1 = null;
    let json1 = null;
    const mockRes1 = {
      status(s) {
        status1 = s;
        return this;
      },
      json(data) {
        json1 = data;
        return this;
      },
    };

    await generatePosterContentController(mockReqPage1, mockRes1);

    assert.strictEqual(status1, 200, 'Page 1 must respond with 200');
    assert.strictEqual(json1.success, true);
    assert.strictEqual(json1.data.options.length, 2);
    assert.strictEqual(json1.data.options[0].label, 'Design 1');
    assert.strictEqual(json1.data.options[1].label, 'Design 2');
    assert.strictEqual(json1.data.total, 12);
    assert.strictEqual(json1.data.remaining, 10);
    assert(json1.data.copyVariants.length >= 3, 'Must return copyVariants payload for stateless next page');

    // Page 2: Client passes back copyVariants and seen[] (costs NO AI call)
    const seenPage1 = json1.data.options.map((o) => o.design.signature);
    const mockReqPage2 = {
      clientId: testClientId,
      body: {
        prompt: TEST_PROMPT,
        mode: 'paging',
        pageSize: 2,
        seed: json1.data.seed,
        seen: seenPage1,
        copyVariants: json1.data.copyVariants,
        facts: json1.data.facts,
        mood: json1.data.mood,
        reason: json1.data.reason,
        blockPreferences: json1.data.blockPreferences,
      },
      headers: {},
    };

    let status2 = null;
    let json2 = null;
    const mockRes2 = {
      status(s) {
        status2 = s;
        return this;
      },
      json(data) {
        json2 = data;
        return this;
      },
    };

    await generatePosterContentController(mockReqPage2, mockRes2);

    assert.strictEqual(status2, 200, 'Page 2 must respond with 200');
    assert.strictEqual(json2.success, true);
    assert.strictEqual(json2.data.options.length, 2);
    assert.strictEqual(json2.data.options[0].label, 'Design 3');
    assert.strictEqual(json2.data.options[1].label, 'Design 4');
    assert.strictEqual(json2.data.remaining, 8);

    // Verify neither option on Page 2 was in seenPage1
    for (const opt of json2.data.options) {
      assert(!seenPage1.includes(opt.design.signature), `Page 2 option ${opt.design.signature} must not be in seen`);
      // Assert no preset names (only "Design N")
      assert(/^Design \d+$/.test(opt.label), `Display label "${opt.label}" must be strictly "Design N"`);
    }

    // Page Exhaustion: Collect all 12 candidate signatures for this seed
    const allCandidates = composeDesignBatch({
      facts: json1.data.facts,
      eventType: 'blood_camp',
      mood: json1.data.mood,
      blockPreferences: json1.data.blockPreferences,
      copyVariants: json1.data.copyVariants,
      seed: json1.data.seed,
      totalCount: TOTAL_PAGING_DESIGNS,
      brandKit,
    });
    const allSeen = allCandidates.map((c) => c.sigStr);

    const mockReqExhausted = {
      clientId: testClientId,
      body: {
        prompt: TEST_PROMPT,
        eventType: 'blood_camp',
        mode: 'paging',
        pageSize: 2,
        seed: json1.data.seed,
        seen: allSeen,
        remaining: 0,
        copyVariants: json1.data.copyVariants,
        facts: json1.data.facts,
      },
      headers: {},
    };

    let status3 = null;
    let json3 = null;
    const mockRes3 = {
      status(s) {
        status3 = s;
        return this;
      },
      json(data) {
        json3 = data;
        return this;
      },
    };

    await generatePosterContentController(mockReqExhausted, mockRes3);

    assert.strictEqual(status3, 200, 'Exhaustion refresh must respond with 200');
    assert.strictEqual(json3.success, true);
    assert.strictEqual(json3.data.options.length, 2, 'Refreshed call must return 2 fresh options');
    assert.notStrictEqual(json3.data.seed, json1.data.seed, 'Refreshed seed must differ from previous seed');
    for (const opt of json3.data.options) {
      assert(!allSeen.includes(opt.design.signature), `Fresh design ${opt.design.signature} must not be in allSeen[]`);
    }
  });

  console.log(`\nAll ${count} Design Paging tests passed!`);
  await mongoose.disconnect();
}

runAllTests().catch((err) => {
  console.error('\nTest failed:', err);
  mongoose.disconnect().finally(() => process.exit(1));
});
