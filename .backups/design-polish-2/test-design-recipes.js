/**
 * Plain Node check of the design recipes: no server, no database, no rendering.
 * Run with `npm run test:recipes`.
 */
import {
  ELEMENT_FIELDS,
  ELEMENT_LIMITS,
  ICON_NAMES,
  VARIABLE_LIMITS,
  contentArea,
  iconForCategory,
  normalizeElements,
  normalizeIconName,
  validateElements,
} from '../../shared/templateElements.js';
import {
  DECORATION_MAX_OPACITY,
  DESIGN_BLANKS,
  DESIGN_CATEGORIES,
  DESIGN_RECIPES,
  MIN_RECIPE_FONT,
  RECIPE_OPTIONS_DEFAULT,
  RECIPE_PALETTES,
  RECIPE_VARIANTS,
  RECIPE_VERSION,
  brandOf,
  buildElements,
  designById,
  designsFor,
  recipeIds,
  shade,
  slotsOf,
  suitsCategory,
  tint,
} from '../../shared/designRecipes.js';
import { cleanElements } from '../services/template/elements.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
  passed += 1;
}

const CLOUD = 'demo-cloud';
const CLIENT = '64b000000000000000000001';
const POSTER = { width: 1080, height: 1350 };
const BRAND_KIT = {
  colors: { primary: '#7c3aed', secondary: '#1e1b4b', accent: '#a78bfa', text: '#ffffff', background: '#111827' },
  fonts: { heading: 'Poppins', body: 'Lato' },
  header: { height: 140 },
  footer: { height: 120 },
  content: { headingFont: 'Poppins', bodyFont: 'Lato', defaultImageUrl: '' },
};
const TENANT_PHOTO = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/brand/${CLIENT}/photo.jpg`;

const NORMAL = {
  headline: 'Clean Water Fair',
  tagline: 'A free afternoon for the whole neighbourhood',
  date: 'Sat 14 Mar 2026',
  time: '2:00 pm',
  venue: 'Riverside Hall, 12 Quay Road',
  details: ['Talks by three local engineers', 'Kids corner and face painting', 'Free bottled water refill'],
  extras: {
    title_sub: 'Third year running',
    slogan_1: 'Every drop counts',
    slogan_2: 'Bring a reusable bottle',
    cta_line: 'Doors open at one',
    cta_button: 'Register',
  },
  icon: 'droplet',
  imageUrl: TENANT_PHOTO,
};
const LONG = {
  headline: 'International Symposium On Sustainable Urban Water Management And Community Resilience',
  tagline:
    'Join organisers, engineers, schools and neighbourhood groups for a full afternoon of workshops, panels and demonstrations across three venues',
  date: 'Saturday the fourteenth of March two thousand twenty six',
  time: 'two until seven in the afternoon',
  venue: 'Riverside Community Hall and Gardens, 12 Quay Road, Riverside District, Bristol BS1 4QU',
  details: [
    'Opening remarks from the city water board and a panel of three local engineers on what changed after the flood',
    'Hands-on workshops for schools including filtration experiments and rain garden design led by pupils',
    'Community clinic offering free bottled water refills and a reusable bottle exchange while stocks last',
    'Evening concert with three neighbourhood bands and a silent auction for the new jetty',
  ],
  extras: NORMAL.extras,
  icon: 'droplet',
  imageUrl: TENANT_PHOTO,
};
/* No place, no time and no picture at all - the design has to hold up anyway. */
const SPARSE = { ...NORMAL, venue: '', time: '', imageUrl: '' };

const CONTENTS = [
  ['normal words', NORMAL],
  ['very long words', LONG],
  ['no place and no photo', SPARSE],
];

function contextFor(size = POSTER) {
  const template = { size };
  return {
    cloudName: CLOUD,
    clientId: CLIENT,
    brandKit: BRAND_KIT,
    template,
    area: contentArea(BRAND_KIT, template),
  };
}

function build(id, slots, options = {}, size = POSTER) {
  const context = contextFor(size);
  return { ...context, built: buildElements(id, { area: context.area, brandKit: BRAND_KIT, slots, options }) };
}

/** Words the poster actually paints: a text box or a poster part that holds words. */
function wordBoxes(elements) {
  return elements.filter((item) => item.kind === 'text' || (item.kind === 'field' && item.field !== 'photo'));
}

function overlaps(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
}

function colorsUsed(elements) {
  const found = new Set();
  for (const item of elements) {
    if (item.style?.color) found.add(item.style.color);
    if (item.shape?.fill) found.add(item.shape.fill);
    if (item.shape?.stroke) found.add(item.shape.stroke);
  }
  return [...found];
}

/* ------------------------------------------------------------------------- *
 * 1. The list of designs carries what a caller needs to pick one
 * ------------------------------------------------------------------------- */
assert(DESIGN_RECIPES.length === 5, 'there are five designs to choose from');
assert(
  JSON.stringify(recipeIds()) === JSON.stringify(['hero', 'photoTop', 'splitPhoto', 'typographic', 'boldBand']),
  'the designs are named after the five ways to lay a poster out'
);
assert(
  DESIGN_RECIPES.every((design) => typeof design.recipe === 'function' && design.name.length > 2),
  'every design has a name and a function that builds it'
);
assert(
  DESIGN_RECIPES.every((design) => design.recipeVersion === RECIPE_VERSION),
  'every design says which version of the rules it was built with'
);
assert(
  DESIGN_RECIPES.every((design) => typeof design.needsPhoto === 'boolean'),
  'every design says whether it needs a photo'
);
assert(
  DESIGN_RECIPES.every(
    (design) =>
      design.suits.length > 0 &&
      design.suits.every((kind) => DESIGN_CATEGORIES.includes(kind)) &&
      new Set(design.suits).size === design.suits.length
  ),
  'every design suits a listed kind of event and repeats none'
);
assert(new Set(recipeIds()).size === DESIGN_RECIPES.length, 'no two designs share a name');
assert(designById('photoTop') === DESIGN_RECIPES[1], 'a design is found by its exact name');
assert(designById('PHOTOTOP') === DESIGN_RECIPES[1], 'a design name is read whatever the capitals');
assert(designById('  hero  ') === DESIGN_RECIPES[0], 'stray spaces around a design name are ignored');
assert(designById('nope') === null, 'a design this app does not have answers with nothing');
assert(designsFor('health').every((design) => design.suits.includes('health')), 'a health event gets designs that suit health');
assert(designsFor('unknown-kind').length === DESIGN_RECIPES.length, 'an unknown kind of event is offered every design');
assert(suitsCategory('hero', 'festival') === true && suitsCategory('hero', 'health') === false, 'a design says yes only to what it suits');
assert(suitsCategory('nope', 'festival') === false, 'a design that does not exist suits nothing');
assert(
  build('nope', NORMAL).built.problems.length === 1 && build('nope', NORMAL).built.problems[0].includes('not a design'),
  'an unknown design is refused in plain words'
);

/* ------------------------------------------------------------------------- *
 * 2. Colours only ever come from the brand kit
 * ------------------------------------------------------------------------- */
assert(tint('#7c3aed', 0) === '#7c3aed' && shade('#7c3aed', 0) === '#7c3aed', 'mixing none of white or black leaves the brand colour as it is');
assert(tint('#7c3aed', 1) === '#ffffff' && shade('#7c3aed', 1) === '#000000', 'mixing all the way reaches white and black');
assert(tint('#7c3aed', 0.4) > '#7c3aed' && shade('#7c3aed', 0.4) < '#7c3aed', 'a lighter brand colour and a darker one are both real colours');
assert(/^#[0-9a-f]{6}$/.test(tint('red', 0.5)) && /^#[0-9a-f]{6}$/.test(shade('', 0.5)), 'a colour that is not hex still gives a usable one');

/* ------------------------------------------------------------------------- *
 * 3. The brand and the words read in, in plain form
 * ------------------------------------------------------------------------- */
const brand = brandOf(BRAND_KIT);
assert(brand.primary === '#7c3aed' && brand.accent === '#a78bfa', 'a recipe reads the brand colours');
assert(brand.headingFont === 'Poppins' && brand.bodyFont === 'Lato', 'a recipe reads the brand fonts');
assert(Object.keys(brand).every((key) => !/url|image|logo|client|id/i.test(key)), 'a recipe is never handed a picture, an id or a secret');
const bareBrand = brandOf(null);
assert(/^#[0-9a-f]{6}$/.test(bareBrand.primary) && ELEMENT_LIMITS && bareBrand.headingFont.length > 0, 'a missing brand kit still gives a real colour and font');
assert(brandOf({ colors: { primary: 'red' } }).primary === bareBrand.primary, 'a colour that is not hex falls back to the shipped brand colour');
assert(brandOf({ fonts: { heading: 'Comic Sans' } }).headingFont === bareBrand.headingFont, 'a font that is not offered falls back to a real one');

const readSlots = slotsOf({ ...NORMAL, headline: '<b>Clean Water Fair</b>', details: Array.from({ length: 9 }, (_, i) => `line ${i}`) });
assert(readSlots.headline === 'Clean Water Fair', 'tags never reach a design');
assert(readSlots.details.length === 4, 'a design lays out at most four extra lines');
assert(slotsOf({ icon: 'not-an-icon' }).icon === '', 'an unknown picture name is dropped');
assert(slotsOf(null).headline === '' && slotsOf(undefined).details.length === 0, 'missing words are read as no words at all');
assert(slotsOf({ imageUrl: '  ' + TENANT_PHOTO + '  ' }).imageUrl === TENANT_PHOTO, 'a picture address is kept as it is');

assert(RECIPE_VARIANTS.length === 4 && RECIPE_OPTIONS_DEFAULT.variant === 0, 'each design has four shapes and a starting one');
const defaultBuild = build('hero', NORMAL).built;
const oddBuild = build('hero', NORMAL, { variant: 9, palette: 'nope', typeStyle: 'nope', decoration: 'nope', artwork: 'nope' }).built;
assert(JSON.stringify(oddBuild) === JSON.stringify(defaultBuild), 'an unknown choice falls back to the starting one');

/* ------------------------------------------------------------------------- *
 * 4. Every design, every shape, every set of words
 * ------------------------------------------------------------------------- */
const sweepFailures = {
  outside: [],
  small: [],
  tinyFont: [],
  overlap: [],
  tooMany: [],
  duplicateId: [],
  serverRefused: [],
  changedShape: [],
  buildProblem: [],
  icon: [],
  stroke: [],
  hardcodedColour: [],
  decoration: [],
  blankKey: [],
};

/* Every colour a design may paint: the brand's own colours, then one or two mixings of those
   toward white or black. Two mixings is as deep as a recipe ever goes. */
function nearest(color, target, amount) {
  const body = color.slice(1);
  const parts = body.length === 3 ? body.split('').map((p) => p + p) : [body.slice(0, 2), body.slice(2, 4), body.slice(4, 6)];
  return (
    '#' +
    parts
      .map((pair, index) => {
        const value = Number.parseInt(pair, 16);
        const mixed = Math.min(255, Math.max(0, Math.round(value + (target[index] - value) * amount)));
        return mixed.toString(16).padStart(2, '0');
      })
      .join('')
  );
}

function reachableFrom(seedColours) {
  const all = new Set(seedColours);
  let frontier = [...seedColours];
  for (let round = 0; round < 2 && frontier.length > 0; round += 1) {
    const next = [];
    for (const color of frontier) {
      for (let step = 0; step <= 100; step += 1) {
        for (const made of [nearest(color, [255, 255, 255], step / 100), nearest(color, [0, 0, 0], step / 100)]) {
          if (!all.has(made)) {
            all.add(made);
            next.push(made);
          }
        }
      }
    }
    frontier = next;
  }
  return all;
}

const reachable = reachableFrom(Object.values(brand).filter((value) => /^#[0-9a-f]{6}$/.test(value)));
const otherBrandKit = {
  colors: { primary: '#b91c1c', secondary: '#0c4a6e', accent: '#f59e0b', text: '#fff7ed', background: '#1c1917' },
  content: { headingColor: '#7f1d1d', bodyColor: '#44403c', defaultImageUrl: '' },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header: { height: 140 },
  footer: { height: 120 },
};
const otherBrand = brandOf(otherBrandKit);
const otherReachable = reachableFrom(Object.values(otherBrand).filter((value) => /^#[0-9a-f]{6}$/.test(value)));

for (const design of DESIGN_RECIPES) {
  for (const variant of RECIPE_VARIANTS) {
    for (const palette of RECIPE_PALETTES) {
      for (const [contentName, slots] of CONTENTS) {
        const label = `${design.id} shape ${variant} palette ${palette} with ${contentName}`;
        const { area, built } = build(design.id, slots, { variant, palette });
        const elements = built.elements;
        if (built.problems.length) {
          sweepFailures.buildProblem.push(`${label}: ${built.problems.join(' ')}`);
          continue;
        }
        if (elements.length === 0) {
          sweepFailures.buildProblem.push(`${label}: built nothing`);
          continue;
        }
        if (elements.length > ELEMENT_LIMITS.maxItems) sweepFailures.tooMany.push(`${label}: ${elements.length} items`);
        for (const item of elements) {
          if (
            item.x < area.x ||
            item.y < area.y ||
            item.x + item.w > area.x + area.w ||
            item.y + item.h > area.y + area.h
          ) {
            sweepFailures.outside.push(`${label}: ${item.id} at ${item.x},${item.y} ${item.w}x${item.h} outside ${JSON.stringify(area)}`);
          }
          if (item.kind === 'icon' && !ICON_NAMES.includes(item.name)) {
            sweepFailures.icon.push(`${label}: ${item.id} asks for "${item.name}"`);
          }
          if (item.kind === 'icon' && (item.style.strokeWidth < 1 || item.style.strokeWidth > 4)) {
            sweepFailures.stroke.push(`${label}: ${item.id} line ${item.style.strokeWidth}`);
          }
          if (item.style.opacity < 0 || item.style.opacity > 1) {
            sweepFailures.stroke.push(`${label}: ${item.id} see-through ${item.style.opacity}`);
          }
          if (item.id.startsWith('deco-') && item.style.opacity > DECORATION_MAX_OPACITY) {
            sweepFailures.decoration.push(`${label}: ${item.id} at ${item.style.opacity}`);
          }
        }
        for (const colour of colorsUsed(elements)) {
          if (!reachable.has(colour)) sweepFailures.hardcodedColour.push(`${label}: ${colour} is not a brand colour`);
        }
        const ids = elements.map((item) => item.id);
        if (new Set(ids).size !== ids.length) sweepFailures.duplicateId.push(label);
        if (elements.filter((item) => item.kind === 'text' && item.variable).length > VARIABLE_LIMITS.maxText) {
          sweepFailures.tooMany.push(`${label}: ${ids.length} fill-ins`);
        }

        const words = wordBoxes(elements);
        for (const item of words) {
          if (item.w < ELEMENT_LIMITS.minWidth || item.h < ELEMENT_LIMITS.minHeight) {
            sweepFailures.small.push(`${label}: ${item.id} is ${item.w}x${item.h}`);
          }
          if (item.style.size < MIN_RECIPE_FONT || item.style.minSize < MIN_RECIPE_FONT) {
            sweepFailures.tinyFont.push(`${label}: ${item.id} ${item.style.size}/${item.style.minSize}`);
          }
        }
        for (let a = 0; a < words.length; a += 1) {
          for (let b = a + 1; b < words.length; b += 1) {
            if (overlaps(words[a], words[b])) {
              sweepFailures.overlap.push(`${label}: ${words[a].id} and ${words[b].id}`);
            }
          }
        }

        /* The server's own gate, with today's brand bands and poster size. */
        let stored;
        try {
          stored = cleanElements(elements, contextFor());
        } catch (error) {
          sweepFailures.serverRefused.push(`${label}: ${error.message}`);
        }
        if (stored && JSON.stringify(stored) !== JSON.stringify(elements)) {
          sweepFailures.changedShape.push(`${label}: the server changed the design`);
        }
        if (stored && validateElements(stored, contextFor()).length) {
          sweepFailures.serverRefused.push(`${label}: ${validateElements(stored, contextFor()).join(' ')}`);
        }

        const again = buildElements(design.id, { area, brandKit: BRAND_KIT, slots, options: { variant, palette } }).elements;
        if (JSON.stringify(again) !== JSON.stringify(elements)) sweepFailures.changedShape.push(`${label}: same words built twice gave different designs`);
      }
    }
  }
}

const totalRuns = DESIGN_RECIPES.length * RECIPE_VARIANTS.length * RECIPE_PALETTES.length * CONTENTS.length;
assert(sweepFailures.buildProblem.length === 0, `${totalRuns} builds all made a design (${sweepFailures.buildProblem[0] || ''})`);
assert(sweepFailures.outside.length === 0, `nothing ever sits outside the space between the two brand bands (${sweepFailures.outside[0] || ''})`);
assert(sweepFailures.small.length === 0, `every box of words is at least ${ELEMENT_LIMITS.minWidth} x ${ELEMENT_LIMITS.minHeight} (${sweepFailures.small[0] || ''})`);
assert(sweepFailures.tinyFont.length === 0, `every box of words can be read from a wall, at least ${MIN_RECIPE_FONT} px (${sweepFailures.tinyFont[0] || ''})`);
assert(sweepFailures.overlap.length === 0, `no two boxes of words ever touch (${sweepFailures.overlap[0] || ''})`);
assert(sweepFailures.duplicateId.length === 0, `every box in a design has its own name (${sweepFailures.duplicateId[0] || ''})`);
assert(sweepFailures.tooMany.length === 0, `a design never asks for more than ${ELEMENT_LIMITS.maxItems} items or ${VARIABLE_LIMITS.maxText} fill-ins (${sweepFailures.tooMany[0] || ''})`);
assert(sweepFailures.serverRefused.length === 0, `the server accepts every design as it is built (${sweepFailures.serverRefused[0] || ''})`);
assert(sweepFailures.changedShape.length === 0, `saving a design changes nothing about it, and the same words give the same design (${sweepFailures.changedShape[0] || ''})`);
assert(sweepFailures.icon.length === 0, `every picture a design asks for is one this app can draw (${sweepFailures.icon[0] || ''})`);
assert(sweepFailures.stroke.length === 0, `a picture's line thickness always stays in the range (${sweepFailures.stroke[0] || ''})`);
assert(sweepFailures.decoration.length === 0, `an extra shape always stays behind the words (${sweepFailures.decoration[0] || ''})`);
assert(sweepFailures.hardcodedColour.length === 0, `every colour a design paints comes from the brand kit (${sweepFailures.hardcodedColour[0] || ''})`);

