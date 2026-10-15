import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import PosterCanvas from './PosterCanvas';

const SIZE = { width: 1080, height: 1350 };

const settingsKit = {
  orgName: 'Water Aid Trust',
  colors: { primary: '#2563EB', secondary: '#1E293B', accent: '#F59E0B', text: '#111827', background: '#FFFFFF' },
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

/** The same organization after its header was arranged by hand in the brand layer editor. */
const handPlaced = { kind: 'text', x: 300, y: 22, w: 500, h: 40, text: 'Placed by hand', locked: true };
const laidOutKit = {
  ...settingsKit,
  header: { mode: 'elements', height: 80, elements: [handPlaced], background: { type: 'color', color: '#0f172a' } },
};

const brandBandsTemplate = {
  name: 'Plain layout',
  editorVersion: 2,
  size: SIZE,
  zones: [],
  elements: [],
  sections: { header: { mode: 'brand' }, content: { elements: [] }, footer: { mode: 'brand' } },
};

const content = {
  title: 'Community Health Camp',
  tagline: 'Free check-ups for every family',
  date: 'Saturday, 15 November',
  time: '9:00 am - 4:00 pm',
  venue: 'Town Hall Grounds',
  details: ['Blood pressure screening'],
};

function draw(brandKit, template = brandBandsTemplate) {
  return render(<PosterCanvas brandKit={brandKit} template={template} content={content} />);
}

describe('PosterCanvas with a brand layer', () => {
  it('draws a kit that was never laid out from its own settings', () => {
    draw(settingsKit);
    expect(screen.getByText('Water Aid Trust')).toBeInTheDocument();
    expect(screen.queryByText('Placed by hand')).toBe(null);
  });

  it('draws a laid-out kit from the items the organization placed', () => {
    draw(laidOutKit);
    expect(screen.getByText('Placed by hand')).toBeInTheDocument();
  });

  it('lets a template that customizes its own band win', () => {
    const template = {
      ...brandBandsTemplate,
      sections: {
        ...brandBandsTemplate.sections,
        header: {
          mode: 'custom',
          height: 120,
          elements: [{ kind: 'text', x: 40, y: 30, w: 500, h: 50, text: 'This design draws its own strip' }],
        },
      },
    };
    draw(laidOutKit, template);
    expect(screen.getByText('This design draws its own strip')).toBeInTheDocument();
    expect(screen.queryByText('Placed by hand')).toBe(null);
  });
});
