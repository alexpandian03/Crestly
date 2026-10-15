import React from 'react';
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import PosterCanvas from './PosterCanvas';

const SIZE = { width: 1080, height: 1350 };

const brandKit = {
  orgName: 'Test Club',
  colors: { primary: '#059669', secondary: '#1E293B', accent: '#F59E0B', text: '#111827', background: '#FFFFFF' },
  fonts: { heading: 'Outfit', body: 'Inter' },
  defaultPosterSize: SIZE,
  header: { height: 80, background: { type: 'color', color: '#0f172a' }, logo: { show: false }, orgName: { show: false } },
  footer: { height: 70, background: { type: 'color', color: '#0b0f17' }, phone: '' },
};

const shape = (id, y) => ({
  id,
  kind: 'shape',
  x: 120,
  y,
  w: 300,
  h: 200,
  shape: { type: 'rect' },
  style: { color: '#059669' },
});

/** The box the poster cuts its placed items to: what falls outside it is never painted. */
function paintBoxOf(container, id) {
  const el = container.querySelector(`[data-element="${id}"]`);
  const box = el?.closest('[data-section="content"] > div');
  if (!box) return null;
  return { top: Number.parseInt(box.style.top, 10), height: Number.parseInt(box.style.height, 10) };
}

function templateWith(zones, elements) {
  return {
    name: 'probe',
    editorVersion: 2,
    size: SIZE,
    zones,
    elements: [],
    sections: { header: { mode: 'brand' }, content: { elements }, footer: { mode: 'brand' } },
  };
}

describe('the strip an arranged design may paint in', () => {
  it('reaches the footer when the template also carries an old text area', () => {
    const legacyTextArea = [{ type: 'content', x: 70, y: 162, w: 940, h: 891 }];
    const { container } = render(
      <PosterCanvas
        brandKit={brandKit}
        template={templateWith(legacyTextArea, [shape('high', 300), shape('low', 1000)])}
        content={{ title: 'Community Health Camp' }}
      />
    );
    expect(paintBoxOf(container, 'low')).toEqual({ top: 80, height: 1200 });
    expect(paintBoxOf(container, 'high')).toEqual({ top: 80, height: 1200 });
  });

  it('is the same strip whether or not such an area is carried along', () => {
    const withArea = render(
      <PosterCanvas brandKit={brandKit} template={templateWith([{ type: 'content', x: 70, y: 162, w: 940, h: 891 }], [shape('low', 1000)])} content={{ title: 'A' }} />
    );
    const withoutArea = render(
      <PosterCanvas brandKit={brandKit} template={templateWith([], [shape('low', 1000)])} content={{ title: 'A' }} />
    );
    expect(paintBoxOf(withArea.container, 'low')).toEqual(paintBoxOf(withoutArea.container, 'low'));
  });

  it('still keeps the old text area for a design the poster lays out by itself', () => {
    const legacy = {
      name: 'old',
      size: SIZE,
      zones: [{ type: 'content', x: 70, y: 162, w: 940, h: 891 }],
      elements: [],
    };
    const { container } = render(<PosterCanvas brandKit={brandKit} template={legacy} content={{ title: 'A' }} />);
    const box = container.querySelector('[data-section="content"] > div');
    expect({ top: Number.parseInt(box.style.top, 10), height: Number.parseInt(box.style.height, 10) }).toEqual({
      top: 162,
      height: 891,
    });
  });
});
