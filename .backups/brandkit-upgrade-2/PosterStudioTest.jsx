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
