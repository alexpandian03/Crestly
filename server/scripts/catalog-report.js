/**
 * Catalog visual quality report.
 * Scores every preset x palette family x event type.
 * Run with `npm run catalog:report`.
 */
import { DESIGN_RECIPES, buildElements } from '../../shared/designRecipes.js';
import { PALETTE_FAMILIES, derivePaletteFamily } from '../../shared/paletteFamilies.js';
import { EVENT_TYPES } from '../../shared/eventTypes.js';
import { scoreDesign } from '../../shared/visualScore.js';

const TEST_BRAND_KIT = {
  colors: {
    primary: '#059669',
    secondary: '#0f172a',
    accent: '#10b981',
    text: '#ffffff',
    background: '#0b0f17',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header: { height: 140 },
  footer: { height: 120 },
};

const SAMPLE_CONTENT = {
  headline: 'Community Health Camp',
  tagline: 'Free consultations and wellness screenings for all',
  date: 'Sat 24 Oct 2026',
  time: '9:00 AM - 2:00 PM',
  venue: 'Community Center, Main Hall',
  details: [
    'Blood pressure and glucose checks',
    'General physician consultation',
    'Nutrition guidance workshop',
  ],
  extras: {
    title_sub: 'Annual Wellness Initiative',
    slogan_1: 'Prioritize your wellbeing',
    slogan_2: 'Everyone is welcome',
    cta_line: 'No registration fee required',
    cta_button: 'Join Us',
  },
  icon: 'heart-pulse',
};

async function runReport() {
  console.log('Running Visual Quality Report across presets, palette families, and event types...\n');
  let totalCombinations = 0;
  let passedCount = 0;
  const failures = [];

  const eventList = Array.isArray(EVENT_TYPES) ? EVENT_TYPES : ['health', 'sports', 'festival', 'corporate', 'meeting', 'general'];

  for (const preset of DESIGN_RECIPES) {
    for (const family of PALETTE_FAMILIES) {
      const palette = derivePaletteFamily(TEST_BRAND_KIT, family);

      for (const ev of eventList) {
        totalCombinations += 1;
        const slots = {
          ...SAMPLE_CONTENT,
          headline: `${preset.name} - ${ev}`,
        };

        const built = buildElements(preset.id, {
          brandKit: TEST_BRAND_KIT,
          slots,
          options: { variant: 0 },
        });

        const evaluation = scoreDesign(built.elements, slots, palette);

        if (evaluation.score >= 60) {
          passedCount += 1;
        } else {
          failures.push({
            preset: preset.name,
            family,
            eventType: ev,
            score: evaluation.score,
            details: evaluation.details,
          });
        }
      }
    }
  }

  console.log(`Evaluated ${totalCombinations} combinations:`);
  console.log(`Passed: ${passedCount} / ${totalCombinations} (${Math.round((passedCount / totalCombinations) * 100)}%)`);

  if (failures.length > 0) {
    console.error(`\n❌ Found ${failures.length} failing combination(s) with score < 60:`);
    for (const f of failures.slice(0, 10)) {
      console.error(` - [${f.preset}] (${f.family}, ${f.eventType}): Score ${f.score}/100`, f.details);
    }
    if (failures.length > 10) {
      console.error(` ... and ${failures.length - 10} more.`);
    }
    process.exit(1);
  }

  console.log('\n✅ All preset, palette, and event type combinations scored >= 60!');
}

runReport().catch((err) => {
  console.error('Report error:', err);
  process.exit(1);
});
