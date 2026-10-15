/**
 * Plain Node check of the shared editor rules: no server, no database, no browser.
 * Run with `npm run test:elements`.
 */
import {
  BAND_HEIGHTS,
  EDITOR_VERSION,
  ELEMENT_FONTS,
  ELEMENT_LIMITS,
  ELEMENT_WEIGHTS,
  FONT_WEIGHTS,
  VARIABLE_LIMITS,
  aiSlotsOf,
  brandBandForEditing,
  brandBandProblems,
  brandFooterToElements,
  brandHeaderToElements,
  checkElementImageUrl,
  contentArea,
  defaultBrandBands,
  effectiveBand,
  elementsOfDesign,
  jsonBytes,
  legacyToElements,
  legacyToSections,
  normalizeBrandBand,
  normalizeElement,
  normalizeElements,
  plainText,
  resolveBands,
  resolveItemImage,
  resolveBrandText,
  resolveContentValues,
  resolveStyleTokens,
  rotatedBoundingBox,
  tenantImagePrefix,
  validateElements,
  validateTemplateSections,
  variableSlotsOf,
  weightsFor,
} from '../../shared/templateElements.js';

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
  passed += 1;
}

const CLOUD = 'demo-cloud';
const CLIENT = '64b000000000000000000001';
const ownImage = `https://res.cloudinary.com/${CLOUD}/image/upload/v1/brand/${CLIENT}/photo.jpg`;
const urlContext = { cloudName: CLOUD, clientId: CLIENT };

const brandKit = {
  header: { height: 120 },
  footer: { height: 100 },
  content: {
    headingFont: 'Poppins',
    bodyFont: 'Lato',
    headingColor: '#111111',
    bodyColor: '#222222',
  },
};

const legacyTemplate = {
  size: { width: 1080, height: 1350 },
  zones: [
    { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140 },
    { id: 'zone-content', type: 'content', x: 70, y: 170, w: 940, h: 640, minFont: 16, maxFont: 54 },
    { id: 'zone-image', type: 'image', x: 70, y: 830, w: 940, h: 370 },
    { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130 },
  ],
  layout: { alignment: 'left', itemOffsets: { headline: { dx: 10, dy: 20 } } },
};

function fieldElement(field, overrides = {}) {
  return {
    id: `field-${field}`,
    kind: 'field',
    field,
    x: 70,
    y: 200,
    w: 940,
    h: 80,
    z: 0,
    style: { size: 40, minSize: 16, color: '#0f172a', fontFamily: 'Inter' },
    ...overrides,
  };
}

function problemsWith(elements, extra = {}) {
  return validateElements(elements, { brandKit, template: legacyTemplate, ...urlContext, ...extra });
}

// 1. The content area is the poster minus the two brand bands
const area = contentArea(brandKit, legacyTemplate);
assert(area.x === 0 && area.y === 120 && area.w === 1080 && area.h === 1130, 'content area removes the brand header and footer');
const defaultArea = contentArea(null, { size: { width: 1080, height: 1350 } });
assert(
  defaultArea.y === BAND_HEIGHTS.header.default &&
    defaultArea.h === 1350 - BAND_HEIGHTS.header.default - BAND_HEIGHTS.footer.default,
  'a missing brand kit falls back to the default band heights'
);
const tightArea = contentArea({ header: { height: 200 }, footer: { height: 260 } }, { size: { width: 600, height: 600 } });
assert(tightArea.h >= 120 && tightArea.y + tightArea.h <= 600, 'huge brand bands are shrunk so a strip is left to design in');
assert(contentArea(brandKit, {}).w === 1080, 'a template with no size uses the standard poster size');

// 2. An old zones-only template becomes editor items without touching the database
const converted = legacyToElements(legacyTemplate, brandKit);
assert(converted.length === 7, 'an old template with a photo area becomes seven items');
assert(
  legacyToElements({ ...legacyTemplate, zones: legacyTemplate.zones.filter((zone) => zone.type !== 'image') }, brandKit)
    .length === 6,
  'an old template without a photo area becomes six items'
);
assert(
  converted.filter((element) => element.kind === 'field' && element.field === 'headline').length === 1,
  'the conversion makes exactly one headline'
);
assert(
  converted.every((element) => element.y >= area.y && element.y + element.h <= area.y + area.h),
  'every converted item sits clear of the header and footer'
);
assert(new Set(converted.map((element) => element.id)).size === converted.length, 'converted items each have their own name');
assert(converted[0].style.size === 54 && converted[0].style.minSize === 16, 'the headline keeps the old text size range');
assert(
  converted[0].style.fontFamily === 'Poppins' && converted[5].style.fontFamily === 'Lato',
  'converted items keep the brand fonts'
);
assert(converted[0].x === 80 && converted[0].y === 190, 'the per-item nudge an admin already made is carried over');
assert(
  converted[6].field === 'photo' && converted[6].y === 830 && converted[6].h === 370,
  'the old photo area becomes a photo item in the same place'
);
assert(problemsWith(converted).length === 0, 'a converted template is ready to save as it is');
assert(
  legacyToElements({ zones: [{ type: 'content', x: 0, y: 0, w: 1080, h: 1350 }] }, brandKit).every(
    (element) => element.y >= area.y
  ),
  'an old content area that reaches into a brand band is pulled inside it'
);

// 3. Items are cleaned before they are stored
const cleaned = normalizeElements([
  {
    id: 'a',
    kind: 'text',
    field: 'headline',
    x: 10.4,
    y: '20',
    w: 300,
    h: 60,
    z: 9999,
    text: `<b>Big</b> night\u0000 here`,
    style: { fontFamily: 'Comic Sans', color: 'red', size: 900, minSize: 950, opacity: 4, radius: 999, weight: 450 },
    clientId: CLIENT,
    _id: 'nope',
    secret: 'hunter2',
  },
]);
const item = cleaned[0];
assert(item.x === 10 && item.y === 20, 'positions are stored as whole pixels');
assert(item.z === ELEMENT_LIMITS.z.max, 'a layer number beyond the range is pulled back');
assert(item.text === 'Big night here', 'tags and control characters never reach the database');
assert(item.style.fontFamily === 'Inter', 'a font that is not offered falls back to a real one');
assert(item.style.color === '#0f172a', 'a colour that is not hex falls back to the default');
assert(item.style.size === ELEMENT_LIMITS.fontSize.max && item.style.minSize <= item.style.size, 'text sizes are kept inside the range');
assert(item.style.opacity === 1 && item.style.radius === ELEMENT_LIMITS.radius.max, 'look choices are kept inside their ranges');
assert(item.style.weight === 500, 'a weight that is not offered falls back to a real one');
assert(item.kind === 'text' && item.field === undefined, 'a text box carries no poster field');
assert(item.clientId === undefined && item._id === undefined && item.secret === undefined, 'keys an item should not carry are dropped');
assert(normalizeElements([{ kind: 'field' }])[0].field === 'headline', 'a poster item with no part named becomes the headline');
assert(normalizeElements([]).length === 0, 'an empty list stays empty');
assert(normalizeElements(null).length === 0, 'a missing list is read as no items');

