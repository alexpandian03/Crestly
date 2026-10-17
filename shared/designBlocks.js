/**
 * /shared/designBlocks.js
 *
 * Modular design blocks for PosterAI layout engine.
 * Pure ESM, deterministic layout trees.
 *
 * Grouped by role:
 *  - hero (at least 6)
 *  - info (at least 6)
 *  - message (at least 4, including none)
 *  - cta (at least 3, including none)
 *  - background (at least 6)
 *  - decoration (at least 5)
 *  - typePairing (at least 4)
 *  - colourAssignment (at least 4, brand tokens only)
 *
 * Each block declares:
 *  - id: unique string identifier
 *  - role: block role category
 *  - suits: array of event categories/types
 *  - needsPhoto: boolean
 *  - compatibleWith: array of block IDs (or ['*'] for all)
 *  - incompatibleWith: array of block IDs
 *  - slots: array of slot descriptors with priorities
 *  - minTextLength: minimum text length in characters
 *  - maxTextLength: maximum text length in characters
 *  - recipeVersion: 2
 *  - tree(content, options): returns layout engine node tree
 */

import {
  stack,
  row,
  grid,
  text,
  image,
  shape,
  icon,
  divider,
  layout,
  LAYOUT_TOKENS,
} from './layoutEngine.js';
import { hasTamil } from './textScripts.js';
import { FIELD_PRIORITY } from './textFit.js';

export const RECIPE_VERSION = 2;

export const DESIGN_BLOCK_ROLES = [
  'hero',
  'info',
  'message',
  'cta',
  'background',
  'decoration',
  'typePairing',
  'colourAssignment',
];

/**
 * Standard content extraction helper with safe defaults.
 */
export function extractBlockContent(content = {}) {
  const isTamil =
    hasTamil(content.title || '') ||
    hasTamil(content.subtitle || '') ||
    hasTamil(content.tagline || '') ||
    hasTamil(content.details || '') ||
    hasTamil(content.date || '') ||
    hasTamil(content.venue || '');

  return {
    title: String(content.title || content.headline || content.name || 'Event Title').trim(),
    subtitle: String(content.subtitle || content.tagline || '').trim(),
    date: String(content.date || '15 Nov 2026').trim(),
    time: String(content.time || '10:00 AM').trim(),
    venue: String(content.venue || content.location || 'Main Auditorium').trim(),
    photo: String(content.photo || content.imageUrl || content.mainPhoto || '').trim(),
    message: String(content.message || content.details || content.highlights || '').trim(),
    cta: String(content.cta || content.buttonText || content.action || '').trim(),
    contact: String(content.contact || content.phone || content.host || '').trim(),
    category: String(content.category || content.eventType || 'general').trim(),
    isTamil,
  };
}

/* ========================================================================= *
 * 1. HERO BLOCKS (At least 6)
 * ========================================================================= */

