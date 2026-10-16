import React, { useState, useMemo } from 'react';
import PosterPreview from '../components/PosterPreview';
import { DESIGN_RECIPES, buildElements } from '../../../shared/designRecipes.js';
import { PALETTE_FAMILIES, derivePaletteFamily } from '../../../shared/paletteFamilies.js';
import { scoreDesign } from '../../../shared/visualScore.js';

const DEMO_BRAND_KIT = {
  colors: {
    primary: '#059669',
    secondary: '#0f172a',
    accent: '#10b981',
    text: '#ffffff',
    background: '#0b0f17',
  },
  fonts: { heading: 'Outfit', body: 'Inter' },
  header: {
    height: 120,
    background: { type: 'color', color: '#0f172a' },
    orgName: { show: true, text: 'Acme Organization', style: { color: '#ffffff', size: 24, weight: 700 } },
  },
  footer: {
    height: 90,
    background: { type: 'color', color: '#0b0f17' },
    legalText: '© 2026 Acme Organization. All rights reserved.',
    style: { color: '#cbd5e1', size: 12 },
  },
};

const SAMPLE_CONTENT = {
  title: 'Community Health & Blood Drive',
  tagline: 'Join local doctors and volunteers for a lifesaving community afternoon',
  date: 'Saturday 24 Oct 2026',
  time: '9:00 AM - 2:00 PM',
  venue: 'Riverside Community Hall, Main Auditorium',
  details: [
    'Certified medical health checks and consultations',
    'Safe and supervised voluntary blood donation slots',
    'Free wellness counseling and health nutrition packs',
  ],
  extras: {
    title_sub: 'Annual Community Wellness Drive',
    slogan_1: 'Every contribution saves lives',
    slogan_2: 'Bring friends and family',
    cta_line: 'No pre-registration fee required',
    cta_button: 'Participate Now',
  },
  icon: 'heart-pulse',
};

export default function CatalogDevPage() {
  const [selectedFamily, setSelectedFamily] = useState('all');
  const [selectedPresetId, setSelectedPresetId] = useState('all');

  const combinations = useMemo(() => {
    const list = [];
    const familiesToRun = selectedFamily === 'all' ? PALETTE_FAMILIES : [selectedFamily];
    const presetsToRun = selectedPresetId === 'all' ? DESIGN_RECIPES : DESIGN_RECIPES.filter((d) => d.id === selectedPresetId);

    for (const preset of presetsToRun) {
      for (const family of familiesToRun) {
        const palette = derivePaletteFamily(DEMO_BRAND_KIT, family);
        const dynamicKit = {
          ...DEMO_BRAND_KIT,
          colors: {
            ...DEMO_BRAND_KIT.colors,
            primary: palette.primary || palette.band || DEMO_BRAND_KIT.colors.primary,
            background: palette.background,
            text: palette.body,
            accent: palette.accent,
          },
        };

        const slots = {
          ...SAMPLE_CONTENT,
          headline: SAMPLE_CONTENT.title,
        };

        const built = buildElements(preset.id, {
          brandKit: dynamicKit,
          slots,
          options: { variant: 0 },
        });

        const template = {
          id: `dev-${preset.id}-${family}`,
          name: preset.name,
          editorVersion: 2,
          size: { width: 1080, height: 1350 },
          elements: built.elements,
        };

        const evaluation = scoreDesign(built.elements, slots, palette);

        list.push({
          preset,
          family,
          palette,
          template,
          content: slots,
          brandKit: dynamicKit,
          evaluation,
        });
      }
    }
    return list;
  }, [selectedFamily, selectedPresetId]);

  const failureCount = combinations.filter((c) => !c.evaluation.pass).length;

  return (
    <div className="container-page section-pad space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-line">
        <div>
          <h1 className="text-xl font-bold text-heading">Visual Quality Dev Catalog</h1>
          <p className="text-xs text-muted-foreground mt-1">
            Testing {combinations.length} preset & palette combinations. Minimum threshold: 60/100.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {failureCount > 0 ? (
            <span className="px-3 py-1 rounded bg-red-600 text-white text-xs font-semibold">
              {failureCount} Failing
            </span>
          ) : (
            <span className="px-3 py-1 rounded bg-emerald-600 text-white text-xs font-semibold">
              All {combinations.length} Passing (≥60)
            </span>
          )}
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Palette Family
          </label>
          <select
            value={selectedFamily}
            onChange={(e) => setSelectedFamily(e.target.value)}
            className="text-xs bg-surface border border-line rounded px-2.5 py-1.5 text-heading"
          >
            <option value="all">All Families</option>
            {PALETTE_FAMILIES.map((fam) => (
              <option key={fam} value={fam}>
                {fam}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide block mb-1">
            Preset Archetype
          </label>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            className="text-xs bg-surface border border-line rounded px-2.5 py-1.5 text-heading"
          >
            <option value="all">All Presets ({DESIGN_RECIPES.length})</option>
            {DESIGN_RECIPES.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.id})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {combinations.map((comb) => {
          const { preset, family, template, content, brandKit, evaluation } = comb;
          const isFailing = !evaluation.pass;

          let badgeColor = 'bg-emerald-600 text-white';
          if (isFailing) {
            badgeColor = 'bg-red-600 text-white';
          } else if (evaluation.score < 80) {
            badgeColor = 'bg-amber-600 text-white';
          }

          return (
            <div
              key={`${preset.id}-${family}`}
              className={`rounded-lg border overflow-hidden bg-card flex flex-col transition-all ${
                isFailing
                  ? 'border-red-500 shadow-md shadow-red-500/10'
                  : 'border-line hover:border-line-hover'
              }`}
            >
              {/* Header Info */}
              <div className="p-3 border-b border-line flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-heading">{preset.name}</h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-mono uppercase">
                      {family}
                    </span>
                    <span className="text-[11px] text-muted-foreground">{preset.id}</span>
                  </div>
                </div>
                <div className={`px-2 py-0.5 rounded text-xs font-bold ${badgeColor}`}>
                  {evaluation.score}/100
                </div>
              </div>

              {/* Mood Description */}
              <p className="px-3 pt-2 text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {preset.mood}
              </p>

              {/* Score Breakdown */}
              <div className="px-3 py-2 text-[10px] text-muted-foreground grid grid-cols-5 gap-1 border-b border-line/60 bg-muted/20">
                <div title="Contrast (max 25)">Contr: {evaluation.details.contrast}</div>
                <div title="Occupancy (max 20)">Occ: {evaluation.details.occupancy}</div>
                <div title="Balance (max 20)">Bal: {evaluation.details.balance}</div>
                <div title="No Empty Slots (max 20)">Slots: {evaluation.details.noEmptySlots}</div>
                <div title="Hierarchy (max 15)">Hier: {evaluation.details.hierarchy}</div>
              </div>

              {/* Canvas Preview */}
              <div className="p-3 flex-1 flex items-center justify-center bg-preview/20">
                <div className="w-full max-w-[280px] shadow-sm rounded overflow-hidden">
                  <PosterPreview
                    brandKit={brandKit}
                    template={template}
                    content={content}
                    eager={true}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
