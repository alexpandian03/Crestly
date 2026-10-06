import dotenv from 'dotenv';
dotenv.config();

import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import Poster from '../models/Poster.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import RateCounter from '../models/RateCounter.model.js';
import { generateToken } from '../services/auth.service.js';
import { checkContentImageUrl } from '../../shared/templateElements.js';
import {
  IMAGE_SUBJECT_LIMITS,
  aspectRatioFor,
  buildImagePrompt,
  cleanSubject,
  paletteOf,
  screenSubject,
} from '../services/image/prompt.js';
import { IMAGE_LIMITS } from '../services/image/limits.js';
import {
  IMAGE_MAX_BYTES,
  IMAGE_PROVIDERS,
  IMAGE_TIMEOUT_MS,
  generatePosterPicture,
  imageProviderName,
} from '../services/image/index.js';
import { generateWithMockImage } from '../services/image/providers/mock.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  PASS: ${message}`);
    passed++;
  } else {
    console.error(`  FAIL: ${message}`);
    failed++;
  }
}

function section(title) {
  console.log(`\n${title}`);
}

const OWN_CLIENT_ID = 'aaaaaaaaaaaaaaaaaaaaaaaa';
const OTHER_CLIENT_ID = 'bbbbbbbbbbbbbbbbbbbbbbbb';
const CLOUD = 'demo-cloud';