export const HERO_BLOCKS = [
  {
    id: 'hero-bold-headline',
    name: 'Bold Headline Hero',
    role: 'hero',
    recipeVersion: RECIPE_VERSION,
    suits: ['corporate', 'general', 'sports', 'meeting', 'education', 'notice'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 160,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent, options = {}) => {
      const c = extractBlockContent(rawContent);
      const children = [
        text(c.title, {
          role: 'headline',
          isHeading: true,
          style: {
            size: 64,
            weight: 800,
            color: LAYOUT_TOKENS.text,
            fontFamily: options.headingFont || LAYOUT_TOKENS.headingFont,
          },
        }),
      ];
      if (c.subtitle) {
        children.push(
          text(c.subtitle, {
            role: 'subtitle',
            style: {
              size: 26,
              weight: 500,
              color: LAYOUT_TOKENS.text,
              fontFamily: options.bodyFont || LAYOUT_TOKENS.bodyFont,
            },
          })
        );
      }
      return stack({
        padding: { top: 24, bottom: 24, x: 20 },
        gap: 16,
        align: 'start',
        children,
      });
    },
  },

  {
    id: 'hero-photo-split',
    name: 'Split Photo & Title Hero',
    role: 'hero',
    recipeVersion: RECIPE_VERSION,
    suits: ['celebration', 'birthday', 'wedding', 'sports', 'general', 'award_function'],
    needsPhoto: true,
    compatibleWith: ['*'],
    incompatibleWith: ['background-split-vertical'],
    minTextLength: 3,
    maxTextLength: 160,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'photo', priority: 7, required: false },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent, options = {}) => {
      const c = extractBlockContent(rawContent);
      const textChildren = [
        text(c.title, {
          role: 'headline',
          isHeading: true,
          style: {
            size: 42,
            weight: 700,
            color: LAYOUT_TOKENS.text,
            fontFamily: options.headingFont || LAYOUT_TOKENS.headingFont,
          },
        }),
      ];
      if (c.subtitle) {
        textChildren.push(
          text(c.subtitle, {
            role: 'subtitle',
            style: {
              size: 22,
              weight: 500,
              color: LAYOUT_TOKENS.text,
              fontFamily: options.bodyFont || LAYOUT_TOKENS.bodyFont,
            },
          })
        );
      }

      const textStack = stack({
        width: c.photo ? 520 : 'fill',
        gap: 12,
        children: textChildren,
      });

      if (!c.photo) {
        // No photo provided: collapse photo and return clean text stack
        return stack({
          padding: { top: 20, bottom: 20, x: 20 },
          gap: 12,
          children: textChildren,
        });
      }

      return row({
        padding: { top: 20, bottom: 20, x: 20 },
        gap: 24,
        align: 'center',
        children: [
          image(c.photo, {
            width: 400,
            height: 300,
            style: { fit: 'cover', radius: 12 },
          }),
          textStack,
        ],
      });
    },
  },

  {
    id: 'hero-badge-medallion',
    name: 'Medallion Crest Hero',
    role: 'hero',
    recipeVersion: RECIPE_VERSION,
    suits: ['award_function', 'birthday', 'wedding', 'celebration'],
    needsPhoto: true,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 160,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'photo', priority: 7, required: false },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent, options = {}) => {
      const c = extractBlockContent(rawContent);
      const children = [];

      if (c.photo) {
        children.push(
          image(c.photo, {
            width: 200,
            height: 200,
            style: { fit: 'cover', radius: 100 },
          })
        );
      } else {
        children.push(
          icon('award', {
            size: 64,
            style: { color: LAYOUT_TOKENS.primary },
          })
        );
      }

      children.push(
        text(c.title, {
          role: 'headline',
          isHeading: true,
          style: {
            size: 44,
            weight: 700,
            align: 'center',
            color: LAYOUT_TOKENS.text,
            fontFamily: options.headingFont || LAYOUT_TOKENS.headingFont,
          },
        })
      );

      if (c.subtitle) {
        children.push(
          text(c.subtitle, {
            role: 'subtitle',
            style: {
              size: 22,
              weight: 500,
              align: 'center',
              color: LAYOUT_TOKENS.text,
              fontFamily: options.bodyFont || LAYOUT_TOKENS.bodyFont,
            },
          })
        );
      }

      return stack({
        padding: { top: 24, bottom: 24, x: 20 },
        gap: 16,
        align: 'center',
        justify: 'center',
        children,
      });
    },
  },

  {
    id: 'hero-editorial-lead',
    name: 'Editorial Lead Hero',
    role: 'hero',
    recipeVersion: RECIPE_VERSION,
    suits: ['workshop', 'education', 'meeting', 'general', 'corporate'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 180,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent, options = {}) => {
      const c = extractBlockContent(rawContent);
      const children = [
        shape('rect', {
          width: 50,
          height: 4,
          fill: LAYOUT_TOKENS.primary,
        }),
        text(c.title, {
          role: 'headline',
          isHeading: true,
          style: {
            size: 46,
            weight: 700,
            color: LAYOUT_TOKENS.text,
            fontFamily: options.headingFont || LAYOUT_TOKENS.headingFont,
          },
        }),
      ];

      if (c.subtitle) {
        children.push(
          text(c.subtitle, {
            role: 'subtitle',
            style: {
              size: 24,
              weight: 400,
              color: LAYOUT_TOKENS.text,
              fontFamily: options.bodyFont || LAYOUT_TOKENS.bodyFont,
            },
          })
        );
      }

      return stack({
        padding: { top: 20, bottom: 20, x: 20 },
        gap: 16,
        align: 'start',
        children,
      });
    },
  },

  {
    id: 'hero-festive-banner',
    name: 'Festive Banner Hero',
    role: 'hero',
    recipeVersion: RECIPE_VERSION,
    suits: ['temple_festival', 'festival', 'celebration', 'wedding'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 160,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent, options = {}) => {
      const c = extractBlockContent(rawContent);
      const children = [
        icon('sparkles', {
          size: 36,
          style: { color: LAYOUT_TOKENS.primary },
        }),
        text(c.title, {
          role: 'headline',
          isHeading: true,
          style: {
            size: 44,
            weight: 700,
            align: 'center',
            color: LAYOUT_TOKENS.text,
            fontFamily: options.headingFont || LAYOUT_TOKENS.headingFont,
          },
        }),
      ];

      if (c.subtitle) {
        children.push(
          text(c.subtitle, {
            role: 'subtitle',
            style: {
              size: 22,
              weight: 500,
              align: 'center',
              color: LAYOUT_TOKENS.text,
              fontFamily: options.bodyFont || LAYOUT_TOKENS.bodyFont,
            },
          })
        );
      }

      return stack({
        padding: { top: 24, bottom: 24, x: 20 },
        gap: 14,
        align: 'center',
        justify: 'center',
        children,
      });
    },
  },

  {
    id: 'hero-minimal-clean',
    name: 'Minimal Clean Hero',
    role: 'hero',
    recipeVersion: RECIPE_VERSION,
    suits: ['notice', 'blood_camp', 'meeting', 'general', 'health'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent, options = {}) => {
      const c = extractBlockContent(rawContent);
      const children = [
        text(c.title, {
          role: 'headline',
          isHeading: true,
          style: {
            size: 62,
            weight: 800,
            color: LAYOUT_TOKENS.text,
            fontFamily: options.headingFont || LAYOUT_TOKENS.headingFont,
          },
        }),
        divider({
          thickness: 3,
          style: { color: LAYOUT_TOKENS.primary },
        }),
      ];

      if (c.subtitle) {
        children.push(
          text(c.subtitle, {
            role: 'subtitle',
            style: {
              size: 26,
              weight: 500,
              color: LAYOUT_TOKENS.text,
              fontFamily: options.bodyFont || LAYOUT_TOKENS.bodyFont,
            },
          })
        );
      }

      return stack({
        padding: { top: 20, bottom: 20, x: 20 },
        gap: 14,
        align: 'start',
        children,
      });
    },
  },

  {
    id: 'hero-impact-strip',
    name: 'Impact Color Strip Hero',
    role: 'hero',
    recipeVersion: RECIPE_VERSION,
    suits: ['sports', 'blood_camp', 'awareness', 'festival', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 160,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent, options = {}) => {
      const c = extractBlockContent(rawContent);
      const innerChildren = [
        text(c.title, {
          role: 'headline',
          isHeading: true,
          style: {
            size: 42,
            weight: 800,
            color: '#ffffff', // High-contrast white on primary background (5.17:1)
            fontFamily: options.headingFont || LAYOUT_TOKENS.headingFont,
          },
        }),
      ];

      if (c.subtitle) {
        innerChildren.push(
          text(c.subtitle, {
            role: 'subtitle',
            style: {
              size: 22,
              weight: 500,
              color: '#ffffff',
              fontFamily: options.bodyFont || LAYOUT_TOKENS.bodyFont,
            },
          })
        );
      }

      return stack({
        padding: { top: 24, bottom: 24, x: 28 },
        gap: 12,
        background: {
          fill: LAYOUT_TOKENS.primary,
          radius: 12,
        },
        children: innerChildren,
      });
    },
  },
];

