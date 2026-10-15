import { describe, expect, it } from 'vitest';
import mongoose from 'mongoose';
import { elementSchema } from '../../server/models/Template.model.js';
import { VARIABLE_LIMITS } from '../../shared/templateElements.js';

/* A miniature can only show a space's own words and picture if storing the design keeps them.
   Mongoose drops any key the schema does not name, so these two are the whole contract. */
const Probe =
  mongoose.models.TemplateSlotProbe ||
  mongoose.model('TemplateSlotProbe', new mongoose.Schema({ items: [elementSchema] }));

function stored(item) {
  return new Probe({ items: [item] }).toObject().items[0];
}

const blank = { id: 'text-1', kind: 'text', x: 60, y: 240, w: 600, h: 60, variable: true, key: 'text1' };
const space = {
  id: 'photo-1',
  kind: 'image',
  x: 60,
  y: 320,
  w: 400,
  h: 300,
  variable: true,
  key: 'photo1',
};

describe('a fill-in space keeps what it shows before anyone fills it', () => {
  it('keeps the words of a text blank', () => {
    expect(stored({ ...blank, label: 'Text 1', sample: 'Small line copy' }).sample).toBe('Small line copy');
  });

  it('keeps the picture of a photo space', () => {
    const kept = stored({
      ...space,
      label: 'Photo space 1',
      sampleImage: 'https://images.unsplash.com/photo-1.jpg',
      defaultImage: true,
    });
    expect(kept.sampleImage).toBe('https://images.unsplash.com/photo-1.jpg');
    expect(kept.defaultImage).toBe(true);
  });

  it('refuses sample words longer than the shared limit', () => {
    const doc = new Probe({
      items: [{ ...blank, sample: 'x'.repeat(VARIABLE_LIMITS.sampleChars + 1) }],
    });
    expect(doc.validateSync()?.errors?.['items.0.sample']).toBeTruthy();
  });
});
