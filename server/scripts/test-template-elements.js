/**
 * Plain Node check of the shared editor rules: no server, no database, no browser.
 * Run with `npm run test:elements`.
 */
import {
  BAND_HEIGHTS,
  EDITOR_VERSION,
  ELEMENT_LIMITS,
  VARIABLE_LIMITS,
  aiSlotsOf,
  checkElementImageUrl,
  contentArea,
  elementsOfDesign,
  jsonBytes,
  legacyToElements,
  normalizeElements,
  plainText,
  resolveContentValues,
  tenantImagePrefix,
  validateElements,
  variableSlotsOf,
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
    y: 300 + index * 90,
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
  return {
    id: `fill-image-${index}`,
    kind: 'image',
    x: 70,
    y: 700 + index * 120,
    w: 300,
    h: 80,
    variable: true,
    key: `pic_${index}`,
    label: `Picture ${index}`,
    ...overrides,
  };
}

assert(problemsWith([fieldElement('headline'), ...Array.from({ length: 10 }, (_, i) => fillText(i))]).length === 0, 'ten fill-in texts are allowed');
assert(
  problemsWith([
    fieldElement('headline'),
    ...Array.from({ length: 10 }, (_, i) => fillText(i)),
    fillText(10, { id: 'fill-10', key: 'blank_10' }),
  ])
    .join(' ')
    .includes('at most 10 texts to be filled in'),
  'an eleventh fill-in text is refused'
);
assert(problemsWith([fieldElement('headline'), ...Array.from({ length: 4 }, (_, i) => fillImage(i))]).length === 0, 'four fill-in photos are allowed');
assert(
  problemsWith([
    fieldElement('headline'),
    ...Array.from({ length: 4 }, (_, i) => fillImage(i)),
    fillImage(4, { id: 'fill-image-4', key: 'pic_4' }),
  ])
    .join(' ')
    .includes('at most 4 photos to be replaced'),
  'a fifth fill-in photo is refused'
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

console.log(`\nShared template element tests passed: ${passed} assertions`);
