import assert from 'node:assert/strict';
import {
  layout,
  stack,
  row,
  grid,
  overlay,
  text,
  image,
  shape,
  icon,
  divider,
  pruneTree,
  isEmptyLeaf,
  normalizePadding,
  normalizeGap,
  estimateTextHeight,
} from '../../shared/layoutEngine.js';

let count = 0;
const test = (desc, fn) => {
  count++;
  try {
    fn();
    console.log(`  ✓ ${desc}`);
  } catch (err) {
    console.error(`  ✗ ${desc}`);
    throw err;
  }
};

console.log('Running Layout Engine Tests...');

// 1. SIZING TESTS (fixed, fill, fit)
test('1. Sizing: fixed sizes, fill sizes, and fit sizes', () => {
  const tree = stack({
    width: 800,
    height: 600,
    padding: 0,
    gap: 0,
    children: [
      text('Fixed Item', { height: 100 }),
      text('Fill Item', { height: 'fill' }),
    ],
  });

  const elements = layout(tree, {
    contentArea: { x: 0, y: 100, w: 1000, h: 1000 },
    margin: 0,
  });

  assert.equal(elements.length, 2);
  // First item has fixed height 100
  assert.equal(elements[0].h, 100);
  assert.equal(elements[0].w, 800);

  // Fill item fills available height (600 - 100 = 500)
  assert.equal(elements[1].h, 500);
  assert.equal(elements[1].w, 800);
  assert.equal(elements[1].y, elements[0].y + 100);
});

// 2. GAP TESTS
test('2. Gap: correct spacing between items in stack, row, and grid', () => {
  // Stack with gap: 30
  const stackTree = stack({
    gap: 30,
    padding: 0,
    children: [
      text('Line 1', { height: 40 }),
      text('Line 2', { height: 40 }),
      text('Line 3', { height: 40 }),
    ],
  });

  const stackEls = layout(stackTree, {
    contentArea: { x: 0, y: 80, w: 1080, h: 1000 },
    margin: 0,
  });

  assert.equal(stackEls.length, 3);
  assert.equal(stackEls[1].y - (stackEls[0].y + stackEls[0].h), 30);
  assert.equal(stackEls[2].y - (stackEls[1].y + stackEls[1].h), 30);

  // Row with gap: 20
  const rowTree = row({
    gap: 20,
    padding: 0,
    children: [
      shape('rect', { width: 100, height: 50 }),
      shape('rect', { width: 100, height: 50 }),
    ],
  });

  const rowEls = layout(rowTree, {
    contentArea: { x: 0, y: 80, w: 1080, h: 1000 },
    margin: 0,
  });

  assert.equal(rowEls.length, 2);
  assert.equal(rowEls[1].x - (rowEls[0].x + rowEls[0].w), 20);

  // Grid with gap: 15
  const gridTree = grid({
    columns: 2,
    gap: 15,
    padding: 0,
    width: 415,
    children: [
      text('Cell 1', { height: 50 }),
      text('Cell 2', { height: 50 }),
      text('Cell 3', { height: 50 }),
      text('Cell 4', { height: 50 }),
    ],
  });

  const gridEls = layout(gridTree, {
    contentArea: { x: 0, y: 80, w: 1080, h: 1000 },
    margin: 0,
  });

  assert.equal(gridEls.length, 4);
  // Column width = (415 - 15) / 2 = 200
  assert.equal(gridEls[0].w, 200);
  assert.equal(gridEls[1].w, 200);
  assert.equal(gridEls[1].x - (gridEls[0].x + gridEls[0].w), 15);
  assert.equal(gridEls[2].y - (gridEls[0].y + gridEls[0].h), 15);
});

// 3. PADDING TESTS
test('3. Padding: insets children on all 4 sides', () => {
  const tree = stack({
    padding: { top: 25, right: 30, bottom: 35, left: 40 },
    width: 600,
    children: [
      shape('rect', { height: 50 }),
    ],
  });

  const elements = layout(tree, {
    contentArea: { x: 100, y: 200, w: 800, h: 800 },
    margin: 0,
  });

  assert.equal(elements.length, 1);
  assert.equal(elements[0].x, 100 + 40); // origin 100 + left padding 40
  assert.equal(elements[0].y, 200 + 25); // origin 200 + top padding 25
  assert.equal(elements[0].w, 600 - 40 - 30); // 600 - left 40 - right 30 = 530
  assert.equal(elements[0].h, 50);
});

// 4. MIN AND MAX CONSTRAINTS
test('4. Min and max: clamps widths and heights within bounds', () => {
  const tree = stack({
    children: [
      shape('rect', { width: 50, minWidth: 120 }), // width 50 < minWidth 120 -> 120
      shape('rect', { width: 900, maxWidth: 500 }), // width 900 > maxWidth 500 -> 500
      shape('rect', { height: 10, minHeight: 60 }), // height 10 < minHeight 60 -> 60
      shape('rect', { height: 800, maxHeight: 250 }), // height 800 > maxHeight 250 -> 250
    ],
  });

  const elements = layout(tree, {
    contentArea: { x: 0, y: 0, w: 1080, h: 1000 },
    margin: 0,
  });

  assert.equal(elements[0].w, 120);
  assert.equal(elements[1].w, 500);
  assert.equal(elements[2].h, 60);
  assert.equal(elements[3].h, 250);
});

