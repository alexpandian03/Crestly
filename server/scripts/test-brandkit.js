import 'dotenv/config';
import crypto from 'crypto';
import path from 'path';
import http from 'http';
import mongoose from 'mongoose';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import BrandKit from '../models/BrandKit.model.js';
import RateCounter from '../models/RateCounter.model.js';
import { generateToken } from '../services/auth.service.js';
import { SIGNATURE_LIMIT_PER_HOUR } from '../services/brand/style.js';

if (process.env.NODE_ENV === 'production') {
  throw new Error('Brand kit tests cannot run in production.');
}

const runId = crypto.randomBytes(6).toString('hex');
const password = `Brand${crypto.randomBytes(8).toString('hex')}9`;
const cloudName = process.env.CLOUDINARY_CLOUD_NAME;

let passed = 0;
function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`PASS ${message}`);
  passed += 1;
}

const created = { clientIds: [], userIds: [], brandKitIds: [], rateKeys: [] };
let server;
let baseUrl;

async function request(route, { method = 'GET', token, body, headers = {} } = {}) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

async function makeUser({ email, role, clientId }) {
  const user = await User.create({
    name: `Brandkit ${role}`,
    email,
    passwordHash: await User.hashPassword(password),
    role,
    clientId,
  });
  created.userIds.push(user._id);
  return { user, token: generateToken(user) };
}

function brandUrl(clientId, name = 'photo') {
  return `https://res.cloudinary.com/${cloudName}/image/upload/brand/${clientId}/${name}.jpg`;
}

async function putKit(token, body, headers) {
  return request('/api/brand-kit', { method: 'PUT', token, body, headers });
}

async function getKit(token, headers) {
  return request('/api/brand-kit', { token, headers });
}

const migrateScript = path.join(path.dirname(fileURLToPath(import.meta.url)), 'migrate-brandkit.js');

function runMigration() {
  try {
    return execFileSync(process.execPath, [migrateScript], { encoding: 'utf8' });
  } catch (err) {
    return `${err.stdout || ''}${err.stderr || ''}`;
  }
}

async function cleanup() {
  await BrandKit.deleteMany({ _id: { $in: created.brandKitIds } }).catch(() => {});
  await RateCounter.deleteMany({ key: { $in: created.rateKeys } }).catch(() => {});
  await User.deleteMany({ _id: { $in: created.userIds } }).catch(() => {});
  await Client.deleteMany({ _id: { $in: created.clientIds } }).catch(() => {});
}

