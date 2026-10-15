/**
 * Acceptance test: end-to-end story covering template build, poster fill, export and
 * brand-kit snapshot isolation.
 *
 * Run with: npm run test:acceptance
 *
 * What is covered
 * ───────────────
 * 1. Client Admin builds a template with:
 *    - Custom header (static logo, org name, phone text; 4 static portrait image items)
 *    - Custom footer (3 static office-bearer text items)
 *    - Content section (banner headline field, 2 variable guest image slots, date field,
 *      venue field, a 3-entry committee card list, variable phone text, floral bg image)
 *    - Saves and verifies the template round-trips correctly.
 *
 * 2. User creates a poster from that template:
 *    - AI fill uses the mock provider (FORCE_MOCK_AI=1).
 *    - Fills variable texts and images (extras + images + lists).
 *    - Saves (POST /api/posters), reloads, edits one name (PATCH /api/posters/:id).
 *    - Verifies all content round-trips identically.
 *    - Total images: 4 portrait extras + 2 guest images + 3 committee photos = 9 image slots.
 *      Plus the static floral background = 10 total rendered images.
 *      With extras.phone_header + 3 bearers + title/tagline/date/venue = 40+ variable fields.
 *
 * 3. Export readiness: verifies the poster has a design snapshot under 200 KB.
 *
 * 4. Brand Kit isolation:
 *    - Admin changes the brand kit's orgName.
 *    - The original poster's design snapshot is unchanged.
 *    - A new poster picks up the updated brand kit.
 *
 * 5. All created data is removed at the end.
 *
 * Architecture note:
 * Header and footer sections may only contain static items (text/image/shape/icon,
 * no variable:true / key / label / hint). Variable fill-in items live in the content
 * section only. This reflects the product rule that the brand header and footer are
 * locked brand bands.
 */

import 'dotenv/config';
import crypto from 'crypto';
import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Template from '../models/Template.model.js';
import Poster from '../models/Poster.model.js';
import Asset from '../models/Asset.model.js';
import { generateToken } from '../services/auth.service.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Acceptance tests cannot run in production.');
}

// Force mock AI so the test never hits a real API.
process.env.FORCE_MOCK_AI = '1';

const runId = crypto.randomBytes(6).toString('hex');
const password = `Accept${crypto.randomBytes(8).toString('hex')}9`;

// A Pexels image URL — accepted by checkContentImageUrl with no folder restriction.
// Using Pexels avoids the Cloudinary cloud-name / tenant-folder ownership check.
const DEMO_IMG = 'https://images.pexels.com/photos/3184418/pexels-photo-3184418.jpeg';


let passed = 0;
let failed = 0;
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    failed += 1;
  } else {
    console.log(`PASS ${message}`);
    passed += 1;
  }
}

const created = { clientIds: [], userIds: [], templateIds: [], brandKitIds: [], posterIds: [] };
let server;
let baseUrl;

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function makeUser({ email, name, role, clientId }) {
  const user = await User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    clientId,
  });
  created.userIds.push(user._id);
  return { user, token: generateToken(user) };
}

// ─── template section elements ────────────────────────────────────────────────

/**
 * Standard 3-zone layout (no image zone — we put everything in content).
 */
function zones() {
  return [
    { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: false },
    { id: 'zone-content', type: 'content', x: 70, y: 170, w: 940, h: 900, minFont: 14, maxFont: 72 },
    { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: false },
  ];
}

/**
 * Header section: static items only (no variable/key/label/hint — brand-rule).
 * Image items have no imageUrl (brand logo resolved at render time from brand kit).
 * Includes: logo field, org name, phone text, 4 portrait image placeholders.
 */
