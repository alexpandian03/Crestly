import { describe, expect, it } from 'vitest';
import { updateBrandKitSchema } from '../../server/validation/brandKit.schema.js';

const CLIENT_ID = '507f1f77bcf86cd799439011';
const SIZE = { width: 1080, height: 1350 };

const schema = () => updateBrandKitSchema({ clientId: CLIENT_ID, size: SIZE });

const textBox = (y, h) => ({
  id: 'header-4',
  kind: 'text',
  x: 60,
  y,
  w: 600,
  h,
  text: 'Annual Community Fair',
  style: { size: 40 },
});

const parse = (band, kind) => {
  const result = schema().safeParse({ [kind]: band });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
};

describe('a brand kit band keeps the height its items were placed on', () => {
  it('accepts an item that fits the taller band the admin chose', () => {
    const issues = parse(
      { mode: 'elements', height: 112, elements: [textBox(40, 70)] },
      'header',
    );

    expect(issues).toEqual([]);
  });

  it('still refuses an item that hangs below the band it was given', () => {
    const issues = parse(
      { mode: 'elements', height: 112, elements: [textBox(60, 70)] },
      'header',
    );

    expect(issues.join(' ')).toMatch(/inside the header/);
  });

  it('judges the footer by its own height too', () => {
    /* A footer's items sit where the band is on the poster, i.e. near its bottom edge. */
    const tall = { mode: 'elements', height: 160, elements: [textBox(1200, 130)] };
    expect(parse(tall, 'footer')).toEqual([]);

    /* The default footer is 70 tall, so the same item only fits a band made taller. */
    expect(parse({ ...tall, height: undefined }, 'footer').join(' ')).toMatch(/inside the footer/);
  });
});
