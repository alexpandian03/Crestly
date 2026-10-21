/**
 * /shared/archetypes.js
 *
 * 10 Archetypes as Layout Trees & 6 Styles driven only by brand tokens.
 * Pure ESM module, zero external dependencies.
 *
 * Archetypes:
 *  1. hero-photo-top
 *  2. split
 *  3. big-type
 *  4. fullbleed-card
 *  5. ribbon-date
 *  6. card-grid
 *  7. medallion-hero
 *  8. timeline-program
 *  9. quote-center
 * 10. banner-stack
 *
 * Styles:
 *  1. bold
 *  2. elegant
 *  3. minimal
 *  4. festive
 *  5. corporate
 *  6. playful
 */

import {
  layout,
  stack,
  row,
  grid,
  text,
  image,
  icon,
  divider,
} from './layoutEngine.js';
import { contentArea, resolveColorToken, clampRectToArea } from './templateElements.js';
import { contrastRatio, readableColorOn } from './designRecipes.js';
export const SLOT_PRIORITY = {
  P1_TITLE: 8,
  P2_SUBTITLE: 6,
  P2_DATE: 7,
  P3_TIME: 5,
  P2_VENUE: 5,
  P3_TAGLINE: 4,
  P4_DETAILS: 3,
  P3_DETAILS: 3,
  P2_DETAILS: 5,
  P3_CTA: 2,
  P2_QUOTE: 7,
  P2_PROGRAM: 5,
  P1_PHOTO: 8,
};

export const RECIPE_VERSION = 2;

/* =========================================================================
 * 6 STYLES (Driven ONLY by brand tokens)
 * ========================================================================= */

export const STYLE_IDS = [
  'bold',
  'elegant',
  'minimal',
  'festive',
  'corporate',
  'playful',
];

export const STYLES = {
  bold: {
    id: 'bold',
    label: 'Bold',
    palette: {
      background: 'brand:background',
      title: 'brand:primary',
      accent: 'brand:accent',
      band: 'brand:primary',
      text: 'brand:text',
      surface: 'brand:background',
      border: 'brand:primary',
      contrastTextOnBand: '#ffffff',
    },
    typography: {
      headingFont: 'brand:heading',
      bodyFont: 'brand:body',
      headingWeight: 800,
      subtitleWeight: 600,
      bodyWeight: 500,
      titleSize: 64,
      subtitleSize: 24,
      bodySize: 18,
      taglineSize: 22,
      ctaSize: 18,
      uppercase: true,
      letterSpacing: '0.02em',
    },
    decoration: {
      type: 'corners',
      opacity: 0.08, // at most 8% opacity
    },
    geometry: {
      radius: 8,
      spacing: 20,
      gap: 16,
      padding: 20,
    },
    getDecorations(area, style) {
      const op = Math.min(0.08, style.decoration.opacity);
      const col = style.palette.accent;
      const size = 36;
      const thick = 3;
      return [
        // Top-left corner
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x, y: area.y, w: size, h: thick, opacity: op, z: 1 },
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x, y: area.y, w: thick, h: size, opacity: op, z: 1 },
        // Top-right corner
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x + area.w - size, y: area.y, w: size, h: thick, opacity: op, z: 1 },
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x + area.w - thick, y: area.y, w: thick, h: size, opacity: op, z: 1 },
        // Bottom-left corner
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x, y: area.y + area.h - thick, w: size, h: thick, opacity: op, z: 1 },
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x, y: area.y + area.h - size, w: thick, h: size, opacity: op, z: 1 },
        // Bottom-right corner
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x + area.w - size, y: area.y + area.h - thick, w: size, h: thick, opacity: op, z: 1 },
        { type: 'shape', shape: { type: 'rect', fill: col }, x: area.x + area.w - thick, y: area.y + area.h - size, w: thick, h: size, opacity: op, z: 1 },
      ];
    },
  },

  elegant: {
    id: 'elegant',
    label: 'Elegant',
    palette: {
      background: 'brand:background',
      title: 'brand:secondary',
      accent: 'brand:accent',
      band: 'brand:secondary',
      text: 'brand:text',
      surface: 'brand:background',
      border: 'brand:accent',
      contrastTextOnBand: '#ffffff',
    },
    typography: {
      headingFont: 'brand:heading',
      bodyFont: 'brand:body',
      headingWeight: 600,
      subtitleWeight: 400,
      bodyWeight: 400,
      titleSize: 58,
      subtitleSize: 22,
      bodySize: 17,
      taglineSize: 20,
      ctaSize: 16,
      uppercase: false,
      letterSpacing: '0.04em',
    },
    decoration: {
      type: 'corners',
      opacity: 0.07,
    },
    geometry: {
      radius: 4,
      spacing: 24,
      gap: 18,
      padding: 24,
    },
    getDecorations(area, style) {
      const op = Math.min(0.08, style.decoration.opacity);
      const col = style.palette.accent;
      const inset = 12;
      return [
        {
          type: 'shape',
          shape: { type: 'rect', fill: 'transparent', stroke: col, strokeWidth: 1.5 },
          x: area.x + inset,
          y: area.y + inset,
          w: area.w - inset * 2,
          h: area.h - inset * 2,
          opacity: op,
          z: 1,
        },
      ];
    },
  },

  minimal: {
    id: 'minimal',
    label: 'Minimal',
    palette: {
      background: 'brand:background',
      title: 'brand:text',
      accent: 'brand:primary',
      band: 'brand:secondary',
      text: 'brand:text',
      surface: 'brand:background',
      border: 'brand:text',
      contrastTextOnBand: '#ffffff',
    },
    typography: {
      headingFont: 'brand:heading',
      bodyFont: 'brand:body',
      headingWeight: 700,
      subtitleWeight: 400,
      bodyWeight: 400,
      titleSize: 56,
      subtitleSize: 20,
      bodySize: 16,
      taglineSize: 19,
      ctaSize: 16,
      uppercase: false,
      letterSpacing: '-0.01em',
    },
    decoration: {
      type: 'none',
      opacity: 0,
    },
    geometry: {
      radius: 0,
      spacing: 24,
      gap: 20,
      padding: 24,
    },
    getDecorations() {
      return [];
    },
  },

  festive: {
    id: 'festive',
    label: 'Festive',
    palette: {
      background: 'brand:background',
      title: 'brand:accent',
      accent: 'brand:primary',
      band: 'brand:accent',
      text: 'brand:text',
      surface: 'brand:background',
      border: 'brand:accent',
      contrastTextOnBand: '#ffffff',
    },
    typography: {
      headingFont: 'brand:heading',
      bodyFont: 'brand:body',
      headingWeight: 800,
      subtitleWeight: 600,
      bodyWeight: 500,
      titleSize: 62,
      subtitleSize: 24,
      bodySize: 18,
      taglineSize: 22,
      ctaSize: 18,
      uppercase: false,
      letterSpacing: '0.03em',
    },
    decoration: {
      type: 'rings',
      opacity: 0.08,
    },
    geometry: {
      radius: 14,
      spacing: 18,
      gap: 16,
      padding: 18,
    },
    getDecorations(area, style) {
      const op = Math.min(0.08, style.decoration.opacity);
      const col = style.palette.accent;
      return [
        {
          type: 'shape',
          shape: { type: 'circle', fill: 'transparent', stroke: col, strokeWidth: 2 },
          x: area.x + area.w - 150,
          y: area.y + 10,
          w: 140,
          h: 140,
          opacity: op,
          z: 1,
        },
        {
          type: 'shape',
          shape: { type: 'circle', fill: 'transparent', stroke: col, strokeWidth: 1.5 },
          x: area.x + area.w - 200,
          y: area.y + 10,
          w: 190,
          h: 190,
          opacity: op * 0.75,
          z: 1,
        },
      ];
    },
  },

  corporate: {
    id: 'corporate',
    label: 'Corporate',
    palette: {
      background: 'brand:background',
      title: 'brand:secondary',
      accent: 'brand:primary',
      band: 'brand:primary',
      text: 'brand:text',
      surface: 'brand:background',
      border: 'brand:secondary',
      contrastTextOnBand: '#ffffff',
    },
    typography: {
      headingFont: 'brand:heading',
      bodyFont: 'brand:body',
      headingWeight: 700,
      subtitleWeight: 500,
      bodyWeight: 400,
      titleSize: 56,
      subtitleSize: 22,
      bodySize: 17,
      taglineSize: 20,
      ctaSize: 16,
      uppercase: false,
      letterSpacing: '0.01em',
    },
    decoration: {
      type: 'band',
      opacity: 0.06,
    },
    geometry: {
      radius: 6,
      spacing: 18,
      gap: 14,
      padding: 18,
    },
    getDecorations(area, style) {
      const op = Math.min(0.08, style.decoration.opacity);
      const col = style.palette.primary || style.palette.band;
      return [
        {
          type: 'shape',
          shape: { type: 'rect', fill: col },
          x: area.x,
          y: area.y + 24,
          w: area.w,
          h: 5,
          opacity: op,
          z: 1,
        },
      ];
    },
  },

  playful: {
    id: 'playful',
    label: 'Playful',
    palette: {
      background: 'brand:background',
      title: 'brand:primary',
      accent: 'brand:accent',
      band: 'brand:accent',
      text: 'brand:text',
      surface: 'brand:background',
      border: 'brand:primary',
      contrastTextOnBand: '#ffffff',
    },
    typography: {
      headingFont: 'brand:heading',
      bodyFont: 'brand:body',
      headingWeight: 800,
      subtitleWeight: 600,
      bodyWeight: 500,
      titleSize: 60,
      subtitleSize: 23,
      bodySize: 17,
      taglineSize: 21,
      ctaSize: 17,
      uppercase: false,
      letterSpacing: '0.02em',
    },
    decoration: {
      type: 'dots',
      opacity: 0.08,
    },
    geometry: {
      radius: 18,
      spacing: 16,
      gap: 14,
      padding: 16,
    },
    getDecorations(area, style) {
      const op = Math.min(0.08, style.decoration.opacity);
      const col = style.palette.accent;
      const dots = [];
      const dotSize = 6;
      const step = 20;
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 4; c++) {
          dots.push({
            type: 'shape',
            shape: { type: 'circle', fill: col },
            x: area.x + area.w - 110 + c * step,
            y: area.y + 20 + r * step,
            w: dotSize,
            h: dotSize,
            opacity: op,
            z: 1,
          });
        }
      }
      return dots;
    },
  },
};

