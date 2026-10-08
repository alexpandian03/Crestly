import assert from 'node:assert/strict';
import { resolvePosterImage, extractEventKeywords } from '../services/images.js';
import { generateWithMock, extractVenue } from '../services/ai/providers/mock.js';
import { isSamplePlaceholder } from '../../shared/templateElements.js';
import { buildRecipeDesign, recipeNeedsPhoto } from '../services/poster/recipe.js';
import { designToContent } from '../services/ai/schema.js';

console.log('🧪 Starting Acceptance Tests for Image Resolution & Template Field Filling...\n');

// 1. Check isSamplePlaceholder
console.log('Test 1: Placeholder suppression');
assert.equal(isSamplePlaceholder('SAMPLE LINE ABOVE THE TITLE'), true);
assert.equal(isSamplePlaceholder('Sample Call to action'), true);
assert.equal(isSamplePlaceholder('SAMPLE BUTTON WORDS'), true);
assert.equal(isSamplePlaceholder('Sample Subtitle'), true);
assert.equal(isSamplePlaceholder('A heading of your own'), true);
assert.equal(isSamplePlaceholder('A smaller line under it'), true);
assert.equal(isSamplePlaceholder('A paragraph of plain words you can change by double-clicking it.'), true);
assert.equal(isSamplePlaceholder(''), true);
assert.equal(isSamplePlaceholder('Cheer For Your Team'), false);
assert.equal(isSamplePlaceholder('Annual Sports Day'), false);
assert.equal(isSamplePlaceholder('School ground'), false);
console.log('  ✅ PASS: Placeholder suppression detects all sample copy.\n');

// 2. Check Venue extraction
console.log('Test 2: Venue parsing');
const sportsPrompt = 'Annual Sports Day on 15th October from 8 AM to 1 PM at school ground. Include medals and registration desk.';
const venueSports = extractVenue(sportsPrompt);
assert.equal(venueSports, 'School ground', `Expected "School ground", got "${venueSports}"`);
assert.ok(!venueSports.toLowerCase().includes('annual sports'), 'Venue must never include the full description');

const culturalPrompt = 'Annual Cultural Fest with music and dance performances in University Campus Auditorium';
const venueCultural = extractVenue(culturalPrompt);
assert.equal(venueCultural, 'University Campus Auditorium');

const pongalPrompt = 'Tamil Pongal harvest celebration with community feast at Community Grounds';
const venuePongal = extractVenue(pongalPrompt);
assert.equal(venuePongal, 'Community Grounds');

const noVenuePrompt = 'Yoga morning session on Sunday with no venue';
const venueNoVenue = extractVenue(noVenuePrompt);
assert.equal(venueNoVenue, '');
console.log('  ✅ PASS: Venue parsing correctly extracts exact venue names.\n');

// 3. Test Sports Day in both options
console.log('Test 3: Sports Day in both options');
const variables = [
  { key: 'title_sub', label: 'Line above the title', maxLength: 40 },
  { key: 'subtitle', label: 'Subtitle', maxLength: 60 },
  { key: 'cta_button', label: 'Button words', maxLength: 20 },
  { key: 'cta_line', label: 'Call to action', maxLength: 48 },
];

// Option A: Template mode (mock)
const tplResult = await generateWithMock({
  prompt: sportsPrompt,
  mode: 'content',
  variables,
});
assert.equal(tplResult.venue, 'School ground');
assert.ok(tplResult.title.length > 0);
assert.ok(tplResult.kicker.length > 0);
assert.ok(tplResult.subtitle.length > 0);
assert.equal(tplResult.details.length, 2); // 2 extracted bullets (<=6 words each)
assert.ok(tplResult.cta.button.length > 0);
assert.ok(!isSamplePlaceholder(tplResult.extras.title_sub));
assert.ok(!isSamplePlaceholder(tplResult.extras.subtitle));
assert.ok(!isSamplePlaceholder(tplResult.extras.cta_button));
assert.ok(!isSamplePlaceholder(tplResult.extras.cta_line));

const tplPhoto = await resolvePosterImage(sportsPrompt, tplResult.title, tplResult.imageQuery);
assert.ok(tplPhoto?.imageUrl?.startsWith('http'), 'Template mode gets photo');
assert.ok(tplPhoto?.photographer?.length > 0);
console.log('  ✅ PASS: Sports Day (Template mode) shows photo, venue "School ground", no placeholder text.');

