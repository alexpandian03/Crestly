import { describe, it, expect } from 'vitest';
import { BAND_HEIGHTS, legacyToSections } from '../../../shared/templateElements.js';
import {
  bandToCustomize,
  borrowedBandPieces,
  brandLayerTemplate,
  changedBrandBands,
  editingTemplateFromKit,
  itemsOfTemplate,
  kitBandIsLaidOut,
  pickSampleTemplate,
  resetBandPayload,
  withKitBands,
} from './brandBands.js';

const SIZE = { width: 1080, height: 1350 };

/** A kit that has never been laid out: its header and footer are drawn from its own settings. */
const settingsKit = {
  orgName: 'Water Aid Trust',
  defaultPosterSize: SIZE,
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

const starterHeader = editingTemplateFromKit(settingsKit, SIZE).sections.header;

/** The same organization after somebody arranged its header by hand. */
const laidOutKit = {
  ...settingsKit,
  header: { mode: 'elements', height: 96, elements: starterHeader.elements, background: starterHeader.background },
};

const brandTemplate = { size: SIZE, sections: { header: { mode: 'brand' }, footer: { mode: 'brand' } } };

/** Sample layouts to borrow words from while the bands are being placed. */
const withItems = {
  id: 'a',
  name: 'Placed layout',
  size: SIZE,
  elements: [{ kind: 'text', x: 80, y: 200, w: 600, h: 80, text: 'Hello' }],
};
const otherSize = { id: 'b', name: 'Story', size: { width: 1080, height: 1920 }, elements: [] };
const emptyMatch = { id: 'c', name: 'Plain', size: SIZE, elements: [] };

describe('withKitBands', () => {
  it('leaves a kit that was never laid out drawing its settings', () => {
    const sections = legacyToSections(brandTemplate, settingsKit);
    const next = withKitBands(sections, settingsKit, brandTemplate);
    expect(next.header.mode).toBe('brand');
    expect(next.footer.mode).toBe('brand');
    expect(next.header.elements || []).toEqual([]);
  });

  it('draws a laid-out kit from its own items', () => {
    const sections = legacyToSections(brandTemplate, laidOutKit);
    const next = withKitBands(sections, laidOutKit, brandTemplate);
    expect(next.header.mode).toBe('custom');
    expect(next.header.height).toBe(96);
    expect(next.header.elements.length).toBe(starterHeader.elements.length);
    expect(next.footer.mode).toBe('brand');
  });

  it('never overrides a band the template customized', () => {
    const ownItem = [{ kind: 'text', x: 40, y: 20, w: 400, h: 40, text: 'This design only' }];
    const template = {
      ...brandTemplate,
      sections: { header: { mode: 'custom', height: 120, elements: ownItem }, footer: { mode: 'brand' } },
    };
    const next = withKitBands(legacyToSections(template, laidOutKit), laidOutKit, template);
    expect(next.header.mode).toBe('custom');
    expect(next.header.height).toBe(120);
    expect(next.header.elements.map((item) => item.text)).toEqual(['This design only']);
  });
});

describe('kitBandIsLaidOut', () => {
  it('is only true for a band with items of its own', () => {
    expect(kitBandIsLaidOut(settingsKit, 'header')).toBe(false);
    expect(kitBandIsLaidOut(laidOutKit, 'header')).toBe(true);
    expect(kitBandIsLaidOut(laidOutKit, 'footer')).toBe(false);
    expect(kitBandIsLaidOut(laidOutKit, 'content')).toBe(false);
    expect(kitBandIsLaidOut(null, 'header')).toBe(false);
  });
});

describe('bandToCustomize', () => {
  it('copies the organization\'s own pieces onto a band that followed it', () => {
    const taken = bandToCustomize(settingsKit, 'header', {
      size: SIZE,
      current: { mode: 'brand', elements: [] },
    });
    expect(taken.mode).toBe('custom');
    expect(taken.height).toBe(80);
    expect(taken.background).toEqual({ type: 'color', color: '#0f172a' });
    expect(taken.elements.map((item) => item.id)).toEqual([
      'brand-header-logo',
      'brand-header-name',
      'brand-header-tagline',
    ]);
  });

  it('copies what the organization arranged by hand when it has', () => {
    const handPlaced = { kind: 'text', x: 300, y: 22, w: 500, h: 40, text: 'Placed by hand' };
    const kit = {
      ...settingsKit,
      header: {
        mode: 'elements',
        height: 96,
        elements: [handPlaced],
        background: settingsKit.header.background,
      },
    };
    const taken = bandToCustomize(kit, 'header', { size: SIZE, current: { mode: 'brand' } });
    expect(taken.height).toBe(96);
    expect(taken.elements.map((item) => item.text)).toEqual(['Placed by hand']);
  });

  it('leaves a band that is already the design\'s own exactly as it is', () => {
    expect(
      bandToCustomize(settingsKit, 'header', {
        size: SIZE,
        current: { mode: 'custom', height: 120, elements: [{ kind: 'text', text: 'Mine' }] },
      }),
    ).toBe(null);
  });

  it('has nothing to take over in the middle of the poster', () => {
    expect(bandToCustomize(settingsKit, 'content', { size: SIZE })).toBe(null);
    expect(bandToCustomize(null, 'header', { size: SIZE })).toBe(null);
  });
});

describe('borrowedBandPieces', () => {
  it('puts a frame where the organization paints its logo and name', () => {
    const borrowed = borrowedBandPieces(settingsKit, {
      header: { mode: 'brand', elements: [] },
      footer: { mode: 'brand', elements: [] },
    }, SIZE);
    expect(borrowed.header.map((item) => item.id)).toEqual([
      'brand-header-logo',
      'brand-header-name',
      'brand-header-tagline',
    ]);
    expect(borrowed.footer.length).toBeGreaterThan(0);
  });

  it('borrows nothing from a band this design already owns', () => {
    const own = { mode: 'custom', elements: [{ kind: 'text', x: 40, y: 20, w: 300, h: 40, text: 'Mine' }] };
    expect(borrowedBandPieces(settingsKit, { header: own, footer: own }, SIZE)).toEqual({});
  });

  it('waits for a design and a brand kit to exist', () => {
    expect(borrowedBandPieces(settingsKit, null, SIZE)).toEqual({});
    expect(borrowedBandPieces(null, { header: { mode: 'brand' } }, SIZE)).toEqual({});
  });
});

describe('editingTemplateFromKit', () => {
  it('opens both bands with something to move and an empty middle', () => {
    const draft = editingTemplateFromKit(settingsKit, SIZE);
    expect(draft.size).toEqual(SIZE);
    expect(draft.sections.header.elements.length).toBeGreaterThan(0);
    expect(draft.sections.footer.elements.length).toBeGreaterThan(0);
    expect(draft.sections.header.elements.every((item) => item.locked === false)).toBe(true);
    expect(draft.sections.content.elements).toEqual([]);
  });

  it('keeps items a kit already placed instead of converting the settings again', () => {
    const draft = editingTemplateFromKit(laidOutKit, SIZE);
    expect(draft.sections.header.height).toBe(96);
    expect(draft.sections.header.elements).toEqual(starterHeader.elements);
  });
});

describe('changedBrandBands', () => {
  it('sends nothing when neither band moved', () => {
    const draft = editingTemplateFromKit(settingsKit, SIZE);
    const same = editingTemplateFromKit(settingsKit, SIZE);
    expect(changedBrandBands(same.sections, draft.sections)).toEqual({});
  });

  it('sends only the band that changed', () => {
    const draft = editingTemplateFromKit(settingsKit, SIZE);
    const moved = {
      ...draft.sections,
      header: { ...draft.sections.header, height: 110, elements: draft.sections.header.elements.slice(0, 1) },
    };
    const payload = changedBrandBands(moved, draft.sections);
    expect(Object.keys(payload)).toEqual(['header']);
    expect(payload.header.mode).toBe('elements');
    expect(payload.header.height).toBe(110);
    expect(payload.header.elements.length).toBe(1);
  });

  it('sends the band back to settings when its last item is removed', () => {
    const laidOutSections = editingTemplateFromKit(laidOutKit, SIZE).sections;
    const emptied = { ...laidOutSections, header: { ...laidOutSections.header, elements: [] } };
    const payload = changedBrandBands(emptied, laidOutSections);
    expect(payload.header.mode).toBe('legacy');
    expect(payload.header.elements).toEqual([]);
  });
});

describe('resetBandPayload', () => {
  it('puts one band back to its default height and its settings-drawn items', () => {
    const payload = resetBandPayload(laidOutKit, 'header', SIZE);
    expect(payload.mode).toBe('legacy');
    expect(payload.height).toBe(BAND_HEIGHTS.header.default);
    expect(payload.elements.length).toBeGreaterThan(0);
    expect(payload.elements.every((item) => item.locked === false)).toBe(true);
  });

  it('does not touch the other band', () => {
    const payload = resetBandPayload(settingsKit, 'footer', SIZE);
    expect(payload.height).toBe(BAND_HEIGHTS.footer.default);
  });
});

describe('pickSampleTemplate', () => {
  const withItems = {
    id: 'a',
    name: 'Placed layout',
    size: SIZE,
    elements: [{ kind: 'text', x: 80, y: 200, w: 600, h: 80, text: 'Hello' }],
  };
  const otherSize = { id: 'b', name: 'Story', size: { width: 1080, height: 1920 }, elements: [] };
  const emptyMatch = { id: 'c', name: 'Plain', size: SIZE, elements: [] };

  it('prefers a usable layout at the poster size with items on it', () => {
    expect(pickSampleTemplate([otherSize, emptyMatch, withItems], SIZE).id).toBe('a');
  });

  it('skips a layout nobody can use', () => {
    const off = { ...withItems, id: 'd', isActive: false };
    expect(pickSampleTemplate([off, emptyMatch], SIZE).id).toBe('c');
  });

  it('falls back to whatever exists rather than showing nothing', () => {
    expect(pickSampleTemplate([otherSize], SIZE).id).toBe('b');
    expect(pickSampleTemplate([], SIZE)).toBe(null);
  });
});

describe('brandLayerTemplate', () => {
  const draft = editingTemplateFromKit(laidOutKit, SIZE);

  it('shows the borrowed words behind the bands being placed', () => {
    const poster = brandLayerTemplate(draft.sections, withItems, SIZE);
    expect(poster.size).toEqual(SIZE);
    expect(itemsOfTemplate(poster)).toEqual(withItems.elements);
    expect(poster.sections.header.elements).toEqual(draft.sections.header.elements);
  });

  it('borrows nothing from a layout of another size', () => {
    expect(itemsOfTemplate(brandLayerTemplate(draft.sections, otherSize, SIZE))).toEqual([]);
  });
});