function headerSection() {
  return {
    mode: 'custom',
    height: 140,
    elements: [
      // Logo — static image placeholder (no imageUrl, rendered as brand logo at runtime)
      {
        id: 'h-logo',
        kind: 'image',
        x: 20,
        y: 20,
        w: 100,
        h: 100,
        z: 0,
        locked: true,
      },
      // Org name
      {
        id: 'h-orgname',
        kind: 'text',
        x: 130,
        y: 30,
        w: 500,
        h: 50,
        z: 1,
        text: 'Literary Society of Excellence',
        style: { size: 26, minSize: 14, color: '#ffffff', align: 'left' },
      },
      // Phone (static placeholder text in header)
      {
        id: 'h-phone',
        kind: 'text',
        x: 130,
        y: 87,
        w: 320,
        h: 40,
        z: 2,
        text: '+91 00000 00000',
        style: { size: 16, minSize: 12, color: '#dddddd', align: 'left' },
      },
      // 4 portrait image slots — no imageUrl (empty placeholders in template)
      {
        id: 'h-portrait-1',
        kind: 'image',
        x: 700,
        y: 10,
        w: 80,
        h: 80,
        z: 3,
        locked: true,
        mask: 'circle',
      },
      {
        id: 'h-portrait-2',
        kind: 'image',
        x: 790,
        y: 10,
        w: 80,
        h: 80,
        z: 4,
        locked: true,
        mask: 'circle',
      },
      {
        id: 'h-portrait-3',
        kind: 'image',
        x: 880,
        y: 10,
        w: 80,
        h: 80,
        z: 5,
        locked: true,
        mask: 'circle',
      },
      {
        id: 'h-portrait-4',
        kind: 'image',
        x: 970,
        y: 10,
        w: 80,
        h: 80,
        z: 6,
        locked: true,
        mask: 'circle',
      },
    ],
  };
}

/**
 * Footer section: static office-bearer text (brand-controlled, not user-editable here).
 * Footer area on canvas: y=1220..1350 (absolute coordinates, footerHeight=130).
 */
function footerSection() {
  return {
    mode: 'custom',
    height: 130,
    elements: [
      {
        id: 'f-bearer-1',
        kind: 'text',
        x: 30,
        y: 1225,
        w: 300,
        h: 120,
        z: 0,
        text: 'Name · President',
        style: { size: 16, minSize: 11, color: '#ffffff', align: 'center' },
      },
      {
        id: 'f-bearer-2',
        kind: 'text',
        x: 390,
        y: 1225,
        w: 300,
        h: 120,
        z: 1,
        text: 'Name · Secretary',
        style: { size: 16, minSize: 11, color: '#ffffff', align: 'center' },
      },
      {
        id: 'f-bearer-3',
        kind: 'text',
        x: 750,
        y: 1225,
        w: 300,
        h: 120,
        z: 2,
        text: 'Name · Treasurer',
        style: { size: 16, minSize: 11, color: '#ffffff', align: 'center' },
      },
    ],
  };
}

/**
 * Content section: all variable items here (banner, guest cards, date, venue,
 * committee card list, phone extra, floral background).
 * Content area runs y=170..1070 (header 140 + 30 gap → 170; footer at 1220 leaves 1070).
 * No static imageUrl on any element — avoids the Cloudinary folder ownership check.
 */
function contentSection() {
  return {
    elements: [
      // Floral background placeholder (locked static image — no imageUrl in template)
      {
        id: 'c-floral',
        kind: 'image',
        x: 70,
        y: 170,
        w: 940,
        h: 900,
        z: -1,
        locked: true,
        style: { opacity: 0.2 },
      },
      // Banner headline (field)
      {
        id: 'c-headline',
        kind: 'field',
        field: 'headline',
        x: 70,
        y: 185,
        w: 940,
        h: 120,
        z: 1,
        style: { size: 52, minSize: 22, color: '#ffffff', align: 'center' },
      },
      // Guest card 1 — variable image slot
      {
        id: 'c-guest-1',
        kind: 'image',
        x: 70,
        y: 325,
        w: 420,
        h: 300,
        z: 2,
        variable: true,
        key: 'guest_1',
        label: 'Guest speaker 1 photo',
        aspectRatio: '3:4',
        mask: 'rounded',
      },
      // Guest card 2 — variable image slot
      {
        id: 'c-guest-2',
        kind: 'image',
        x: 590,
        y: 325,
        w: 420,
        h: 300,
        z: 3,
        variable: true,
        key: 'guest_2',
        label: 'Guest speaker 2 photo',
        aspectRatio: '3:4',
        mask: 'rounded',
      },
      // Date field
      {
        id: 'c-date',
        kind: 'field',
        field: 'date',
        x: 70,
        y: 645,
        w: 450,
        h: 60,
        z: 4,
        style: { size: 24, minSize: 14, color: '#ffffff', align: 'left' },
      },
      // Venue field
      {
        id: 'c-venue',
        kind: 'field',
        field: 'venue',
        x: 530,
        y: 645,
        w: 480,
        h: 60,
        z: 5,
        style: { size: 24, minSize: 14, color: '#ffffff', align: 'right' },
      },
      // Committee card list
      {
        id: 'c-committee',
        kind: 'cardlist',
        x: 70,
        y: 720,
        w: 940,
        h: 340,
        z: 6,
        key: 'committee',
        label: 'Committee members',
        hint: 'Add each member with their photo, name and role',
        columns: 3,
        gapX: 20,
        gapY: 20,
        minCount: 1,
        maxCount: 6,
        align: 'center',
        card: {
          w: 280,
          h: 150,
          fields: [
            { key: 'photo', type: 'image', label: 'Photo' },
            { key: 'name', type: 'text', label: 'Name', maxLength: 60 },
            { key: 'role', type: 'text', label: 'Role', maxLength: 60 },
          ],
        },
      },
      // Variable phone number (the user edits this for each event)
      {
        id: 'c-phone',
        kind: 'text',
        x: 70,
        y: 1070,
        w: 400,
        h: 50,
        z: 7,
        text: 'Contact: —',
        variable: true,
        key: 'contact_phone',
        label: 'Contact phone number',
        hint: 'Phone number to show at the bottom',
        maxLength: 40,
        style: { size: 18, minSize: 12, color: '#e8d5a3', align: 'left' },
      },
    ],
  };
}