/* Tamil words and Tamil faces travel through the same rules as English ones. */
const tamilCleaned = normalizeElements([
  {
    id: 't1',
    kind: 'text',
    x: 10,
    y: 20,
    w: 400,
    h: 60,
    text: '<b>நீர்</b> மீட்பு\u0000 விழா',
    style: { fontFamily: 'Noto Sans Tamil', size: 40, minSize: 16, color: '#0f172a' },
  },
  {
    id: 't2',
    kind: 'text',
    x: 10,
    y: 100,
    w: 400,
    h: 60,
    text: 'Clean Water Fair - நீர் மீட்பு விழா',
    style: { fontFamily: 'Hind Madurai', size: 40, minSize: 16, color: '#0f172a' },
  },
]);
assert(tamilCleaned[0].text === 'நீர் மீட்பு விழா', 'Tamil words reach the database whole, tags and control characters gone');
assert(tamilCleaned[1].text === 'Clean Water Fair - நீர் மீட்பு விழா', 'Tamil and English in one line both survive');
assert(tamilCleaned[0].style.fontFamily === 'Noto Sans Tamil', 'a Tamil font that is offered is kept as it was set');
assert(tamilCleaned[1].style.fontFamily === 'Hind Madurai', 'a second Tamil font is kept too');
for (const family of ['Noto Sans Tamil', 'Noto Serif Tamil', 'Hind Madurai', 'Mukta Malar', 'Catamaran', 'Baloo Thambi 2']) {
  assert(
    problemsWith([fieldElement('headline', { style: { fontFamily: family } })]).join(' ').length === 0,
    `${family} is one of the fonts this app offers`
  );
}

/* A font is only asked for the weights it really publishes, or the request loses the face. */
assert(ELEMENT_FONTS.every((family) => FONT_WEIGHTS[family]), 'every offered font knows its own weights');
assert(FONT_WEIGHTS['Hind Madurai'].at(-1) === 700, 'a family that stops at 700 is recorded as stopping at 700');
assert(weightsFor('Hind Madurai', [400, 800, 900]).join(',') === '400,700', 'weights beyond a family range fall back to its heaviest');
assert(weightsFor('Baloo Thambi 2', [100, 200, 300]).join(',') === '400', 'weights below a family range fall back to its lightest');
assert(weightsFor('Lato', [500, 600, 800]).join(',') === '400,700', 'a family with gaps in its weights keeps the nearest ones');
assert(weightsFor('Inter', [700, 400, 400]).join(',') === '400,700', 'weights a family does have are kept, sorted and without repeats');
assert(weightsFor('Inter', ELEMENT_WEIGHTS).every((weight) => FONT_WEIGHTS.Inter.includes(weight)), 'a full set of offered weights stays offered');
for (const family of ELEMENT_FONTS) {
  const snapped = weightsFor(family, ELEMENT_WEIGHTS);
  assert(
    snapped.length > 0 && snapped.every((weight) => FONT_WEIGHTS[family].includes(weight)),
    `${family} is asked only for weights it publishes`
  );
}

// 4. Only one headline, and every other part of the poster at most once
assert(problemsWith([]).join(' ').includes('needs a headline'), 'a template with no headline is refused');
assert(
  problemsWith([fieldElement('headline'), fieldElement('headline', { id: 'second' })]).join(' ').includes('only one headline'),
  'two headlines are refused'
);
assert(
  problemsWith([fieldElement('headline'), fieldElement('date'), fieldElement('date', { id: 'date-2' })])
    .join(' ')
    .includes('only once'),
  'the same part of the poster twice is refused'
);
assert(problemsWith([fieldElement('headline'), fieldElement('photo', { id: 'p' })]).length === 0, 'one of each part is accepted');