/* =========================================================================
 * 10 ARCHETYPES AS LAYOUT TREES
 * ========================================================================= */

export const ARCHETYPE_IDS = [
  'hero-photo-top',
  'split',
  'big-type',
  'fullbleed-card',
  'ribbon-date',
  'card-grid',
  'medallion-hero',
  'timeline-program',
  'quote-center',
  'banner-stack',
];

export const ARCHETYPES = {
  'hero-photo-top': {
    id: 'hero-photo-top',
    label: 'Hero Photo Top',
    suits: ['birthday', 'sports_day', 'school_annual_day', 'wedding', 'temple_festival', 'blood_camp'],
    needsPhoto: true,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 70 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 100 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P4_DETAILS, min: 0, max: 180 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
      { id: 'photo', label: 'Main Photo', priority: SLOT_PRIORITY.P1_TITLE, min: 0, max: 1 },
    ],
    tree(content, style) {
      const photoSrc = content.photo || content.imageUrl || '';
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ gap: style.geometry.gap, padding: style.geometry.spacing, justify: 'start' }, [
        // 1. Photo Hero (top)
        image(photoSrc || 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1080&q=80', {
          height: 380,
          width: 'fill',
          fit: 'cover',
          shape: { radius: style.geometry.radius },
        }),

        // 2. Headline & Subtitle
        stack({ gap: 6, align: 'start' }, [
          text(content.title || 'Event Headline', {
            font: style.typography.headingFont,
            weight: style.typography.headingWeight,
            size: style.typography.titleSize,
            color: style.palette.title,
            uppercase: style.typography.uppercase,
            lineHeight: 1.15,
          }),
          content.subtitle || content.tagline
            ? text(content.subtitle || content.tagline, {
                font: style.typography.bodyFont,
                weight: style.typography.subtitleWeight,
                size: style.typography.subtitleSize,
                color: style.palette.text,
                lineHeight: 1.3,
              })
            : null,
        ]),

        // 3. Facts row
        row({ gap: 12, width: 'fill', justify: 'start' }, [
          content.date
            ? text(`📅 ${content.date}`, { font: style.typography.bodyFont, weight: 600, size: style.typography.bodySize, color: style.palette.title })
            : null,
          content.time
            ? text(`⏰ ${content.time}`, { font: style.typography.bodyFont, weight: 500, size: style.typography.bodySize, color: style.palette.text })
            : null,
          content.venue
            ? text(`📍 ${content.venue}`, { font: style.typography.bodyFont, weight: 500, size: style.typography.bodySize, color: style.palette.text })
            : null,
        ]),

        // 4. Details highlights
        content.details
          ? text(Array.isArray(content.details) ? content.details.join(' • ') : String(content.details), {
              font: style.typography.bodyFont,
              weight: style.typography.bodyWeight,
              size: style.typography.bodySize,
              color: style.palette.text,
              lineHeight: 1.4,
            })
          : null,

        // 5. CTA Button
        ctaVal
          ? row({ justify: 'center', width: 'fill', padding: { top: 6 } }, [
              stack(
                {
                  padding: { x: 28, y: 12 },
                  shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
                },
                [
                  text(String(ctaVal), {
                    font: style.typography.bodyFont,
                    weight: 700,
                    size: style.typography.ctaSize,
                    color: style.palette.contrastTextOnBand,
                    uppercase: true,
                  }),
                ]
              ),
            ])
          : null,
      ]);
    },
  },

  split: {
    id: 'split',
    label: 'Split Two-Column',
    suits: ['blood_camp', 'workshop', 'meeting', 'general', 'sports_day'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 60 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 90 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P3_DETAILS, min: 0, max: 200 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return row({ gap: 24, padding: style.geometry.spacing, width: 'fill', align: 'stretch' }, [
        // Left Column (Accent Panel)
        stack(
          {
            width: 360,
            padding: 24,
            gap: 18,
            shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: style.palette.accent, strokeWidth: 1.5, radius: style.geometry.radius },
            align: 'start',
          },
          [
            icon('calendar', { size: 36, color: style.palette.title }),
            text(content.date || 'Event Date', {
              font: style.typography.headingFont,
              weight: 800,
              size: 32,
              color: style.palette.title,
            }),
            content.time
              ? text(content.time, { font: style.typography.bodyFont, weight: 600, size: 20, color: style.palette.text })
              : null,
            divider({ color: style.palette.accent, thickness: 2, width: 'fill' }),
            text(content.venue || 'Venue Address', {
              font: style.typography.bodyFont,
              weight: 500,
              size: 18,
              color: style.palette.text,
              lineHeight: 1.35,
            }),
          ]
        ),

        // Right Column (Headline & Content)
        stack({ flexGrow: 1, gap: 16, justify: 'start', align: 'start' }, [
          text(content.title || 'Event Title', {
            font: style.typography.headingFont,
            weight: style.typography.headingWeight,
            size: style.typography.titleSize,
            color: style.palette.title,
            uppercase: style.typography.uppercase,
            lineHeight: 1.15,
          }),
          content.subtitle || content.tagline
            ? text(content.subtitle || content.tagline, {
                font: style.typography.bodyFont,
                weight: style.typography.subtitleWeight,
                size: style.typography.subtitleSize,
                color: style.palette.text,
                lineHeight: 1.35,
              })
            : null,
          divider({ color: style.palette.accent, thickness: 2, width: 'fill' }),
          content.details
            ? text(Array.isArray(content.details) ? content.details.join('\n') : String(content.details), {
                font: style.typography.bodyFont,
                weight: style.typography.bodyWeight,
                size: style.typography.bodySize,
                color: style.palette.text,
                lineHeight: 1.45,
              })
            : null,
          ctaVal
            ? stack(
                {
                  padding: { x: 28, y: 12 },
                  shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
                },
                [
                  text(String(ctaVal), {
                    font: style.typography.bodyFont,
                    weight: 700,
                    size: style.typography.ctaSize,
                    color: style.palette.contrastTextOnBand,
                    uppercase: true,
                  }),
                ]
              )
            : null,
        ]),
      ]);
    },
  },

  'big-type': {
    id: 'big-type',
    label: 'Big Type Editorial',
    suits: ['blood_camp', 'meeting', 'workshop', 'general', 'award_function'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 60 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 100 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P4_DETAILS, min: 0, max: 160 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ gap: 20, padding: style.geometry.spacing, justify: 'start', align: 'start' }, [
        // Category / Kicker
        text('★ OFFICIAL ANNOUNCEMENT', {
          font: style.typography.bodyFont,
          weight: 700,
          size: 14,
          color: style.palette.accent,
          letterSpacing: '0.12em',
        }),

        // Giant Title
        text(content.title || 'BIG TYPE HEADLINE', {
          font: style.typography.headingFont,
          weight: style.typography.headingWeight,
          size: Math.max(68, style.typography.titleSize + 8),
          color: style.palette.title,
          uppercase: true,
          lineHeight: 1.05,
        }),

        // Prominent divider rule
        divider({ color: style.palette.accent, thickness: 4, width: 'fill' }),

        // Subtitle & narrative
        content.subtitle || content.tagline
          ? text(content.subtitle || content.tagline, {
              font: style.typography.bodyFont,
              weight: style.typography.subtitleWeight,
              size: style.typography.subtitleSize,
              color: style.palette.text,
              lineHeight: 1.35,
            })
          : null,

        content.details
          ? text(Array.isArray(content.details) ? content.details.join(' • ') : String(content.details), {
              font: style.typography.bodyFont,
              weight: style.typography.bodyWeight,
              size: style.typography.bodySize,
              color: style.palette.text,
              lineHeight: 1.45,
            })
          : null,

        // Compact Info row
        row(
          {
            width: 'fill',
            padding: 16,
            gap: 16,
            shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
            justify: 'space-between',
          },
          [
            content.date ? text(`📅 ${content.date}`, { font: style.typography.bodyFont, weight: 700, size: 17, color: style.palette.title }) : null,
            content.time ? text(`⏰ ${content.time}`, { font: style.typography.bodyFont, weight: 600, size: 17, color: style.palette.text }) : null,
            content.venue ? text(`📍 ${content.venue}`, { font: style.typography.bodyFont, weight: 600, size: 17, color: style.palette.text }) : null,
          ]
        ),

        // CTA
        ctaVal
          ? stack(
              {
                padding: { x: 32, y: 14 },
                shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
              },
              [
                text(String(ctaVal), {
                  font: style.typography.bodyFont,
                  weight: 700,
                  size: style.typography.ctaSize,
                  color: style.palette.contrastTextOnBand,
                  uppercase: true,
                }),
              ]
            )
          : null,
      ]);
    },
  },

  'fullbleed-card': {
    id: 'fullbleed-card',
    label: 'Fullbleed Elevated Card',
    suits: ['award_function', 'school_annual_day', 'workshop', 'general', 'wedding'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 70 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 100 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P4_DETAILS, min: 0, max: 180 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ padding: style.geometry.spacing, width: 'fill', align: 'center', justify: 'center' }, [
        stack(
          {
            width: 'fill',
            padding: 32,
            gap: 18,
            shape: { type: 'rounded-rect', fill: '#ffffff', stroke: style.palette.border, strokeWidth: 1.5, radius: style.geometry.radius },
            align: 'start',
          },
          [
            // Inset Card Header
            row({ justify: 'space-between', width: 'fill', align: 'center' }, [
              text('INVITATION', { font: style.typography.bodyFont, weight: 700, size: 14, color: style.palette.accent, letterSpacing: '0.1em' }),
              content.date ? text(content.date, { font: style.typography.bodyFont, weight: 600, size: 15, color: style.palette.title }) : null,
            ]),
            divider({ color: style.palette.accent, thickness: 1.5, width: 'fill' }),

            // Title
            text(content.title || 'Card Headline', {
              font: style.typography.headingFont,
              weight: style.typography.headingWeight,
              size: style.typography.titleSize,
              color: style.palette.title,
              lineHeight: 1.15,
            }),

            // Subtitle
            content.subtitle || content.tagline
              ? text(content.subtitle || content.tagline, {
                  font: style.typography.bodyFont,
                  weight: style.typography.subtitleWeight,
                  size: style.typography.subtitleSize,
                  color: style.palette.text,
                  lineHeight: 1.35,
                })
              : null,

            // Details
            content.details
              ? text(Array.isArray(content.details) ? content.details.join('\n') : String(content.details), {
                  font: style.typography.bodyFont,
                  weight: style.typography.bodyWeight,
                  size: style.typography.bodySize,
                  color: style.palette.text,
                  lineHeight: 1.45,
                })
              : null,

            // Venue & Time Strip
            row(
              {
                width: 'fill',
                padding: { x: 16, y: 12 },
                gap: 16,
                shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: 4 },
                justify: 'space-between',
              },
              [
                content.time ? text(`Time: ${content.time}`, { font: style.typography.bodyFont, weight: 600, size: 15, color: style.palette.text }) : null,
                content.venue ? text(`Venue: ${content.venue}`, { font: style.typography.bodyFont, weight: 600, size: 15, color: style.palette.title }) : null,
              ]
            ),

            // Card Footer CTA
            ctaVal
              ? row({ justify: 'center', width: 'fill', padding: { top: 8 } }, [
                  stack(
                    {
                      padding: { x: 32, y: 12 },
                      shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
                    },
                    [
                      text(String(ctaVal), {
                        font: style.typography.bodyFont,
                        weight: 700,
                        size: style.typography.ctaSize,
                        color: style.palette.contrastTextOnBand,
                      }),
                    ]
                  ),
                ])
              : null,
          ]
        ),
      ]);
    },
  },

  'ribbon-date': {
    id: 'ribbon-date',
    label: 'Ribbon Date',
    suits: ['sports_day', 'temple_festival', 'school_annual_day', 'blood_camp', 'meeting'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 70 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 100 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P1_TITLE, min: 2, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P4_DETAILS, min: 0, max: 180 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ gap: 20, padding: style.geometry.spacing, justify: 'start', align: 'start' }, [
        // Title block
        stack({ gap: 8, align: 'start' }, [
          text(content.title || 'Ribbon Date Headline', {
            font: style.typography.headingFont,
            weight: style.typography.headingWeight,
            size: style.typography.titleSize,
            color: style.palette.title,
            uppercase: style.typography.uppercase,
            lineHeight: 1.15,
          }),
          content.subtitle || content.tagline
            ? text(content.subtitle || content.tagline, {
                font: style.typography.bodyFont,
                weight: style.typography.subtitleWeight,
                size: style.typography.subtitleSize,
                color: style.palette.text,
                lineHeight: 1.35,
              })
            : null,
        ]),

        // Date Ribbon
        stack(
          {
            width: 'fill',
            padding: { x: 24, y: 18 },
            shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
            gap: 6,
          },
          [
            row({ justify: 'space-between', align: 'center', width: 'fill' }, [
              text(content.date || 'EVENT DATE', {
                font: style.typography.headingFont,
                weight: 800,
                size: 28,
                color: style.palette.contrastTextOnBand,
              }),
              content.time
                ? text(`⏰ ${content.time}`, { font: style.typography.bodyFont, weight: 600, size: 20, color: style.palette.contrastTextOnBand })
                : null,
            ]),
          ]
        ),

        // Venue Callout
        content.venue
          ? row({ gap: 10, align: 'center' }, [
              icon('map-pin', { size: 24, color: style.palette.accent }),
              text(content.venue, { font: style.typography.bodyFont, weight: 600, size: 20, color: style.palette.title }),
            ])
          : null,

        // Details
        content.details
          ? text(Array.isArray(content.details) ? content.details.join(' • ') : String(content.details), {
              font: style.typography.bodyFont,
              weight: style.typography.bodyWeight,
              size: style.typography.bodySize,
              color: style.palette.text,
              lineHeight: 1.45,
            })
          : null,

        // CTA
        ctaVal
          ? stack(
              {
                padding: { x: 30, y: 12 },
                shape: { type: 'rounded-rect', fill: style.palette.accent, radius: style.geometry.radius },
              },
              [
                text(String(ctaVal), {
                  font: style.typography.bodyFont,
                  weight: 700,
                  size: style.typography.ctaSize,
                  color: '#ffffff',
                }),
              ]
            )
          : null,
      ]);
    },
  },

  'card-grid': {
    id: 'card-grid',
    label: 'Card Grid',
    suits: ['award_function', 'school_annual_day', 'workshop', 'temple_festival', 'general'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 65 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 90 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P3_DETAILS, min: 0, max: 160 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ gap: 20, padding: style.geometry.spacing, justify: 'start' }, [
        // Title
        stack({ gap: 6, align: 'start' }, [
          text(content.title || 'Structured Grid Event', {
            font: style.typography.headingFont,
            weight: style.typography.headingWeight,
            size: style.typography.titleSize,
            color: style.palette.title,
            uppercase: style.typography.uppercase,
            lineHeight: 1.15,
          }),
          content.subtitle || content.tagline
            ? text(content.subtitle || content.tagline, {
                font: style.typography.bodyFont,
                weight: style.typography.subtitleWeight,
                size: style.typography.subtitleSize,
                color: style.palette.text,
              })
            : null,
        ]),

        // 2x2 Grid of Info Cards
        grid(
          {
            columns: 2,
            gap: 16,
            width: 'fill',
          },
          [
            // Card 1: Date
            stack(
              {
                padding: 16,
                gap: 6,
                shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
              },
              [
                text('DATE', { font: style.typography.bodyFont, weight: 700, size: 12, color: style.palette.accent }),
                text(content.date || 'To Be Announced', { font: style.typography.headingFont, weight: 700, size: 18, color: style.palette.title }),
              ]
            ),
            // Card 2: Time
            stack(
              {
                padding: 16,
                gap: 6,
                shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
              },
              [
                text('TIME', { font: style.typography.bodyFont, weight: 700, size: 12, color: style.palette.accent }),
                text(content.time || 'Schedule Online', { font: style.typography.headingFont, weight: 700, size: 18, color: style.palette.title }),
              ]
            ),
            // Card 3: Venue
            stack(
              {
                padding: 16,
                gap: 6,
                shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
              },
              [
                text('VENUE', { font: style.typography.bodyFont, weight: 700, size: 12, color: style.palette.accent }),
                text(content.venue || 'Main Hall', { font: style.typography.bodyFont, weight: 600, size: 16, color: style.palette.title }),
              ]
            ),
            // Card 4: Details
            stack(
              {
                padding: 16,
                gap: 6,
                shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
              },
              [
                text('HIGHLIGHTS', { font: style.typography.bodyFont, weight: 700, size: 12, color: style.palette.accent }),
                text(Array.isArray(content.details) ? content.details[0] || 'Open to all' : String(content.details || 'Open to all'), {
                  font: style.typography.bodyFont,
                  weight: 500,
                  size: 15,
                  color: style.palette.text,
                }),
              ]
            ),
          ]
        ),

        // CTA
        ctaVal
          ? row({ justify: 'center', width: 'fill', padding: { top: 6 } }, [
              stack(
                {
                  padding: { x: 30, y: 12 },
                  shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
                },
                [
                  text(String(ctaVal), {
                    font: style.typography.bodyFont,
                    weight: 700,
                    size: style.typography.ctaSize,
                    color: style.palette.contrastTextOnBand,
                  }),
                ]
              ),
            ])
          : null,
      ]);
    },
  },

  'medallion-hero': {
    id: 'medallion-hero',
    label: 'Medallion Hero',
    suits: ['award_function', 'temple_festival', 'birthday', 'school_annual_day', 'wedding'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 60 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 90 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P4_DETAILS, min: 0, max: 160 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ gap: 18, padding: style.geometry.spacing, align: 'center', justify: 'center' }, [
        // Circular Medallion Icon Badge
        stack(
          {
            padding: 24,
            shape: { type: 'circle', fill: '#f8fafc', stroke: style.palette.accent, strokeWidth: 2 },
            align: 'center',
            justify: 'center',
          },
          [icon('award', { size: 48, color: style.palette.accent })]
        ),

        // Centered Headline
        text(content.title || 'Honour & Recognition', {
          font: style.typography.headingFont,
          weight: style.typography.headingWeight,
          size: style.typography.titleSize,
          color: style.palette.title,
          align: 'center',
          lineHeight: 1.15,
        }),

        // Centered Subtitle
        content.subtitle || content.tagline
          ? text(content.subtitle || content.tagline, {
              font: style.typography.bodyFont,
              weight: style.typography.subtitleWeight,
              size: style.typography.subtitleSize,
              color: style.palette.text,
              align: 'center',
              lineHeight: 1.35,
            })
          : null,

        // Divider
        divider({ color: style.palette.accent, thickness: 2, width: 280 }),

        // Centered Info Pill
        row(
          {
            padding: { x: 24, y: 12 },
            gap: 16,
            shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: 24 },
            justify: 'center',
          },
          [
            content.date ? text(content.date, { font: style.typography.bodyFont, weight: 700, size: 16, color: style.palette.title }) : null,
            content.time ? text(`• ${content.time}`, { font: style.typography.bodyFont, weight: 500, size: 16, color: style.palette.text }) : null,
            content.venue ? text(`• ${content.venue}`, { font: style.typography.bodyFont, weight: 500, size: 16, color: style.palette.text }) : null,
          ]
        ),

        // Details
        content.details
          ? text(Array.isArray(content.details) ? content.details.join(' • ') : String(content.details), {
              font: style.typography.bodyFont,
              weight: style.typography.bodyWeight,
              size: style.typography.bodySize,
              color: style.palette.text,
              align: 'center',
              lineHeight: 1.4,
            })
          : null,

        // CTA
        ctaVal
          ? stack(
              {
                padding: { x: 34, y: 14 },
                shape: { type: 'rounded-rect', fill: style.palette.band, radius: 24 },
              },
              [
                text(String(ctaVal), {
                  font: style.typography.bodyFont,
                  weight: 700,
                  size: style.typography.ctaSize,
                  color: style.palette.contrastTextOnBand,
                }),
              ]
            )
          : null,
      ]);
    },
  },

  'timeline-program': {
    id: 'timeline-program',
    label: 'Timeline Program',
    suits: ['workshop', 'school_annual_day', 'temple_festival', 'meeting', 'sports_day'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 65 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 90 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'program', label: 'Program Schedule', priority: SLOT_PRIORITY.P2_DETAILS, min: 0, max: 350 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P4_DETAILS, min: 0, max: 150 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      const programItems = content.program
        ? String(content.program).split('\n').filter(Boolean).slice(0, 4)
        : ['Opening Session', 'Keynote & Presentations', 'Interactive Discussion', 'Closing Remarks'];

      return stack({ gap: 18, padding: style.geometry.spacing, justify: 'start' }, [
        // Header
        stack({ gap: 6, align: 'start' }, [
          text(content.title || 'Program Schedule', {
            font: style.typography.headingFont,
            weight: style.typography.headingWeight,
            size: style.typography.titleSize,
            color: style.palette.title,
            uppercase: style.typography.uppercase,
            lineHeight: 1.15,
          }),
          content.subtitle || content.tagline
            ? text(content.subtitle || content.tagline, {
                font: style.typography.bodyFont,
                weight: style.typography.subtitleWeight,
                size: style.typography.subtitleSize,
                color: style.palette.text,
              })
            : null,
        ]),

        // Schedule Bar
        row(
          {
            padding: 12,
            gap: 16,
            shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
            justify: 'space-between',
          },
          [
            content.date ? text(`📅 ${content.date}`, { font: style.typography.bodyFont, weight: 700, size: 16, color: style.palette.title }) : null,
            content.venue ? text(`📍 ${content.venue}`, { font: style.typography.bodyFont, weight: 600, size: 16, color: style.palette.text }) : null,
          ]
        ),

        // Timeline items
        stack(
          { gap: 12, padding: { y: 6 }, align: 'start' },
          programItems.map((item, idx) =>
            row({ gap: 12, align: 'center', width: 'fill' }, [
              stack(
                {
                  padding: { x: 10, y: 4 },
                  shape: { type: 'rounded-rect', fill: style.palette.band, radius: 4 },
                },
                [
                  text(`0${idx + 1}`, {
                    font: style.typography.bodyFont,
                    weight: 700,
                    size: 13,
                    color: style.palette.contrastTextOnBand,
                  }),
                ]
              ),
              text(item, { font: style.typography.bodyFont, weight: 600, size: 16, color: style.palette.text }),
            ])
          )
        ),

        // CTA
        ctaVal
          ? stack(
              {
                padding: { x: 28, y: 12 },
                shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
              },
              [
                text(String(ctaVal), {
                  font: style.typography.bodyFont,
                  weight: 700,
                  size: style.typography.ctaSize,
                  color: style.palette.contrastTextOnBand,
                }),
              ]
            )
          : null,
      ]);
    },
  },

  'quote-center': {
    id: 'quote-center',
    label: 'Quote Center',
    suits: ['blood_camp', 'meeting', 'birthday', 'general', 'wedding'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 3, max: 60 },
      { id: 'quote', label: 'Quote / Motto', priority: SLOT_PRIORITY.P1_TITLE, min: 10, max: 160 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P3_TAGLINE, min: 0, max: 80 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const quoteText = content.quote || content.message || content.title || 'Give the gift of life and inspire humanity.';
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ gap: 20, padding: style.geometry.spacing, align: 'center', justify: 'center' }, [
        // Event Context Header
        text(content.title ? `— ${content.title.toUpperCase()} —` : '— SPECIAL INITIATIVE —', {
          font: style.typography.bodyFont,
          weight: 700,
          size: 14,
          color: style.palette.accent,
          letterSpacing: '0.12em',
        }),

        // Decorative quote mark
        text('“', {
          font: style.typography.headingFont,
          weight: 800,
          size: 72,
          color: style.palette.accent,
          lineHeight: 0.6,
        }),

        // Prominent quote
        text(`“${quoteText}”`, {
          font: style.typography.headingFont,
          weight: 600,
          size: Math.max(32, style.typography.titleSize - 18),
          color: style.palette.title,
          align: 'center',
          lineHeight: 1.25,
        }),

        // Subtitle attribution
        content.subtitle || content.tagline
          ? text(`— ${content.subtitle || content.tagline}`, {
              font: style.typography.bodyFont,
              weight: 500,
              size: 18,
              color: style.palette.text,
              align: 'center',
            })
          : null,

        divider({ color: style.palette.accent, thickness: 2, width: 200 }),

        // Facts row
        row({ gap: 16, justify: 'center' }, [
          content.date ? text(`📅 ${content.date}`, { font: style.typography.bodyFont, weight: 600, size: 16, color: style.palette.title }) : null,
          content.time ? text(`⏰ ${content.time}`, { font: style.typography.bodyFont, weight: 500, size: 16, color: style.palette.text }) : null,
          content.venue ? text(`📍 ${content.venue}`, { font: style.typography.bodyFont, weight: 500, size: 16, color: style.palette.text }) : null,
        ]),

        // CTA
        ctaVal
          ? stack(
              {
                padding: { x: 32, y: 12 },
                shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
              },
              [
                text(String(ctaVal), {
                  font: style.typography.bodyFont,
                  weight: 700,
                  size: style.typography.ctaSize,
                  color: style.palette.contrastTextOnBand,
                }),
              ]
            )
          : null,
      ]);
    },
  },

  'banner-stack': {
    id: 'banner-stack',
    label: 'Banner Stack',
    suits: ['sports_day', 'temple_festival', 'blood_camp', 'general', 'meeting'],
    needsPhoto: false,
    recipeVersion: RECIPE_VERSION,
    slots: [
      { id: 'title', label: 'Title', priority: SLOT_PRIORITY.P1_TITLE, min: 3, max: 60 },
      { id: 'subtitle', label: 'Subtitle', priority: SLOT_PRIORITY.P2_SUBTITLE, min: 0, max: 80 },
      { id: 'date', label: 'Date', priority: SLOT_PRIORITY.P2_DATE, min: 0, max: 30 },
      { id: 'time', label: 'Time', priority: SLOT_PRIORITY.P3_TIME, min: 0, max: 25 },
      { id: 'venue', label: 'Venue', priority: SLOT_PRIORITY.P2_VENUE, min: 0, max: 80 },
      { id: 'details', label: 'Details', priority: SLOT_PRIORITY.P3_DETAILS, min: 0, max: 160 },
      { id: 'cta', label: 'Call to Action', priority: SLOT_PRIORITY.P3_CTA, min: 0, max: 40 },
    ],
    tree(content, style) {
      const ctaVal = typeof content.cta === 'object' ? content.cta?.button || content.cta?.line : content.cta;

      return stack({ gap: 14, padding: style.geometry.spacing, justify: 'start' }, [
        // Banner 1: Kicker
        stack(
          {
            padding: { x: 16, y: 8 },
            shape: { type: 'rounded-rect', fill: '#f1f5f9', radius: 4 },
            align: 'start',
          },
          [
            text('COMMUNITY BULLETIN', {
              font: style.typography.bodyFont,
              weight: 700,
              size: 13,
              color: style.palette.accent,
              letterSpacing: '0.08em',
            }),
          ]
        ),

        // Banner 2: Headline
        stack(
          {
            padding: { x: 20, y: 16 },
            shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
            gap: 6,
          },
          [
            text(content.title || 'Stacked Banner Headline', {
              font: style.typography.headingFont,
              weight: style.typography.headingWeight,
              size: style.typography.titleSize,
              color: style.palette.title,
              uppercase: style.typography.uppercase,
              lineHeight: 1.15,
            }),
            content.subtitle || content.tagline
              ? text(content.subtitle || content.tagline, {
                  font: style.typography.bodyFont,
                  weight: style.typography.subtitleWeight,
                  size: style.typography.subtitleSize,
                  color: style.palette.text,
                })
              : null,
          ]
        ),

        // Banner 3: Date & Time strip
        stack(
          {
            padding: { x: 20, y: 14 },
            shape: { type: 'rounded-rect', fill: style.palette.band, radius: style.geometry.radius },
          },
          [
            row({ justify: 'space-between', align: 'center', width: 'fill' }, [
              content.date
                ? text(`📅 ${content.date}`, {
                    font: style.typography.bodyFont,
                    weight: 700,
                    size: 18,
                    color: style.palette.contrastTextOnBand,
                  })
                : null,
              content.time
                ? text(`⏰ ${content.time}`, {
                    font: style.typography.bodyFont,
                    weight: 600,
                    size: 16,
                    color: style.palette.contrastTextOnBand,
                  })
                : null,
            ]),
          ]
        ),

        // Banner 4: Venue & Highlights
        stack(
          {
            padding: { x: 20, y: 14 },
            shape: { type: 'rounded-rect', fill: '#f8fafc', stroke: '#e2e8f0', strokeWidth: 1, radius: style.geometry.radius },
            gap: 8,
          },
          [
            content.venue
              ? text(`📍 Location: ${content.venue}`, { font: style.typography.bodyFont, weight: 600, size: 16, color: style.palette.title })
              : null,
            content.details
              ? text(Array.isArray(content.details) ? content.details.join(' • ') : String(content.details), {
                  font: style.typography.bodyFont,
                  weight: 500,
                  size: 15,
                  color: style.palette.text,
                })
              : null,
          ]
        ),

        // Banner 5: CTA Ribbon
        ctaVal
          ? stack(
              {
                padding: { x: 24, y: 12 },
                shape: { type: 'rounded-rect', fill: style.palette.accent, radius: style.geometry.radius },
                align: 'center',
              },
              [
                text(String(ctaVal), {
                  font: style.typography.bodyFont,
                  weight: 700,
                  size: style.typography.ctaSize,
                  color: '#ffffff',
                  uppercase: true,
                }),
              ]
            )
          : null,
      ]);
    },
  },
};

