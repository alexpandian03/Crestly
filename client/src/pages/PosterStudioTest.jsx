import React, { useState, useEffect } from 'react';
import {
  Palette,
  Sparkles,
  Sliders,
  Type,
  Layout,
  AlertTriangle,
  RotateCcw,
  CheckCircle,
  Eye,
  Calendar,
  MapPin,
  Clock,
  Layers,
} from 'lucide-react';
import api from '../services/api';
import PosterPreview from '../components/PosterPreview';
import PosterExportButtons from '../components/PosterExportButtons';
import PosterImageInput from '../components/PosterImageInput';
import { resolvePosterBrand, PATTERN_OPACITY_MAX } from '../utils/brandRender';
import {
  readableItems,
  templateElements,
  usesTemplateElements,
} from '../utils/templateRender';
import { contrastLabel } from '../utils/contrast';
import { TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';
import {
  DESIGN_RECIPES,
  RECIPE_PALETTES,
  RECIPE_VARIANTS,
  buildElements,
} from '../../../shared/designRecipes.js';
import { iconForCategory } from '../../../shared/templateElements.js';

/** Small inline marks so the dev page needs no uploaded assets. */
const logoMark = (bg, fg, letter) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">` +
      `<rect width="140" height="140" rx="30" fill="${bg}"/>` +
      `<text x="70" y="96" font-family="Helvetica,Arial,sans-serif" font-size="76" font-weight="700" fill="${fg}" text-anchor="middle">${letter}</text>` +
      `</svg>`
  );

const styleText = (over = {}) => ({
  fontFamily: 'Inter',
  size: 16,
  weight: 400,
  color: '#e2e8f0',
  uppercase: false,
  letterSpacing: 0,
  ...over,
});

const bgPlate = (over = {}) => ({
  type: 'color',
  color: '#0b1220',
  gradientFrom: '#059669',
  gradientTo: '#0f172a',
  gradientAngle: 135,
  imageUrl: '',
  overlayColor: '#0b0f17',
  overlayOpacity: 0.4,
  ...over,
});

/** Four locked brands, each pushing a different set of style blocks. */
const SAMPLE_BRANDS = [
  {
    id: 'professional',
    label: 'Professional',
    kit: {
      preset: 'professional',
      orgName: 'Northbridge Capital',
      logos: [{ url: logoMark('#1d4ed8', '#ffffff', 'N'), isPrimary: true }],
      colors: { primary: '#1d4ed8', secondary: '#0f172a', accent: '#38bdf8', text: '#ffffff', background: '#0b1220' },
      fonts: { heading: 'Playfair Display', body: 'Inter' },
      background: bgPlate({ color: '#0b1220' }),
      header: {
        height: 112,
        alignment: 'left',
        background: bgPlate({ type: 'gradient', gradientFrom: '#0f172a', gradientTo: '#1d4ed8', gradientAngle: 105 }),
        logo: { show: true, size: 62, position: 'left' },
        orgName: { show: true, text: 'Northbridge Capital', style: styleText({ fontFamily: 'Playfair Display', size: 30, weight: 700, color: '#ffffff' }) },
        tagline: { show: true, text: 'Advising institutions since 1998', style: styleText({ size: 14, weight: 400, color: '#bfdbfe', letterSpacing: 2 }) },
        border: { show: true, color: '#38bdf8', thickness: 3 },
      },
      content: {
        background: bgPlate({ color: '#0b1220' }),
        decoration: 'corners',
        decorationColor: '#38bdf8',
        watermark: { show: false, opacity: 0.08 },
        headingColor: '#ffffff',
        bodyColor: '#cbd5e1',
        accentColor: '#7dd3fc',
        headingFont: 'Playfair Display',
        bodyFont: 'Inter',
        infoCard: { background: '#0f1a2e', border: '#1e3a8a', radius: 18, iconColor: '#7dd3fc' },
        defaultImageUrl: '',
      },
      footer: {
        height: 124,
        layout: 2,
        background: bgPlate({ color: '#060b16' }),
        address: '1 Harbour Square, London',
        phone: '+44 20 7946 0102',
        email: 'events@northbridge.example',
        website: 'northbridge.example',
        social: [
          { platform: 'linkedin', url: 'https://linkedin.com/company/northbridge' },
          { platform: 'x', url: 'https://x.com/northbridge' },
        ],
        legalText: '© 2026 Northbridge Capital. Authorised and regulated.',
        style: styleText({ size: 14, weight: 400, color: '#dbeafe' }),
        linkColor: '#7dd3fc',
        divider: { show: true, color: '#1e3a8a', thickness: 2 },
      },
    },
  },
  {
    id: 'bold',
    label: 'Bold',
    kit: {
      preset: 'bold',
      orgName: 'IRONFORGE GAMES',
      logos: [{ url: logoMark('#facc15', '#1c1917', 'I'), isPrimary: true }],
      colors: { primary: '#f97316', secondary: '#1c1917', accent: '#facc15', text: '#fff7ed', background: '#1c1917' },
      fonts: { heading: 'Montserrat', body: 'Roboto' },
      background: bgPlate({ type: 'gradient', gradientFrom: '#1c1917', gradientTo: '#7c2d12', gradientAngle: 45 }),
      header: {
        height: 150,
        alignment: 'right',
        background: bgPlate({
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=1200&q=80&auto=format&fit=crop',
          overlayColor: '#000000',
          overlayOpacity: 0.55,
        }),
        logo: { show: true, size: 74, position: 'left' },
        orgName: { show: true, text: 'IRONFORGE GAMES', style: styleText({ fontFamily: 'Montserrat', size: 34, weight: 700, color: '#facc15', uppercase: true, letterSpacing: 3 }) },
        tagline: { show: true, text: 'Level up together', style: styleText({ fontFamily: 'Roboto', size: 15, weight: 500, color: '#fed7aa', uppercase: true, letterSpacing: 4 }) },
        border: { show: true, color: '#facc15', thickness: 8 },
      },
      content: {
        background: bgPlate({ color: '#1c1917' }),
        decoration: 'band',
        decorationColor: '#f97316',
        watermark: { show: false, opacity: 0.1 },
        headingColor: '#fff7ed',
        bodyColor: '#fdba74',
        accentColor: '#facc15',
        headingFont: 'Montserrat',
        bodyFont: 'Roboto',
        infoCard: { background: 'rgba(0, 0, 0, 0.45)', border: '#facc15', radius: 4, iconColor: '#facc15' },
        defaultImageUrl: '',
      },
      footer: {
        height: 96,
        layout: 1,
        background: bgPlate({ type: 'gradient', gradientFrom: '#f97316', gradientTo: '#ef4444', gradientAngle: 90 }),
        address: '',
        phone: '',
        email: '',
        website: 'ironforge.games',
        social: [
          { platform: 'instagram', url: 'https://instagram.com/ironforge' },
          { platform: 'youtube', url: 'https://youtube.com/@ironforge' },
          { platform: 'x', url: 'https://x.com/ironforge' },
        ],
        legalText: '© 2026 Ironforge Games',
        style: styleText({ fontFamily: 'Montserrat', size: 15, weight: 600, color: '#1c1917', uppercase: true, letterSpacing: 1 }),
        linkColor: '#1c1917',
        divider: { show: true, color: '#1c1917', thickness: 4 },
      },
    },
  },
  {
    id: 'minimal',
    label: 'Minimal',
    kit: {
      preset: 'minimal',
      orgName: 'Atelier Nord',
      logos: [{ url: logoMark('#0f172a', '#ffffff', 'A'), isPrimary: true }],
      colors: { primary: '#0f172a', secondary: '#64748b', accent: '#0f172a', text: '#0f172a', background: '#ffffff' },
      fonts: { heading: 'DM Sans', body: 'Lato' },
      textStyle: { fontFamily: 'DM Sans', size: 22, weight: 500, color: '#0f172a', uppercase: false, letterSpacing: 0 },
      background: bgPlate({ type: 'color', color: '#ffffff' }),
      header: {
        height: 92,
        alignment: 'center',
        background: bgPlate({ color: '#ffffff' }),
        logo: { show: true, size: 44, position: 'top' },
        orgName: { show: true, text: 'Atelier Nord', style: styleText({ fontFamily: 'DM Sans', size: 26, weight: 600, color: '#0f172a', uppercase: true, letterSpacing: 6 }) },
        tagline: { show: false, text: '', style: styleText({ size: 13, weight: 400, color: '#64748b', letterSpacing: 2 }) },
        border: { show: true, color: '#e2e8f0', thickness: 1 },
      },
      content: {
        background: { ...bgPlate({ color: '#ffffff' }), type: 'pattern', pattern: 'lines', fit: 'cover', position: 'center' },
        decoration: 'none',
        decorationColor: '#0f172a',
        watermark: { show: false, opacity: 0.05 },
        headingColor: '#0f172a',
        bodyColor: '#475569',
        accentColor: '#0f172a',
        headingFont: 'DM Sans',
        bodyFont: 'Lato',
        infoCard: { background: '#f8fafc', border: '#e2e8f0', radius: 8, iconColor: '#0f172a' },
        defaultImageUrl: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?w=1200&q=80&auto=format&fit=crop',
      },
      footer: {
        height: 84,
        layout: 3,
        background: bgPlate({ color: '#ffffff' }),
        address: 'Skogveien 4, Oslo',
        phone: '',
        email: 'hello@ateliernord.example',
        website: 'ateliernord.example',
        social: [],
        legalText: '© 2026 Atelier Nord',
        style: styleText({ fontFamily: 'Lato', size: 13, weight: 400, color: '#64748b', letterSpacing: 1 }),
        linkColor: '#0f172a',
        divider: { show: true, color: '#e2e8f0', thickness: 1 },
      },
    },
  },
  {
    id: 'festival',
    label: 'Festival',
    kit: {
      preset: 'festival',
      orgName: 'Solstice Fest',
      logos: [{ url: logoMark('#fbbf24', '#7c2d12', 'S'), isPrimary: true }],
      colors: { primary: '#f43f5e', secondary: '#a855f7', accent: '#fbbf24', text: '#fff7ed', background: '#2e1065' },
      fonts: { heading: 'Poppins', body: 'Nunito' },
      background: bgPlate({ type: 'gradient', gradientFrom: '#2e1065', gradientTo: '#831843', gradientAngle: 160 }),
      header: {
        height: 130,
        alignment: 'center',
        background: bgPlate({ type: 'gradient', gradientFrom: '#f43f5e', gradientTo: '#a855f7', gradientAngle: 80 }),
        logo: { show: true, size: 66, position: 'bottom' },
        orgName: { show: true, text: 'Solstice Fest', style: styleText({ fontFamily: 'Poppins', size: 32, weight: 700, color: '#fff7ed', uppercase: true, letterSpacing: 2 }) },
        tagline: { show: true, text: 'Three days of music under the midnight sun', style: styleText({ fontFamily: 'Nunito', size: 15, weight: 500, color: '#ffe4e6' }) },
        border: { show: true, color: '#fbbf24', thickness: 5 },
      },
      content: {
        background: bgPlate({
          type: 'image',
          imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=1600&q=80&auto=format&fit=crop',
          overlayColor: '#312e81',
          overlayOpacity: 0.62,
          fit: 'cover',
          position: 'center',
          pattern: 'none',
        }),
        decoration: 'circle',
        decorationColor: '#fbbf24',
        watermark: { show: true, opacity: 0.18 },
        headingColor: '#fef3c7',
        bodyColor: '#e0e7ff',
        accentColor: '#fbbf24',
        headingFont: 'Poppins',
        bodyFont: 'Nunito',
        infoCard: { background: 'rgba(49, 46, 129, 0.6)', border: '#fbbf24', radius: 24, iconColor: '#fbbf24' },
        defaultImageUrl: '',
      },
      footer: {
        height: 150,
        layout: 3,
        background: bgPlate({ color: '#1e1b4b' }),
        address: 'Harbour Fields, Tromsø',
        phone: '+47 77 60 00',
        email: 'info@solsticefest.example',
        website: 'solsticefest.example',
        social: [
          { platform: 'facebook', url: 'https://facebook.com/solsticefest' },
          { platform: 'instagram', url: 'https://instagram.com/solsticefest' },
          { platform: 'whatsapp', url: 'https://wa.me/47776000' },
        ],
        legalText: '© 2026 Solstice Fest. Drink responsibly.',
        style: styleText({ fontFamily: 'Nunito', size: 14, weight: 500, color: '#e0e7ff' }),
        linkColor: '#fbbf24',
        divider: { show: true, color: '#fbbf24', thickness: 3 },
      },
    },
  },
];

