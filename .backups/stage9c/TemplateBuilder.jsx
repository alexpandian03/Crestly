import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Image as ImageIcon, Loader2 } from 'lucide-react';
import api from '../services/api';
import PosterPreview from '../components/PosterPreview';
import { useAuth } from '../context/AuthContext';
import { TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';
import { LAYOUT_BASE, resolveTemplateRender } from '../utils/templateRender';

const AREA_LABELS = { header: 'Top band', footer: 'Bottom band', content: 'Words and photo area', image: 'Photo area' };
const SETTINGS = [
  {
    key: 'alignment',
    label: 'Text position',
    values: { left: 'Text on the left', center: 'Text centred' },
  },
  {
    key: 'spacing',
    label: 'Gaps',
    values: { compact: 'Tight', normal: 'As they come', relaxed: 'Generous' },
  },
  {
    key: 'imagePlacement',
    label: 'Photo position',
    values: { top: 'At the top', middle: 'In the middle', bottom: 'At the bottom', none: 'No photo area' },
  },
  {
    key: 'infoStyle',
    label: 'Date and place',
    values: { card: 'In a box', stacked: 'In a list', inline: 'On one line' },
  },
  {
    key: 'decoration',
    label: 'Extra shape',
    values: { none: 'None', band: 'Soft band behind', circle: 'Soft circle behind' },
  },
];

export default function TemplateBuilder() {
  const { activeClientId } = useAuth();
  const [searchParams] = useSearchParams();
  const id = searchParams.get('template') || '';
  const [template, setTemplate] = useState(null);
  const [brandKit, setBrandKit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      if (!id) {
        setLoading(false);
        setError('Pick a template from the Templates page first.');
        return;
      }
      setLoading(true);
      setError('');
      try {
        const [templateRes, kitRes] = await Promise.all([
          api.get(`/templates/${id}`),
          api.get('/brand-kit').catch(() => null),
        ]);
        if (!active) return;
        setTemplate(templateRes?.data?.data?.template || null);
        setBrandKit(kitRes?.data?.success ? kitRes.data.data?.brandKit || null : null);
        if (!templateRes?.data?.data?.template) setError('We could not find that template.');
      } catch (err) {
        if (active) setError(err?.response?.data?.error?.message || 'We could not open this template.');
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [id, activeClientId]);

  const rendered = useMemo(() => (template ? resolveTemplateRender(template) : null), [template]);

  if (loading) {
    return (
      <div className="container-page section-pad flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container-page section-pad space-y-6">
      <div className="pb-6 border-b border-line flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <Link to="/templates" className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading">
            <ArrowLeft className="h-4 w-4" /> All templates
          </Link>
          <h1 className="text-2xl mt-1 truncate">{template?.name || 'Template'}</h1>
          <p className="text-sm text-muted mt-1">
            How this layout places the words, the photo and the information.
          </p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </div>
      )}

      {template && rendered && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="card-surface p-4">
            <div className="mx-auto w-full max-w-[360px]">
              <PosterPreview brandKit={brandKit} template={template} content={TEMPLATE_SAMPLE_CONTENT} showZoneBorders />
            </div>
            <p className="mt-3 text-xs text-muted">
              The top and bottom bands always come from your brand kit. Colours, logo and contacts cannot be
              changed here.
            </p>
          </div>

          <div className="space-y-4">
            <section className="card-surface p-4 space-y-2">
              <h2 className="text-sm font-semibold text-heading">Areas</h2>
              <ul className="space-y-1.5 text-sm text-body">
                {[
                  { type: 'header', zone: rendered.zones.header },
                  { type: 'content', zone: rendered.zones.content },
                  { type: 'image', zone: rendered.zones.image },
                  { type: 'footer', zone: rendered.zones.footer },
                ]
                  .filter((row) => row.zone)
                  .map((row) => (
                    <li key={row.type} className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-2">
                        {row.type === 'image' ? (
                          <ImageIcon className="h-3.5 w-3.5 text-muted" />
                        ) : (
                          <span className="h-2 w-2 rounded-full bg-primary/60" />
                        )}
                        {AREA_LABELS[row.type]}
                      </span>
                      <span className="text-xs text-muted">
                        {row.zone.w} × {row.zone.h}
                      </span>
                    </li>
                  ))}
              </ul>
              <p className="text-xs text-muted pt-1">
                Text size in this layout: {rendered.fonts.minFont}–{rendered.fonts.maxFont}
              </p>
            </section>

            <section className="card-surface p-4 space-y-2">
              <h2 className="text-sm font-semibold text-heading">Placement</h2>
              <ul className="space-y-1.5 text-sm text-body">
                {SETTINGS.map((row) => (
                  <li key={row.key} className="flex items-center justify-between gap-2">
                    <span className="text-muted">{row.label}</span>
                    <span>{row.values[rendered.layout[row.key]] || row.values[LAYOUT_BASE[row.key]]}</span>
                  </li>
                ))}
              </ul>
            </section>

            <p className="text-xs text-muted rounded-card bg-section border border-line px-3 py-2">
              Moving areas and changing these settings opens with the template editor in the next update.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
