import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Template from '../models/Template.model.js';
import {
  LAYOUT_OPTIONS,
  TEMPLATE_CATEGORIES,
  layoutDefaultsFor,
} from '../services/template/zones.js';

/**
 * Stage 9 template migration. Safe to run repeatedly:
 * - fills the new layout choices with defaults (derived from the zones, never changing them)
 * - adds isDefault and versions
 * - maps legacy category values onto the new category list
 * - reports templates whose names collide inside one organization (the new unique name rule)
 *
 * Zone geometry is never modified. Renaming colliding templates is opt-in:
 *   node server/scripts/migrate-templates.js --fix-names
 */

const LAYOUT_KEYS = Object.keys(LAYOUT_OPTIONS);
const fixNames = process.argv.includes('--fix-names');

let layoutAdded = 0;
let flagsAdded = 0;
let categoryFixed = 0;

function log(message) {
  console.log(message);
}

async function addLayoutDefaults() {
  const needsLayout = {
    $or: LAYOUT_KEYS.map((key) => ({ [`layout.${key}`]: { $exists: false } })),
  };

  // Raw reads: a hydrated mongoose document would show schema defaults instead of what is stored.
  const cursor = Template.collection.find(needsLayout, {
    projection: { name: 1, zones: 1, layout: 1 },
  });
  for await (const template of cursor) {
    const defaults = layoutDefaultsFor(template.zones || []);
    const set = {};
    for (const key of LAYOUT_KEYS) {
      if (template.layout?.[key] === undefined) set[`layout.${key}`] = defaults[key];
    }
    if (Object.keys(set).length === 0) continue;
    await Template.collection.updateOne({ _id: template._id }, { $set: set });
    layoutAdded += 1;
  }
  log(`Templates given layout defaults: ${layoutAdded}`);
}

async function addFlagsAndHistory() {
  const isDefaultResult = await Template.updateMany(
    { isDefault: { $exists: false } },
    { $set: { isDefault: false } }
  );
  const versionsResult = await Template.updateMany(
    { versions: { $exists: false } },
    { $set: { versions: [] } }
  );
  const versionResult = await Template.updateMany(
    { version: { $exists: false } },
    { $set: { version: 1 } }
  );
  flagsAdded = isDefaultResult.modifiedCount + versionsResult.modifiedCount + versionResult.modifiedCount;
  log(
    `Templates given isDefault/versions/version fields: ${isDefaultResult.modifiedCount}/${versionsResult.modifiedCount}/${versionResult.modifiedCount}`
  );
}

async function normaliseCategories() {
  const seen = new Set(TEMPLATE_CATEGORIES);
  const legacy = new Map(
    TEMPLATE_CATEGORIES.map((value) => [value.toLowerCase(), value]).concat([
      ['', 'Event'],
      ['general', 'Event'],
    ])
  );

  const templates = await Template.find({ category: { $nin: [...seen] } }).select('name category').lean();
  for (const template of templates) {
    const raw = (template.category || '').trim();
    const next = legacy.get(raw.toLowerCase()) || 'Custom';
    await Template.updateOne({ _id: template._id }, { $set: { category: next } });
    categoryFixed += 1;
  }
  log(`Templates moved onto the new category list: ${categoryFixed}`);
}

async function findNameCollisions() {
  return Template.aggregate([
    { $project: { clientId: 1, name: 1, createdAt: 1, lower: { $toLower: '$name' } } },
    { $group: { _id: { clientId: '$clientId', lower: '$lower' }, count: { $sum: 1 }, ids: { $push: '$_id' } } },
    { $match: { count: { $gt: 1 } } },
  ]);
}

async function reportNameCollisions() {
  const collisions = await findNameCollisions();
  if (collisions.length === 0) {
    log('No organization has two templates with the same name.');
    return true;
  }

  log(`${collisions.length} name collision group(s) found:`);
  for (const group of collisions) {
    log(`  - “${group._id.lower}” x${group.count} in client ${group._id.clientId}`);
  }

  if (!fixNames) {
    log('Run again with --fix-names to rename the newer copies automatically.');
    return false;
  }

  let renamed = 0;
  for (const group of collisions) {
    const docs = await Template.find({ _id: { $in: group.ids } })
      .sort({ createdAt: 1 })
      .select('name clientId')
      .lean();
    const [, ...newer] = docs;
    for (const doc of newer) {
      const base = (doc.name || 'Template').slice(0, 110);
      let candidate = `${base} (2)`;
      for (let index = 2; index <= 30; index += 1) {
        const taken = await Template.exists({
          clientId: doc.clientId,
          _id: { $ne: doc._id },
          name: new RegExp(`^${candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        });
        if (!taken) break;
        candidate = `${base} (${index + 1})`;
      }
      await Template.updateOne({ _id: doc._id }, { $set: { name: candidate } });
      renamed += 1;
      log(`  renamed ${doc._id} -> “${candidate}”`);
    }
  }
  log(`Colliding templates renamed: ${renamed}`);
  return true;
}

async function run() {
  await connectDB();

  const total = await Template.countDocuments({});
  log(`Templates in the database: ${total}`);
  if (total === 0) {
    log('Nothing to migrate.');
    return;
  }

  await addLayoutDefaults();
  await addFlagsAndHistory();
  await normaliseCategories();
  const namesClear = await reportNameCollisions();

  if (namesClear) {
    await Template.createIndexes();
    log('Indexes checked (active lookup + unique name per organization).');
  } else {
    log('Unique name index skipped until the collisions above are resolved.');
  }

  log('Template migration completed.');
}

try {
  await run();
} catch (err) {
  console.error(`Template migration failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await mongoose.connection.close().catch(() => {});
}