const SAMPLE_CONTENTS = {
  professional: {
    title: 'Annual Investment Briefing',
    tagline: 'Markets, policy and positioning',
    date: 'Tuesday, 18 November 2026',
    time: '08:30 – 16:00 GMT',
    venue: 'Northbridge Hall, London',
    details: [
      'Keynote from the Group Chief Economist',
      'Fixed income and private credit outlook',
      'Closed-door sessions for institutional clients',
    ],
    imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&q=80&auto=format&fit=crop',
  },
  bold: {
    title: 'IRONFORGE SHOWDOWN',
    tagline: '64 teams. One arena.',
    date: 'SAT 6 DEC',
    time: 'Doors 18:00',
    venue: 'Titan Arena',
    details: ['Live finals', 'Merch drop', 'Pro meet & greet'],
    imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=900&q=80&auto=format&fit=crop',
  },
  minimal: {
    title: 'Quiet Forms',
    tagline: 'A furniture retrospective',
    date: '12 Sep – 30 Oct',
    time: '',
    venue: 'Gallery 2',
    details: ['Free entry'],
    // no photo: the brand's default photo is used
    imageUrl: '',
  },
  festival: {
    title: 'Solstice Fest 2026',
    tagline: 'Music under the midnight sun',
    date: '21–23 June 2026',
    time: '12:00 – 02:00',
    venue: 'Harbour Fields, Tromsø',
    details: ['40 artists across 4 stages', 'Arctic food market', 'Campus cabins available'],
    imageUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900&q=80&auto=format&fit=crop',
  },
};

const SAMPLE_CONTENT = {
  title: 'Autonomous AI & Cloud Architecture Summit 2026',
  tagline: 'The Future of Scalable Intelligence',
  date: 'Thursday, November 12, 2026',
  time: '09:00 AM - 05:00 PM EST',
  venue: 'Metropolitan Tech Pavilion, San Francisco, CA',
  details:
    'Join 2,500+ software architects, engineers, and machine learning researchers for a full day of keynotes, technical deep dives, and live enterprise technology showcases.',
  image: 'https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=1000&q=80',
};

