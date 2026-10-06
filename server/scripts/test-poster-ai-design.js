import assert from 'node:assert/strict';
import { buildElements } from '../../shared/designRecipes.js';
import { assertZoneLayout, checkZoneLayout } from '../services/template/zones.js';
import { contentArea, templateSizeOf } from '../../shared/templateElements.js';
import {
  BOTH_OFF_MESSAGE,
  BRAND_LINE,
  DESIGN_MODES_DEFAULT,
  MODE_AI,
  MODE_TEMPLATE,
  aiDesignOf,
  aiTemplateBody,
  allowedModes,
  designModesOf,
  designModesPayload,
  designSizeFor,
  firstAllowedMode,
  isAiDesign,
  modeAllowed,
  recipeKeyOf,
  recipeOf,
  zonesForAiDesign,
} from '../../client/src/utils/posterAiDesign.js';

let n = 0;
const ok = (cond, msg) => {
  n += 1;
  assert.ok(cond, msg);
};
const eq = (a, b, msg) => {
  n += 1;
  assert.deepEqual(a, b, msg);
};

// --- the two switches -------------------------------------------------------
eq(designModesOf(undefined), { ai: true, templates: true }, 'no client yet means both on');
eq(designModesOf({}), DESIGN_MODES_DEFAULT, 'a client with no setting uses the defaults');
eq(designModesOf({ designModes: { ai: false, templates: true } }), { ai: false, templates: true }, 'one off');
eq(designModesOf({ designModes: {} }), { ai: true, templates: true }, 'empty object uses defaults');
eq(designModesOf({ designModes: { ai: false } }), { ai: false, templates: true }, 'missing key stays on');
eq(allowedModes(designModesOf({ designModes: { ai: false } })), [MODE_TEMPLATE], 'only layouts is offered');
eq(allowedModes(designModesOf({ designModes: { templates: false } })), [MODE_AI], 'only AI is offered');
eq(allowedModes(DESIGN_MODES_DEFAULT), [MODE_AI, MODE_TEMPLATE], 'both, AI first');
eq(firstAllowedMode(designModesOf({ designModes: { ai: false } })), MODE_TEMPLATE, 'AI off starts on layouts');
eq(firstAllowedMode(DESIGN_MODES_DEFAULT), MODE_AI, 'default card is AI');
eq(modeAllowed({ ai: false, templates: true }, MODE_AI), false, 'ai refused');
eq(modeAllowed({ ai: false, templates: true }, 'nonsense'), false, 'unknown mode');
eq(designModesPayload({ ai: true, templates: false }), { designModes: { ai: true, templates: false } }, 'save shape');
eq(BOTH_OFF_MESSAGE, 'Keep at least one way of making posters switched on.', 'the server sentence');
eq(BRAND_LINE, 'Your logo, colors and contact details are always added by your brand.', 'the brand line');

// --- the size the design is built at ---------------------------------------
eq(designSizeFor({ size: { width: 1000, height: 1500 } }, null), { width: 1000, height: 1500 }, 'layout wins');
eq(designSizeFor(null, { defaultPosterSize: { width: 1080, height: 1080 } }), { width: 1080, height: 1080 }, 'brand kit next');
eq(designSizeFor(null, null), { width: 1080, height: 1350 }, 'standard poster last');

// --- an answer becomes a drawable design ------------------------------------
const brandKit = {
  orgName: 'Northbridge Foundation',
  colors: { primary: '#4338ca', secondary: '#1e1b4b', accent: '#f59e0b', text: '#ffffff', background: '#ffffff' },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header: { height: 120, showLogo: true, showOrgName: true },
  footer: { height: 90 },
  content: {},
  defaultPosterSize: { width: 1080, height: 1350 },
};
const size = designSizeFor(null, brandKit);
const built = buildElements('hero', {
  brandKit,
  size,
  slots: {
    headline: 'Community Health Camp',
    tagline: 'Free check-ups',
    date: 'Saturday, 15 November',
    time: '9 am to 4 pm',
    venue: 'Town Hall Grounds',
    details: ['Screening', 'Counselling'],
    extras: { title_sub: 'Free check-ups', slogan_1: 'Together we can', slogan_2: '', cta_line: '', cta_button: '' },
    icon: 'stethoscope',
    imageUrl: '',
  },
  options: { variant: 1 },
});
ok(built.elements.length > 0, 'a design holds pieces');

