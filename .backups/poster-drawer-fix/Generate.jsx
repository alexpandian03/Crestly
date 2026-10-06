import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import ReactDOM from 'react-dom';
import {
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  Edit3,
  Lock,
  Minimize2,
  Briefcase,
  Calendar,
  Image as ImageIcon,
  AlertTriangle,
} from 'lucide-react';
import api from '../services/api';
import PosterPreview from '../components/PosterPreview';
import PosterExportButtons from '../components/PosterExportButtons';
import PosterImageInput from '../components/PosterImageInput';
import EditTextPanel from '../components/EditTextPanel';
import PosterCanvas from '../components/PosterCanvas';
import TemplateThumb from '../components/TemplateThumb';
import { renderPosterJpeg } from '../utils/exportPoster';
import { canvasBaseColor } from '../utils/brandRender';
import { readDraft } from '../config/draft';
import { DEMO_TEMPLATE, SAMPLE_PROMPTS, TEMPLATE_SAMPLE_CONTENT } from '../data/demoPosters';
import { useAuth } from '../context/AuthContext';

const templateId = (template) => template?.id || template?._id;

const isRealId = (id) => typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);

const THUMBNAIL_MAX_BYTES = 300 * 1024;

function buildContentPayload(content) {
  if (!content) return null;
  return {
    title: String(content.title || '').trim(),
    tagline: String(content.tagline || '').trim(),
    date: String(content.date || '').trim(),
    time: String(content.time || '').trim(),
    venue: String(content.venue || '').trim(),
    details: Array.isArray(content.details)
      ? content.details.map((d) => String(d).trim()).filter(Boolean).slice(0, 4)
      : [],
    imageUrl: String(content.imageUrl || content.image || '').trim(),
  };
}

function friendlySaveError(err) {
  const status = err.response?.status;
  if (status === 409) {
    return { message: 'This poster was changed somewhere else. Reload to continue.', conflict: true };
  }
  if (status === 404) {
    return { message: "We couldn't find this poster. It may have been deleted.", conflict: false };
  }
  return { message: "We couldn't save this poster. Try again.", conflict: false };
}

const REFINEMENT_BUTTONS = [
  { label: 'Regenerate', instruction: undefined, icon: RefreshCw },
  { label: 'Shorter', instruction: 'shorter', icon: Minimize2 },
  { label: 'Minimal', instruction: 'minimal', icon: Sparkles },
  { label: 'More professional', instruction: 'more professional', icon: Briefcase },
  { label: 'Emphasize date', instruction: 'emphasize date', icon: Calendar },
  { label: 'New photo', instruction: 'change image', icon: ImageIcon },
];

function SkeletonPoster() {
  return (
    <div className="w-full max-w-[420px] mx-auto">
      <div className="aspect-[4/5] rounded-card bg-line/70 animate-pulse shadow-soft" />
      <p className="sr-only">Creating your poster preview</p>
    </div>
  );
}

