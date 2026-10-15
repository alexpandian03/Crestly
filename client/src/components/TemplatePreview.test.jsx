import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import TemplatePreview from './TemplatePreview';

/* ------------------------------------------------------------------ *
 * What a miniature of a layout has to hold.
 *
 * A card in the Templates list or the brand kit preview is the only look at a design before
 * anyone writes a poster for it. The spaces the layout leaves open - a line of words, a picture -
 * are part of that look, so they appear here exactly as they do on the Create page instead of
 * vanishing and leaving the design looking half-built.
 * ------------------------------------------------------------------ */

const SIZE = { width: 1080, height: 1350 };
const PARKED = 'https://images.pexels.com/photos/1000/parked.jpg';

const brandKit = {
  orgName: 'Test Club',
  colors: {
    primary: '#059669',
    secondary: '#0f172a',
    accent: '#10b981',
    text: '#ffffff',
    background: '#0b0f17',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  defaultPosterSize: SIZE,
  header: { height: 80, background: { type: 'color', color: '#ffffff' } },
  footer: { height: 70, background: { type: 'color', color: '#ffffff' } },
};

const wordsSpace = {
  id: 'text-1',
  kind: 'text',
  variable: true,
  key: 'line1',
  label: 'Text 1',
  sample: 'Small line copy',
  x: 90,
  y: 300,
  w: 700,
  h: 60,
};

const pictureSpace = {
  id: 'photo-1',
  kind: 'image',
  variable: true,
  key: 'pic1',
  label: 'Photo space 1',
  sampleImage: PARKED,
  x: 90,
  y: 400,
  w: 500,
  h: 320,
};

const emptySpace = {
  id: 'photo-2',
  kind: 'image',
  variable: true,
  key: 'pic2',
  label: 'Photo space 2',
  x: 640,
  y: 400,
  w: 350,
  h: 320,
};

const bar = { id: 'shape-1', kind: 'shape', shape: { type: 'rect' }, x: 90, y: 260, w: 900, h: 8 };

const template = {
  name: 'Test Club Standard Event Poster',
  editorVersion: 2,
  version: 3,
  updatedAt: '2026-10-15T00:00:00.000Z',
  size: SIZE,
  zones: [],
  elements: [bar, wordsSpace, pictureSpace, emptySpace],
  sections: {
    header: { mode: 'brand' },
    content: { elements: [bar, wordsSpace, pictureSpace, emptySpace] },
    footer: { mode: 'brand' },
  },
};

function draw(overrides = {}) {
  const { container } = render(
    <TemplatePreview brandKit={brandKit} template={template} size={540} eager {...overrides} />
  );
  return container;
}

describe('a miniature of a layout', () => {
  it('shows the words and picture spaces the design leaves open', () => {
    const container = draw();
    expect(container.textContent).toContain('Small line copy');
    expect(container.textContent).toContain('Photo space 2');
    const parked = Array.from(container.querySelectorAll('img')).find(
      (img) => img.getAttribute('src') === PARKED
    );
    expect(parked).not.toBe(undefined);
  });

  it('draws the answer in a space instead of its sample once it is filled in', () => {
    const container = draw({
      sample: { title: 'Annual Community Fair', extras: { line1: 'Dr. Rao attends' } },
    });
    expect(container.textContent).toContain('Dr. Rao attends');
    expect(container.textContent).not.toContain('Small line copy');
  });
});