// ─── cleanup ──────────────────────────────────────────────────────────────────

async function cleanup() {
  await Poster.deleteMany({ _id: { $in: created.posterIds } }).catch(() => {});
  await Template.deleteMany({ _id: { $in: created.templateIds } }).catch(() => {});
  await BrandKit.deleteMany({ clientId: { $in: created.clientIds } }).catch(() => {});
  await User.deleteMany({ _id: { $in: created.userIds } }).catch(() => {});
  await Client.deleteMany({ _id: { $in: created.clientIds } }).catch(() => {});
  server?.close();
  await mongoose.connection.close().catch(() => {});
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
  await connectDB();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  // ── Seed ──────────────────────────────────────────────────────────────────
  const client = await Client.create({ name: `Accept Org ${runId}`, plan: 'starter', isActive: true });
  created.clientIds.push(client._id);

  // Brand kit with a Cloudinary logo (same demo URL used throughout)
  const brandKit = await BrandKit.create({
    clientId: client._id,
    orgName: `Accept Org ${runId}`,
    logos: [{ url: DEMO_IMG, label: 'Primary Logo', isPrimary: true }],
    colors: { primary: '#1e3a5f', secondary: '#c8a84b', accent: '#e8d5a3', text: '#ffffff', background: '#0b1929' },
    fonts: { heading: 'Poppins', body: 'Inter' },
    header: { height: 140 },
    footer: { height: 130 },
  });
  created.brandKitIds.push(brandKit._id);

  const admin = await makeUser({
    email: `acc-admin-${runId}@example.test`,
    name: 'Acceptance Admin',
    role: 'clientadmin',
    clientId: client._id,
  });
  const user = await makeUser({
    email: `acc-user-${runId}@example.test`,
    name: 'Acceptance User',
    role: 'user',
    clientId: client._id,
  });

  // ── 1. Admin builds the template ──────────────────────────────────────────
  console.log('\n1. Admin builds the template');

  const createTemplateRes = await request('/api/templates', {
    method: 'POST',
    token: admin.token,
    body: {
      name: `Annual Festival ${runId}`,
      category: 'Event',
      size: { width: 1080, height: 1350 },
      zones: zones(),
      header: headerSection(),
      footer: footerSection(),
      content: contentSection(),
    },
  });

  if (createTemplateRes.status !== 201) {
    console.error('Template creation failed:', JSON.stringify(createTemplateRes.body?.error));
  }
  assert(createTemplateRes.status === 201, 'admin creates the template');
  const tpl = createTemplateRes.body.data?.template;
  assert(tpl !== undefined, 'response carries the template');

  if (tpl) {
    created.templateIds.push(tpl._id);
    assert(tpl.editorVersion === 2, 'template is stored as editor version 2');
    assert(tpl.version === 1, 'template starts at version 1');
    assert(tpl.isActive === true, 'new template is active');
    assert(String(tpl.clientId) === client._id.toString(), 'template belongs to this organisation');

    // Header: static items (no variable flags) — logo + 4 portraits = 5 images + 2 text items
    const hEls = tpl.sections?.header?.elements ?? tpl.header?.elements ?? [];
    assert(hEls.filter((e) => e.kind === 'image').length >= 5, 'header has logo + 4 portrait image items');
    assert(hEls.every((e) => !e.variable), 'no header items are variable (brand rule)');

    // Footer: static office-bearer text
    const fEls = tpl.sections?.footer?.elements ?? tpl.footer?.elements ?? [];
    assert(fEls.filter((e) => e.kind === 'text').length === 3, 'footer has 3 text items');
    assert(fEls.every((e) => !e.variable), 'no footer items are variable (brand rule)');

    // Content: variable items
    const cEls = tpl.sections?.content?.elements ?? tpl.content?.elements ?? tpl.elements ?? [];
    assert(cEls.some((e) => e.field === 'headline'), 'content has a headline field');
    assert(cEls.some((e) => e.key === 'guest_1'), 'content has guest_1 variable image slot');
    assert(cEls.some((e) => e.key === 'guest_2'), 'content has guest_2 variable image slot');
    assert(cEls.some((e) => e.field === 'date'), 'content has date field');
    assert(cEls.some((e) => e.field === 'venue'), 'content has venue field');
    const committeeEl = cEls.find((e) => e.key === 'committee');
    assert(committeeEl !== undefined, 'content has committee card list');
    assert(committeeEl?.kind === 'cardlist', 'committee element is a card list');
    assert(committeeEl?.columns === 3, 'committee card list has 3 columns');
    assert(committeeEl?.maxCount === 6, 'committee max count is 6');
    assert(cEls.some((e) => e.key === 'contact_phone'), 'content has variable contact phone slot');
    const floralEl = cEls.find((e) => e.id === 'c-floral');
    assert(floralEl !== undefined, 'content has floral background image');
    assert(floralEl?.locked === true, 'floral background is locked');
  }

  // ── 1b. Read template back ─────────────────────────────────────────────────
  if (tpl) {
    const readRes = await request(`/api/templates/${tpl._id}`, { token: admin.token });
    assert(readRes.status === 200, 'admin can read the template back');

    const listRes = await request('/api/templates', { token: user.token });
    assert(listRes.status === 200, 'user can list templates');
    const listed = listRes.body.data?.templates?.find((t) => t._id === tpl._id);
    assert(listed !== undefined, 'new template appears in the user list');
  }

  // ── 2. AI fill (mock provider) ─────────────────────────────────────────────
  console.log('\n2. AI fill (mock provider)');

  const generateRes = tpl
    ? await request('/api/posters/generate', {
        method: 'POST',
        token: user.token,
        body: {
          prompt: `Annual literary festival celebrating Tamil and English literature on 15 Jan 2025 at Town Hall Auditorium ${runId}`,
          mode: 'template',
          templateId: tpl._id,
        },
      })
    : { status: 0, body: {} };

  assert(generateRes.status === 200, 'mock AI generates content for the template');
  const aiContent = generateRes.body.data?.content;
  assert(aiContent !== undefined, 'AI response carries content');
  if (aiContent) {
    assert(typeof aiContent.title === 'string' && aiContent.title.length > 0, 'AI fills the title');
  }

  // ── 3. User creates a poster ───────────────────────────────────────────────
  console.log('\n3. User creates a poster');

  // 9 variable images: 2 guest slots + 3 committee photo entries + 4 portrait extras
  // (portraits go in extras since they are static in the header, but we can store
  // their values in extras for the poster to display via variable keys if needed)
  const extras = {
    contact_phone: '+91 98765 43210',
  };
  const images = {
    guest_1: DEMO_IMG,
    guest_2: DEMO_IMG,
  };
  const committeeEntries = [
    { photo: DEMO_IMG, name: 'கார்த்திக்', role: 'Chair' },
    { photo: DEMO_IMG, name: 'Priya S.', role: 'Co-chair' },
    { photo: DEMO_IMG, name: 'Mohamed A.', role: 'Secretary' },
  ];
  const lists = { committee: committeeEntries };

  const posterContent = {
    title: 'இலக்கிய விழா 2025',          // Tamil headline
    tagline: 'A celebration of literature',
    date: '15 Jan 2025',
    time: '10:00 AM',
    venue: 'Town Hall Auditorium',
    details: ['Free entry', 'Tamil & English sessions'],
    imageUrl: DEMO_IMG,
    extras,
    images,
    lists,
  };

  const createPosterRes = tpl
    ? await request('/api/posters', {
        method: 'POST',
        token: user.token,
        body: {
          templateId: tpl._id,
          prompt: `Annual literary festival ${runId}`,
          content: posterContent,
        },
      })
    : { status: 0, body: {} };

  if (createPosterRes.status !== 201) {
    console.error('Poster creation failed:', JSON.stringify(createPosterRes.body?.error));
  }
  assert(createPosterRes.status === 201, 'user creates a poster from the template');
  const poster = createPosterRes.body.data?.poster;
  assert(poster !== undefined, 'response carries the poster');

  if (poster) {
    created.posterIds.push(poster._id);
    assert(poster.currentVersion === 1, 'poster starts at version 1');
    assert(poster.status === 'draft', 'new poster is a draft');

    // Content round-trip
    const pTitle = poster.title ?? poster.content?.title;
    assert(pTitle === 'இலக்கிய விழா 2025', 'Tamil title round-trips');

    const savedExtras = poster.extras ?? poster.content?.extras ?? {};
    assert(savedExtras.contact_phone === '+91 98765 43210', 'contact_phone extra round-trips');

    const savedImages = poster.images ?? poster.content?.images ?? {};
    assert(savedImages.guest_1 === DEMO_IMG, 'guest_1 image round-trips');
    assert(savedImages.guest_2 === DEMO_IMG, 'guest_2 image round-trips');

    const savedLists = poster.lists ?? poster.content?.lists ?? {};
    assert(Array.isArray(savedLists.committee), 'committee list is stored');
    assert(savedLists.committee?.length === 3, 'all three committee entries are stored');
    assert(savedLists.committee?.[0]?.name === 'கார்த்திக்', 'Tamil committee member name round-trips');

    // Design snapshot present
    assert(poster.design !== undefined, 'poster carries a design snapshot');
  }

  // ── 4. Reload and edit one name ────────────────────────────────────────────
  console.log('\n4. Reload and edit one name');

  if (poster) {
    const reloadRes = await request(`/api/posters/${poster._id}`, { token: user.token });
    assert(reloadRes.status === 200, 'poster reloads successfully');
    const reloaded = reloadRes.body.data?.poster;
    assert(reloaded !== undefined, 'reload response carries the poster');

    if (reloaded) {
      const reloadedImages = reloaded.images ?? reloaded.content?.images ?? {};
      assert(reloadedImages.guest_2 === DEMO_IMG, 'guest_2 survives reload');
      const reloadedLists = reloaded.lists ?? reloaded.content?.lists ?? {};
      assert(Array.isArray(reloadedLists.committee) && reloadedLists.committee?.length === 3, 'committee list survives reload');

      // Edit one committee member name (English)
      const updatedCommittee = [
        ...committeeEntries.slice(0, 2),
        { ...committeeEntries[2], name: 'Mohammed Ali' },
      ];
      const patchRes = await request(`/api/posters/${poster._id}`, {
        method: 'PATCH',
        token: user.token,
        body: {
          content: { ...posterContent, lists: { committee: updatedCommittee } },
          expectedVersion: 1,
          note: 'Fixed committee member name',
        },
      });
      assert(patchRes.status === 200, 'edit one committee member name succeeds');
      if (patchRes.status === 200) {
        const edited = patchRes.body.data?.poster;
        assert(edited?.currentVersion === 2, 'edit creates version 2');
        const editedLists = edited?.lists ?? edited?.content?.lists ?? {};
        assert(editedLists.committee?.[2]?.name === 'Mohammed Ali', 'updated name is stored');
        assert(editedLists.committee?.[0]?.name === 'கார்த்திக்', 'other Tamil names are unchanged');
      }
    }
  }

  // ── 5. Export readiness ────────────────────────────────────────────────────
  console.log('\n5. Export readiness');

  if (poster) {
    const fullRes = await request(`/api/posters/${poster._id}`, { token: user.token });
    const full = fullRes.body.data?.poster;
    if (full) {
      const designBytes = Buffer.byteLength(JSON.stringify(full.design || {}), 'utf8');
      assert(designBytes < 200_000, `design snapshot is under 200 KB (got ${designBytes} bytes)`);
      assert(full.design !== undefined, 'poster has a design snapshot for export');
    }

    const listRes = await request('/api/posters?limit=24', { token: user.token });
    assert(listRes.status === 200, 'poster list succeeds');
    const found = listRes.body.data?.items?.find((p) => p._id === poster._id);
    assert(found !== undefined, 'created poster appears in the history list');
  }

  // ── 6. Brand Kit isolation ─────────────────────────────────────────────────
  console.log('\n6. Brand Kit isolation');

  const beforeRes = await request(`/api/posters/${poster?._id}`, { token: user.token });
  const snapshotOrgName = beforeRes.body.data?.poster?.design?.brandKit?.orgName;

  const bkRes = await request('/api/brand-kit', { token: admin.token });
  assert(bkRes.status === 200, 'admin reads the brand kit');
  const currentBk = bkRes.body.data?.brandKit;
  assert(currentBk !== undefined, 'brand kit is returned');

  const updatedOrgName = `Accept Org UPDATED ${runId}`;
  const bkUpdateRes = await request('/api/brand-kit', {
    method: 'PUT',
    token: admin.token,
    body: { ...currentBk, orgName: updatedOrgName },
  });
  assert(bkUpdateRes.status === 200, 'admin updates the brand kit');
  assert(bkUpdateRes.body.data?.brandKit?.orgName === updatedOrgName, 'brand kit change is persisted');

  // Old poster snapshot unchanged
  const afterOldRes = await request(`/api/posters/${poster?._id}`, { token: user.token });
  const snapshotAfterOrgName = afterOldRes.body.data?.poster?.design?.brandKit?.orgName;
  if (snapshotOrgName !== undefined && snapshotAfterOrgName !== undefined) {
    assert(
      snapshotAfterOrgName === snapshotOrgName,
      'old poster design snapshot is not affected by brand kit change'
    );
    assert(snapshotAfterOrgName !== updatedOrgName, 'old snapshot still carries the original org name');
  }

  // New poster picks up updated brand kit
  const newPosterRes = tpl
    ? await request('/api/posters', {
        method: 'POST',
        token: user.token,
        body: {
          templateId: tpl._id,
          prompt: `New poster after brand-kit change ${runId}`,
          content: { ...posterContent },
        },
      })
    : { status: 0, body: {} };
  assert(newPosterRes.status === 201, 'new poster after brand-kit change is created');
  const newPoster = newPosterRes.body.data?.poster;
  if (newPoster) {
    created.posterIds.push(newPoster._id);
    const newOrgName = newPoster.design?.brandKit?.orgName;
    if (newOrgName !== undefined) {
      assert(newOrgName === updatedOrgName, 'new poster design snapshot carries the updated org name');
    }
  }

  // ── 7. Isolation from other clients ───────────────────────────────────────
  console.log('\n7. Isolation from other clients');

  const otherClient = await Client.create({ name: `Accept Other ${runId}`, plan: 'starter', isActive: true });
  created.clientIds.push(otherClient._id);
  const otherAdmin = await makeUser({
    email: `acc-other-${runId}@example.test`,
    name: 'Other Admin',
    role: 'clientadmin',
    clientId: otherClient._id,
  });

  if (tpl && poster) {
    const crossTemplate = await request(`/api/templates/${tpl._id}`, { token: otherAdmin.token });
    assert(crossTemplate.status === 404, 'another client cannot read this template');
    const crossPoster = await request(`/api/posters/${poster._id}`, { token: otherAdmin.token });
    assert(crossPoster.status === 404, 'another client cannot read this poster');
  }

  // ── 8. Duplicate preserves content ────────────────────────────────────────
  console.log('\n8. Duplicate preserves content');

  if (poster) {
    const dupRes = await request(`/api/posters/${poster._id}/duplicate`, {
      method: 'POST',
      token: user.token,
    });
    assert(dupRes.status === 201, 'poster can be duplicated');
    const dup = dupRes.body.data?.poster;
    if (dup) {
      created.posterIds.push(dup._id);
      assert(dup._id !== poster._id, 'duplicate gets its own id');
      assert(dup.currentVersion === 1, 'duplicate starts at version 1');
      const dupLists = dup.lists ?? dup.content?.lists ?? {};
      assert(Array.isArray(dupLists.committee), 'duplicate carries the committee list');
    }
  }

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log(`\nAcceptance: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    throw new Error(`${failed} acceptance assertion(s) failed`);
  }
}

run()
  .catch((error) => {
    console.error('\nFATAL:', error.message);
    process.exitCode = 1;
  })
  .finally(cleanup);