// 5. Counts and sizes
const many = (kind, count, extra = {}) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${kind}-${index}`,
    kind,
    x: 70,
    y: 200,
    w: 200,
    h: 60,
    ...extra,
  }));
assert(
  problemsWith([fieldElement('headline'), ...many('text', ELEMENT_LIMITS.maxText + 1)])
    .join(' ')
    .includes(`${ELEMENT_LIMITS.maxText} text boxes`),
  'too many text boxes are refused'
);
assert(
  problemsWith([fieldElement('headline'), ...many('image', ELEMENT_LIMITS.maxImage + 1, { imageUrl: ownImage })])
    .join(' ')
    .includes(`${ELEMENT_LIMITS.maxImage} photos`),
  'too many photos are refused'
);
assert(
  problemsWith([fieldElement('headline'), ...many('shape', ELEMENT_LIMITS.maxShape + 1)])
    .join(' ')
    .includes(`${ELEMENT_LIMITS.maxShape} shapes`),
  'too many shapes are refused'
);
assert(
  problemsWith([...many('text', ELEMENT_LIMITS.maxItems + 1)]).join(' ').includes(`${ELEMENT_LIMITS.maxItems} items`),
  'more than thirty items are refused'
);
assert(
  problemsWith([fieldElement('headline', { w: 30, h: 60 })]).join(' ').includes('too small'),
  'an item narrower than the minimum is refused'
);
assert(
  problemsWith([fieldElement('headline', { w: 940, h: 20 })]).join(' ').includes('too small'),
  'an item shorter than the minimum is refused'
);
assert(problemsWith([fieldElement('headline', { w: 40, h: 24 })]).length === 0, 'the smallest allowed item is accepted');

// 6. Everything stays inside the poster, clear of the two brand bands
assert(problemsWith([fieldElement('headline', { x: -10, y: 200, w: 200, h: 60 })]).join(' ').includes('fully inside'), 'an item off the left edge is refused');
assert(
  problemsWith([fieldElement('headline', { x: 70, y: 20, w: 200, h: 60 })]).join(' ').includes('fully inside'),
  'an item inside the header band is refused'
);
assert(
  problemsWith([fieldElement('headline', { x: 70, y: 1200, w: 200, h: 300 })]).join(' ').includes('fully inside'),
  'an item reaching past the bottom is refused'
);
assert(
  problemsWith([fieldElement('headline', { x: 900, y: 200, w: 400, h: 60 })]).join(' ').includes('fully inside'),
  'an item off the right edge is refused'
);
assert(problemsWith([fieldElement('headline', { x: 0, y: 120, w: 1080, h: 1130 })]).length === 0, 'an item filling the content area is accepted');
assert(
  problemsWith([fieldElement('headline'), fieldElement('date', { id: 'd', y: 210 })]).length === 0,
  'items may overlap each other'
);
assert(
  validateElements([fieldElement('headline', { x: -500, y: -500, w: 200, h: 60 })], {}).length === 0,
  'a caller that does not know the poster yet leaves the position rule to the one that does'
);

// 7. Look choices are checked
assert(
  problemsWith([fieldElement('headline', { style: { size: 400 } })]).join(' ').includes('text size outside'),
  'a text size beyond the range is refused'
);
assert(
  problemsWith([fieldElement('headline', { style: { size: 20, minSize: 40 } })]).join(' ').includes('cannot shrink'),
  'a smallest size larger than the normal size is refused'
);
assert(
  problemsWith([fieldElement('headline', { style: { color: 'red' } })]).join(' ').includes('hex'),
  'a colour that is not hex is refused'
);
assert(
  problemsWith([fieldElement('headline', { style: { color: '#abc' } })]).length === 0,
  'a short hex colour is accepted'
);
assert(
  problemsWith([fieldElement('headline', { style: { fontFamily: 'Comic Sans' } })]).join(' ').includes('fonts this app offers'),
  'a font that is not offered is refused'
);
assert(
  problemsWith([
    fieldElement('headline'),
    { id: 'box', kind: 'shape', x: 70, y: 400, w: 200, h: 60, shape: { type: 'rect', fill: 'purple' } },
  ]).join(' ').includes('hex'),
  'a shape colour that is not hex is refused'
);
assert(
  problemsWith([fieldElement('headline'), { id: 'box', kind: 'nope', x: 70, y: 400, w: 200, h: 60 }])
    .join(' ')
    .includes('not a kind of item'),
  'an unknown kind of item is refused'
);
assert(
  problemsWith([fieldElement('headline'), { id: 'x', kind: 'field', field: 'slogan', x: 70, y: 400, w: 200, h: 60 }])
    .join(' ')
    .includes('not a part of the poster'),
  'an unknown poster part is refused'
);
assert(
  problemsWith([fieldElement('headline'), fieldElement('date', { id: 'd' })]).length === 0,
  'a plain valid set of items is accepted'
);

// 8. Photos must live in this tenant's own Cloudinary folder
assert(checkElementImageUrl(ownImage, urlContext).ok, "this organization's own photo is accepted");
assert(checkElementImageUrl('', urlContext).ok, 'an item with no photo is accepted');
assert(!checkElementImageUrl('http://example.com/a.jpg', urlContext).ok, 'an insecure photo address is refused');
assert(
  !checkElementImageUrl('https://res.cloudinary.com/other-cloud/image/upload/v1/brand/x/y.jpg', urlContext).ok,
  'a photo from another image library is refused'
);
assert(
  !checkElementImageUrl(`https://res.cloudinary.com/${CLOUD}/image/upload/v1/brand/64b000000000000000000099/y.jpg`, urlContext)
    .ok,
  "a photo from another organization's folder is refused"
);
assert(
  problemsWith([fieldElement('headline'), { id: 'p', kind: 'image', x: 70, y: 500, w: 400, h: 300, imageUrl: 'https://example.com/a.jpg' }])
    .join(' ')
    .includes('own image library'),
  'a photo item from outside the image library is refused'
);
assert(tenantImagePrefix('your_cloud_name') === 'https://res.cloudinary.com/', 'an unset image library still gives a usable prefix');

// 9. Words are plain words
assert(plainText('<b>Bold</b> text') === 'Bold text', 'tags are removed from item text');
assert(plainText('two   lines\nhere') === 'two lines here', 'runs of spaces become one space');
assert(plainText('x'.repeat(400)).length === ELEMENT_LIMITS.textChars, 'item text is cut to the limit');
assert(plainText(123) === '', 'a number where words belong is dropped');

// 10. Sizes and versions
assert(jsonBytes({ a: 'x'.repeat(10) }) > 10, 'the size helper counts stored characters');
assert(EDITOR_VERSION === 2, 'templates saved by this editor are marked as version 2');

// 11. Items a person or the assistant can fill in later
function fillText(index, overrides = {}) {
  return {
    id: `fill-${index}`,
    kind: 'text',
    x: 70,
    y: 200 + (index % 10) * 80,
    w: 900,
    h: 60,
    text: 'Sample words',
    variable: true,
    key: `blank_${index}`,
    label: `Blank ${index}`,
    hint: 'one short line',
    maxLength: 60,
    ...overrides,
  };
}
function fillImage(index, overrides = {}) {
  const col = Math.floor(index / 10);
  const row = index % 10;
  return {
    id: `fill-image-${index}`,
    kind: 'image',
    x: 70 + col * 320,
    y: 200 + row * 90,
    w: 300,
    h: 80,
    variable: true,
    key: `pic_${index}`,
    label: `Picture ${index}`,
    ...overrides,
  };
}

assert(problemsWith([fieldElement('headline'), ...Array.from({ length: 40 }, (_, i) => fillText(i))]).length === 0, 'forty fill-in texts are allowed');
assert(
  problemsWith([
    fieldElement('headline'),
    ...Array.from({ length: 40 }, (_, i) => fillText(i)),
    fillText(40, { id: 'fill-40', key: 'blank_40' }),
  ])
    .join(' ')
    .includes('at most 40 texts to be filled in'),
  'a forty-first fill-in text is refused'
);
assert(problemsWith([fieldElement('headline'), ...Array.from({ length: 24 }, (_, i) => fillImage(i))]).length === 0, 'twenty-four fill-in photos are allowed');
assert(
  problemsWith([
    fieldElement('headline'),
    ...Array.from({ length: 24 }, (_, i) => fillImage(i)),
    fillImage(24, { id: 'fill-image-24', key: 'pic_24' }),
  ])
    .join(' ')
    .includes('at most 24 photos to be replaced'),
  'a twenty-fifth fill-in photo is refused'
);
assert(
  problemsWith([fieldElement('headline'), fillText(0), fillText(1, { id: 'fill-1b', key: 'blank_0' })])
    .join(' ')
    .includes('share the name'),
  'two fill-ins cannot share one name'
);
assert(
  problemsWith([fieldElement('headline'), fillText(0, { key: 'Blank 0' })]).join(' ').includes('lower-case'),
  'a fill-in name must be lower-case letters, numbers or underscores'
);
assert(
  problemsWith([fieldElement('headline'), fillText(0, { key: 'a' })]).join(' ').length > 0,
  'a one-character fill-in name is refused'
);
assert(
  problemsWith([fieldElement('headline'), { ...fillText(0), kind: 'shape', shape: { type: 'rect', fill: '#111111' }, variable: true }])
    .join(' ')
    .includes('Only a text box or a picture'),
  'a shape cannot be a fill-in'
);