/* The same design on another brand: most of its colours must move with the brand. */
const kitColours = new Set();
const otherKitColours = new Set();
for (const design of DESIGN_RECIPES) {
  for (const colour of colorsUsed(build(design.id, NORMAL).built.elements)) kitColours.add(colour);
  const otherArea = contentArea(otherBrandKit, { size: POSTER });
  for (const colour of colorsUsed(buildElements(design.id, { area: otherArea, brandKit: otherBrandKit, slots: NORMAL }).elements)) {
    otherKitColours.add(colour);
  }
}
const shared = [...kitColours].filter((colour) => otherKitColours.has(colour));
assert(
  shared.length * 2 < kitColours.size,
  `another brand kit gives a different-looking poster (${kitColours.size} colours, only ${shared.length} the same)`
);
assert(
  [...otherKitColours].every((colour) => otherReachable.has(colour)),
  'a second brand kit keeps its own colours too'
);

/* ------------------------------------------------------------------------- *
 * 5. Poster parts and fill-ins
 * ------------------------------------------------------------------------- */
const heroElements = build('hero', NORMAL).built.elements;
const keys = heroElements.filter((item) => item.variable).map((item) => item.key).sort();
assert(
  JSON.stringify(keys) === JSON.stringify(['cta_button', 'cta_line', 'slogan_1', 'slogan_2', 'title_sub']),
  'a design offers the five fill-ins, named with underscores'
);
for (const key of Object.keys(DESIGN_BLANKS)) {
  const blank = heroElements.find((item) => item.key === key);
  assert(blank.variable === true && blank.kind === 'text', `"${key}" is a box of words somebody fills in`);
  assert(blank.label === DESIGN_BLANKS[key].label && blank.maxLength === DESIGN_BLANKS[key].maxLength, `"${key}" says what to write and how much room it has`);
  assert(blank.text === '' && blank.hint.length <= VARIABLE_LIMITS.hintChars, `"${key}" is saved with no words of its own`);
}
assert(
  DESIGN_RECIPES.every((design) => {
    const elements = build(design.id, NORMAL).built.elements;
    return elements.filter((item) => item.variable).map((item) => item.key).sort().join(',') === keys.join(',');
  }),
  'all five designs offer the same five fill-ins'
);

