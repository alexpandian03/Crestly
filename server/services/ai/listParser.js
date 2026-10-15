import { buildListTidySystemPrompt } from './prompt.js';
import { sanitizeString, truncateAtWordBoundary } from './schema.js';
import { VARIABLE_LIMITS } from '../../../shared/templateElements.js';
import { generateWithGemini } from './providers/gemini.js';
import { generateWithOpenAI } from './providers/openai.js';
import { generateWithAnthropic } from './providers/anthropic.js';

/**
 * Deterministic rule-based extractor for pasted card lists.
 * Strictly extracts data from what the user pasted without inventing any facts or names.
 *
 * @param {string} text - Raw pasted text
 * @param {Array} fields - Card field definitions [{ key, label, type, maxLength }]
 * @param {number} maxCount - Max entries allowed (1..12)
 * @returns {Array<Record<string, string>>}
 */
export function ruleBasedParseList(text, fields = [], maxCount = 12) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const textFields = (fields || []).filter((f) => f?.key && f.type !== 'image');
  if (!textFields.length) return [];

  const limit = Math.max(1, Math.min(12, Number(maxCount) || 12));

  // Check if input is organized into blocks separated by blank lines
  const rawBlocks = raw
    .split(/\r?\n\s*\r?\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const cleanBullet = (str) =>
    str
      .replace(/^[-•*–—\s]+\s*/, '')
      .replace(/^\[?\d+[.)\]]\s*/, '')
      .trim();

  const entries = [];

  if (rawBlocks.length > 1 && rawBlocks.every((b) => b.includes('\n'))) {
    // Multi-line blocks: each block is one entry, each line in block is a field
    for (const block of rawBlocks) {
      if (entries.length >= limit) break;
      const lines = block
        .split(/\r?\n/)
        .map(cleanBullet)
        .filter(Boolean);
      if (!lines.length) continue;

      const entry = {};
      textFields.forEach((f, idx) => {
        const val = lines[idx] || '';
        const max = Number(f.maxLength) || VARIABLE_LIMITS.maxLength.default;
        entry[f.key] = truncateAtWordBoundary(sanitizeString(val), max);
      });
      fields.forEach((f) => {
        if (f.type === 'image' && entry[f.key] === undefined) {
          entry[f.key] = '';
        }
      });
      entries.push(entry);
    }
    return entries;
  }

  // Single-line entries separated by newlines
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (entries.length >= limit) break;
    const cleaned = cleanBullet(line);
    if (!cleaned) continue;

    let parts = [];
    if (cleaned.includes('\t')) {
      parts = cleaned.split('\t').map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(' | ')) {
      parts = cleaned.split(' | ').map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(' - ') || cleaned.includes(' – ') || cleaned.includes(' — ')) {
      parts = cleaned.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(': ') && !cleaned.toLowerCase().startsWith('http')) {
      parts = cleaned.split(/:\s+/).map((p) => p.trim()).filter(Boolean);
    } else if (cleaned.includes(', ') && textFields.length > 1) {
      parts = cleaned.split(/,\s+/).map((p) => p.trim()).filter(Boolean);
    } else {
      parts = [cleaned];
    }

    const entry = {};
    textFields.forEach((f, idx) => {
      const partVal = parts[idx] || '';
      const max = Number(f.maxLength) || VARIABLE_LIMITS.maxLength.default;
      entry[f.key] = truncateAtWordBoundary(sanitizeString(partVal), max);
    });

    // Image fields default to empty string
    fields.forEach((f) => {
      if (f.type === 'image' && entry[f.key] === undefined) {
        entry[f.key] = '';
      }
    });

    entries.push(entry);
  }

  return entries;
}

/**
 * Tidy my list operation: takes pasted text and card list definition,
 * returning structured entries by field, only from text present in the paste.
 *
 * @param {object} params
 * @param {string} params.text - Pasted text
 * @param {object} params.listDefinition - Card list definition
 * @param {AbortSignal} [params.signal] - Abort signal
 * @returns {Promise<Array<Record<string, string>>>}
 */
export async function parseCardListEntries({ text, listDefinition, signal }) {
  const raw = String(text || '').trim();
  if (!raw) return [];

  const card = listDefinition?.card || listDefinition || {};
  const fields = Array.isArray(card.fields)
    ? card.fields
    : Array.isArray(listDefinition?.fields)
    ? listDefinition.fields
    : [];

  const maxCount = Math.min(12, Math.max(1, Number(listDefinition?.maxCount) || 12));
  const provider = (process.env.LLM_PROVIDER || 'mock').toLowerCase().trim();

  // If mock provider or no API key, use deterministic rule-based extractor
  if (provider === 'mock' || !process.env.GEMINI_API_KEY) {
    return ruleBasedParseList(raw, fields, maxCount);
  }

  const systemPrompt = buildListTidySystemPrompt(fields, maxCount);
  const controller = new AbortController();
  const linkedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal;
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    let parsed = null;
    try {
      if (provider === 'gemini') {
        parsed = await generateWithGemini({ prompt: raw, systemPrompt, signal: linkedSignal });
      } else if (provider === 'openai') {
        parsed = await generateWithOpenAI({ prompt: raw, systemPrompt, signal: linkedSignal });
      } else if (provider === 'anthropic') {
        parsed = await generateWithAnthropic({ prompt: raw, systemPrompt, signal: linkedSignal });
      }
    } catch {
      // LLM call failed or timed out: fall back gracefully
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      const allowedKeys = new Set(fields.map((f) => f.key));
      const textFields = fields.filter((f) => f.type !== 'image');
      const sanitized = parsed.slice(0, maxCount).map((item) => {
        const entry = {};
        textFields.forEach((f) => {
          const rawVal = item[f.key];
          const val = typeof rawVal === 'string' ? rawVal : (rawVal !== undefined && rawVal !== null ? String(rawVal) : '');
          const max = Number(f.maxLength) || VARIABLE_LIMITS.maxLength.default;
          entry[f.key] = truncateAtWordBoundary(sanitizeString(val), max);
        });
        fields.forEach((f) => {
          if (f.type === 'image') entry[f.key] = '';
        });
        return entry;
      });
      return sanitized;
    }

    return ruleBasedParseList(raw, fields, maxCount);
  } finally {
    clearTimeout(timeoutId);
  }
}