const answer = {
  mode: 'ai',
  recipeId: 'hero',
  variant: 1,
  recipeVersion: built.design.recipeVersion,
  icon: 'stethoscope',
  template: { name: 'AI design', editorVersion: 2, elements: built.elements },
};
const design = aiDesignOf(answer, size);
ok(design !== null, 'the design is readable');
ok(!('brandKit' in design), 'no brand kit is carried, so the current one draws the bands');
eq(typeof design.capturedAt, 'string', 'the snapshot shape has a capture time');
ok(Number.isFinite(Date.parse(design.capturedAt)), 'capture time parses');
const t = design.template;
eq(t.name, 'AI design', 'named like the server names it');
eq(t.version, 1, 'a first version');
eq(t.editorVersion, 2, 'placed pieces');
eq(t.zones, [], 'a design stores no areas');
eq(t.size, { width: 1080, height: 1350 }, 'the size the server used');
eq(t.elements.length, built.elements.length, 'every piece is kept');
eq(t.recipeId, 'hero', 'the design knows its name');
eq(t.variant, 1, 'and its arrangement');
eq(t.icon, 'stethoscope', 'and its mark');
eq(recipeOf(t), { recipeId: 'hero', variant: 1, icon: 'stethoscope' }, 'the save field the server expects');
eq(recipeKeyOf(t), 'hero|1|stethoscope', 'a key that says which design this is');
ok(isAiDesign(t), 'it reads as an assistant design');
ok(!isAiDesign({ name: 'Plain', elements: built.elements }), 'a layout with pieces is not an AI design');
eq(recipeOf(null), null, 'nothing to rebuild');
eq(aiDesignOf({ template: { elements: [] } }, size), null, 'no pieces means no design');
eq(aiDesignOf(undefined, size), null, 'an answer with nothing in it');

// --- the same design saved back through the layout route --------------------
for (const kit of [
  brandKit,
  { ...brandKit, header: { height: 60 }, footer: { height: 60 } },
  { ...brandKit, header: { height: 200 }, footer: { height: 260 } },
  { orgName: 'No bands at all', colors: brandKit.colors, fonts: brandKit.fonts },
]) {
  for (const canvas of [
    { width: 1080, height: 1350 },
    { width: 600, height: 800 },
    { width: 1080, height: 1080 },
    { width: 1920, height: 1080 },
    { width: 2400, height: 3200 },
  ]) {
    const items = buildElements('hero', {
      brandKit: kit,
      size: canvas,
      slots: {
        headline: 'Year End Award Night',
        tagline: 'Celebrating the people who made it',
        date: 'Friday, 12 December',
        time: '7 pm',
        venue: 'Riverside Hall',
        details: ['Dinner', 'Music'],
        extras: {},
        icon: 'trophy',
        imageUrl: '',
      },
      options: { variant: 0 },
    }).elements;
    const body = aiTemplateBody({
      name: 'Assistant design',
      design: { template: { size: canvas, elements: items } },
      brandKit: kit,
    });
    eq(body.name, 'Assistant design', 'the typed name');
    eq(body.category, 'Custom', 'kept as its own kind');
    eq(body.size, templateSizeOf({ size: canvas }), 'the poster size travels');
    const problems = checkZoneLayout({ size: body.size, zones: body.zones });
    eq(problems, [], `areas are allowed: ${canvas.width}x${canvas.height} ${problems.join(' ')}`);
    assertZoneLayout({ size: body.size, zones: body.zones });
    n += 1;
    eq(body.zones.map((z) => z.type), ['header', 'content', 'footer'], 'three areas, in order');
    ok(body.zones.every((z) => z.w >= 120 && z.h >= 80), 'every area is big enough');
    ok(body.zones[1].h >= body.size.height * 0.4, 'the text area holds two fifths');
    eq(body.zones[1].y, body.zones[0].h, 'the text area starts under the brand band');
    eq(body.zones[0].h + body.zones[1].h + body.zones[2].h, body.size.height, 'the three areas fill the poster');
    eq(body.elements.length, items.length, 'every piece is kept for the layout');
  }
}

// zones a tall pair of bands produces still leave the pieces where they were placed
const tall = zonesForAiDesign({ width: 1080, height: 1350 }, { ...brandKit, header: { height: 200 }, footer: { height: 260 } });
eq(tall[0].h, 200, 'the header band keeps its height');
eq(tall[2].h, 260, 'the footer band keeps its height');
eq(tall[1].y, 200, 'the text area starts under the header');
eq(tall[1].h, 890, 'and holds what is left');

const small = zonesForAiDesign({ width: 600, height: 600 }, { header: { height: 200 }, footer: { height: 260 } });
ok(small[1].h >= 600 * 0.4, 'a short poster still gets two fifths of text');
ok(small[0].h >= 80 && small[2].h >= 80, 'bands never fall under the smallest area');
eq(small[0].h + small[1].h + small[2].h, 600, 'the three areas fill the poster');

console.log(`posterAiDesign rules: ${n} assertions ok`);