const filled = normalizeElements([fieldElement('headline'), fillText(0, { label: '<i>Sponsor</i>', hint: 'x'.repeat(300), maxLength: 999 })]);
assert(filled[1].variable === true && filled[1].key === 'blank_0', 'a fill-in keeps its own name');
assert(filled[1].label === 'Sponsor', 'the words shown for a fill-in are stored plain');
assert(filled[1].hint.length === VARIABLE_LIMITS.hintChars, 'a long hint is cut');
assert(filled[1].maxLength === VARIABLE_LIMITS.maxLength.max, 'the room a fill-in has is cut to the biggest allowed');
assert(!('key' in filled[0]), 'an item that is not a fill-in gets no fill-in fields');
assert(
  normalizeElements([fieldElement('headline'), fillText(0, { maxLength: 4, variable: true })])[1].maxLength === VARIABLE_LIMITS.maxLength.min,
  'a fill-in always allows some characters'
);
assert(
  normalizeElements([fieldElement('headline'), fillText(0, { key: 'Bad Name', variable: true })])[1].key.length >= VARIABLE_LIMITS.key.min,
  'a fill-in with an unusable name is given a workable one'
);

const slots = variableSlotsOf(filled);
assert(slots.texts.length === 1 && slots.images.length === 0, 'the blanks a template offers are listed by kind');
assert(aiSlotsOf(filled)[0].maxLength === VARIABLE_LIMITS.maxLength.max, 'the assistant is told how much room each blank has');
assert(JSON.stringify(Object.keys(aiSlotsOf(filled)[0])) === JSON.stringify(['key', 'label', 'hint', 'maxLength']), 'the assistant sees only what it needs');

const fillImageItems = normalizeElements([fieldElement('headline'), fillImage(0)]);
assert(fillImageItems[1].imageUrl === '' && fillImageItems[1].variable === true, 'a fill-in photo may be saved with no picture yet');

// 11b. The picture a designer leaves in a space is an example, not a poster's answer
const pexelsAnswer = 'https://images.pexels.com/photos/1/a.jpg';
const sampleSlot = normalizeElements([fieldElement('headline'), fillImage(0, { imageUrl: ownImage })])[1];
assert(sampleSlot.imageUrl === ownImage, 'a picture space keeps the picture its designer left as an example');
assert(sampleSlot.defaultImage === undefined, 'the default for every poster is off unless it is asked for');
assert(resolveItemImage(sampleSlot, {}) === '', "the designer's example picture is never drawn on a poster");
assert(
  resolveItemImage(sampleSlot, {}, pexelsAnswer) === '',
  'a picture space with a name of its own takes only the answer written for that name',
);
assert(
  resolveItemImage(sampleSlot, {}, pexelsAnswer, true) === pexelsAnswer,
  'the poster picture fills a space that has no name of its own',
);
const tickedSlot = normalizeElements([fieldElement('headline'), fillImage(0, { imageUrl: ownImage, defaultImage: true })])[1];
assert(tickedSlot.defaultImage === true, 'the default for every poster is kept when an administrator ticks it');
assert(resolveItemImage(tickedSlot, { images: { pic_0: ownImage } }) === ownImage, 'a ticked default reaches the poster as its own answer');
assert(resolveItemImage(tickedSlot, { images: { pic_0: '' } }) === '', 'a ticked default nobody wants stays out of the poster');
assert(
  normalizeElements([fieldElement('headline'), fillImage(0, { imageUrl: ownImage, defaultImage: false })])[1].defaultImage === undefined,
  'a default tick that was taken off is stored as off'
);
const lockedPicture = normalizeElements([
  { id: 'fixed-picture-1', kind: 'image', x: 70, y: 200, w: 300, h: 80, imageUrl: ownImage, defaultImage: true },
])[0];
assert(lockedPicture.defaultImage === undefined, 'a picture that is part of the design has no default for every poster');

// 12. What a poster answers into those blanks
const answers = resolveContentValues(
  { extras: { blank_0: 'City Care', other: 'nope' }, images: { pic_0: ownImage, pic_9: 'https://images.pexels.com/photos/1/a.jpg' } },
  { elements: [...filled, ...fillImageItems], cloudName: CLOUD, clientId: CLIENT }
);
assert(answers.extras.blank_0 === 'City Care', 'a known blank keeps its answer');
assert(answers.problems.some((problem) => problem.includes('not a blank this poster offers')), 'an unknown blank is refused');
assert(answers.problems.some((problem) => problem.includes('not a photo this poster offers')), 'an unknown photo blank is refused');
assert(!('pic_9' in answers.images), 'a photo answer for a blank that does not exist is not stored');

const roomy = normalizeElements([fieldElement('headline'), fillText(0)]);
const longAnswer = resolveContentValues(
  { extras: { blank_0: 'x'.repeat(61) } },
  { elements: roomy, cloudName: CLOUD, clientId: CLIENT }
);
assert(longAnswer.problems.join(' ').includes('cannot be longer than 60 characters'), 'an answer too long for its blank is refused');
assert(
  resolveContentValues({ images: { pic_0: 'http://res.cloudinary.com/a.jpg' } }, { elements: fillImageItems, cloudName: CLOUD, clientId: CLIENT })
    .problems.join(' ')
    .includes('secure'),
  'an insecure photo address is refused for a poster too'
);
assert(
  resolveContentValues({ images: { pic_0: 'https://images.pexels.com/photos/1/a.jpg' } }, { elements: fillImageItems, cloudName: CLOUD, clientId: CLIENT })
    .images.pic_0.length > 0,
  'the image library is an accepted source of poster photos'
);
assert(
  resolveContentValues({ extras: 42 }, { elements: filled }).problems.join(' ').includes('labelled values'),
  'filled-in words must be a set of labelled values'
);

