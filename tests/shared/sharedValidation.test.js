import { describe, it, expect } from 'vitest';
import {
  normalizeElement,
  validateElements,
  resolveStyleTokens,
  effectivePage,
  iconForWords,
  ELEMENT_LIMITS,
} from '../../shared/templateElements.js';
import {
  buildElements,
  recipeIds,
} from '../../shared/designRecipes.js';

describe('shared templateElements validation', () => {
  const sampleBrand = {
    colors: {
      primary: '#2563EB',
      secondary: '#1E293B',
      accent: '#F59E0B',
      text: '#111827',
      background: '#FFFFFF',
    },
    fonts: {
      heading: 'Outfit',
      body: 'Inter',
    },
  };

  it('normalizes element style and attributes', () => {
    const raw = {
      id: 'test-1',
      kind: 'text',
      x: 100,
      y: 100,
      w: 400,
      h: 200,
      style: {
        size: 300, // Above fontSize max (200), should clamp
        color: '#ff0000',
      },
    };

    const normalized = normalizeElement(raw);
    expect(normalized.id).toBe('test-1');
    expect(normalized.kind).toBe('text');
    expect(normalized.w).toBe(400);
    expect(normalized.h).toBe(200);
    expect(normalized.style.size).toBeLessThanOrEqual(ELEMENT_LIMITS.fontSize.max);
  });

  it('validates element limits and required headline', () => {
    // Missing headline field
    const noHeadline = [
      { id: '1', kind: 'text', text: 'Sub text', x: 0, y: 0, w: 200, h: 50 },
    ];
    const problems = validateElements(noHeadline);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.toLowerCase().includes('headline'))).toBe(true);

    // Valid elements with headline field
    const valid = [
      { id: 'h1', kind: 'field', field: 'headline', text: 'Main Title', x: 0, y: 0, w: 500, h: 100 },
    ];
    expect(validateElements(valid)).toEqual([]);
  });

  it('resolves style tokens against brand kit', () => {
    const styleWithTokens = {
      color: 'brand:primary',
      fontFamily: 'brand:heading',
      fill: 'brand:accent',
    };

    const resolved = resolveStyleTokens(styleWithTokens, sampleBrand);
    expect(resolved.color).toBe('#2563eb');
    expect(resolved.fontFamily).toBe('Outfit');
    expect(resolved.fill).toBe('#f59e0b');
  });

  it('effectivePage applies custom overrides when mode is custom', () => {
    const templateWithCustom = {
      page: {
        background: {
          mode: 'custom',
          type: 'color',
          color: '#10B981',
        },
      },
    };

    const effective = effectivePage(sampleBrand, templateWithCustom);
    expect(effective.background.color).toBe('#10B981');
  });
});

describe('shared designRecipes validation', () => {
  it('contains expected design recipe identifiers', () => {
    const ids = recipeIds();
    expect(ids).toContain('photo-hero');
    expect(ids).toContain('bold-type');
    expect(ids).toContain('date-block');
    expect(ids).toContain('ticket');
  });

  it('builds elements for hero recipe without overlap errors', () => {
    const result = buildElements('photo-hero', {
      area: { x: 0, y: 140, w: 1080, h: 1080 },
      slots: {
        headline: 'Annual Sports Meet',
        date: 'Oct 24, 2026',
        time: '10:00 AM',
        venue: 'Main Stadium',
      },
    });

    expect(result.elements).toBeDefined();
    expect(Array.isArray(result.elements)).toBe(true);
    expect(result.elements.length).toBeGreaterThan(0);
    expect(result.problems).toEqual([]);
  });

  it('iconForWords selects relevant icon from context words', () => {
    expect(iconForWords('Annual Sports Championship Trophy')).toBe('trophy');
    expect(iconForWords('Blood Donation Health Camp')).toMatch(/droplet|heart/);
    expect(iconForWords('Tree Plantation Green Earth')).toBe('leaf');
  });
});