/* =========================================================================
 * CONTRAST & GEOMETRY ENFORCEMENT (All text >= 4.5:1)
 * ========================================================================= */

/**
 * Ensures all text elements pass WCAG AA contrast (>= 4.5:1) against their backing color.
 */
export function ensureTextContrast(elements, brandKit, defaultBg = '#ffffff') {
  if (!Array.isArray(elements)) return [];
  const resolvedBg = resolveColorToken('brand:background', brandKit) || defaultBg;

  // Find all shape backdrops
  const shapes = elements.filter((el) => el.kind === 'shape');

  return elements.map((el) => {
    if (el.kind !== 'text' || !el.style) return el;

    // Determine backing fill
    let backingColor = resolvedBg;
    for (const sh of shapes) {
      if (
        el.x >= sh.x - 2 &&
        el.y >= sh.y - 2 &&
        el.x + el.w <= sh.x + sh.w + 4 &&
        el.y + el.h <= sh.y + sh.h + 4
      ) {
        const fillToken = sh.shape?.fill || sh.fill || sh.style?.backgroundColor;
        if (fillToken && fillToken !== 'transparent') {
          backingColor = resolveColorToken(fillToken, brandKit) || fillToken;
        }
      }
    }

    const currentTextCol = resolveColorToken(el.style.color, brandKit) || el.style.color || '#111827';
    const ratio = contrastRatio(currentTextCol, backingColor);

    if (ratio < 4.5) {
      // Pick best contrast replacement
      const safeColor = readableColorOn(backingColor, ['#111827', '#ffffff', '#1e293b', '#0f172a'], 4.5);
      return {
        ...el,
        style: {
          ...el.style,
          color: safeColor || (contrastRatio('#ffffff', backingColor) > contrastRatio('#111827', backingColor) ? '#ffffff' : '#111827'),
        },
      };
    }

    return el;
  });
}

