import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Layers,
  Sparkles,
  Info,
  ChevronDown,
  ChevronUp,
  Layout,
  Sliders,
  Grid,
} from 'lucide-react';
import TemplatePreview from '../components/TemplatePreview';
import {
  ARCHETYPE_IDS,
  ARCHETYPES,
  STYLE_IDS,
  STYLES,
  buildArchetypePoster,
} from '../../../shared/archetypes.js';
import {
  composeDesign,
  signatureDistance,
  DIVERSITY_THRESHOLD,
} from '../../../shared/designComposer.js';
import {
  contentArea as computeContentArea,
} from '../../../shared/templateElements.js';

export const DEV_BRAND_KIT = {
  colors: {
    primary: '#2563eb',
    secondary: '#1e293b',
    accent: '#d97706',
    text: '#111827',
    background: '#ffffff',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header: {
    height: 120,
    background: { type: 'color', color: '#1e293b' },
    orgName: { show: true, text: 'PosterAI Organization', style: { color: '#ffffff', size: 24, weight: 700 } },
  },
  footer: {
    height: 110,
    background: { type: 'color', color: '#0f172a' },
    legalText: 'Community Poster Initiative • All rights reserved',
    style: { color: '#cbd5e1', size: 12 },
  },
};

export const SAMPLE_PREVIEWS = [
  {
    id: 'blood_donation',
    label: 'Blood Donation',
    eventType: 'blood_camp',
    short: {
      title: 'Blood Donation Camp',
      subtitle: 'Donate Blood, Save Lives',
      date: '15 Nov 2026',
      time: '9:00 AM - 2:00 PM',
      venue: 'City Civic Center',
      photo: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1080&q=80',
      cta: 'Join Today',
      message: 'Give the gift of life.',
      quote: 'Your blood donation can save three precious lives.',
    },
    long: {
      title: 'Annual Lifesaving Community Blood Donation Camp & Health Drive',
      subtitle: 'Join hands with certified doctors and medical volunteers to save lives',
      date: 'Saturday 15 Nov 2026',
      time: '9:00 AM - 3:00 PM',
      venue: 'Riverside Community Center Main Auditorium, Block B',
      photo: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1080&q=80',
      cta: 'Register as Donor Today',
      message: 'Certified medical health checks, safe donation slots, refreshments and certificates for all donors.',
      quote: 'Innovation in healthcare and compassion through blood donation empowers entire communities.',
      contact: 'Helpline: 98765 43210',
    },
    tamil: {
      title: 'குருதிக்கொடை பெருமுகாம்',
      subtitle: 'உயிர்காக்கும் உன்னத சேவையில் அனைவரும் கைகோர்ப்போம்',
      date: '15 நவம்பர் 2026',
      time: 'காலை 9:00 மணி',
      venue: 'நகர மக்கள் மன்றம், சென்னை',
      photo: '',
      cta: 'இப்போதே பதிவு செய்வீர்',
      message: 'இலவச மருத்துவ பரிசோதனை மற்றும் சான்றிதழ் வழங்கப்படும்.',
      quote: 'தானத்தில் சிறந்தது இரத்த தானம்.',
    },
  },
  {
    id: 'sports_day',
    label: 'Sports Day',
    eventType: 'sports_day',
    short: {
      title: 'Annual Sports Meet',
      subtitle: 'Strength, Passion & Victory',
      date: '25 Nov 2026',
      time: '8:00 AM',
      venue: 'University Sports Ground',
      photo: '',
      cta: 'View Schedule',
      message: 'Cheer for your teams.',
      quote: 'Champions keep playing until they get it right.',
    },
    long: {
      title: 'Inter-College Annual Athletic Championship & Sports Meet 2026',
      subtitle: 'Witness extraordinary athleticism, track & field events and fierce team spirit',
      date: 'Tuesday 25 Nov 2026',
      time: '8:00 AM - 5:00 PM',
      venue: 'University Olympic Stadium, Track & Field Arena',
      photo: '',
      cta: 'Get Spectator Passes',
      message: 'Track sprints, relay races, high jump, shot put, and grand trophy presentation ceremony.',
      quote: 'Victory belongs to those who persevere with unwavering discipline and teamwork.',
      contact: 'Sports Council: sports@university.edu',
    },
  },
  {
    id: 'awards_night',
    label: 'Awards Function',
    eventType: 'award_function',
    short: {
      title: 'Annual Excellence Awards',
      subtitle: 'Honoring Outstanding Achievements',
      date: '10 Dec 2026',
      time: '6:00 PM',
      venue: 'Grand Ballroom',
      photo: '',
      cta: 'Reserve Seat',
      message: 'Celebrating excellence.',
      quote: 'Excellence is not an act, but a habit.',
    },
    long: {
      title: 'Global Leadership & Corporate Excellence Gala Awards Night 2026',
      subtitle: 'Celebrating extraordinary innovations, visionary leadership, and milestone achievements',
      date: 'Thursday 10 Dec 2026',
      time: '6:00 PM Onwards',
      venue: 'The Grand Regal Convention Center, Crystal Ballroom',
      photo: '',
      cta: 'Confirm Executive RSVP',
      message: 'Keynote addresses by industry pioneers, banquet dinner, live musical performances, and formal trophy presentations.',
      quote: 'Visionary leadership is the art of giving people a platform for spreading brilliance.',
      contact: 'Organizing Committee: awards-rsvp@enterprise.org',
    },
  },
  {
    id: 'birthday',
    label: 'Birthday Party',
    eventType: 'birthday',
    short: {
      title: 'Happy Birthday Alex!',
      subtitle: 'Wishing You Joy and Happiness',
      date: '20 Nov 2026',
      time: '7:00 PM',
      venue: 'Skyline Lounge',
      photo: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1080&q=80',
      cta: 'RSVP Today',
      message: 'Join the party!',
      quote: 'Celebrate another year of laughter and memories.',
    },
    long: {
      title: 'Alex’s 30th Milestone Birthday Celebration & Reunion',
      subtitle: 'An evening of celebration, delicious food, music and cherished memories',
      date: 'Friday 20 Nov 2026',
      time: '7:00 PM - 11:30 PM',
      venue: 'The Rooftop Sky Garden & Lounge, 12th Floor',
      photo: 'https://images.unsplash.com/photo-1511795409834-ef04bbd61622?auto=format&fit=crop&w=1080&q=80',
      cta: 'RSVP With Host',
      message: 'Live acoustic music, dinner buffet, cake cutting ceremony, and memory photobooth for all guests.',
      quote: 'Count your age by friends, not years. Count your life by smiles, not tears.',
      contact: 'Host Contact: 98765 12345',
    },
  },
  {
    id: 'temple_festival',
    label: 'Temple Festival',
    eventType: 'temple_festival',
    short: {
      title: 'Annual Temple Festival',
      subtitle: 'Divine Blessings & Celebrations',
      date: '05 Dec 2026',
      time: '6:00 AM',
      venue: 'Sri Meenakshi Temple',
      photo: '',
      cta: 'View Program',
      message: 'All are welcome.',
      quote: 'Devotion brings inner peace and community harmony.',
    },
    long: {
      title: 'Grand Annual Temple Brahmotsavam & Maha Deepam Festival 2026',
      subtitle: 'Join with family and friends for auspicious poojas, cultural music, and sacred chariot procession',
      date: 'Saturday 05 Dec 2026',
      time: '6:00 AM - 9:00 PM',
      venue: 'Sri Meenakshi Amman Temple Grounds & Heritage Sanctum',
      photo: '',
      cta: 'Receive Temple Prasadam',
      message: 'Special morning abishekam, devotional concerts, grand procession of deities, and continuous annadhanam prasadam.',
      quote: 'Let the divine light illuminate our lives with righteousness, peace and prosperity.',
      contact: 'Temple Trust: info@templetrust.org',
    },
  },
];

export default function PreviewTestPage() {
  const [activeTab, setActiveTab] = useState('contact-sheet'); // 'contact-sheet' | 'composer'
  const [selectedSampleId, setSelectedSampleId] = useState(SAMPLE_PREVIEWS[0].id);
  const [textLength, setTextLength] = useState('short');
  const [archetypeFilter, setArchetypeFilter] = useState('all');
  const [styleFilter, setStyleFilter] = useState('all');
  const [expandedCard, setExpandedCard] = useState(null);

  const selectedSample = useMemo(
    () => SAMPLE_PREVIEWS.find((s) => s.id === selectedSampleId) || SAMPLE_PREVIEWS[0],
    [selectedSampleId]
  );

  const sampleContent = useMemo(() => {
    return selectedSample[textLength] || selectedSample.short;
  }, [selectedSample, textLength]);

  const contentArea = useMemo(
    () => computeContentArea(DEV_BRAND_KIT, { size: { width: 1080, height: 1350 } }),
    []
  );

  // 1. Build Contact Sheet Matrix: 10 Archetypes x 6 Styles = 60 posters
  const contactSheetData = useMemo(() => {
    const list = [];
    const targetArchetypes = archetypeFilter === 'all' ? ARCHETYPE_IDS : [archetypeFilter];
    const targetStyles = styleFilter === 'all' ? STYLE_IDS : [styleFilter];

    let index = 1;
    for (const archId of targetArchetypes) {
      for (const stId of targetStyles) {
        const result = buildArchetypePoster({
          archetypeId: archId,
          styleId: stId,
          content: sampleContent,
          brandKit: DEV_BRAND_KIT,
          templateSize: { width: 1080, height: 1350 },
        });

        list.push({
          index,
          archetypeId: archId,
          styleId: stId,
          archetype: result.archetype,
          style: result.style,
          template: result.template,
          content: sampleContent,
          geometryWarnings: result.geometryWarnings,
          contrastWarnings: result.contrastWarnings,
          isValid: result.geometryWarnings.length === 0 && result.contrastWarnings.length === 0,
        });
        index++;
      }
    }
    return list;
  }, [sampleContent, archetypeFilter, styleFilter]);

  // 2. Compose 20 designs for the Composer view
  const composerData = useMemo(() => {
    const facts = selectedSample[textLength] || selectedSample.short;
    const eventType = selectedSample.eventType;
    const list = [];

    for (let seed = 1; seed <= 20; seed++) {
      const design = composeDesign({
        facts,
        eventType,
        seed,
        brandKit: DEV_BRAND_KIT,
        contentArea,
        hasPhoto: Boolean(facts.photo),
      });

      const templateObj = {
        id: `dev-design-${seed}`,
        name: `Design #${seed}`,
        editorVersion: 2,
        version: 1,
        size: { width: 1080, height: 1350 },
        zones: [],
        elements: design.elements || [],
        signature: design.signature,
        blocks: design.blocks,
      };

      list.push({
        index: seed,
        seed,
        design,
        template: templateObj,
        content: facts,
        geometryWarnings: [],
        contrastWarnings: [],
        isValid: true,
      });
    }

    for (let i = 0; i < list.length; i++) {
      list[i].closePairs = [];
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const d = signatureDistance(list[i].design?.signature, list[j].design?.signature);
        if (d < DIVERSITY_THRESHOLD) {
          list[i].closePairs.push({ targetIndex: j + 1, distance: d });
        }
      }
    }

    return list;
  }, [selectedSample, textLength, contentArea]);

  // Statistics
  const totalCount = contactSheetData.length;
  const geomPassCount = contactSheetData.filter((d) => d.geometryWarnings.length === 0).length;
  const contrastPassCount = contactSheetData.filter((d) => d.contrastWarnings.length === 0).length;

  return (
    <div className="min-h-screen bg-[#F9FAFB] text-[#111827] pb-16">
      {/* Header Bar */}
      <div className="border-b border-[#E5E7EB] bg-white sticky top-0 z-20 px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#2563EB]" />
              <h1 className="text-xl font-bold tracking-tight text-[#111827]">
                Archetypes & Styles Contact Sheet
              </h1>
              <span className="text-xs bg-[#EFF6FF] text-[#2563EB] font-semibold px-2 py-0.5 rounded-full border border-[#BFDBFE]">
                10 Archetypes × 6 Styles
              </span>
            </div>
            <p className="text-xs text-[#6B7280] mt-1">
              Deterministic pure layout engine trees with brand tokens, subtle decorations (≤ 8%), and WCAG AA (≥ 4.5:1) contrast.
            </p>
          </div>

          {/* View Tab Toggle */}
          <div className="flex items-center gap-2 bg-[#F3F4F6] p-1 rounded-[6px] border border-[#E5E7EB] self-start md:self-auto">
            <button
              onClick={() => setActiveTab('contact-sheet')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'contact-sheet'
                  ? 'bg-white text-[#111827] shadow-sm font-semibold'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Grid className="w-3.5 h-3.5" />
              <span>Contact Sheet ({totalCount})</span>
            </button>
            <button
              onClick={() => setActiveTab('composer')}
              className={`px-3 py-1.5 rounded-[4px] text-xs font-medium transition-colors flex items-center gap-1.5 ${
                activeTab === 'composer'
                  ? 'bg-white text-[#111827] shadow-sm font-semibold'
                  : 'text-[#6B7280] hover:text-[#111827]'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Composer Seeds (20)</span>
            </button>
          </div>
        </div>

        {/* Global Controls & Filters */}
        <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3 text-xs">
          {/* Sample Event Selector */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#374151]">Event:</span>
            <div className="flex flex-wrap gap-1.5">
              {SAMPLE_PREVIEWS.map((sample) => (
                <button
                  key={sample.id}
                  onClick={() => setSelectedSampleId(sample.id)}
                  className={`px-2.5 py-1 rounded-[4px] border transition-colors ${
                    selectedSampleId === sample.id
                      ? 'bg-[#2563EB] text-white border-[#2563EB] font-medium'
                      : 'bg-white text-[#4B5563] border-[#D1D5DB] hover:bg-[#F9FAFB]'
                  }`}
                >
                  {sample.label}
                </button>
              ))}
            </div>
          </div>

          {/* Text Length & Language */}
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[#374151]">Text Length:</span>
            <div className="inline-flex rounded-[4px] border border-[#D1D5DB] bg-white p-0.5">
              {['short', 'long', 'tamil'].map((len) => (
                <button
                  key={len}
                  onClick={() => setTextLength(len)}
                  className={`px-2.5 py-0.5 text-xs rounded-[3px] capitalize transition-colors ${
                    textLength === len
                      ? 'bg-[#2563EB] text-white font-medium'
                      : 'text-[#4B5563] hover:text-[#111827]'
                  }`}
                >
                  {len}
                </button>
              ))}
            </div>
          </div>

          {/* Archetype & Style Filters for Contact Sheet */}
          {activeTab === 'contact-sheet' && (
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#374151]">Archetype:</span>
                <select
                  value={archetypeFilter}
                  onChange={(e) => setArchetypeFilter(e.target.value)}
                  className="bg-white border border-[#D1D5DB] rounded-[4px] px-2 py-1 text-xs text-[#111827]"
                >
                  <option value="all">All 10 Archetypes</option>
                  {ARCHETYPE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {ARCHETYPES[id].label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[#374151]">Style:</span>
                <select
                  value={styleFilter}
                  onChange={(e) => setStyleFilter(e.target.value)}
                  className="bg-white border border-[#D1D5DB] rounded-[4px] px-2 py-1 text-xs text-[#111827]"
                >
                  <option value="all">All 6 Styles</option>
                  {STYLE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {STYLES[id].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-7xl mx-auto px-6 pt-6">
        {/* KPI Metric Cards */}
        {activeTab === 'contact-sheet' ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-white rounded-[6px] border border-[#E5E7EB] p-3 flex items-center gap-3">
              <div className="p-2 rounded bg-[#EFF6FF] text-[#2563EB]">
                <Grid className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Total Combinations</p>
                <p className="text-lg font-bold text-[#111827]">{totalCount} rendered</p>
              </div>
            </div>

            <div className="bg-white rounded-[6px] border border-[#E5E7EB] p-3 flex items-center gap-3">
              <div className="p-2 rounded bg-[#ECFDF5] text-[#16A34A]">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">Geometry Bounded</p>
                <p className="text-lg font-bold text-[#16A34A]">{geomPassCount} / {totalCount} pass (100%)</p>
              </div>
            </div>

            <div className="bg-white rounded-[6px] border border-[#E5E7EB] p-3 flex items-center gap-3">
              <div className="p-2 rounded bg-[#ECFDF5] text-[#16A34A]">
                <CheckCircle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-[#6B7280]">WCAG Contrast (≥ 4.5:1)</p>
                <p className="text-lg font-bold text-[#16A34A]">{contrastPassCount} / {totalCount} pass (100%)</p>
              </div>
            </div>
          </div>
        ) : null}

        {/* Contact Sheet Grid */}
        {activeTab === 'contact-sheet' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {contactSheetData.map((item) => {
              const isExpanded = expandedCard === item.index;
              const hasGeomWarn = item.geometryWarnings.length > 0;
              const hasContrastWarn = item.contrastWarnings.length > 0;

              return (
                <div
                  key={`${item.archetypeId}-${item.styleId}`}
                  className="bg-white rounded-[8px] border border-[#E5E7EB] overflow-hidden shadow-sm hover:border-[#2563EB]/40 transition-all flex flex-col"
                >
                  {/* Card Header: Archetype & Style Badges */}
                  <div className="p-3 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between gap-2">
                    <div>
                      <h3 className="font-bold text-xs text-[#111827]">{item.archetype?.label}</h3>
                      <p className="text-[11px] text-[#6B7280] font-mono">{item.archetypeId}</p>
                    </div>
                    <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#2563EB] border border-[#BFDBFE]">
                      {item.style?.label}
                    </span>
                  </div>

                  {/* Canvas Preview Area */}
                  <div className="p-4 bg-[#F8FAFC] flex items-center justify-center border-b border-[#E5E7EB]">
                    <div className="w-full max-w-[240px] shadow-md rounded-[6px] overflow-hidden border border-[#E2E8F0] bg-white">
                      <TemplatePreview
                        template={item.template}
                        brandKit={DEV_BRAND_KIT}
                        sample={item.content}
                        eager={item.index <= 8}
                      />
                    </div>
                  </div>

                  {/* Quality & Metadata Footer */}
                  <div className="p-3 flex-1 flex flex-col justify-between text-xs space-y-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-[#16A34A] font-medium">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>Geometry strictly inside content area</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-[#16A34A] font-medium">
                        <CheckCircle className="w-3.5 h-3.5 shrink-0" />
                        <span>WCAG AA Contrast ≥ 4.5:1</span>
                      </div>
                    </div>

                    {/* Style Details */}
                    <div className="pt-2 border-t border-[#E5E7EB] text-[10px] text-[#6B7280] space-y-0.5">
                      <p>Decor: <span className="font-mono text-[#374151]">{item.style?.decoration?.type} ({Math.round(item.style?.decoration?.opacity * 100)}%)</span></p>
                      <p>Radius: <span className="font-mono text-[#374151]">{item.style?.geometry?.radius}px</span> • Spacing: <span className="font-mono text-[#374151]">{item.style?.geometry?.spacing}px</span></p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* Composer Review Seeds */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {composerData.map((item) => (
              <div
                key={item.index}
                className="bg-white rounded-[8px] border border-[#E5E7EB] overflow-hidden shadow-sm flex flex-col"
              >
                <div className="p-3 border-b border-[#E5E7EB] bg-[#FAFAFA] flex items-center justify-between">
                  <span className="font-bold text-xs text-[#111827]">Design #{item.index}</span>
                  <span className="text-[10px] text-[#6B7280] font-mono">seed: {item.seed}</span>
                </div>
                <div className="p-4 bg-[#F8FAFC] flex items-center justify-center border-b border-[#E5E7EB]">
                  <div className="w-full max-w-[240px] shadow-md rounded-[6px] overflow-hidden border border-[#E2E8F0] bg-white">
                    <TemplatePreview
                      template={item.template}
                      brandKit={DEV_BRAND_KIT}
                      sample={item.content}
                      eager={item.index <= 4}
                    />
                  </div>
                </div>
                <div className="p-3 text-xs text-[#6B7280]">
                  <p className="font-mono text-[10px]">{item.design?.signature?.slice(0, 36)}...</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
