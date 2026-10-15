import { test, expect } from '@playwright/test';

test.describe('Poster Export Verification (15 Photos, 40 Texts, Tamil Typography)', () => {
  test('export poster with 15 photos, 40 texts, and Tamil text without blank areas, missing photos or clipping', async ({
    page,
  }) => {
    // 1. Navigate to the export test harness
    await page.goto('/export-test');
    await page.waitForLoadState('networkidle');

    // 2. Ensure poster root canvas is rendered
    const canvasRoot = page.locator('#poster-canvas-root');
    await expect(canvasRoot).toBeVisible({ timeout: 15000 });

    // 3. Verify all 15 photos (+ logo) are loaded and none are missing
    await expect(page.locator('[data-testid="images-ready-indicator"]')).toHaveText(
      '15 Photos Loaded',
      { timeout: 15000 }
    );

    const imageStatus = await page.evaluate(() => window.__checkImages());
    expect(imageStatus.allReady, 'All photos must be loaded with non-zero natural width').toBe(
      true
    );
    expect(imageStatus.loaded, 'Must have at least 15 loaded photos').toBeGreaterThanOrEqual(15);

    // 4. Verify Tamil text items are present and rendered with Tamil typography
    await expect(page.getByText('தமிழ் பாரம்பரிய இசை மற்றும் கலைத் திருவிழா 2026')).toBeVisible();
    await expect(
      page.getByText('அனைவரும் வருக! அனுமதி இலவசம் — குடும்பத்துடன் கொண்டாடுங்கள்')
    ).toBeVisible();
    await expect(
      page.getByText('சிறப்பு விருந்தினர்: முனைவர் க. சுப்பிரமணியன் (தமிழ் பல்கலைக்கழகம்)')
    ).toBeVisible();

    // 5. Fail on clipping: ensure no text item or photo overflows container or canvas bounds
    const clippingStatus = await page.evaluate(() => window.__checkClipping());
    if (clippingStatus.hasClipping) {
      console.error('Clipping detected:', clippingStatus.clipped);
    }
    expect(
      clippingStatus.hasClipping,
      `Elements must not clip. Clipped count: ${clippingStatus.clippedCount}`
    ).toBe(false);

    // 6. Execute export (PNG) and intercept download
    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 45000 }),
      page.locator('[data-testid="run-export-btn"]').click(),
    ]);

    // 7. Verify the downloaded file is a valid PNG
    expect(download.suggestedFilename()).toMatch(/\.png$/i);

    // 8. Verify the export result is ok, with no blank canvas errors
    const exportResult = await page.evaluate(() => window.__lastExportResult);
    expect(exportResult, 'Export result must exist').not.toBeNull();
    expect(exportResult.ok, 'Export result must be ok').toBe(true);

    // Ensure no blank area warnings or critical errors
    const warnings = exportResult.warnings || [];
    const blankWarnings = warnings.filter((w) => /blank/i.test(w));
    expect(blankWarnings, 'Must not report blank areas').toHaveLength(0);

    const missingPhotoWarnings = warnings.filter((w) => /could not be loaded/i.test(w));
    expect(missingPhotoWarnings, 'Must not report missing photos').toHaveLength(0);
  });
});
