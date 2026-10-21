import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PosterCanvas from './PosterCanvas';
import { TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';

/* ------------------------------------------------------------------ *
 * A layout with nothing placed on it.
 *
 * The editor starts a new template empty so the team can place their own words. If the canvas
 * filled that space with the sample poster, the team would see words belonging to no item and
 * therefore words nobody could click.
 * ------------------------------------------------------------------ */

const SIZE = { width: 1080, height: 1350 };

const brandKit = {
  orgName: 'Test Club',
  colors: { primary: '#059669', secondary: '#1E293B', accent: '#F59E0B', text: '#111827', background: '#FFFFFF' },
  fonts: { heading: 'Outfit', body: 'Inter' },
  defaultPosterSize: SIZE,
  header: { height: 80, background: { type: 'color', color: '#0f172a' }, logo: { show: false }, orgName: { show: false } },
  footer: { height: 70, background: { type: 'color', color: '#0b0f17' }, phone: '' },
};

/** What the Templates page creates: brand bands, standard areas, and no placed items. */
function emptyLayout() {
  return {
    name: 'Untitled template 1',
    editorVersion: 2,
    size: SIZE,
    zones: [
      { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
      { id: 'zone-content', type: 'content', x: 70, y: 170, w: 940, h: 640, locked: false },
      { id: 'zone-image', type: 'image', x: 70, y: 830, w: 940, h: 370, locked: false },
      { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
    ],
    elements: [],
    sections: {
      header: { mode: 'brand', height: 80, elements: [] },
      content: { elements: [] },
      footer: { mode: 'brand', height: 70, elements: [] },
    },
  };
}

describe('a layout with nothing placed on it', () => {
  it('paints no example words that nobody can touch', () => {
    const { container } = render(
      <PosterCanvas brandKit={brandKit} template={emptyLayout()} content={TEMPLATE_SAMPLE_CONTENT} />
    );
    expect(container.textContent).not.toContain('Annual Community Fair');
    expect(container.textContent).not.toContain('Riverside Grounds');
    expect(container.querySelector('[data-section="content"]')).toBeTruthy();
  });

  it('keeps the classic words for a poster saved before the editor', () => {
    const { container } = render(
      <PosterCanvas
        brandKit={brandKit}
        template={{ ...emptyLayout(), editorVersion: 1 }}
        content={TEMPLATE_SAMPLE_CONTENT}
      />
    );
    expect(container.textContent).toContain('Annual Community Fair');
  });
});
