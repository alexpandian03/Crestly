import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import LandingPosterCard from './LandingPosterCard.jsx';
import ErrorBoundary from './ErrorBoundary.jsx';
import { DEMO_POSTERS } from '../data/demoPosters.js';

describe('LandingPosterCard and ErrorBoundary', () => {
  it('renders every demo poster card without throwing any error', () => {
    expect(Array.isArray(DEMO_POSTERS) && DEMO_POSTERS.length > 0).toBe(true);
    expect(DEMO_POSTERS.length).toBe(8);

    const orgNames = new Set(DEMO_POSTERS.map((p) => p.brandKit?.orgName));
    expect(orgNames.size).toBe(8);

    const primaryColors = new Set(DEMO_POSTERS.map((p) => p.brandKit?.colors?.primary));
    expect(primaryColors.size).toBe(8);

    const layoutNames = new Set(DEMO_POSTERS.map((p) => p.template?.name));
    expect(layoutNames.size).toBe(8);

    const categories = new Set(DEMO_POSTERS.map((p) => p.category));
    expect(categories.has('Event')).toBe(true);
    expect(categories.has('Festival')).toBe(true);
    expect(categories.has('Awareness')).toBe(true);
    expect(categories.has('Achievement')).toBe(true);
    expect(categories.has('Notice')).toBe(true);

    for (const poster of DEMO_POSTERS) {
      for (const el of poster.template?.elements || []) {
        if (el.style?.size !== undefined) {
          expect(el.style.size).toBeGreaterThanOrEqual(20);
        }
        if (el.style?.minSize !== undefined) {
          expect(el.style.minSize).toBeGreaterThanOrEqual(20);
        }
      }

      for (const detail of poster.content?.details || []) {
        const wordCount = detail.trim().split(/\s+/).length;
        expect(wordCount).toBeLessThanOrEqual(6);
      }

      // 1. Test rendering full preview
      const markup = renderToStaticMarkup(
        <LandingPosterCard poster={poster} onUse={() => {}} defaultVisible={true} />
      );
      expect(typeof markup).toBe('string');
      expect(markup.length).toBeGreaterThan(100);
      expect(markup.includes('ReferenceError')).toBe(false);
      expect(markup.includes('radial-gradient')).toBe(false);
      expect(markup.includes(poster.content.title)).toBe(true);
      expect(markup.includes(poster.category)).toBe(true);

      // 2. Test rendering initial lazy placeholder state
      const placeholderMarkup = renderToStaticMarkup(
        <LandingPosterCard poster={poster} onUse={() => {}} defaultVisible={false} />
      );
      expect(typeof placeholderMarkup).toBe('string');
    }
  });

  it('ErrorBoundary catches child errors and renders fallback', () => {
    const testErr = new Error('Test error');
    const derived = ErrorBoundary.getDerivedStateFromError(testErr);
    expect(derived.hasError).toBe(true);
    expect(derived.error).toBe(testErr);

    const instance = new ErrorBoundary({});
    instance.state = { hasError: true, error: testErr };
    const defaultFallback = instance.render();
    const defaultHtml = renderToStaticMarkup(defaultFallback);
    expect(defaultHtml.includes('Preview unavailable')).toBe(true);

    const customInstance = new ErrorBoundary({ fallback: <div>Custom fallback error</div> });
    customInstance.state = { hasError: true, error: testErr };
    const customHtml = renderToStaticMarkup(customInstance.render());
    expect(customHtml.includes('Custom fallback error')).toBe(true);
  });
});
