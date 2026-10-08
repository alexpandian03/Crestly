import dotenv from 'dotenv';
dotenv.config();

process.env.LLM_PROVIDER = 'mock';

import { generateWithMock } from '../services/ai/providers/mock.js';
import { buildRecipeDesign } from '../services/poster/recipe.js';
import { charWidthOf } from '../../shared/designRecipes.js';
import { contentArea } from '../../shared/templateElements.js';

const TIMEOUT_MS = 20000;

const BRAND_KIT = {
  colors: { primary: '#2563EB', secondary: '#1E293B', accent: '#3B82F6', text: '#FFFFFF', background: '#F8FAFC' },
  fonts: { heading: 'Inter', body: 'Inter' },
  header: { height: 140 },
  footer: { height: 120 },
  content: { headingFont: 'Inter', bodyFont: 'Inter', defaultImageUrl: '' },
};

const CANVAS_SIZE = { width: 1080, height: 1350 };

const TEST_DESCRIPTIONS = [
  {
    name: 'sports day',
    prompt: 'Annual Sports Day on 15 Nov, 8 AM at Main Stadium with track events and games. Include registration desk and medals.',
  },
  {
    name: 'Diwali night market',
    prompt: 'Diwali night market on 24 Oct, 6 PM at Town Square with food and handicraft stalls',
  },
  {
    name: 'blood donation',
    prompt: 'Blood donation camp on 12 Nov, 9 AM at Town Hall. Every donor receives a certificate and refreshments.',
  },
  {
    name: 'awards night',
    prompt: 'Annual Excellence Awards ceremony honoring outstanding community leaders on 20 Dec, 7 PM at Grand Ballroom',
  },
  {
    name: 'cultural fest (long)',
    prompt: 'Grand Inter-College Cultural Fest with live music performances, classical dance competitions, street plays, digital art exhibits, food stalls, gaming arenas, and special celebrity guest appearances on 5 Dec, 10 AM at University Campus Auditorium. Include registration desk and medals.',
  },
  {
    name: 'Tamil Pongal',
    prompt: 'Tamil Pongal harvest festival celebration with traditional music, kolam contest, and sweet pongal feast on 14 Jan, 9 AM in college ground',
  },
  {
    name: 'yoga with no venue',
    prompt: 'Morning yoga and meditation session for mental wellness and flexibility on 21 June at 6 AM',
  },
  {
    name: 'a 60-character title',
    prompt: 'International Championship Of Intercollegiate Athletic Sports on 18 Oct, 8 AM at Green Valley Park',
  },
];