/**
 * Builds a complete poster for an archetype and style combination.
 */
export function buildArchetypePoster({
  archetypeId,
  styleId,
  content = {},
  brandKit = null,
  templateSize = { width: 1080, height: 1350 },
} = {}) {
  const archetype = ARCHETYPES[archetypeId] || ARCHETYPES['hero-photo-top'];
  const style = STYLES[styleId] || STYLES.bold;

  const kit = brandKit || {
    colors: {
      primary: '#2563eb',
      secondary: '#1e293b',
      accent: '#d97706',
      text: '#111827',
      background: '#ffffff',
    },
    fonts: { heading: 'Outfit', body: 'Inter' },
  };

  const tplDummy = { size: templateSize, editorVersion: 2 };
  const rawArea = contentArea(kit, tplDummy);

  // 1. Generate node tree from archetype
  const tree = archetype.tree(content, style, { contentArea: rawArea, brandKit: kit });

  // 2. Run deterministic layout engine
  const layoutElements = layout(tree, {
    contentArea: rawArea,
    brandKit: kit,
    size: templateSize,
    margin: 0,
  });

  // 3. Add style decorations (opacity <= 0.08)
  const rawDecors = typeof style.getDecorations === 'function' ? style.getDecorations(rawArea, style, kit) : [];
  const decors = rawDecors.map((d) => {
    const cl = clampRectToArea({ x: d.x, y: d.y, w: d.w, h: d.h }, rawArea);
    return { ...d, x: cl.x, y: cl.y, w: cl.w, h: cl.h };
  });

  // Combine and enforce WCAG contrast (>= 4.5:1)
  const combined = [...decors, ...layoutElements];
  const finalElements = ensureTextContrast(combined, kit);

  // Geometry checks
  const geometryWarnings = [];
  finalElements.forEach((el, idx) => {
    if (el.x < rawArea.x - 2 || el.y < rawArea.y - 2) {
      geometryWarnings.push(`Element #${idx} (${el.kind}) starts outside contentArea (${el.x}, ${el.y})`);
    }
    if (el.x + el.w > rawArea.x + rawArea.w + 2 || el.y + el.h > rawArea.y + rawArea.h + 2) {
      geometryWarnings.push(`Element #${idx} (${el.kind}) exceeds contentArea bounds`);
    }
    if (el.kind === 'text' && el.style?.fontSize && el.style.fontSize < 12) {
      geometryWarnings.push(`Element #${idx} text size too small: ${el.style.fontSize}px`);
    }
  });

  // Contrast checks
  const contrastWarnings = [];
  finalElements.forEach((el, idx) => {
    if (el.kind === 'text' && el.style?.color) {
      const textColor = resolveColorToken(el.style.color, kit) || el.style.color;
      const ratio = contrastRatio(textColor, kit.colors?.background || '#ffffff');
      if (ratio < 4.5) {
        contrastWarnings.push(`Element #${idx} text contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
      }
    }
  });

  const template = {
    id: `archetype-${archetype.id}-${style.id}`,
    name: `${archetype.label} (${style.label})`,
    editorVersion: 2,
    version: 1,
    size: templateSize,
    zones: [],
    archetype: archetype.id,
    style: style.id,
    elements: finalElements,
  };

  return {
    template,
    elements: finalElements,
    archetype,
    style,
    contentArea: rawArea,
    geometryWarnings,
    contrastWarnings,
  };
}

function stringHash(str) {
  let hash = 5381;
  const s = String(str || '');
  for (let i = 0; i < s.length; i++) {
    hash = ((hash << 5) + hash) + s.charCodeAt(i);
    hash = hash & hash;
  }
  return Math.abs(hash);
}

function lcgRandom(seed) {
  let s = (seed === 0 ? 1 : seed) >>> 0;
  return function () {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Deterministically selects count distinct designs (archetype + style)
 * via seeded hash.
 */
export function selectArchetypeOptions({
  count = 1,
  seed = 42,
  seedCounter = 0,
  avoidRecipeIds = [],
  prompt = '',
} = {}) {
  const numCount = Math.max(1, Math.min(12, Math.floor(Number(count) || 1)));
  const counter = Math.max(0, Math.floor(Number(seedCounter) || 0));
  const baseSeedNum = typeof seed === 'number' ? seed : stringHash(String(seed));
  const promptSeed = stringHash(String(prompt || '').trim());

  // Deterministic seed combining seed, prompt, and seedCounter
  const combinedSeed = (baseSeedNum ^ promptSeed ^ (counter * 2654435761)) >>> 0;
  const rng = lcgRandom(combinedSeed);

  const avoidSet = new Set(
    (Array.isArray(avoidRecipeIds) ? avoidRecipeIds : [])
      .map((id) => String(id || '').trim().toLowerCase())
  );

  // Split available archetypes into preferred (not avoided) and avoided
  const preferredArchetypes = ARCHETYPE_IDS.filter((id) => !avoidSet.has(id.toLowerCase()));
  const avoidedArchetypes = ARCHETYPE_IDS.filter((id) => avoidSet.has(id.toLowerCase()));

  function shuffle(arr, r) {
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  const shuffledPreferred = shuffle(preferredArchetypes, rng);
  const shuffledAvoided = shuffle(avoidedArchetypes, rng);
  const poolArchetypes = [...shuffledPreferred, ...shuffledAvoided];

  const shuffledStyles = shuffle(STYLE_IDS, rng);

  const options = [];
  const usedPairs = new Set();
  const usedArchetypes = new Set();
  const usedStyles = new Set();

  for (let i = 0; i < numCount; i++) {
    // 1. Pick archetype: prefer unused archetype in this batch
    let archId = null;
    for (const a of poolArchetypes) {
      if (!usedArchetypes.has(a)) {
        archId = a;
        break;
      }
    }
    if (!archId) {
      archId = poolArchetypes[i % poolArchetypes.length];
    }
    usedArchetypes.add(archId);

    // 2. Pick style: prefer unused style in this batch
    let styleId = null;
    for (const s of shuffledStyles) {
      if (!usedStyles.has(s) && !usedPairs.has(`${archId}:${s}`)) {
        styleId = s;
        break;
      }
    }
    if (!styleId) {
      for (const s of shuffledStyles) {
        if (!usedPairs.has(`${archId}:${s}`)) {
          styleId = s;
          break;
        }
      }
    }
    if (!styleId) {
      styleId = shuffledStyles[i % shuffledStyles.length];
    }
    usedStyles.add(styleId);

    const pairKey = `${archId}:${styleId}`;
    usedPairs.add(pairKey);

    options.push({ archetypeId: archId, styleId });
  }

  return options;
}

export default {
  ARCHETYPE_IDS,
  ARCHETYPES,
  STYLE_IDS,
  STYLES,
  RECIPE_VERSION,
  buildArchetypePoster,
  ensureTextContrast,
  selectArchetypeOptions,
};