const DEFAULT_BRAND_KIT = {
  orgName: 'Acme Corporation',
  logos: [],
  colors: {
    primary: '#059669',
    secondary: '#0f172a',
    accent: '#10b981',
    text: '#ffffff',
    background: '#0b0f17',
  },
  fonts: {
    heading: 'Outfit',
    body: 'Inter',
  },
  header: {
    height: 140,
    background: 'rgba(15, 23, 42, 0.95)',
    alignment: 'left',
    showLogo: true,
    showOrgName: true,
  },
  footer: {
    height: 130,
    background: 'rgba(11, 15, 23, 0.98)',
    contactText: '+1 (800) 555-ACME',
    website: 'www.acmeposters.com',
    socials: ['@acme_corp', 'linkedin.com/company/acme'],
    legalText: '© 2026 Acme Corp. All rights reserved.',
  },
};

const DEFAULT_TEMPLATE = {
  name: 'Standard Event Poster',
  size: { width: 1080, height: 1350 },
  zones: [
    { id: 'zone-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
    { id: 'zone-content', type: 'content', x: 70, y: 170, w: 940, h: 640, locked: false, minFont: 16, maxFont: 54 },
    { id: 'zone-image', type: 'image', x: 70, y: 830, w: 940, h: 370, locked: false },
    { id: 'zone-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
  ],
};

/**
 * Four template layouts rendering the SAME content, so zone rectangles,
 * placement, spacing, info style, decoration and the min/max font window can
 * be compared side by side.
 */
const LAYOUT_SAMPLE_IMAGE =
  'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900&q=80&auto=format&fit=crop';

const LAYOUT_SAMPLES = [
  {
    id: 'band-bottom',
    label: '1 · Left, normal gaps, photo as its own band, info card',
    note: 'content 70,170 940×600 · photo 70,800 940×400 (outside the text area) · 16–54',
    template: {
      name: 'Layout sample 1',
      category: 'Event',
      size: { width: 1080, height: 1350 },
      zones: [
        { id: 's1-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
        { id: 's1-content', type: 'content', x: 70, y: 170, w: 940, h: 600, locked: false, minFont: 16, maxFont: 54 },
        { id: 's1-image', type: 'image', x: 70, y: 800, w: 940, h: 400, locked: false },
        { id: 's1-footer', type: 'footer', x: 0, y: 1220, w: 1080, h: 130, locked: true },
      ],
      layout: {
        alignment: 'left',
        spacing: 'normal',
        imagePlacement: 'middle',
        infoStyle: 'card',
        decoration: 'none',
      },
    },
  },
  {
    id: 'inside-column',
    label: '2 · Centered, relaxed gaps, photo inside the text, stacked info',
    note: 'content 70,170 940×1010 · photo 70,760 940×340 (inside) · band shape · 14–44',
    template: {
      name: 'Layout sample 2',
      category: 'Festival',
      size: { width: 1080, height: 1350 },
      zones: [
        { id: 's2-header', type: 'header', x: 0, y: 0, w: 1080, h: 140, locked: true },
        { id: 's2-content', type: 'content', x: 70, y: 170, w: 940, h: 1010, locked: false, minFont: 14, maxFont: 44 },
        { id: 's2-image', type: 'image', x: 70, y: 760, w: 940, h: 340, locked: false },
        { id: 's2-footer', type: 'footer', x: 0, y: 1210, w: 1080, h: 140, locked: true },
      ],
      layout: {
        alignment: 'center',
        spacing: 'relaxed',
        imagePlacement: 'middle',
        infoStyle: 'stacked',
        decoration: 'band',
      },
    },
  },
  {
    id: 'narrow-top',
    label: '3 · Narrow column, compact gaps, photo on top, inline info',
    note: 'content 130,520 680×660 · photo 130,180 680×300 (top) · circle shape · 12–32',
    template: {
      name: 'Layout sample 3',
      category: 'Notice',
      size: { width: 1080, height: 1350 },
      zones: [
        { id: 's3-header', type: 'header', x: 0, y: 0, w: 1080, h: 150, locked: true },
        { id: 's3-image', type: 'image', x: 130, y: 180, w: 680, h: 300, locked: false },
        { id: 's3-content', type: 'content', x: 130, y: 520, w: 680, h: 660, locked: false, minFont: 12, maxFont: 32 },
        { id: 's3-footer', type: 'footer', x: 0, y: 1230, w: 1080, h: 120, locked: true },
      ],
      layout: {
        alignment: 'left',
        spacing: 'compact',
        imagePlacement: 'top',
        infoStyle: 'inline',
        decoration: 'circle',
      },
    },
  },
  {
    id: 'landscape-wide',
    label: '4 · Landscape, no photo area, centered info card',
    note: 'content 90,150 1740×780 · wide zone splits into two lanes · 18–64',
    template: {
      name: 'Layout sample 4',
      category: 'Awareness',
      size: { width: 1920, height: 1080 },
      zones: [
        { id: 's4-header', type: 'header', x: 0, y: 0, w: 1920, h: 130, locked: true },
        { id: 's4-content', type: 'content', x: 90, y: 150, w: 1740, h: 780, locked: false, minFont: 18, maxFont: 64 },
        { id: 's4-footer', type: 'footer', x: 0, y: 950, w: 1920, h: 130, locked: true },
      ],
      layout: {
        alignment: 'center',
        spacing: 'normal',
        imagePlacement: 'none',
        infoStyle: 'card',
        decoration: 'none',
      },
    },
  },
];

/**
 * The look these item samples assume: a dark content surface with light ink, so every
 * colour an item carries can be read next to the brand bands.
 */
const ITEM_SAMPLE_KIT = SAMPLE_BRANDS.find((brand) => brand.id === 'professional')?.kit || DEFAULT_BRAND_KIT;

/** One template, placed by the editor: 10 items of every kind inside the brand's own strip. */
const ITEM_SAMPLE_TEMPLATE = {
  name: 'Item placement sample',
  category: 'Event',
  size: { width: 1080, height: 1350 },
  zones: [
    { id: 'it-header', type: 'header', x: 0, y: 0, w: 1080, h: 112, locked: true },
    { id: 'it-content', type: 'content', x: 60, y: 140, w: 960, h: 1050, locked: false, minFont: 14, maxFont: 64 },
    { id: 'it-image', type: 'image', x: 60, y: 390, w: 640, h: 330, locked: false },
    { id: 'it-footer', type: 'footer', x: 0, y: 1226, w: 1080, h: 124, locked: true },
  ],
  layout: { alignment: 'left', spacing: 'normal', imagePlacement: 'middle', infoStyle: 'stacked', decoration: 'none' },
  editorVersion: 2,
  elements: [
    {
      id: 'it-headline',
      kind: 'field',
      field: 'headline',
      x: 60,
      y: 150,
      w: 960,
      h: 170,
      z: 4,
      style: {
        fontFamily: 'Playfair Display',
        size: 72,
        minSize: 30,
        weight: 700,
        color: '#ffffff',
        align: 'left',
        lineHeight: 1.05,
      },
    },
    {
      id: 'it-tagline',
      kind: 'field',
      field: 'tagline',
      x: 60,
      y: 330,
      w: 960,
      h: 40,
      z: 4,
      style: {
        fontFamily: 'Inter',
        size: 22,
        minSize: 14,
        weight: 600,
        color: '#7dd3fc',
        uppercase: true,
        letterSpacing: 4,
      },
    },
    { id: 'it-photo', kind: 'field', field: 'photo', x: 60, y: 390, w: 640, h: 330, z: 2, style: { fit: 'cover', radius: 18 } },
    {
      id: 'it-poster-static',
      kind: 'image',
      x: 720,
      y: 390,
      w: 300,
      h: 330,
      z: 3,
      imageUrl: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=600&q=80&auto=format&fit=crop',
      style: { fit: 'cover', radius: 18 },
    },
    {
      id: 'it-rule',
      kind: 'shape',
      x: 60,
      y: 745,
      w: 960,
      h: 6,
      z: 5,
      shape: { type: 'line', stroke: '#38bdf8', strokeWidth: 3 },
    },
    {
      id: 'it-date',
      kind: 'field',
      field: 'date',
      x: 60,
      y: 775,
      w: 480,
      h: 60,
      z: 4,
      style: { fontFamily: 'Inter', size: 28, minSize: 16, weight: 600, color: '#ffffff', showIcon: true, showLabel: true },
    },
    {
      id: 'it-time',
      kind: 'field',
      field: 'time',
      x: 540,
      y: 775,
      w: 480,
      h: 60,
      z: 4,
      style: { fontFamily: 'Inter', size: 28, minSize: 16, weight: 600, color: '#ffffff', showIcon: true, showLabel: true },
    },
    {
      id: 'it-venue',
      kind: 'field',
      field: 'venue',
      x: 60,
      y: 845,
      w: 960,
      h: 60,
      z: 4,
      style: { fontFamily: 'Inter', size: 26, minSize: 15, weight: 500, color: '#e2e8f0', showIcon: true, showLabel: false },
    },
    {
      id: 'it-details',
      kind: 'field',
      field: 'details',
      x: 60,
      y: 915,
      w: 960,
      h: 215,
      z: 4,
      style: { fontFamily: 'Inter', size: 24, minSize: 13, weight: 400, color: '#cbd5e1', lineHeight: 1.3 },
    },
    {
      id: 'it-note',
      kind: 'text',
      text: 'Doors open one hour before the keynote',
      x: 60,
      y: 1148,
      w: 960,
      h: 40,
      z: 4,
      style: { fontFamily: 'DM Sans', size: 18, minSize: 12, weight: 400, color: '#94a3b8', align: 'center', italic: true },
    },
  ],
};

const ITEM_SAMPLE_NORMAL = {
  title: 'Annual Investment Briefing',
  tagline: 'Markets, policy and positioning',
  date: 'Tuesday, 18 November 2026',
  time: '08:30 – 16:00 GMT',
  venue: 'Northbridge Hall, London',
  details: [
    'Keynote from the Group Chief Economist',
    'Fixed income and private credit outlook',
    'Closed-door sessions for institutional clients',
  ],
  imageUrl: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?w=900&q=80&auto=format&fit=crop',
};

const ITEM_SAMPLE_LONG = {
  title:
    'Global Autonomous Mobility, Climate Finance and Enterprise AI Summit for Directors, Investors and Policy Makers',
  tagline: 'Three days of keynotes, technical deep dives, closed roundtables and live demonstrations',
  date: 'Thursday 12 November 2026 through Saturday 14 November 2026',
  time: 'Registration from 07:45, doors 08:15, keynote 09:00, evening sessions until 21:30 each day',
  venue: 'Metropolitan Tech Pavilion, Pier 48, San Francisco, California, United States of America',
  details: [
    'Twenty-four keynotes and forty breakout sessions across three stages, with simultaneous interpretation in six languages',
    'Hands-on demonstration yard with fifty vehicle and sensor partners, open to registered attendees throughout all three days',
    'Investor matchmaking desk, closed-door policy roundtables, and a published programme with full session abstracts online',
    'Dinner and awards evening on the final night, with limited seats allocated in the order that registrations are received',
  ],
  imageUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=900&q=80&auto=format&fit=crop',
};

const ITEM_SAMPLE_SPARE = {
  title: 'Neighbourhood Clean-Up Morning',
  tagline: 'Gloves and bags provided',
  date: 'Saturday, 6 December 2026',
  time: '09:30 – 12:00',
  venue: '',
  details: ['Meet at the east gate', 'Families welcome', 'Tea and cakes afterwards'],
  imageUrl: '',
};

/** Three renderings of the SAME placed items, so the word fitting is what changes. */
const ITEM_SAMPLES = [
  {
    id: 'items-normal',
    label: '1 · Placed items, ordinary words',
    note: 'headline 72 · tagline 22 · photo + a static photo · line · date and time · place · bullets · one line of text',
    content: ITEM_SAMPLE_NORMAL,
  },
  {
    id: 'items-long',
    label: '2 · The same items, very long words',
    note: 'every box shrinks its text down to its own smallest size; a note shows only when that is still not enough',
    content: ITEM_SAMPLE_LONG,
  },
  {
    id: 'items-spare',
    label: '3 · No place, no photo',
    note: 'an empty place and an empty photo draw nothing at all - no blank label, no empty box, in the poster or the file',
    content: ITEM_SAMPLE_SPARE,
  },
];

/**
 * The three word sets the designs are built with. The design itself only decides which
 * boxes exist, so a set with no place and no photo builds a design without them.
 */
const RECIPE_SIZE = { width: 1080, height: 1350 };

const RECIPE_WORDS_NORMAL = {
  title: 'Winter Science Fair',
  tagline: 'Two days of projects, prizes and open labs',
  date: 'Saturday, 14 February 2026',
  time: '10:00 – 17:00',
  venue: 'Northbridge Institute, Hall B',
  details: ['Schools from nine districts', 'Judges from the faculty', 'Free entry for families'],
  imageUrl: 'https://images.unsplash.com/photo-1532094318353-a1e32f8b7d3c?w=900&q=80&auto=format&fit=crop',
  extras: {
    title_sub: 'For schools',
    slogan_1: 'Curiosity welcome',
    slogan_2: 'Bring your questions',
    cta_line: 'Register your team before 1 February',
    cta_button: 'Sign up',
  },
};

const RECIPE_WORDS_LONG = {
  title: 'International Winter Science, Engineering And Robotics Fair For Secondary Schools',
  tagline:
    'Two full days of student projects, faculty judging, open laboratory tours, prize ceremonies and a public lecture on climate technology',
  date: 'Saturday the fourteenth and Sunday the fifteenth of February, two thousand and twenty-six',
  time: 'Ten in the morning until five in the afternoon, both days without exception',
  venue:
    'The Northbridge Institute Of Technology Main Building, Hall B On The Second Floor Beside The Central Library',
  details: [
    'Schools from nine districts are invited to bring one team of up to six students each',
    'Judging is carried out by the faculty together with engineers from partner companies',
    'Families and members of the public are welcome free of charge throughout both days',
    'Certificates and prize money are handed out at the closing ceremony on the second evening',
  ],
  imageUrl: 'https://images.unsplash.com/photo-1532094318353-a1e32f8b7d3c?w=900&q=80&auto=format&fit=crop',
  extras: {
    title_sub: 'For secondary schools in every district of the region',
    slogan_1: 'Curiosity is always welcome here',
    slogan_2: 'Bring your questions and your notebooks',
    cta_line: 'Register your team online before the first of February, two thousand twenty six',
    cta_button: 'Sign up today',
  },
};

const RECIPE_WORDS_SPARE = {
  title: 'Winter Science Fair',
  tagline: 'Two days of projects and open labs',
  date: 'Saturday, 14 February 2026',
  time: '10:00 – 17:00',
  venue: '',
  details: ['Free entry for families'],
  imageUrl: '',
  extras: {
    title_sub: 'For schools',
    slogan_1: '',
    slogan_2: '',
    cta_line: 'Register your team before 1 February',
    cta_button: '',
  },
};

const RECIPE_WORD_SETS = [
  {
    id: 'recipe-normal',
    label: 'Ordinary words',
    note: 'every part has short words, so each box shows the size the design chose',
    words: RECIPE_WORDS_NORMAL,
  },
  {
    id: 'recipe-long',
    label: 'Very long words',
    note: 'each box shrinks only its own text, down to the smallest size that box was given',
    words: RECIPE_WORDS_LONG,
  },
  {
    id: 'recipe-spare',
    label: 'No place, no photo',
    note: 'the design is built without those boxes at all, so no empty label or frame is left behind',
    words: RECIPE_WORDS_SPARE,
  },
];

/** The content the layer draws its words from: the same fields, under the names a poster uses. */
function posterContentOf(words) {
  return {
    title: words.title,
    tagline: words.tagline,
    date: words.date,
    time: words.time,
    venue: words.venue,
    details: words.details,
    imageUrl: words.imageUrl,
    extras: words.extras,
    images: {},
  };
}

/** The same words as the boxes a design is built from - only presence matters for the design. */
function recipeSlotsOf(words, icon) {
  return {
    headline: words.title,
    tagline: words.tagline,
    date: words.date,
    time: words.time,
    venue: words.venue,
    details: words.details,
    extras: words.extras,
    icon,
    /* A design never stores a photo: the picture always comes with the poster. */
    imageUrl: '',
  };
}

/** One design exactly as the server would store it, so the page tests the real shape. */
function recipeTemplateOf(design, variant, brandKit, words, palette) {
  const built = buildElements(design.id, {
    brandKit,
    size: RECIPE_SIZE,
    slots: recipeSlotsOf(words, iconForCategory(design.suits[0])),
    options: { variant, palette },
  });
  return {
    name: `${design.name} · arrangement ${variant + 1}`,
    category: 'Custom',
    size: RECIPE_SIZE,
    zones: [],
    layout: { alignment: 'left', spacing: 'normal', imagePlacement: 'none', infoStyle: 'stacked', decoration: 'none' },
    editorVersion: 2,
    version: 1,
    elements: built.elements,
    problems: built.problems,
  };
}

/**
 * The same organization with a pattern chosen for the middle of its posters. A pattern
 * is one edge-to-edge layer behind everything, so all three show the same words over
 * lines, dots or a grid that never stop at the text box.
 */
const PATTERN_KITS = ['lines', 'dots', 'grid'].map((pattern) => ({
  id: `pattern-${pattern}`,
  label: `Brand pattern · ${pattern}`,
  kit: {
    ...ITEM_SAMPLE_KIT,
    content: {
      ...ITEM_SAMPLE_KIT.content,
      background: { type: 'pattern', pattern, color: '#0b1220' },
      decoration: 'none',
      decorationColor: '#7dd3fc',
    },
  },
}));

/**
 * Two designs the assistant writes. Neither declares any areas of its own, so both
 * locked bands have to come from the brand kit alone.
 */
const BAND_CASES = ['hero', 'typographic']
  .map((id) => DESIGN_RECIPES.find((design) => design.id === id))
  .filter(Boolean)
  .map((design) => ({
    id: `bands-${design.id}`,
    label: `AI poster with header and footer · ${design.name}`,
    note: `no areas declared, ${design.needsPhoto ? 'shows the photo that came with the poster' : 'words and marks only'}`,
    design,
  }));

/** The numbers the renderer actually paints, in the words this page reports. */
function layerReadout(kit, tpl) {
  const brand = resolvePosterBrand(kit, tpl);
  return {
    header: brand.header.present ? `draws, ${brand.header.height} px from the top` : 'MISSING',
    footer: brand.footer.present
      ? `draws, ${brand.footer.height} px at ${brand.footer.top}`
      : 'MISSING',
    strip: `text area ${brand.content.y} → ${brand.content.y + brand.content.h} of ${brand.content.h} px`,
    pattern: brand.content.pattern === 'none' ? 'none' : `${brand.content.pattern} at ${Math.round(PATTERN_OPACITY_MAX * 100)}% at most`,
    patternColor: brand.content.patternColor,
    fullBleed: brand.content.bgFullBleed,
  };
}

/** Which pieces of writing the renderer recoloured to stay readable, and what it moved to. */
function contrastReport(kit, tpl) {
  if (!usesTemplateElements(tpl)) return { pieces: 0, switched: [] };
  const brand = resolvePosterBrand(kit, tpl);
  const report = readableItems(templateElements(tpl, kit), {
    surface: brand.content.surface,
    candidates: [
      brand.content.headingColor,
      brand.content.bodyColor,
      brand.content.accentColor,
      '#ffffff',
      '#0b0f17',
    ],
  });
  return { pieces: report.items.length, switched: report.switched };
}

/** Every colour the renderer had to change, and what it reads as now. */
function ContrastLines({ report, quiet = false }) {
  if (report.switched.length === 0) {
    if (quiet) return null;
    return (
      <p className="text-[10px] font-mono text-emerald-400">
        {report.pieces} pieces · every colour the design chose is readable on its own background
      </p>
    );
  }
  return (
    <ul className="text-[10px] font-mono text-sky-300 space-y-0.5">
      {report.switched.map((item) => (
        <li key={item.id}>
          {item.name}: {item.from} at {item.ratio.toFixed(2)}:1 on {item.on} → {item.to},{' '}
          {contrastLabel(item.to, item.backdrop)}
        </li>
      ))}
    </ul>
  );
}

const GOOGLE_FONTS_HEADING = [
  'Outfit',
  'Inter',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Cinzel',
];

const GOOGLE_FONTS_BODY = [
  'Inter',
  'Roboto',
  'Open Sans',
  'Lato',
  'DM Sans',
  'Nunito',
];

const FORMAT_PRESETS = [
  { id: 'portrait', label: 'Portrait 4:5', width: 1080, height: 1350 },
  { id: 'square', label: 'Square 1:1', width: 1080, height: 1080 },
  { id: 'story', label: 'Story 9:16', width: 1080, height: 1920 },
  { id: 'landscape', label: 'Landscape 16:9', width: 1920, height: 1080 },
  { id: 'a4', label: 'A4 print', width: 1240, height: 1754 },
];

/* Scale zone geometry from the base 1080×1350 template to any format. */
function scaleTemplate(template, width, height) {
  if (!template) return template;
  const base = template.size || { width: 1080, height: 1350 };
  const sw = width / (base.width || 1080);
  const sh = height / (base.height || 1350);
  return {
    ...template,
    size: { width, height },
    zones: (template.zones || []).map((z) => ({
      ...z,
      x: Math.round(z.x * sw),
      y: Math.round(z.y * sh),
      w: Math.round(z.w * sw),
      h: Math.round(z.h * sh),
    })),
  };
}

export default function PosterStudioTest() {
  const [brandKit, setBrandKit] = useState(DEFAULT_BRAND_KIT);
  const [template, setTemplate] = useState(DEFAULT_TEMPLATE);
  const [content, setContent] = useState(SAMPLE_CONTENT);
  const [loading, setLoading] = useState(true);
  const [showZoneBorders, setShowZoneBorders] = useState(false);
  const [recipePalette, setRecipePalette] = useState('brand');
  const [overflowWarning, setOverflowWarning] = useState(null);
  const [imageLoadError, setImageLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState('brand'); // 'brand' | 'content'

  // Fetch real tenant BrandKit and Template
  useEffect(() => {
    async function loadData() {
      if (!localStorage.getItem('token')) {
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        const [kitRes, tempRes] = await Promise.all([
          api.get('/brand-kit').catch(() => null),
          api.get('/templates').catch(() => null),
        ]);

        if (kitRes?.data?.success && kitRes.data?.data?.brandKit) {
          setBrandKit(kitRes.data.data.brandKit);
        }

        if (tempRes?.data?.success && tempRes.data?.data?.templates?.length > 0) {
          setTemplate(tempRes.data.data.templates[0]);
        }
      } catch (err) {
        console.warn('Using default demo assets:', err.message);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const handleColorChange = (key, val) => {
    setBrandKit((prev) => ({
      ...prev,
      colors: {
        ...prev.colors,
        [key]: val,
      },
    }));
  };

  const handleContentChange = (field, val) => {
    setContent((prev) => ({
      ...prev,
      [field]: val,
    }));
  };

  const resetColors = () => {
    setBrandKit((prev) => ({
      ...prev,
      colors: {
        primary: '#059669',
        secondary: '#0f172a',
        accent: '#10b981',
        text: '#ffffff',
        background: '#0b0f17',
      },
    }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              Stage 4 Renderer
            </span>
            <span className="text-xs text-slate-500 font-mono">1080 × 1350 High-Res Canvas</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-emerald-400" />
            <span>Poster Renderer & Auto-Fit Engine</span>
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Real-time HTML poster renderer with locked brand headers/footers, dynamic auto-fitting text, and instant brand color styling.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowZoneBorders(!showZoneBorders)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 border transition-all ${
              showZoneBorders
                ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
            }`}
          >
            <Layout className="w-4 h-4" />
            <span>{showZoneBorders ? 'Hide Zone Outlines' : 'Show Zone Outlines'}</span>
          </button>
        </div>
      </div>

      {/* Overflow Notification Bar */}
      {overflowWarning && (
        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3 text-amber-300 text-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>
            <strong>Auto-fit limit reached:</strong> {overflowWarning}
          </span>
        </div>
      )}

      {/* ── Sample brands ── */}
      <div className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Sample brands</h2>
            <p className="text-slate-400 text-sm mt-1">
              Four locked brand kits rendering every style block. Contrast readouts come from the same
              helper the brand form uses.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setBrandKit(DEFAULT_BRAND_KIT)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700 hover:text-white shrink-0"
          >
            Reset to the legacy kit
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {SAMPLE_BRANDS.map(({ id, label, kit }) => {
            const resolved = resolvePosterBrand(kit, template);
            return (
              <div key={id} className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{label}</p>
                  <button
                    type="button"
                    onClick={() => setBrandKit(kit)}
                    className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                  >
                    Use above
                  </button>
                </div>
                <PosterPreview brandKit={kit} template={template} content={SAMPLE_CONTENTS[id]} />
                <ul className="text-[10px] font-mono text-slate-400 space-y-0.5 bg-slate-900/60 border border-slate-800 rounded-lg p-2">
                  <li>Headline: {contrastLabel(resolved.content.headingColor, resolved.content.surface, { large: true })}</li>
                  <li>Body: {contrastLabel(resolved.content.bodyColor, resolved.content.surface)}</li>
                  <li>Footer: {contrastLabel(resolved.footer.style.color, resolved.footer.surface)}</li>
                </ul>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Template layout samples ── */}
      <div className="pt-10 border-t border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Template layout samples</h2>
          <p className="text-slate-400 text-sm mt-1">
            The same words in four different layouts: zone rectangles, text position, gaps, photo
            position, date-and-place style, extra shape and the allowed text-size range all come from
            the template. Header and footer stay locked to the brand kit above.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 items-start">
          {LAYOUT_SAMPLES.map(({ id, label, note, template: layoutTemplate }) => (
            <div key={id} className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{label}</p>
              <PosterPreview
                brandKit={brandKit}
                template={layoutTemplate}
                content={{ ...TEMPLATE_SAMPLE_CONTENT, imageUrl: LAYOUT_SAMPLE_IMAGE }}
                showZoneBorders={showZoneBorders}
              />
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">{note}</p>
              <button
                type="button"
                onClick={() => setTemplate(layoutTemplate)}
                className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
              >
                Use above
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── Placed item samples ── */}
      <div className="pt-10 border-t border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Placed item samples</h2>
          <p className="text-slate-400 text-sm mt-1">
            One template whose headline, line under it, date, time, place, bullets, photo, a second
            photo, a line shape and one fixed sentence were each placed by hand. The same ten pieces
            render the three word sets below. A box only ever shrinks its own text, down to the
            smallest size that box was given, and says so when even that is too small.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
          {ITEM_SAMPLES.map(({ id, label, note, content: itemContent }) => (
            <div key={id} className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{label}</p>
              <PosterPreview
                brandKit={ITEM_SAMPLE_KIT}
                template={ITEM_SAMPLE_TEMPLATE}
                content={itemContent}
                showZoneBorders={showZoneBorders}
              />
              <p className="text-[10px] font-mono text-slate-500 leading-relaxed">{note}</p>
              <button
                type="button"
                onClick={() => {
                  setBrandKit(ITEM_SAMPLE_KIT);
                  setTemplate(ITEM_SAMPLE_TEMPLATE);
                  setContent(itemContent);
                }}
                className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
              >
                Use above for export
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── The locked brand layer, and a brand's own pattern ── */}
      <div className="pt-10 border-t border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Locked bands and a faint pattern</h2>
          <p className="text-slate-400 text-sm mt-1">
          The top row is one organization whose middle is a pattern: the lines, dots or grid
          are one layer across the whole poster, behind every band and every piece of writing,
          and are never painted inside a box or over words. The bottom row is two designs the
          assistant writes; neither declares any areas of its own, so both locked bands have to
          come from the brand kit alone. Under each poster the page reports the band heights, the
          strip of text between them, and any colour the renderer had to change to stay readable.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 items-start">
          {PATTERN_KITS.map(({ id, label, kit }) => {
            const read = layerReadout(kit, ITEM_SAMPLE_TEMPLATE);
            const report = contrastReport(kit, ITEM_SAMPLE_TEMPLATE);
            return (
              <div key={id} className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{label}</p>
                <PosterPreview
                  brandKit={kit}
                  template={ITEM_SAMPLE_TEMPLATE}
                  content={ITEM_SAMPLE_NORMAL}
                  showZoneBorders={showZoneBorders}
                />
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                  {read.pattern}, drawn in {read.patternColor} · base colour across the whole
                  poster: {read.fullBleed ? 'yes' : 'no'} · header {read.header} · footer{' '}
                  {read.footer}
                </p>
                <p className="text-[10px] font-mono text-slate-600">{read.strip}</p>
                <ContrastLines report={report} />
                <button
                  type="button"
                  onClick={() => {
                    setBrandKit(kit);
                    setTemplate(ITEM_SAMPLE_TEMPLATE);
                    setContent(ITEM_SAMPLE_NORMAL);
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                >
                  Use above for export
                </button>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
          {BAND_CASES.map(({ id, label, note, design }) => {
            const built = recipeTemplateOf(design, 0, ITEM_SAMPLE_KIT, RECIPE_WORDS_NORMAL, 'brand');
            const read = layerReadout(ITEM_SAMPLE_KIT, built);
            const report = contrastReport(ITEM_SAMPLE_KIT, built);
            return (
              <div key={id} className="space-y-2">
                <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">{label}</p>
                <PosterPreview
                  brandKit={ITEM_SAMPLE_KIT}
                  template={built}
                  content={posterContentOf(RECIPE_WORDS_NORMAL)}
                  showZoneBorders={showZoneBorders}
                />
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                  {note} · areas declared {built.zones.length} · {built.elements.length} pieces
                </p>
                <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                  header {read.header} · footer {read.footer} · {read.strip}
                </p>
                <ContrastLines report={report} />
                <button
                  type="button"
                  onClick={() => {
                    setBrandKit(ITEM_SAMPLE_KIT);
                    setTemplate(built);
                    setContent(posterContentOf(RECIPE_WORDS_NORMAL));
                  }}
                  className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                >
                  Use above for export
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Design recipes: every design, every arrangement, three word sets ── */}
      <div className="pt-10 border-t border-slate-800 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white">Design recipes</h2>
            <p className="text-slate-400 text-sm mt-1">
              The five designs the assistant can write, each in its four arrangements, built here from
              the brand kit above with the app&apos;s own design rules. Every design shows three sets of
              words: short ones, very long ones, and a poster with no place and no photo. The marks,
              colours and typefaces all come from the brand kit - nothing is drawn in a colour the
              organization has not chosen.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Palette className="w-4 h-4 text-slate-400" />
            <div className="flex bg-slate-900 border border-slate-800 rounded-lg p-1 gap-1">
              {RECIPE_PALETTES.map((palette) => (
                <button
                  key={palette}
                  type="button"
                  onClick={() => setRecipePalette(palette)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
                    recipePalette === palette
                      ? 'bg-emerald-500 text-slate-950'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {palette}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-10">
          {DESIGN_RECIPES.map((design) => {
            const bandLine = layerReadout(
              brandKit,
              recipeTemplateOf(design, 0, brandKit, RECIPE_WORDS_NORMAL, recipePalette)
            );
            return (
            <div key={design.id} className="space-y-3">
              <p className="text-[11px] font-semibold text-slate-300 uppercase tracking-wider">
                {design.name}
                <span className="ml-2 text-slate-500 normal-case font-normal">
                  {design.needsPhoto ? 'shows a photo' : 'words and marks only'} · suits{' '}
                  {design.suits.join(', ')} · {bandLine.header} · {bandLine.footer}
                </span>
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 items-start">
                {RECIPE_VARIANTS.map((variant) => (
                  <div key={variant} className="space-y-3">
                    {RECIPE_WORD_SETS.map((set) => {
                      const built = recipeTemplateOf(design, variant, brandKit, set.words, recipePalette);
                      const itemKinds = built.elements.reduce(
                        (counts, item) => ({ ...counts, [item.kind]: (counts[item.kind] || 0) + 1 }),
                        {}
                      );
                      return (
                        <div key={`${design.id}-${variant}-${set.id}`} className="space-y-2">
                          <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                            Arrangement {variant + 1} · {set.label}
                          </p>
                          <PosterPreview
                            brandKit={brandKit}
                            template={built}
                            content={posterContentOf(set.words)}
                            showZoneBorders={showZoneBorders}
                          />
                          <p className="text-[10px] font-mono text-slate-500 leading-relaxed">
                            {set.note}
                          </p>
                          <p className="text-[10px] font-mono text-slate-600">
                            {built.elements.length} pieces ·{' '}
                            {Object.entries(itemKinds)
                              .map(([kind, count]) => `${count} ${kind}`)
                              .join(', ')}
                            {built.problems.length > 0 && (
                              <span className="text-rose-400"> · {built.problems.join(' ')}</span>
                            )}
                          </p>
                          <ContrastLines quiet report={contrastReport(brandKit, built)} />
                          <button
                            type="button"
                            onClick={() => {
                              setTemplate(built);
                              setContent(posterContentOf(set.words));
                            }}
                            className="text-[11px] px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30"
                          >
                            Use above for export
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Main Grid: Controls + Live Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Controls Column */}
        <div className="lg:col-span-5 space-y-6">
          {/* Tab Selector */}
          <div className="flex bg-slate-900/90 border border-slate-800 rounded-xl p-1">
            <button
              onClick={() => setActiveTab('brand')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'brand'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Palette className="w-3.5 h-3.5" />
              <span>Brand Kit Styling</span>
            </button>
            <button
              onClick={() => setActiveTab('content')}
              className={`flex-1 py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
                activeTab === 'content'
                  ? 'bg-emerald-500 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Event Details</span>
            </button>
          </div>

          {/* TAB 1: BRAND STYLING CONTROLS */}
          {activeTab === 'brand' && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-6 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Palette className="w-4 h-4 text-emerald-400" />
                  <span>Locked Brand Color Palette</span>
                </div>
                <button
                  onClick={resetColors}
                  title="Reset Colors"
                  className="text-slate-500 hover:text-slate-300 text-xs flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Reset</span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Primary Brand Color
                  </label>
                  <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl p-2">
                    <input
                      type="color"
                      value={brandKit.colors?.primary || '#059669'}
                      onChange={(e) => handleColorChange('primary', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs text-white uppercase">
                      {brandKit.colors?.primary}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Accent Color
                  </label>
                  <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl p-2">
                    <input
                      type="color"
                      value={brandKit.colors?.accent || '#10b981'}
                      onChange={(e) => handleColorChange('accent', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs text-white uppercase">
                      {brandKit.colors?.accent}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Canvas Background
                  </label>
                  <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl p-2">
                    <input
                      type="color"
                      value={brandKit.colors?.background || '#0b0f17'}
                      onChange={(e) => handleColorChange('background', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs text-white uppercase">
                      {brandKit.colors?.background}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                    Text Color
                  </label>
                  <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 rounded-xl p-2">
                    <input
                      type="color"
                      value={brandKit.colors?.text || '#ffffff'}
                      onChange={(e) => handleColorChange('text', e.target.value)}
                      className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border-0"
                    />
                    <span className="font-mono text-xs text-white uppercase">
                      {brandKit.colors?.text}
                    </span>
                  </div>
                </div>
              </div>

              {/* Typography */}
              <div className="space-y-4 pt-4 border-t border-slate-800">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Type className="w-4 h-4 text-emerald-400" />
                  <span>Google Fonts Typography</span>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Headline Font
                    </label>
                    <select
                      value={brandKit.fonts?.heading || 'Outfit'}
                      onChange={(e) =>
                        setBrandKit((prev) => ({
                          ...prev,
                          fonts: { ...prev.fonts, heading: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {GOOGLE_FONTS_HEADING.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
                      Body Font
                    </label>
                    <select
                      value={brandKit.fonts?.body || 'Inter'}
                      onChange={(e) =>
                        setBrandKit((prev) => ({
                          ...prev,
                          fonts: { ...prev.fonts, body: e.target.value },
                        }))
                      }
                      className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-emerald-500"
                    >
                      {GOOGLE_FONTS_BODY.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Locked Header / Footer Info */}
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-slate-400 space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-emerald-400">
                  <CheckCircle className="w-4 h-4" />
                  <span>Brand Isolation Active</span>
                </div>
                <p>
                  Header and footer sections are permanently locked to your organization brand kit.
                  Updating colors updates the entire design instantly without altering the marketing text!
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: MARKETING CONTENT CONTROLS */}
          {activeTab === 'content' && (
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-6 backdrop-blur-xl space-y-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2 text-white font-semibold text-sm">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                  <span>Marketing Content Inputs</span>
                </div>
                <span className="text-[11px] text-emerald-400 font-mono">Auto-fits to zone</span>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Tagline / Kicker
                </label>
                <input
                  type="text"
                  value={content.tagline}
                  onChange={(e) => handleContentChange('tagline', e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Event / Campaign Title
                </label>
                <textarea
                  rows={2}
                  value={content.title}
                  onChange={(e) => handleContentChange('title', e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Date
                  </label>
                  <input
                    type="text"
                    value={content.date}
                    onChange={(e) => handleContentChange('date', e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                    Time
                  </label>
                  <input
                    type="text"
                    value={content.time}
                    onChange={(e) => handleContentChange('time', e.target.value)}
                    className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Venue / Location
                </label>
                <input
                  type="text"
                  value={content.venue}
                  onChange={(e) => handleContentChange('venue', e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">
                  Detailed Description
                </label>
                <textarea
                  rows={3}
                  value={content.details}
                  onChange={(e) => handleContentChange('details', e.target.value)}
                  className="w-full bg-slate-800/80 border border-slate-700 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <PosterImageInput
                value={content.image || content.imageUrl || ''}
                onChange={(url) => {
                  setImageLoadError(false);
                  setContent((prev) => ({ ...prev, image: url, imageUrl: url }));
                }}
              />
            </div>
          )}
        </div>

        {/* Live Canvas Column */}
        <div className="lg:col-span-7 flex flex-col items-center">
          <div className="w-full max-w-[540px] bg-slate-950 border border-slate-800/90 rounded-3xl p-5 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800/80 text-xs text-slate-400">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-semibold text-slate-300">Live Scaled Canvas</span>
              </div>
              <span className="font-mono text-[11px]">1080 × 1350 • High Fidelity</span>
            </div>

            {/* Poster Preview */}
            <PosterPreview
              brandKit={brandKit}
              template={template}
              content={{
                ...content,
                imageUrl: content.imageUrl || content.image || '',
              }}
              showZoneBorders={showZoneBorders}
              onOverflow={(isOverflow, msg) => setOverflowWarning(isOverflow ? msg : null)}
              onImageFail={() => setImageLoadError(true)}
            />
            {imageLoadError && (
              <p className="text-xs text-amber-400 mt-3 text-center">
                This photo couldn't be used. Try uploading it instead.
              </p>
            )}
          </div>

          {/* Export Buttons */}
          <PosterExportButtons
            brandKit={brandKit}
            template={template}
            content={{
              ...content,
              imageUrl: content.imageUrl || content.image || '',
            }}
          />
        </div>
      </div>

      {/* ── Image layout samples ── */}
      <div className="pt-10 border-t border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Image layout samples</h2>
          <p className="text-slate-400 text-sm mt-1">
            Image + 4 long details, image + long title, image + 1 detail, and no image.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            {
              label: 'Image + 4 long details',
              content: {
                title: 'Community Health Fair',
                tagline: 'Your Wellbeing Matters',
                date: '22 Oct',
                time: '9 AM–5 PM',
                venue: 'City Sports Complex, Hall B',
                details: [
                  'Free blood pressure and glucose screening for all visitors',
                  'Nutrition workshops with certified dietitians',
                  'Mental health consultations and wellness assessments',
                  'Kids corner with health education activities and games',
                ],
                imageUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=80',
              },
            },
            {
              label: 'Image + long title',
              content: {
                title: 'Annual International Symposium on Artificial Intelligence Research and Sustainable Innovation Across 2026',
                tagline: 'Knowledge Forward',
                date: '20 Nov',
                time: '9 AM–6 PM',
                venue: 'Grand Convention Centre',
                details: ['Keynotes by world-leading researchers'],
                imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
              },
            },
            {
              label: 'Image + 1 detail',
              content: {
                title: 'Blood Donation Camp',
                tagline: 'Give Blood, Share Life',
                date: '12 Nov',
                time: '9 AM',
                venue: 'Town Hall',
                details: ['Free health checkup for all donors'],
                imageUrl: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=800&q=80',
              },
            },
            {
              label: 'No image',
              content: {
                title: 'Team Meeting',
                tagline: 'All Hands',
                date: '15 Oct',
                time: '10 AM',
                venue: 'Room 101',
                details: ['Agenda review', 'Q3 update', 'Open discussion'],
                imageUrl: '',
              },
            },
          ].map(({ label, content: sc }, i) => (
            <div key={i} className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
              <PosterPreview brandKit={brandKit} template={template} content={sc} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Layout Stress-Test Grid ── */}
      <div className="pt-10 border-t border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Layout Stress-Test Grid</h2>
          <p className="text-slate-400 text-sm mt-1">
            6 combinations — no big gaps, no cut text, no overlap.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
          {[
            {
              label: '1 · Short title, no image, 3 short details',
              content: {
                title: 'Team Meeting', tagline: 'All Hands',
                date: '15 Oct', time: '10 AM', venue: 'Room 101',
                details: ['Agenda review', 'Q3 update', 'Open discussion'],
                imageUrl: '',
              },
            },
            {
              label: '2 · Very long title (90 chars), no image',
              content: {
                title: 'Annual International Symposium on Artificial Intelligence Research and Sustainable Innovation Across 2026',
                tagline: 'Knowledge Forward',
                date: '20 Nov', time: '9 AM–6 PM', venue: 'Grand Convention Centre',
                details: ['Keynotes by world-leading researchers', 'Interactive workshops and demos'],
                imageUrl: '',
              },
            },
            {
              label: '3 · No details, with image',
              content: {
                title: 'Photography Walk',
                tagline: 'See the City',
                date: '5 Dec', time: '7 AM', venue: 'Central Park',
                details: [],
                imageUrl: 'https://images.unsplash.com/photo-1477959858617-67f85cf4f1df?w=800&q=80',
              },
            },
            {
              label: '4 · Four long details, with image',
              content: {
                title: 'Community Health Fair',
                tagline: 'Your Wellbeing Matters',
                date: '22 Oct', time: '9 AM–5 PM', venue: 'City Sports Complex, Hall B',
                details: [
                  'Free blood pressure and glucose screening for all visitors',
                  'Nutrition workshops with certified dietitians',
                  'Mental health consultations and wellness assessments',
                  'Kids corner with health education activities and games',
                ],
                imageUrl: 'https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=800&q=80',
              },
            },
            {
              label: '5 · Missing venue & time, no image',
              content: {
                title: 'Book Club Gathering',
                tagline: 'Read. Reflect. Connect.',
                date: 'Every Friday',
                time: '', venue: '',
                details: ['This month: Atomic Habits', 'Bring your copy and thoughts'],
                imageUrl: '',
              },
            },
            {
              label: '6 · Normal event, with image',
              content: {
                title: 'Blood Donation Camp',
                tagline: 'Give Blood, Share Life',
                date: '12 Nov', time: '9 AM', venue: 'Town Hall',
                details: [
                  'Free health checkup for all donors',
                  'Official donor certificate provided',
                ],
                imageUrl: 'https://images.unsplash.com/photo-1615461066841-6116e61058f4?w=800&q=80',
              },
            },
          ].map(({ label, content: sc }, i) => (
            <div key={i} className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
              <PosterPreview brandKit={brandKit} template={template} content={sc} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Format samples ── */}
      <div className="pt-10 border-t border-slate-800 space-y-6">
        <div>
          <h2 className="text-xl font-bold text-white">Format samples</h2>
          <p className="text-slate-400 text-sm mt-1">
            Same content across common formats — text auto-sizes so nothing is cut or cramped.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6 items-start">
          {FORMAT_PRESETS.map(({ id, label, width, height }) => (
            <div key={id} className="space-y-2">
              <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                {label} · {width}×{height}
              </p>
              <PosterPreview
                brandKit={brandKit}
                template={scaleTemplate(template, width, height)}
                content={{
                  ...content,
                  imageUrl: content.imageUrl || content.image || '',
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
