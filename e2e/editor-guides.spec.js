import { test, expect } from '@playwright/test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../server/models/User.model.js';
import Client from '../server/models/Client.model.js';
import BrandKit from '../server/models/BrandKit.model.js';
import Template from '../server/models/Template.model.js';

/**
 * The margin lines inside the template editor.
 *
 * The lines that show where words can safely sit belong to one area of the poster at a time.
 * They must never run across the edge of the header or footer band being edited, never cover
 * another area, and never take a click away from the item underneath them.
 */

const PASSWORD = 'Password12345!';
const ADMIN_EMAIL = 'e2e-editor-guides@playwright.test';
const WORKSPACE = '[data-editor-workspace]';
const MARGIN_BUTTON = 'Margin lines';

let guideClient;
let guideTemplate;

test.beforeAll(async () => {
  if (process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  await User.deleteMany({ email: ADMIN_EMAIL });
  await Client.deleteMany({ name: 'E2E Editor Guides Client' });

  guideClient = await Client.create({
    name: 'E2E Editor Guides Client',
    contactEmail: ADMIN_EMAIL,
  });

  await BrandKit.create({
    clientId: guideClient._id,
    orgName: 'Editor Guides Org',
    colors: { primary: '#2563EB', background: '#FFFFFF' },
  });

  guideTemplate = await Template.create({
    clientId: guideClient._id,
    name: 'E2E Editor Guides Template',
    category: 'Event',
    isActive: true,
    editorVersion: 2,
    size: { width: 1080, height: 1350 },
    sections: {
      header: {
        height: 120,
        elements: [
          {
            id: 'guide-header-name',
            kind: 'text',
            text: 'Editor Guides Org',
            x: 40,
            y: 34,
            w: 520,
            h: 48,
            style: { size: 30, color: '#111827' },
            locked: true,
          },
        ],
      },
      content: {
        elements: [
          {
            /* Starts at x 60, so the left margin line at 64 falls inside this item. */
            id: 'guide-headline',
            kind: 'text',
            text: 'Annual Science Fair',
            x: 60,
            y: 300,
            w: 960,
            h: 140,
            style: { size: 72, color: '#111827' },
          },
        ],
      },
      footer: {
        height: 110,
        elements: [
          {
            id: 'guide-footer-note',
            kind: 'text',
            text: 'Free entry for students',
            x: 60,
            y: 1260,
            w: 960,
            h: 40,
            style: { size: 22, color: '#111827' },
            locked: true,
          },
        ],
      },
    },
  });

  await User.create({
    name: 'E2E Editor Guides Admin',
    email: ADMIN_EMAIL,
    passwordHash: await User.hashPassword(PASSWORD),
    role: 'clientadmin',
    clientId: guideClient._id,
    isActive: true,
  });
});

test.afterAll(async () => {
  if (guideClient) {
    await Template.deleteMany({ clientId: guideClient._id });
    await BrandKit.deleteMany({ clientId: guideClient._id });
    await Client.findByIdAndDelete(guideClient._id);
  }
  await User.deleteMany({ email: ADMIN_EMAIL });
  if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

async function openEditor(page) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', ADMIN_EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });
  await page.goto(`/templates/${guideTemplate._id.toString()}/edit`);
  await expect(page.locator(WORKSPACE)).toBeVisible();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-section="footer"]').length > 0,
    undefined,
    { timeout: 15000 }
  );
}

const POSTER = { width: 1080, height: 1350 };
const BANDS = {
  header: { top: 0, height: 120 },
  content: { top: 120, height: 1350 - 120 - 110 },
  footer: { top: 1350 - 110, height: 110 },
};

async function focusSection(page, name) {
  await page.getByRole('tab', { name }).click();
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
  // The view glides to the area and the lines settle with it; measure only afterwards.
  await page.waitForTimeout(500);
}

/**
 * Everything about one area's geometry, measured from the poster's own box.
 * `[data-section="..."]` wrappers are not reliable rulers (some of them are zero-height), so
 * the band edges are computed from the poster rectangle and the template's own layout.
 */
async function geometry(page, key) {
  return page.evaluate(
    ([section, bands, posterSize]) => {
      const poster = document.querySelector('[data-editor-poster]');
      if (!poster) return null;
      const p = poster.getBoundingClientRect();
      const scale = p.width / posterSize.width;
      const box = bands[section];
      const node = document.querySelector(`[data-margin-guides="${section}"]`);
      const expected = {
        top: p.top + box.top * scale,
        bottom: p.top + (box.top + box.height) * scale,
      };
      if (!node) return { present: false, scale, expected };

      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        present: true,
        scale,
        expected,
        top: rect.top,
        bottom: rect.bottom,
        pointerEvents: style.pointerEvents,
        overflow: style.overflow,
        lines: node.querySelectorAll(':scope > div > div').length,
      };
    },
    [key, BANDS, POSTER]
  );
}

async function setMargins(page, wanted) {
  const button = page.getByRole('button', { name: MARGIN_BUTTON });
  if ((await button.getAttribute('aria-pressed')) !== String(wanted)) {
    await button.click();
  }
  await expect(button).toHaveAttribute('aria-pressed', String(wanted));
}

async function marginsPressed(page) {
  return page.getByRole('button', { name: MARGIN_BUTTON }).getAttribute('aria-pressed');
}