const crowdedWords = {};
for (let index = 0; index < 10; index += 1) {
  crowdedWords[`blank_${index}`] = 'y'.repeat(VARIABLE_LIMITS.maxLength.max);
}
const crowdedPhotos = {};
for (let index = 0; index < 4; index += 1) {
  crowdedPhotos[`pic_${index}`] = ownImage + 'z'.repeat(600);
}
assert(
  resolveContentValues(
    {
      extras: crowdedWords,
      images: crowdedPhotos,
    },
    {
      elements: [
        fieldElement('headline'),
        ...Array.from({ length: 10 }, (_, index) => fillText(index, { maxLength: VARIABLE_LIMITS.maxLength.max })),
        ...Array.from({ length: 4 }, (_, index) => fillImage(index)),
      ],
      cloudName: CLOUD,
      clientId: CLIENT,
    }
  )
    .problems.join(' ')
    .includes('too much to fill in'),
  'everything filled into one poster stays inside its size limit'
);
assert(resolveContentValues({}, { elements: filled }).extras === undefined, 'a poster with no answers stores no blank list');
assert(
  variableSlotsOf(elementsOfDesign({ template: { elements: filled } })).texts.length === 1,
  'the blanks are read back out of a poster design snapshot'
);
assert(variableSlotsOf([]).texts.length === 0 && elementsOfDesign(undefined).length === 0, 'an old design snapshot offers no blanks');

// 13. Sections Model: header, footer, content sections, rotation & brand tokens
const validCustomHeader = {
  mode: 'custom',
  height: 120,
  elements: [
    {
      id: 'hdr-title',
      kind: 'text',
      text: 'Annual Charity Gala',
      x: 50,
      y: 20,
      w: 400,
      h: 60,
      style: { size: 36, color: '#ffffff' },
    },
  ],
};

const customSections = {
  header: validCustomHeader,
  content: {
    page: { background: { mode: 'brand' } },
    elements: [fieldElement('headline')],
  },
  footer: {
    mode: 'brand',
    height: 100,
    elements: [],
  },
};

const customHeaderProblems = validateTemplateSections(customSections, { brandKit, template: legacyTemplate, ...urlContext });
assert(customHeaderProblems.length === 0, 'a custom header saves');

const variableInHeaderSections = {
  header: {
    mode: 'custom',
    height: 120,
    elements: [
      {
        id: 'hdr-var',
        kind: 'text',
        text: 'Fill in name',
        variable: true,
        key: 'hdr_name',
        x: 50,
        y: 20,
        w: 300,
        h: 50,
      },
    ],
  },
  content: {
    elements: [fieldElement('headline')],
  },
  footer: { mode: 'brand', height: 80, elements: [] },
};
const varHeaderProblems = validateTemplateSections(variableInHeaderSections, { brandKit, template: legacyTemplate, ...urlContext });
assert(varHeaderProblems.some((p) => p.includes('variable in the header is not allowed')), 'a variable in the header is rejected');

const unknownTokenProblems = validateElements(
  [
    fieldElement('headline', {
      style: { color: 'brand:invalid_token' },
    }),
  ],
  { brandKit, template: legacyTemplate, ...urlContext }
);
assert(unknownTokenProblems.some((p) => p.includes('not a brand color token this app offers')), 'an unknown token is rejected');

// Rotated item outside its section: an element near the top edge rotated 45 deg exceeds bounds
const rotatedOutsideProblems = validateElements(
  [
    fieldElement('headline', {
      x: 0,
      y: 120,
      w: 200,
      h: 80,
      rotation: 45,
    }),
  ],
  { brandKit, template: legacyTemplate, ...urlContext }
);
assert(rotatedOutsideProblems.some((p) => p.includes('must sit fully inside the poster')), 'a rotated item outside its section is rejected');

// Legacy template conversion
const convertedSections = legacyToSections(legacyTemplate, brandKit);
assert(
  convertedSections.header.mode === 'brand' &&
    convertedSections.footer.mode === 'brand' &&
    convertedSections.content.elements.length === 7,
  'a legacy template converts'
);

// Brand text resolution
const brandKitWithContacts = {
  ...brandKit,
  orgName: 'Greenpeace Foundation',
  footer: {
    website: 'greenpeace.org',
    phone: '+1-555-0199',
    email: 'info@greenpeace.org',
    address: '123 Forest Way',
    legalText: 'All rights reserved.',
  },
};
const resolvedBrandText = resolveBrandText(
  'Organized by {{brand.orgName}}. Visit {{brand.website}} or call {{brand.phone}}.',
  brandKitWithContacts
);
assert(
  resolvedBrandText === 'Organized by Greenpeace Foundation. Visit greenpeace.org or call +1-555-0199.',
  'resolveBrandText replaces all brand contact placeholders'
);

// brandHeaderToElements starter items
const starterHeader = brandHeaderToElements(brandKitWithContacts, { width: 1080, height: 1350 });
assert(
  Array.isArray(starterHeader) && starterHeader.length >= 2,
  'brandHeaderToElements returns starter items'
);
assert(
  starterHeader.every((item) => item.locked === false && item.variable === false),
  'brand header starter items are unlocked by default and never variable'
);
assert(
  starterHeader.some((item) => item.src === 'brand:logo' || item.imageUrl === 'brand:logo'),
  'brand header includes logo token item'
);
assert(
  starterHeader.some((item) => item.text === '{{brand.orgName}}'),
  'brand header includes org name token item'
);

// brandFooterToElements starter items
const brandKitWithSocials = {
  ...brandKitWithContacts,
  footer: {
    ...brandKitWithContacts.footer,
    social: [
      { platform: 'facebook', url: 'https://facebook.com/example' },
      { platform: 'instagram', url: 'https://instagram.com/example' },
    ],
  },
};
const starterFooter = brandFooterToElements(brandKitWithSocials, { width: 1080, height: 1350 });
assert(
  Array.isArray(starterFooter) && starterFooter.length >= 2,
  'brandFooterToElements returns starter items'
);
assert(
  starterFooter.every((item) => item.locked === false && item.variable === false),
  'brand footer starter items are unlocked by default and never variable'
);
assert(
  starterFooter.some((item) => item.kind === 'text' && item.text.includes('{{brand.website}}')),
  'brand footer includes contact text item with brand tokens'
);
assert(
  starterFooter.some((item) => item.kind === 'icon' && item.name === 'facebook'),
  'brand footer includes social icons from brand links'
);