export default function Generate() {
  const { activeClientId } = useAuth();
  const [description, setDescription] = useState('');
  const [activeInstruction, setActiveInstruction] = useState('');
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [brandKit, setBrandKit] = useState(null);
  const [generatedContent, setGeneratedContent] = useState(null);
  const [rawGeneratedContent, setRawGeneratedContent] = useState(null);
  const [historyStack, setHistoryStack] = useState([]);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [feedback, setFeedback] = useState({ type: null, message: '' });
  const [userImageUrl, setUserImageUrl] = useState('');
  const [imageLoadError, setImageLoadError] = useState(false);
  const [overflowWarning, setOverflowWarning] = useState(null);
  const aiImageRef = useRef('');

  // Stage 8C: poster persistence state
  const [searchParams] = useSearchParams();
  const [posterId, setPosterId] = useState('');
  const [currentVersion, setCurrentVersion] = useState(1);
  const [saveStatus, setSaveStatus] = useState('idle'); // idle | saving | saved
  const [saveError, setSaveError] = useState(null); // { message, conflict }
  const [showSavedChip, setShowSavedChip] = useState(false);
  const [isSavingEdits, setIsSavingEdits] = useState(false);
  const [drawerSaveError, setDrawerSaveError] = useState('');
  const [drawerConflict, setDrawerConflict] = useState(false);
  const posterIdRef = useRef('');
  const versionRef = useRef(1);
  const savedSnapshotRef = useRef('');
  const retryOpRef = useRef(null);
  const thumbSeqRef = useRef(0);
  const savedChipTimerRef = useRef(null);

  useEffect(() => () => clearTimeout(savedChipTimerRef.current), []);

  const markSaved = (content) => {
    savedSnapshotRef.current = JSON.stringify(buildContentPayload(content));
  };

  useEffect(() => {
    const draft = readDraft();
    if (draft) setDescription(draft);
  }, []);

  useEffect(() => {
    async function loadInitialData() {
      try {
        setLoadingInitial(true);
        const [templatesRes, brandKitRes] = await Promise.all([
          api.get('/templates').catch(() => null),
          api.get('/brand-kit').catch(() => null),
        ]);

        const loadedTemplates = templatesRes?.data?.data?.templates || [];
        if (templatesRes?.data?.success && loadedTemplates.length > 0) {
          setTemplates(loadedTemplates);
          if (!searchParams.get('poster')) {
            const firstActive = loadedTemplates.find((t) => t.isActive !== false);
            if (firstActive) setSelectedTemplateId(firstActive.id || firstActive._id);
          }
        } else {
          setTemplates([]);
          setSelectedTemplateId('');
        }

        const loadedBrandKit = brandKitRes?.data?.data?.brandKit;
        setBrandKit(brandKitRes?.data?.success && loadedBrandKit ? loadedBrandKit : null);
      } catch (err) {
        console.warn('Initial data load warning:', err.message);
      } finally {
        setLoadingInitial(false);
      }
    }

    loadInitialData();
  }, [activeClientId]);

  /* The Create page only ever offers layouts that are turned on. */
  const usableTemplates = useMemo(() => templates.filter((t) => t.isActive !== false), [templates]);

  // Compute category list from loaded templates
  const categories = useMemo(() => {
    const set = new Set();
    usableTemplates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return set.size > 0 ? ['All', ...Array.from(set)] : ['All'];
  }, [usableTemplates]);

  const filteredTemplates = useMemo(() => {
    if (selectedCategory === 'All') return usableTemplates;
    return usableTemplates.filter((t) => (t.category || 'General').toLowerCase() === selectedCategory.toLowerCase());
  }, [usableTemplates, selectedCategory]);

  const runGenerate = async (extraInstruction) => {
    const inst = extraInstruction !== undefined ? extraInstruction : activeInstruction;
    if (!description.trim() || description.trim().length < 5) {
      setFeedback({
        type: 'error',
        message: 'Please write a sentence describing the event.',
      });
      return;
    }

    if (!selectedTemplateId && usableTemplates.length > 0) {
      setFeedback({ type: 'error', message: 'Please choose a layout.' });
      return;
    }

    try {
      setIsGenerating(true);
      setFeedback({ type: null, message: '' });
      setOverflowWarning(null);

      const resolvedTemplateId = getRealTemplateId();

      const payload = {
        ...(resolvedTemplateId ? { templateId: resolvedTemplateId } : {}),
        prompt: description.trim(),
        ...(inst ? { instruction: inst } : {}),
      };

      const res = await api.post('/posters/generate', payload);

      if (res.data?.data?.content) {
        const aiContent = res.data.data.content;
        if (!userImageUrl) {
          aiImageRef.current = aiContent.imageUrl || aiContent.image || '';
        }
        const chosenImage = userImageUrl || aiContent.imageUrl || aiContent.image || '';
        const merged = {
          ...aiContent,
          imageUrl: chosenImage,
          image: chosenImage,
        };
        setRawGeneratedContent(merged);
        setGeneratedContent(merged);
        setHistoryStack([]);
        setActiveInstruction(inst || '');
        setFeedback({
          type: 'success',
          message: 'Poster ready! Download your file or refine the wording below.',
        });

        const savedPayload = buildContentPayload(merged);
        if (savedPayload.title) {
          runSaveOp(
            posterIdRef.current
              ? { mode: 'version', content: savedPayload, instruction: inst || undefined }
              : {
                  mode: 'create',
                  content: savedPayload,
                  templateId: getRealTemplateId(),
                  prompt: description.trim().slice(0, 1000),
                }
          );
        }
      }
    } catch (err) {
      const serverMessage = err.response?.data?.error?.message;
      let displayMessage = 'We could not create the poster. Please try again.';
      if (err.response?.status === 504) {
        displayMessage = 'The request took a little too long. Please try again.';
      } else if (
        serverMessage &&
        !serverMessage.toLowerCase().includes('mongo') &&
        !serverMessage.toLowerCase().includes('internal')
      ) {
        displayMessage = serverMessage;
      }
      setFeedback({ type: 'error', message: displayMessage });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleApplyEdit = (next) => {
    setHistoryStack((prev) => {
      const snapshot = generatedContent || posterContent;
      return snapshot ? [...prev.slice(-20), snapshot] : prev;
    });
    setGeneratedContent(next);
  };

  const handleUndo = () => {
    if (historyStack.length === 0) return;
    const previous = historyStack[historyStack.length - 1];
    setHistoryStack((prev) => prev.slice(0, -1));
    setGeneratedContent(previous);
  };

  const handleResetToGenerated = () => {
    if (!rawGeneratedContent) return;
    setHistoryStack((prev) => {
      const snapshot = generatedContent || posterContent;
      return snapshot ? [...prev.slice(-20), snapshot] : prev;
    });
    setGeneratedContent(rawGeneratedContent);
  };

  const handleGenerate = async (e) => {
    e?.preventDefault();
    await runGenerate();
  };

  const selectedTemplate =
    usableTemplates.find((template) => templateId(template) === selectedTemplateId) ||
    usableTemplates[0] ||
    DEMO_TEMPLATE;

  const chosenImageUrl = userImageUrl || generatedContent?.imageUrl || generatedContent?.image || '';
  const posterContent = generatedContent
    ? { ...generatedContent, imageUrl: chosenImageUrl, image: chosenImageUrl }
    : userImageUrl
      ? {
          title: '',
          tagline: '',
          date: '',
          time: '',
          venue: '',
          details: [],
          imageUrl: userImageUrl,
          image: userImageUrl,
        }
      : null;

  useEffect(() => {
    setImageLoadError(false);
  }, [chosenImageUrl]);

  const ready = Boolean(brandKit && selectedTemplate && posterContent);

  const contentSnapshot = useMemo(
    () => (posterContent ? JSON.stringify(buildContentPayload(posterContent)) : ''),
    [generatedContent, userImageUrl]
  );
  const hasUnsavedChanges = Boolean(posterContent) && contentSnapshot !== savedSnapshotRef.current;

  const getRealTemplateId = () => {
    const chosen = templateId(selectedTemplate);
    return isRealId(chosen) ? String(chosen) : '';
  };

  // Warn when leaving the tab with unsaved poster changes
  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedChanges]);

  // Load an existing poster with /create?poster=<id>
  useEffect(() => {
    const paramId = searchParams.get('poster');
    if (!isRealId(paramId)) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get(`/posters/${paramId}`);
        const loaded = res.data?.data?.poster;
        if (cancelled || !loaded) return;
        const content = { ...loaded.content, image: loaded.content?.imageUrl || '' };
        posterIdRef.current = String(loaded._id);
        setPosterId(posterIdRef.current);
        versionRef.current = loaded.currentVersion || 1;
        setCurrentVersion(versionRef.current);
        setGeneratedContent(content);
        setRawGeneratedContent(content);
        setUserImageUrl(loaded.content?.imageUrl || '');
        if (loaded.templateId) setSelectedTemplateId(String(loaded.templateId));
        if (loaded.prompt) setDescription(loaded.prompt);
        markSaved(content);
        setSaveError(null);
        retryOpRef.current = null;
        setFeedback({ type: 'success', message: 'Poster loaded. Edit, refine or download it below.' });
      } catch (err) {
        if (cancelled) return;
        setFeedback({
          type: 'error',
          message:
            err.response?.status === 404
              ? "We couldn't find this poster. It may have been deleted."
              : 'We could not open this poster. Please try again.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // Background thumbnail: best-effort, never blocks or bothers the user
  const captureAndUploadThumbnail = async (id, content) => {
    if (!brandKit || !selectedTemplate) return;
    const seq = ++thumbSeqRef.current;
    const width = selectedTemplate?.size?.width || 1080;
    const height = selectedTemplate?.size?.height || 1350;
    const backgroundColor = canvasBaseColor(brandKit);

    const container = document.createElement('div');
    container.style.cssText = `position:fixed;left:-10000px;top:0;width:${width}px;height:${height}px;overflow:hidden;z-index:-1;pointer-events:none;`;
    document.body.appendChild(container);
    try {
      let settleResolve;
      const settled = new Promise((resolve) => {
        settleResolve = resolve;
      });
      await new Promise((resolve) => {
        ReactDOM.render(
          <PosterCanvas brandKit={brandKit} template={selectedTemplate} content={content} onLayoutSettled={settleResolve} />,
          container,
          resolve
        );
      });
      await Promise.race([settled, new Promise((resolve) => setTimeout(resolve, 3500))]);

      const node = container.firstElementChild;
      if (!node) return;
      await Promise.all(
        Array.from(node.querySelectorAll('img')).map((img) =>
          typeof img.decode === 'function' ? img.decode().catch(() => {}) : Promise.resolve()
        )
      );

      let blob = await renderPosterJpeg(node, { width, height }, { targetWidth: 400, quality: 0.7, backgroundColor });
      if (blob && blob.size > THUMBNAIL_MAX_BYTES) {
        blob = await renderPosterJpeg(node, { width, height }, { targetWidth: 400, quality: 0.5, backgroundColor });
      }
      if (!blob || blob.size > THUMBNAIL_MAX_BYTES || thumbSeqRef.current !== seq) return;

      const form = new FormData();
      form.append('image', blob, 'thumbnail.jpg');
      await api.post(`/posters/${id}/thumbnail`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    } catch {
      // ignore: thumbnails are optional
    } finally {
      ReactDOM.unmountComponentAtNode(container);
      document.body.removeChild(container);
    }
  };

  const queueThumbnail = (id, content) => {
    if (!id || !content) return;
    captureAndUploadThumbnail(id, { ...content, image: content.imageUrl || '' });
  };

  /**
   * Persists poster content. Modes:
   * - create: first save -> POST /posters
   * - version: after a regeneration -> POST /posters/:id/versions (note comes from instruction)
   * - patch: manual edits -> PATCH /posters/:id with expectedVersion
   * Returns { ok } plus a friendly message on failure.
   */
  const runSaveOp = async (op) => {
    try {
      setSaveStatus('saving');
      setSaveError(null);

      let poster;
      if (op.mode === 'create') {
        const res = await api.post('/posters', {
          templateId: op.templateId,
          prompt: op.prompt,
          content: op.content,
        });
        poster = res.data?.data?.poster;
      } else if (op.mode === 'version') {
        let expected = versionRef.current;
        if (op.refreshVersion && posterIdRef.current) {
          const fresh = await api.get(`/posters/${posterIdRef.current}`).catch(() => null);
          const freshVersion = fresh?.data?.data?.poster?.currentVersion;
          if (typeof freshVersion === 'number') {
            versionRef.current = freshVersion;
            setCurrentVersion(freshVersion);
            expected = freshVersion;
          }
        }
        const res = await api.post(`/posters/${posterIdRef.current}/versions`, {
          content: op.content,
          expectedVersion: expected,
          ...(op.instruction ? { instruction: op.instruction } : {}),
        });
        poster = res.data?.data?.poster;
      } else {
        const res = await api.patch(`/posters/${posterIdRef.current}`, {
          content: op.content,
          expectedVersion: versionRef.current,
        });
        poster = res.data?.data?.poster;
      }

      if (!poster?._id) throw new Error('Save returned no poster');

      posterIdRef.current = String(poster._id);
      setPosterId(posterIdRef.current);
      const nextVersion =
        typeof poster.currentVersion === 'number' ? poster.currentVersion : versionRef.current + 1;
      versionRef.current = nextVersion;
      setCurrentVersion(nextVersion);

      markSaved(op.content);
      retryOpRef.current = null;
      setSaveStatus('saved');
      setShowSavedChip(true);
      clearTimeout(savedChipTimerRef.current);
      savedChipTimerRef.current = setTimeout(() => setShowSavedChip(false), 2500);
      queueThumbnail(posterIdRef.current, op.content);
      return { ok: true };
    } catch (err) {
      const friendly = friendlySaveError(err);
      retryOpRef.current = op;
      setSaveStatus('idle');
      setSaveError(friendly);
      return { ok: false, ...friendly };
    }
  };

  const handleRetrySave = () => {
    const op = retryOpRef.current;
    if (!op) return;
    runSaveOp(op.mode === 'version' && posterIdRef.current ? { ...op, refreshVersion: true } : op);
  };

  // 409 recovery: pull the latest saved version back onto the screen
  const refreshPoster = async () => {
    const id = posterIdRef.current;
    if (!id) return;
    try {
      const res = await api.get(`/posters/${id}`);
      const loaded = res.data?.data?.poster;
      if (!loaded) throw new Error('missing poster');
      const content = { ...loaded.content, image: loaded.content?.imageUrl || '' };
      versionRef.current = loaded.currentVersion || 1;
      setCurrentVersion(versionRef.current);
      setGeneratedContent(content);
      setRawGeneratedContent(content);
      setUserImageUrl(loaded.content?.imageUrl || '');
      markSaved(content);
      setSaveError(null);
      setDrawerSaveError('');
      setDrawerConflict(false);
      setShowSavedChip(true);
      clearTimeout(savedChipTimerRef.current);
      savedChipTimerRef.current = setTimeout(() => setShowSavedChip(false), 2500);
    } catch {
      setSaveError({ message: 'We could not reload this poster. Please refresh the page.', conflict: false });
    }
  };

  const handleSaveChanges = async () => {
    const payload = buildContentPayload(posterContent);
    if (!payload || !payload.title) {
      setDrawerSaveError('Please add a headline before saving.');
      setDrawerConflict(false);
      return;
    }
    setIsSavingEdits(true);
    setDrawerSaveError('');
    setDrawerConflict(false);

    const result = posterIdRef.current
      ? await runSaveOp({ mode: 'patch', content: payload })
      : await runSaveOp({
          mode: 'create',
          content: payload,
          templateId: getRealTemplateId(),
          prompt: (description.trim() || payload.title).slice(0, 1000),
        });

    if (result.ok) {
      setRawGeneratedContent({ ...payload, image: payload.imageUrl });
    } else {
      setDrawerSaveError(result.message);
      setDrawerConflict(Boolean(result.conflict));
    }
    setIsSavingEdits(false);
  };

  const requestCloseEditor = () => {
    if (hasUnsavedChanges && !window.confirm('You have unsaved changes. Close the editor without saving?')) {
      return;
    }
    setIsEditOpen(false);
    setDrawerSaveError('');
    setDrawerConflict(false);
  };

  return (
    <div className="bg-canvas">
      <div className="container-page py-6 sm:py-8 space-y-6">
        <div>
          <h1 className="text-2xl sm:text-3xl tracking-tight">Create a poster</h1>
          <p className="text-sm text-muted mt-1">
            Describe your event in everyday words. Your logo, header, footer, and colors stay locked.
          </p>
        </div>

        {feedback.message && (
          <div
            className={`p-4 rounded-card text-sm flex items-center gap-3 border ${
              feedback.type === 'success'
                ? 'border-success/30 text-success bg-section'
                : 'border-danger/30 text-danger bg-section'
            }`}
            role="status"
          >
            {feedback.type === 'success' ? (
              <CheckCircle className="w-5 h-5 shrink-0" />
            ) : (
              <AlertCircle className="w-5 h-5 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {saveError && (
          <div
            className="p-4 rounded-card text-sm flex items-center justify-between gap-3 border border-danger/30 text-danger bg-section"
            role="alert"
          >
            <span className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{saveError.message}</span>
            </span>
            <span className="flex items-center gap-3 shrink-0">
              {saveError.conflict && posterId && (
                <button
                  type="button"
                  onClick={refreshPoster}
                  className="underline font-semibold hover:opacity-80"
                >
                  Reload latest
                </button>
              )}
              <button
                type="button"
                onClick={handleRetrySave}
                className="inline-flex items-center gap-1.5 rounded-btn border border-danger/40 bg-canvas px-3 py-1.5 text-xs font-semibold hover:bg-section"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Try again</span>
              </button>
            </span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Panel: Form Controls */}
          <div className="lg:col-span-5 card-surface p-5 sm:p-6">
            <form onSubmit={handleGenerate} className="space-y-5">
              {/* 1. Large Textarea */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="event-copy" className="block text-sm font-semibold text-heading">
                    What do you want to create?
                  </label>
                  <span className="text-xs text-muted">Everyday words</span>
                </div>
                <textarea
                  id="event-copy"
                  rows={5}
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your event. Mention the event name, date, time, and where it takes place..."
                  className="input-field min-h-[130px] resize-y"
                />
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs text-muted mr-1">Suggestions:</span>
                  {SAMPLE_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setDescription(prompt)}
                      className="rounded-chip border border-line bg-canvas px-2.5 py-0.5 text-xs text-body hover:border-primary hover:text-heading transition-colors"
                    >
                      {prompt.split(' on ')[0] || prompt.slice(0, 22)}
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Photo Picker */}
              <PosterImageInput
                value={userImageUrl}
                onChange={(url) => {
                  const next = url || '';
                  setUserImageUrl(next);
                  setImageLoadError(false);
                  setGeneratedContent((prev) => {
                    if (!prev && !next) return null;
                    return {
                      title: prev?.title || '',
                      tagline: prev?.tagline || '',
                      date: prev?.date || '',
                      time: prev?.time || '',
                      venue: prev?.venue || '',
                      details: prev?.details || [],
                      ...prev,
                      imageUrl: next || aiImageRef.current || '',
                      image: next || aiImageRef.current || '',
                    };
                  });
                }}
              />

              {/* 3. Template / Category Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-heading">Layout</label>
                  {categories.length > 2 && (
                    <div className="flex gap-1">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategory(cat)}
                          className={`text-xs px-2 py-0.5 rounded-chip transition-colors ${
                            selectedCategory.toLowerCase() === cat.toLowerCase()
                              ? 'bg-primary text-white'
                              : 'text-muted hover:text-heading bg-section'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {filteredTemplates.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto pr-1">
                    {filteredTemplates.map((t) => {
                      const id = templateId(t);
                      const isSelected = id === selectedTemplateId;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => setSelectedTemplateId(id)}
                          aria-pressed={isSelected}
                          className={`text-left rounded-btn border transition-all overflow-hidden ${
                            isSelected
                              ? 'border-primary bg-section ring-1 ring-primary shadow-soft'
                              : 'border-line bg-canvas hover:border-primary/50'
                          }`}
                        >
                          <div className="bg-preview p-1.5 flex justify-center pointer-events-none select-none">
                            <TemplateThumb brandKit={brandKit} template={t} content={TEMPLATE_SAMPLE_CONTENT} width={64} />
                          </div>
                          <div className="px-2 py-1.5">
                            <p className="text-[11px] font-semibold text-heading truncate" title={t.name}>
                              {t.name}
                            </p>
                            <p className="text-[10px] text-muted capitalize">{t.category || 'Event'}</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    disabled={loadingInitial || templates.length === 0}
                    className="input-field"
                  >
                    {templates.map((t) => (
                      <option key={templateId(t)} value={templateId(t)}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Brand Locked Notice */}
              <p className="text-xs text-muted rounded-card bg-section border border-line px-3 py-2">
                Brand colors, logo, and contacts stay locked from your organization's brand kit.
              </p>

              {/* Generate Button */}
              <button
                type="submit"
                disabled={isGenerating || loadingInitial || !description.trim()}
                className="btn-primary w-full py-3.5 text-sm font-semibold shadow-soft"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Writing your poster...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate poster</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Right Panel: Poster Preview Stage & Actions */}
          <div className="lg:col-span-7 space-y-3">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-chip bg-section border border-line text-xs text-muted">
                <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>Brand locked</span>
              </div>

              <div className="flex items-center gap-3">
                {hasUnsavedChanges && saveStatus !== 'saving' && !showSavedChip && (
                  <span className="text-[11px] text-amber-600 font-medium">Unsaved changes</span>
                )}
                {saveStatus === 'saving' ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-muted" role="status">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving…</span>
                  </span>
                ) : (
                  showSavedChip && (
                    <span
                      className="inline-flex items-center gap-1.5 text-xs text-success font-semibold"
                      role="status"
                      title={`Saved (version ${currentVersion})`}
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Saved</span>
                    </span>
                  )
                )}

                {ready && (
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="inline-flex items-center gap-1.5 rounded-btn border border-line bg-canvas px-3 py-1.5 text-xs font-semibold text-heading shadow-soft hover:bg-section hover:border-primary transition-colors"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-primary" />
                    <span>Edit text</span>
                  </button>
                )}
              </div>
            </div>

            {/* Poster Canvas Preview */}
            <div className="rounded-card bg-preview p-4 sm:p-8 min-h-[420px] flex flex-col items-center justify-center">
              {loadingInitial || isGenerating ? (
                <SkeletonPoster />
              ) : ready ? (
                <div className="w-full max-w-[420px] shadow-soft rounded-card overflow-hidden bg-canvas">
                  <PosterPreview
                    brandKit={brandKit}
                    template={selectedTemplate}
                    content={posterContent}
                    onOverflow={(isOver, msg) => {
                      setOverflowWarning(
                        isOver ? (msg || 'Text is scaled down to fit your poster comfortably.') : null
                      );
                    }}
                    onImageFail={() => setImageLoadError(true)}
                  />
                </div>
              ) : (
                <div className="text-center max-w-sm">
                  <div className="aspect-[4/5] w-full max-w-[280px] mx-auto rounded-card border border-dashed border-line bg-canvas" />
                  <p className="mt-4 text-sm text-muted">
                    Describe an event on the left to see a live preview here.
                  </p>
                </div>
              )}

              {/* Friendly Warnings */}
              {overflowWarning && (
                <div className="w-full max-w-[420px] mt-3 p-3 rounded-card bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>{overflowWarning}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(true)}
                    className="underline font-semibold shrink-0 hover:text-amber-950"
                  >
                    Edit text
                  </button>
                </div>
              )}

              {imageLoadError && (
                <div className="w-full max-w-[420px] mt-3 p-3 rounded-card bg-amber-500/10 border border-amber-500/20 text-amber-900 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>This photo could not be loaded. Choose another one or upload from your device.</span>
                </div>
              )}
            </div>

            {/* Quick Refinement Buttons: Regenerate, Shorter, Minimal, More professional, Emphasize date, Change image */}
            {ready && (
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
                {REFINEMENT_BUTTONS.map((btn) => {
                  const Icon = btn.icon;
                  const isActive = btn.instruction && activeInstruction === btn.instruction;
                  return (
                    <button
                      key={btn.label}
                      type="button"
                      disabled={isGenerating || !description.trim()}
                      onClick={() => {
                        setActiveInstruction(btn.instruction || '');
                        runGenerate(btn.instruction);
                      }}
                      className={`inline-flex items-center gap-1.5 rounded-chip px-3 py-1.5 text-xs font-medium border transition-colors disabled:opacity-50 ${
                        isActive
                          ? 'bg-primary text-white border-primary shadow-soft'
                          : 'border-line bg-canvas text-body hover:border-primary hover:text-heading'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{btn.label}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Download Buttons: PNG / JPG / PDF */}
            {ready && (
              <PosterExportButtons
                brandKit={brandKit}
                template={selectedTemplate}
                content={posterContent}
              />
            )}
          </div>
        </div>

        {/* Edit Text Drawer Panel */}
        <EditTextPanel
          isOpen={isEditOpen}
          onClose={requestCloseEditor}
          content={posterContent}
          onApplyChange={handleApplyEdit}
          onResetToGenerated={handleResetToGenerated}
          canReset={Boolean(
            rawGeneratedContent &&
            posterContent &&
            (posterContent.title !== rawGeneratedContent.title ||
              posterContent.tagline !== rawGeneratedContent.tagline ||
              posterContent.date !== rawGeneratedContent.date ||
              posterContent.time !== rawGeneratedContent.time ||
              posterContent.venue !== rawGeneratedContent.venue ||
              posterContent.imageUrl !== rawGeneratedContent.imageUrl ||
              JSON.stringify(posterContent.details || []) !== JSON.stringify(rawGeneratedContent.details || []))
          )}
          onUndo={handleUndo}
          canUndo={historyStack.length > 0}
          onSaveChanges={handleSaveChanges}
          isSaving={isSavingEdits}
          canSave={hasUnsavedChanges}
          saveError={drawerSaveError}
          conflict={drawerConflict}
          onReloadLatest={refreshPoster}
        />
      </div>
    </div>
  );
}