/** The same picture rules the route uses, run without a database or a network call. */
async function runRuleTests() {
  section('1. The one sentence a picture is asked for');
  const kit = {
    colors: { primary: '#1E40AF', secondary: '#7C3AED', accent: '#F59E0B' },
    content: { headingColor: '#0F172A', bodyColor: '#334155' },
  };
  const prompt = buildImagePrompt({ subject: 'World Blood Donor Camp', brandKit: kit });
  assert(
    prompt.startsWith('A clean flat illustration of '),
    'the sentence always opens the same way'
  );
  assert(
    prompt.includes('no text, no logos, no people\'s faces'),
    'the sentence always refuses words, marks and faces'
  );
  assert(
    prompt.includes('colors #1e40af, #7c3aed, #f59e0b'),
    'the sentence names the brand colors'
  );
  assert(
    !prompt.includes('http') && !prompt.includes('{'),
    'no address or unfilled placeholder can leak into the sentence'
  );
  assert(
    buildImagePrompt({ subject: 'x'.repeat(200), brandKit: kit }).length <
      160 + IMAGE_SUBJECT_LIMITS.max,
    'a long headline is cut before it reaches the picture service'
  );
  assert(
    buildImagePrompt({ subject: '', brandKit: {} }).includes('the brand colors'),
    'a brand with no readable colors still answers with a plain sentence'
  );

  section('2. Only the poster headline is read, and only in plain words');
  assert(cleanSubject('  Health   Mela\n2026 ') === 'Health Mela 2026', 'newlines and spaces collapse');
  assert(cleanSubject('<b>Diabetes</b> Mela') === 'Diabetes Mela', 'any markup is dropped');
  assert(cleanSubject('Mela; rm -rf / --help') === 'Mela rm rf help', 'punctuation and switches are dropped');
  assert(
    cleanSubject('a'.repeat(120)).length <= IMAGE_SUBJECT_LIMITS.max,
    `a subject is cut to ${IMAGE_SUBJECT_LIMITS.max} characters`
  );
  assert(cleanSubject(null) === '' && cleanSubject(42) === '', 'anything that is not text gives nothing');

  section('3. Ideas that must not be drawn are refused first');
  const unsafe = [
    'Toy gun drive',
    'Knife safety workshop',
    'Bomb disposal demo',
    'Portrait of our president',
    'Celebrity lookalike night',
    'Nude yoga class',
    'Sex education show',
    'Casino jackpot night',
    'Heroin harm reduction',
    'Suicide memorial march',
    'Racist rally',
    'Swastika exhibit',
    'Logo design contest',
    'Selfie contest',
  ];
  for (const subject of unsafe) {
    const result = screenSubject(subject);
    assert(
      !result.ok && /^[A-Z]/.test(result.reason) && !result.reason.includes('{'),
      `refused in plain words: ${subject}`
    );
  }
  const safe = [
    'World Blood Donor Day',
    'Annual Sports Meet',
    'Tree Plantation Drive',
    'Diabetes Awareness Mela',
    'Road Safety Week',
    'School Annual Day',
    'Freedom Fair 2026',
    'Clean Water Camp',
    'Yoga For All',
    'Cancer Screening Camp',
  ];
  for (const subject of safe) {
    assert(screenSubject(subject).ok === true, `allowed: ${subject}`);
  }
  assert(
    screenSubject('classic cars').ok === true,
    'a word that only contains a blocked word is not blocked'
  );
  assert(screenSubject('go').ok === false, 'too few words to draw anything');
  assert(screenSubject('<em>kill</em>').ok === false, 'markup cannot smuggle a blocked word past');

  section('4. Only this tenant\'s own library may hold the picture');
  const mine = `https://res.cloudinary.com/${CLOUD}/image/upload/brand/${OWN_CLIENT_ID}/ai-pictures/p-1.png`;
  const theirs = `https://res.cloudinary.com/${CLOUD}/image/upload/brand/${OTHER_CLIENT_ID}/ai-pictures/p-1.png`;
  assert(checkContentImageUrl(mine, { cloudName: CLOUD, clientId: OWN_CLIENT_ID }).ok, 'this tenant\'s folder is accepted');
  assert(!checkContentImageUrl(theirs, { cloudName: CLOUD, clientId: OWN_CLIENT_ID }).ok, 'another tenant\'s folder is refused');
  assert(!checkContentImageUrl('http://res.cloudinary.com/x/y.png', { cloudName: CLOUD, clientId: OWN_CLIENT_ID }).ok, 'an insecure address is refused');
  assert(!checkContentImageUrl('data:image/png;base64,AAAA', { cloudName: CLOUD, clientId: OWN_CLIENT_ID }).ok, 'a data address is refused');
  assert(
    checkContentImageUrl('https://images.pexels.com/photos/1/p.jpg', { cloudName: CLOUD, clientId: OWN_CLIENT_ID }).ok,
    'a stock photo stays allowed, so the fallback can be used'
  );

  section('5. The shape asked for follows the poster');
  assert(aspectRatioFor({ width: 1080, height: 1350 }) === '4:5', 'the standard portrait poster asks for 4:5');
  assert(aspectRatioFor({ width: 600, height: 800 }) === '3:4', 'a taller poster asks for 3:4');
  assert(aspectRatioFor({ width: 1920, height: 1080 }) === '16:9', 'a wide poster asks for 16:9');
  assert(aspectRatioFor({ width: 1080, height: 1080 }) === '1:1', 'a square poster asks for 1:1');
  assert(aspectRatioFor(null) === '4:5', 'nothing declared still answers with the standard poster');

  section('6. The picture service is chosen by one setting');
  assert(IMAGE_PROVIDERS.join('|') === 'mock|gemini', 'only mock and gemini are offered');
  assert(IMAGE_TIMEOUT_MS === 25000, 'one picture gets 25 seconds');
  assert(IMAGE_MAX_BYTES === 8 * 1024 * 1024, 'a picture over 8 MB is never carried');
  process.env.IMAGE_PROVIDER = '';
  assert(imageProviderName() === 'mock', 'nothing set means the stock placeholder service');
  process.env.IMAGE_PROVIDER = 'GEMINI ';
  assert(imageProviderName() === 'gemini', 'the setting is read whatever the case or spacing');

  const savedProvider = process.env.IMAGE_PROVIDER;
  process.env.IMAGE_PROVIDER = 'openai';
  let refused = null;
  try {
    await generatePosterPicture({ subject: 'Health Mela', brandKit: kit, size: { width: 1080, height: 1350 }, clientId: OWN_CLIENT_ID });
  } catch (err) {
    refused = err;
  }
  assert(refused?.status === 503 && /more time/i.test(refused.message), 'a service that needs too long is refused, not run');

  process.env.IMAGE_PROVIDER = 'mock';
  const made = await generatePosterPicture({
    subject: 'Health Mela',
    brandKit: kit,
    size: { width: 1080, height: 1350 },
    clientId: OWN_CLIENT_ID,
  });
  assert(made.provider === 'mock' && made.imageUrl.startsWith('https://images.pexels.com/'), 'the mock answers with one stock placeholder');
  assert(
    checkContentImageUrl(made.imageUrl, { clientId: OWN_CLIENT_ID }).ok,
    'the placeholder is an address a poster may store'
  );
  const direct = await generateWithMockImage({ subject: 'ignored' });
  assert(direct.url === made.imageUrl, 'the placeholder is the same picture every time');

  if (!process.env.GEMINI_API_KEY) {
    process.env.IMAGE_PROVIDER = 'gemini';
    let geminiErr = null;
    try {
      await generatePosterPicture({ subject: 'Health Mela', brandKit: kit, size: null, clientId: OWN_CLIENT_ID });
    } catch (err) {
      geminiErr = err;
    }
    assert(
      geminiErr?.status === 503 && /not turned on/i.test(geminiErr.message),
      'gemini without a key says so plainly and asks for nothing'
    );
  } else {
    console.log('  SKIP: GEMINI_API_KEY is set, so the no-key answer was not tested');
  }
  process.env.IMAGE_PROVIDER = savedProvider ?? 'mock';

  section('7. One day of picture making');
  assert(IMAGE_LIMITS.perUserPerDay === 10 && IMAGE_LIMITS.perClientPerDay === 60, 'the daily counts are the shipped ones');
  assert(IMAGE_LIMITS.dayWindowMs === 24 * 60 * 60 * 1000, 'the count rolls over at a day');
}

