import { test, expect } from '@playwright/test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../server/models/User.model.js';
import Client from '../server/models/Client.model.js';
import BrandKit from '../server/models/BrandKit.model.js';
import Template from '../server/models/Template.model.js';

/**
 * Getting around the template editor.
 *
 * The poster is taller than any screen, so the work area has to scroll, and stepping into an
 * area has to bring that area to you. Both are checked at the two smallest laptop sizes the
 * editor is meant to run at.
 */

const PASSWORD = 'Password12345!';
const ADMIN_EMAIL = 'e2e-editor-nav@playwright.test';
const WORKSPACE = '[data-editor-workspace]';
const VIEWPORTS = [
  { width: 1366, height: 768 },
  { width: 1280, height: 720 },
];

let navClient;
let navTemplate;

test.beforeAll(async () => {
  if (process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  await User.deleteMany({ email: ADMIN_EMAIL });
  await Client.deleteMany({ name: 'E2E Editor Nav Client' });

  navClient = await Client.create({
    name: 'E2E Editor Nav Client',
    contactEmail: 'e2e-editor-nav@playwright.test',
  });

  await BrandKit.create({
    clientId: navClient._id,
    orgName: 'Editor Nav Org',
    colors: { primary: '#2563EB', background: '#FFFFFF' },
  });

  navTemplate = await Template.create({
    clientId: navClient._id,
    name: 'E2E Editor Nav Template',
    category: 'Event',
    isActive: true,
    editorVersion: 2,
    size: { width: 1080, height: 1350 },
    sections: {
      header: {
        height: 120,
        elements: [
          {
            id: 'nav-header-name',
            kind: 'text',
            text: 'Editor Nav Org',
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
            id: 'nav-headline',
            kind: 'text',
            text: 'Annual Science Fair',
            x: 60,
            y: 300,
            w: 960,
            h: 140,
            style: { size: 72, color: '#111827' },
          },
          {
            id: 'nav-dates',
            kind: 'text',
            text: '12 October, morning session',
            x: 60,
            y: 900,
            w: 960,
            h: 60,
            style: { size: 28, color: '#111827' },
          },
        ],
      },
      footer: {
        height: 110,
        elements: [
          {
            id: 'nav-footer-contact',
            kind: 'text',
            /* The organization behind this template has no phone number, so this is the
               words-that-resolve-to-nothing case the editor has to explain. */
            text: '{{brand.phone}}',
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
    name: 'E2E Editor Nav Admin',
    email: ADMIN_EMAIL,
    passwordHash: await User.hashPassword(PASSWORD),
    role: 'clientadmin',
    clientId: navClient._id,
    isActive: true,
  });
});

test.afterAll(async () => {
  if (navClient) {
    await Template.deleteMany({ clientId: navClient._id });
    await BrandKit.deleteMany({ clientId: navClient._id });
    await Client.findByIdAndDelete(navClient._id);
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
  await page.goto(`/templates/${navTemplate._id.toString()}/edit`);
  await expect(page.locator(WORKSPACE)).toBeVisible();
  await page.waitForFunction(
    () => document.querySelectorAll('[data-section="footer"]').length > 0,
    undefined,
    { timeout: 15000 }
  );
}

/** How far the work area can travel, and how far it has travelled. */
async function scrollRoom(page) {
  return page.locator(WORKSPACE).evaluate((node) => ({
    room: node.scrollHeight - node.clientHeight,
    top: node.scrollTop,
  }));
}

for (const viewport of VIEWPORTS) {
  test.describe(`Template editor navigation at ${viewport.width}x${viewport.height}`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } });

    test('the work area is a scroll container that a plain wheel moves', async ({ page }) => {
      await openEditor(page);

      // Whole poster mode fits by design; the room to scroll shows up in an area.
      await page.getByRole('tab', { name: 'Content' }).click();

      const before = await scrollRoom(page);
      expect(before.room).toBeGreaterThan(0);

      const box = await page.locator(WORKSPACE).boundingBox();
      // The poster has to keep the majority of the screen on a small laptop.
      expect(box.height).toBeGreaterThanOrEqual(viewport.height * 0.6);

      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 300);
      await expect
        .poll(async () => (await scrollRoom(page)).top, { timeout: 5000 })
        .toBeGreaterThan(before.top + 100);
    });

    test('clicking Footer brings the footer band inside the viewport', async ({ page }) => {
      await openEditor(page);

      await page.getByRole('tab', { name: 'Footer' }).click();

      const band = await page.locator('[data-section="footer"]').first().boundingBox();
      expect(band.y).toBeGreaterThanOrEqual(0);
      expect(band.y + band.height).toBeLessThanOrEqual(viewport.height);
      await expect(page.getByRole('tab', { name: 'Footer' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
    });

    test('Alt+3 steps into the footer the same way', async ({ page }) => {
      await openEditor(page);

      await page.locator(WORKSPACE).click({ position: { x: 8, y: 8 } });
      await page.keyboard.press('Alt+3');

      await expect(page.getByRole('tab', { name: 'Footer' })).toHaveAttribute(
        'aria-selected',
        'true'
      );
      const band = await page.locator('[data-section="footer"]').first().boundingBox();
      expect(band.y).toBeGreaterThanOrEqual(0);
      expect(band.y + band.height).toBeLessThanOrEqual(viewport.height);
    });

    test('Ctrl+wheel zooms the poster instead of the browser', async ({ page }) => {
      await openEditor(page);

      const percent = () =>
        page
          .locator('[aria-label="Zoom percentage"]')
          .inputValue()
          .then((text) => Number(text.replace(/[^0-9]/g, '')));
      const startValue = await percent();

      await page.locator(WORKSPACE).evaluate((node) => {
        node.dispatchEvent(
          new WheelEvent('wheel', {
            deltaY: -240,
            ctrlKey: true,
            bubbles: true,
            cancelable: true,
          })
        );
      });

      await expect.poll(percent, { timeout: 5000 }).toBeGreaterThan(startValue);
    });

    test('a first visit to an area shows it as wide as the work area', async ({ page }) => {
      await openEditor(page);

      await page.getByRole('tab', { name: 'Header' }).click();
      await expect
        .poll(
          async () =>
            page.evaluate(() => {
              const work = document.querySelector('[data-editor-workspace]');
              const band = document.querySelector('[data-section="header"]');
              return band.getBoundingClientRect().width / work.clientWidth;
            }),
          { timeout: 5000 }
        )
        .toBeGreaterThan(0.9);
      const band = await page.locator('[data-section="header"]').first().boundingBox();
      expect(band.y).toBeGreaterThanOrEqual(0);
    });

    test('an area keeps the zoom you left it at', async ({ page }) => {
      await openEditor(page);

      await page.getByRole('tab', { name: 'Content' }).click();
      const percent = page.locator('[aria-label="Zoom percentage"]');
      await percent.fill('150');
      await percent.press('Enter');
      await expect.poll(() => percent.inputValue()).toBe('150%');

      await page.getByRole('tab', { name: 'Footer' }).click();
      await expect.poll(() => percent.inputValue()).not.toBe('150%');

      await page.getByRole('tab', { name: 'Content' }).click();
      await expect.poll(() => percent.inputValue()).toBe('150%');
    });

    test('the bottom bar jumps to each area', async ({ page }) => {
      await openEditor(page);

      const jump = page.getByRole('group', { name: 'Jump to a part of the poster' });
      await jump.getByRole('button', { name: 'Footer' }).click();
      await expect(jump.getByRole('button', { name: 'Footer' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      const band = await page.locator('[data-section="footer"]').first().boundingBox();
      expect(band.y).toBeGreaterThanOrEqual(0);
      expect(band.y + band.height).toBeLessThanOrEqual(viewport.height);
    });

    test('another area never paints into the one being edited', async ({ page }) => {
      await openEditor(page);

      await page.getByRole('tab', { name: 'Header' }).click();
      const boxes = await page.evaluate(() => {
        const header = document.querySelector('[data-section="header"]').getBoundingClientRect();
        const clip = document.querySelector('[data-editor-clip="content"]');
        return {
          headerBottom: header.bottom,
          contentTop: clip.getBoundingClientRect().top,
          overflow: getComputedStyle(clip).overflow,
        };
      });
      expect(boxes.overflow).toBe('hidden');
      expect(boxes.contentTop).toBeGreaterThanOrEqual(boxes.headerBottom - 2);
    });

    test('the arrows move the view while nothing is picked', async ({ page }) => {
      await openEditor(page);
      await page.getByRole('tab', { name: 'Content' }).click();

      const top = () => scrollRoom(page).then((state) => state.top);
      // There has to be somewhere to travel; the view may still rest at the top.
      const before = await scrollRoom(page);
      expect(before.room).toBeGreaterThan(0);

      const startValue = await top();
      await page.keyboard.press('ArrowDown');
      await expect.poll(top, { timeout: 5000 }).toBeGreaterThan(startValue + 20);
    });

    test('words the organization has not supplied say so, and link to where they live', async ({
      page,
    }) => {
      await openEditor(page);

      await page.getByRole('tab', { name: 'Footer' }).click();
      await expect(page.getByText('Phone (set it in Brand kit)')).toBeVisible();
      await page.getByRole('button', { name: 'Open Brand kit' }).click();
      await expect(page).toHaveURL(/\/brand-kit/);
    });
  });
}
