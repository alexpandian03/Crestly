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
import { resolvePosterBrand } from '../utils/brandRender';
import { contrastLabel } from '../utils/contrast';
import { TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';

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
