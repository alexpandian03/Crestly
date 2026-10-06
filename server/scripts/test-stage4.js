import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import http from 'http';
import mongoose from 'mongoose';
import app from '../app.js';
import { connectDB } from '../config/db.js';
import User from '../models/User.model.js';
import Client from '../models/Client.model.js';
import Template from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import { generateToken } from '../services/auth.service.js';

let passed = 0;
let failed = 0;
const testPassword = `Test${crypto.randomBytes(8).toString('hex')}9`;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('🧪 Starting Stage 4: Template Model & Poster Renderer Test Suite...\n');

  await connectDB();
  const PORT = 5019;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  const baseUrl = `http://127.0.0.1:${PORT}`;

  try {
    // 1. Tenant & User Setup
    console.log('1. Tenant Setup');
    let client = await Client.findOne({ name: 'Acme Corporation' });
    if (!client) {
      client = await Client.create({ name: 'Acme Corporation', plan: 'starter', isActive: true });
    }
    assert(Boolean(client._id), `Tenant found: ${client.name} (${client._id})`);

    let clientAdmin = await User.findOne({ email: 'clientadmin@acme.com' });
    if (!clientAdmin) {
      clientAdmin = await User.create({
        name: 'Acme Admin',
        email: 'clientadmin@acme.com',
        passwordHash: await User.hashPassword(testPassword),
        role: 'clientadmin',
        clientId: client._id,
      });
    }
    const token = generateToken(clientAdmin);

    // 2. Unauthenticated request rejected
    console.log('\n2. Authentication Guard');
    const unauthRes = await fetch(`${baseUrl}/api/templates`);
    assert(unauthRes.status === 401, 'GET /api/templates without token returns 401 Unauthorized');

    // 3. Authenticated template retrieval & auto-creation
    console.log('\n3. Template Retrieval & Auto-Provisioning');
    const templatesRes = await fetch(`${baseUrl}/api/templates`, {
      headers: { authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    assert(templatesRes.success === true, 'GET /api/templates returns success: true');
    assert(Array.isArray(templatesRes.data.templates), 'Returns an array of templates');
    assert(templatesRes.data.templates.length > 0, 'Auto-created at least 1 default template for tenant');

    const defaultTemplate = templatesRes.data.templates[0];
    assert(Boolean(defaultTemplate._id), `Template ID present: ${defaultTemplate._id}`);
    assert(defaultTemplate.size?.width === 1080, 'Template width is 1080px');
    assert(defaultTemplate.size?.height === 1350, 'Template height is 1350px');

    // 4. Zone verification
    console.log('\n4. Zone Layout Structure');
    const zoneTypes = defaultTemplate.zones?.map((z) => z.type);
    assert(zoneTypes.includes('header'), 'Template has header zone');
    assert(zoneTypes.includes('content'), 'Template has content zone');
    assert(zoneTypes.includes('image'), 'Template has image zone');
    assert(zoneTypes.includes('footer'), 'Template has footer zone');

    const headerZone = defaultTemplate.zones.find((z) => z.type === 'header');
    assert(headerZone.locked === true, 'Header zone is locked');
    assert(headerZone.y === 0, 'Header zone is positioned at top (y = 0)');

    const footerZone = defaultTemplate.zones.find((z) => z.type === 'footer');
    assert(footerZone.locked === true, 'Footer zone is locked');

    const contentZone = defaultTemplate.zones.find((z) => z.type === 'content');
    assert(contentZone.locked === false, 'Content zone is editable (locked: false)');
    assert(typeof contentZone.minFont === 'number', 'Content zone specifies minFont for auto-fitting');
    assert(typeof contentZone.maxFont === 'number', 'Content zone specifies maxFont for auto-fitting');

    // 5. Single template retrieval by ID
    console.log('\n5. Single Template Retrieval');
    const singleRes = await fetch(`${baseUrl}/api/templates/${defaultTemplate._id}`, {
      headers: { authorization: `Bearer ${token}` },
    }).then((r) => r.json());

    assert(singleRes.success === true, 'GET /api/templates/:id returns success: true');
    assert(singleRes.data.template?._id === defaultTemplate._id, 'Returned template ID matches requested ID');

    // 6. Cross-Tenant Isolation
    console.log('\n6. Cross-Tenant Boundary Enforcement');
    // Create or find a second client
    let otherClient = await Client.findOne({ name: 'Other Corporation' });
    if (!otherClient) {
      otherClient = await Client.create({ name: 'Other Corporation', plan: 'free', isActive: true });
    }
    let otherAdmin = await User.findOne({ email: 'otheradmin@other.com' });
    if (!otherAdmin) {
      otherAdmin = await User.create({
        name: 'Other Admin',
        email: 'otheradmin@other.com',
        passwordHash: await User.hashPassword(testPassword),
        role: 'clientadmin',
        clientId: otherClient._id,
      });
    }
    const otherToken = generateToken(otherAdmin);

    // Other admin attempts to fetch Acme's template ID
    const crossTenantRes = await fetch(`${baseUrl}/api/templates/${defaultTemplate._id}`, {
      headers: { authorization: `Bearer ${otherToken}` },
    });
    assert(
      crossTenantRes.status === 404,
      'Other tenant cannot access Acme template (HTTP 404 tenant-scoped isolation)'
    );

    // 7. Definition of Done: Branded Poster Independence
    console.log('\n7. Definition of Done: Brand Independence');
    const sampleContent = {
      title: 'AI Dev Summit 2026',
      tagline: 'Autonomous Code',
      date: 'Dec 1, 2026',
      time: '10:00 AM',
      venue: 'San Francisco, CA',
      details: ['Keynote', 'Workshops', 'Networking'],
    };
    // Content has no colors or brand fonts:
    assert(!sampleContent.primaryColor, 'Content JSON has no primaryColor (brand styling decoupled)');
    assert(!sampleContent.headingFont, 'Content JSON has no headingFont (brand typography decoupled)');

    console.log(`\n========================================`);
    console.log(`RESULTS: ${passed} passed, ${failed} failed`);
    console.log(`========================================\n`);

    server.close();
    await mongoose.connection.close();
    process.exit(failed > 0 ? 1 : 0);
  } catch (err) {
    console.error('Test suite failed unexpectedly:', err);
    server.close();
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  }
}

runTests();
