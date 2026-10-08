import dotenv from 'dotenv';
dotenv.config();

// Ensure mock provider is used for deterministic local e2e tests
process.env.LLM_PROVIDER = 'mock';

import http from 'http';
import crypto from 'crypto';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import Template, { getDefaultTemplateData } from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import { generateToken } from '../services/auth.service.js';

const DESCRIPTIONS = [
  {
    name: 'sports day',
    prompt: 'Annual Sports Day on 15 Nov, 8 AM at Main Stadium with track events and games',
  },
  {
    name: 'Diwali night market',
    prompt: 'Diwali night market on 24 Oct, 6 PM at City Center with food and handicraft stalls',
  },
  {
    name: 'blood donation',
    prompt: 'Blood donation camp on 12 Nov, 9 AM at Town Hall. Every donor receives a certificate and refreshments.',
  },
  {
    name: 'awards',
    prompt: 'Annual Excellence Awards ceremony honoring outstanding community leaders on 20 Dec, 7 PM at Grand Ballroom',
  },
  {
    name: 'cultural fest (long description)',
    prompt: 'Grand Inter-College Cultural Fest with live music performances, classical dance competitions, street plays, digital art exhibits, food stalls, gaming arenas, and special celebrity guest appearances on 5 Dec, 10 AM at University Campus Auditorium',
  },
  {
    name: 'Tamil Pongal',
    prompt: 'Tamil Pongal harvest festival celebration with traditional music, kolam contest, and sweet pongal feast on 14 Jan, 9 AM at Community Grounds',
  },
  {
    name: 'yoga with no venue',
    prompt: 'Morning yoga and meditation session for mental wellness and flexibility on 21 June at 6 AM',
  },
  {
    name: 'a 60-character title',
    prompt: 'Community Cleanliness & Tree Planting Environmental Drive 2026 on 18 Oct, 8 AM at Green Valley Park',
  },
];

let passed = 0;
let failed = 0;
const results = {};

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runE2ETests() {
  console.log('🧪 Starting End-to-End Poster Generation Test (8 Descriptions)...\n');
  console.log(`Using LLM_PROVIDER=${process.env.LLM_PROVIDER}\n`);

  await connectDB();
  const PORT = 5029;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Setup Tenant & User
    let client = await Client.findOne({ name: 'Acme Corporation' });
    if (!client) {
      client = await Client.create({ name: 'Acme Corporation', plan: 'starter', isActive: true, designModes: { ai: true, template: true } });
    }

    const testPassword = `Test${crypto.randomBytes(8).toString('hex')}9`;
    let user = await User.findOne({ email: 'e2e-tester@acme.com' });
    if (!user) {
      user = await User.create({
        name: 'E2E Tester',
        email: 'e2e-tester@acme.com',
        passwordHash: await User.hashPassword(testPassword),
        role: 'clientadmin',
        clientId: client._id,
      });
    }
    const token = generateToken(user);

    let template = await Template.findOne({ clientId: client._id, isActive: true });
    if (!template) {
      template = await Template.create(getDefaultTemplateData(client._id, 'Acme Default'));
    }

    let brandKit = await BrandKit.findOne({ clientId: client._id });
    if (!brandKit) {
      brandKit = await BrandKit.create({
        clientId: client._id,
        orgName: 'Acme Corporation',
        colors: { primary: '#2563EB', secondary: '#1E293B', accent: '#3B82F6', background: '#FFFFFF', text: '#0F172A' },
        fonts: { heading: 'Outfit', body: 'Inter' },
        header: { height: 140 },
        footer: { height: 130 },
      });
    }

    // 2. Iterate through all 8 descriptions
    for (const item of DESCRIPTIONS) {
      console.log(`\nTesting description: "${item.name}"`);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000); // 20s timeout

      try {
        // Test in mode: "ai"
        const resAi = await fetch(`${baseUrl}/api/posters/generate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            prompt: item.prompt,
            mode: 'ai',
            templateId: template._id.toString(),
          }),
          signal: controller.signal,
        });

        const dataAi = await resAi.json();
        clearTimeout(timeout);

        assert(resAi.status === 200, `"${item.name}" (mode: ai) returned HTTP 200`);
        assert(dataAi.success === true, `"${item.name}" (mode: ai) returned success: true`);
        assert(Boolean(dataAi.data?.content?.title), `"${item.name}" (mode: ai) produced title: "${dataAi.data?.content?.title}"`);
        assert(Boolean(dataAi.data?.content?.venue), `"${item.name}" (mode: ai) produced venue: "${dataAi.data?.content?.venue}"`);
        assert(Array.isArray(dataAi.data?.content?.details), `"${item.name}" (mode: ai) produced details array`);

        // Check bullets max 6 words
        const bullets = dataAi.data?.content?.details || [];
        const wordsValid = bullets.every((b) => b.trim().split(/\s+/).length <= 6);
        assert(wordsValid, `"${item.name}" (mode: ai) all bullets <= 6 words each (${bullets.length} bullets)`);

        results[item.name] = { passed: resAi.status === 200 && dataAi.success === true };
      } catch (err) {
        clearTimeout(timeout);
        results[item.name] = { passed: false, error: err.message };
        assert(false, `"${item.name}" failed: ${err.message}`);
      }
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.disconnect();
  }

  console.log('\n========================================');
  console.log(`Test Summary: ${passed} passed, ${failed} failed`);
  console.log('Descriptions Results:');
  for (const [name, res] of Object.entries(results)) {
    console.log(`  - ${name}: ${res.passed ? 'PASSED' : 'FAILED (' + res.error + ')'}`);
  }
  console.log('========================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runE2ETests().catch((err) => {
  console.error('Test suite uncaught error:', err);
  process.exit(1);
});