async function runRouteTests(baseUrl) {
  section('8. The route in the real app');
  /* The suite answers with the stock placeholder: no paid service is called and nothing waits. */
  const savedRouteProvider = process.env.IMAGE_PROVIDER;
  process.env.IMAGE_PROVIDER = 'mock';

  const clientA = await Client.create({ name: 'Picture Test Org', plan: 'starter', isActive: true });
  const clientB = await Client.create({ name: 'Picture Test Org Two', plan: 'starter', isActive: true });
  const adminA = await User.create({
    name: 'Picture Admin',
    email: `picture-admin-${Date.now()}@test.local`,
    passwordHash: await User.hashPassword('TestPassword1'),
    role: 'clientadmin',
    clientId: clientA._id,
  });
  const userA = await User.create({
    name: 'Picture Maker',
    email: `picture-user-${Date.now()}@test.local`,
    passwordHash: await User.hashPassword('TestPassword1'),
    role: 'user',
    clientId: clientA._id,
  });
  const templateA = await Template.create(getDefaultTemplateData(clientA._id, 'Picture Test'));
  const tokenA = generateToken(adminA);
  const tokenUserA = generateToken(userA);
  const ownClientId = String(clientA._id);
  const createdPosters = [];

  const call = async (token, body) => {
    const res = await fetch(`${baseUrl}/api/posters/image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    let json = null;
    try {
      json = await res.json();
    } catch {
      /* An empty body is a failure of its own and the status tells us which. */
    }
    return { status: res.status, json };
  };

  const photoBody = (title = 'Annual Sports Meet', recipeId = 'photoTop') => ({ recipeId, title });

  try {
    const anon = await call(null, photoBody());
    assert(anon.status === 401, 'a stranger is asked to log in');

    const badRecipe = await call(tokenA, photoBody('Annual Sports Meet', 'not-a-design'));
    assert(badRecipe.status === 400, 'a design this app does not have is refused');
    assert(
      /designs this app offers/i.test(badRecipe.json?.error?.message || ''),
      'and says so in the same words the other design routes use'
    );

    const shortTitle = await call(tokenA, photoBody('go'));
    assert(shortTitle.status === 400, 'a headline too short to draw is refused');

    const noPictureArea = await call(tokenA, photoBody('Annual Sports Meet', 'typographic'));
    assert(noPictureArea.status === 400, 'a design with no place for a picture is refused');
    assert(
      /no place for a picture/i.test(noPictureArea.json?.error?.message || ''),
      'and the answer explains what to choose instead'
    );
    const wordsOnly = await call(tokenA, photoBody('Annual Sports Meet', 'boldBand'));
    assert(wordsOnly.status === 400, 'the words-only design is refused the same way');

    const unsafe = await call(tokenA, photoBody('Toy gun safety day'));
    assert(unsafe.status === 400, 'an idea that must not be drawn is refused before anything is asked');
    assert(
      !/prompt|model|api/i.test(unsafe.json?.error?.message || ''),
      'the refusal never names the picture service'
    );

    const made = await call(tokenUserA, photoBody());
    assert(made.status === 200, 'a plain poster maker can ask for one picture');
    const imageUrl = made.json?.data?.imageUrl || '';
    assert(
      imageUrl.startsWith('https://') && checkContentImageUrl(imageUrl, { clientId: ownClientId }).ok,
      'the answer is one address this poster is allowed to store'
    );
    assert(made.json?.data?.provider === 'mock', 'the answer says which service made it');
    assert(made.json?.data?.message === '' && made.json?.data?.stockUrl === '', 'a picture that arrived needs no excuse');

    /* The picture is only an address: saving it with the poster must work like any photo. */
    const saveRes = await fetch(`${baseUrl}/api/posters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenUserA}` },
      body: JSON.stringify({
        templateId: String(templateA._id),
        prompt: 'Annual sports meet on 12 Nov at the town ground',
        content: { title: 'Annual Sports Meet', imageUrl },
      }),
    });
    const saved = await saveRes.json().catch(() => null);
    const poster = saved?.data?.poster;
    if (poster?._id) createdPosters.push(String(poster._id));
    assert(saveRes.status === 201, 'the picture address saves with the poster');
    assert(poster?.content?.imageUrl === imageUrl, 'and the poster keeps exactly that address');
    assert(!JSON.stringify(poster?.content || {}).includes('base64'), 'no picture bytes are stored with the poster');

    const otherUrl = `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/brand/${clientB._id}/ai-pictures/p.png`;
    const stealRes = await fetch(`${baseUrl}/api/posters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tokenUserA}` },
      body: JSON.stringify({
        templateId: String(templateA._id),
        prompt: 'Annual sports meet',
        content: { title: 'Annual Sports Meet', imageUrl: otherUrl },
      }),
    });
    assert(stealRes.status === 400, 'a picture from another organization\'s folder cannot be saved');

    const clientOff = await Client.findByIdAndUpdate(clientA._id, { $set: { 'designModes.ai': false } });
    const blocked = await call(tokenUserA, photoBody());
    assert(blocked.status === 403, 'when the organization switches designs off, pictures stop too');
    assert(/switched off for your organization/i.test(blocked.json?.error?.message || ''), 'and the answer points at the setting');
    await Client.findByIdAndUpdate(String(clientOff._id), { $set: { 'designModes.ai': true } });
    const allowedAgain = await call(tokenUserA, photoBody());
    assert(allowedAgain.status === 200, 'turning it back on works without a restart');

    section('9. The daily count is shared by every instance');
    /* One made above, then up to the cap. The eleventh request of the day must be refused. */
    let last = allowedAgain;
    let count = 2;
    while (count < IMAGE_LIMITS.perUserPerDay && last.status === 200) {
      last = await call(tokenUserA, photoBody());
      count++;
    }
    assert(last.status === 200, `the first ${IMAGE_LIMITS.perUserPerDay} pictures of the day all arrive`);
    const over = await call(tokenUserA, photoBody());
    assert(over.status === 429, 'the next one is refused for the day');
    assert(
      /today/i.test(over.json?.error?.message || '') && !/rate|limit|quota/i.test(over.json?.error?.message || ''),
      'and the answer is a plain sentence, not a technical one'
    );
    const otherUser = await call(tokenA, photoBody('Tree Plantation Drive'));
    assert(otherUser.status === 200, 'the count belongs to one person, not to everyone');
  } finally {
    await Poster.deleteMany({ _id: { $in: createdPosters.map((id) => new mongoose.Types.ObjectId(id)) } });
    await Poster.deleteMany({ clientId: { $in: [clientA._id, clientB._id] } });
    await Template.deleteMany({ clientId: { $in: [clientA._id, clientB._id] } });
    await BrandKit.deleteMany({ clientId: { $in: [clientA._id, clientB._id] } });
    await User.deleteMany({ clientId: { $in: [clientA._id, clientB._id] } });
    await Client.deleteMany({ _id: { $in: [clientA._id, clientB._id] } });
    await RateCounter.deleteMany({ key: { $in: [`ai-picture:user:${userA._id}`, `ai-picture:user:${adminA._id}`, `ai-picture:client:${clientA._id}`] } });
    console.log('\n10. Test data cleaned up');
  }
}

async function runAll() {
  console.log('Poster picture tests');
  await runRuleTests();

  await connectDB();
  const PORT = 5031;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  try {
    await runRouteTests(`http://127.0.0.1:${PORT}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runAll().catch(async (err) => {
  console.error('Suite crashed:', err);
  process.exit(1);
});
