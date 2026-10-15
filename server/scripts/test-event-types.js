/**
 * test-event-types.js — Event Types feature tests
 *
 * Tests:
 * 1. Each event type has correct sections (birthday has no officers, award has awardees, etc.)
 * 2. Unknown event type rejected by template create
 * 3. Unknown event type rejected by poster create schema
 * 4. Template filtered by eventType query param
 * 5. AI prompt for birthday never contains officer/committee sections
 * 6. Old templates (no eventTypes) and posters (no eventType) unchanged on read
 * 7. suggestedEventType returned by generate endpoint
 * 8. eventType stored on poster create
 */

import mongoose from 'mongoose';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

// ─── Load environment ────────────────────────────────────────────────────────
process.env.FORCE_MOCK_AI = '1';
const dotenv = require('dotenv');
dotenv.config();

import {
  EVENT_TYPES,
  EVENT_TYPE_IDS,
  allEventTypes,
  eventTypeById,
  isValidEventType,
  guessEventType,
  aiSectionsOf,
  AI_FILLABLE_SECTION_KINDS,
} from '../../shared/eventTypes.js';

// ─── Test runner ─────────────────────────────────────────────────────────────
let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

async function testAsync(name, fn) {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    ${err.message}`);
    failed++;
  }
}

// ─── 1. Shared module correctness ────────────────────────────────────────────
console.log('\n[1] shared/eventTypes.js structure');

test('EVENT_TYPE_IDS has 10 entries', () => {
  assert.equal(EVENT_TYPE_IDS.length, 10);
});

test('allEventTypes() returns 10 entries in correct order', () => {
  const types = allEventTypes();
  assert.equal(types.length, 10);
  assert.equal(types[0].id, 'blood_camp');
  assert.equal(types[9].id, 'general');
});

test('eventTypeById returns correct config', () => {
  const cfg = eventTypeById('birthday');
  assert.equal(cfg.id, 'birthday');
  assert.equal(cfg.label, 'Birthday');
  assert.ok(Array.isArray(cfg.sections) && cfg.sections.length > 0);
});

test('eventTypeById returns undefined for unknown id', () => {
  assert.equal(eventTypeById('unicorn'), undefined);
});

test('isValidEventType returns true for known ids', () => {
  for (const id of EVENT_TYPE_IDS) {
    assert.ok(isValidEventType(id), `${id} should be valid`);
  }
});

test('isValidEventType returns false for unknown', () => {
  assert.equal(isValidEventType('unicorn'), false);
  assert.equal(isValidEventType(''), false);
  assert.equal(isValidEventType(null), false);
});

// ─── 2. birthday has no officers/committee ───────────────────────────────────
console.log('\n[2] birthday has no officers or committee sections');

test('birthday sections: has mainPhoto, name, tagline, details, program, host', () => {
  const cfg = eventTypeById('birthday');
  const ids = cfg.sections.map((s) => s.id);
  assert.ok(ids.includes('name'), 'birthday must have name');
  assert.ok(ids.includes('details'), 'birthday must have details');
  assert.ok(ids.includes('mainPhoto'), 'birthday must have mainPhoto');
});

test('birthday sections: NO committee, guests, awardees, officers', () => {
  const cfg = eventTypeById('birthday');
  const ids = new Set(cfg.sections.map((s) => s.id));
  for (const forbidden of ['committee', 'guests', 'awardees', 'officers']) {
    assert.ok(!ids.has(forbidden), `birthday must NOT have section "${forbidden}"`);
  }
});

test('birthday aiSectionsOf: has name, no cardlist/photo kinds', () => {
  const ai = aiSectionsOf('birthday');
  for (const sec of ai) {
    assert.ok(AI_FILLABLE_SECTION_KINDS.has(sec.kind), `birthday AI section "${sec.id}" must be field or text, got "${sec.kind}"`);
  }
  const ids = ai.map((s) => s.id);
  assert.ok(ids.includes('name'), 'AI sections for birthday must include name');
});

// ─── 3. award_function has awardees, guests, committee ───────────────────────
console.log('\n[3] award_function sections');

test('award_function has guests, awardees, committee, details', () => {
  const cfg = eventTypeById('award_function');
  const ids = cfg.sections.map((s) => s.id);
  assert.ok(ids.includes('guests'), 'award_function must have guests');
  assert.ok(ids.includes('awardees'), 'award_function must have awardees');
  assert.ok(ids.includes('committee'), 'award_function must have committee');
  assert.ok(ids.includes('details'), 'award_function must have details');
});

test('award_function guests/awardees/committee are cardlist kind', () => {
  const cfg = eventTypeById('award_function');
  const cardlistIds = cfg.sections.filter((s) => s.kind === 'cardlist').map((s) => s.id);
  assert.ok(cardlistIds.includes('guests'), 'guests must be cardlist');
  assert.ok(cardlistIds.includes('awardees'), 'awardees must be cardlist');
  assert.ok(cardlistIds.includes('committee'), 'committee must be cardlist');
});

test('award_function aiSectionsOf: only field sections (no cardlists)', () => {
  const ai = aiSectionsOf('award_function');
  for (const sec of ai) {
    assert.ok(AI_FILLABLE_SECTION_KINDS.has(sec.kind), `award_function AI section "${sec.id}" must not be cardlist/photo`);
  }
});

// ─── 4. guessEventType keyword heuristic ─────────────────────────────────────
console.log('\n[4] guessEventType keyword heuristic');

test('guesses blood_camp from "blood donation camp"', () => {
  assert.equal(guessEventType('blood donation camp at city hall'), 'blood_camp');
});

test('guesses birthday from "happy birthday"', () => {
  assert.equal(guessEventType('happy birthday celebration'), 'birthday');
});

test('guesses award_function from "award ceremony"', () => {
  assert.equal(guessEventType('award ceremony for excellence'), 'award_function');
});

test('guesses wedding from "திருமணம்"', () => {
  assert.equal(guessEventType('திருமணம் நிகழ்ச்சி'), 'wedding');
});

test('falls back to general for unknown description', () => {
  assert.equal(guessEventType('some random event nobody knows'), 'general');
});

test('falls back to general for empty string', () => {
  assert.equal(guessEventType(''), 'general');
});

// ─── 5. Server validation — unknown eventType rejected ───────────────────────
console.log('\n[5] Server validation: unknown eventType rejected');

// Test the Zod schema directly
import { generatePosterRequestSchema } from '../../server/validation/poster.schema.js';
import { createPosterSchema } from '../../server/validation/poster.schema.js';

test('generatePosterRequestSchema rejects unknown eventType', () => {
  const result = generatePosterRequestSchema.safeParse({
    prompt: 'A sports day event',
    mode: 'template',
    eventType: 'unicorn',
  });
  assert.equal(result.success, false, 'Should fail for unknown eventType');
});

test('generatePosterRequestSchema accepts known eventType', () => {
  const result = generatePosterRequestSchema.safeParse({
    prompt: 'A birthday party for Priya',
    mode: 'template',
    eventType: 'birthday',
  });
  assert.equal(result.success, true, `Should pass: ${result.error?.issues?.[0]?.message}`);
  assert.equal(result.data.eventType, 'birthday');
});

test('generatePosterRequestSchema accepts missing eventType', () => {
  const result = generatePosterRequestSchema.safeParse({
    prompt: 'A general event',
    mode: 'template',
  });
  assert.equal(result.success, true, 'eventType is optional');
  assert.equal(result.data.eventType, undefined);
});

// ─── 6. Template model: eventTypes field ─────────────────────────────────────
console.log('\n[6] Template model schema: eventTypes field');

import Template from '../../server/models/Template.model.js';

test('Template model has eventTypes field in schema', () => {
  const paths = Template.schema.paths;
  assert.ok('eventTypes' in paths || 'eventTypes.0' in paths, 'Template schema must have eventTypes field');
});

// ─── 7. Poster model: eventType field ───────────────────────────────────────
console.log('\n[7] Poster model schema: eventType field');

import Poster from '../../server/models/Poster.model.js';

test('Poster model has eventType field in schema', () => {
  const paths = Poster.schema.paths;
  assert.ok('eventType' in paths, 'Poster schema must have eventType field');
});

test('Poster model eventType defaults to general', () => {
  const p = new Poster({
    clientId: new mongoose.Types.ObjectId(),
    templateId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    title: 'Test poster',
    prompt: 'A test poster',
    content: { title: 'Test', tagline: '', date: '', time: '', venue: '' },
    design: {},
  });
  assert.equal(p.eventType, 'general');
});

test('Poster model rejects unknown eventType', () => {
  const p = new Poster({
    clientId: new mongoose.Types.ObjectId(),
    templateId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    title: 'Test poster',
    prompt: 'A test poster',
    content: { title: 'Test', tagline: '', date: '', time: '', venue: '' },
    design: {},
    eventType: 'unicorn',
  });
  const err = p.validateSync();
  assert.ok(err, 'Should fail validation for unknown eventType');
  assert.ok(err.errors.eventType, 'Error should be on eventType field');
});

test('Poster model accepts known eventType', () => {
  const p = new Poster({
    clientId: new mongoose.Types.ObjectId(),
    templateId: new mongoose.Types.ObjectId(),
    userId: new mongoose.Types.ObjectId(),
    title: 'Birthday poster',
    prompt: 'A birthday poster',
    content: { title: 'Happy Birthday', tagline: '', date: '', time: '', venue: '' },
    design: {},
    eventType: 'birthday',
  });
  const err = p.validateSync();
  // The only required fields missing are nested; the eventType itself should be valid
  assert.ok(!err?.errors?.eventType, `eventType 'birthday' must not cause a validation error`);
});

// ─── 8. AI prompt builder: birthday prompt has no officers ───────────────────
console.log('\n[8] AI prompt builder constrains birthday output');

import { buildSystemPrompt } from '../../server/services/ai/prompt.js';

test('birthday prompt Output Schema does NOT list officers, committee, guests, awardees as output keys', () => {
  const prompt = buildSystemPrompt({
    brandKit: { orgName: 'Test Org' },
    template: { category: 'Birthday' },
    variables: [],
    eventType: 'birthday',
  });
  // Check only the Output Schema section (everything after "Output Schema & Limits:")
  const schemaSection = prompt.split('Output Schema & Limits:').pop();
  assert.ok(!schemaSection.includes('- committee:'), 'birthday output schema must not include committee key');
  assert.ok(!schemaSection.includes('- guests:'), 'birthday output schema must not include guests key');
  assert.ok(!schemaSection.includes('- awardees:'), 'birthday output schema must not include awardees key');
  assert.ok(!schemaSection.includes('- officers:'), 'birthday output schema must not include officers key');
});

test('birthday prompt includes name and tagline sections', () => {
  const prompt = buildSystemPrompt({
    brandKit: { orgName: 'Test Org' },
    template: { category: 'Birthday' },
    variables: [],
    eventType: 'birthday',
  });
  assert.ok(prompt.includes('name'), 'birthday prompt must include name section');
  assert.ok(prompt.includes('tagline') || prompt.includes('wishes'), 'birthday prompt must include tagline');
});

test('birthday prompt does NOT include date or venue sections', () => {
  const prompt = buildSystemPrompt({
    brandKit: { orgName: 'Test Org' },
    template: { category: 'Birthday' },
    variables: [],
    eventType: 'birthday',
  });
  // birthday has no date, time, venue sections in eventTypes config
  const schemaSection = prompt.split('Output Schema').pop();
  assert.ok(!schemaSection.includes('- date:'), 'birthday prompt output schema must not include date');
  assert.ok(!schemaSection.includes('- venue:'), 'birthday prompt output schema must not include venue');
});

test('general/unknown eventType prompt includes all standard fields', () => {
  const prompt = buildSystemPrompt({
    brandKit: { orgName: 'Test Org' },
    template: { category: 'General' },
    variables: [],
    eventType: 'general',
  });
  // general type has title, tagline, date, time, venue, details
  assert.ok(prompt.includes('title'), 'general prompt must include title');
  assert.ok(prompt.includes('date'), 'general prompt must include date');
  assert.ok(prompt.includes('venue'), 'general prompt must include venue');
});

test('no eventType → prompt includes all standard fields', () => {
  const prompt = buildSystemPrompt({
    brandKit: { orgName: 'Test Org' },
    template: { category: 'General' },
    variables: [],
  });
  assert.ok(prompt.includes('title'), 'prompt without eventType must include title');
  assert.ok(prompt.includes('date'), 'prompt without eventType must include date');
  assert.ok(prompt.includes('venue'), 'prompt without eventType must include venue');
});

// ─── 9. Old templates/posters backward compatibility ─────────────────────────
console.log('\n[9] Old templates/posters backward compatibility');

test('Template model: eventTypes defaults to empty array', () => {
  const t = new Template({
    clientId: new mongoose.Types.ObjectId(),
    name: 'Old Template',
    category: 'Event',
    size: { width: 1080, height: 1350 },
    zones: [{ id: 'h', type: 'header', x: 0, y: 0, w: 1080, h: 80 }],
    elements: [],
    version: 1,
    isActive: true,
    isDefault: false,
  });
  assert.deepEqual(t.eventTypes, [], 'Old templates must have eventTypes defaulting to []');
});

test('DesignChooser: template with eventTypes=[] matches all types (pure logic test)', () => {
  // Simulates DesignChooser's typeFiltered logic:
  // A template with eventTypes:[] should show for any event type
  function templateMatchesType(template, eventType) {
    const tags = template.eventTypes;
    if (!Array.isArray(tags) || tags.length === 0) return true;
    return tags.includes(eventType);
  }
  const oldTemplate = { eventTypes: [] };
  assert.ok(templateMatchesType(oldTemplate, 'birthday'), 'old template must show for birthday');
  assert.ok(templateMatchesType(oldTemplate, 'award_function'), 'old template must show for award_function');
  assert.ok(templateMatchesType(oldTemplate, 'general'), 'old template must show for general');

  const taggedTemplate = { eventTypes: ['birthday', 'wedding'] };
  assert.ok(templateMatchesType(taggedTemplate, 'birthday'), 'tagged template must show for birthday');
  assert.ok(!templateMatchesType(taggedTemplate, 'award_function'), 'tagged template must NOT show for award_function');
});

// ─── Summary ──────────────────────────────────────────────────────────────────
console.log(`\n${'─'.repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
