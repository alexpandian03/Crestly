import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('renders every demo poster card without throwing any error', async () => {
  const esbuild = (await import('esbuild')).default;
  const outPath = path.resolve(__dirname, '.temp-landing-test-bundle.mjs');

  try {
    await esbuild.build({
      entryPoints: [path.resolve(__dirname, 'LandingPosterCard.jsx')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: outPath,
      external: ['react', 'react-dom', 'react-dom/server', 'lucide-react'],
    });

    const { renderToStaticMarkup } = await import('react-dom/server');
    const React = (await import('react')).default;
    const { DEMO_POSTERS } = await import('../data/demoPosters.js');
    const mod = await import('file:///' + outPath.replace(/\\/g, '/'));
    const LandingPosterCard = mod.default;

    assert.ok(Array.isArray(DEMO_POSTERS) && DEMO_POSTERS.length > 0, 'DEMO_POSTERS must have posters');

    assert.equal(DEMO_POSTERS.length, 8, 'There must be exactly 8 demo posters');

    const orgNames = new Set(DEMO_POSTERS.map((p) => p.brandKit?.orgName));
    assert.equal(orgNames.size, 8, 'All 8 posters must have distinct organization names');

    const primaryColors = new Set(DEMO_POSTERS.map((p) => p.brandKit?.colors?.primary));
    assert.equal(primaryColors.size, 8, 'All 8 posters must have distinct brand colors');

    const layoutNames = new Set(DEMO_POSTERS.map((p) => p.template?.name));
    assert.equal(layoutNames.size, 8, 'All 8 posters must have distinct template layouts');

    const categories = new Set(DEMO_POSTERS.map((p) => p.category));
    assert.ok(categories.has('Event'), 'Must include Event category');
    assert.ok(categories.has('Festival'), 'Must include Festival category');
    assert.ok(categories.has('Awareness'), 'Must include Awareness category');
    assert.ok(categories.has('Achievement'), 'Must include Achievement category');
    assert.ok(categories.has('Notice'), 'Must include Notice category');

    for (const poster of DEMO_POSTERS) {
      // Check font sizes in template elements: no text smaller than 20px
      for (const el of (poster.template?.elements || [])) {
        if (el.style?.size !== undefined) {
          assert.ok(el.style.size >= 20, `Element ${el.id} size (${el.style.size}px) must be >= 20px`);
        }
        if (el.style?.minSize !== undefined) {
          assert.ok(el.style.minSize >= 20, `Element ${el.id} minSize (${el.style.minSize}px) must be >= 20px`);
        }
      }

      // Check bullets: max 6 words each
      for (const detail of (poster.content?.details || [])) {
        const wordCount = detail.trim().split(/\s+/).length;
        assert.ok(wordCount <= 6, `Detail "${detail}" in ${poster.id} has ${wordCount} words (max 6 allowed)`);
      }

      // 1. Test rendering full preview (visible = true)
      assert.doesNotThrow(() => {
        const markup = renderToStaticMarkup(
          React.createElement(LandingPosterCard, {
            poster,
            onUse: () => {},
            defaultVisible: true,
          })
        );
        assert.ok(typeof markup === 'string' && markup.length > 100, `Poster ${poster.id} rendered valid HTML`);
        assert.ok(!markup.includes('ReferenceError'), `Poster ${poster.id} must not output ReferenceError`);
        // Verify no blurry radial blobs
        assert.ok(!markup.includes('radial-gradient'), `Poster ${poster.id} must not contain blurry radial-gradient blobs`);
        // Verify title and category are rendered in the card
        assert.ok(markup.includes(poster.content.title), `Card for ${poster.id} must display title below thumbnail`);
        assert.ok(markup.includes(poster.category), `Card for ${poster.id} must display category below thumbnail`);
      }, `Rendering poster ${poster.id} (full preview) threw an error`);

      // 2. Test rendering initial lazy placeholder state (visible = false)
      assert.doesNotThrow(() => {
        const placeholderMarkup = renderToStaticMarkup(
          React.createElement(LandingPosterCard, {
            poster,
            onUse: () => {},
            defaultVisible: false,
          })
        );
        assert.ok(typeof placeholderMarkup === 'string', `Poster ${poster.id} placeholder markup rendered`);
      }, `Rendering poster ${poster.id} (placeholder) threw an error`);
    }
  } finally {
    if (fs.existsSync(outPath)) {
      try {
        fs.unlinkSync(outPath);
      } catch {
        // ignore unlink error
      }
    }
  }
});

test('ErrorBoundary catches child errors and renders small gray placeholder', async () => {
  const esbuild = (await import('esbuild')).default;
  const outPath = path.resolve(__dirname, '.temp-errorboundary-test-bundle.mjs');

  try {
    await esbuild.build({
      entryPoints: [path.resolve(__dirname, 'ErrorBoundary.jsx')],
      bundle: true,
      format: 'esm',
      platform: 'node',
      outfile: outPath,
      external: ['react', 'react-dom', 'react-dom/server'],
    });

    const { renderToStaticMarkup } = await import('react-dom/server');
    const React = (await import('react')).default;
    const mod = await import('file:///' + outPath.replace(/\\/g, '/'));
    const ErrorBoundary = mod.default;

    // Test static getDerivedStateFromError
    const testErr = new Error('Test error');
    const derived = ErrorBoundary.getDerivedStateFromError(testErr);
    assert.equal(derived.hasError, true);
    assert.equal(derived.error, testErr);

    // Test default fallback render
    const instance = new ErrorBoundary({});
    instance.state = { hasError: true, error: testErr };
    const defaultFallback = instance.render();
    const defaultHtml = renderToStaticMarkup(defaultFallback);
    assert.ok(defaultHtml.includes('Preview unavailable'), 'Default fallback should show Preview unavailable');

    // Test custom fallback render
    const customInstance = new ErrorBoundary({ fallback: React.createElement('div', null, 'Custom fallback error') });
    customInstance.state = { hasError: true, error: testErr };
    const customHtml = renderToStaticMarkup(customInstance.render());
    assert.ok(customHtml.includes('Custom fallback error'), 'Custom fallback should be rendered');
  } finally {
    if (fs.existsSync(outPath)) {
      try {
        fs.unlinkSync(outPath);
      } catch {
        // ignore unlink error
      }
    }
  }
});