async function runRenderTest() {
  console.log('🧪 Starting Poster Render Layout Tests (8 descriptions)...\n');
  const timer = setTimeout(() => {
    console.error('❌ Test timed out after 20 seconds');
    process.exit(1);
  }, TIMEOUT_MS);

  const area = contentArea(BRAND_KIT, { size: CANVAS_SIZE });
  const results = {};
  let anyFailed = false;

  for (const item of TEST_DESCRIPTIONS) {
    console.log(`Testing description: "${item.name}"`);
    const problems = [];

    // 1. Generate design via mock
    const answer = await generateWithMock({ prompt: item.prompt, mode: 'design' });

    // 2. Build recipe elements
    const recipeDesign = buildRecipeDesign({
      recipe: { recipeId: answer.recipeId, variant: answer.variant, icon: answer.icon },
      content: {
        title: answer.title?.main || answer.title,
        tagline: answer.tagline,
        date: answer.info?.date,
        time: answer.info?.time,
        venue: answer.info?.venue,
        details: answer.bullets,
        extras: {
          title_sub: answer.title?.sub,
          slogan_1: answer.slogan?.line1,
          slogan_2: answer.slogan?.line2,
          cta_line: answer.cta?.line,
          cta_button: answer.cta?.button,
        },
      },
      brandKit: BRAND_KIT,
      size: CANVAS_SIZE,
    });

    const elements = recipeDesign.elements;

    // Filter text boxes that display words
    const textItems = elements.filter(
      (el) => (el.kind === 'text' || el.kind === 'field') && el.field !== 'photo'
    );

    // Check 1: Overlap or touch (gap under 16px) between text boxes in same horizontal span
    for (let i = 0; i < textItems.length; i++) {
      for (let j = i + 1; j < textItems.length; j++) {
        const a = textItems[i];
        const b = textItems[j];
        // Check if boxes share horizontal space (overlap in X)
        const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
        if (overlapX > 10) {
          // One is above the other
          const top = a.y <= b.y ? a : b;
          const bottom = a.y <= b.y ? b : a;
          const verticalGap = bottom.y - (top.y + top.h);
          if (verticalGap < 16) {
            problems.push(`Text boxes "${a.id}" and "${b.id}" overlap or touch (gap ${verticalGap}px < 16px)`);
          }
        }
      }
    }

    // Check 2: Word breaks inside a word
    for (const el of textItems) {
      // Find the text this element displays
      let text = '';
      if (el.kind === 'field') {
        if (el.field === 'headline') text = answer.title?.main || '';
        else if (el.field === 'tagline') text = answer.tagline || '';
        else if (el.field === 'details') text = (answer.bullets || []).join(' ');
        else if (el.field === 'date') text = answer.info?.date || '';
        else if (el.field === 'time') text = answer.info?.time || '';
        else if (el.field === 'venue') text = answer.info?.venue || '';
      } else {
        text = answer.cta?.button || answer.cta?.line || '';
      }

      const words = String(text).trim().split(/\s+/).filter(Boolean);
      const face = { weight: el.style?.weight || 400, uppercase: el.style?.uppercase, letterSpacing: el.style?.letterSpacing };
      const charW = charWidthOf(el.style?.size || 22, face);

      for (const word of words) {
        const wordW = Math.ceil(word.length * charW);
        if (wordW > el.w + 2) {
          problems.push(`Word "${word}" in element "${el.id}" exceeds box width (${wordW}px > ${el.w}px) and would break mid-word`);
        }
      }
    }

    // Check 3: Any block is empty but still takes space
    for (const el of textItems) {
      let hasContent = false;
      if (el.kind === 'field') {
        if (el.field === 'headline' && answer.title?.main) hasContent = true;
        if (el.field === 'tagline' && answer.tagline) hasContent = true;
        if (el.field === 'details' && answer.bullets && answer.bullets.length > 0) hasContent = true;
        if (el.field === 'date' && answer.info?.date) hasContent = true;
        if (el.field === 'time' && answer.info?.time) hasContent = true;
        if (el.field === 'venue' && answer.info?.venue) hasContent = true;
      } else if (el.kind === 'text') {
        if (el.key === 'title_sub' && answer.title?.sub) hasContent = true;
        if (el.key === 'slogan_1' && answer.slogan?.line1) hasContent = true;
        if (el.key === 'slogan_2' && answer.slogan?.line2) hasContent = true;
        if (el.key === 'cta_line' && answer.cta?.line) hasContent = true;
        if (el.key === 'cta_button' && answer.cta?.button) hasContent = true;
      }
      if (!hasContent && el.h > 0) {
        problems.push(`Element "${el.id}" is empty but still takes space (h = ${el.h}px)`);
      }
    }

    // Check 4: Empty space at the bottom is over 10 percent
    const contentBottom = Math.max(...elements.map((el) => el.y + el.h));
    const areaBottom = area.y + area.h;
    const emptySpace = areaBottom - contentBottom;
    const emptyPercent = (emptySpace / area.h) * 100;

    if (emptyPercent > 10) {
      problems.push(`Empty space at bottom is ${emptyPercent.toFixed(1)}% (over 10% limit)`);
    }

    if (problems.length === 0) {
      console.log(`  ✅ PASS: "${item.name}" (bottom empty: ${emptyPercent.toFixed(1)}%)`);
      results[item.name] = 'PASSED';
    } else {
      console.error(`  ❌ FAIL: "${item.name}":`);
      problems.forEach((p) => console.error(`     - ${p}`));
      results[item.name] = 'FAILED';
      anyFailed = true;
    }
  }

  clearTimeout(timer);

  console.log('\n========================================');
  console.log('Render Test Results:');
  for (const [name, status] of Object.entries(results)) {
    console.log(`  - ${name}: ${status}`);
  }
  console.log('========================================\n');

  if (anyFailed) {
    process.exit(1);
  }
}

runRenderTest().catch((err) => {
  console.error('Fatal error in render test:', err);
  process.exit(1);
});
