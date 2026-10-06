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
import Poster, { POSTER_MAX_VERSIONS } from '../models/Poster.model.js';
import { generateToken } from '../services/auth.service.js';
import storageService from '../services/storage.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Stage 8 tests cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `Stage8${crypto.randomBytes(8).toString('hex')}9`;
const OK_IMAGE = 'https://res.cloudinary.com/demo/image/upload/poster.png';
const CONFLICT_MESSAGE = 'This poster was changed somewhere else. Reload to continue.';

// Smallest valid 1x1 JPEG, used for the thumbnail upload cases.
const JPEG_BYTES = Buffer.from(
  '/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q==',
  'base64'
);
const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64'
);

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
  thumbnailPublicIds: [],
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

async function uploadThumbnail(id, token, { bytes = JPEG_BYTES, type = 'image/jpeg', name = 'thumb.jpg' } = {}) {
  const form = new FormData();
  form.append('image', new Blob([bytes], { type }), name);
  const response = await fetch(`${baseUrl}/api/posters/${id}/thumbnail`, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}` },
    body: form,
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function makeUser({ email, role, clientId }) {
  const user = await User.create({
    name: `Stage 8 ${role}`,
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
    title: 'Blood Donation Camp',
    tagline: 'Save a life',
    date: '12 Nov',
    time: '9 AM',
    venue: 'Town Hall',
    details: ['Free health check', 'Refreshments'],
    imageUrl: OK_IMAGE,
    ...overrides,
  };
}

async function savePoster(auth, templateId, prompt, content) {
  const res = await request('/api/posters', {
    method: 'POST',
    token: auth.token,
    body: { templateId: templateId.toString(), prompt, content },
  });
  if (res.status !== 201) {
    throw new Error(`poster save failed: ${res.status} ${JSON.stringify(res.body)}`);
  }
  created.posterIds.push(res.body.data.poster._id);
  return res.body.data.poster;
}

async function patchPoster(id, auth, expectedVersion, content, note) {
  return request(`/api/posters/${id}`, {
    method: 'PATCH',
    token: auth.token,
    body: { content, note, expectedVersion },
  });
}

async function cleanup() {
  for (const publicId of created.thumbnailPublicIds) {
    await storageService.deleteAsset(publicId).catch(() => {});
  }
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

  const clientA = await Client.create({ name: `Poster A ${runId}`, plan: 'starter', isActive: true });
  const clientB = await Client.create({ name: `Poster B ${runId}`, plan: 'starter', isActive: true });
  created.clientIds.push(clientA._id, clientB._id);

  const templateA = await Template.create(getDefaultTemplateData(clientA._id, `Poster A ${runId}`));
  const templateB = await Template.create(getDefaultTemplateData(clientB._id, `Poster B ${runId}`));
  created.templateIds.push(templateA._id, templateB._id);
  for (const client of [clientA, clientB]) {
    const kit = await BrandKit.create({ clientId: client._id, orgName: client.name });
    created.brandKitIds.push(kit._id);
  }

  const admin = await makeUser({ email: `s8-admin-${runId}@example.test`, role: 'clientadmin', clientId: clientA._id });
  const owner = await makeUser({ email: `s8-owner-${runId}@example.test`, role: 'user', clientId: clientA._id });
  const peer = await makeUser({ email: `s8-peer-${runId}@example.test`, role: 'user', clientId: clientA._id });
  const other = await makeUser({ email: `s8-other-${runId}@example.test`, role: 'user', clientId: clientB._id });

  // 1. Save creates version 1
  const poster = await savePoster(
    owner,
    templateA._id,
    `blood donation camp on 12 nov at town hall ${runId}`,
    validContent()
  );
  assert(poster.currentVersion === 1, 'poster starts at version 1');
  assert(poster.versions.length === 1 && poster.versions[0].note === 'Created', 'version 1 is noted as Created');
  assert(poster.status === 'draft', 'poster status is draft');
  assert(poster.clientId === clientA._id.toString(), 'poster stores the tenant from the token');

  // 2. More posters for search and pagination
  for (let index = 0; index < 3; index += 1) {
    await savePoster(
      owner,
      templateA._id,
      `annual general meeting session ${index} ${runId}`,
      validContent({ title: `AGM Session ${index}` })
    );
  }

  // 3. Search escapes regex characters
  const search = await request(`/api/posters?q=${encodeURIComponent(runId)}&limit=24`, { token: owner.token });
  assert(search.status === 200, 'search list returns 200');
  assert(search.body.data.total === 4, 'search only matches this run posters');
  assert(
    search.body.data.items.every((item) => !('versions' in item)),
    'list items do not include the versions array'
  );

  const regexSearch = await request(`/api/posters?q=${encodeURIComponent('donation.*camp')}`, { token: owner.token });
  assert(regexSearch.status === 200 && regexSearch.body.data.total === 0, 'search text is regex-escaped, not interpreted');

  // 4. Pagination
  const pageOne = await request('/api/posters?limit=2&page=1', { token: owner.token });
  const pageTwo = await request('/api/posters?limit=2&page=2', { token: owner.token });
  assert(pageOne.body.data.items.length === 2 && pageTwo.body.data.items.length === 2, 'pagination returns 2 items per page');
  assert(pageOne.body.data.pages === 2 && pageOne.body.data.total === 4, 'pagination reports total and pages');

  const badLimit = await request('/api/posters?limit=100', { token: owner.token });
  assert(badLimit.status === 400, 'limit above 24 is rejected with 400');

  // 5. Get one with versions
  const single = await request(`/api/posters/${poster._id}`, { token: owner.token });
  assert(single.status === 200 && single.body.data.poster.versions.length === 1, 'get by id includes versions');

  const badId = await request('/api/posters/123', { token: owner.token });
  assert(badId.status === 400, 'invalid poster id returns 400');

  // 6. Another user of the same client cannot see it
  const peerSingle = await request(`/api/posters/${poster._id}`, { token: peer.token });
  assert(peerSingle.status === 404, "another user's poster is hidden");
  const peerList = await request('/api/posters?limit=24', { token: peer.token });
  assert(peerList.status === 200 && peerList.body.data.items.length === 0, 'another user list shows no posters');

  const adminList = await request(`/api/posters?q=${encodeURIComponent(runId)}&limit=24`, { token: admin.token });
  assert(adminList.status === 200 && adminList.body.data.total === 4, 'clientadmin sees all posters of the client');

  // 7. Another client gets 404, and cannot save against this client template
  const crossGet = await request(`/api/posters/${poster._id}`, { token: other.token });
  assert(crossGet.status === 404, "another client's poster returns 404");
  const crossSave = await request('/api/posters', {
    method: 'POST',
    token: other.token,
    body: { templateId: templateA._id.toString(), prompt: `cross tenant save attempt ${runId}`, content: validContent() },
  });
  assert(crossSave.status === 404, 'cross-tenant templateId rejected on save');

  // 8. Invalid content rejected
  const longTitle = await request('/api/posters', {
    method: 'POST',
    token: owner.token,
    body: { templateId: templateA._id.toString(), prompt: `long title attempt ${runId}`, content: validContent({ title: 'x'.repeat(61) }) },
  });
  assert(longTitle.status === 400, 'title over 60 characters rejected');

  const tooManyDetails = await request('/api/posters', {
    method: 'POST',
    token: owner.token,
    body: { templateId: templateA._id.toString(), prompt: `too many details ${runId}`, content: validContent({ details: ['a', 'b', 'c', 'd', 'e'] }) },
  });
  assert(tooManyDetails.status === 400, 'more than 4 extra lines rejected');

  const badImage = await request('/api/posters', {
    method: 'POST',
    token: owner.token,
    body: { templateId: templateA._id.toString(), prompt: `bad image host ${runId}`, content: validContent({ imageUrl: 'https://evil.example.com/a.png' }) },
  });
  assert(badImage.status === 400, 'image url from an unknown host rejected');

  const base64Image = await request('/api/posters', {
    method: 'POST',
    token: owner.token,
    body: { templateId: templateA._id.toString(), prompt: `base64 image ${runId}`, content: validContent({ imageUrl: 'data:image/png;base64,AAAA' }) },
  });
  assert(base64Image.status === 400, 'base64 image url rejected');

  const htmlTitle = await request('/api/posters', {
    method: 'POST',
    token: owner.token,
    body: { templateId: templateA._id.toString(), prompt: `html title ${runId}`, content: validContent({ title: '<script>alert(1)</script>Health Fair' }) },
  });
  assert(htmlTitle.status === 201, 'poster with html in title accepted after cleaning');
  created.posterIds.push(htmlTitle.body.data.poster._id);
  assert(
    !htmlTitle.body.data.poster.title.includes('<') && htmlTitle.body.data.poster.title.includes('Health Fair'),
    'html tags are stripped before storing'
  );

  // 9. Versions capped at 20 (model level, throwaway poster)
  const capped = await savePoster(owner, templateA._id, `capacity check ${runId}`, validContent({ title: 'Capacity Check' }));
  const cappedDoc = await Poster.findById(capped._id);
  for (let index = 0; index < POSTER_MAX_VERSIONS + 5; index += 1) {
    cappedDoc.versions.push({
      content: validContent({ title: `Version ${index}` }),
      note: `v${index}`,
      createdBy: owner.user._id,
    });
  }
  await cappedDoc.save();
  assert(cappedDoc.versions.length === POSTER_MAX_VERSIONS, `versions capped at ${POSTER_MAX_VERSIONS}`);
  assert(cappedDoc.versions[cappedDoc.versions.length - 1].note === 'v24', 'oldest versions are dropped first');

  // 10. Update creates version 2
  const updated = await patchPoster(poster._id, owner, 1, validContent({ title: 'Blood Donation Drive' }), 'Fixed the title');
  assert(updated.status === 200, 'update with the current version number succeeds');
  assert(updated.body.data.poster.currentVersion === 2, 'update creates version 2');
  assert(updated.body.data.poster.title === 'Blood Donation Drive', 'update replaces the current content');
  assert(updated.body.data.poster.versions.length === 2, 'update appends to the history');
  const newest = updated.body.data.poster.versions[1];
  assert(newest.note === 'Fixed the title' && newest.versionNumber === 2, 'new version stores the note and number');
  assert(updated.body.data.poster.versions[0].note === 'Created', 'version 1 stays untouched in history');

  const defaultNote = await patchPoster(poster._id, owner, 2, validContent({ title: 'Blood Donation Drive v3' }));
  assert(defaultNote.status === 200 && defaultNote.body.data.poster.versions[2].note === 'Edited', 'update without a note uses a default label');

  const missingExpected = await request(`/api/posters/${poster._id}`, {
    method: 'PATCH',
    token: owner.token,
    body: { content: validContent() },
  });
  assert(missingExpected.status === 400, 'update without expectedVersion is rejected');

  const badContent = await patchPoster(poster._id, owner, 3, validContent({ title: 'x'.repeat(61) }));
  assert(badContent.status === 400, 'invalid content rejected on update without creating a version');

  // 11. 409 conflict when the poster changed elsewhere
  const conflict = await patchPoster(poster._id, owner, 1, validContent({ title: 'Stale Edit' }));
  assert(conflict.status === 409, 'stale expectedVersion returns 409');
  assert(conflict.body.error.message === CONFLICT_MESSAGE, 'conflict message asks the user to reload');
  const afterConflict = await request(`/api/posters/${poster._id}`, { token: owner.token });
  assert(
    afterConflict.body.data.poster.currentVersion === 3 && afterConflict.body.data.poster.title.includes('v3'),
    'rejected update leaves the poster untouched'
  );

  const peerPatch = await patchPoster(poster._id, peer, 3, validContent());
  assert(peerPatch.status === 404, "another user cannot edit someone's poster");

  // 12. Regeneration adds a version with its own note
  const regenerated = await request(`/api/posters/${poster._id}/versions`, {
    method: 'POST',
    token: owner.token,
    body: { content: validContent({ title: 'Donate Blood', tagline: 'Every drop counts' }), instruction: 'shorter' },
  });
  assert(regenerated.status === 200, 'regeneration endpoint accepts the new content');
  assert(regenerated.body.data.poster.currentVersion === 4, 'regeneration creates a new version');
  assert(regenerated.body.data.poster.versions[3].note === 'Shorter', 'regeneration note describes the instruction');

  const regenConflict = await request(`/api/posters/${poster._id}/versions`, {
    method: 'POST',
    token: owner.token,
    body: { content: validContent(), instruction: 'minimal', expectedVersion: 2 },
  });
  assert(regenConflict.status === 409, 'regeneration checks the version number too');

  const plainRegen = await request(`/api/posters/${poster._id}/versions`, {
    method: 'POST',
    token: owner.token,
    body: { content: validContent({ title: 'Donate Blood Save Lives' }) },
  });
  assert(plainRegen.status === 200 && plainRegen.body.data.poster.versions[4].note === 'Regenerated', 'regeneration without instruction is noted as Regenerated');

  // 13. Restore copies an old version into a new one (history is never deleted)
  const beforeRestore = (await request(`/api/posters/${poster._id}`, { token: owner.token })).body.data.poster.versions.length;
  const restored = await request(`/api/posters/${poster._id}/restore`, {
    method: 'POST',
    token: owner.token,
    body: { versionNumber: 1 },
  });
  assert(restored.status === 200, 'restore succeeds');
  assert(restored.body.data.poster.currentVersion === 6, 'restore creates a new version instead of rewinding');
  assert(restored.body.data.poster.versions.length === beforeRestore + 1, 'restore keeps every previous version');
  const restoredVersion = restored.body.data.poster.versions[restored.body.data.poster.versions.length - 1];
  assert(restoredVersion.note === 'Restored version 1', 'restore note names the source version');
  assert(restoredVersion.content.title === 'Blood Donation Camp', 'restored content is copied from the old version');
  assert(restored.body.data.poster.title === 'Blood Donation Camp', 'restoring also becomes the current content');

  const missingVersion = await request(`/api/posters/${poster._id}/restore`, {
    method: 'POST',
    token: owner.token,
    body: { versionNumber: 99 },
  });
  assert(missingVersion.status === 400, 'restoring an unknown version returns 400');

  const badRestore = await request(`/api/posters/${poster._id}/restore`, {
    method: 'POST',
    token: owner.token,
    body: { versionNumber: 0 },
  });
  assert(badRestore.status === 400, 'invalid version number rejected before touching the poster');

  const restoreConflict = await request(`/api/posters/${poster._id}/restore`, {
    method: 'POST',
    token: owner.token,
    body: { versionNumber: 1, expectedVersion: 2 },
  });
  assert(restoreConflict.status === 409, 'restore checks the version number too');

  // 14. Versions never exceed 20 through the API
  const longPoster = await savePoster(owner, templateA._id, `long history ${runId}`, validContent({ title: 'Long History 0' }));
  let running = longPoster.currentVersion;
  for (let index = 1; index <= POSTER_MAX_VERSIONS + 1; index += 1) {
    const step = await patchPoster(longPoster._id, owner, running, validContent({ title: `Long History ${index}` }));
    if (step.status !== 200) throw new Error(`version step ${index} failed with ${step.status}`);
    running = step.body.data.poster.currentVersion;
  }
  const longHistory = await request(`/api/posters/${longPoster._id}`, { token: owner.token });
  assert(longHistory.body.data.poster.currentVersion === 22, 'version numbering keeps counting past the cap');
  assert(longHistory.body.data.poster.versions.length === POSTER_MAX_VERSIONS, 'stored versions never exceed 20');
  assert(longHistory.body.data.poster.versions[0].versionNumber === 3, 'the oldest stored version is the first kept one');

  // 15. Duplicate creates a fresh draft with version 1
  const duplicate = await request(`/api/posters/${poster._id}/duplicate`, { method: 'POST', token: owner.token });
  assert(duplicate.status === 201, 'duplicate returns the new poster');
  const copy = duplicate.body.data.poster;
  created.posterIds.push(copy._id);
  assert(copy._id !== poster._id, 'duplicate has its own id');
  assert(
    copy.currentVersion === 1 && copy.versions.length === 1 && copy.versions[0].note === 'Created',
    'duplicate starts at version 1'
  );
  assert(copy.status === 'draft', 'duplicate is a draft');
  assert(copy.title === 'Blood Donation Camp', 'duplicate keeps the current title');
  assert(copy.templateId === poster.templateId, 'duplicate keeps the template');
  assert(copy.userId === owner.user._id.toString(), 'duplicate belongs to the person who copied it');
  const sourceAfterDuplicate = await request(`/api/posters/${poster._id}`, { token: owner.token });
  assert(sourceAfterDuplicate.body.data.poster.currentVersion === 6, 'duplicate does not touch the source poster');

  const peerDuplicate = await request(`/api/posters/${poster._id}/duplicate`, { method: 'POST', token: peer.token });
  assert(peerDuplicate.status === 404, "another user cannot duplicate someone's poster");

  // 16. Soft delete
  const peerDelete = await request(`/api/posters/${copy._id}`, { method: 'DELETE', token: peer.token });
  assert(peerDelete.status === 404, "another user cannot delete someone's poster");
  const crossDelete = await request(`/api/posters/${copy._id}`, { method: 'DELETE', token: other.token });
  assert(crossDelete.status === 404, 'another client cannot delete the poster');

  const deleted = await request(`/api/posters/${copy._id}`, { method: 'DELETE', token: owner.token });
  assert(deleted.status === 200, 'owner can delete their poster');
  const afterDelete = await request(`/api/posters/${copy._id}`, { token: owner.token });
  assert(afterDelete.status === 404, 'deleted poster returns 404');
  const listAfterDelete = await request(`/api/posters?q=${encodeURIComponent(runId)}&limit=24`, { token: owner.token });
  assert(
    listAfterDelete.body.data.items.every((item) => item._id !== copy._id),
    'deleted poster is excluded from the list'
  );
  const deletedRow = await Poster.findById(copy._id);
  assert(deletedRow?.isDeleted === true, 'delete is a soft flag, the document stays for audit');

  const updateDeleted = await patchPoster(copy._id, owner, 1, validContent());
  assert(updateDeleted.status === 404, 'deleted poster cannot be edited');
  const duplicateDeleted = await request(`/api/posters/${copy._id}/duplicate`, { method: 'POST', token: owner.token });
  assert(duplicateDeleted.status === 404, 'deleted poster cannot be duplicated');

  const adminDelete = await request(`/api/posters/${longPoster._id}`, { method: 'DELETE', token: admin.token });
  assert(adminDelete.status === 200, 'clientadmin can delete any poster of the client');

  // 17. Thumbnail upload
  const notAnImage = await uploadThumbnail(poster._id, owner.token, {
    bytes: Buffer.from('this is not an image at all'),
    type: 'text/plain',
    name: 'thumb.txt',
  });
  assert(notAnImage.status === 400, 'non-image thumbnail rejected');

  const pngThumbnail = await uploadThumbnail(poster._id, owner.token, { bytes: PNG_BYTES, type: 'image/png', name: 'thumb.png' });
  assert(pngThumbnail.status === 400, 'PNG thumbnail rejected, only JPEG or WebP allowed');

  const tooBig = await uploadThumbnail(poster._id, owner.token, {
    bytes: Buffer.concat([JPEG_BYTES, Buffer.alloc(400 * 1024, 7)]),
  });
  assert(tooBig.status === 413, 'thumbnail above 300 KB rejected');

  const crossThumb = await uploadThumbnail(poster._id, other.token);
  assert(crossThumb.status === 404, "another client's poster cannot get a thumbnail");

  const thumbnail = await uploadThumbnail(poster._id, owner.token);
  assert(thumbnail.status === 200, 'JPEG thumbnail uploads');
  created.thumbnailPublicIds.push(`thumbnails/${clientA._id}/${poster._id}`);
  assert(
    thumbnail.body.data.thumbnailUrl.startsWith('https://res.cloudinary.com/'),
    'thumbnail is stored as an https brand-storage URL'
  );
  const withThumbnail = await request(`/api/posters/${poster._id}`, { token: owner.token });
  assert(
    withThumbnail.body.data.poster.thumbnailUrl === thumbnail.body.data.thumbnailUrl,
    'thumbnail url is saved on the poster'
  );
  assert(withThumbnail.body.data.poster.currentVersion === 6, 'thumbnail upload does not create a version');

  const overwriting = await uploadThumbnail(poster._id, owner.token);
  assert(overwriting.status === 200, 'a second upload overwrites the same thumbnail');

  console.log(`\nStage 8 tests passed: ${passed} assertions`);
}

try {
  await run();
} catch (err) {
  console.error(`Stage 8 tests failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await cleanup().catch((err) => {
    console.error(`Stage 8 cleanup failed: ${err.message}`);
    process.exitCode = 1;
  });
}