async function run() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required for brand kit tests.');
  await connectDB();

  const [clientA, clientB] = await Client.create([
    { name: `Brand A ${runId}`, plan: 'pro', isActive: true },
    { name: `Brand B ${runId}`, plan: 'starter', isActive: true },
  ]);
  created.clientIds.push(clientA._id, clientB._id);

  const kits = await BrandKit.create([
    { clientId: clientA._id, orgName: `Brand A ${runId}` },
    { clientId: clientB._id, orgName: `Brand B ${runId}` },
  ]);
  created.brandKitIds.push(...kits.map((kit) => kit._id));

  const adminA = await makeUser({ email: `brand-admin-a-${runId}@example.test`, role: 'clientadmin', clientId: clientA._id });
  const adminB = await makeUser({ email: `brand-admin-b-${runId}@example.test`, role: 'clientadmin', clientId: clientB._id });
  const plainUser = await makeUser({ email: `brand-user-a-${runId}@example.test`, role: 'user', clientId: clientA._id });
  const superadmin = await makeUser({ email: `brand-super-${runId}@example.test`, role: 'superadmin', clientId: null });

  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;

  console.log('1. Full style save');
  const fullSave = await putKit(adminA.token, {
    orgName: `Brand A Renamed ${runId}`,
    preset: 'professional',
    textStyle: { fontFamily: 'Cinzel', size: 22, weight: 600, color: '#0F172A', uppercase: true, letterSpacing: 1.5 },
    header: {
      height: 120,
      background: { type: 'gradient', gradientFrom: '#059669', gradientTo: '#0f172a', gradientAngle: 45, overlayColor: '#000000', overlayOpacity: 0.25 },
      alignment: 'center',
      logo: { show: true, size: 96, position: 'top' },
      orgName: { show: true, text: 'Brand A', style: { fontFamily: 'Outfit', size: 30, weight: 700, color: '#ffffff' } },
      tagline: { show: true, text: '<b>Trusted since 1998</b>', style: { size: 14, weight: 400, color: '#e2e8f0', letterSpacing: 2 } },
      border: { show: true, color: '#10b981', thickness: 4 },
    },
    content: {
      background: { type: 'pattern', pattern: 'grid', color: '#f8fafc' },
      decoration: 'corners',
      decorationColor: '#059669',
      watermark: { show: true, opacity: 0.15 },
      headingColor: '#0f172a',
      bodyColor: '#334155',
      accentColor: '#10b981',
      headingFont: 'Poppins',
      bodyFont: 'Lato',
      infoCard: { background: '#ffffff', border: '#e2e8f0', radius: 24, iconColor: '#059669' },
      defaultImageUrl: brandUrl(clientA._id, 'default'),
    },
    footer: {
      height: 160,
      layout: 3,
      background: { type: 'image', imageUrl: brandUrl(clientA._id, 'footer'), overlayOpacity: 0.6 },
      address: '221B Baker Street, London',
      phone: '+1 (555) 019-2834',
      email: 'hello@brand-a.example.test',
      website: 'www.brand-a.example.test',
      social: [
        { platform: 'instagram', url: 'https://instagram.com/brand-a' },
        { platform: 'whatsapp', url: 'https://wa.me/15550192834' },
      ],
      legalText: `© ${runId} Brand A. All rights reserved.`,
      style: { fontFamily: 'Inter', size: 12, weight: 400, color: '#e2e8f0', uppercase: false, letterSpacing: 0 },
      linkColor: '#10b981',
      divider: { show: true, color: '#1f2937', thickness: 2 },
    },
  });
  assert(fullSave.status === 200, 'clientadmin saves the full style shape (HTTP 200)');
  const saved = fullSave.body.data?.brandKit;
  assert(saved?.preset === 'professional', 'preset stored');
  assert(saved?.textStyle.color === '#0f172a', 'hex color normalized to lower case');
  assert(saved?.textStyle.letterSpacing === 1.5, 'decimal letter spacing accepted');
  assert(saved?.header?.background?.type === 'gradient', 'header gradient stored');
  assert(saved?.header?.background?.gradientFrom === '#059669', 'header gradient start color stored');
  assert(saved?.header?.tagline?.text === 'Trusted since 1998', 'HTML is stripped from tagline text');
  assert(saved?.header?.orgName?.style?.fontFamily === 'Outfit', 'per-block font stored');
  assert(saved?.content?.background?.pattern === 'grid', 'content pattern stored');
  assert(saved?.content?.watermark?.opacity === 0.15, 'watermark opacity stored');
  assert(saved?.content?.infoCard?.radius === 24, 'info card radius stored');
  assert(saved?.footer?.layout === 3, 'footer column layout stored');
  assert(saved?.footer?.social?.length === 2, 'social links stored');
  assert(saved?.footer?.divider?.show === true, 'footer divider stored');
  assert(saved?.footer?.contactText === '+1 (555) 019-2834 · hello@brand-a.example.test · 221B Baker Street, London', 'legacy contact text follows the new contact fields');
  assert(saved?.footer?.socials?.[0] === 'instagram.com/brand-a', 'legacy social list follows the new links');

  console.log('\n2. Reload shows the saved style');
  const reloaded = await getKit(adminA.token);
  assert(reloaded.status === 200 && reloaded.body.data.brandKit.header.height === 120, 'header height survives a reload');
  assert(reloaded.body.data.brandKit.footer.website === 'www.brand-a.example.test', 'website survives a reload');
  assert(reloaded.body.data.brandKit.logos !== undefined, 'existing fields are still returned');

  console.log('\n3. Rejected values');
  const badColor = await putKit(adminA.token, { footer: { linkColor: 'bluish' } });
  assert(badColor.status === 400 && /color/i.test(badColor.body.error.message), 'invalid color rejected: ' + badColor.body.error.message);

  const badUrl = await putKit(adminA.token, { content: { defaultImageUrl: 'http://cdn.example.com/a.jpg' } });
  assert(badUrl.status === 400 && /https/.test(badUrl.body.error.message), 'non-https image URL rejected');

  const foreignHost = await putKit(adminA.token, { content: { defaultImageUrl: 'https://picsum.photos/seed/a/100' } });
  assert(foreignHost.status === 400, 'image from another host rejected');

  const otherTenant = await putKit(adminA.token, { content: { defaultImageUrl: brandUrl(clientB._id, 'stolen') } });
  assert(otherTenant.status === 400 && /organization/i.test(otherTenant.body.error.message), "another client's brand folder rejected");

  const otherCloud = await putKit(adminA.token, {
    content: { defaultImageUrl: `https://res.cloudinary.com/someone-elses-cloud/image/upload/brand/${clientA._id}/a.jpg` },
  });
  assert(otherCloud.status === 400, "another Cloudinary account's URL rejected");

  const badFont = await putKit(adminA.token, { content: { headingFont: 'Comic Sans MS' } });
  assert(badFont.status === 400 && /font/i.test(badFont.body.error.message), 'font outside the allowed list rejected');

  const badRange = await putKit(adminA.token, { footer: { height: 400 } });
  assert(badRange.status === 400 && /between 60 and 260/.test(badRange.body.error.message), 'out-of-range height rejected');

  const badWeight = await putKit(adminA.token, { textStyle: { weight: 350 } });
  assert(badWeight.status === 400, 'text weight outside 400/500/600/700 rejected');

  const badOpacity = await putKit(adminA.token, { content: { watermark: { show: true, opacity: 0.9 } } });
  assert(badOpacity.status === 400, 'watermark opacity above 0.3 rejected');

  const tooManySocials = await putKit(adminA.token, {
    footer: { social: Array.from({ length: 7 }, (_, index) => ({ platform: 'x', url: `https://x.com/a${index}` })) },
  });
  assert(tooManySocials.status === 400 && /social/i.test(tooManySocials.body.error.message), 'more than 6 social profiles rejected');

  const badPlatform = await putKit(adminA.token, { footer: { social: [{ platform: 'tiktok', url: 'https://tiktok.com/@a' }] } });
  assert(badPlatform.status === 400, 'unknown social platform rejected');

  const stillIntact = await getKit(adminA.token);
  assert(stillIntact.body.data.brandKit.footer.height === 160, 'rejected saves leave the kit untouched');

  console.log('\n4. Permissions and tenancy');
  const userWrite = await putKit(plainUser.token, { orgName: 'Hacked' });
  assert(userWrite.status === 403, 'plain user cannot save the brand kit (HTTP 403)');
  const userRead = await getKit(plainUser.token);
  assert(userRead.status === 200 && userRead.body.data.brandKit.preset === 'professional', 'plain user can read the brand kit');

  const signAsUser = await request('/api/uploads/brand-image/sign', { method: 'POST', token: plainUser.token, body: { kind: 'header' } });
  assert(signAsUser.status === 403, 'plain user cannot request an upload signature (HTTP 403)');

  const spyRead = await request(`/api/brand-kit?clientId=${clientB._id}`, { token: adminA.token });
  assert(spyRead.status === 200 && String(spyRead.body.data.brandKit.clientId) === String(clientA._id), 'clientadmin cannot read another kit by query string');
  const spyHeader = await getKit(adminA.token, { 'x-client-id': String(clientB._id) });
  assert(spyHeader.status === 200 && String(spyHeader.body.data.brandKit.clientId) === String(clientA._id), 'clientadmin cannot read another kit by header');
  const spyWrite = await putKit(adminA.token, { clientId: String(clientB._id), orgName: `Stolen ${runId}` }, { 'x-client-id': String(clientB._id) });
  assert(spyWrite.status === 200 && String(spyWrite.body.data.brandKit.clientId) === String(clientA._id), 'foreign clientId is ignored on save');
  const kitBNow = await BrandKit.findOne({ clientId: clientB._id }).lean();
  assert(kitBNow.orgName === `Brand B ${runId}`, "another client's kit is unchanged");
  const readB = await getKit(adminB.token);
  assert(readB.status === 200 && readB.body.data.brandKit.orgName === `Brand B ${runId}`, 'the other client still sees their own kit');

  const superRead = await getKit(superadmin.token, { 'x-client-id': String(clientB._id) });
  assert(superRead.status === 200 && String(superRead.body.data.brandKit.clientId) === String(clientB._id), 'superadmin can open a chosen client kit');
  const superNoClient = await getKit(superadmin.token);
  assert(superNoClient.status === 400, 'superadmin without a chosen client is refused');

  console.log('\n5. Direct upload signature');
  const sign = await request('/api/uploads/brand-image/sign', { method: 'POST', token: adminA.token, body: { kind: 'content' } });
  if (sign.status === 503) {
    console.log('SKIP signature checks: Cloudinary credentials are not configured in this environment.');
  } else {
    assert(sign.status === 200, 'clientadmin gets an upload signature (HTTP 200)');
    const signed = sign.body.data;
    assert(signed.folder === `brand/${clientA._id}`, 'signature targets this client only');
    assert(signed.allowedFormats === 'jpg,png,webp', 'signature locks the file formats');
    assert(typeof signed.signature === 'string' && signed.signature.length === 40, 'signature returned');
    assert(Number.isInteger(signed.timestamp), 'timestamp returned');
    assert(signed.cloudName === cloudName && signed.apiKey === process.env.CLOUDINARY_API_KEY, 'cloud name and public api key returned');
    const rawBody = JSON.stringify(sign.body);
    assert(!rawBody.includes(process.env.CLOUDINARY_API_SECRET || '___'), 'the API secret is never sent to the browser');
    if (cloudName && process.env.CLOUDINARY_API_SECRET) {
      const expected = cloudinary.utils.api_sign_request(
        { timestamp: signed.timestamp, folder: signed.folder, allowed_formats: signed.allowedFormats },
        process.env.CLOUDINARY_API_SECRET
      );
      assert(expected === signed.signature, 'signature matches the signed folder and formats');
      const tampered = cloudinary.utils.api_sign_request(
        { timestamp: signed.timestamp, folder: `brand/${clientB._id}`, allowed_formats: signed.allowedFormats },
        process.env.CLOUDINARY_API_SECRET
      );
      assert(tampered !== signed.signature, 'a changed folder would be rejected by Cloudinary');
    }

    const badKind = await request('/api/uploads/brand-image/sign', { method: 'POST', token: adminA.token, body: { kind: 'anything' } });
    assert(badKind.status === 400, 'unknown image kind rejected');
    const noToken = await request('/api/uploads/brand-image/sign', { method: 'POST', body: { kind: 'logo' } });
    assert(noToken.status === 401, 'signature needs a session');

    const otherSign = await request('/api/uploads/brand-image/sign', { method: 'POST', token: adminB.token, body: { kind: 'footer' } });
    assert(otherSign.status === 200 && otherSign.body.data.folder === `brand/${clientB._id}`, 'each client signs into their own folder');

    console.log('\n6. Signature rate limit');
    created.rateKeys.push(`brand-sign:${adminA.user._id}`, `brand-sign:${adminB.user._id}`);
    let allowed = 1; // the signature requested above
    let blocked = null;
    for (let index = 0; index < SIGNATURE_LIMIT_PER_HOUR + 2; index += 1) {
      const again = await request('/api/uploads/brand-image/sign', { method: 'POST', token: adminA.token, body: { kind: 'header' } });
      if (again.status === 200) allowed += 1;
      else {
        blocked = again;
        break;
      }
    }
    assert(allowed === SIGNATURE_LIMIT_PER_HOUR, `exactly ${SIGNATURE_LIMIT_PER_HOUR} signatures are allowed in one hour`);
    assert(blocked?.status === 429 && /again in \d+ minutes/.test(blocked.body.error.message), 'the next signature is throttled');
    const otherStillFine = await request('/api/uploads/brand-image/sign', { method: 'POST', token: adminB.token, body: { kind: 'header' } });
    assert(otherStillFine.status === 200, 'the limit follows the user, not the whole server');
  }

  console.log('\n7. Old kits still load');
  const legacyClientId = new mongoose.Types.ObjectId();
  created.clientIds.push(legacyClientId);
  await Client.create({ _id: legacyClientId, name: `Legacy ${runId}`, plan: 'free', isActive: true });
  const legacyDoc = {
    _id: new mongoose.Types.ObjectId(),
    clientId: legacyClientId,
    orgName: `Legacy ${runId}`,
    colors: { primary: '#10b981' },
    fonts: { heading: 'Montserrat', body: 'Nunito' },
    header: { height: 90, background: 'rgba(15, 23, 42, 0.95)', alignment: 'right', showLogo: false, showOrgName: true },
    footer: {
      height: 70,
      background: 'rgba(11, 15, 23, 0.98)',
      contactText: '+1 (555) 000-1111',
      website: 'www.legacy.example.test',
      socials: ['@legacy'],
      legalText: '© Legacy corp.',
    },
    defaultPosterSize: { width: 1080, height: 1350 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  created.brandKitIds.push(legacyDoc._id);
  await BrandKit.collection.insertOne(legacyDoc);

  const legacyAdmin = await makeUser({ email: `brand-legacy-${runId}@example.test`, role: 'clientadmin', clientId: legacyClientId });
  const legacyGet = await getKit(legacyAdmin.token);
  assert(legacyGet.status === 200, 'an old kit loads without migration errors');
  const legacyKit = legacyGet.body.data.brandKit;
  assert(legacyKit.header.background.color === 'rgba(15, 23, 42, 0.95)', 'old color-string background is readable as a background');
  assert(legacyKit.header.alignment === 'right', 'old header alignment kept');
  assert(legacyKit.header.logo.show === false && legacyKit.header.showLogo === false, 'old showLogo switch carried into the new switch');
  assert(legacyKit.header.orgName.show === true, 'old showOrgName switch carried into the new switch');
  assert(legacyKit.header.orgName.text === `Legacy ${runId}`, 'header name text falls back to the organization name');
  assert(legacyKit.footer.contactText === '+1 (555) 000-1111', 'old contact text untouched');
  assert(legacyKit.footer.socials.includes('@legacy'), 'old social list untouched');
  assert(legacyKit.preset === 'custom', 'missing preset defaults to custom');
  assert(legacyKit.footer.layout === 2 && legacyKit.content.infoCard.radius === 16, 'missing blocks come back with defaults');
  assert(legacyKit.content.headingFont === 'Montserrat' && legacyKit.content.bodyFont === 'Nunito', 'old fonts seed the new content fonts');
  assert(legacyKit.textStyle.fontFamily === 'Montserrat', 'old heading font seeds the base text style');
  assert(legacyKit.content.background.pattern === 'none', 'content background pattern defaults to none');

  const legacySave = await putKit(legacyAdmin.token, { header: { background: '#0ea5e9', height: 70 }, footer: { legalText: '<i>2026</i>' } });
  assert(legacySave.status === 200, 'an old-style save (bare color background) is still accepted');
  assert(legacySave.body.data.brandKit.header.background.type === 'color', 'the bare color became a proper background');
  assert(legacySave.body.data.brandKit.header.background.color === '#0ea5e9', 'the bare color is stored');
  assert(legacySave.body.data.brandKit.header.logo.show === false, 'the old logo switch survives a partial save');
  assert(legacySave.body.data.brandKit.footer.legalText === '2026', 'HTML stripped from legal text');
  assert(legacySave.body.data.brandKit.footer.website === 'www.legacy.example.test', 'untouched footer fields are kept');

  console.log('\n8. Migration');
  const untouchedClient = await Client.create({ name: `Untouched ${runId}`, plan: 'free', isActive: true });
  created.clientIds.push(untouchedClient._id);
  const untouchedDoc = {
    _id: new mongoose.Types.ObjectId(),
    clientId: untouchedClient._id,
    orgName: `Untouched ${runId}`,
    fonts: { heading: 'Cinzel', body: 'Inter' },
    header: { height: 80, background: 'rgba(2, 6, 23, 0.9)', alignment: 'left', showLogo: true, showOrgName: false },
    footer: { height: 70, background: 'rgba(15, 23, 42, 0.98)', contactText: '+1 (555) 222-0000', socials: ['@untouched'], legalText: '© Untouched.' },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  created.brandKitIds.push(untouchedDoc._id);
  await BrandKit.collection.insertOne(untouchedDoc);

  const firstRun = runMigration();
  assert(/Brand kits given new style blocks: [1-9]/.test(firstRun), `migration adds the missing blocks:\n${firstRun}`);
  assert(/Backgrounds moved into the new shape: [1-9]/.test(firstRun), `migration converts old background strings:\n${firstRun}`);
  assert(/Backgrounds given their default color back: \d+/.test(firstRun), 'migration reports background colors it repaired');
  const storedUntouched = await BrandKit.collection.findOne({ _id: untouchedDoc._id });
  assert(storedUntouched.preset === 'custom', 'migration stores the preset');
  assert(storedUntouched.content?.infoCard?.radius === 16, 'migration stores the content block');
  assert(typeof storedUntouched.header.background === 'object' && storedUntouched.header.background.color === 'rgba(2, 6, 23, 0.9)', 'old background string becomes a background');
  assert(storedUntouched.header.orgName.show === false && storedUntouched.header.showOrgName === false, 'old header switches are carried over');
  assert(storedUntouched.footer.social?.length === 0 && storedUntouched.footer.socials.includes('@untouched'), 'migration keeps the old social list');
  assert(storedUntouched.footer.contactText === '+1 (555) 222-0000', 'migration never rewrites stored text');
  assert(storedUntouched.fonts.heading === 'Cinzel', 'migration leaves fonts alone');
  const beforeRepeat = JSON.stringify(storedUntouched);
  const secondRun = runMigration();
  assert(/Brand kits given new style blocks: 0/.test(secondRun), `migration is idempotent:\n${secondRun}`);
  assert(/Backgrounds moved into the new shape: 0/.test(secondRun), 'second migration finds no old background');
  assert(/Backgrounds given their default color back: 0/.test(secondRun), 'second migration finds no blank color');
  const storedAfterSecond = await BrandKit.collection.findOne({ _id: untouchedDoc._id });
  assert(JSON.stringify(storedAfterSecond) === beforeRepeat, 'a repeat run changes nothing');

  const afterMigration = await getKit(legacyAdmin.token);
  assert(afterMigration.status === 200 && afterMigration.body.data.brandKit.header.height === 70, 'kit still loads after migration');

  console.log('\n9. Missing kit');
  const noKitClient = await Client.create({ name: `No Kit ${runId}`, plan: 'free', isActive: true });
  created.clientIds.push(noKitClient._id);
  const lonelyAdmin = await makeUser({ email: `brand-lonely-${runId}@example.test`, role: 'clientadmin', clientId: noKitClient._id });
  const noKit = await getKit(lonelyAdmin.token);
  assert(noKit.status === 404 && /not found/i.test(noKit.body.error.message), 'client without a brand kit gets a friendly 404');

  console.log(`\nBrand kit tests passed: ${passed} assertions`);
}

try {
  await run();
} catch (err) {
  console.error(`\nBRAND KIT TEST FAILED: ${err.message}`);
  process.exitCode = 1;
} finally {
  if (server) server.close();
  await cleanup();
  await mongoose.connection.close().catch(() => {});
}
