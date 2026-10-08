import assert from 'node:assert/strict';
import { isSamplePlaceholder, resolveItemImage, variableSlotsOf } from '../../shared/templateElements.js';
import { resolvePosterImage } from '../services/images.js';

console.log('🧪 Starting Tests for User-Filled Image Slot in Templates...\n');

// 1. Verify Placeholder Detection
console.log('Test 1: Placeholder text detection');
assert.equal(isSamplePlaceholder('The person filling this in chooses the picture'), true);
assert.equal(isSamplePlaceholder('chooses the picture'), true);
assert.equal(isSamplePlaceholder('SAMPLE LINE ABOVE THE TITLE'), true);
assert.equal(isSamplePlaceholder('https://images.unsplash.com/photo-12345'), false);
console.log('  ✅ PASS: isSamplePlaceholder detects editor image placeholder text.\n');

// 2. Build a template with one user-filled image slot
console.log('Test 2: Template with one user-filled image slot');
const photoSlotTemplate = {
  id: 'template-photo-test',
  name: 'Community Event with Photo',
  size: { width: 1080, height: 1350 },
  editorVersion: 2,
  elements: [
    {
      id: 'item-headline',
      kind: 'field',
      field: 'headline',
      x: 70,
      y: 160,
      w: 940,
      h: 120,
      style: { size: 64 },
    },
    {
      id: 'item-photo-slot',
      kind: 'image',
      variable: true,
      key: 'photo_slot_1',
      label: 'Event Photo',
      hint: 'The person filling this in chooses the picture',
      x: 70,
      y: 320,
      w: 940,
      h: 520,
      style: { fit: 'cover', radius: 16 },
    },
  ],
};

const slots = variableSlotsOf(photoSlotTemplate.elements);
assert.equal(slots.images.length, 1);
assert.equal(slots.images[0].key, 'photo_slot_1');
console.log('  ✅ PASS: Template correctly identifies 1 user-filled image slot.\n');

// 3. Render with a photo URL (uploaded file or pasted link)
console.log('Test 3: Render slot with photo URL');
const testPhotoUrl = 'https://res.cloudinary.com/demo/image/upload/v1234/poster_pic.jpg';
const contentWithPhoto = {
  title: 'Annual Charity Run',
  imageUrl: testPhotoUrl,
  image: testPhotoUrl,
};

const photoItem = photoSlotTemplate.elements[1];
const renderedWithPhoto = resolveItemImage(photoItem, contentWithPhoto, testPhotoUrl, true);

assert.ok(renderedWithPhoto, 'Image slot must NOT be empty when photo URL is provided');
assert.equal(renderedWithPhoto, testPhotoUrl, 'Image slot must receive the photo URL');
assert.ok(
  !String(renderedWithPhoto).includes('chooses the picture'),
  'Placeholder text must never appear in image URL'
);
console.log('  ✅ PASS: Slot correctly receives photo URL and does not show placeholder text.\n');

// 4. Render with NO photo URL
console.log('Test 4: Render slot with no photo URL');
const contentNoPhoto = {
  title: 'Annual Charity Run',
  imageUrl: '',
  image: '',
};

const renderedNoPhoto = resolveItemImage(photoItem, contentNoPhoto, '', true);

assert.equal(renderedNoPhoto, '', 'Image slot must be empty string when no photo is provided (causing Photo to return null and hide slot)');
assert.ok(
  !String(renderedNoPhoto).includes('chooses the picture'),
  'Placeholder text must never appear on generated poster'
);
console.log('  ✅ PASS: Slot is empty/hidden when no photo is provided and placeholder text never appears.\n');

// 5. Template with multiple user image slots
console.log('Test 5: Multiple user image slots');
const multiSlotTemplate = {
  elements: [
    {
      id: 'slot-1',
      kind: 'image',
      variable: true,
      key: 'photo_1',
      style: { fit: 'cover', radius: 8 },
    },
    {
      id: 'slot-2',
      kind: 'image',
      variable: true,
      key: 'photo_2',
      style: { fit: 'cover', radius: 8 },
    },
  ],
};

const firstRender = resolveItemImage(multiSlotTemplate.elements[0], contentWithPhoto, testPhotoUrl, true);
const secondRender = resolveItemImage(multiSlotTemplate.elements[1], contentWithPhoto, testPhotoUrl, false);

assert.equal(firstRender, testPhotoUrl, 'First user-filled slot must receive the poster photo');
assert.equal(secondRender, '', 'Second user-filled slot must remain empty without explicit assignment');

// With explicit secondary photo in content.images
const contentWithBoth = {
  ...contentWithPhoto,
  images: {
    photo_2: 'https://images.unsplash.com/photo-second-slot',
  },
};
const secondWithExplicit = resolveItemImage(multiSlotTemplate.elements[1], contentWithBoth, testPhotoUrl, false);
assert.equal(secondWithExplicit, 'https://images.unsplash.com/photo-second-slot', 'Second slot receives explicitly assigned image');
console.log('  ✅ PASS: Multiple user image slots handled correctly with first slot precedence.\n');

// 6. Test Unsplash resolution fallback when no user photo provided
console.log('Test 6: Automatic event photo resolution when user provides none');
const resolvedPhoto = await resolvePosterImage('Sports Day celebration in school ground', 'Sports Day', 'sports school');
assert.ok(resolvedPhoto?.imageUrl, 'resolvePosterImage must provide photo URL for event');
const renderedWithAutoPhoto = resolveItemImage(photoItem, { title: 'Sports Day', imageUrl: resolvedPhoto.imageUrl }, resolvedPhoto.imageUrl, true);
assert.ok(renderedWithAutoPhoto, 'Slot must receive automatically resolved photo');
assert.equal(renderedWithAutoPhoto, resolvedPhoto.imageUrl);
console.log('  ✅ PASS: Unsplash photo correctly fills user slot when user gives no photo.\n');

console.log('========================================');
console.log('ALL USER IMAGE SLOT TESTS PASSED!');
console.log('========================================');
