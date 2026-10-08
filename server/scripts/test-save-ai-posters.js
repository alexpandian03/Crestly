import 'dotenv/config';
process.env.LLM_PROVIDER = 'mock';

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

// Hard 20-second timeout
const timeoutTimer = setTimeout(() => {
  console.error('FAIL: Test timed out after 20 seconds');
  process.exit(1);
}, 20000);
timeoutTimer.unref();

const runId = crypto.randomBytes(6).toString('hex');
const password = `TestPass${crypto.randomBytes(6).toString('hex')}1!`;

const created = {
  clientIds: [],
  brandKitIds: [],
  templateIds: [],
  userIds: [],
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
  try {
    await connectDB();
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const client = await Client.create({ name: `AI Poster Client ${runId}`, plan: 'starter', isActive: true });
    created.clientIds.push(client._id);

    const brandKit = await BrandKit.create({ clientId: client._id, orgName: client.name });
    created.brandKitIds.push(brandKit._id);

    const template = await Template.create(getDefaultTemplateData(client._id, `Template ${runId}`));
    created.templateIds.push(template._id);

    const user = await User.create({
      name: `Tester ${runId}`,
      email: `tester-${runId}@example.test`,
      passwordHash: await User.hashPassword(password),
      role: 'clientadmin',
      clientId: client._id,
    });
    created.userIds.push(user._id);
    const token = generateToken(user);

    const descriptions = [
      'sports day with inter-school athletic championships and relay events',
      'Diwali market with festive sweets handicraft stalls and diyas',
      'blood donation camp organized by city hospital with free health checks',
      'awards night honoring outstanding employee achievements and leadership',
    ];

    let passedSteps = 0;

    for (const prompt of descriptions) {
      console.log(`Testing description: "${prompt}"`);

      // 1. Generate poster
      const genRes = await request('/api/posters/generate', {
        method: 'POST',
        token,
        body: {
          templateId: String(template._id),
          prompt,
          mode: 'ai',
        },
      });

      if (genRes.status !== 200 || !genRes.body.success) {
        throw new Error(`Generation failed for "${prompt}": status ${genRes.status} ${JSON.stringify(genRes.body)}`);
      }
      passedSteps++;
      console.log(`  PASS: generated design (${genRes.body.data.design.archetype})`);

      const { design, content } = genRes.body.data;

      // 2. Save through real save route
      const saveRes = await request('/api/posters', {
        method: 'POST',
        token,
        body: {
          templateId: String(template._id),
          prompt,
          content,
          recipe: {
            archetype: design.archetype,
            variant: design.variant,
            icon: design.icon,
          },
        },
      });

      if (saveRes.status !== 201 || !saveRes.body.success) {
        throw new Error(`Save failed for "${prompt}": status ${saveRes.status} ${JSON.stringify(saveRes.body)}`);
      }
      passedSteps++;
      const savedPoster = saveRes.body.data.poster;
      created.posterIds.push(savedPoster._id);
      console.log(`  PASS: saved poster ${savedPoster._id}`);

      // 3. Load back
      const loadRes = await request(`/api/posters/${savedPoster._id}`, {
        method: 'GET',
        token,
      });

      if (loadRes.status !== 200 || !loadRes.body.success) {
        throw new Error(`Load failed for "${prompt}": status ${loadRes.status} ${JSON.stringify(loadRes.body)}`);
      }
      passedSteps++;
      const loadedPoster = loadRes.body.data.poster;
      if (loadedPoster.title !== content.title) {
        throw new Error(`Title mismatch on load: expected "${content.title}", got "${loadedPoster.title}"`);
      }
      if (loadedPoster.archetype !== design.archetype) {
        throw new Error(`Archetype mismatch on load: expected "${design.archetype}", got "${loadedPoster.archetype}"`);
      }
      console.log(`  PASS: loaded back poster ${loadedPoster._id} with matching title & archetype`);

      // 4. Re-save does not lose data
      const patchRes = await request(`/api/posters/${savedPoster._id}`, {
        method: 'PATCH',
        token,
        body: {
          content: { ...loadedPoster.content, title: `${loadedPoster.content.title} (Updated)` },
          expectedVersion: loadedPoster.currentVersion,
          note: 'Edited title',
        },
      });

      if (patchRes.status !== 200 || !patchRes.body.success) {
        throw new Error(`Re-save failed: status ${patchRes.status} ${JSON.stringify(patchRes.body)}`);
      }
      passedSteps++;
      const updatedPoster = patchRes.body.data.poster;
      if (updatedPoster.archetype !== design.archetype) {
        throw new Error(`Archetype lost on re-save: expected "${design.archetype}", got "${updatedPoster.archetype}"`);
      }
      console.log(`  PASS: re-saved poster version ${updatedPoster.currentVersion} without data loss`);
    }

    // 5. Test legacy aliases compatibility (hero -> ticket, photoTop -> photo-hero)
    console.log('Testing legacy aliases compatibility:');
    const legacyTests = [
      { alias: 'hero', expectedCanonical: 'ticket' },
      { alias: 'photoTop', expectedCanonical: 'photo-hero' },
    ];

    for (const { alias, expectedCanonical } of legacyTests) {
      const aliasSave = await request('/api/posters', {
        method: 'POST',
        token,
        body: {
          templateId: String(template._id),
          prompt: `Testing legacy alias ${alias}`,
          content: {
            title: `Legacy ${alias} Title`,
            tagline: 'Legacy Tagline',
            date: '10 Oct',
            time: '10 AM',
            venue: 'Main Hall',
            details: ['Detail line 1'],
            imageUrl: '',
          },
          recipe: {
            recipeId: alias,
            variant: 0,
          },
        },
      });

      if (aliasSave.status !== 201 || !aliasSave.body.success) {
        throw new Error(`Save with legacy alias ${alias} failed: status ${aliasSave.status} ${JSON.stringify(aliasSave.body)}`);
      }
      const aliasPoster = aliasSave.body.data.poster;
      created.posterIds.push(aliasPoster._id);

      const aliasLoad = await request(`/api/posters/${aliasPoster._id}`, {
        method: 'GET',
        token,
      });

      if (aliasLoad.status !== 200 || !aliasLoad.body.success) {
        throw new Error(`Load for legacy alias ${alias} failed: ${JSON.stringify(aliasLoad.body)}`);
      }
      const loadedAliasPoster = aliasLoad.body.data.poster;
      if (loadedAliasPoster.archetype !== expectedCanonical || loadedAliasPoster.recipeId !== expectedCanonical) {
        throw new Error(`Legacy alias ${alias} was not mapped to ${expectedCanonical}: got archetype=${loadedAliasPoster.archetype}, recipeId=${loadedAliasPoster.recipeId}`);
      }
      passedSteps++;
      console.log(`  PASS: legacy alias "${alias}" mapped to canonical "${expectedCanonical}" on read`);
    }

    console.log(`\nALL TESTS PASSED: ${passedSteps} test checks completed successfully.`);
  } finally {
    await cleanup();
  }
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Test execution failed:', err);
    process.exit(1);
  });
