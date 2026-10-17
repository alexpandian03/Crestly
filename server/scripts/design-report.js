/**
 * /server/scripts/design-report.js
 *
 * Design review report CLI script.
 * Evaluates 20 composed designs across 5 sample descriptions x 2 text lengths (200 designs total).
 * Reports:
 *  1. Geometry and contrast failures.
 *  2. Blocks that appear in failing designs (with issue breakdown).
 *  3. Design pairs whose layout signatures are too close (distance < 0.35).
 *
 * Run with: npm run design:report
 */

import {
  composeDesign,
  signatureDistance,
  DIVERSITY_THRESHOLD,
} from '../../shared/designComposer.js';
import { contrastRatio, backdropOf } from '../../shared/designRecipes.js';
import { resolveColorToken, contentArea as computeContentArea } from '../../shared/templateElements.js';

export const TEST_BRAND_KIT = {
  colors: {
    primary: '#2563eb',
    secondary: '#1e293b',
    accent: '#d97706',
    text: '#111827',
    background: '#ffffff',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header: {
    height: 120,
    background: { type: 'color', color: '#1e293b' },
    orgName: { show: true, text: 'PosterAI Organization', style: { color: '#ffffff', size: 24, weight: 700 } },
  },
  footer: {
    height: 110,
    background: { type: 'color', color: '#0f172a' },
    legalText: 'Community Poster Initiative • All rights reserved',
    style: { color: '#cbd5e1', size: 12 },
  },
};

export const SAMPLE_DESCRIPTIONS = [
  {
    id: 'blood_donation',
    label: 'Blood Donation',
    eventType: 'blood_camp',
    short: {
      title: 'Blood Donation Camp',
      subtitle: 'Donate Blood, Save Lives',
      date: '15 Nov 2026',
      time: '9:00 AM - 2:00 PM',
      venue: 'City Civic Center',
      photo: '',
      cta: 'Join Today',
      message: 'Give the gift of life.',
    },
    long: {
      title: 'Annual Lifesaving Community Blood Donation Camp & Health Drive',
      subtitle: 'Join hands with certified doctors and medical volunteers to save lives',
      date: 'Saturday 15 Nov 2026',
      time: '9:00 AM - 3:00 PM',
      venue: 'Riverside Community Center Main Auditorium, Block B',
      photo: '',
      cta: 'Register as Donor Today',
      message: 'Certified medical health checks, safe donation slots, refreshments and certificates for all donors.',
      contact: 'Helpline: 98765 43210',
    },
  },
  {
    id: 'sports_day',
    label: 'Sports Day',
    eventType: 'sports_day',
    short: {
      title: 'Annual Sports Meet',
      subtitle: 'Strength, Passion & Victory',
      date: '25 Nov 2026',
      time: '8:00 AM',
      venue: 'University Sports Ground',
      photo: '',
      cta: 'View Schedule',
      message: 'Cheer for your teams.',
    },
    long: {
      title: 'Inter-College Annual Athletic Championship & Sports Meet 2026',
      subtitle: 'Witness extraordinary athleticism, track & field events and fierce team spirit',
      date: 'Tuesday 25 Nov 2026',
      time: '8:00 AM - 5:00 PM',
      venue: 'University Olympic Stadium, Track & Field Arena',
      photo: '',
      cta: 'Get Spectator Passes',
      message: 'Track sprints, relay races, high jump, shot put, and grand trophy presentation ceremony.',
      contact: 'Sports Council: sports@university.edu',
    },
  },
  {
    id: 'awards_night',
    label: 'Awards Night',
    eventType: 'award_function',
    short: {
      title: 'Annual Excellence Awards',
      subtitle: 'Honoring Outstanding Achievements',
      date: '10 Dec 2026',
      time: '6:00 PM',
      venue: 'Grand Ballroom',
      photo: '',
      cta: 'Reserve Seat',
      message: 'Celebrating excellence.',
    },
    long: {
      title: 'Global Leadership & Corporate Excellence Gala Awards Night 2026',
      subtitle: 'Celebrating extraordinary innovations, visionary leadership, and milestone achievements',
      date: 'Thursday 10 Dec 2026',
      time: '6:00 PM Onwards',
      venue: 'The Grand Regal Convention Center, Crystal Ballroom',
      photo: '',
      cta: 'Confirm Executive RSVP',
      message: 'Keynote addresses by industry pioneers, banquet dinner, live musical performances, and formal trophy presentations.',
      contact: 'Organizing Committee: awards-rsvp@enterprise.org',
    },
  },
  {
    id: 'birthday',
    label: 'Birthday',
    eventType: 'birthday',
    short: {
      title: 'Happy Birthday Alex!',
      subtitle: 'Wishing You Joy and Happiness',
      date: '20 Nov 2026',
      time: '7:00 PM',
      venue: 'Skyline Lounge',
      photo: '',
      cta: 'RSVP Today',
      message: 'Join the party!',
    },
    long: {
      title: 'A Grand 30th Birthday Celebration for Alex Harrison',
      subtitle: 'An unforgettable evening of joy, celebration, delicious food, and cherished memories',
      date: 'Friday 20 Nov 2026',
      time: '7:00 PM Till Midnight',
      venue: 'Skyline Rooftop Lounge & Garden Terrace, Downtown',
      photo: '',
      cta: 'RSVP by 15th November',
      message: 'Gourmet buffet dinner, live DJ set, cocktail bar, cake-cutting ceremony, and photo booth fun.',
      contact: 'Hosted with love by Sarah & Friends (555-0199)',
    },
  },
  {
    id: 'temple_festival',
    label: 'Temple Festival',
    eventType: 'temple_festival',
    short: {
      title: 'Maha Thiruvizha Festival',
      subtitle: 'Divine Blessings & Celebrations',
      date: '05 Dec 2026',
      time: '7:00 AM',
      venue: 'Temple Grounds',
      photo: '',
      cta: 'All Are Welcome',
      message: 'Special pooja ceremonies.',
    },
    long: {
      title: 'Arulmigu Sri Maha Mariamman Temple Grand Annual Thiruvizha',
      subtitle: 'Experience spiritual bliss, sacred rituals, chariot procession, and rich cultural heritage',
      date: 'Saturday 05 Dec 2026',
      time: '6:00 AM - 9:00 PM',
      venue: 'Main Temple Sannidhi, Outer Prakaram & Cultural Mandapam',
      photo: '',
      cta: 'Devotees Cordially Invited',
      message: 'Special Maha Abhishekam, chariot procession, devotional bhajans, and continuous annadhanam for all devotees.',
      contact: 'Temple Devotees & Trust Committee',
    },
  },
];

/**
 * Validates layout geometry and text contrast for a composed design.
 */
export function validateDesign(design, contentArea, brandKit) {
  const elements = Array.isArray(design?.elements) ? design.elements : [];
  const geometryErrors = [];
  const contrastErrors = [];

  if (elements.length === 0) {
    geometryErrors.push('No elements in design');
    return { valid: false, geometryErrors, contrastErrors };
  }

  const textEls = [];

  for (const el of elements) {
    if (!el || typeof el !== 'object') continue;

    // Check bounds inside contentArea
    if (el.y < contentArea.y) {
      geometryErrors.push(`Element ${el.id || el.kind} y (${el.y}) is above contentArea y (${contentArea.y})`);
    }
    if (el.y + el.h > contentArea.y + contentArea.h + 1) {
      geometryErrors.push(`Element ${el.id || el.kind} bottom (${el.y + el.h}) exceeds contentArea bottom (${contentArea.y + contentArea.h})`);
    }
    if (el.x < contentArea.x) {
      geometryErrors.push(`Element ${el.id || el.kind} x (${el.x}) is left of contentArea x (${contentArea.x})`);
    }
    if (el.x + el.w > contentArea.x + contentArea.w + 1) {
      geometryErrors.push(`Element ${el.id || el.kind} right (${el.x + el.w}) exceeds contentArea right (${contentArea.x + contentArea.w})`);
    }

    // Text specific checks
    if (el.kind === 'text') {
      textEls.push(el);

      if (typeof el.text !== 'string' || el.text.trim().length === 0) {
        geometryErrors.push(`Text element ${el.id} has empty content`);
      }

      const fontSize = el.style?.size;
      if (typeof fontSize === 'number' && fontSize < 20) {
        geometryErrors.push(`Text element ${el.id} font size (${fontSize}px) is under 20px`);
      }

      // Contrast check
      const rawColor = el.style?.color || 'brand:text';
      const resolvedFg = resolveColorToken(rawColor, brandKit) || rawColor;
      const surface = resolveColorToken(brandKit?.colors?.background || '#ffffff', brandKit) || '#ffffff';

      // Ensure shape fills have resolved color tokens so backdropOf can blend RGB correctly
      const resolvedElements = elements.map((item) => {
        if (item.kind === 'shape' && item.shape?.fill) {
          return {
            ...item,
            shape: {
              ...item.shape,
              fill: resolveColorToken(item.shape.fill, brandKit) || item.shape.fill,
            },
          };
        }
        return item;
      });

      const backdrop = backdropOf(el, resolvedElements, surface);
      const resolvedBg = resolveColorToken(backdrop, brandKit) || backdrop;
      const ratio = contrastRatio(resolvedFg, resolvedBg);

      if (ratio < 4.5) {
        contrastErrors.push(`Text element ${el.id} (${el.text?.slice(0, 20)}...) contrast ${ratio.toFixed(2)}:1 < 4.5:1 (fg: ${resolvedFg}, bg: ${resolvedBg})`);
      }
    }

    // Image check
    if (el.kind === 'image') {
      if (!el.imageUrl || typeof el.imageUrl !== 'string' || el.imageUrl.trim().length === 0) {
        geometryErrors.push(`Image element ${el.id} has no image URL`);
      }
    }

    // Icon check
    if (el.kind === 'icon') {
      const name = el.name || el.icon || el.style?.icon;
      if (!name || typeof name !== 'string' || name.trim().length === 0) {
        geometryErrors.push(`Icon element ${el.id} has no icon name`);
      }
    }
  }

  // Text-text overlap check
  for (let i = 0; i < textEls.length; i++) {
    for (let j = i + 1; j < textEls.length; j++) {
      const a = textEls[i];
      const b = textEls[j];
      const overlapX = a.x < b.x + b.w && a.x + a.w > b.x;
      const overlapY = a.y < b.y + b.h && a.y + a.h > b.y;
      if (overlapX && overlapY) {
        geometryErrors.push(`Text elements collide: ${a.id} & ${b.id}`);
      }
    }
  }

  return {
    valid: geometryErrors.length === 0 && contrastErrors.length === 0,
    geometryErrors,
    contrastErrors,
  };
}

/**
 * Main review report execution.
 */
export async function runDesignReport() {
  console.log('='.repeat(72));
  console.log(' POSTERAI DESIGN REVIEW REPORT');
  console.log(' Evaluating 5 event descriptions x 2 text lengths x 20 seeds = 200 designs');
  console.log('='.repeat(72));
  console.log('');

  const contentArea = computeContentArea(TEST_BRAND_KIT, { size: { width: 1080, height: 1350 } });
  const SEEDS_PER_CASE = 20;

  let totalDesigns = 0;
  let totalPassed = 0;
  let totalFailed = 0;

  // Track failing blocks: blockId -> { role, failCount, sampleErrors: Set }
  const failingBlocksMap = new Map();

  // Track close pairs across scenarios: list of { scenario, pair: [i, j], distance, heroA, heroB, infoA, infoB }
  const allClosePairs = [];

  const scenarioSummaries = [];

  for (const sample of SAMPLE_DESCRIPTIONS) {
    for (const lengthKey of ['short', 'long']) {
      const scenarioTitle = `${sample.label} (${lengthKey})`;
      const facts = sample[lengthKey];
      const eventType = sample.eventType;

      const designs = [];
      let scenarioPassed = 0;
      let scenarioFailed = 0;
      let scenarioGeomIssues = 0;
      let scenarioContrastIssues = 0;
      const scenarioClosePairs = [];

      for (let s = 1; s <= SEEDS_PER_CASE; s++) {
        totalDesigns++;
        const seed = s;
        const design = composeDesign({
          facts,
          eventType,
          seed,
          brandKit: TEST_BRAND_KIT,
          contentArea,
          hasPhoto: false,
        });

        designs.push({ seed, design });

        const validation = validateDesign(design, contentArea, TEST_BRAND_KIT);

        if (validation.valid) {
          totalPassed++;
          scenarioPassed++;
        } else {
          totalFailed++;
          scenarioFailed++;
          if (validation.geometryErrors.length > 0) scenarioGeomIssues += validation.geometryErrors.length;
          if (validation.contrastErrors.length > 0) scenarioContrastIssues += validation.contrastErrors.length;

          // Attribute failure to blocks used in this design
          const blocks = design?.blocks || {};
          const allErrors = [...validation.geometryErrors, ...validation.contrastErrors];

          for (const [role, blockObj] of Object.entries(blocks)) {
            if (!blockObj || !blockObj.id) continue;
            const blockId = blockObj.id;
            if (!failingBlocksMap.has(blockId)) {
              failingBlocksMap.set(blockId, {
                id: blockId,
                role: blockObj.role || role,
                failCount: 0,
                scenarios: new Set(),
                errors: new Set(),
              });
            }
            const record = failingBlocksMap.get(blockId);
            record.failCount++;
            record.scenarios.add(scenarioTitle);
            for (const err of allErrors) record.errors.add(err);
          }
        }
      }

      // Check pairwise signature distance within this scenario (20 designs => 190 pairs)
      for (let i = 0; i < designs.length; i++) {
        for (let j = i + 1; j < designs.length; j++) {
          const dA = designs[i].design;
          const dB = designs[j].design;
          const dist = signatureDistance(dA?.signature, dB?.signature);

          if (dist < DIVERSITY_THRESHOLD) {
            const pairInfo = {
              scenario: scenarioTitle,
              seedA: designs[i].seed,
              seedB: designs[j].seed,
              indexA: i + 1,
              indexB: j + 1,
              distance: dist,
              heroA: dA?.blocks?.hero?.id || 'none',
              heroB: dB?.blocks?.hero?.id || 'none',
              infoA: dA?.blocks?.info?.id || 'none',
              infoB: dB?.blocks?.info?.id || 'none',
            };
            scenarioClosePairs.push(pairInfo);
            allClosePairs.push(pairInfo);
          }
        }
      }

      scenarioSummaries.push({
        title: scenarioTitle,
        passed: scenarioPassed,
        failed: scenarioFailed,
        geomIssues: scenarioGeomIssues,
        contrastIssues: scenarioContrastIssues,
        closePairsCount: scenarioClosePairs.length,
      });
    }
  }

  // --- OUTPUT REPORT ---
  console.log('------------------------------------------------------------------------');
  console.log(' SCENARIO SUMMARY (10 Scenarios x 20 Seeds = 200 Designs)');
  console.log('------------------------------------------------------------------------');
  console.table(scenarioSummaries);

  console.log('\n' + '='.repeat(72));
  console.log(' 1. BLOCKS APPEARING IN FAILING DESIGNS');
  console.log('='.repeat(72));

  if (failingBlocksMap.size === 0) {
    console.log(' ✓ None! All 200 designs passed geometry and contrast validation.');
  } else {
    console.log(` ⚠️ Found ${failingBlocksMap.size} block(s) appearing in failing designs:`);
    const sortedBlocks = Array.from(failingBlocksMap.values()).sort((a, b) => b.failCount - a.failCount);
    for (const b of sortedBlocks) {
      console.log(`\n • Block: ${b.id} [role: ${b.role}]`);
      console.log(`   Appeared in ${b.failCount} failing design(s) across: ${Array.from(b.scenarios).join(', ')}`);
      console.log(`   Observed issues:`);
      for (const err of Array.from(b.errors).slice(0, 4)) {
        console.log(`     - ${err}`);
      }
      if (b.errors.size > 4) {
        console.log(`     - ... and ${b.errors.size - 4} more`);
      }
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log(' 2. DESIGN PAIRS WHOSE SIGNATURES ARE TOO CLOSE (Distance < 0.35)');
  console.log('='.repeat(72));

  if (allClosePairs.length === 0) {
    console.log(' ✓ None! All design pairs across all 20-seed runs exceed the diversity threshold (0.35).');
  } else {
    console.log(` ⚠️ Found ${allClosePairs.length} design pair(s) with distance < 0.35 (out of 1900 pairs tested):`);
    for (const p of allClosePairs.slice(0, 20)) {
      console.log(
        ` • [${p.scenario}] Design #${p.indexA} (seed ${p.seedA}) & Design #${p.indexB} (seed ${p.seedB}): distance = ${p.distance.toFixed(3)}`
      );
      console.log(`   Heroes: [${p.heroA}] vs [${p.heroB}] | Infos: [${p.infoA}] vs [${p.infoB}]`);
    }
    if (allClosePairs.length > 20) {
      console.log(`   ... and ${allClosePairs.length - 20} more pairs.`);
    }
  }

  console.log('\n' + '='.repeat(72));
  console.log(' OVERALL SUMMARY');
  console.log('='.repeat(72));
  console.log(` Total Designs Evaluated: ${totalDesigns}`);
  console.log(` Passed:                 ${totalPassed} (${Math.round((totalPassed / totalDesigns) * 100)}%)`);
  console.log(` Failed:                 ${totalFailed} (${Math.round((totalFailed / totalDesigns) * 100)}%)`);
  console.log(` Close Signature Pairs:  ${allClosePairs.length}`);
  console.log('='.repeat(72));

  return {
    totalDesigns,
    totalPassed,
    totalFailed,
    failingBlocksCount: failingBlocksMap.size,
    closePairsCount: allClosePairs.length,
  };
}

// Run when executed directly
if (process.argv[1]?.endsWith('design-report.js')) {
  runDesignReport()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Error running design report:', err);
      process.exit(1);
    });
}