const fieldsUsed = (elements) => elements.filter((item) => item.kind === 'field').map((item) => item.field);
assert(fieldsUsed(heroElements).includes('headline'), 'every design carries the poster title');
assert(
  DESIGN_RECIPES.every((design) => fieldsUsed(build(design.id, NORMAL).built.elements).filter((f) => f === 'headline').length === 1),
  'a design places the title exactly once'
);
for (const design of DESIGN_RECIPES) {
  const elements = build(design.id, NORMAL).built.elements;
  const used = fieldsUsed(elements);
  assert(
    ['headline', 'tagline', 'date', 'time', 'venue', 'details'].every((field) => used.includes(field)),
    `${design.id} uses the built-in parts for title, line, date, time, place and extra lines`
  );
  assert(
    used.every((field) => ELEMENT_FIELDS.includes(field)),
    `${design.id} only uses parts the editor already knows`
  );
}
assert(
  DESIGN_RECIPES.every((design) => {
    const withPhoto = fieldsUsed(build(design.id, NORMAL).built.elements).includes('photo') ||
      build(design.id, NORMAL).built.elements.some((item) => item.kind === 'image');
    return withPhoto;
  }),
  'every design has somewhere for a picture'
);

const noVenue = build('hero', SPARSE).built.elements;
assert(!fieldsUsed(noVenue).includes('venue') && !fieldsUsed(noVenue).includes('time'), 'no place and no time leave no empty box on the poster');
assert(fieldsUsed(noVenue).includes('date'), 'the date still has its place when nothing else does');
const noDetails = build('hero', { ...NORMAL, details: [] }).built.elements;
assert(!fieldsUsed(noDetails).includes('details'), 'no extra lines means no list of extra lines');
assert(
  !build('hero', { ...NORMAL, imageUrl: 'https://images.pexels.com/photos/1/a.jpg' }).built.elements.some((item) => (item.kind === 'image' || item.field === 'photo') && item.imageUrl),
  'a picture from outside the image library is never built into a design'
);

