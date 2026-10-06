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
import BrandKit from '../models/BrandKit.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import { TEMPLATE_MAX_VERSIONS } from '../services/template/zones.js';
import { DESIGN_MAX_BYTES, brandKitSnapshot, designBytes, templateSnapshot } from '../services/poster/design.js';
import { buildRecipeDesign } from '../services/poster/recipe.js';
import { cleanElements, elementContext } from '../services/template/elements.js';
import { recipeIds } from '../../shared/designRecipes.js';
import {
  BRAND_COLOR_TOKENS,
  BRAND_FONT_TOKENS,
  ICON_NAMES,
  TEMPLATE_DOC_MAX_BYTES,
  contentArea,
  defaultPage,
  effectivePage,
  isInsideArea,
  jsonBytes,
  resolveStyleTokens,
} from '../../shared/templateElements.js';
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
  await BrandKit.deleteMany({ clientId: { $in: created.clientIds } }).catch(() => {});
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

  // 15. The editor items a template is drawn from
  const cloudName =
    process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_CLOUD_NAME !== 'your_cloud_name'
      ? process.env.CLOUDINARY_CLOUD_NAME
      : '';
  const ownPhoto = `https://res.cloudinary.com/${cloudName}/image/upload/v1/brand/${clientA._id}/sample.jpg`;
  const otherPhoto = `https://res.cloudinary.com/${cloudName}/image/upload/v1/brand/${clientB._id}/sample.jpg`;

  /* The brand bands decide where items may sit: with a 200 px header and footer on a
     1080x1350 poster the room to design in is y 200 to y 1150. */
  await BrandKit.create({
    clientId: clientA._id,
    orgName: `Stage 9 Org ${runId}`,
    header: { height: 200 },
    footer: { height: 200 },
  });

  function editorElements(extra = []) {
    return [
      {
        id: 'headline',
        kind: 'field',
        field: 'headline',
        x: 70,
        y: 240,
        w: 940,
        h: 160,
        z: 0,
        style: { fontFamily: 'Poppins', size: 64, minSize: 24, color: '#111111', align: 'left' },
      },
      {
        id: 'details',
        kind: 'field',
        field: 'details',
        x: 70,
        y: 420,
        w: 940,
        h: 200,
        z: 1,
        style: { size: 24, minSize: 14, color: '#222222' },
      },
      {
        id: 'photo',
        kind: 'field',
        field: 'photo',
        x: 70,
        y: 700,
        w: 940,
        h: 400,
        z: 2,
        style: { fit: 'cover', radius: 12 },
      },
      ...extra,
    ];
  }

  const editorCreate = await createTemplate(admin, `Editor Items ${runId}`, { elements: editorElements() });
  assert(editorCreate.status === 201, 'a template saves with the items placed in the editor');
  const editorTemplate = editorCreate.body.data.template;
  assert(editorTemplate.editorVersion === 2, 'a template saved by the editor is marked as version 2');
  assert(editorTemplate.elements.length === 3, 'every placed item is stored');
  assert(editorTemplate.elements[0].field === 'headline', 'an item keeps the part of the poster it stands for');
  assert(editorTemplate.elements[0].style.size === 64, 'an item keeps the text size it was given');
  assert(editorTemplate.elements[2].style.radius === 12, 'an item keeps its own look choices');
  assert(Array.isArray(editorTemplate.zones) && editorTemplate.zones.length === 4, 'the areas a template already had are kept');
  assert(editorTemplate.layout.alignment === 'left', 'the layout choices are kept next to the items');
  assert(editorTemplate.elements.every((element) => element.clientId === undefined), 'an item never carries a tenant of its own');

  const editorRead = await request(`/api/templates/${editorTemplate._id}`, { token: admin.token });
  assert(editorRead.status === 200 && editorRead.body.data.template.elements.length === 3, 'reading a template returns its items');
  assert(editorRead.body.data.template.versions.length === 0, 'a first save has no history yet');

  const listRead = await request('/api/templates', { token: admin.token });
  const listed = listRead.body.data.templates.find((item) => String(item._id) === String(editorTemplate._id));
  assert(listed && listed.editorVersion === 2, 'the list says which editor a template was made with');
  assert(listed && listed.elements === undefined, 'the list stays light and leaves the items to one template');
  assert(listed && listed.versions === undefined, 'the list never carries the change history');

  // Two of the same part of the poster
  const twoHeadlines = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'headline-2', kind: 'field', field: 'headline', x: 70, y: 640, w: 400, h: 60 }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(twoHeadlines.status === 400, 'two headlines are refused');
  assert(/only one headline/.test(twoHeadlines.body.error.message), 'the refusal says the template can hold one headline');

  const noHeadline = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: [{ id: 'box', kind: 'text', x: 70, y: 300, w: 400, h: 60, text: 'Words' }],
      expectedVersion: editorTemplate.version,
    },
  });
  assert(noHeadline.status === 400 && /needs a headline/.test(noHeadline.body.error.message), 'a template with no headline is refused');

  // Items must stay clear of the two brand bands
  const inHeader = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'high', kind: 'text', x: 70, y: 40, w: 400, h: 60, text: 'Up in the band' }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(inHeader.status === 400 && /fully inside/.test(inHeader.body.error.message), 'an item inside the header band is refused');

  const pastFooter = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'low', kind: 'text', x: 70, y: 1100, w: 400, h: 200, text: 'Down in the band' }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(pastFooter.status === 400 && /fully inside/.test(pastFooter.body.error.message), 'an item reaching into the footer band is refused');

  const smallItem = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'tiny', kind: 'text', x: 70, y: 640, w: 30, h: 60, text: 'Small' }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(smallItem.status === 400 && /too small/.test(smallItem.body.error.message), 'an item smaller than the minimum is refused');

  const badFont = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'f', kind: 'text', x: 70, y: 640, w: 400, h: 60, text: 'Words', style: { fontFamily: 'Comic Sans' } }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(badFont.status === 400 && /fonts this app offers/.test(badFont.body.error.message), 'a font that is not offered is refused');

  const badColour = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'c', kind: 'text', x: 70, y: 640, w: 400, h: 60, text: 'Words', style: { color: 'red' } }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(badColour.status === 400 && /hex/.test(badColour.body.error.message), 'a colour that is not hex is refused');

  const badSize = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 's', kind: 'text', x: 70, y: 640, w: 400, h: 60, text: 'Words', style: { size: 400 } }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(badSize.status === 400 && /text size outside/.test(badSize.body.error.message), 'a text size beyond the range is refused');

  // Photos must come from this organization's own folder
  const outsidePhoto = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([
        { id: 'p1', kind: 'image', x: 70, y: 640, w: 400, h: 300, imageUrl: 'https://example.com/photo.jpg' },
      ]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(outsidePhoto.status === 400 && /own image library/.test(outsidePhoto.body.error.message), 'a photo from outside the image library is refused');

  const otherTenantPhoto = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'p2', kind: 'image', x: 70, y: 640, w: 400, h: 300, imageUrl: otherPhoto }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(otherTenantPhoto.status === 400 && /another organization/.test(otherTenantPhoto.body.error.message), "a photo from another organization's folder is refused");

  const ownTenantPhoto = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([{ id: 'p3', kind: 'image', x: 70, y: 640, w: 400, h: 300, imageUrl: ownPhoto }]),
      expectedVersion: editorTemplate.version,
    },
  });
  assert(ownTenantPhoto.status === 200, "a photo from this organization's own folder is accepted");
  const withPhoto = ownTenantPhoto.body.data.template;
  assert(
    withPhoto.elements.some((element) => element.imageUrl === ownPhoto),
    'the accepted photo is stored as it was given'
  );
  assert(withPhoto.version === editorTemplate.version + 1, 'saving items makes a new template version');

  // Words are stored as plain words
  const markupSave = await request(`/api/templates/${withPhoto._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: {
      elements: editorElements([
        {
          id: 'note',
          kind: 'text',
          x: 70,
          y: 640,
          w: 600,
          h: 80,
          text: '<b>Big</b> night \u0000 <script>x</script> here',
          unknownKey: 'dropped',
        },
      ]),
      expectedVersion: withPhoto.version,
    },
  });
  assert(markupSave.status === 200, 'a text box saves');
  const storedText = markupSave.body.data.template.elements.find((element) => element.id === 'note');
  assert(storedText.text === 'Big night x here', 'tags and control characters never reach the database');
  assert(storedText.unknownKey === undefined, 'a key an item should not carry is dropped');
  const markupVersion = markupSave.body.data.template.version;

  // Too many items
  const fieldParts = ['headline', 'tagline', 'date', 'time', 'venue', 'details', 'photo'];
  const crowd = [
    ...fieldParts.map((field, index) => ({
      id: `f-${field}`,
      kind: 'field',
      field,
      x: 70,
      y: 240,
      w: 900,
      h: 80,
      z: index,
      style: { size: 32, minSize: 14 },
    })),
    ...Array.from({ length: 10 }, (_, index) => ({
      id: `t-${index}`,
      kind: 'text',
      x: 70,
      y: 240,
      w: 900,
      h: 60,
      text: 'Words',
    })),
    ...Array.from({ length: 6 }, (_, index) => ({
      id: `i-${index}`,
      kind: 'image',
      x: 70,
      y: 340,
      w: 400,
      h: 120,
      imageUrl: ownPhoto,
    })),
    ...Array.from({ length: 8 }, (_, index) => ({
      id: `s-${index}`,
      kind: 'shape',
      x: 70,
      y: 500,
      w: 900,
      h: 40,
      shape: { type: 'line', fill: '#059669', strokeWidth: 4 },
    })),
  ];
  assert(crowd.length === 31, 'the test builds thirty-one valid items');

  const tooMany = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { elements: crowd, expectedVersion: markupVersion },
  });
  assert(tooMany.status === 400, 'thirty-one items are refused');
  assert(/at most 30 items/.test(tooMany.body.error.message), 'the refusal says the template holds thirty items');

  const justEnough = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { elements: crowd.slice(0, 30), expectedVersion: markupVersion },
  });
  assert(justEnough.status === 200, 'thirty items are accepted');
  assert(justEnough.body.data.template.elements.length === 30, 'every item of a full set is stored');
  const crowdedVersion = justEnough.body.data.template.version;

  // A document that has already grown past what it should hold
  const fatItem = (index) => ({
    id: `item-${index}`,
    kind: 'text',
    x: 70,
    y: 240,
    w: 900,
    h: 80,
    text: 'x'.repeat(200),
  });
  const fatList = (count) => Array.from({ length: count }, (_, index) => fatItem(index));
  const oversizedId = new mongoose.Types.ObjectId();
  const oversizedName = `Oversized ${runId}`;
  await Template.collection.insertOne({
    _id: oversizedId,
    clientId: clientA._id,
    name: oversizedName,
    category: 'Event',
    size: { width: 1080, height: 1350 },
    zones: legacyZones,
    elements: fatList(80),
    editorVersion: 2,
    version: 4,
    versions: Array.from({ length: 10 }, (_, index) => ({
      version: index + 1,
      name: oversizedName,
      zones: legacyZones,
      size: { width: 1080, height: 1350 },
      elements: fatList(80),
      note: '',
      createdAt: new Date(),
    })),
    isActive: true,
    isDefault: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  created.templateIds.push(oversizedId);
  const oversizedDoc = await Template.collection.findOne({ _id: oversizedId });
  assert(jsonBytes(oversizedDoc) > TEMPLATE_DOC_MAX_BYTES, 'the test built a template document larger than the limit');

  const oversizedSave = await request(`/api/templates/${oversizedId}`, {
    method: 'PATCH',
    token: admin.token,
    body: { name: `Oversized renamed ${runId}`, expectedVersion: 4 },
  });
  assert(oversizedSave.status === 400, 'saving over an oversized template document is refused');
  assert(/too big to save/.test(oversizedSave.body.error.message), 'the refusal says the template is too big');
  const stillOversized = await Template.collection.findOne({ _id: oversizedId });
  assert(stillOversized.name === oversizedName, 'the refused save changed nothing in the database');

  // Two admins saving at once
  const stale = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { elements: editorElements(), expectedVersion: 1 },
  });
  assert(stale.status === 409, 'saving over a change somebody else made is refused');
  assert(stale.body.error.message === CONFLICT_MESSAGE, 'the refusal tells the admin to reload');
  const afterStale = await request(`/api/templates/${editorTemplate._id}`, { token: admin.token });
  assert(afterStale.body.data.template.version === crowdedVersion, 'a refused save leaves the version where it was');

  // Restore brings the items of that version back as a new version
  const beforeItemsRestore = await request(`/api/templates/${editorTemplate._id}`, { token: admin.token });
  const restoreItems = await request(`/api/templates/${editorTemplate._id}/restore`, {
    method: 'POST',
    token: admin.token,
    body: { version: 1 },
  });
  assert(restoreItems.status === 200, 'an old version of a template can be brought back');
  assert(
    restoreItems.body.data.template.version === beforeItemsRestore.body.data.template.version + 1,
    'bringing a version back makes a new version'
  );
  assert(
    restoreItems.body.data.template.elements.length === 3 &&
      restoreItems.body.data.template.elements.every((element) => element.imageUrl !== ownPhoto),
    'the items of that version come back with it'
  );
  assert(restoreItems.body.data.template.editorVersion === 2, 'a restored template stays an editor template');

  const afterRestore = await request(`/api/templates/${editorTemplate._id}`, { token: admin.token });
  assert(
    afterRestore.body.data.template.versions.some((entry) => Array.isArray(entry.elements) && entry.elements.length === 3),
    'the change history keeps the items of each version'
  );

  // An old template opens as items without being rewritten
  const legacyTemplate = await createTemplate(admin, `Legacy Read ${runId}`);
  const legacyRead = await request(`/api/templates/${legacyTemplate.body.data.template._id}`, { token: admin.token });
  const legacyItems = legacyRead.body.data.template.elements;
  assert(legacyRead.body.data.template.editorVersion === 1, 'a template from before the editor is still marked as version 1');
  assert(legacyItems.length === 7, 'an old template is read as the seven items its areas describe');
  assert(
    legacyItems.filter((element) => element.field === 'headline').length === 1,
    'the converted items hold exactly one headline'
  );
  assert(
    legacyItems.every((element) => element.y >= 200 && element.y + element.h <= 1150),
    'the converted items sit clear of the two brand bands'
  );
  const rawLegacy = await Template.collection.findOne({ _id: new mongoose.Types.ObjectId(legacyTemplate.body.data.template._id) });
  assert(
    (rawLegacy.elements || []).length === 0 && rawLegacy.editorVersion !== 2,
    'reading an old template changes nothing in the database'
  );

  const legacySave = await request(`/api/templates/${legacyTemplate.body.data.template._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { elements: legacyItems, expectedVersion: legacyTemplate.body.data.template.version },
  });
  assert(legacySave.status === 200, 'the items an old template was read as can be saved straight back');
  assert(legacySave.body.data.template.editorVersion === 2, 'saving items upgrades the template to the editor');

  // Who may place items
  const userItems = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: maker.token,
    body: { elements: editorElements(), expectedVersion: 1 },
  });
  assert(userItems.status === 403, 'a regular user cannot place items on a template');

  const otherTenantItems = await request(`/api/templates/${editorTemplate._id}`, {
    method: 'PATCH',
    token: otherAdmin.token,
    body: { elements: editorElements(), expectedVersion: 1 },
  });
  assert(otherTenantItems.status === 404, "another organization's template is not there to edit");

  const otherTenantRead = await request(`/api/templates/${editorTemplate._id}`, { token: otherAdmin.token });
  assert(otherTenantRead.status === 404, "another organization cannot read a template's items");

  const makerRead = await request(`/api/templates/${editorTemplate._id}`, { token: maker.token });
  assert(makerRead.status === 200 && makerRead.body.data.template.elements.length === 3, 'a regular user can read an active template');

  // A poster keeps the items it was made with
  const storedTemplate = await Template.findOne({ _id: editorTemplate._id }).lean();
  const snapshot = templateSnapshot(storedTemplate);
  assert(Array.isArray(snapshot.elements) && snapshot.elements.length === 3, 'a poster snapshot keeps the editor items');
  assert(snapshot.editorVersion === 2, 'a poster snapshot says which editor the template came from');
  assert(snapshot.zones.length === 4 && snapshot.layout.alignment === 'left', 'a poster snapshot still keeps the areas and layout');
  const legacySnapshot = templateSnapshot({
    name: 'Old',
    size: { width: 1080, height: 1350 },
    zones: [],
    version: 1,
  });
  assert(legacySnapshot.elements === undefined && legacySnapshot.editorVersion === 1, 'a snapshot of an old template carries no items');
  const bigSnapshot = templateSnapshot({
    ...storedTemplate,
    elements: crowd.slice(0, 30).map((element, index) => ({
      ...element,
      id: `snapshot-${index}`,
      text: 'y'.repeat(200),
    })),
  });
  assert(bigSnapshot.elements.length === 30, 'a snapshot keeps all thirty items');
  assert(
    designBytes({ brandKit: brandKitSnapshot({ orgName: 'Stage 9 Org' }), template: bigSnapshot }) < DESIGN_MAX_BYTES,
    'a snapshot with thirty items still fits inside the poster design limit'
  );

  // 16. Items the assistant or a person can fill in later
  const fillTexts = (count) =>
    Array.from({ length: count }, (_, index) => ({
      id: `fill-${index}`,
      kind: 'text',
      x: 70,
      y: 240 + index * 80,
      w: 900,
      h: 60,
      text: 'Sample words',
      variable: true,
      key: `slot_${index}`,
      label: `Fill-in ${index}`,
      hint: 'one short line',
      maxLength: 60,
    }));
  const fillPics = (count) =>
    Array.from({ length: count }, (_, index) => ({
      id: `fill-pic-${index}`,
      kind: 'image',
      x: 70,
      y: 240 + index * 180,
      w: 400,
      h: 150,
      variable: true,
      key: `photo_${index}`,
      label: `Photo ${index}`,
    }));

  const fillCreate = await createTemplate(admin, `Fill-ins ${runId}`, {
    elements: editorElements([...fillTexts(10), ...fillPics(4)]),
  });
  assert(fillCreate.status === 201, 'a template saves with ten fill-in texts and four fill-in photos');
  const fillTemplate = fillCreate.body.data.template;
  assert(
    fillTemplate.elements.filter((element) => element.variable).length === 14,
    'every fill-in keeps its own mark'
  );
  const savedFill = fillTemplate.elements.find((element) => element.key === 'slot_0');
  assert(
    savedFill.label === 'Fill-in 0' && savedFill.hint === 'one short line' && savedFill.maxLength === 60,
    'a fill-in keeps the words shown for it, its hint and how much room it has'
  );
  assert(
    fillTemplate.elements.filter((element) => element.kind === 'field').every((element) => !element.variable),
    'a part of the poster that always exists is never marked as a fill-in'
  );
  assert(
    fillTemplate.elements.filter((element) => element.kind === 'image' && element.variable).every((element) => !element.imageUrl),
    'a fill-in photo may be saved empty, to be replaced later'
  );

  const tooManyFills = await createTemplate(admin, `Too Many Fill-ins ${runId}`, {
    elements: editorElements(fillTexts(11)),
  });
  assert(tooManyFills.status === 400, 'eleven fill-in texts are refused');
  assert(
    /at most 10 texts to be filled in/.test(tooManyFills.body.error.message),
    'the refusal says ten fill-in texts is the most'
  );

  const tooManyFillPics = await createTemplate(admin, `Too Many Fill-in Photos ${runId}`, {
    elements: editorElements(fillPics(5)),
  });
  assert(tooManyFillPics.status === 400, 'five fill-in photos are refused');
  assert(
    /at most 4 photos to be replaced/.test(tooManyFillPics.body.error.message),
    'the refusal says four fill-in photos is the most'
  );

  const sharedName = await createTemplate(admin, `Shared Fill-in Name ${runId}`, {
    elements: editorElements([fillTexts(1)[0], { ...fillTexts(2)[1], key: 'slot_0' }]),
  });
  assert(sharedName.status === 400, 'two fill-ins cannot share one name');
  assert(/share the name/.test(sharedName.body.error.message), 'the refusal names the shared fill-in');

  const badName = await createTemplate(admin, `Bad Fill-in Name ${runId}`, {
    elements: editorElements([{ ...fillTexts(1)[0], key: 'My Fill In' }]),
  });
  assert(badName.status === 400, 'a fill-in name with spaces or capitals is refused');
  assert(/lower-case/.test(badName.body.error.message), 'the refusal says how a fill-in name is spelled');

  const hugeRoom = await createTemplate(admin, `Fill-in Room Too Big ${runId}`, {
    elements: editorElements([{ ...fillTexts(1)[0], maxLength: 300 }]),
  });
  assert(hugeRoom.status === 400, 'a fill-in cannot ask for more than 200 characters');

  const markedUp = await createTemplate(admin, `Fill-in Shown Words ${runId}`, {
    elements: editorElements([{ ...fillTexts(1)[0], label: '<b>Special</b> Guest', hint: 'who pays for the event' }]),
  });
  assert(markedUp.status === 201, 'a fill-in with formatted words shown is stored as plain words');
  assert(
    markedUp.body.data.template.elements[3].label === 'Special Guest',
    'the fill-in is shown without any markup'
  );

  const longHint = await createTemplate(admin, `Fill-in Hint Too Long ${runId}`, {
    elements: editorElements([{ ...fillTexts(1)[0], hint: 'x'.repeat(200) }]),
  });
  assert(longHint.status === 400, 'a fill-in hint over 80 characters is refused');

  const borrowedPhoto = await createTemplate(admin, `Fill-in Borrowed Photo ${runId}`, {
    elements: editorElements([{ ...fillPics(1)[0], imageUrl: otherPhoto }]),
  });
  assert(borrowedPhoto.status === 400, "another organization's photo cannot be a fill-in placeholder");

  const fillRead = await request(`/api/templates/${fillTemplate._id}`, { token: admin.token });
  assert(
    fillRead.body.data.template.elements.filter((element) => element.variable).length === 14,
    'reading a template returns its fill-ins'
  );
  const fillOtherTenant = await request(`/api/templates/${fillTemplate._id}`, { token: otherAdmin.token });
  assert(fillOtherTenant.status === 404, "another organization's fill-in template is not there to use");

  const unmarked = await request(`/api/templates/${editorTemplate._id}`, { token: admin.token });
  assert(
    unmarked.body.data.template.elements.every((element) => element.variable === undefined && element.key === undefined),
    'an item that is not a fill-in gains no fill-in fields'
  );

  /* History and the poster snapshot both keep the fill-ins. */
  const fillUpdate = await request(`/api/templates/${fillTemplate._id}`, {
    method: 'PATCH',
    token: admin.token,
    body: { elements: editorElements([...fillTexts(10), ...fillPics(3)]), expectedVersion: fillTemplate.version },
  });
  assert(fillUpdate.status === 200, 'a template with fill-ins can be changed again');
  assert(
    fillUpdate.body.data.template.versions.some(
      (entry) => entry.elements && entry.elements.filter((element) => element.variable).length === 14
    ),
    'the change history keeps the fill-ins each version had'
  );

  const storedFillTemplate = await Template.findOne({ _id: fillTemplate._id }).lean();
  const fillSnapshot = templateSnapshot(storedFillTemplate);
  assert(
    fillSnapshot.elements.filter((element) => element.variable && element.key).length === 13,
    'a poster snapshot keeps the fill-ins its own template offered'
  );
  assert(
    designBytes({ brandKit: brandKitSnapshot({ orgName: 'Stage 9 Org' }), template: fillSnapshot }) < DESIGN_MAX_BYTES,
    'a snapshot full of fill-ins still fits inside the poster design limit'
  );

  // 17. Designs built from recipes obey the same item rules as a hand-made template
  const aiKit = await BrandKit.findOne({ clientId: clientA._id }).lean();
  const aiArea = contentArea(aiKit, { size: { width: 1080, height: 1350 } });
  const recipeList = recipeIds();
  assert(recipeList.length > 0, 'the app offers designs to build a poster from');

  for (const recipeId of recipeList) {
    for (const variant of [0, 1, 2, 3]) {
      const built = buildRecipeDesign({
        recipe: { recipeId, variant },
        content: {
          title: 'Blood Donation Camp',
          tagline: 'Save a life',
          date: '12 Nov',
          time: '9 AM',
          venue: 'Town Hall',
          details: ['Free health check'],
          extras: { title_sub: 'Give blood', slogan_1: 'Every drop counts', slogan_2: 'Donate today', cta_line: 'Register at the desk', cta_button: 'Join us' },
        },
        brandKit: aiKit,
        size: { width: 1080, height: 1350 },
      });
      assert(built.name === 'AI design' && built.editorVersion === 2, `${recipeId} variant ${variant} builds as an item template`);
      assert(ICON_NAMES.includes(built.icon), `${recipeId} variant ${variant} marks itself with a picture the app can draw`);
      const cleaned = cleanElements(
        built.elements,
        elementContext({ brandKit: aiKit, clientId: clientA._id, size: { width: 1080, height: 1350 } })
      );
      assert(cleaned.length === built.elements.length, `${recipeId} variant ${variant} passes the item rules untouched`);
      assert(
        built.elements.every((element) => isInsideArea(element, aiArea)),
        `${recipeId} variant ${variant} keeps every item between the two brand bands`
      );
      const snapshot = templateSnapshot(built);
      assert(
        designBytes({ brandKit: brandKitSnapshot(aiKit), template: snapshot }) < DESIGN_MAX_BYTES,
        `${recipeId} variant ${variant} fits inside the room a poster has for its look`
      );
    }
  }

  /* An administrator can keep a design as a template of their own. */
  const fromDesign = buildRecipeDesign({ recipe: { recipeId: recipeList[0], variant: 1 }, brandKit: aiKit, size: { width: 1080, height: 1350 } });
  const designTemplateSave = await createTemplate(admin, `From A Design ${runId}`, {
    elements: fromDesign.elements,
    editorVersion: 2,
  });
  assert(designTemplateSave.status === 201, 'a generated design can be saved as a template');
  assert(
    designTemplateSave.body.data.template.elements.length === fromDesign.elements.length,
    'the template keeps every item of the design it came from'
  );
  assert(
    jsonBytes(designTemplateSave.body.data.template) < TEMPLATE_DOC_MAX_BYTES,
    'a template full of design items stays inside the size a template may reach'
  );
  const designTemplateOther = await request(`/api/templates/${designTemplateSave.body.data.template._id}`, {
    token: otherAdmin.token,
  });
  assert(designTemplateOther.status === 404, "another organization cannot reach a template made from this client's design");

  // 18. Brand tokens, page overrides and snapshots (STYLE LINK 1)
  console.log('\n18. Brand tokens, page overrides and snapshots');

  // A. Tokens validate on elements
  const tokenElements = [
    {
      id: 'token-headline',
      kind: 'field',
      field: 'headline',
      x: 70,
      y: 240,
      w: 900,
      h: 80,
      text: 'Headline with tokens',
      style: {
        color: 'brand:primary',
        fontFamily: 'brand:heading',
        size: 40,
        minSize: 16,
      },
    },
    {
      id: 'token-shape',
      kind: 'shape',
      x: 70,
      y: 340,
      w: 900,
      h: 40,
      shape: {
        type: 'rect',
        fill: 'brand:accent',
        stroke: 'brand:secondary',
      },
    },
  ];

  const tokenTemplateCreate = await createTemplate(admin, `Token Template ${runId}`, {
    elements: tokenElements,
    editorVersion: 2,
  });
  assert(tokenTemplateCreate.status === 201, 'a template with brand tokens in element styles and shapes validates and saves');
  const savedTokenTpl = tokenTemplateCreate.body.data.template;
  const textEl = savedTokenTpl.elements.find((e) => e.id === 'token-headline');
  const shapeEl = savedTokenTpl.elements.find((e) => e.id === 'token-shape');
  assert(textEl.style.color === 'brand:primary' && textEl.style.fontFamily === 'brand:heading', 'token text keeps brand:primary and brand:heading');
  assert(shapeEl.shape.fill === 'brand:accent' && shapeEl.shape.stroke === 'brand:secondary', 'token shape keeps brand:accent and brand:secondary');

  // B. Unknown tokens are rejected
  const badColorToken = await createTemplate(admin, `Bad Color Token ${runId}`, {
    elements: [
      {
        id: 'token-headline',
        kind: 'field',
        field: 'headline',
        x: 70,
        y: 240,
        w: 900,
        h: 80,
        text: 'Bad',
        style: { color: 'brand:notreal', size: 40, minSize: 16 },
      },
    ],
    editorVersion: 2,
  });
  assert(badColorToken.status === 400, 'an unknown color token is rejected');
  assert(/hex/.test(badColorToken.body?.error?.message), 'color rejection explains it needs a hex or known token');

  const badFontToken = await createTemplate(admin, `Bad Font Token ${runId}`, {
    elements: [
      {
        id: 'token-headline',
        kind: 'field',
        field: 'headline',
        x: 70,
        y: 240,
        w: 900,
        h: 80,
        text: 'Bad',
        style: { fontFamily: 'brand:notreal', size: 40, minSize: 16 },
      },
    ],
    editorVersion: 2,
  });
  assert(badFontToken.status === 400, 'an unknown font token is rejected');
  assert(/font/.test(badFontToken.body?.error?.message), 'font rejection explains the font is not offered');

  // C. Page custom sections validate like brand ones
  const validCustomPage = {
    background: { mode: 'custom', type: 'color', color: '#1a2b3c' },
    decoration: { mode: 'custom', decoration: 'band', decorationColor: '#059669' },
    watermark: { mode: 'custom', show: true, opacity: 0.12 },
    infoCard: { mode: 'custom', background: '#f8fafc', border: '#e2e8f0', radius: 20, iconColor: '#059669' },
  };
  const pageTemplateCreate = await createTemplate(admin, `Page Custom ${runId}`, {
    page: validCustomPage,
  });
  assert(pageTemplateCreate.status === 201, 'a template with valid custom page sections validates and saves');
  const savedPageTpl = pageTemplateCreate.body.data.template;
  assert(savedPageTpl.page.background.mode === 'custom' && savedPageTpl.page.background.color === '#1a2b3c', 'custom background is saved');
  assert(savedPageTpl.page.decoration.mode === 'custom' && savedPageTpl.page.decoration.decoration === 'band', 'custom decoration is saved');
  assert(savedPageTpl.page.watermark.mode === 'custom' && savedPageTpl.page.watermark.opacity === 0.12, 'custom watermark is saved');
  assert(savedPageTpl.page.infoCard.mode === 'custom' && savedPageTpl.page.infoCard.radius === 20, 'custom infoCard is saved');

  // Page validation rejections:
  // Watermark opacity > 0.3 rejected
  const badWatermark = await createTemplate(admin, `Bad Watermark ${runId}`, {
    page: { watermark: { mode: 'custom', show: true, opacity: 0.5 } },
  });
  assert(badWatermark.status === 400, 'page watermark opacity > 0.3 is rejected');

  // InfoCard radius > 32 rejected
  const badRadius = await createTemplate(admin, `Bad Radius ${runId}`, {
    page: { infoCard: { mode: 'custom', radius: 48 } },
  });
  assert(badRadius.status === 400, 'page infoCard radius > 32 is rejected');

  // Invalid decoration shape rejected
  const badDec = await createTemplate(admin, `Bad Decoration ${runId}`, {
    page: { decoration: { mode: 'custom', decoration: 'zigzag' } },
  });
  assert(badDec.status === 400, 'page decoration with unknown shape is rejected');

  // Background image outside tenant Cloudinary folder rejected
  const badImage = await createTemplate(admin, `Bad Image ${runId}`, {
    page: { background: { mode: 'custom', type: 'image', imageUrl: 'https://evil.com/bg.png' } },
  });
  assert(badImage.status === 400, 'page background image outside client folder is rejected');

  // D. Old templates load unchanged
  const oldDocId = new mongoose.Types.ObjectId();
  await Template.collection.insertOne({
    _id: oldDocId,
    clientId: clientA._id,
    name: `Old Raw Template ${runId}`,
    category: 'Event',
    size: { width: 1080, height: 1350 },
    zones: zones(),
    editorVersion: 1,
    isActive: true,
    version: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  created.templateIds.push(oldDocId);

  const oldRead = await request(`/api/templates/${oldDocId}`, { token: admin.token });
  assert(oldRead.status === 200, 'old template without page field loads cleanly');
  assert(oldRead.body.data.template.name === `Old Raw Template ${runId}`, 'old template retains its name');

  // E. effectivePage picks custom over brand
  const effPageCustom = effectivePage(aiKit, savedPageTpl);
  assert(effPageCustom.background.color === '#1a2b3c', 'effectivePage picks custom background color over brand');
  assert(effPageCustom.decoration === 'band', 'effectivePage picks custom decoration over brand');
  assert(effPageCustom.watermark.opacity === 0.12, 'effectivePage picks custom watermark over brand');
  assert(effPageCustom.infoCard.radius === 20, 'effectivePage picks custom infoCard over brand');

  const effPageBrand = effectivePage(aiKit, { page: defaultPage() });
  assert(
    effPageBrand.background.color === (aiKit.content?.background?.color || '#ffffff'),
    'effectivePage picks brand kit background in brand mode'
  );

  // F. Poster snapshot preserves page and tokens, and resolves the same after brand kit changes
  const snapTpl = templateSnapshot({
    ...savedTokenTpl,
    page: savedPageTpl.page,
  });
  assert(snapTpl.page !== undefined, 'template snapshot keeps page');
  assert(snapTpl.elements[0].style.color === 'brand:primary', 'template snapshot keeps tokens');

  const snapBrandKit = brandKitSnapshot(aiKit);
  const posterDesign = { brandKit: snapBrandKit, template: snapTpl };
  assert(designBytes(posterDesign) < DESIGN_MAX_BYTES, 'poster design snapshot with page and tokens stays within size limit');

  const resolvedElBefore = resolveStyleTokens(snapTpl.elements[0], posterDesign.brandKit);
  const effPageBefore = effectivePage(posterDesign.brandKit, snapTpl);

  // Now mutate the brand kit in the database
  await BrandKit.updateOne(
    { clientId: clientA._id },
    {
      $set: {
        'colors.primary': '#990000',
        'content.headingFont': 'Caveat',
        'content.background.color': '#009900',
      },
    }
  );
  const mutatedLiveKit = await BrandKit.findOne({ clientId: clientA._id }).lean();
  assert(mutatedLiveKit.colors.primary === '#990000', 'brand kit primary color was mutated in database');

  // The snapshot resolves using its own frozen brandKit, so resolution does not change
  const resolvedElAfter = resolveStyleTokens(snapTpl.elements[0], posterDesign.brandKit);
  const effPageAfter = effectivePage(posterDesign.brandKit, snapTpl);
  assert(resolvedElAfter.style.color === resolvedElBefore.style.color, 'snapshot tokens resolve identical color after brand kit changes');
  assert(resolvedElAfter.style.fontFamily === resolvedElBefore.style.fontFamily, 'snapshot tokens resolve identical font after brand kit changes');
  assert(effPageAfter.background.color === effPageBefore.background.color, 'snapshot effectivePage resolves identical after brand kit changes');

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
