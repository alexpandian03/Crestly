import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  History as HistoryIcon,
  Keyboard,
  Loader2,
  Monitor,
  Redo2,
  Save,
  Undo2,
} from 'lucide-react';
import api from '../services/api';
import PosterPreview from '../components/PosterPreview';
import AreaStage from '../components/builder/AreaStage';
import AreaSettings, { LayoutFields } from '../components/builder/AreaSettings';
import VersionDrawer from '../components/builder/VersionDrawer';
import { useAuth } from '../context/AuthContext';
import { TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';
import { FONT_DEFAULTS, TEMPLATE_CATEGORIES } from '../utils/templateRender';
import {
  HISTORY_LIMIT,
  draftKey as keyOf,
  draftOfTemplate as draftOf,
  MIN_AREA_SIZE,
  NOTE_LIMIT,
  areaOf,
  brandEdges,
  constrainArea,
  firstProblem,
  GRID_STEP,
  isEditableType,
  validateDraft,
} from '../utils/templateBuilderRules';

/* Sample words for the three previews: the usual set, a long set, and no photo. */
const LONG_SAMPLE = {
  title: 'Annual Community Fair and Harvest Celebration',
  tagline: 'One whole day of food, music, games and craft stalls for every member of the family',
  date: 'Saturday 18 October 2026',
  time: '10 in the morning until half past six in the evening',
  venue: 'Riverside Grounds, next to the old bridge, with parking on Meadow Road',
  details: [
    'Food stalls, crafts and a cake competition on the main lawn',
    'Live music all afternoon on the bandstand stage',
    'Free entry for children under twelve and for school groups',
    'Prize draw at the close of the day for everyone who signs the book',
  ],
};

function historyReducer(state, action) {
  if (action.type === 'live') return { ...state, present: action.present };
  if (action.type === 'commit') {
    const from = action.from ?? state.present;
    return { past: [...state.past, from].slice(-HISTORY_LIMIT), present: action.present ?? state.present, future: [] };
  }
  if (action.type === 'undo') {
    if (state.past.length === 0) return state;
    const past = [...state.past];
    const previous = past.pop();
    return { past, present: previous, future: [state.present, ...state.future].slice(0, HISTORY_LIMIT) };
  }
  if (action.type === 'redo') {
    if (state.future.length === 0) return state;
    const [next, ...rest] = state.future;
    return { past: [...state.past, state.present].slice(-HISTORY_LIMIT), present: next, future: rest };
  }
  if (action.type === 'reset') return { past: [], present: action.present, future: [] };
  return state;
}

/** True only on a screen wide enough to show the three panels. */
function useWideScreen() {
  const [wide, setWide] = useState(() => (typeof window === 'undefined' ? true : window.innerWidth >= 1024));
  useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const update = () => setWide(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return wide;
}

export default function TemplateEdit() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const wide = useWideScreen();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saved, setSaved] = useState(null); // the template as the server last returned it
  const [brandKit, setBrandKit] = useState(null);
  const [namesById, setNamesById] = useState({});

  const [hist, dispatch] = useReducer(historyReducer, { past: [], present: null, future: [] });
  const [baseline, setBaseline] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [previewOn, setPreviewOn] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [banner, setBanner] = useState(null); // { tone: 'error' | 'ok', text, action? }

  const draft = hist.present;
  const draftRef = useRef(null);
  useEffect(() => {
    draftRef.current = hist.present;
  }, [hist.present]);
  const txRef = useRef(null);
  const read = useCallback(() => draftRef.current, []);

  const dirty = Boolean(draft) && keyOf(draft) !== baseline;

  /* ------------------------------------------------------------- load */
  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [templateRes, kitRes, usersRes] = await Promise.all([
        api.get(`/templates/${id}`),
        api.get('/brand-kit').catch(() => null),
        api.get('/users').catch(() => null),
      ]);
      const template = templateRes?.data?.data?.template;
      if (!template) {
        setLoadError('We could not find this template.');
        return false;
      }
      setSaved(template);
      setBrandKit(kitRes?.data?.success ? kitRes.data.data?.brandKit || null : null);
      if (usersRes?.data?.success) {
        setNamesById(
          (usersRes.data.data?.users || []).reduce((acc, item) => {
            acc[String(item.id || item._id)] = item.name;
            return acc;
          }, {})
        );
      }
      const next = draftOf(template);
      setBaseline(keyOf(next));
      dispatch({ type: 'reset', present: next });
      setSelectedId(areaOf(next.zones, 'content')?.id || next.zones[0]?.id || '');
      txRef.current = null;
      return true;
    } catch (err) {
      setLoadError(err?.response?.data?.error?.message || 'We could not open this template.');
      return false;
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  /* ------------------------------------------------------- edits */
  const write = useCallback((next, live) => {
    if (!next) return;
    dispatch(live ? { type: 'live', present: next } : { type: 'commit', present: next });
  }, []);

  const begin = useCallback(() => {
    if (txRef.current === null && draftRef.current) txRef.current = draftRef.current;
  }, []);

  const end = useCallback(() => {
    const from = txRef.current;
    txRef.current = null;
    if (from && draftRef.current && keyOf(from) !== keyOf(draftRef.current)) {
      dispatch({ type: 'commit', from, present: draftRef.current });
    }
  }, []);

  const setAreaRect = useCallback(
    (zoneId, rect, { live = false, grid = GRID_STEP } = {}) => {
      const current = read();
      if (!current) return;
      const zone = current.zones.find((item) => item.id === zoneId);
      if (!zone) return;
      const fixed = constrainArea({ ...zone, ...rect }, { size: current.size, zones: current.zones, grid });
      write(
        {
          ...current,
          zones: current.zones.map((item) => (item.id === zoneId ? { ...item, ...fixed } : item)),
        },
        live
      );
    },
    [read, write]
  );

  const patchArea = useCallback(
    (zoneId, patch, live = false) => {
      const current = read();
      if (!current) return;
      const zone = current.zones.find((item) => item.id === zoneId);
      if (!zone) return;
      const merged = { ...zone, ...patch };
      const next =
        isEditableType(zone.type) && !zone.locked
          ? {
              ...merged,
              ...constrainArea(merged, { size: current.size, zones: current.zones, grid: 1 }),
            }
          : merged;
      write({ ...current, zones: current.zones.map((item) => (item.id === zoneId ? next : item)) }, live);
    },
    [read, write]
  );

  const setLayoutValue = useCallback(
    (key, value) => {
      const current = read();
      if (!current) return;
      write({ ...current, layout: { ...current.layout, [key]: value } });
    },
    [read, write]
  );

  const setMeta = useCallback(
    (key, value, live = false) => {
      const current = read();
      if (!current) return;
      write({ ...current, [key]: value }, live);
    },
    [read, write]
  );

  const setLocked = useCallback(
    (zoneId, value) => {
      const current = read();
      const zone = current?.zones.find((item) => item.id === zoneId);
      if (!current || !zone || !isEditableType(zone.type)) return;
      write({ ...current, zones: current.zones.map((item) => (item.id === zoneId ? { ...item, locked: value } : item)) });
    },
    [read, write]
  );

  const addImage = useCallback(() => {
    const current = read();
    if (!current || areaOf(current.zones, 'image')) return;
    const content = areaOf(current.zones, 'content');
    const edges = brandEdges(current.zones, current.size);
    const wanted = 320;
    const below = content ? content.y + content.h : edges.top;
    /* Prefer the free strip under the words; use the strip above them when it is too narrow. */
    let y = below;
    let height = Math.min(wanted, edges.bottom - below);
    if (height < MIN_AREA_SIZE.height) {
      y = Math.max(edges.top, (content?.y ?? edges.bottom) - wanted);
      height = Math.min(wanted, (content?.y ?? edges.bottom) - edges.top);
    }
    const rect = constrainArea(
      { x: content?.x ?? 0, y, w: content?.w ?? current.size.width, h: Math.max(MIN_AREA_SIZE.height, height) },
      { size: current.size, zones: current.zones }
    );
    const zone = {
      id: `area-image-${Date.now().toString(36)}`,
      type: 'image',
      locked: false,
      ...FONT_DEFAULTS,
      ...rect,
    };
    const zones = [...current.zones];
    const footerIndex = zones.findIndex((item) => item.type === 'footer');
    zones.splice(footerIndex < 0 ? zones.length : footerIndex, 0, zone);
    const layout =
      current.layout.imagePlacement === 'none'
        ? { ...current.layout, imagePlacement: 'middle' }
        : current.layout;
    write({ ...current, zones, layout });
    setSelectedId(zone.id);
    setPreviewOn(false);
  }, [read, write]);

  const removeImage = useCallback(() => {
    const current = read();
    if (!current || !areaOf(current.zones, 'image')) return;
    const zones = current.zones.filter((item) => item.type !== 'image');
    write({ ...current, zones });
    setSelectedId(areaOf(zones, 'content')?.id || '');
  }, [read, write]);

  const nudge = useCallback(
    (dx, dy) => {
      const current = read();
      const zone = current?.zones.find((item) => item.id === selectedId);
      if (!current || !zone || !isEditableType(zone.type) || zone.locked) return;
      setAreaRect(zone.id, { x: zone.x + dx, y: zone.y + dy }, { grid: GRID_STEP });
    },
    [read, selectedId, setAreaRect]
  );

  /* ---------------------------------------------------- keyboard */
  useEffect(() => {
    const onKey = (event) => {
      const el = event.target;
      const typing =
        el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || el.isContentEditable);
      const meta = event.metaKey || event.ctrlKey;
      const key = event.key.toLowerCase();

      if (meta && (key === 'z' || key === 'y') && !typing) {
        event.preventDefault();
        const redo = key === 'y' || (event.shiftKey && key === 'z');
        dispatch({ type: redo ? 'redo' : 'undo' });
        return;
      }
      if (typing || previewOn || drawerOpen || !draft) return;

      const arrows = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] };
      if (arrows[key]) {
        event.preventDefault();
        const step = event.shiftKey ? GRID_STEP * 5 : GRID_STEP;
        const [dx, dy] = arrows[key];
        nudge(dx * step, dy * step);
        return;
      }
      if (key === 'delete' || key === 'backspace') {
        const zone = draft.zones.find((item) => item.id === selectedId);
        if (zone?.type === 'image') {
          event.preventDefault();
          removeImage();
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen, draft, nudge, previewOn, removeImage, selectedId]);

  /* ------------------------------------------------- leaving guard */
  useEffect(() => {
    if (!dirty) return undefined;
    const onBeforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = true;
      return true;
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const goBack = () => {
    if (dirty && !window.confirm('Leave with these changes unsaved? Your edits to this layout will be lost.')) return;
    navigate('/templates');
  };

  /* --------------------------------------------------------- save */
  const problems = useMemo(() => (draft ? validateDraft(draft) : []), [draft]);

  const applySaved = (template) => {
    const next = draftOf(template);
    setSaved(template);
    setBaseline(keyOf(next));
    dispatch({ type: 'reset', present: next });
    txRef.current = null;
    return next;
  };

  const save = async () => {
    if (!draft) return;
    if (problems.length > 0) {
      setBanner({ tone: 'error', text: firstProblem(problems) });
      return;
    }
    setSaving(true);
    setBanner(null);
    try {
      const response = await api.patch(`/templates/${id}`, {
        name: draft.name.trim(),
        category: draft.category,
        size: draft.size,
        zones: draft.zones,
        layout: draft.layout,
        note: note.trim() || undefined,
        expectedVersion: saved?.version,
      });
      const updated = response?.data?.data?.template;
      if (!updated) throw new Error('missing template');
      applySaved(updated);
      setNote('');
      setBanner({ tone: 'ok', text: `Saved as version ${updated.version}.` });
      toast.success(`Saved as version ${updated.version}`);
    } catch (err) {
      const status = err?.response?.status;
      const message = err?.response?.data?.error?.message || 'That did not save. Try again.';
      setBanner({
        tone: 'error',
        text: message,
        action: status === 409 || status === 404 ? { label: 'Reload this template', run: () => load() } : undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  const restore = async (version) => {
    if (
      !window.confirm(
        `Load version ${version} into the editor?\n\nWhat you have now is kept as its own version, so nothing is lost.`
      )
    ) {
      return;
    }
    setRestoring(true);
    setBanner(null);
    try {
      const response = await api.post(`/templates/${id}/restore`, { version });
      const updated = response?.data?.data?.template;
      if (!updated) throw new Error('missing template');
      const next = applySaved(updated);
      setSelectedId(areaOf(next.zones, 'content')?.id || '');
      setDrawerOpen(false);
      setPreviewOn(false);
      setBanner({ tone: 'ok', text: `Version ${version} is back in the editor, saved as version ${updated.version}.` });
      toast.success(`Restored version ${version}`);
    } catch (err) {
      const status = err?.response?.status;
      setBanner({
        tone: 'error',
        text: err?.response?.data?.error?.message || 'That version could not be restored.',
        action: status === 409 ? { label: 'Reload this template', run: () => load() } : undefined,
      });
    } finally {
      setRestoring(false);
    }
  };

  const discard = () => {
    if (!saved) return;
    if (!window.confirm('Undo everything back to the last save?')) return;
    const next = draftOf(saved);
    dispatch({ type: 'reset', present: next });
    setBaseline(keyOf(next));
    txRef.current = null;
    setBanner(null);
  };

  /* -------------------------------------------------------- render */
  if (loading) {
    return (
      <div className="container-page section-pad flex justify-center py-20">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (loadError || !draft) {
    return (
      <div className="container-page section-pad space-y-4">
        <div className="p-4 rounded-card border border-danger/30 bg-danger/5 text-danger text-sm flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" /> {loadError || 'This template could not be opened.'}
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => load()} className="btn-primary px-4 py-2 text-sm">
            Try again
          </button>
          <button type="button" onClick={() => navigate('/templates')} className="btn-ghost border border-line px-4 py-2 text-sm">
            Back to templates
          </button>
        </div>
      </div>
    );
  }

  const draftTemplate = {
    id,
    name: draft.name,
    category: draft.category,
    size: draft.size,
    zones: draft.zones,
    layout: draft.layout,
  };

  const previews = [
    { key: 'sample', label: 'Sample words', template: draftTemplate, content: TEMPLATE_SAMPLE_CONTENT },
    { key: 'long', label: 'Long words', template: draftTemplate, content: LONG_SAMPLE },
    {
      key: 'noPhoto',
      label: 'No photo',
      template: { ...draftTemplate, layout: { ...draft.layout, imagePlacement: 'none' } },
      content: TEMPLATE_SAMPLE_CONTENT,
    },
  ];

  const stageProps = {
    size: draft.size,
    zones: draft.zones,
    brandKit,
    template: draftTemplate,
    content: TEMPLATE_SAMPLE_CONTENT,
    selectedId,
    onSelect: setSelectedId,
    onLiveChange: (zoneId, rect) => setAreaRect(zoneId, rect, { live: true }),
    onBegin: begin,
    onEnd: end,
  };

  const settingsApi = {
    patchArea,
    begin,
    end,
    setLayout: setLayoutValue,
    setLocked,
    addImage,
    removeImage,
  };

  /* The canvas column is sticky and 16 px clear of the bottom of the screen. Its top
   * sits just under the sticky app header: 64 px tall, plus the 44 px organization bar
   * that only a superadmin sees. */
  const stickyTop = 64 + (user?.role === 'superadmin' ? 44 : 0) + 16;

  return (
    <div className="container-page section-pad space-y-5">
      <header className="pb-4 border-b border-line space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-sm text-muted hover:text-heading"
            >
              <ArrowLeft className="h-4 w-4" /> All templates
            </button>
            <h1 className="text-2xl mt-1 truncate">{draft.name || 'Template'}</h1>
            <p className="text-sm text-muted mt-1">
              Version {saved?.version || 1} · {draft.size.width} × {draft.size.height} pixels ·{' '}
              <Link to={`/templates/builder?template=${id}`} className="underline hover:text-heading">
                How this layout works
              </Link>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-1 text-[11px] font-semibold ${
                dirty ? 'border-line bg-section text-body' : 'border-success/30 bg-success/10 text-success'
              }`}
            >
              {dirty ? 'Not saved yet' : 'Saved'}
            </span>
            <button
              type="button"
              onClick={() => setPreviewOn((on) => !on)}
              aria-pressed={previewOn}
              className={`btn-ghost border inline-flex items-center gap-2 px-3 py-2 text-sm ${
                previewOn ? 'border-primary text-primary' : 'border-line'
              }`}
            >
              <Eye className="h-4 w-4" /> {previewOn ? 'Back to editing' : 'Preview'}
            </button>
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className="btn-ghost border border-line inline-flex items-center gap-2 px-3 py-2 text-sm"
            >
              <HistoryIcon className="h-4 w-4" /> Versions
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || problems.length > 0}
              className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex-1 min-w-[240px] block">
            <span className="block text-xs font-semibold text-heading">Note for this save (optional)</span>
            <input
              type="text"
              value={note}
              maxLength={NOTE_LIMIT}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What did you change? For example: more room for the photo"
              className="input-field mt-1.5"
            />
          </label>
          {dirty ? (
            <button type="button" onClick={discard} className="btn-ghost border border-line px-3 py-2 text-sm">
              Undo everything
            </button>
          ) : null}
        </div>

        {banner && (
          <div
            className={`p-4 rounded-card border text-sm flex flex-wrap items-start gap-2 ${
              banner.tone === 'ok'
                ? 'border-success/30 bg-success/5 text-success'
                : 'border-danger/30 bg-danger/5 text-danger'
            }`}
          >
            {banner.tone === 'ok' ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span className="flex-1">{banner.text}</span>
            {banner.action ? (
              <button type="button" onClick={banner.action.run} className="underline shrink-0">
                {banner.action.label}
              </button>
            ) : null}
          </div>
        )}

        {problems.length > 0 && (
          <div className="p-4 rounded-card border border-danger/30 bg-danger/5 space-y-1.5">
            <p className="text-sm font-semibold text-danger">{firstProblem(problems)}</p>
            {problems.length > 1 && (
              <ul className="text-xs text-danger list-disc pl-5 space-y-0.5">
                {problems.slice(1).map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        )}
      </header>

      {!wide ? (
        <div className="space-y-5">
          <div className="card-surface p-5 flex items-start gap-3">
            <Monitor className="h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-sm font-semibold text-heading">Use a larger screen to edit templates</p>
              <p className="text-sm text-muted mt-1">
                Moving areas needs room for the poster and its settings side by side. Below is a look at this
                layout as it stands, so you can still check it on a phone.
              </p>
            </div>
          </div>
          <div className="card-surface p-4">
            <div className="mx-auto w-full max-w-[360px]">
              <PosterPreview brandKit={brandKit} template={draftTemplate} content={TEMPLATE_SAMPLE_CONTENT} />
            </div>
          </div>
        </div>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[240px_minmax(0,1fr)_300px] items-start">
          <div className="space-y-4">
            <section className="card-surface p-4 space-y-4">
              <h2 className="text-sm font-semibold text-heading">Template</h2>
              <label className="block">
                <span className="block text-xs font-semibold text-heading">Name</span>
                <input
                  type="text"
                  value={draft.name}
                  maxLength={120}
                  onFocus={begin}
                  onChange={(event) => setMeta('name', event.target.value, true)}
                  onBlur={end}
                  className="input-field mt-1.5"
                />
              </label>
              <label className="block">
                <span className="block text-xs font-semibold text-heading">Category</span>
                <select
                  value={draft.category}
                  onChange={(event) => setMeta('category', event.target.value)}
                  className="input-field mt-1.5"
                >
                  {TEMPLATE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>
              <p className="text-xs text-muted">
                Poster size: {draft.size.width} × {draft.size.height} pixels. Change it with the brand kit
                settings or ask for a new template.
              </p>
            </section>

            <section className="card-surface p-4 space-y-3">
              <h2 className="text-sm font-semibold text-heading">Layout settings</h2>
              <p className="text-xs text-muted -mt-1">
                How the words, the photo and the date and place information sit on the poster.
              </p>
              <LayoutFields layout={draft.layout} onChange={setLayoutValue} />
            </section>

            <section className="card-surface p-4 space-y-2">
              <h2 className="text-sm font-semibold text-heading inline-flex items-center gap-2">
                <Keyboard className="h-4 w-4 text-primary" /> Keys
              </h2>
              <ul className="text-xs text-body space-y-1.5">
                <li>Arrow keys move the selected area by {GRID_STEP} pixels, Shift for {GRID_STEP * 5}.</li>
                <li>Delete removes the photo area.</li>
                <li>Ctrl or Command with Z goes back, with Y comes forward.</li>
              </ul>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'undo' })}
                  disabled={hist.past.length === 0}
                  className="btn-ghost border border-line inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  <Undo2 className="h-3.5 w-3.5" /> Back
                </button>
                <button
                  type="button"
                  onClick={() => dispatch({ type: 'redo' })}
                  disabled={hist.future.length === 0}
                  className="btn-ghost border border-line inline-flex items-center gap-1.5 px-3 py-1.5 text-xs disabled:opacity-40"
                >
                  <Redo2 className="h-3.5 w-3.5" /> Forward
                </button>
              </div>
            </section>
          </div>

          <div
            className="card-surface sticky flex min-h-0 flex-col self-start p-4"
            style={{ top: `${stickyTop}px`, height: 'calc(100vh - 140px)' }}
          >
            {previewOn ? (
              <div className="flex min-h-0 flex-1 flex-col gap-3">
                <div className="shrink-0">
                  <h2 className="text-sm font-semibold text-heading">How the words fit</h2>
                  <p className="text-xs text-muted">
                    This is the real poster with your brand kit, in three sets of words: the usual sample, a long
                    one, and one without a photo.
                  </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {previews.map((item) => (
                      <div key={item.key} className="space-y-1.5">
                        <p className="text-[11px] font-semibold text-muted uppercase tracking-wider">{item.label}</p>
                        <div className="rounded-card border border-line bg-preview p-2">
                          <PosterPreview brandKit={brandKit} template={item.template} content={item.content} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <AreaStage {...stageProps} />
            )}
          </div>

          <AreaSettings
            zones={draft.zones}
            layout={draft.layout}
            size={draft.size}
            selectedId={selectedId}
            onSelect={setSelectedId}
            api={settingsApi}
          />
        </div>
      )}

      {drawerOpen ? (
        <VersionDrawer
          versions={saved?.versions || []}
          currentVersion={saved?.version || 1}
          brandKit={brandKit}
          namesById={namesById}
          currentUserId={user?.id || ''}
          restoring={restoring}
          onClose={() => setDrawerOpen(false)}
          onRestore={restore}
        />
      ) : null}
    </div>
  );
}