// Card lists validation & limits
const validCardList = {
  id: 'cardlist-1',
  kind: 'cardlist',
  key: 'speakers',
  label: 'Featured Speakers',
  hint: 'Our keynotes',
  columns: 2,
  gapX: 16,
  gapY: 16,
  minCount: 1,
  maxCount: 4,
  align: 'left',
  card: {
    w: 300,
    h: 150,
    fields: [
      { key: 'name', type: 'text', label: 'Speaker Name', maxLength: 60 },
      { key: 'role', type: 'text', label: 'Speaker Role', maxLength: 40 },
      { key: 'photo', type: 'image', label: 'Speaker Photo' },
    ],
    items: [
      { id: 'c-name', kind: 'text', text: '{{name}}', x: 10, y: 10, w: 200, h: 30 },
      { id: 'c-photo', kind: 'image', fieldKey: 'photo', x: 220, y: 10, w: 70, h: 70 },
    ],
  },
};

const normList = normalizeElement(validCardList);
assert(normList.kind === 'cardlist' && normList.key === 'speakers', 'cardlist normalizes kind and key');
assert(normList.columns === 2 && normList.card.fields.length === 3, 'cardlist normalizes columns and fields');

const baseContentElements = [fieldElement('headline')];
const listValidationProblems = validateElements([...baseContentElements, validCardList]);
assert(listValidationProblems.length === 0, 'valid card list has no validation problems');

// 1. Field limit: max 6 fields in a card
const tooManyFieldsCard = {
  ...validCardList,
  card: {
    ...validCardList.card,
    fields: Array.from({ length: 7 }, (_, i) => ({ key: `f_${i}`, type: 'text', label: `Field ${i}` })),
  },
};
const fieldLimitProblems = validateElements([...baseContentElements, tooManyFieldsCard]);
assert(
  fieldLimitProblems.some((p) => p.includes('at most 6 fields')),
  'card with 7 fields is rejected (max 6 fields)'
);

// 2. Card list count: max 12 card lists
const twelveCardLists = Array.from({ length: 12 }, (_, i) => ({
  ...validCardList,
  id: `cardlist-${i + 1}`,
  key: `list_${i + 1}`,
}));
assert(
  validateElements([...baseContentElements, ...twelveCardLists]).length === 0,
  'template with 12 card lists is valid'
);

const thirteenCardLists = Array.from({ length: 13 }, (_, i) => ({
  ...validCardList,
  id: `cardlist-${i + 1}`,
  key: `list_${i + 1}`,
}));
const thirteenProblems = validateElements([...baseContentElements, ...thirteenCardLists]);
assert(
  thirteenProblems.some((p) => p.includes('at most 12 card lists')),
  'template with 13 card lists is rejected'
);

// 3. Header/footer cannot contain card lists
const headerWithList = validateElements([validCardList], { section: 'header' });
assert(
  headerWithList.some((p) => p.includes('cannot contain a card list')),
  'card list in header is rejected'
);

// 4. Content.lists resolution
const validListContent = {
  lists: {
    speakers: [
      { name: 'Dr. Jane Smith', role: 'Chief Scientist', photo: ownImage },
    ],
  },
};
const listRes = resolveContentValues(validListContent, {
  elements: [...baseContentElements, validCardList],
  cloudName: CLOUD,
  clientId: CLIENT,
});
assert(listRes.problems.length === 0, 'valid content.lists resolves cleanly');
assert(listRes.lists.speakers.length === 1 && listRes.lists.speakers[0].name === 'Dr. Jane Smith', 'content.lists values are preserved');

// 5. Unknown list key rejected
const unknownListContent = {
  lists: {
    sponsors: [{ name: 'Acme Corp' }],
  },
};
const unknownListRes = resolveContentValues(unknownListContent, {
  elements: [...baseContentElements, validCardList],
  cloudName: CLOUD,
  clientId: CLIENT,
});
assert(
  unknownListRes.problems.some((p) => p.includes('not a list this poster offers')),
  'unknown list key is rejected'
);

// 6. List count bounds enforced
const emptyListContent = {
  lists: {
    speakers: [],
  },
};
const emptyListRes = resolveContentValues(emptyListContent, {
  elements: [...baseContentElements, validCardList],
  cloudName: CLOUD,
  clientId: CLIENT,
});
assert(
  emptyListRes.problems.some((p) => p.includes('at least 1 item')),
  'list count below minCount is rejected'
);

const tooManyItemsContent = {
  lists: {
    speakers: Array.from({ length: 5 }, (_, i) => ({ name: `Speaker ${i + 1}` })),
  },
};
const tooManyItemsRes = resolveContentValues(tooManyItemsContent, {
  elements: [...baseContentElements, validCardList],
  cloudName: CLOUD,
  clientId: CLIENT,
});
assert(
  tooManyItemsRes.problems.some((p) => p.includes('at most 4 item')),
  'list count above maxCount is rejected'
);

/* ------------------------------------------------------------------------- *
 * BRAND BANDS - the header and footer of the Brand Kit, same shape as a
 * template's own bands.
 * ------------------------------------------------------------------------- */

const bandKit = {
  orgName: 'Water Aid Trust',
  defaultPosterSize: { width: 1080, height: 1350 },
  header: {
    height: 80,
    background: { type: 'color', color: '#0f172a' },
    logo: { show: true, size: 56, position: 'left' },
    orgName: { show: true, text: 'Water Aid Trust' },
    tagline: { show: true, text: 'Clean water since 1998' },
  },
  footer: {
    height: 70,
    background: { type: 'color', color: '#0b0f17' },
    phone: '+91 90000 00000',
    email: 'hello@wa.test',
    website: 'wa.test',
    legalText: '© All rights reserved.',
    social: [{ platform: 'instagram', url: 'https://instagram.com/wa' }],
  },
};

// A kit that has never been laid out is drawn from its own settings and stores no items.
const untouchedHeader = normalizeBrandBand(undefined, 'header', bandKit);
assert(untouchedHeader.mode === 'legacy', 'a kit with no band settings stored is drawn in legacy mode');
assert(untouchedHeader.elements.length === 0, 'a legacy kit stores no band items');
assert(untouchedHeader.height === 80, 'the band takes the height the kit asks for');