/* ========================================================================= *
 * 2. INFO BLOCKS (At least 6)
 * ========================================================================= */

export const INFO_BLOCKS = [
  {
    id: 'info-triple-pill',
    name: 'Triple Fact Pill',
    role: 'info',
    recipeVersion: RECIPE_VERSION,
    suits: ['general', 'corporate', 'meeting', 'sports', 'health', 'celebration'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 6,
    maxTextLength: 160,
    slots: [
      { name: 'date', priority: FIELD_PRIORITY.date, required: true },
      { name: 'time', priority: FIELD_PRIORITY.time, required: true },
      { name: 'venue', priority: FIELD_PRIORITY.venue, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      return row({
        padding: { top: 16, bottom: 16, x: 20 },
        gap: 16,
        align: 'center',
        background: {
          fill: '#f8fafc',
          stroke: LAYOUT_TOKENS.primary,
          strokeWidth: 1,
          radius: 16,
        },
        children: [
          stack({
            width: 'fill',
            align: 'center',
            gap: 4,
            children: [
              text('DATE', { style: { size: 20, weight: 600, color: LAYOUT_TOKENS.text } }),
              text(c.date, { role: 'date', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          divider({ thickness: 2, height: 40 }),
          stack({
            width: 'fill',
            align: 'center',
            gap: 4,
            children: [
              text('TIME', { style: { size: 20, weight: 600, color: LAYOUT_TOKENS.text } }),
              text(c.time, { role: 'time', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          divider({ thickness: 2, height: 40 }),
          stack({
            width: 'fill',
            align: 'center',
            gap: 4,
            children: [
              text('VENUE', { style: { size: 20, weight: 600, color: LAYOUT_TOKENS.text } }),
              text(c.venue, { role: 'venue', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
        ],
      });
    },
  },

  {
    id: 'info-grid-cards',
    name: 'Metadata Cards Grid',
    role: 'info',
    recipeVersion: RECIPE_VERSION,
    suits: ['workshop', 'education', 'general', 'corporate'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 6,
    maxTextLength: 180,
    slots: [
      { name: 'date', priority: FIELD_PRIORITY.date, required: true },
      { name: 'time', priority: FIELD_PRIORITY.time, required: true },
      { name: 'venue', priority: FIELD_PRIORITY.venue, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      return grid({
        columns: 2,
        gap: 16,
        padding: 12,
        children: [
          stack({
            padding: 16,
            gap: 6,
            background: { fill: LAYOUT_TOKENS.secondary, radius: 10 },
            children: [
              icon('calendar', { size: 24, style: { color: LAYOUT_TOKENS.primary } }),
              text(c.date, { role: 'date', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          stack({
            padding: 16,
            gap: 6,
            background: { fill: LAYOUT_TOKENS.secondary, radius: 10 },
            children: [
              icon('clock', { size: 24, style: { color: LAYOUT_TOKENS.primary } }),
              text(c.time, { role: 'time', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          stack({
            padding: 16,
            gap: 6,
            background: { fill: LAYOUT_TOKENS.secondary, radius: 10 },
            children: [
              icon('map-pin', { size: 24, style: { color: LAYOUT_TOKENS.primary } }),
              text(c.venue, { role: 'venue', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          stack({
            padding: 16,
            gap: 6,
            background: { fill: LAYOUT_TOKENS.secondary, radius: 10 },
            children: [
              icon('info', { size: 24, style: { color: LAYOUT_TOKENS.primary } }),
              text(c.contact || 'All Welcome', { style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
        ],
      });
    },
  },

  {
    id: 'info-date-ribbon',
    name: 'Date Ribbon Info Bar',
    role: 'info',
    recipeVersion: RECIPE_VERSION,
    suits: ['festival', 'sports', 'blood_camp', 'celebration', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 6,
    maxTextLength: 160,
    slots: [
      { name: 'date', priority: FIELD_PRIORITY.date, required: true },
      { name: 'time', priority: FIELD_PRIORITY.time, required: true },
      { name: 'venue', priority: FIELD_PRIORITY.venue, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      return row({
        padding: 16,
        gap: 20,
        align: 'center',
        background: { fill: '#f8fafc', stroke: LAYOUT_TOKENS.primary, strokeWidth: 1, radius: 12 },
        children: [
          stack({
            width: 220,
            padding: 16,
            align: 'center',
            background: { fill: LAYOUT_TOKENS.primary, radius: 8 },
            children: [
              text(c.date, {
                role: 'date',
                style: { size: 24, weight: 800, align: 'center', color: '#ffffff' },
              }),
            ],
          }),
          stack({
            width: 'fill',
            gap: 8,
            children: [
              text(c.time, { role: 'time', style: { size: 22, weight: 600, color: LAYOUT_TOKENS.text } }),
              text(c.venue, { role: 'venue', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
        ],
      });
    },
  },

  {
    id: 'info-stacked-rows',
    name: 'Stacked Details Rows',
    role: 'info',
    recipeVersion: RECIPE_VERSION,
    suits: ['notice', 'meeting', 'wedding', 'award_function'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 6,
    maxTextLength: 200,
    slots: [
      { name: 'date', priority: FIELD_PRIORITY.date, required: true },
      { name: 'time', priority: FIELD_PRIORITY.time, required: true },
      { name: 'venue', priority: FIELD_PRIORITY.venue, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: { top: 16, bottom: 16, x: 20 },
        gap: 12,
        children: [
          row({
            gap: 12,
            align: 'center',
            children: [
              icon('calendar', { size: 24 }),
              text(`Date: ${c.date}`, { role: 'date', style: { size: 22, weight: 600, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          divider({ thickness: 1 }),
          row({
            gap: 12,
            align: 'center',
            children: [
              icon('clock', { size: 24 }),
              text(`Time: ${c.time}`, { role: 'time', style: { size: 22, weight: 600, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          divider({ thickness: 1 }),
          row({
            gap: 12,
            align: 'center',
            children: [
              icon('map-pin', { size: 24 }),
              text(`Venue: ${c.venue}`, { role: 'venue', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
        ],
      });
    },
  },

  {
    id: 'info-ticket-stub',
    name: 'Ticket Stub Card',
    role: 'info',
    recipeVersion: RECIPE_VERSION,
    suits: ['celebration', 'festival', 'sports', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 6,
    maxTextLength: 160,
    slots: [
      { name: 'date', priority: FIELD_PRIORITY.date, required: true },
      { name: 'time', priority: FIELD_PRIORITY.time, required: true },
      { name: 'venue', priority: FIELD_PRIORITY.venue, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      return row({
        padding: 16,
        gap: 16,
        align: 'center',
        background: { fill: LAYOUT_TOKENS.secondary, radius: 16 },
        children: [
          stack({
            width: 180,
            align: 'center',
            gap: 4,
            children: [
              text('EVENT PASS', { style: { size: 20, weight: 700, color: LAYOUT_TOKENS.primary } }),
              text(c.date, { role: 'date', style: { size: 22, weight: 800, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          divider({ thickness: 2, height: 60 }),
          stack({
            width: 'fill',
            gap: 6,
            children: [
              text(c.time, { role: 'time', style: { size: 22, weight: 600, color: LAYOUT_TOKENS.text } }),
              text(c.venue, { role: 'venue', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
            ],
          }),
        ],
      });
    },
  },

  {
    id: 'info-agenda-columns',
    name: 'Agenda Breakdown',
    role: 'info',
    recipeVersion: RECIPE_VERSION,
    suits: ['workshop', 'school_annual_day', 'award_function', 'meeting'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 6,
    maxTextLength: 220,
    slots: [
      { name: 'date', priority: FIELD_PRIORITY.date, required: true },
      { name: 'time', priority: FIELD_PRIORITY.time, required: true },
      { name: 'venue', priority: FIELD_PRIORITY.venue, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 12,
        background: { fill: LAYOUT_TOKENS.secondary, radius: 10 },
        children: [
          row({
            gap: 12,
            children: [
              text(c.date, { role: 'date', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
              divider({ thickness: 2 }),
              text(c.time, { role: 'time', style: { size: 22, weight: 600, color: LAYOUT_TOKENS.text } }),
            ],
          }),
          text(c.venue, { role: 'venue', style: { size: 22, weight: 700, color: LAYOUT_TOKENS.text } }),
        ],
      });
    },
  },

  {
    id: 'info-compact-bar',
    name: 'Compact Horizontal Bar',
    role: 'info',
    recipeVersion: RECIPE_VERSION,
    suits: ['notice', 'general', 'meeting', 'sports'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 6,
    maxTextLength: 160,
    slots: [
      { name: 'date', priority: FIELD_PRIORITY.date, required: true },
      { name: 'time', priority: FIELD_PRIORITY.time, required: true },
      { name: 'venue', priority: FIELD_PRIORITY.venue, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      return row({
        padding: { top: 12, bottom: 12, x: 20 },
        gap: 16,
        align: 'center',
        background: { fill: LAYOUT_TOKENS.secondary, radius: 8 },
        children: [
          text(c.date, { role: 'date', style: { size: 20, weight: 700, color: LAYOUT_TOKENS.text } }),
          divider({ thickness: 2, height: 24 }),
          text(c.time, { role: 'time', style: { size: 20, weight: 600, color: LAYOUT_TOKENS.text } }),
          divider({ thickness: 2, height: 24 }),
          text(c.venue, { role: 'venue', style: { size: 20, weight: 700, color: LAYOUT_TOKENS.text } }),
        ],
      });
    },
  },
];

/* ========================================================================= *
 * 3. MESSAGE BLOCKS (At least 4, including none)
 * ========================================================================= */

export const MESSAGE_BLOCKS = [
  {
    id: 'message-none',
    name: 'No Message',
    role: 'message',
    recipeVersion: RECIPE_VERSION,
    suits: ['*'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () => null, // Completely collapses without empty container
  },

  {
    id: 'message-highlights-bullets',
    name: 'Key Highlights Bullets',
    role: 'message',
    recipeVersion: RECIPE_VERSION,
    suits: ['workshop', 'blood_camp', 'meeting', 'general', 'education'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 10,
    maxTextLength: 300,
    slots: [
      { name: 'message', priority: FIELD_PRIORITY.bullets, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      const textVal = c.message || 'Keynote presentations • Hands-on technical sessions • Networking opportunity';
      const items = textVal.includes('•') ? textVal.split('•').map((s) => s.trim()).filter(Boolean) : [textVal];

      return stack({
        padding: 16,
        gap: 10,
        background: { fill: LAYOUT_TOKENS.secondary, radius: 10 },
        children: items.map((line) =>
          row({
            gap: 10,
            align: 'center',
            children: [
              icon('check-circle', { size: 20, style: { color: LAYOUT_TOKENS.primary } }),
              text(line, { style: { size: 20, weight: 500, color: LAYOUT_TOKENS.text } }),
            ],
          })
        ),
      });
    },
  },

  {
    id: 'message-quote-card',
    name: 'Quote Card Message',
    role: 'message',
    recipeVersion: RECIPE_VERSION,
    suits: ['award_function', 'celebration', 'wedding', 'birthday'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 10,
    maxTextLength: 250,
    slots: [
      { name: 'message', priority: FIELD_PRIORITY.subtitle, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      const quote = c.message || c.subtitle || 'Recognizing outstanding dedication, perseverance, and remarkable leadership.';
      return row({
        padding: 16,
        gap: 14,
        background: { fill: LAYOUT_TOKENS.secondary, radius: 8 },
        children: [
          shape('rect', { width: 4, fill: LAYOUT_TOKENS.primary }),
          text(quote, {
            style: { size: 22, weight: 500, italic: true, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'message-editorial-body',
    name: 'Editorial Paragraph Body',
    role: 'message',
    recipeVersion: RECIPE_VERSION,
    suits: ['notice', 'meeting', 'school_annual_day', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 10,
    maxTextLength: 350,
    slots: [
      { name: 'message', priority: FIELD_PRIORITY.details, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      const body = c.message || 'We warmly invite all members, esteemed guests, and community partners to join us for this special occasion.';
      return stack({
        padding: { top: 14, bottom: 14, x: 18 },
        gap: 8,
        children: [
          text('ABOUT THIS EVENT', {
            style: { size: 20, weight: 700, color: LAYOUT_TOKENS.primary },
          }),
          text(body, {
            style: { size: 22, weight: 400, lineHeight: 1.4, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'message-stat-callout',
    name: 'Metric Stat Callout',
    role: 'message',
    recipeVersion: RECIPE_VERSION,
    suits: ['blood_camp', 'sports', 'corporate'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 4,
    maxTextLength: 150,
    slots: [
      { name: 'message', priority: FIELD_PRIORITY.details, required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      const desc = c.message || '100% voluntary donation helps save up to three lives per unit.';
      return row({
        padding: 16,
        gap: 16,
        align: 'center',
        background: { fill: LAYOUT_TOKENS.secondary, radius: 10 },
        children: [
          text('100%', {
            style: { size: 36, weight: 800, color: LAYOUT_TOKENS.primary },
          }),
          text(desc, {
            style: { size: 20, weight: 500, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },
];

/* ========================================================================= *
 * 4. CTA BLOCKS (At least 3, including none)
 * ========================================================================= */

export const CTA_BLOCKS = [
  {
    id: 'cta-none',
    name: 'No Call To Action',
    role: 'cta',
    recipeVersion: RECIPE_VERSION,
    suits: ['*'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () => null, // Collapses completely
  },

  {
    id: 'cta-pill-button',
    name: 'Primary Pill Button',
    role: 'cta',
    recipeVersion: RECIPE_VERSION,
    suits: ['general', 'workshop', 'blood_camp', 'sports', 'corporate'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 60,
    slots: [
      { name: 'cta', priority: FIELD_PRIORITY['call to action'], required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      const label = c.cta || 'Register Now';
      return stack({
        padding: { top: 12, bottom: 12 },
        align: 'center',
        children: [
          stack({
            width: 320,
            padding: { top: 14, bottom: 14, x: 24 },
            align: 'center',
            background: { fill: LAYOUT_TOKENS.primary, radius: 28 },
            children: [
              text(label, {
                role: 'call to action',
                style: { size: 22, weight: 700, align: 'center', color: '#ffffff' },
              }),
            ],
          }),
        ],
      });
    },
  },

  {
    id: 'cta-banner-strip',
    name: 'Full-Width Action Banner',
    role: 'cta',
    recipeVersion: RECIPE_VERSION,
    suits: ['festival', 'blood_camp', 'sports', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 4,
    maxTextLength: 80,
    slots: [
      { name: 'cta', priority: FIELD_PRIORITY['call to action'], required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      const textStr = c.cta || 'Free Admission • Walk-Ins Welcome • Register Today';
      return stack({
        padding: { top: 16, bottom: 16, x: 20 },
        background: { fill: LAYOUT_TOKENS.secondary, radius: 8 },
        align: 'center',
        children: [
          text(textStr, {
            role: 'call to action',
            style: { size: 22, weight: 700, align: 'center', color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'cta-double-action',
    name: 'Action Button with Contact Link',
    role: 'cta',
    recipeVersion: RECIPE_VERSION,
    suits: ['workshop', 'corporate', 'meeting', 'education'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 5,
    maxTextLength: 100,
    slots: [
      { name: 'cta', priority: FIELD_PRIORITY['call to action'], required: true },
    ],
    tree: (rawContent, _options = {}) => {
      const c = extractBlockContent(rawContent);
      const label = c.cta || 'Confirm Attendance';
      const contactStr = c.contact || 'RSVP: contact@organization.org';
      return row({
        gap: 16,
        padding: 12,
        align: 'center',
        justify: 'center',
        children: [
          stack({
            width: 260,
            padding: 14,
            align: 'center',
            background: { fill: LAYOUT_TOKENS.primary, radius: 8 },
            children: [
              text(label, {
                role: 'call to action',
                style: { size: 20, weight: 700, color: '#ffffff', align: 'center' },
              }),
            ],
          }),
          stack({
            width: 260,
            padding: 14,
            align: 'center',
            background: { fill: LAYOUT_TOKENS.secondary, radius: 8 },
            children: [
              text(contactStr, {
                style: { size: 20, weight: 600, color: LAYOUT_TOKENS.text, align: 'center' },
              }),
            ],
          }),
        ],
      });
    },
  },
];

/* ========================================================================= *
 * 5. BACKGROUND BLOCKS (At least 6)
 * ========================================================================= */

export const BACKGROUND_BLOCKS = [
  {
    id: 'background-solid',
    name: 'Clean Solid Backdrop',
    role: 'background',
    recipeVersion: RECIPE_VERSION,
    suits: ['*'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      shape('rect', {
        fill: LAYOUT_TOKENS.background,
        width: 'fill',
        height: 'fill',
      }),
  },

  {
    id: 'background-tinted-surface',
    name: 'Tinted Surface Plate',
    role: 'background',
    recipeVersion: RECIPE_VERSION,
    suits: ['corporate', 'general', 'education', 'meeting'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      shape('rect', {
        fill: '#f8fafc',
        radius: 16,
        opacity: 0.95,
        width: 'fill',
        height: 'fill',
      }),
  },

  {
    id: 'background-split-vertical',
    name: 'Two-Tone Split Canvas',
    role: 'background',
    recipeVersion: RECIPE_VERSION,
    suits: ['sports', 'festival', 'celebration'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: ['hero-photo-split'],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      stack({
        children: [
          shape('rect', { fill: '#eff6ff', height: 180 }),
          shape('rect', { fill: '#ffffff', height: 200 }),
        ],
      }),
  },

  {
    id: 'background-card-plate',
    name: 'Elevated Card Plate',
    role: 'background',
    recipeVersion: RECIPE_VERSION,
    suits: ['award_function', 'wedding', 'birthday', 'workshop'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      shape('rect', {
        fill: '#ffffff',
        stroke: LAYOUT_TOKENS.primary,
        strokeWidth: 2,
        radius: 20,
        width: 'fill',
        height: 'fill',
      }),
  },

  {
    id: 'background-duotone',
    name: 'Duotone Accent Bands',
    role: 'background',
    recipeVersion: RECIPE_VERSION,
    suits: ['notice', 'meeting', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      stack({
        gap: 0,
        children: [
          shape('rect', { fill: LAYOUT_TOKENS.primary, height: 16 }),
          shape('rect', { fill: LAYOUT_TOKENS.secondary, height: 260 }),
        ],
      }),
  },

  {
    id: 'background-framed',
    name: 'Geometric Inset Frame',
    role: 'background',
    recipeVersion: RECIPE_VERSION,
    suits: ['award_function', 'temple_festival', 'wedding'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      shape('rect', {
        fill: 'transparent',
        stroke: LAYOUT_TOKENS.primary,
        strokeWidth: 3,
        radius: 12,
        width: 'fill',
        height: 'fill',
      }),
  },
];

/* ========================================================================= *
 * 6. DECORATION BLOCKS (At least 5)
 * ========================================================================= */

export const DECORATION_BLOCKS = [
  {
    id: 'decoration-none',
    name: 'No Decoration',
    role: 'decoration',
    recipeVersion: RECIPE_VERSION,
    suits: ['*'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () => null, // Collapses cleanly
  },

  {
    id: 'decoration-corner-accents',
    name: 'Geometric Corner Accents',
    role: 'decoration',
    recipeVersion: RECIPE_VERSION,
    suits: ['award_function', 'wedding', 'temple_festival', 'corporate'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      row({
        justify: 'space-between',
        padding: 8,
        children: [
          shape('rect', { width: 40, height: 8, fill: LAYOUT_TOKENS.primary, opacity: 0.6 }),
          shape('rect', { width: 40, height: 8, fill: LAYOUT_TOKENS.primary, opacity: 0.6 }),
        ],
      }),
  },

  {
    id: 'decoration-geometric-dots',
    name: 'Subtle Dotted Array',
    role: 'decoration',
    recipeVersion: RECIPE_VERSION,
    suits: ['workshop', 'education', 'meeting', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      row({
        gap: 8,
        justify: 'center',
        padding: 8,
        children: [
          shape('circle', { width: 10, height: 10, fill: LAYOUT_TOKENS.primary, opacity: 0.4 }),
          shape('circle', { width: 10, height: 10, fill: LAYOUT_TOKENS.primary, opacity: 0.4 }),
          shape('circle', { width: 10, height: 10, fill: LAYOUT_TOKENS.primary, opacity: 0.4 }),
        ],
      }),
  },

  {
    id: 'decoration-accent-rings',
    name: 'Concentric Hairline Rings',
    role: 'decoration',
    recipeVersion: RECIPE_VERSION,
    suits: ['sports', 'celebration', 'festival'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      row({
        justify: 'center',
        padding: 10,
        children: [
          shape('circle', {
            width: 48,
            height: 48,
            fill: 'transparent',
            stroke: LAYOUT_TOKENS.primary,
            strokeWidth: 2,
            opacity: 0.4,
          }),
        ],
      }),
  },

  {
    id: 'decoration-divider-wave',
    name: 'Ornamental Divider Crest',
    role: 'decoration',
    recipeVersion: RECIPE_VERSION,
    suits: ['temple_festival', 'wedding', 'award_function'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 0,
    maxTextLength: 0,
    slots: [],
    tree: () =>
      row({
        gap: 12,
        align: 'center',
        justify: 'center',
        padding: 12,
        children: [
          divider({ thickness: 2, width: 120 }),
          icon('sparkles', { size: 24, style: { color: LAYOUT_TOKENS.primary } }),
          divider({ thickness: 2, width: 120 }),
        ],
      }),
  },
];

/* ========================================================================= *
 * 7. TYPEPAIRING BLOCKS (At least 4)
 * ========================================================================= */

export const TYPE_PAIRING_BLOCKS = [
  {
    id: 'type-modern-sans',
    name: 'Modern Sans (Outfit + Inter)',
    role: 'typePairing',
    recipeVersion: RECIPE_VERSION,
    headingFont: 'Outfit',
    bodyFont: 'Inter',
    suits: ['corporate', 'general', 'sports', 'meeting'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        children: [
          text(c.title, {
            role: 'headline',
            style: { fontFamily: 'Outfit', size: 36, weight: 700, color: LAYOUT_TOKENS.text },
          }),
          text(c.subtitle || c.date, {
            style: { fontFamily: 'Inter', size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'type-editorial-serif',
    name: 'Editorial Serif (Playfair Display + Lato)',
    role: 'typePairing',
    recipeVersion: RECIPE_VERSION,
    headingFont: 'Playfair Display',
    bodyFont: 'Lato',
    suits: ['award_function', 'wedding', 'celebration'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        children: [
          text(c.title, {
            role: 'headline',
            style: { fontFamily: 'Playfair Display', size: 36, weight: 700, color: LAYOUT_TOKENS.text },
          }),
          text(c.subtitle || c.date, {
            style: { fontFamily: 'Lato', size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'type-geometric-clean',
    name: 'Geometric Clean (Montserrat + Open Sans)',
    role: 'typePairing',
    recipeVersion: RECIPE_VERSION,
    headingFont: 'Montserrat',
    bodyFont: 'Open Sans',
    suits: ['education', 'workshop', 'general'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        children: [
          text(c.title, {
            role: 'headline',
            style: { fontFamily: 'Montserrat', size: 36, weight: 700, color: LAYOUT_TOKENS.text },
          }),
          text(c.subtitle || c.date, {
            style: { fontFamily: 'Open Sans', size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'type-warm-humanist',
    name: 'Warm Humanist (Poppins + DM Sans)',
    role: 'typePairing',
    recipeVersion: RECIPE_VERSION,
    headingFont: 'Poppins',
    bodyFont: 'DM Sans',
    suits: ['health', 'blood_camp', 'celebration', 'birthday'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        children: [
          text(c.title, {
            role: 'headline',
            style: { fontFamily: 'Poppins', size: 36, weight: 700, color: LAYOUT_TOKENS.text },
          }),
          text(c.subtitle || c.date, {
            style: { fontFamily: 'DM Sans', size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'type-tamil-bilingual',
    name: 'Tamil Bilingual (Noto Serif Tamil + Noto Sans Tamil)',
    role: 'typePairing',
    recipeVersion: RECIPE_VERSION,
    headingFont: 'Noto Serif Tamil',
    bodyFont: 'Noto Sans Tamil',
    suits: ['temple_festival', 'celebration', 'general', 'cultural'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        children: [
          text(c.title, {
            role: 'headline',
            style: { fontFamily: 'Noto Serif Tamil', size: 34, weight: 700, color: LAYOUT_TOKENS.text },
          }),
          text(c.subtitle || c.date, {
            style: { fontFamily: 'Noto Sans Tamil', size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },
];

/* ========================================================================= *
 * 8. COLOURASSIGNMENT BLOCKS (At least 4, brand tokens only)
 * ========================================================================= */

export const COLOUR_ASSIGNMENT_BLOCKS = [
  {
    id: 'color-brand-strict',
    name: 'Brand Strict Assignment',
    role: 'colourAssignment',
    recipeVersion: RECIPE_VERSION,
    suits: ['*'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    tokens: {
      background: 'brand:background',
      surface: 'brand:secondary',
      title: 'brand:primary',
      text: 'brand:text',
      accent: 'brand:accent',
    },
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        background: { fill: LAYOUT_TOKENS.secondary, radius: 8 },
        children: [
          text(c.title, {
            role: 'headline',
            style: { size: 32, weight: 700, color: LAYOUT_TOKENS.primary },
          }),
          text(c.subtitle || c.date, {
            style: { size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'color-contrast-accent',
    name: 'Contrast Accent Assignment',
    role: 'colourAssignment',
    recipeVersion: RECIPE_VERSION,
    suits: ['sports', 'festival', 'blood_camp'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    tokens: {
      background: 'brand:background',
      surface: 'brand:secondary',
      title: 'brand:primary',
      text: 'brand:text',
      accent: 'brand:accent',
    },
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        children: [
          shape('rect', { width: 60, height: 6, fill: LAYOUT_TOKENS.accent }),
          text(c.title, {
            role: 'headline',
            style: { size: 32, weight: 700, color: LAYOUT_TOKENS.primary },
          }),
          text(c.subtitle || c.date, {
            style: { size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'color-soft-tint',
    name: 'Soft Tint Assignment',
    role: 'colourAssignment',
    recipeVersion: RECIPE_VERSION,
    suits: ['meeting', 'corporate', 'education'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    tokens: {
      background: 'brand:background',
      surface: 'brand:secondary',
      title: 'brand:primary',
      text: 'brand:text',
      accent: 'brand:secondary',
    },
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 18,
        gap: 10,
        background: { fill: LAYOUT_TOKENS.secondary, radius: 12 },
        children: [
          text(c.title, {
            role: 'headline',
            style: { size: 32, weight: 700, color: LAYOUT_TOKENS.primary },
          }),
          text(c.subtitle || c.date, {
            style: { size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },

  {
    id: 'color-duotone-bold',
    name: 'Duotone Bold Assignment',
    role: 'colourAssignment',
    recipeVersion: RECIPE_VERSION,
    suits: ['celebration', 'birthday', 'award_function'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    tokens: {
      background: 'brand:background',
      surface: 'brand:primary',
      title: 'brand:primary',
      text: 'brand:text',
      accent: 'brand:secondary',
    },
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        children: [
          text(c.title, {
            role: 'headline',
            style: { size: 32, weight: 800, color: LAYOUT_TOKENS.primary },
          }),
          row({
            padding: 12,
            background: { fill: LAYOUT_TOKENS.primary, radius: 8 },
            children: [
              text(c.subtitle || c.date, {
                style: { size: 20, weight: 700, color: '#ffffff' },
              }),
            ],
          }),
        ],
      });
    },
  },

  {
    id: 'color-light-neutral',
    name: 'Light Neutral Assignment',
    role: 'colourAssignment',
    recipeVersion: RECIPE_VERSION,
    suits: ['notice', 'general', 'corporate'],
    needsPhoto: false,
    compatibleWith: ['*'],
    incompatibleWith: [],
    minTextLength: 3,
    maxTextLength: 140,
    tokens: {
      background: 'brand:background',
      surface: 'brand:background',
      title: 'brand:primary',
      text: 'brand:text',
      accent: 'brand:primary',
    },
    slots: [
      { name: 'title', priority: FIELD_PRIORITY.headline, required: true },
      { name: 'subtitle', priority: FIELD_PRIORITY.subtitle, required: false },
    ],
    tree: (rawContent) => {
      const c = extractBlockContent(rawContent);
      return stack({
        padding: 16,
        gap: 10,
        background: { stroke: LAYOUT_TOKENS.primary, strokeWidth: 1, radius: 8 },
        children: [
          text(c.title, {
            role: 'headline',
            style: { size: 32, weight: 700, color: LAYOUT_TOKENS.primary },
          }),
          text(c.subtitle || c.date, {
            style: { size: 22, weight: 400, color: LAYOUT_TOKENS.text },
          }),
        ],
      });
    },
  },
];

/* ========================================================================= *
 * Aggregations and Lookup Helpers
 * ========================================================================= */

export const DESIGN_BLOCKS = [
  ...HERO_BLOCKS,
  ...INFO_BLOCKS,
  ...MESSAGE_BLOCKS,
  ...CTA_BLOCKS,
  ...BACKGROUND_BLOCKS,
  ...DECORATION_BLOCKS,
  ...TYPE_PAIRING_BLOCKS,
  ...COLOUR_ASSIGNMENT_BLOCKS,
];

export const DESIGN_BLOCKS_BY_ID = new Map(DESIGN_BLOCKS.map((b) => [b.id, b]));

/**
 * Returns block by unique id.
 */
export function blockById(id) {
  if (!id) return undefined;
  return DESIGN_BLOCKS_BY_ID.get(String(id).trim());
}

/**
 * Returns all blocks matching a given role.
 */
export function blocksByRole(role) {
  const r = String(role || '').trim();
  return DESIGN_BLOCKS.filter((b) => b.role === r);
}

/**
 * Returns all blocks suitable for a given event category/type.
 */
export function blocksForCategory(category, role = null) {
  const cat = String(category || '').trim().toLowerCase();
  return DESIGN_BLOCKS.filter((b) => {
    if (role && b.role !== role) return false;
    if (b.suits.includes('*') || b.suits.includes('all')) return true;
    return b.suits.some((s) => s.toLowerCase() === cat);
  });
}

/**
 * Checks compatibility between two block definitions.
 */
export function isCompatible(blockA, blockB) {
  const a = typeof blockA === 'string' ? blockById(blockA) : blockA;
  const b = typeof blockB === 'string' ? blockById(blockB) : blockB;
  if (!a || !b) return false;
  if (a.id === b.id) return false;

  if (Array.isArray(a.incompatibleWith) && a.incompatibleWith.includes(b.id)) return false;
  if (Array.isArray(b.incompatibleWith) && b.incompatibleWith.includes(a.id)) return false;

  const aMatches =
    a.compatibleWith.includes('*') || a.compatibleWith.includes(b.id);
  const bMatches =
    b.compatibleWith.includes('*') || b.compatibleWith.includes(a.id);

  return aMatches && bMatches;
}

/**
 * Executes layout for a single block within a target contentArea.
 */
export function layoutBlock(block, content, options = {}) {
  const b = typeof block === 'string' ? blockById(block) : block;
  if (!b) return [];

  const area = options.contentArea || { x: 40, y: 120, w: 1000, h: 1100 };
  const margin = options.margin !== undefined ? options.margin : 20;

  const nodeTree = b.tree ? b.tree(content, options) : null;
  if (!nodeTree) return [];

  return layout(nodeTree, {
    contentArea: area,
    margin,
  });
}

export default {
  RECIPE_VERSION,
  DESIGN_BLOCK_ROLES,
  HERO_BLOCKS,
  INFO_BLOCKS,
  MESSAGE_BLOCKS,
  CTA_BLOCKS,
  BACKGROUND_BLOCKS,
  DECORATION_BLOCKS,
  TYPE_PAIRING_BLOCKS,
  COLOUR_ASSIGNMENT_BLOCKS,
  DESIGN_BLOCKS,
  DESIGN_BLOCKS_BY_ID,
  blockById,
  blocksByRole,
  blocksForCategory,
  isCompatible,
  layoutBlock,
  extractBlockContent,
};
