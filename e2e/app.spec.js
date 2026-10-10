import { test, expect } from '@playwright/test';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

import User from '../server/models/User.model.js';
import Client from '../server/models/Client.model.js';
import BrandKit from '../server/models/BrandKit.model.js';
import Template from '../server/models/Template.model.js';
import Poster from '../server/models/Poster.model.js';

const PASSWORD = 'Password12345!';
const SUPERADMIN_EMAIL = 'e2e-superadmin@playwright.test';
const CLIENTADMIN_EMAIL = 'e2e-clientadmin@playwright.test';
const USER_EMAIL = 'e2e-user@playwright.test';

let testClient;
let testTemplate;

test.beforeAll(async () => {
  if (process.env.MONGODB_URI && mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // Cleanup old test fixtures if any remain
  await User.deleteMany({
    email: { $in: [SUPERADMIN_EMAIL, CLIENTADMIN_EMAIL, USER_EMAIL] },
  });
  await Client.deleteMany({ name: 'E2E Playwright Client' });

  // Create test client
  testClient = await Client.create({
    name: 'E2E Playwright Client',
    contactEmail: 'e2e-client@playwright.test',
  });

  // Create BrandKit for client
  await BrandKit.create({
    clientId: testClient._id,
    orgName: 'E2E Playwright Org',
    colors: { primary: '#2563EB', background: '#FFFFFF' },
  });

  // Create an active template for client
  testTemplate = await Template.create({
    clientId: testClient._id,
    name: 'E2E Test Template',
    category: 'Event',
    isActive: true,
    isDefault: true,
    editorVersion: 2,
    size: { width: 1080, height: 1350 },
    elements: [
      {
        id: 'head-e2e',
        kind: 'field',
        field: 'headline',
        text: 'Headline goes here',
        x: 60,
        y: 200,
        w: 960,
        h: 120,
        style: { size: 64, color: '#000000' },
      },
    ],
    zones: [
      { id: 'zh', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
      { id: 'zc', type: 'content', x: 0, y: 140, w: 1080, h: 1080, locked: false },
      { id: 'zf', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
    ],
  });

  // Create Superadmin
  const superHash = await User.hashPassword(PASSWORD);
  await User.create({
    name: 'E2E Super Admin',
    email: SUPERADMIN_EMAIL,
    passwordHash: superHash,
    role: 'superadmin',
    isActive: true,
  });

  // Create Client Admin
  const clientHash = await User.hashPassword(PASSWORD);
  await User.create({
    name: 'E2E Client Admin',
    email: CLIENTADMIN_EMAIL,
    passwordHash: clientHash,
    role: 'clientadmin',
    clientId: testClient._id,
    isActive: true,
  });

  // Create Normal User
  const userHash = await User.hashPassword(PASSWORD);
  await User.create({
    name: 'E2E Normal User',
    email: USER_EMAIL,
    passwordHash: userHash,
    role: 'user',
    clientId: testClient._id,
    isActive: true,
  });
});

test.afterAll(async () => {
  if (testClient) {
    await Poster.deleteMany({ clientId: testClient._id });
    await Template.deleteMany({ clientId: testClient._id });
    await BrandKit.deleteMany({ clientId: testClient._id });
    await Client.findByIdAndDelete(testClient._id);
  }
  await User.deleteMany({
    email: { $in: [SUPERADMIN_EMAIL, CLIENTADMIN_EMAIL, USER_EMAIL] },
  });

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
});

async function loginUser(page, email, password) {
  await page.goto('/login');
  await page.waitForLoadState('networkidle');
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.pathname.endsWith('/login'), { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('E2E Role navigation and Poster creation', () => {
  test('1. each role sees the right menu', async ({ page }) => {
    // 1a. Superadmin: sees Organizations and Users
    await loginUser(page, SUPERADMIN_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/clients|\/dashboard|\/create/);
    const superNav = page.locator('nav, aside');
    await expect(superNav.getByText(/Organizations/i)).toBeVisible();
    await expect(superNav.getByText(/Users/i)).toBeVisible();

    // Logout
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 1b. Client Admin: sees Dashboard, Create, Posters, Brand kit, Templates, Team; but NOT Organizations
    await loginUser(page, CLIENTADMIN_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/dashboard/);
    const clientNav = page.locator('nav, aside');
    await expect(clientNav.getByText(/Dashboard/i)).toBeVisible();
    await expect(clientNav.getByText(/Brand kit/i)).toBeVisible();
    await expect(clientNav.getByText(/Templates/i)).toBeVisible();
    await expect(clientNav.getByText(/Organizations/i)).toHaveCount(0);

    // Logout
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // 1c. Normal User: sees Create, Posters; but NOT Brand kit, Templates, Organizations
    await loginUser(page, USER_EMAIL, PASSWORD);
    await expect(page).toHaveURL(/\/create/);
    const userNav = page.locator('nav, aside, header');
    await expect(userNav.getByText(/Create/i).first()).toBeVisible();
    await expect(userNav.getByText(/Posters/i).first()).toBeVisible();
    await expect(userNav.getByText(/Organizations/i)).toHaveCount(0);
    await expect(userNav.getByText(/Brand kit/i)).toHaveCount(0);
  });

  test('2. create a poster and download a PNG', async ({ page }) => {
    await loginUser(page, CLIENTADMIN_EMAIL, PASSWORD);
    await page.goto('/create');
    await page.waitForLoadState('networkidle');

    // Enter prompt into description textarea
    const textarea = page.locator('textarea');
    await textarea.fill('Annual Tech Championship Hackathon 2026');

    // Click generate button
    const generateBtn = page.getByRole('button', {
      name: /Generate poster|Designing your poster/i,
    });
    await generateBtn.click();

    // Wait for the poster to render on canvas
    await expect(page.locator('#poster-canvas-root').first()).toBeVisible({ timeout: 20000 });

    // Click Download button to open menu
    const downloadBtn = page.getByRole('button', { name: /^Download$/i });
    await expect(downloadBtn).toBeVisible({ timeout: 15000 });
    await downloadBtn.click();

    // Listen for download event when clicking Download PNG
    const downloadItem = page.getByRole('menuitem', { name: /Download PNG/i });
    await expect(downloadItem).toBeVisible();

    const [download] = await Promise.all([
      page.waitForEvent('download', { timeout: 30000 }),
      downloadItem.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(/\.png$/i);
  });

  test('3. a normal user cannot open an admin page', async ({ page }) => {
    await loginUser(page, USER_EMAIL, PASSWORD);

    // Try navigating to superadmin-only page /clients
    await page.goto('/clients');
    await page.waitForLoadState('networkidle');

    // Should redirect to access-denied
    await expect(page).toHaveURL(/\/access-denied/);
    await expect(page.getByText(/access/i).first()).toBeVisible();
  });
});