// The band editor opens on items converted from those settings, without storing anything.
const starterBand = brandBandForEditing(bandKit, 'header');
assert(starterBand.mode === 'legacy', 'the starter band still draws the kit settings');
assert(starterBand.elements.length === 3, 'the starter header band converts the logo, the name and the tagline');
assert(
  starterBand.elements.every((element) => element.locked === false && element.variable !== true),
  'every starter band item defaults unlocked and none is a space to fill in'
);
assert(
  brandBandForEditing(bandKit, 'footer').elements.length > 0,
  'the starter footer band converts the contact words and the social pictures'
);
assert(
  defaultBrandBands(bandKit).header.elements.some((element) => element.imageUrl === 'brand:logo'),
  'the starter header band points at the brand logo'
);
assert(
  brandBandProblems(starterBand, 'header', { brandKit: bandKit, ...urlContext }).length === 0,
  'starter band items pass the item rules'
);
assert(
  brandBandProblems(brandBandForEditing(bandKit, 'footer'), 'footer', { brandKit: bandKit, ...urlContext }).length === 0,
  'starter footer band items pass the item rules'
);

/* What one poster draws: the template's own band when it asked for one, the Brand Kit's
   otherwise. Header and footer are resolved together because a tall pair must shrink. */
const laidOutKit = {
  ...bandKit,
  footer: { ...bandKit.footer, mode: 'elements', elements: brandBandForEditing(bandKit, 'footer').elements },
};
const laidOutFooter = normalizeBrandBand(undefined, 'footer', laidOutKit);
assert(laidOutFooter.mode === 'elements', 'an items-drawn band keeps its mode');
assert(laidOutFooter.elements.length > 0, 'an items-drawn band keeps its items');

const brandModeTemplate = { size: { width: 1080, height: 1350 }, sections: { header: { mode: 'brand' }, footer: { mode: 'brand' } } };
const customTemplate = {
  size: { width: 1080, height: 1350 },
  sections: {
    header: {
      mode: 'custom',
      height: 120,
      elements: [{ kind: 'text', x: 40, y: 24, w: 400, h: 60, text: 'This design draws its own strip' }],
    },
    footer: { mode: 'brand' },
  },
};

const brandHeader = effectiveBand(bandKit, brandModeTemplate, 'header');
assert(brandHeader.source === 'brand' && brandHeader.mode === 'legacy', 'a template in brand mode takes the Brand Kit band');
assert(brandHeader.height === 80 && brandHeader.y === 0, 'the brand header band sits at the top at the kit height');
assert(brandHeader.elements.length === 0, 'a legacy brand band draws its settings, not items');

const ownHeader = effectiveBand(bandKit, customTemplate, 'header');
assert(ownHeader.source === 'template' && ownHeader.mode === 'elements', 'a template in custom mode draws its own band');
assert(ownHeader.height === 120 && ownHeader.elements.length === 1, 'the template band keeps its own height and items');
assert(effectiveBand(bandKit, customTemplate, 'footer').source === 'brand', 'the other band of the same template still follows the Brand Kit');

const laidOutBand = effectiveBand(laidOutKit, brandModeTemplate, 'footer');
assert(laidOutBand.mode === 'elements' && laidOutBand.elements.length > 0, 'a brand band laid out with items reaches the poster as items');
assert(laidOutBand.elements.every((element) => element.locked === false), 'brand band items reach the poster with editor lock defaults');

// A band on a taller or shorter poster keeps its shape: the footer travels with the poster edge.
const tallPoster = { size: { width: 1080, height: 1920 }, sections: brandModeTemplate.sections };
const tallFooter = effectiveBand(laidOutKit, tallPoster, 'footer');
assert(tallFooter.y === 1920 - tallFooter.height, 'the footer band sits against the bottom of a taller poster');
assert(
  tallFooter.elements.every((element) => element.y >= tallFooter.y),
  'the footer band items travel with the band instead of being left mid-page'
);

// A pair of bands that would leave no room to design in is shrunk, and the strip agrees with it.
const greedyKit = { ...bandKit, header: { ...bandKit.header, height: 200 }, footer: { ...bandKit.footer, height: 260 } };
const smallPoster = { size: { width: 600, height: 600 }, sections: brandModeTemplate.sections };
const greedyBands = resolveBands(greedyKit, smallPoster);
assert(
  greedyBands.header.height + greedyBands.footer.height <= 600 - 120,
  'a pair of tall bands shrinks to leave room between them'
);
const bandArea = contentArea(greedyKit, smallPoster);
assert(bandArea.y === greedyBands.header.height, 'the content strip starts where the header band ends');

/* The brand band rules are the template item rules, so the same refusals apply: no spaces to
   fill in, nothing outside the strip, no empty items-drawn band, no unknown setting. */
const outsideBand = { mode: 'elements', elements: [{ kind: 'text', x: 40, y: 120, w: 300, h: 40, text: 'Below the strip' }] };
assert(
  brandBandProblems(outsideBand, 'header', { brandKit: bandKit, ...urlContext }).some((p) => /inside the header/.test(p)),
  'an item hanging out of the band is refused'
);
const variableBand = {
  mode: 'elements',
  elements: [{ kind: 'text', x: 40, y: 20, w: 300, h: 40, text: 'Fill me in', variable: true, key: 'brand_slot', label: 'Fill me in' }],
};
assert(
  brandBandProblems(variableBand, 'header', { brandKit: bandKit, ...urlContext }).some((p) => /variable in the header is not allowed/.test(p)),
  'a space to fill in on a brand band is refused'
);
assert(
  brandBandProblems({ mode: 'elements', elements: [] }, 'footer', { brandKit: bandKit }).length > 0,
  'an items-drawn band with no items is refused'
);
assert(brandBandProblems({ mode: 'magic' }, 'header', { brandKit: bandKit }).length > 0, 'an unknown way of drawing a band is refused');
assert(
  brandBandProblems({ height: 400 }, 'footer', { brandKit: bandKit }).some((p) => /between 60 and 260/.test(p)),
  'a band taller than it may be is refused'
);
assert(brandBandProblems(undefined, 'header', { brandKit: bandKit }).length === 0, 'saving nothing about a band changes nothing');
assert(
  brandBandProblems(
    {
      mode: 'elements',
      elements: Array.from({ length: 20 }, (_, index) => ({
        kind: 'shape',
        id: `line-${index}`,
        x: 0,
        y: 0,
        w: 20,
        h: 4,
        shape: { type: 'line' },
      })),
    },
    'header',
    { brandKit: bandKit }
  ).some((p) => /at most 15 items/.test(p)),
  'a band holds no more items than a template band may'
);