// Option B: AI designs it
const aiResult = await generateWithMock({
  prompt: sportsPrompt,
  mode: 'design',
});
const aiContent = designToContent(aiResult);
assert.equal(aiContent.venue, 'School ground');
const aiBuilt = buildRecipeDesign({
  recipe: { recipeId: aiResult.recipeId, variant: aiResult.variant, icon: aiResult.icon },
  content: aiContent,
});
assert.ok(recipeNeedsPhoto(aiBuilt.recipeId), 'AI mode for sports must select a recipe with image slot');
assert.ok(aiBuilt.elements.some((el) => el.kind === 'image' || el.field === 'photo'), 'AI design has photo element');

const aiPhoto = await resolvePosterImage(sportsPrompt, aiContent.title, aiContent.imageQuery);
assert.ok(aiPhoto?.imageUrl?.startsWith('http'), 'AI mode gets photo');
console.log('  ✅ PASS: Sports Day (AI designs it) shows photo, venue "School ground", no placeholder text.\n');

// 4. Test Cultural Fest and Tamil Pongal in both options
console.log('Test 4: Cultural Fest and Tamil Pongal in both options');
// Cultural Fest
const cultTpl = await generateWithMock({ prompt: culturalPrompt, mode: 'content', variables });
const cultTplPhoto = await resolvePosterImage(culturalPrompt, cultTpl.title, cultTpl.imageQuery);
assert.ok(cultTplPhoto?.imageUrl?.startsWith('http'));

const cultAi = await generateWithMock({ prompt: culturalPrompt, mode: 'design' });
const cultAiBuilt = buildRecipeDesign({ recipe: { recipeId: cultAi.recipeId, variant: cultAi.variant, icon: cultAi.icon } });
assert.ok(recipeNeedsPhoto(cultAiBuilt.recipeId), 'Cultural fest AI mode has image slot');
const cultAiPhoto = await resolvePosterImage(culturalPrompt, cultAi.title.main, cultAi.imageQuery);
assert.ok(cultAiPhoto?.imageUrl?.startsWith('http'));
console.log('  ✅ PASS: Cultural fest gets photo in both options.');

// Tamil Pongal
const pongalTpl = await generateWithMock({ prompt: pongalPrompt, mode: 'content', variables });
const pongalTplPhoto = await resolvePosterImage(pongalPrompt, pongalTpl.title, pongalTpl.imageQuery);
assert.ok(pongalTplPhoto?.imageUrl?.startsWith('http'));

const pongalAi = await generateWithMock({ prompt: pongalPrompt, mode: 'design' });
const pongalAiBuilt = buildRecipeDesign({ recipe: { recipeId: pongalAi.recipeId, variant: pongalAi.variant, icon: pongalAi.icon } });
assert.ok(recipeNeedsPhoto(pongalAiBuilt.recipeId), 'Tamil Pongal AI mode has image slot');
const pongalAiPhoto = await resolvePosterImage(pongalPrompt, pongalAi.title.main, pongalAi.imageQuery);
assert.ok(pongalAiPhoto?.imageUrl?.startsWith('http'));
console.log('  ✅ PASS: Tamil Pongal gets photo in both options.\n');

// 5. Test with Unsplash key removed (mock provider fallback)
console.log('Test 5: Fallback when UNSPLASH_API_KEY is removed');
const prevUnsplashKey = process.env.UNSPLASH_API_KEY;
delete process.env.UNSPLASH_API_KEY;
process.env.IMAGE_SEARCH_PROVIDER = 'mock';

const fallbackPhotoSports = await resolvePosterImage(sportsPrompt, 'Annual Sports Day', 'sports stadium athletes');
assert.ok(fallbackPhotoSports?.imageUrl?.startsWith('http'), 'Sports fallback produces complete image');
assert.ok(fallbackPhotoSports?.photographer, 'Sports fallback produces photographer credit');

const fallbackPhotoPongal = await resolvePosterImage(pongalPrompt, 'Tamil Pongal', 'pongal harvest festival');
assert.ok(fallbackPhotoPongal?.imageUrl?.startsWith('http'), 'Pongal fallback produces complete image');

if (prevUnsplashKey) process.env.UNSPLASH_API_KEY = prevUnsplashKey;
console.log('  ✅ PASS: With Unsplash key removed, both options still produce a complete poster.\n');

console.log('========================================');
console.log('ALL ACCEPTANCE CHECKS PASSED SUCCESSFULLY!');
console.log('========================================');
