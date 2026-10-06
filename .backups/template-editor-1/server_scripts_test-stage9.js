import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import http from 'http';
import mongoose from 'mongoose';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import { TEMPLATE_MAX_VERSIONS } from '../services/template/zones.js';
import { generateToken } from '../services/auth.service.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Stage 9 tests cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `Stage9${crypto.randomBytes(8).toString('hex')}9`;
const CONFLICT_MESSAGE = 'This template was changed somewhere else. Reload to continue.';

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
  passed += 1;
}

const created = { clientIds: [], userIds: [], templateIds: [] };
let server;
let baseUrl;

async function request(path, { method = 'GET', token, body, clientId } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(clientId ? { 'x-client-id': clientId } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function makeUser({ email, role, clientId }) {
  const user = await User.create({
    name: `Stage 9 ${role}`,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    clientId,
  });
  created.userIds.push(user._id);
  return { user, token: generateToken(user) };
}

function zones() {
  return [
    { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: false },
    { id: 'zone-content', type: 'content', x: 70, y: 170, w: 940, h: 640, minFont: 16, maxFont: 54 },
    { id: 'zone-image', type: 'image', x: 70, y: 830, w: 940, h: 370 },
    { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: false },
  ];
}

function templateBody(name, overrides = {}) {
  return { name, category: 'Event', size: { width: 1080, height: 1350 }, zones: zones(), ...overrides };
}

async function createTemplate(auth, name, overrides) {
  const res = await request('/api/templates', {
    method: 'POST',
    token: auth.token,
    body: templateBody(name, overrides),
  });
  if (res.status === 201) created.templateIds.push(res.body.data.template._id);
  return res;
}

const migrateScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrate-templates.js');

function runMigration() {
  try {
    return execFileSync(process.execPath, [migrateScript], { encoding: 'utf8' });
  } catch (err) {
    // Only the unique-name step may fail, when an organization already has two equal names.
    return `${err.stdout || ''}${err.stderr || ''}`;
  }
}

async function cleanup() {
  await Template.deleteMany({ _id: { $in: created.templateIds } }).catch(() => {});
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

  const clientA = await Client.create({ name: `Layout A ${runId}`, plan: 'starter', isActive: true });
  const clientB = await Client.create({ name: `Layout B ${runId}`, plan: 'starter', isActive: true });
  const clientC = await Client.create({ name: `Layout C ${runId}`, plan: 'starter', isActive: true });
  created.clientIds.push(clientA._id, clientB._id, clientC._id);

  const admin = await makeUser({ email: `s9-admin-${runId}@example.test`, role: 'clientadmin', clientId: clientA._id });
  const maker = await makeUser({ email: `s9-maker-${runId}@example.test`, role: 'user', clientId: clientA._id });
  const otherAdmin = await makeUser({ email: `s9-other-${runId}@example.test`, role: 'clientadmin', clientId: clientB._id });
  const soloAdmin = await makeUser({ email: `s9-solo-${runId}@example.test`, role: 'clientadmin', clientId: clientC._id });

  // 1. Create
  const created2 = await createTemplate(admin, `Health Camp ${runId}`);
  assert(created2.status === 201, 'clientadmin creates a template');
  const template = created2.body.data.template;
  assert(template.version === 1 && template.versions.length === 0, 'a new template is version 1 with no history');
  assert(template.isActive === true && template.isDefault === false, 'a new template is active and not the default');
  assert(template.category === 'Event', 'the chosen category is stored');
  assert(template.layout.imagePlacement === 'middle', 'layout defaults follow the photo area');
  assert(template.layout.spacing === 'normal' && template.layout.alignment === 'left', 'layout gets readable defaults');
  assert(template.size.width === 1080 && template.size.height === 1350, 'canvas size is stored');
  assert(String(template.clientId) === clientA._id.toString(), 'template stores the tenant from the token');
  assert(String(template.createdBy) === admin.user._id.toString(), 'template records who created it');

  // 2. Header and footer are always locked, and their text is never taken from the client
  const lockedResult = await createTemplate(admin, `Locked Bands ${runId}`, {
    zones: zones().map((zone) =>
      zone.type === 'header'
        ? { ...zone, locked: false, content: '<b>Our banner</b>', text: 'anything' }
        : zone
    ),
  });
  assert(lockedResult.status === 201, 'template with an unlocked header is accepted');
  const storedHeader = lockedResult.body.data.template.zones.find((zone) => zone.type === 'header');
  assert(storedHeader.locked === true, 'header is stored locked even though the client sent it unlocked');
  assert(storedHeader.content === undefined && storedHeader.text === undefined, 'header text from the client is ignored');
  const storedFooter = lockedResult.body.data.template.zones.find((zone) => zone.type === 'footer');
  assert(storedFooter.locked === true, 'footer is stored locked too');

  // 3. Validation failures
  const overlapping = zones().map((zone) => (zone.type === 'content' ? { ...zone, y: 100, h: 700 } : zone));
  const overlapResult = await createTemplate(admin, `Overlap ${runId}`, { zones: overlapping });
  assert(overlapResult.status === 400, 'a content area that overlaps the header is rejected');
  assert(/overlap/i.test(overlapResult.body.error.message), 'overlap rejection explains the problem');

  const outside = zones().map((zone) => (zone.type === 'footer' ? { ...zone, y: 1250, h: 130 } : zone));
  const outsideResult = await createTemplate(admin, `Outside ${runId}`, { zones: outside });
  assert(outsideResult.status === 400, 'an area outside the canvas is rejected');
  assert(/inside the poster/i.test(outsideResult.body.error.message), 'out of bounds rejection explains the problem');

  const twoContent = zones().map((zone) => (zone.type === 'image' ? { ...zone, id: 'zone-content-2', type: 'content' } : zone));
  const twoContentResult = await createTemplate(admin, `Two Content ${runId}`, { zones: twoContent });
  assert(twoContentResult.status === 400, 'two content areas are rejected');

  const tooSmall = zones().map((zone) => (zone.type === 'content' ? { ...zone, w: 100, h: 640 } : zone));
  assert((await createTemplate(admin, `Too Small ${runId}`, { zones: tooSmall })).status === 400, 'an area narrower than 120 is rejected');

  const shortContent = zones().map((zone) => (zone.type === 'content' ? { ...zone, h: 400 } : zone));
  assert((await createTemplate(admin, `Short Content ${runId}`, { zones: shortContent })).status === 400, 'a content area under 40% height is rejected');

  const noHeader = zones().filter((zone) => zone.type !== 'header');
  assert((await createTemplate(admin, `No Header ${runId}`, { zones: noHeader })).status === 400, 'a template without a header area is rejected');

  const twoImages = [...zones(), { id: 'zone-image-2', type: 'image', x: 70, y: 830, w: 940, h: 370 }];
  assert((await createTemplate(admin, `Two Photos ${runId}`, { zones: twoImages })).status === 400, 'two photo areas are rejected');

  const textSizes = zones().map((zone) => (zone.type === 'content' ? { ...zone, minFont: '16' } : zone));
  assert((await createTemplate(admin, `Text Sizes ${runId}`, { zones: textSizes })).status === 400, 'text sizes must be numbers, not text');

  const bigFont = zones().map((zone) => (zone.type === 'content' ? { ...zone, maxFont: 400 } : zone));
  assert((await createTemplate(admin, `Big Font ${runId}`, { zones: bigFont })).status === 400, 'text size above 200 is rejected');

  const flipped = zones().map((zone) => (zone.type === 'content' ? { ...zone, minFont: 60, maxFont: 30 } : zone));
  assert((await createTemplate(admin, `Flipped ${runId}`, { zones: flipped })).status === 400, 'smallest text size above the largest is rejected');

  const wideCanvas = zones().map((zone) => (zone.type === 'footer' ? { ...zone, w: 2600 } : zone));
  assert((await createTemplate(admin, `Wide Canvas ${runId}`, { zones: wideCanvas, size: { width: 2600, height: 1350 } })).status === 400, 'canvas wider than 2400 is rejected');

  const tallCanvas = await createTemplate(admin, `Tall Canvas ${runId}`, { size: { width: 1080, height: 400 } });
  assert(tallCanvas.status === 400, 'canvas shorter than 600 is rejected');

  const twoHeaders = [...zones(), { id: 'zone-header-2', type: 'header', x: 0, y: 0, w: 1080, h: 140 }];
  assert((await createTemplate(admin, `Two Headers ${runId}`, { zones: twoHeaders })).status === 400, 'two header areas are rejected');

  const dupeIds = zones().map((zone) => (zone.type === 'image' ? { ...zone, id: 'zone-content' } : zone));
  assert((await createTemplate(admin, `Same Ids ${runId}`, { zones: dupeIds })).status === 400, 'two areas sharing a name are rejected');

  const nothingInside = await createTemplate(admin, `Empty ${runId}`, { zones: [] });
  assert(nothingInside.status === 400, 'a template with no areas is rejected');

  assert((await createTemplate(admin, `Bad Category ${runId}`, { category: 'Fundraiser' })).status === 400, 'unknown category is rejected');
  const customCategory = await createTemplate(admin, `Custom Category ${runId}`, { category: 'Custom' });
  assert(customCategory.status === 201, 'Custom is a valid category');

  // 4. Names are unique per organization, ignoring capitalisation
  const clash = await createTemplate(admin, `health camp ${runId}`);
  assert(clash.status === 409, 'same template name in another capitalisation is rejected');
  assert(/already exists/i.test(clash.body.error.message), 'name clash asks for another name');

  const otherClientName = await createTemplate(otherAdmin, `Health Camp ${runId}`);
  assert(otherClientName.status === 201, 'another organization may use the same name');

  // 5. Update creates a version and keeps the old state
  const moved = zones().map((zone) => (zone.type === 'content' ? { ...zone, minFont: 20, locked: false } : zone));
  const updated = await request(`/api/templates/${template._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { zones: moved, note: 'Bigger smallest text', expectedVersion: 1 },
  });
  assert(updated.status === 200, 'update with the current version number succeeds');
  assert(updated.body.data.template.version === 2, 'update increments the version');
  assert(updated.body.data.template.versions.length === 1, 'update archives the previous state');
  const archived = updated.body.data.template.versions[0];
  assert(archived.version === 1 && archived.zones.length === 4, 'the archived state is version 1 with its areas');
  assert(archived.note === 'Bigger smallest text', 'the archived state keeps the note');
  assert(
    updated.body.data.template.zones.find((zone) => zone.type === 'content').minFont === 20,
    'update stores the new text size'
  );

  const unlockedHeader = await request(`/api/templates/${template._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { zones: zones().map((zone) => ({ ...zone, locked: false })), expectedVersion: 2 },
  });
  assert(unlockedHeader.status === 200, 'update accepts a zone set that asks for an unlocked header');
  assert(
    unlockedHeader.body.data.template.zones.filter((zone) => zone.type === 'header' || zone.type === 'footer').every((zone) => zone.locked === true),
    'update still forces header and footer locked'
  );

  const staleUpdate = await request(`/api/templates/${template._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { name: `Renamed ${runId}`, expectedVersion: 1 },
  });
  assert(staleUpdate.status === 409, 'stale expectedVersion returns 409');
  assert(staleUpdate.body.error.message === CONFLICT_MESSAGE, 'conflict message asks the user to reload');

  const badPatch = await request(`/api/templates/${template._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { zones: overlapping, expectedVersion: 3 },
  });
  assert(badPatch.status === 400, 'invalid zones on update are rejected before saving');
  const untouched = await request(`/api/templates/${template._id}`, { token: admin.token });
  assert(untouched.body.data.template.version === 3, 'rejected update does not create a version');

  const emptyPatch = await request(`/api/templates/${template._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { note: 'nothing changed', expectedVersion: 3 },
  });
  assert(emptyPatch.status === 400, 'an update with no actual change is rejected');

  // 6. Version history never grows past 10
  let running = untouched.body.data.template.version;
  for (let index = 0; index < TEMPLATE_MAX_VERSIONS + 3; index += 1) {
    const step = await request(`/api/templates/${template._id}`, {
      method: 'PATCH',
      token: admin.token,
      body: { name: `History Step ${index} ${runId}`, expectedVersion: running },
    });
    if (step.status !== 200) throw new Error(`version step ${index} failed with ${step.status}`);
    running = step.body.data.template.version;
  }
  const history = await request(`/api/templates/${template._id}`, { token: admin.token });
  assert(history.body.data.template.versions.length === TEMPLATE_MAX_VERSIONS, 'stored versions never exceed 10');
  assert(history.body.data.template.version === running, 'version numbering keeps counting past the cap');
  const oldest = history.body.data.template.versions[0];
  assert(oldest.version === running - TEMPLATE_MAX_VERSIONS, 'the oldest archived state is dropped first');

  // 7. Restore makes an old state into a new version
  const beforeRestore = history.body.data.template.versions.length;
  const restoreTarget = history.body.data.template.versions[0].version;
  const restore = await request(`/api/templates/${template._id}/restore`, {
    method: 'POST',
    token: admin.token,
    body: { version: restoreTarget },
  });
  assert(restore.status === 200, 'restore from an archived version succeeds');
  assert(restore.body.data.template.version === running + 1, 'restore creates a new version instead of rewinding');
  assert(restore.body.data.template.versions.length === beforeRestore, 'restore keeps the history size at the cap');
  const missingRestore = await request(`/api/templates/${template._id}/restore`, {
    method: 'POST',
    token: admin.token,
    body: { version: 1 },
  });
  assert(missingRestore.status === 400, 'restoring a version that is no longer stored returns 400');
  const badRestore = await request(`/api/templates/${template._id}/restore`, {
    method: 'POST',
    token: admin.token,
    body: { version: 0 },
  });
  assert(badRestore.status === 400, 'invalid version number rejected before touching the template');

  // 8. Duplicate makes an inactive copy
  const duplicate = await request(`/api/templates/${template._id}/duplicate`, { method: 'POST', token: admin.token });
  assert(duplicate.status === 201, 'duplicate returns a copy');
  const copy = duplicate.body.data.template;
  created.templateIds.push(copy._id);
  assert(copy._id !== template._id, 'the copy has its own id');
  assert(copy.name.endsWith(' copy'), 'the copy is named after the original');
  assert(copy.isActive === false, 'the copy stays inactive until it is activated');
  assert(copy.version === 1 && copy.versions.length === 0, 'the copy starts at version 1 with no history');
  assert(copy.zones.length === template.zones.length, 'the copy keeps the same areas');
  assert(copy.layout.imagePlacement === template.layout.imagePlacement, 'the copy keeps the layout choices');

  const secondCopy = await request(`/api/templates/${template._id}/duplicate`, { method: 'POST', token: admin.token });
  assert(secondCopy.status === 201 && secondCopy.body.data.template.name.endsWith('copy 2'), 'a second copy gets its own name');
  created.templateIds.push(secondCopy.body.data.template._id);

  const activate = await request(`/api/templates/${copy._id}/activate`, { method: 'POST', token: admin.token });
  assert(activate.status === 200 && activate.body.data.template.isActive === true, 'activate makes the copy available');
  const deactivate = await request(`/api/templates/${copy._id}/deactivate`, { method: 'POST', token: admin.token });
  assert(deactivate.status === 200 && deactivate.body.data.template.isActive === false, 'deactivate hides the copy again');

  // 9. Last active template of an organization is protected
  const onlyOne = await createTemplate(soloAdmin, `Solo Template ${runId}`);
  assert(onlyOne.status === 201, 'admin of an empty organization creates a template');
  const blockLast = await request(`/api/templates/${onlyOne.body.data.template._id}/deactivate`, {
    method: 'POST',
    token: soloAdmin.token,
  });
  assert(blockLast.status === 400, 'the last active template cannot be deactivated');
  assert(blockLast.body.error.message === 'Keep at least one active template.', 'the protection message tells what to do');

  const secondOne = await createTemplate(soloAdmin, `Second Template ${runId}`);
  const nowTwo = await request(`/api/templates/${onlyOne.body.data.template._id}/deactivate`, {
    method: 'POST',
    token: soloAdmin.token,
  });
  assert(nowTwo.status === 200 && nowTwo.body.data.template.isActive === false, 'with two templates one can go inactive');
  const blockAgain = await request(`/api/templates/${secondOne.body.data.template._id}/deactivate`, {
    method: 'POST',
    token: soloAdmin.token,
  });
  assert(blockAgain.status === 400, 'deactivating the remaining active template is blocked again');

  // 10. Who may see what
  const makerList = await request('/api/templates', { token: maker.token });
  assert(makerList.status === 200, 'a regular user can list templates');
  assert(
    makerList.body.data.templates.every((item) => item.isActive === true),
    'a regular user only sees available templates'
  );
  assert(makerList.body.data.templates.every((item) => !('versions' in item)), 'list items carry no change history');
  assert(
    makerList.body.data.templates.every(
      (item) => item.name && item.category && item.size && item.layout && Array.isArray(item.zones) && item.updatedAt
    ),
    'list items carry name, category, size, layout, zones and the changed date'
  );
  assert(
    makerList.body.data.templates.every((item) => item.zones.every((zone) => zone.w && zone.h && zone.type)),
    'list zones keep their shape'
  );

  const adminList = await request('/api/templates', { token: admin.token });
  assert(adminList.status === 200, 'clientadmin can list templates');
  assert(adminList.body.data.templates.some((item) => item.isActive === false), 'clientadmin also sees inactive templates');
  assert(
    adminList.body.data.templates.length > makerList.body.data.templates.length,
    'the admin list is longer than the user list'
  );

  const makerSingle = await request(`/api/templates/${copy._id}`, { token: maker.token });
  assert(makerSingle.status === 404, 'a regular user cannot open an inactive template');
  const adminSingle = await request(`/api/templates/${copy._id}`, { token: admin.token });
  assert(adminSingle.status === 200, 'clientadmin can open an inactive template');

  const badId = await request('/api/templates/123', { token: admin.token });
  assert(badId.status === 400, 'invalid template id returns 400');

  // 11. A regular user cannot create or change templates
  const userCreate = await request('/api/templates', { method: 'POST', token: maker.token, body: templateBody(`User Try ${runId}`) });
  assert(userCreate.status === 403, 'a regular user cannot create a template');
  const userPatch = await request(`/api/templates/${template._id}`, {
    method: 'PATCH',
    token: maker.token,
    body: { name: `Hijacked ${runId}`, expectedVersion: running + 1 },
  });
  assert(userPatch.status === 403, 'a regular user cannot edit a template');
  const userDuplicate = await request(`/api/templates/${template._id}/duplicate`, { method: 'POST', token: maker.token });
  assert(userDuplicate.status === 403, 'a regular user cannot duplicate a template');
  const userDeactivate = await request(`/api/templates/${template._id}/deactivate`, { method: 'POST', token: maker.token });
  assert(userDeactivate.status === 403, 'a regular user cannot deactivate a template');
  const noToken = await request('/api/templates');
  assert(noToken.status === 401, 'templates need a login');

  // 12. Another organization cannot reach these templates
  const crossGet = await request(`/api/templates/${template._id}`, { token: otherAdmin.token });
  assert(crossGet.status === 404, "another client's template is a 404");
  const crossPatch = await request(`/api/templates/${template._id}`, {
    method: 'PATCH',
    token: otherAdmin.token,
    body: { name: `Stolen ${runId}`, expectedVersion: 1 },
  });
  assert(crossPatch.status === 404, "another client cannot edit the template");
  const crossDuplicate = await request(`/api/templates/${template._id}/duplicate`, { method: 'POST', token: otherAdmin.token });
  assert(crossDuplicate.status === 404, "another client cannot duplicate the template");
  const crossActivate = await request(`/api/templates/${template._id}/activate`, { method: 'POST', token: otherAdmin.token });
  assert(crossActivate.status === 404, 'another client cannot activate the template');
  const crossRestore = await request(`/api/templates/${template._id}/restore`, {
    method: 'POST',
    token: otherAdmin.token,
    body: { version: restoreTarget },
  });
  assert(crossRestore.status === 404, 'another client cannot restore a version');
  const crossList = await request(`/api/templates?clientId=${clientA._id}`, { token: otherAdmin.token });
  assert(
    crossList.status === 200 && crossList.body.data.templates.every((item) => String(item.clientId) === clientB._id.toString()),
    'a clientadmin cannot list another organization templates'
  );

  // 13. Delete: admins only, and only once the template is switched off
  const activeDelete = await request(`/api/templates/${template._id}`, { method: 'DELETE', token: admin.token });
  assert(activeDelete.status === 400, 'an active template must be switched off before it can be deleted');
  const crossDelete = await request(`/api/templates/${copy._id}`, { method: 'DELETE', token: otherAdmin.token });
  assert(crossDelete.status === 404, 'another client cannot delete a template');
  const removed = await request(`/api/templates/${copy._id}`, { method: 'DELETE', token: admin.token });
  assert(removed.status === 200, 'an inactive template can be deleted');
  const stillThere = await request(`/api/templates/${copy._id}`, { token: admin.token });
  assert(stillThere.status === 404, 'a deleted template is gone');

  // 14. The migration script fills new fields on old templates without touching zones
  const legacyZones = [
    { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: false },
    { id: 'zone-content', type: 'content', x: 70, y: 170, w: 940, h: 640, locked: false, minFont: 16, maxFont: 54 },
    { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: false },
  ];
  const legacyId = new mongoose.Types.ObjectId();
  await Template.collection.insertOne({
    _id: legacyId,
    clientId: clientA._id,
    name: `Legacy Shape ${runId}`,
    category: 'event',
    size: { width: 1080, height: 1350 },
    zones: legacyZones,
    version: 1,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  created.templateIds.push(legacyId);

  const migrationOut = runMigration();
  const migrated = await Template.collection.findOne({ _id: legacyId });
  assert(migrated.layout?.alignment === 'left', 'migration adds the missing layout choices');
  assert(migrated.layout.imagePlacement === 'none', 'migration sees there is no photo area');
  assert(migrated.layout.spacing === 'normal' && migrated.layout.infoStyle === 'stacked', 'migration fills every layout option');
  assert(migrated.isDefault === false, 'migration marks old templates as not the default');
  assert(Array.isArray(migrated.versions) && migrated.versions.length === 0, 'migration adds an empty change history');
  assert(migrated.category === 'Event', 'migration moves the old category onto the new list');
  assert(JSON.stringify(migrated.zones) === JSON.stringify(legacyZones), 'migration leaves every zone untouched');
  assert(/layout defaults: [1-9]/.test(migrationOut), 'migration reports the templates it completed');
  assert(/isDefault\/versions\/version fields: [1-9]/.test(migrationOut), 'migration reports the new fields it added');

  const secondRun = runMigration();
  assert(/layout defaults: 0/.test(secondRun), 'a second migration run changes no layout');
  assert(/isDefault\/versions\/version fields: 0\/0\/0/.test(secondRun), 'a second migration run adds no fields');
  assert(/category list: 0/.test(secondRun), 'a second migration run restates no category');

  console.log(`\nStage 9 tests passed: ${passed} assertions`);
}

try {
  await run();
} catch (err) {
  console.error(`Stage 9 tests failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await cleanup().catch((err) => {
    console.error(`Stage 9 cleanup failed: ${err.message}`);
    process.exitCode = 1;
  });
}
