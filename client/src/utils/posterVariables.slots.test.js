import { describe, it, expect } from 'vitest';
import {
  blanksOfDesign,
  blankPayloadOf,
  carriedBlanks,
  defaultPicturesOf,
  imageOfBlank,
  withPosterPhotoSlot,
  withSlotDefaults,
} from './posterVariables.js';

/* ------------------------------------------------------------------ *
 * The three things a picture space can hold, kept apart:
 *   - the example the designer left in the layout,
 *   - the picture this poster answered with,
 *   - nothing at all.
 * ------------------------------------------------------------------ */

const SAMPLE = 'https://images.pexels.com/photos/1000/sample.jpg';
const FIRST = 'https://images.pexels.com/photos/2000/first.jpg';
const CHOSEN = 'https://images.unsplash.com/photo-3000?w=1000';

const picture = (key, extra = {}) => ({
  id: `pic-${key}`,
  kind: 'image',
  variable: true,
  key,
  label: `Picture ${key}`,
  x: 60,
  y: 320,
  w: 420,
  h: 320,
  z: 2,
  ...extra,
});

const words = (key, extra = {}) => ({
  id: `txt-${key}`,
  kind: 'text',
  variable: true,
  key,
  label: `Words ${key}`,
  text: 'e.g. Chief guest',
  x: 60,
  y: 220,
  w: 420,
  h: 48,
  z: 1,
  ...extra,
});

const design = (items) => ({ template: { editorVersion: 2, elements: items } });

describe('what a picture space holds', () => {
  it('keeps the designer example apart from the poster answer', () => {
    const slots = blanksOfDesign(
      design([words('who'), picture('hero', { imageUrl: SAMPLE, hint: 'A wide stage photo' })]),
    );
    expect(slots.texts[0].placeholder).toBe('e.g. Chief guest');
    expect(slots.images[0].sampleUrl).toBe(SAMPLE);
    expect(slots.images[0].hint).toBe('A wide stage photo');
    /* An example picture has no say over what the poster draws. */
    expect(slots.images[0].placeholder).toBeUndefined();
  });

  it('starts a new poster with every picture space empty', () => {
    const slots = blanksOfDesign(design([picture('hero', { imageUrl: SAMPLE })]));
    expect(defaultPicturesOf(design([picture('hero', { imageUrl: SAMPLE })]))).toEqual({});
    const content = { title: 'City Care Drive', images: {} };
    expect(withSlotDefaults(content, design([picture('hero', { imageUrl: SAMPLE })]))).toEqual(content);
    expect(slots.images[0].defaultImage).toBe(false);
  });

  it('uses a ticked example as the starting picture, and never over an answer', () => {
    const ticked = design([picture('hero', { imageUrl: SAMPLE, defaultImage: true })]);
    expect(defaultPicturesOf(ticked)).toEqual({ hero: SAMPLE });
    expect(withSlotDefaults({ title: 'X', images: {} }, ticked).images).toEqual({ hero: SAMPLE });
    expect(withSlotDefaults({ title: 'X', images: { hero: CHOSEN } }, ticked).images).toEqual({
      hero: CHOSEN,
    });
    /* A space left blank, or emptied again on the screen, is filled once when the poster begins. */
    expect(withSlotDefaults({ title: 'X', images: { hero: '' } }, ticked).images).toEqual({
      hero: SAMPLE,
    });
  });

  it('refuses a sample picture from somewhere it cannot come from', () => {
    const ticked = design([picture('hero', { imageUrl: SAMPLE, defaultImage: true })]);
    expect(Object.keys(defaultPicturesOf(ticked))).toEqual(['hero']);
    const smuggled = design([picture('hero', { imageUrl: 'data:image/png;base64,AAAA', defaultImage: true })]);
    expect(defaultPicturesOf(smuggled)).toEqual({});
    const unticked = design([picture('hero', { imageUrl: 'data:image/png;base64,AAAA' })]);
    expect(defaultPicturesOf(unticked)).toEqual({});
  });

  it('puts the poster picture in the first empty space and never on top of another answer', () => {
    const target = design([picture('hero'), picture('stage')]);
    const filled = withPosterPhotoSlot({ title: 'X', images: {} }, target, FIRST, '');
    expect(filled.images).toEqual({ hero: FIRST });

    /* A picture chosen for that space itself is left alone. */
    const held = { title: 'X', images: { hero: CHOSEN } };
    expect(withPosterPhotoSlot(held, target, FIRST, '')).toBe(held);

    /* The poster changes its picture: only the space holding the old one follows. */
    expect(withPosterPhotoSlot(filled, target, CHOSEN, FIRST).images).toEqual({ hero: CHOSEN });

    /* The poster picture goes away: only what this rule put there is taken back out. */
    const emptied = withPosterPhotoSlot({ title: 'X', images: { hero: CHOSEN } }, target, '', CHOSEN);
    expect(emptied.images).toEqual({});
    const untouched = { title: 'X', images: { hero: CHOSEN } };
    expect(withPosterPhotoSlot(untouched, target, '', FIRST)).toBe(untouched);
  });
});

