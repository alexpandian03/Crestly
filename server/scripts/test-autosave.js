import 'dotenv/config';
import crypto from 'crypto';
import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import Poster from '../models/Poster.model.js';
import RateCounter from '../models/RateCounter.model.js';
import { generateToken } from '../services/auth.service.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Autosave tests cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `Autosave${crypto.randomBytes(8).toString('hex')}9`;

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
  passed += 1;
}

const created = {
  clientIds: [],
  userIds: [],
  templateIds: [],
  brandKitIds: [],
  posterIds: [],
};
let server;
let baseUrl;

async function request(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function makeTenant(name) {
  const client = await Client.create({
    name: `${name} ${runId}`,
    slug: `client-${runId}-${created.clientIds.length}`,
    settings: { timezone: 'Europe/London' },
  });
  created.clientIds.push(client._id);

  const brandKit = await BrandKit.create({
    clientId: client._id,
    orgName: client.name,
    colors: { primary: '#059669', secondary: '#0f172a' },
  });
  created.brandKitIds.push(brandKit._id);

  return { client, brandKit };
}

async function makeUser({ email, role, clientId }) {
  const user = await User.create({
    name: `Autosave User ${role}`,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    clientId,
  });
  created.userIds.push(user._id);
  return { user, token: generateToken(user) };
}

async function cleanup() {
  if (server) await new Promise((resolve) => server.close(resolve));
  await Promise.all([
    Client.deleteMany({ _id: { $in: created.clientIds } }),
    BrandKit.deleteMany({ _id: { $in: created.brandKitIds } }),
    User.deleteMany({ _id: { $in: created.userIds } }),
    Template.deleteMany({ _id: { $in: created.templateIds } }),
    Poster.deleteMany({ _id: { $in: created.posterIds } }),
    RateCounter.deleteMany({ key: { $regex: /^autosave:user:/ } }),
  ]);
  await mongoose.disconnect();
}

async function run() {
  await connectDB();

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  baseUrl = `http://127.0.0.1:${port}`;

  // Create tenants and users
  const { client: tenantA } = await makeTenant('Tenant A');
  const { client: tenantB } = await makeTenant('Tenant B');

  const admin1 = await makeUser({ email: `admin1-${runId}@example.com`, role: 'clientadmin', clientId: tenantA._id });
  const admin2 = await makeUser({ email: `admin2-${runId}@example.com`, role: 'clientadmin', clientId: tenantA._id });
  const user1 = await makeUser({ email: `user1-${runId}@example.com`, role: 'user', clientId: tenantA._id });
  const user2 = await makeUser({ email: `user2-${runId}@example.com`, role: 'user', clientId: tenantA._id });
  const otherAdmin = await makeUser({ email: `other-${runId}@example.com`, role: 'clientadmin', clientId: tenantB._id });

  // Create Template for Tenant A
  const templateDoc = await Template.create({
    ...getDefaultTemplateData(tenantA._id, 'Autosave Test Template'),
    name: `Template ${runId}`,
  });
  created.templateIds.push(templateDoc._id);

  // Create Poster for Tenant A owned by user1
  const posterDoc = await Poster.create({
    clientId: tenantA._id,
    userId: user1.user._id,
    templateId: templateDoc._id,
    templateVersion: 1,
    title: `Poster ${runId}`,
    prompt: 'A poster for a grand music concert on Saturday night.',
    content: {
      title: `Poster ${runId}`,
      tagline: 'Join us for music',
      date: '2026-11-15',
      time: '19:00',
      venue: 'Symphony Hall',
      details: ['Doors open at 18:30'],
      imageUrl: '',
    },
    versions: [
      {
        content: {
          title: `Poster ${runId}`,
          tagline: 'Join us for music',
          date: '2026-11-15',
          time: '19:00',
          venue: 'Symphony Hall',
          details: ['Doors open at 18:30'],
          imageUrl: '',
        },
        versionNumber: 1,
        note: 'Created',
        createdBy: user1.user._id,
        createdAt: new Date(),
      },
    ],
    currentVersion: 1,
    status: 'draft',
  });
  created.posterIds.push(posterDoc._id);

  console.log('\n--- 1. Draft saved and restored ---');

  // 1a. Template draft saved
  const tDraftRes = await request(`/api/templates/${templateDoc._id}/draft`, {
    method: 'PUT',
    token: admin1.token,
    body: {
      basedOnVersion: 1,
      data: {
        name: `Draft Template Name ${runId}`,
        category: 'Event',
      },
    },
  });
  assert(tDraftRes.status === 200, 'PUT /api/templates/:id/draft succeeds with status 200');
  assert(tDraftRes.body?.success === true, 'Template draft save returns success: true');
  assert(tDraftRes.body?.data?.draft?.data?.name === `Draft Template Name ${runId}`, 'Template draft stores modified name');
  assert(tDraftRes.body?.data?.draft?.basedOnVersion === 1, 'Template draft stores basedOnVersion: 1');

  // 1b. Template draft restored via GET /templates/:id
  const getTemplateRes = await request(`/api/templates/${templateDoc._id}`, {
    method: 'GET',
    token: admin1.token,
  });
  assert(getTemplateRes.status === 200, 'GET /api/templates/:id succeeds');
  const loadedTemplate = getTemplateRes.body?.data?.template;
  assert(Boolean(loadedTemplate?.draft), 'GET /api/templates/:id includes draft for draft creator');
  assert(loadedTemplate.draft.data.name === `Draft Template Name ${runId}`, 'Restored template draft matches saved name');
  assert(loadedTemplate.draft.basedOnVersion === 1, 'Restored template draft matches basedOnVersion');

  // 1c. Template draft restored via GET /templates/:id/draft
  const getTDraftRes = await request(`/api/templates/${templateDoc._id}/draft`, {
    method: 'GET',
    token: admin1.token,
  });
  assert(getTDraftRes.status === 200, 'GET /api/templates/:id/draft succeeds with 200');
  assert(getTDraftRes.body?.data?.draft?.data?.name === `Draft Template Name ${runId}`, 'GET /api/templates/:id/draft returns correct draft data');

  // 1d. Poster draft saved
  const pDraftRes = await request(`/api/posters/${posterDoc._id}/draft`, {
    method: 'PUT',
    token: user1.token,
    body: {
      basedOnVersion: 1,
      data: {
        content: {
          title: `Draft Poster Title ${runId}`,
          tagline: 'Draft tagline',
        },
      },
    },
  });
  assert(pDraftRes.status === 200, 'PUT /api/posters/:id/draft succeeds with status 200');
  assert(pDraftRes.body?.success === true, 'Poster draft save returns success: true');
  assert(pDraftRes.body?.data?.draft?.data?.content?.title === `Draft Poster Title ${runId}`, 'Poster draft stores modified title');
  assert(pDraftRes.body?.data?.draft?.basedOnVersion === 1, 'Poster draft stores basedOnVersion: 1');

  // 1e. Poster draft restored via GET /posters/:id
  const getPosterRes = await request(`/api/posters/${posterDoc._id}`, {
    method: 'GET',
    token: user1.token,
  });
  assert(getPosterRes.status === 200, 'GET /api/posters/:id succeeds');
  const loadedPoster = getPosterRes.body?.data?.poster;
  assert(Boolean(loadedPoster?.draft), 'GET /api/posters/:id includes draft for draft creator');
  assert(loadedPoster.draft.data.content.title === `Draft Poster Title ${runId}`, 'Restored poster draft matches title');

  // 1f. Poster draft restored via GET /posters/:id/draft
  const getPDraftRes = await request(`/api/posters/${posterDoc._id}/draft`, {
    method: 'GET',
    token: user1.token,
  });
  assert(getPDraftRes.status === 200, 'GET /api/posters/:id/draft succeeds with 200');
  assert(getPDraftRes.body?.data?.draft?.data?.content?.title === `Draft Poster Title ${runId}`, 'GET /api/posters/:id/draft returns correct draft content');

  console.log('\n--- 2. Stale basedOnVersion rejected ---');

  // 2a. Template stale version
  const staleTRes = await request(`/api/templates/${templateDoc._id}/draft`, {
    method: 'PUT',
    token: admin1.token,
    body: {
      basedOnVersion: 999, // Current version is 1
      data: { name: 'Stale Template Attempt' },
    },
  });
  assert(staleTRes.status === 409, 'Stale basedOnVersion for template draft returns 409 Conflict');

  // 2b. Poster stale version
  const stalePRes = await request(`/api/posters/${posterDoc._id}/draft`, {
    method: 'PUT',
    token: user1.token,
    body: {
      basedOnVersion: 999, // Current version is 1
      data: { content: { title: 'Stale Poster Attempt' } },
    },
  });
  assert(stalePRes.status === 409, 'Stale basedOnVersion for poster draft returns 409 Conflict');

  console.log('\n--- 3. User cannot see another\'s draft ---');

  // 3a. Admin2 viewing Template: template is visible, but draft is NOT visible
  const admin2TRes = await request(`/api/templates/${templateDoc._id}`, {
    method: 'GET',
    token: admin2.token,
  });
  assert(admin2TRes.status === 200, 'Admin 2 can view tenant template');
  assert(admin2TRes.body?.data?.template?.draft === undefined, 'Admin 2 cannot see Admin 1\'s draft in GET /templates/:id');

  // 3b. Admin2 directly requesting Admin 1's draft: 403 Forbidden
  const admin2DraftRes = await request(`/api/templates/${templateDoc._id}/draft`, {
    method: 'GET',
    token: admin2.token,
  });
  assert(admin2DraftRes.status === 403, 'Admin 2 requesting Admin 1\'s draft returns 403 Forbidden');
  assert(/cannot view another user's draft/i.test(admin2DraftRes.body?.error?.message), 'Friendly 403 error message returned');

  // 3c. Admin 1 viewing User 1's Poster: poster is visible, but draft is NOT visible
  const admin1PRes = await request(`/api/posters/${posterDoc._id}`, {
    method: 'GET',
    token: admin1.token,
  });
  assert(admin1PRes.status === 200, 'Admin 1 can view tenant poster');
  assert(admin1PRes.body?.data?.poster?.draft === undefined, 'Admin 1 cannot see User 1\'s poster draft in GET /posters/:id');

  // 3d. Admin 1 directly requesting User 1's poster draft: 403 Forbidden
  const admin1PDraftRes = await request(`/api/posters/${posterDoc._id}/draft`, {
    method: 'GET',
    token: admin1.token,
  });
  assert(admin1PDraftRes.status === 403, 'Admin 1 requesting User 1\'s poster draft returns 403 Forbidden');

  // 3e. User 2 attempting to view User 1's poster draft: 404/403
  const user2PDraftRes = await request(`/api/posters/${posterDoc._id}/draft`, {
    method: 'GET',
    token: user2.token,
  });
  assert(user2PDraftRes.status === 404 || user2PDraftRes.status === 403, 'User 2 cannot access User 1\'s poster draft (404/403)');

  console.log('\n--- 4. Draft cleared on normal Save (PATCH) ---');

  // 4a. Save template via PATCH
  const patchTRes = await request(`/api/templates/${templateDoc._id}`, {
    method: 'PATCH',
    token: admin1.token,
    body: {
      name: `Final Saved Template ${runId}`,
      expectedVersion: 1,
    },
  });
  assert(patchTRes.status === 200, 'PATCH /api/templates/:id succeeds with 200');
  assert(patchTRes.body?.data?.template?.version === 2, 'Template version bumped to 2');

  // Check template draft is now cleared
  const getClearedTRes = await request(`/api/templates/${templateDoc._id}`, {
    method: 'GET',
    token: admin1.token,
  });
  assert(getClearedTRes.body?.data?.template?.draft === undefined, 'Template draft is cleared after PATCH save');

  const getClearedTDraftRes = await request(`/api/templates/${templateDoc._id}/draft`, {
    method: 'GET',
    token: admin1.token,
  });
  assert(getClearedTDraftRes.status === 404, 'GET /templates/:id/draft returns 404 after PATCH save');

  // 4b. Save poster via PATCH
  const patchPRes = await request(`/api/posters/${posterDoc._id}`, {
    method: 'PATCH',
    token: user1.token,
    body: {
      content: {
        title: `Final Saved Poster ${runId}`,
        tagline: 'Final tagline',
      },
      expectedVersion: 1,
    },
  });
  assert(patchPRes.status === 200, 'PATCH /api/posters/:id succeeds with 200');
  assert(patchPRes.body?.data?.poster?.currentVersion === 2, 'Poster version bumped to 2');

  // Check poster draft is now cleared
  const getClearedPRes = await request(`/api/posters/${posterDoc._id}`, {
    method: 'GET',
    token: user1.token,
  });
  assert(getClearedPRes.body?.data?.poster?.draft === undefined, 'Poster draft is cleared after PATCH save');

  const getClearedPDraftRes = await request(`/api/posters/${posterDoc._id}/draft`, {
    method: 'GET',
    token: user1.token,
  });
  assert(getClearedPDraftRes.status === 404, 'GET /posters/:id/draft returns 404 after PATCH save');

  console.log('\n--- 5. Rate limiting (30 per minute per user) ---');

  // Clear rate limits before test
  await RateCounter.deleteMany({ key: `autosave:user:${admin2.user._id}` });

  // Fire 30 autosaves for admin2 on template (version 2 now)
  for (let i = 1; i <= 30; i++) {
    const res = await request(`/api/templates/${templateDoc._id}/draft`, {
      method: 'PUT',
      token: admin2.token,
      body: {
        basedOnVersion: 2,
        data: { name: `Admin 2 Draft ${i}` },
      },
    });
    assert(res.status === 200, `Autosave request ${i} allowed (status 200)`);
  }

  // The 31st request should be rejected with 429
  const rateLimitRes = await request(`/api/templates/${templateDoc._id}/draft`, {
    method: 'PUT',
    token: admin2.token,
    body: {
      basedOnVersion: 2,
      data: { name: 'Admin 2 Draft 31' },
    },
  });
  assert(rateLimitRes.status === 429, '31st autosave request within 1 minute returns 429 Too Many Requests');
  assert(/too many autosaves/i.test(rateLimitRes.body?.error?.message), '429 error message is friendly');

  console.log('\n--- 6. Request body size limit (1 MB) ---');

  // Generate payload larger than 1 MB (1024 * 1024 bytes)
  const oversizedData = 'x'.repeat(1024 * 1024 + 100);
  const oversizedRes = await request(`/api/templates/${templateDoc._id}/draft`, {
    method: 'PUT',
    token: admin1.token,
    body: {
      basedOnVersion: 2,
      data: { name: oversizedData },
    },
  });
  assert(oversizedRes.status === 413, 'Autosave payload over 1 MB returns 413 Payload Too Large');

  console.log(`\nAll Autosave tests passed: ${passed} assertions.`);
}

try {
  await run();
} catch (err) {
  console.error(`\nAutosave tests failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await cleanup().catch((err) => {
    console.error(`Cleanup failed: ${err.message}`);
    process.exitCode = 1;
  });
}
