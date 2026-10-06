import 'dotenv/config';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Poster from '../models/Poster.model.js';
import Template from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import { captureDesign } from '../services/poster/design.js';

/**
 * Poster design snapshot migration. Safe to run repeatedly: only posters that have no
 * `design` yet are touched. The look a poster had before snapshots existed cannot be
 * recovered, so every migrated poster gets the tenant's CURRENT brand kit and template as
 * its frozen look, on the poster and on each of its versions.
 */

const BATCH = 200;

async function run() {
  await connectDB();

  const kits = new Map();
  for (const kit of await BrandKit.find({}).lean()) {
    kits.set(String(kit.clientId), kit);
  }
  const templates = new Map();
  async function templateFor(id) {
    const key = String(id || '');
    if (!key) return null;
    if (templates.has(key)) return templates.get(key);
    const found = await Template.findById(key).lean().catch(() => null);
    templates.set(key, found);
    return found;
  }

  const filter = { $or: [{ design: { $exists: false } }, { design: null }] };
  const total = await Poster.countDocuments(filter);
  if (total === 0) {
    console.log('Nothing to migrate: every poster already carries a design snapshot.');
    return;
  }
  console.log(`Posters without a design snapshot: ${total}`);

  let updated = 0;
  let skipped = 0;
  let lastId = null;
  for (;;) {
    const query = lastId ? { ...filter, _id: { $gt: lastId } } : filter;
    const batch = await Poster.find(query).sort({ _id: 1 }).limit(BATCH).select('_id clientId templateId').lean();
    if (batch.length === 0) break;
    lastId = batch[batch.length - 1]._id;

    for (const poster of batch) {
      const template = await templateFor(poster.templateId);
      let design;
      try {
        design = captureDesign({ brandKit: kits.get(String(poster.clientId)), template });
      } catch (err) {
        skipped += 1;
        console.error(`Poster ${poster._id} skipped: ${err.message}`);
        continue;
      }
      await Poster.updateOne(
        { _id: poster._id, $or: [{ design: { $exists: false } }, { design: null }] },
        { $set: { design, 'versions.$[v].design': design } },
        { arrayFilters: [{ 'v.design': { $exists: false } }] }
      );
      updated += 1;
    }
  }

  console.log(`Posters given a design snapshot: ${updated}`);
  if (skipped > 0) console.log(`Posters skipped (snapshot too large): ${skipped}`);
  console.log('Poster design migration finished.');
}

run()
  .then(async () => {
    await mongoose.connection.close();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error(`Poster design migration failed: ${err.message}`);
    await mongoose.connection.close().catch(() => {});
    process.exit(1);
  });