// 5. FLEX-GROW TESTS
test('5. Flex-grow: distributes leftover vertical space so there are no large gaps', () => {
  const tree = stack({
    height: 800,
    padding: 0,
    gap: 0,
    children: [
      text('Header Title', { height: 100, flexGrow: 0 }),
      image('https://res.cloudinary.com/demo/image/upload/sample.jpg', {
        height: 200,
        flexGrow: 2,
      }),
      text('Event Description', {
        height: 100,
        flexGrow: 1,
      }),
    ],
  });

  const elements = layout(tree, {
    contentArea: { x: 0, y: 80, w: 1080, h: 800 },
    margin: 0,
  });

  assert.equal(elements.length, 3);

  // Total base height = 100 + 200 + 100 = 400
  // Leftover vertical space = 800 - 400 = 400
  // Total flexGrow = 2 + 1 = 3
  // Child 1 (flex 2) gets 400 * (2/3) = 267 -> 200 + 267 = 467
  // Child 2 (flex 1) gets 400 * (1/3) = 133 -> 100 + 133 = 233
  assert.equal(elements[0].h, 100);
  assert.equal(elements[1].h, 467);
  assert.equal(elements[2].h, 233);
  assert.equal(elements[0].h + elements[1].h + elements[2].h, 800);
});

// 6. EMPTY-LEAF REMOVAL
test('6. Empty-leaf removal: empty text, images, and icons are filtered out', () => {
  const tree = stack({
    children: [
      text('Visible Title'),
      text(''), // Empty string
      text('   '), // Whitespace only
      text([]), // Empty array
      image(''), // Empty image URL
      icon(''), // Empty icon name
      image('https://res.cloudinary.com/demo/image/upload/hero.jpg'),
    ],
  });

  const elements = layout(tree, {
    contentArea: { x: 0, y: 80, w: 1080, h: 1000 },
    margin: 0,
  });

  assert.equal(elements.length, 2);
  assert.equal(elements[0].kind, 'text');
  assert.equal(elements[0].text, 'Visible Title');
  assert.equal(elements[1].kind, 'image');
  assert.equal(elements[1].imageUrl, 'https://res.cloudinary.com/demo/image/upload/hero.jpg');
});

// 7. CONTAINER COLLAPSING
test('7. Collapsing: container whose children are all empty collapses completely', () => {
  const tree = stack({
    children: [
      text('Event Title'),
      row({
        background: { fill: 'brand:secondary' },
        children: [
          text('', { key: 'venue' }),
          divider(),
          text('', { key: 'time' }),
        ],
      }),
      text('Call to Action'),
    ],
  });

  const elements = layout(tree, {
    contentArea: { x: 0, y: 80, w: 1080, h: 1000 },
    margin: 0,
  });

  // The row container should completely collapse: no background shape, no divider, no empty boxes!
  assert.equal(elements.length, 2);
  assert.equal(elements[0].text, 'Event Title');
  assert.equal(elements[1].text, 'Call to Action');
});

// 8. OUTPUT STAYS INSIDE CONTENT AREA (NEVER HEADER OR FOOTER)
test('8. Content Area Boundaries: output elements never touch header or footer zones', () => {
  const headerHeight = 90;
  const footerHeight = 80;
  const posterWidth = 1080;
  const posterHeight = 1350;

  const mockBrandKit = {
    header: { height: headerHeight },
    footer: { height: footerHeight },
  };
  const mockTemplate = {
    size: { width: posterWidth, height: posterHeight },
  };

  const tree = stack({
    height: 2000, // Deliberately huge height to test boundary safety
    children: [
      shape('rect', { height: 500 }),
      shape('rect', { height: 800 }),
      shape('rect', { height: 900 }),
    ],
  });

  const elements = layout(tree, {
    brandKit: mockBrandKit,
    template: mockTemplate,
  });

  assert.ok(elements.length > 0);

  const expectedContentY = headerHeight;
  const expectedContentMaxY = posterHeight - footerHeight;

  for (const el of elements) {
    // Top boundary check: element must start AT OR AFTER header zone
    assert.ok(
      el.y >= expectedContentY,
      `Element ${el.id} y=${el.y} encroaches into header zone (headerHeight=${expectedContentY})`
    );

    // Bottom boundary check: element bottom must be AT OR BEFORE footer zone
    assert.ok(
      el.y + el.h <= expectedContentMaxY,
      `Element ${el.id} bottom=${el.y + el.h} encroaches into footer zone (footerStart=${expectedContentMaxY})`
    );

    // Left and right bounds check
    assert.ok(el.x >= 0, `Element ${el.id} x=${el.x} is negative`);
    assert.ok(el.x + el.w <= posterWidth, `Element ${el.id} right=${el.x + el.w} exceeds width ${posterWidth}`);
  }
});

// 9. DETERMINISM: SAME INPUT GIVES SAME OUTPUT
test('9. Determinism: identical input trees produce identical element arrays', () => {
  const buildSample = () =>
    stack({
      padding: 24,
      gap: 16,
      children: [
        text('Annual Cultural Festival', { role: 'heading' }),
        row({
          gap: 12,
          children: [
            icon('calendar'),
            text('25 Dec 2026'),
            divider(),
            icon('clock'),
            text('6:00 PM'),
          ],
        }),
        overlay({
          children: [
            shape('rect', { fill: 'brand:secondary', radius: 12 }),
            text('Special Guest Performance', { align: 'center' }),
          ],
        }),
      ],
    });

  const run1 = layout(buildSample(), {
    contentArea: { x: 0, y: 80, w: 1080, h: 1200 },
    margin: 40,
  });

  const run2 = layout(buildSample(), {
    contentArea: { x: 0, y: 80, w: 1080, h: 1200 },
    margin: 40,
  });

  assert.deepEqual(run1, run2, 'Layout engine must be 100% deterministic');
});

console.log(`\nAll ${count} Layout Engine tests passed!`);