async function gridBoxes(page) {
  return page.evaluate(() => {
    const poster = document.querySelector('[data-editor-poster]');
    const p = poster.getBoundingClientRect();
    const scale = p.width / 1080;
    return [...document.querySelectorAll('[data-editor-grid]')].map((node) => {
      const rect = node.getBoundingClientRect();
      const style = getComputedStyle(node);
      return {
        key: node.getAttribute('data-editor-grid'),
        top: rect.top,
        bottom: rect.bottom,
        pointerEvents: style.pointerEvents,
        overflow: style.overflow,
        posterTop: p.top,
        scale,
      };
    });
  });
}

test.describe('Margin lines in the template editor', () => {
  test.use({ viewport: { width: 1366, height: 768 } });
  // Every case opens the editor from a cold login, which is slow on the test server.
  test.setTimeout(120000);

  test('they are on for the middle of the poster and off for the bands', async ({ page }) => {
    await openEditor(page);

    await focusSection(page, 'Content');
    expect(await marginsPressed(page)).toBe('true');
    await focusSection(page, 'Header');
    expect(await marginsPressed(page)).toBe('false');
    await focusSection(page, 'Footer');
    expect(await marginsPressed(page)).toBe('false');
  });

  test('no line is ever drawn across the band being edited', async ({ page }) => {
    await openEditor(page);

    for (const section of ['Header', 'Footer']) {
      await focusSection(page, section);
      await setMargins(page, true);

      const guide = await geometry(page, section.toLowerCase());
      expect(guide.present).toBe(true);
      // The set of lines lives inside the band and is clipped by it.
      expect(guide.top).toBeGreaterThanOrEqual(guide.expected.top - 2);
      expect(guide.bottom).toBeLessThanOrEqual(guide.expected.bottom + 2);
      expect(guide.pointerEvents).toBe('none');
      expect(guide.overflow).toBe('hidden');
      // Two side lines and one centre line, never a box that crosses an edge.
      expect(guide.lines).toBe(3);
    }
  });

  test('the middle of the poster keeps its own safe frame', async ({ page }) => {
    await openEditor(page);
    await focusSection(page, 'Content');

    const guide = await geometry(page, 'content');
    expect(guide.present).toBe(true);
    expect(guide.top).toBeGreaterThanOrEqual(guide.expected.top - 2);
    expect(guide.bottom).toBeLessThanOrEqual(guide.expected.bottom + 2);
    expect(guide.pointerEvents).toBe('none');
    // Two side lines and a top and bottom line.
    expect(guide.lines).toBe(4);
  });

  test('the whole poster shows each area its own lines and nothing else', async ({ page }) => {
    await openEditor(page);
    await focusSection(page, 'Header');
    await setMargins(page, true);
    await page.getByRole('button', { name: 'Whole poster' }).click();

    const header = await geometry(page, 'header');
    const content = await geometry(page, 'content');
    const footer = await geometry(page, 'footer');

    expect(header.present).toBe(true);
    expect(header.top).toBeGreaterThanOrEqual(header.expected.top - 2);
    expect(header.bottom).toBeLessThanOrEqual(header.expected.bottom + 2);
    // Content is on by default, the footer is not, and each stays inside its own area.
    expect(content.present).toBe(true);
    expect(content.top).toBeGreaterThanOrEqual(content.expected.top - 2);
    expect(content.bottom).toBeLessThanOrEqual(content.expected.bottom + 2);
    expect(footer.present).toBe(false);
  });

  test('a click on a line still picks the item underneath it', async ({ page }) => {
    await openEditor(page);
    await focusSection(page, 'Content');

    const guide = page.locator('[data-margin-guides="content"]');
    const guideBox = await guide.boundingBox();
    expect(guideBox).not.toBeNull();
    // The guide layer is exactly as wide as the poster, so this is the zoom in force.
    const scale = guideBox.width / POSTER.width;

    // The left line sits at 64 poster pixels, inside the headline that starts at 60.
    const item = page.getByRole('button', { name: /Annual Science Fair/ });
    const itemBox = await item.boundingBox();
    await page.mouse.click(guideBox.x + 64 * scale, itemBox.y + itemBox.height / 2);
    await expect(item).toHaveAttribute('aria-pressed', 'true');
  });

  test('each area remembers the choice you made for it', async ({ page }) => {
    await openEditor(page);

    await focusSection(page, 'Header');
    await setMargins(page, true);
    await focusSection(page, 'Footer');
    expect(await marginsPressed(page)).toBe('false');
    await setMargins(page, true);
    await focusSection(page, 'Content');
    expect(await marginsPressed(page)).toBe('true');

    await focusSection(page, 'Header');
    expect(await marginsPressed(page)).toBe('true');
    expect((await geometry(page, 'header')).present).toBe(true);
    // Switching back off in one area leaves the other areas alone.
    await setMargins(page, false);
    expect((await geometry(page, 'header')).present).toBe(false);
    await focusSection(page, 'Footer');
    expect(await marginsPressed(page)).toBe('true');
  });

  test('the grid is measured inside the area being edited only', async ({ page }) => {
    await openEditor(page);
    await focusSection(page, 'Header');

    await page.getByRole('button', { name: 'Editing' }).click();
    await page.getByRole('menuitem', { name: /Show grid/ }).click();

    const grids = await gridBoxes(page);
    const band = BANDS.header;
    const scale = grids[0].scale;
    const expectedTop = grids[0].posterTop + band.top * scale;
    const expectedBottom = grids[0].posterTop + (band.top + band.height) * scale;

    expect(grids).toHaveLength(1);
    expect(grids[0].pointerEvents).toBe('none');
    expect(grids[0].overflow).toBe('hidden');
    expect(grids[0].top).toBeGreaterThanOrEqual(expectedTop - 2);
    expect(grids[0].bottom).toBeLessThanOrEqual(expectedBottom + 2);
  });
});