// Normalizing a band enforces the same rules: unlocked by default, never a fill-in.
const forced = normalizeBrandBand(
  {
    mode: 'elements',
    elements: [{ kind: 'text', x: 40, y: 20, w: 300, h: 40, text: 'Words', variable: true, key: 'brand_slot', label: 'Words?' }],
  },
  'header',
  bandKit
);
assert(forced.elements[0].locked === false, 'a band item is stored unlocked by default');
assert(
  forced.elements[0].variable === false && forced.elements[0].key === undefined && forced.elements[0].label === undefined,
  'a band item is stored without its fill-in name'
);

// -------------------------------------------------------------
// Default colour contrast tests for light and dark backgrounds
// -------------------------------------------------------------
const { pickDefaultTextColor, resolveBackdropAtRect } = await import('../../client/src/utils/templateEditorItems.js');
const { contrastRatio } = await import('../../client/src/utils/contrast.js');

// 1. Light background: white #ffffff
const lightTextChoice = pickDefaultTextColor('#ffffff', { colors: { text: '#111827' } });
assert(
  lightTextChoice === 'brand:text' || lightTextChoice === '#111827',
  'default text colour on light background is dark brand:text or #111827'
);
assert(
  contrastRatio(lightTextChoice === 'brand:text' ? '#111827' : lightTextChoice, '#ffffff') >= 4.5,
  'default text colour on light background has contrast >= 4.5:1'
);

// 2. Dark background: navy #0f172a
const darkTextChoice = pickDefaultTextColor('#0f172a', { colors: { text: '#111827' } });
assert(
  darkTextChoice === '#ffffff',
  'default text colour on dark background is white #ffffff'
);
assert(
  contrastRatio(darkTextChoice, '#0f172a') >= 4.5,
  'default text colour on dark background has contrast >= 4.5:1'
);

// 3. Low contrast brand text falls back to #111827 on light background
const lowContrastKit = { colors: { text: '#e2e8f0' } }; // light gray text
const fallbackChoice = pickDefaultTextColor('#ffffff', lowContrastKit);
assert(
  fallbackChoice === '#111827',
  'low-contrast brand text on light background falls back to dark #111827'
);
assert(
  contrastRatio(fallbackChoice, '#ffffff') >= 4.5,
  'fallback text color has contrast >= 4.5:1'
);

// -------------------------------------------------------------
// Labels, Samples and AI Rules tests
// -------------------------------------------------------------

// 1. generic label rejected
const genericLabelResult = problemsWith([
  fieldElement('headline'),
  fillText(0, { label: 'Heading' }),
]);
assert(
  genericLabelResult.some((p) => p.includes('generic default')),
  'generic label rejected'
);

// 2. duplicate label rejected
const dupLabelResult = problemsWith([
  fieldElement('headline'),
  fillText(0, { label: 'Guest speaker' }),
  fillText(1, { label: 'Guest speaker' }),
]);
assert(
  dupLabelResult.some((p) => p.includes('share the label')),
  'duplicate label rejected'
);

// 3. migration renames old labels
const { migrateTemplateLabels } = await import('../../shared/templateElements.js');
const templateWithOldLabels = {
  elements: [
    fillText(0, { label: 'Heading' }),
    fillText(1, { label: 'Body' }),
    fillImage(0, { label: 'Photo space' }),
  ],
};
const migResult = migrateTemplateLabels(templateWithOldLabels);
assert(migResult.migrated === true && migResult.count === 3, 'migration renames old labels');
assert(templateWithOldLabels.elements[0].label === 'Text 1', 'first old label migrated to Text 1');
assert(templateWithOldLabels.elements[1].label === 'Text 2', 'second old label migrated to Text 2');
assert(templateWithOldLabels.elements[2].label === 'Photo 1', 'image old label migrated to Photo 1');

// 4. duplicated values are blanked
const { sanitizeAndTruncateContent } = await import('../services/ai/schema.js');
const dupAiContent = {
  title: 'Grand Opening Ceremony',
  tagline: 'Grand Opening Ceremony',
  details: ['123 Main St', '123 Main St'],
  extras: {
    speaker: 'Grand Opening Ceremony',
    host: 'Jane Doe',
    sponsor: 'Jane Doe',
    slot_label_copy: 'Speaker Name',
  },
};
const cleanedContent = sanitizeAndTruncateContent(dupAiContent, [
  { key: 'speaker', label: 'Speaker', maxLength: 100 },
  { key: 'host', label: 'Host', maxLength: 100 },
  { key: 'sponsor', label: 'Sponsor', maxLength: 100 },
  { key: 'slot_label_copy', label: 'Speaker Name', maxLength: 100 },
]);
assert(
  cleanedContent.tagline === '' &&
    cleanedContent.details.length === 1 &&
    cleanedContent.extras.speaker === '' &&
    cleanedContent.extras.sponsor === '' &&
    cleanedContent.extras.slot_label_copy === '' &&
    cleanedContent.extras.host === 'Jane Doe',
  'duplicated values are blanked'
);

// 5. samples never appear in poster content
const { captureDesign } = await import('../services/poster/design.js');
const tmplWithSamples = {
  _id: 'templ_sample_123',
  version: 1,
  size: { width: 1080, height: 1350 },
  elements: [
    {
      id: 'text_sample',
      kind: 'text',
      variable: true,
      key: 'spk',
      label: 'Speaker',
      text: 'Sample words',
      sample: 'Dr. Jane Smith',
      sampleImage: 'https://res.cloudinary.com/demo/image/upload/sample.jpg',
      x: 100,
      y: 100,
      w: 300,
      h: 50,
    },
  ],
};
const designSnapshot = captureDesign({
  template: tmplWithSamples,
  brandKit: { colors: { primary: '#2563EB', text: '#111827', background: '#ffffff' } },
});
const snapEl = designSnapshot.template.elements[0];
assert(
  snapEl.sample === undefined && snapEl.sampleImage === undefined,
  'samples never appear in poster content'
);

// 6. AI output contains only labelled items
const mixedForAi = [
  { kind: 'text', variable: true, key: 'k1', label: '' },
  { kind: 'text', variable: true, key: 'k2', label: 'Heading' },
  { kind: 'text', variable: true, key: 'k3', label: 'Special Guest', hint: 'Who is visiting?' },
  { kind: 'text', variable: false, key: 'k4', text: 'Static' },
];
const aiSlots = aiSlotsOf(mixedForAi);
assert(
  aiSlots.length === 1 && aiSlots[0].key === 'k3' && aiSlots[0].label === 'Special Guest',
  'AI output contains only labelled items'
);

console.log(`\nShared template element tests passed: ${passed} assertions`);