/* ------------------------------------------------------------------------- *
 * 6. The icon kind is checked by the same rules as everything else
 * ------------------------------------------------------------------------- */
assert(ICON_NAMES.length >= 25 && ICON_NAMES.length <= 40, `this app can draw ${ICON_NAMES.length} pictures`);
assert(new Set(ICON_NAMES).size === ICON_NAMES.length, 'no picture name is listed twice');
assert(ICON_NAMES.every((name) => /^[a-z]+(-[a-z]+)*$/.test(name)), 'every picture name is lower-case with a dash');
assert(normalizeIconName('Map Pin') === 'map-pin', 'a picture name is read whatever the capitals or spacing');
assert(normalizeIconName('whatever') === '', 'a picture this app cannot draw is refused');
assert(ICON_NAMES.includes(iconForCategory('health')), 'every kind of event has its own picture');
assert(ICON_NAMES.includes(iconForCategory('nope')), 'an unknown kind of event still gets a picture this app can draw');
assert(normalizeElements([{ kind: 'icon', x: 70, y: 200, w: 60, h: 60, name: 'heart', style: { strokeWidth: 99 } }])[0].style.strokeWidth === ELEMENT_LIMITS.iconStrokeWidth.max, 'a picture line thickness is kept inside the range');
assert(normalizeElements([{ kind: 'icon', x: 70, y: 200, w: 60, h: 60, name: 'nope' }])[0].name === '', 'a picture this app cannot draw is not stored');
/* An icon is always checked next to the headline the editor insists on. */
function withHeadline(icon) {
  return normalizeElements([
    { id: 'field-headline', kind: 'field', field: 'headline', x: 70, y: 200, w: 900, h: 120 },
    icon,
  ]);
}
assert(
  validateElements(withHeadline({ kind: 'icon', id: 'mark', x: 70, y: 400, w: 60, h: 60 }), contextFor())
    .join(' ')
    .includes('needs a picture'),
  'a picture with no name chosen is refused in plain words'
);
assert(
  validateElements(
    withHeadline({ kind: 'icon', id: 'mark', x: 70, y: 400, w: 60, h: 60, name: 'trophy', style: { strokeWidth: 2 } }),
    contextFor()
  ).length === 0,
  'a named picture is accepted'
);
assert(
  validateElements(
    [
      { id: 'field-headline', kind: 'field', field: 'headline', x: 70, y: 200, w: 900, h: 120, style: {} },
      { id: 'mark', kind: 'icon', x: 70, y: 400, w: 60, h: 60, name: 'trophy', style: { strokeWidth: 9 } },
    ],
    contextFor()
  )
    .join(' ')
    .includes('pixels thick'),
  'a picture asking for too thick a line is refused before it is saved'
);
const medallion = build('typographic', SPARSE, { artwork: 'medallion' }).built.elements;
assert(medallion.some((item) => item.kind === 'icon'), 'with no picture to show, a design puts a drawn picture in the round mark');