describe('moving a poster to another layout', () => {
  const from = design([words('who'), words('note'), picture('hero'), picture('stage')]);
  const to = design([words('who'), picture('hero'), picture('portrait')]);
  const answered = {
    title: 'City Care Drive',
    extras: { who: 'Dr. Rao', note: 'Doors open 6 pm' },
    images: { hero: CHOSEN, stage: FIRST },
  };

  it('keeps only what was written or chosen for a space both layouts have', () => {
    const moved = carriedBlanks(answered, from, to);
    expect(moved.extras).toEqual({ who: 'Dr. Rao' });
    expect(moved.images).toEqual({ hero: CHOSEN });
    expect(moved.title).toBe('City Care Drive');
  });

  it('starts empty when the other layout names its spaces differently', () => {
    const elsewhere = design([words('speaker'), picture('backdrop')]);
    const moved = carriedBlanks(answered, from, elsewhere);
    expect(moved.extras).toEqual({});
    expect(moved.images).toEqual({});
  });

  it('then offers only the ticked defaults of the new layout', () => {
    const withDefault = design([
      words('who'),
      picture('hero'),
      picture('portrait', { imageUrl: SAMPLE, defaultImage: true }),
    ]);
    const moved = withSlotDefaults(carriedBlanks(answered, from, withDefault), withDefault);
    expect(moved.extras).toEqual({ who: 'Dr. Rao' });
    expect(moved.images).toEqual({ hero: CHOSEN, portrait: SAMPLE });
  });
});

describe('what Save stores, and what an already saved poster shows', () => {
  const target = design([
    words('who'),
    picture('hero', { imageUrl: SAMPLE }),
    picture('stage', { imageUrl: SAMPLE }),
  ]);

  it('stores only the spaces this poster\'s own layout has', () => {
    const content = {
      title: 'City Care Drive',
      extras: { who: 'Dr. Rao', speaker: 'left over from another layout' },
      images: { hero: CHOSEN, stage: FIRST, backdrop: SAMPLE, portrait: '' },
    };
    expect(blankPayloadOf(content, target)).toEqual({
      extras: { who: 'Dr. Rao' },
      images: { hero: CHOSEN, stage: FIRST },
    });
  });

  it('stores nothing at all when every space was left empty', () => {
    const fresh = withSlotDefaults({ title: 'Second poster', extras: {}, images: {} }, target);
    expect(blankPayloadOf(fresh, target)).toEqual({});
    expect(JSON.stringify(blankPayloadOf(fresh, target))).not.toContain('sample.jpg');
  });

  it('stores a ticked example only when the poster really begins with one', () => {
    const ticked = design([picture('hero', { imageUrl: SAMPLE, defaultImage: true })]);
    expect(blankPayloadOf(withSlotDefaults({ title: 'A', images: {} }, ticked), ticked)).toEqual({
      images: { hero: SAMPLE },
    });
    /* Once it is on the screen somebody can take it out, and that is what gets stored. */
    const takenOut = { title: 'A', images: {} };
    expect(blankPayloadOf(takenOut, ticked)).toEqual({});
  });

  it('reads a saved poster back exactly as it was filled in', () => {
    const saved = { title: 'Old poster', extras: { who: 'Dr. Rao' }, images: { hero: CHOSEN } };
    expect(imageOfBlank(saved, 'hero')).toBe(CHOSEN);
    expect(imageOfBlank(saved, 'stage')).toBe('');
    expect(imageOfBlank({ title: 'Old poster' }, 'hero')).toBe('');
    /* The layout example is a separate thing, so redrawing the poster cannot pull it in. */
    const slots = blanksOfDesign(target);
    expect(slots.images.map((slot) => slot.sampleUrl)).toEqual([SAMPLE, SAMPLE]);
    expect(slots.images.map((slot) => slot.placeholder)).toEqual([undefined, undefined]);
  });

  it('leaves a text space empty on a new poster, the example words being only a hint', () => {
    expect(imageOfBlank({}, 'hero')).toBe('');
    const slots = blanksOfDesign(target);
    expect(slots.texts[0].placeholder).toBe('e.g. Chief guest');
    expect(withSlotDefaults({ title: 'Second poster' }, target).extras).toBeUndefined();
  });
});
