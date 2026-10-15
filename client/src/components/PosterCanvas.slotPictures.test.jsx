import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PosterCanvas from './PosterCanvas';

/* ------------------------------------------------------------------ *
 * What a poster draws for the picture spaces the layout left open.
 *
 * The picture a designer parked in a space is part of the layout: it may only be seen, faintly,
 * while that layout is being edited. A poster shows the picture its own answer holds, and nothing
 * when the space is still empty.
 * ------------------------------------------------------------------ */

const SIZE = { width: 1080, height: 1350 };
const SAMPLE = 'https://images.pexels.com/photos/1000/sample.jpg';
const CHOSEN = 'https://images.unsplash.com/photo-3000/chosen.jpg';

const brandKit = {
  orgName: 'Water Aid Trust',
  colors: {
    primary: '#2563EB',
    secondary: '#1E293B',
    accent: '#F59E0B',
    text: '#111827',
    background: '#FFFFFF',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  defaultPosterSize: SIZE,
  header: {
    height: 80,
    background: { type: 'color', color: '#0f172a' },
    logo: { show: false, size: 40, position: 'left' },
    orgName: { show: true, text: 'Water Aid Trust' },
  },
  footer: { height: 70, background: { type: 'color', color: '#0b0f17' }, phone: '+91 90000 00000' },
};

const slotItem = {
  id: 'pic-hero',
  kind: 'image',
  variable: true,
  key: 'hero',
  label: 'Main picture',
  imageUrl: SAMPLE,
  x: 90,
  y: 320,
  w: 900,
  h: 600,
  z: 2,
};

const lockedItem = {
  id: 'pic-locked',
  kind: 'image',
  imageUrl: SAMPLE,
  x: 90,
  y: 980,
  w: 900,
  h: 220,
  z: 1,
};

const textItem = {
  id: 'txt-guest',
  kind: 'text',
  variable: true,
  key: 'guest',
  label: 'Chief guest',
  text: 'e.g. Dr. Rao',
  x: 90,
  y: 240,
  w: 900,
  h: 60,
  z: 1,
};

const templateOf = (elements) => ({
  name: 'Slot test',
  editorVersion: 2,
  size: SIZE,
  zones: [],
  elements,
  sections: {
    header: { mode: 'brand' },
    content: { elements },
    footer: { mode: 'brand' },
  },
});

const sourcesIn = (container) =>
  Array.from(container.querySelectorAll('img')).map((img) => img.getAttribute('src'));

function draw(elements, content, isEditor = false) {
  return render(
    <PosterCanvas
      brandKit={brandKit}
      template={templateOf(elements)}
      content={{ title: 'Community Health Camp', ...content }}
      isEditor={isEditor}
    />,
  );
}

describe('a picture space on a poster', () => {
  it('draws nothing while the space is empty', () => {
    const { container } = draw([slotItem], {});
    expect(sourcesIn(container)).not.toContain(SAMPLE);
    expect(container.querySelector('[data-element="pic-hero"]')).toBe(null);
  });

  it('draws only the picture this poster answers with', () => {
    const { container } = draw([slotItem], { images: { hero: CHOSEN } });
    expect(sourcesIn(container)).toContain(CHOSEN);
    expect(sourcesIn(container)).not.toContain(SAMPLE);
  });

  it('shows the designer picture faintly while the layout itself is being edited', () => {
    const { container } = draw([slotItem], {}, true);
    const tile = container.querySelector('[data-element="pic-hero"]');
    expect(tile).not.toBe(null);
    expect(tile.getAttribute('data-export-ignore')).toBe('true');
    expect(tile.textContent).toContain('Main picture');
    const sample = Array.from(tile.querySelectorAll('img')).find(
      (img) => img.getAttribute('src') === SAMPLE,
    );
    expect(sample).not.toBe(undefined);
    expect(sample.style.opacity).toBe('0.18');
  });

  it('keeps a picture that belongs to the layout, not to a person', () => {
    const { container } = draw([lockedItem], {});
    expect(sourcesIn(container)).toContain(SAMPLE);
  });
});

describe('a words space on a poster', () => {
  it('never shows the example words as an answer', () => {
    const { container } = draw([textItem], {});
    expect(container.textContent).not.toContain('e.g. Dr. Rao');
  });

  it('shows what was written for it', () => {
    const { container } = draw([textItem], { extras: { guest: 'Dr. Rao' } });
    expect(container.textContent).toContain('Dr. Rao');
  });
});
