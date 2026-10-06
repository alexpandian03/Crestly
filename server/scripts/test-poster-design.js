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
import { generateToken } from '../services/auth.service.js';
import { captureDesign, designBytes, DESIGN_MAX_BYTES } from '../services/poster/design.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Poster design tests cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `Design${crypto.randomBytes(8).toString('hex')}9`;
const OK_IMAGE = 'https://res.cloudinary.com/demo/image/upload/poster.png';
const DESIGN_NOTE = 'Updated to the latest brand design';

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
  passed += 1;
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
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function makeUser({ email, role, clientId }) {
  const user = await User.create({
    name: `Design ${role}`,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    clientId,
  });
  created.userIds.push(user._id);
  return { user, token: generateToken(user) };
}

function validContent(overrides = {}) {
  return {
    title: 'Spring Health Fair',
    tagline: 'Free checks for all',
    date: '4 Apr',
    time: '10 AM',
    venue: 'Community Hall',
    details: ['Blood pressure checks', 'Nutrition advice'],
    imageUrl: OK_IMAGE,
    ...overrides,
  };
}

function designOf(poster) {
  return poster.design;
}

async function cleanup() {
  await Poster.deleteMany({ _id: { $in: created.posterIds } }).catch(() => {});
  await Template.deleteMany({ _id: { $in: created.templateIds } }).catch(() => {});
  await BrandKit.deleteMany({ _id: { $in: created.brandKitIds } }).catch(() => {});
  await User.deleteMany({ _id: { $in: created.userIds } }).catch(() => {});
  await Client.deleteMany({ _id: { $in: created.clientIds } }).catch(() => {});
  server?.close();
  await mongoose.connection.close().catch(() => {});
}