/* ------------------------------------------------------------------------- *
 * 7. Any poster size, and the space between the bands
 * ------------------------------------------------------------------------- */
for (const size of [
  { width: 1080, height: 1350 },
  { width: 1920, height: 1080 },
  { width: 600, height: 800 },
  { width: 2400, height: 3200 },
]) {
  const label = `a ${size.width} x ${size.height} poster`;
  for (const design of DESIGN_RECIPES) {
    const context = contextFor(size);
    const elements = buildElements(design.id, { brandKit: BRAND_KIT, size, slots: NORMAL }).elements;
    assert(
      elements.length > 0 && validateElements(elements, context).length === 0,
      `${design.id} still fits ${label}`
    );
  }
}
const tallBands = { ...BRAND_KIT, header: { height: 400 }, footer: { height: 500 } };
for (const design of DESIGN_RECIPES) {
  const elements = buildElements(design.id, { brandKit: tallBands, size: POSTER, slots: NORMAL }).elements;
  const area = contentArea(tallBands, { size: POSTER });
  assert(
    elements.every((item) => item.y >= area.y && item.y + item.h <= area.y + area.h),
    `${design.id} keeps clear of very tall brand bands`
  );
}
assert(
  JSON.stringify(buildElements('hero', { brandKit: BRAND_KIT, size: POSTER, slots: NORMAL }).elements) ===
    JSON.stringify(build('hero', NORMAL).built.elements),
  'working the space out from the brand kit gives the same design as being handed it'
);

console.log(`Design recipe tests passed: ${passed} assertions (${totalRuns} builds, ${ICON_NAMES.length} pictures offered)`);
