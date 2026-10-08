import 'dotenv/config';
process.env.LLM_PROVIDER = 'mock';

import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import Template from '../models/Template.model.js';
import BrandKit from '../models/BrandKit.model.js';
import User from '../models/User.model.js';
import Poster from '../models/Poster.model.js';
import { generateContent } from '../services/ai/index.js';
import { resolvePosterImage } from '../services/images.js';
import { variableSlotsOf } from '../../shared/templateElements.js';
import { createPosterSchema } from '../validation/poster.schema.js';
import { normalizePosterContent, contentValuesContext } from '../services/poster/content.js';
import { captureDesign } from '../services/poster/design.js';
import { sanitizeString } from '../services/ai/schema.js';

const timeoutTimer = setTimeout(() => {
  console.error('Timeout reached (30s). Terminating script.');
  process.exit(1);
}, 30000);
timeoutTimer.unref();

async function run() {
  try {
    await connectDB();

    // 1. Find the active template
    // Prefer one with an image slot or the latest active one
    const templates = await Template.find({ isActive: true }).sort({ updatedAt: -1 });
    if (!templates.length) {
      console.error('No active templates found.');
      return;
    }

    console.log(`Found ${templates.length} active template(s).`);
    // Find the edited one with an image slot, or the first active one
    let template = templates.find((t) => variableSlotsOf(t.elements).images.length > 0) || templates[0];
    console.log(`Using template: "${template.name}" (${template._id}), version: ${template.version}`);
    const slots = variableSlotsOf(template.elements);
    console.log(`Template slots: ${slots.texts.length} text slots, ${slots.images.length} image slots`);
    if (slots.images.length > 0) {
      console.log(`Image slots: ${slots.images.map((s) => s.key).join(', ')}`);
    }

    let brandKit = await BrandKit.findOne({ clientId: template.clientId });
    if (!brandKit) {
      brandKit = { orgName: 'Our Organization', colors: {}, fonts: {}, header: {}, footer: {} };
    }

    let user = await User.findOne({ clientId: template.clientId });
    if (!user) {
      user = await User.findOne({ role: 'superadmin' });
    }

    const prompt = 'Employee of the year awards on 5 Dec, 6 PM, auditorium. Open to all staff.';

    // 2. Mock generation in template mode (matching generatePosterContentController)
    const variables = slots.texts.map(({ key, label, hint, maxLength }) => ({ key, label, hint, maxLength }));
    const imageSlots = slots.images;

    const generated = await generateContent({
      prompt,
      brandKit,
      template,
      instruction: undefined,
      variables,
    });

    console.log('Generated content title:', generated.title);
    console.log('Generated extras:', generated.extras);

    let imageUrl = '';
    const photo = await resolvePosterImage(prompt, generated.title, generated.imageQuery);
    imageUrl = photo?.imageUrl || '';
    console.log('Resolved imageUrl:', imageUrl);

    const images = {};
    if (imageSlots.length > 0 && imageUrl) {
      images[imageSlots[0].key] = imageUrl;
    }
    console.log('Images object:', images);

    // 3. Client payload construction (matching client buildContentPayload)
    const clientContent = {
      title: String(generated.title || '').trim(),
      tagline: String(generated.tagline || '').trim(),
      date: String(generated.date || '').trim(),
      time: String(generated.time || '').trim(),
      venue: String(generated.venue || '').trim(),
      details: Array.isArray(generated.details)
        ? generated.details.map((d) => String(d).trim()).filter(Boolean).slice(0, 4)
        : [],
      imageUrl: String(imageUrl || '').trim(),
      ...(generated.extras && Object.keys(generated.extras).length > 0 ? { extras: generated.extras } : {}),
      ...(Object.keys(images).length > 0 ? { images } : {}),
    };

    const requestBody = {
      templateId: template._id.toString(),
      prompt,
      content: clientContent,
    };

    console.log('Request payload to save:');
    console.log(JSON.stringify(requestBody, null, 2));

    // 4. Run schema validation (createPosterSchema)
    console.log('\n--- Step 4: Validating with createPosterSchema ---');
    const parseResult = createPosterSchema.safeParse(requestBody);
    if (!parseResult.success) {
      console.error('Validation FAILED (Zod):');
      for (const issue of parseResult.error.issues) {
        console.error(`- Error: ${issue.code}, Field: ${issue.path.join('.')}, Message: ${issue.message}`);
      }
      return;
    }
    console.log('createPosterSchema validation PASSED');

    // 5. Run route controller save logic
    console.log('\n--- Step 5: Running route controller save logic ---');
    const parsedBody = parseResult.data;
    const templateVersion = template.version || 1;
    const design = captureDesign({ brandKit, template });

    console.log('Checking normalizePosterContent...');
    let normalizedContent;
    try {
      normalizedContent = normalizePosterContent(
        parsedBody.content,
        contentValuesContext(design, template.clientId)
      );
      console.log('normalizePosterContent PASSED');
    } catch (normErr) {
      console.error('normalizePosterContent FAILED:');
      console.error(`Error name: ${normErr.name}`);
      console.error(`Error message: ${normErr.message}`);
      console.error(`Status: ${normErr.status}`);
      return;
    }

    // 6. Test database save
    console.log('\n--- Step 6: Testing Poster.create ---');
    try {
      const createdPoster = await Poster.create({
        clientId: template.clientId,
        userId: user?._id || new mongoose.Types.ObjectId(),
        templateId: template._id,
        templateVersion,
        design,
        title: normalizedContent.title,
        prompt: sanitizeString(parsedBody.prompt).slice(0, 1000),
        content: normalizedContent,
        versions: [
          {
            content: normalizedContent,
            note: 'Created',
            versionNumber: 1,
            templateVersion,
            design,
            createdBy: user?._id || new mongoose.Types.ObjectId(),
            createdAt: new Date(),
          },
        ],
        currentVersion: 1,
        status: 'draft',
      });
      console.log('Poster.create SUCCESS! Created poster ID:', createdPoster._id);
      // Clean up the created test poster
      await Poster.findByIdAndDelete(createdPoster._id);
      console.log('Test poster cleaned up.');
    } catch (dbErr) {
      console.error('Poster.create FAILED:');
      console.error(`Error name: ${dbErr.name}`);
      console.error(`Error message: ${dbErr.message}`);
      if (dbErr.errors) {
        for (const [field, err] of Object.entries(dbErr.errors)) {
          console.error(`Failing field: ${field}, Message: ${err.message}`);
        }
      }
    }
  } catch (err) {
    console.error('Unexpected error during debug run:');
    console.error(`Error name: ${err.name}`);
    console.error(`Error message: ${err.message}`);
    console.error(err.stack);
  } finally {
    await mongoose.connection.close().catch(() => {});
    console.log('Connection closed.');
  }
}

run();