async function run() {
  await connectDB();
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  const clientA = await Client.create({ name: `Design A ${runId}`, plan: 'starter', isActive: true });
  const clientB = await Client.create({ name: `Design B ${runId}`, plan: 'starter', isActive: true });
  created.clientIds.push(clientA._id, clientB._id);

  const templateA = await Template.create(getDefaultTemplateData(clientA._id, `Design A ${runId}`));
  created.templateIds.push(templateA._id);
  const kitA = await BrandKit.create({ clientId: clientA._id, orgName: clientA.name });
  created.brandKitIds.push(kitA._id);

  const owner = await makeUser({ email: `pd-owner-${runId}@example.test`, role: 'user', clientId: clientA._id });
  const admin = await makeUser({ email: `pd-admin-${runId}@example.test`, role: 'clientadmin', clientId: clientA._id });
  const other = await makeUser({ email: `pd-other-${runId}@example.test`, role: 'user', clientId: clientB._id });

  // 1. Saving captures the current look on the poster and on version 1
  const save = await request('/api/posters', {
    method: 'POST',
    token: owner.token,
    body: { templateId: templateA._id.toString(), prompt: `spring health fair ${runId}`, content: validContent() },
  });
  assert(save.status === 201, 'poster saves');
  const poster = save.body.data.poster;
  created.posterIds.push(poster._id);

  const design = designOf(poster);
  assert(Boolean(design), 'the saved poster carries a design snapshot');
  assert(design.brandKit?.orgName === clientA.name, 'the snapshot holds the brand kit as it was');
  assert(design.template?.templateId === templateA._id.toString(), 'the snapshot names the template it was made with');
  assert(design.template?.version === templateA.version, 'the snapshot pins the template version');
  assert(Array.isArray(design.template?.zones) && design.template.zones.length > 0, 'the snapshot keeps the template areas');
  assert(Boolean(design.capturedAt), 'the snapshot records when it was taken');
  assert(designBytes(design) <= DESIGN_MAX_BYTES, 'a normal snapshot is under the 60 KB cap');
  assert(!('clientId' in design.brandKit) && !('_id' in design.brandKit), 'the snapshot carries no tenant ids');
  const versionOneDesign = poster.versions[0].design;
  assert(Boolean(versionOneDesign) && versionOneDesign.brandKit?.orgName === clientA.name, 'version 1 keeps its own snapshot');
  const originalDesignJson = JSON.stringify({ brandKit: design.brandKit, template: design.template });

  // 2. The list gives cards the short form only
  const list = await request(`/api/posters?q=${encodeURIComponent(runId)}&limit=24`, { token: owner.token });
  assert(list.status === 200 && list.body.data.items.length === 1, 'list finds the poster');
  const listItem = list.body.data.items[0];
  assert(Boolean(listItem.design), 'list items say which look the poster wears');
  assert(!listItem.design.brandKit, 'list items do not carry the brand kit copy');
  assert(!listItem.design.template?.zones && !listItem.design.template?.layout, 'list items do not carry areas or layout');
  assert(listItem.design.template?.name, 'list items keep the template name for the card');

  // 3. The single read returns the full snapshot and the template to draw it with
  const single = await request(`/api/posters/${poster._id}`, { token: owner.token });
  assert(single.status === 200, 'get by id returns 200');
  const full = single.body.data.poster.design;
  assert(Boolean(full.brandKit) && Array.isArray(full.template?.zones), 'get by id returns the full snapshot');
  assert(
    single.body.data.template?.zones?.length === full.template.zones.length &&
      single.body.data.template?._id === full.template.templateId,
    'get by id returns the snapshot template for rendering'
  );

  // 4. Changing the brand kit and the template afterwards changes nothing on the poster
  await BrandKit.updateOne({ _id: kitA._id }, { $set: { orgName: 'Renamed Brand Kit' } });
  const renamed = await request(`/api/templates/${templateA._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { name: `Renamed Template ${runId}`, expectedVersion: templateA.version },
  });
  assert(renamed.status === 200, 'template edit succeeds');
  const afterEdits = await request(`/api/posters/${poster._id}`, { token: owner.token });
  const stillDesign = designOf(afterEdits.body.data.poster);
  assert(
    JSON.stringify({ brandKit: stillDesign.brandKit, template: stillDesign.template }) === originalDesignJson,
    'brand kit and template edits do not restyle the saved poster'
  );
  assert(
    afterEdits.body.data.template?.name === design.template.name,
    'the template returned for rendering is still the old one'
  );

  // 5. Editing text keeps the existing design
  const edited = await request(`/api/posters/${poster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: { content: validContent({ title: 'Spring Health Fair II' }), note: 'Wording', expectedVersion: 1 },
  });
  assert(edited.status === 200, 'text edit succeeds');
  const editedPoster = edited.body.data.poster;
  assert(
    JSON.stringify({ brandKit: editedPoster.design.brandKit, template: editedPoster.design.template }) === originalDesignJson,
    'a text edit keeps the existing design'
  );
  assert(
    JSON.stringify({ brandKit: editedPoster.versions[1].design.brandKit, template: editedPoster.versions[1].design.template }) ===
      originalDesignJson,
    'the new text version keeps the same look'
  );

  // 6. apply-latest-design takes the new look as a new version
  const staleApply = await request(`/api/posters/${poster._id}/apply-latest-design`, {
    method: 'POST',
    token: owner.token,
    body: { expectedVersion: 1 },
  });
  assert(staleApply.status === 409, 'apply-latest-design checks the version number');

  const applied = await request(`/api/posters/${poster._id}/apply-latest-design`, {
    method: 'POST',
    token: owner.token,
    body: { expectedVersion: editedPoster.currentVersion },
  });
  assert(applied.status === 200, 'apply-latest-design succeeds');
  const appliedPoster = applied.body.data.poster;
  assert(appliedPoster.currentVersion === editedPoster.currentVersion + 1, 'apply-latest-design adds a version');
  const appliedVersion = appliedPoster.versions[appliedPoster.versions.length - 1];
  assert(appliedVersion.note === DESIGN_NOTE, 'the new version is noted as a brand update');
  assert(appliedPoster.design.brandKit.orgName === 'Renamed Brand Kit', 'the poster now wears the new brand kit');
  assert(appliedPoster.design.template.name === `Renamed Template ${runId}`, 'the poster now wears the new template');
  assert(
    appliedVersion.design.brandKit.orgName === 'Renamed Brand Kit',
    'the new version stores the new snapshot'
  );
  assert(
    JSON.stringify({ brandKit: appliedPoster.versions[0].design.brandKit, template: appliedPoster.versions[0].design.template }) ===
      originalDesignJson,
    'older versions keep their own older snapshot'
  );

  // 7. Restoring an old version brings its look back
  const restored = await request(`/api/posters/${poster._id}/restore`, {
    method: 'POST',
    token: owner.token,
    body: { versionNumber: 1, expectedVersion: appliedPoster.currentVersion },
  });
  assert(restored.status === 200, 'restore succeeds');
  const restoredPoster = restored.body.data.poster;
  assert(
    JSON.stringify({ brandKit: restoredPoster.design.brandKit, template: restoredPoster.design.template }) === originalDesignJson,
    'restoring a version restores its design'
  );
  const restoredVersion = restoredPoster.versions[restoredPoster.versions.length - 1];
  assert(restoredVersion.note === 'Restored version 1', 'restore note names the source version');
  assert(
    JSON.stringify({ brandKit: restoredVersion.design.brandKit, template: restoredVersion.design.template }) === originalDesignJson,
    'the restored version records the old look'
  );

  // 8. Another client sees nothing
  const crossGet = await request(`/api/posters/${poster._id}`, { token: other.token });
  assert(crossGet.status === 404, "another client's poster returns 404");
  const crossApply = await request(`/api/posters/${poster._id}/apply-latest-design`, {
    method: 'POST',
    token: other.token,
    body: {},
  });
  assert(crossApply.status === 404, "another client cannot apply a design to someone's poster");

  // 9. The signed brand upload can never reuse a public id
  const sign = await request('/api/uploads/brand-image/sign', {
    method: 'POST',
    token: admin.token,
    body: { kind: 'header' },
  });
  if (sign.status === 200) {
    assert(
      !('public_id' in sign.body.data) && !('publicId' in sign.body.data),
      'the signed upload hands out no public id, so uploads cannot overwrite an asset'
    );
    assert(sign.body.data.folder === `brand/${clientA._id}`, 'the signed upload is locked to this tenant folder');
  } else {
    assert(sign.status === 503, 'without image storage the sign route says so');
  }

  // 10. Oversize snapshots are refused before anything is stored
  const giant = { header: { big: Array.from({ length: 12 }, () => ({ row: Array.from({ length: 12 }, () => ({ cell: 'z'.repeat(600) })) })) } };
  let threw = false;
  try {
    captureDesign({ brandKit: giant, template: templateA.toObject() });
  } catch (err) {
    threw = err.status === 400;
  }
  assert(threw, 'a snapshot above 60 KB is rejected with a 400');

  console.log(`\nPoster design tests passed: ${passed} assertions`);
}

try {
  await run();
} catch (err) {
  console.error(`Poster design tests failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await cleanup().catch((err) => {
    console.error(`Poster design cleanup failed: ${err.message}`);
    process.exitCode = 1;
  });
}
