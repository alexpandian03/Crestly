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
  assert(designBytes(design) <= DESIGN_MAX_BYTES, 'a normal snapshot is under the 200 KB cap');
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

  // 4b. The two strips the poster draws are frozen with it
  assert(Boolean(design.bands?.header) && Boolean(design.bands?.footer), 'the snapshot keeps both strips');
  assert(design.bands.header.source === 'brand' && design.bands.header.mode === 'legacy', 'a brand kit that draws its own settings gives the poster that band');
  assert(design.bands.header.height === kitA.header.height && design.bands.header.y === 0, 'the header strip is pinned at the top at the brand height');
  assert(design.bands.footer.y === (templateA.size.height || 1350) - design.bands.footer.height, 'the footer strip is pinned to the bottom of the poster');
  assert(design.brandKit.header.mode === 'legacy' && design.brandKit.header.elements.length > 0, 'the snapshot keeps the brand band and its items');
  const originalBandsJson = JSON.stringify(design.bands);

  await BrandKit.updateOne(
    { _id: kitA._id },
    {
      $set: {
        'header.mode': 'elements',
        'header.height': 150,
        'header.elements': [
          { id: 'moved-logo', kind: 'image', x: 30, y: 40, w: 80, h: 80, imageUrl: 'brand:logo' },
          { id: 'moved-words', kind: 'text', x: 130, y: 60, w: 500, h: 60, text: 'A later band' },
        ],
      },
    }
  );
  const afterBandEdit = await request(`/api/posters/${poster._id}`, { token: owner.token });
  assert(
    JSON.stringify(afterBandEdit.body.data.poster.design.bands) === originalBandsJson,
    'a later brand band change does not move a saved poster'
  );
  const freshDesign = captureDesign({ brandKit: await BrandKit.findById(kitA._id).lean(), template: templateA.toObject() });
  assert(freshDesign.bands.header.mode === 'elements' && freshDesign.bands.header.elements.length === 2, 'a poster made now gets the band as it is laid out today');
  assert(freshDesign.bands.header.height === 150, 'a poster made now gets the band height of today');

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
  const giant = {
    header: Object.fromEntries(
      Array.from({ length: 40 }, (_, i) => [
        `key_${i}`,
        Array.from({ length: 12 }, () => ({ cell: 'z'.repeat(600) })),
      ])
    ),
  };
  let threw = false;
  try {
    captureDesign({ brandKit: giant, template: templateA.toObject() });
  } catch (err) {
    threw = err.status === 400;
  }
  assert(threw, 'a snapshot above 200 KB is rejected with a 400');

  // 11. Poster flow with 13 photos, 5 lists and 40 texts saves and reloads identically
  const megaElements = [
    {
      id: 'mega-head',
      kind: 'text',
      field: 'headline',
      text: 'Annual Innovation Conference 2026',
      x: 50,
      y: 150,
      w: 900,
      h: 80,
    },
    ...Array.from({ length: 40 }, (_, i) => ({
      id: `mega-text-${i + 1}`,
      kind: 'text',
      variable: true,
      key: `text_slot_${i + 1}`,
      label: `Topic ${i + 1}`,
      maxLength: 60,
      x: 50,
      y: 240 + (i % 20) * 40,
      w: 200,
      h: 30,
    })),
    ...Array.from({ length: 13 }, (_, i) => ({
      id: `mega-photo-${i + 1}`,
      kind: 'image',
      variable: true,
      key: `photo_slot_${i + 1}`,
      label: `Speaker Photo ${i + 1}`,
      x: 50 + (i % 4) * 200,
      y: 300 + Math.floor(i / 4) * 150,
      w: 180,
      h: 120,
    })),
    ...Array.from({ length: 5 }, (_, i) => ({
      id: `mega-list-${i + 1}`,
      kind: 'cardlist',
      key: `list_slot_${i + 1}`,
      label: `Session List ${i + 1}`,
      columns: 2,
      minCount: 0,
      maxCount: 6,
      x: 50,
      y: 400 + i * 100,
      w: 900,
      h: 200,
      card: {
        w: 300,
        h: 150,
        fields: [
          { key: 'speaker_name', type: 'text', label: 'Speaker Name', maxLength: 40 },
          { key: 'speaker_pic', type: 'image', label: 'Speaker Picture' },
        ],
        items: [],
      },
    })),
  ];

  const megaTemplate = await Template.create({
    ...getDefaultTemplateData(clientA._id, `Mega Template ${runId}`),
    editorVersion: 2,
    elements: megaElements,
  });
  created.templateIds.push(megaTemplate._id);

  const cName =
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
      ? process.env.CLOUDINARY_CLOUD_NAME
      : 'your_cloud_name';
  const cPrefix = `https://res.cloudinary.com/${cName}/image/upload/v1`;

  const megaExtras = {};
  for (let i = 1; i <= 40; i += 1) {
    megaExtras[`text_slot_${i}`] = `Speech Topic ${i}`;
  }
  const megaImages = {};
  for (let i = 1; i <= 13; i += 1) {
    megaImages[`photo_slot_${i}`] = `${cPrefix}/brand/${clientA._id}/speaker_${i}.jpg`;
  }
  const megaLists = {};
  for (let i = 1; i <= 5; i += 1) {
    megaLists[`list_slot_${i}`] = [
      {
        speaker_name: `Keynote ${i}A`,
        speaker_pic: `${cPrefix}/brand/${clientA._id}/panelist_${i}a.jpg`,
      },
      {
        speaker_name: `Keynote ${i}B`,
        speaker_pic: `${cPrefix}/brand/${clientA._id}/panelist_${i}b.jpg`,
      },
    ];
  }

  const megaContent = {
    title: 'Annual Innovation Conference 2026',
    tagline: 'Leading the Future',
    date: '15 Nov 2026',
    time: '10:00 AM',
    venue: 'Convention Center',
    details: ['Keynotes', 'Panels', 'Workshops', 'Awards'],
    imageUrl: `${cPrefix}/brand/${clientA._id}/main_hero.jpg`,
    extras: megaExtras,
    images: megaImages,
    lists: megaLists,
  };

  const megaSave = await request('/api/posters', {
    method: 'POST',
    token: owner.token,
    body: {
      templateId: megaTemplate._id.toString(),
      prompt: `Mega poster test ${runId}`,
      content: megaContent,
    },
  });
  if (megaSave.status !== 201) {
    console.error('megaSave failed:', JSON.stringify(megaSave.body));
  }
  assert(megaSave.status === 201, 'a poster with 13 photos, 5 lists and 40 texts saves successfully');
  const megaPoster = megaSave.body.data.poster;
  created.posterIds.push(megaPoster._id);

  // Snapshot size cap under 200 KB
  const megaSnapshotBytes = designBytes(megaPoster.design);
  assert(megaSnapshotBytes <= DESIGN_MAX_BYTES, 'the snapshot stays under 200 KB');

  // Reload identically
  const megaReload = await request(`/api/posters/${megaPoster._id}`, { token: owner.token });
  assert(megaReload.status === 200, 'mega poster reloads with 200');
  const reloadedPoster = megaReload.body.data.poster;
  assert(reloadedPoster.content.title === megaContent.title, 'reloaded title matches identically');
  assert(Object.keys(reloadedPoster.content.extras).length === 40, 'reloaded contains all 40 texts');
  assert(Object.keys(reloadedPoster.content.images).length === 13, 'reloaded contains all 13 photos');
  assert(Object.keys(reloadedPoster.content.lists).length === 5, 'reloaded contains all 5 lists');
  assert(
    JSON.stringify(reloadedPoster.content) === JSON.stringify(megaPoster.content),
    'poster with 13 photos, 5 lists and 40 texts saves and reloads identically'
  );

  // Modifying template or Brand Kit afterwards does not change it
  const originalMegaBrandKitName = megaPoster.design.brandKit.orgName;
  const originalMegaTemplateName = megaPoster.design.template.name;
  await BrandKit.updateOne({ _id: kitA._id }, { $set: { orgName: `Altered Kit ${runId}` } });
  await Template.updateOne({ _id: megaTemplate._id }, { $set: { name: `Altered Template ${runId}` } });
  const afterModReload = await request(`/api/posters/${megaPoster._id}`, { token: owner.token });
  const frozenDesign = afterModReload.body.data.poster.design;
  assert(
    frozenDesign.brandKit.orgName === originalMegaBrandKitName,
    'changing Brand Kit afterwards does not alter the saved poster design'
  );
  assert(
    frozenDesign.template.name === originalMegaTemplateName,
    'changing template afterwards does not alter the saved poster design'
  );

  // Duplicate copies design and content
  const megaDup = await request(`/api/posters/${megaPoster._id}/duplicate`, {
    method: 'POST',
    token: owner.token,
  });
  assert(megaDup.status === 201, 'duplicate mega poster succeeds');
  const dupPoster = megaDup.body.data.poster;
  created.posterIds.push(dupPoster._id);
  assert(Object.keys(dupPoster.content.extras).length === 40, 'duplicate preserves 40 texts');
  assert(Object.keys(dupPoster.content.images).length === 13, 'duplicate preserves 13 photos');
  assert(Object.keys(dupPoster.content.lists).length === 5, 'duplicate preserves 5 lists');
  assert(
    dupPoster.design.brandKit.orgName === originalMegaBrandKitName,
    'duplicate copies frozen original brand kit without adopting altered brand kit'
  );
  assert(
    dupPoster.design.template.name === originalMegaTemplateName,
    'duplicate copies frozen original template without adopting altered template'
  );

  // apply-latest updates design to current brand kit and template
  const applyLatestRes = await request(`/api/posters/${megaPoster._id}/apply-latest-design`, {
    method: 'POST',
    token: owner.token,
    body: { expectedVersion: megaPoster.currentVersion },
  });
  assert(applyLatestRes.status === 200, 'apply-latest works on mega poster');
  const megaAppliedPoster = applyLatestRes.body.data.poster;
  assert(
    megaAppliedPoster.design.brandKit.orgName === `Altered Kit ${runId}`,
    'apply-latest updates design to latest brand kit'
  );
  assert(
    megaAppliedPoster.design.template.name === `Altered Template ${runId}`,
    'apply-latest updates design to latest template'
  );
  assert(Object.keys(megaAppliedPoster.content.extras).length === 40, 'apply-latest preserves all 40 texts');
  assert(Object.keys(megaAppliedPoster.content.images).length === 13, 'apply-latest preserves all 13 photos');
  assert(Object.keys(megaAppliedPoster.content.lists).length === 5, 'apply-latest preserves all 5 lists');

  // Restore version 1 restores original design and content
  const restoreV1Res = await request(`/api/posters/${megaPoster._id}/restore`, {
    method: 'POST',
    token: owner.token,
    body: { versionNumber: 1, expectedVersion: megaAppliedPoster.currentVersion },
  });
  assert(restoreV1Res.status === 200, 'restore works on mega poster');
  const restoredMega = restoreV1Res.body.data.poster;
  assert(
    restoredMega.design.brandKit.orgName === originalMegaBrandKitName,
    'restore restores original brand kit look'
  );
  assert(
    restoredMega.design.template.name === originalMegaTemplateName,
    'restore restores original template look'
  );
  assert(Object.keys(restoredMega.content.extras).length === 40, 'restore preserves all 40 texts');
  assert(Object.keys(restoredMega.content.images).length === 13, 'restore preserves all 13 photos');
  assert(Object.keys(restoredMega.content.lists).length === 5, 'restore preserves all 5 lists');

  // Cross-tenant poster and foreign asset URLs rejected
  const megaCrossGet = await request(`/api/posters/${megaPoster._id}`, { token: other.token });
  assert(megaCrossGet.status === 404, "another client's poster is rejected with 404");
  const foreignUrl = `${cPrefix}/brand/${clientB._id}/foreign.jpg`;
  const badImagePatch = await request(`/api/posters/${megaPoster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: {
      expectedVersion: restoredMega.currentVersion,
      content: { ...megaContent, imageUrl: foreignUrl },
    },
  });
  assert(badImagePatch.status === 400, "another client's asset URL in imageUrl is rejected");
  const badSlotPatch = await request(`/api/posters/${megaPoster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: {
      expectedVersion: restoredMega.currentVersion,
      content: { ...megaContent, images: { ...megaImages, photo_slot_1: foreignUrl } },
    },
  });
  assert(badSlotPatch.status === 400, "another client's asset URL in images is rejected");
  const badListPatch = await request(`/api/posters/${megaPoster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: {
      expectedVersion: restoredMega.currentVersion,
      content: {
        ...megaContent,
        lists: {
          ...megaLists,
          list_slot_1: [{ speaker_name: 'Foreign', speaker_pic: foreignUrl }],
        },
      },
    },
  });
  assert(badListPatch.status === 400, "another client's asset URL in lists is rejected");

  // Base64 is rejected across imageUrl, images, and lists
  const base64Sample = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
  const b64Main = await request(`/api/posters/${megaPoster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: {
      expectedVersion: restoredMega.currentVersion,
      content: { ...megaContent, imageUrl: base64Sample },
    },
  });
  assert(b64Main.status === 400, 'base64 in imageUrl is rejected');
  const b64Slot = await request(`/api/posters/${megaPoster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: {
      expectedVersion: restoredMega.currentVersion,
      content: { ...megaContent, images: { ...megaImages, photo_slot_1: base64Sample } },
    },
  });
  assert(b64Slot.status === 400, 'base64 in images is rejected');
  const b64List = await request(`/api/posters/${megaPoster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: {
      expectedVersion: restoredMega.currentVersion,
      content: {
        ...megaContent,
        lists: {
          ...megaLists,
          list_slot_1: [{ speaker_name: 'B64', speaker_pic: base64Sample }],
        },
      },
    },
  });
  assert(b64List.status === 400, 'base64 in lists is rejected');

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
