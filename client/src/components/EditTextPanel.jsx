import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { X, Undo2, RotateCcw, Lock, Check, Loader2 } from 'lucide-react';
import PosterImageInput from './PosterImageInput';
import { CONTENT_LIMITS as LIMITS } from '../utils/posterContentFields.js';

/* The fill-in spaces are only fetched when the layout actually offers some. */
const VariableFields = lazy(() => import('./posteredit/VariableFields'));

function CharCounter({ current, max }) {
  const isNear = current >= max * 0.9;
  const isMax = current >= max;
  return (
    <span
      className={`text-[11px] font-mono tabular-nums ${
        isMax ? 'text-danger font-semibold' : isNear ? 'text-amber-600' : 'text-muted'
      }`}
    >
      {current}/{max}
    </span>
  );
}

export default function EditTextPanel({
  isOpen,
  onClose,
  content,
  onApplyChange,
  onResetToGenerated,
  canReset,
  onUndo,
  canUndo,
  onSaveChanges,
  isSaving = false,
  canSave = false,
  saveError = '',
  conflict = false,
  onReloadLatest = null,
  blankDesign = null,
  blankView = null,
  blankAlternatives = [],
  canUploadBlanks = false,
  onBlankContent = null,
  onBlankView = null,
  onBlankEdited = null,
}) {
  // Local state for smooth, un-lagged editing
  const [formData, setFormData] = useState({
    title: '',
    tagline: '',
    date: '',
    time: '',
    venue: '',
    details: ['', '', '', ''],
  });

  const [savedNotice, setSavedNotice] = useState(false);
  const debounceTimerRef = useRef(null);
  const isInitialSyncRef = useRef(true);

  // Sync incoming content to local form when content changes externally
  useEffect(() => {
    if (!content) return;
    const detailsArr = Array.isArray(content.details)
      ? content.details
      : content.details
        ? [content.details]
        : [];
    const paddedDetails = [
      detailsArr[0] || '',
      detailsArr[1] || '',
      detailsArr[2] || '',
      detailsArr[3] || '',
    ];

    setFormData({
      title: content.title || '',
      tagline: content.tagline || '',
      date: content.date || '',
      time: content.time || '',
      venue: content.venue || '',
      details: paddedDetails,
    });
  }, [content]);

  // Debounced push to parent (150 ms)
  const triggerDebouncedChange = (updated) => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      const cleanedDetails = updated.details.map((d) => d.trim()).filter(Boolean);
      onApplyChange({
        ...content,
        title: updated.title,
        tagline: updated.tagline,
        date: updated.date,
        time: updated.time,
        venue: updated.venue,
        details: cleanedDetails,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 1200);
    }, 150);
  };

  const handleFieldChange = (field, value, maxLen) => {
    const truncated = value.slice(0, maxLen);
    const next = { ...formData, [field]: truncated };
    setFormData(next);
    triggerDebouncedChange(next);
  };

  const handleDetailChange = (index, value) => {
    const truncated = value.slice(0, LIMITS.detail);
    const nextDetails = [...formData.details];
    nextDetails[index] = truncated;
    const next = { ...formData, details: nextDetails };
    setFormData(next);
    triggerDebouncedChange(next);
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-heading/30 backdrop-blur-[2px] z-40 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-canvas border-l border-line shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-panel-title"
      >
        {/* Header */}
        <div className="p-4 sm:px-6 border-b border-line flex items-center justify-between bg-section/50">
          <div>
            <h2 id="edit-panel-title" className="text-base font-semibold text-heading">
              Edit text
            </h2>
            <p className="text-xs text-muted mt-0.5">Preview updates live as you type</p>
          </div>
          <div className="flex items-center gap-2">
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs text-success font-medium animate-fadeIn">
                <Check className="w-3.5 h-3.5" /> Updated
              </span>
            )}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-btn text-muted hover:text-heading hover:bg-section border border-transparent hover:border-line transition-colors"
              aria-label="Close edit panel"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Toolbar & Brand Locked Chip */}
        <div className="p-4 sm:px-6 border-b border-line space-y-3 bg-canvas">
          <div className="flex items-center gap-2 px-3 py-2 rounded-card bg-section border border-line text-xs text-muted">
            <Lock className="w-3.5 h-3.5 text-primary shrink-0" />
            <span>
              <strong className="text-heading font-medium">Brand locked:</strong> Colors, fonts, logo,
              header, and footer stay fixed.
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="btn-ghost border border-line text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
              title="Undo last change"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Undo</span>
            </button>

            <button
              type="button"
              onClick={onResetToGenerated}
              disabled={!canReset}
              className="btn-ghost border border-line text-xs px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-40"
              title="Reset to the generated text"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        {/* Form Fields */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* Headline (Title) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="edit-title" className="text-xs font-semibold text-heading uppercase tracking-wider">
                Headline
              </label>
              <CharCounter current={formData.title.length} max={LIMITS.title} />
            </div>
            <input
              id="edit-title"
              type="text"
              value={formData.title}
              maxLength={LIMITS.title}
              onChange={(e) => handleFieldChange('title', e.target.value, LIMITS.title)}
              placeholder="e.g. Annual Sports Meet"
              className="input-field"
            />
          </div>

          {/* Short line under the headline (Tagline) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="edit-tagline" className="text-xs font-semibold text-heading uppercase tracking-wider">
                Line under the headline
              </label>
              <CharCounter current={formData.tagline.length} max={LIMITS.tagline} />
            </div>
            <textarea
              id="edit-tagline"
              rows={2}
              value={formData.tagline}
              maxLength={LIMITS.tagline}
              onChange={(e) => handleFieldChange('tagline', e.target.value, LIMITS.tagline)}
              placeholder="e.g. Join us for a day of teamwork and competition"
              className="input-field resize-none"
            />
          </div>

          {/* Date and Time grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="edit-date" className="text-xs font-semibold text-heading uppercase tracking-wider">
                  Date
                </label>
                <CharCounter current={formData.date.length} max={LIMITS.date} />
              </div>
              <input
                id="edit-date"
                type="text"
                value={formData.date}
                maxLength={LIMITS.date}
                onChange={(e) => handleFieldChange('date', e.target.value, LIMITS.date)}
                placeholder="e.g. 18 October 2026"
                className="input-field"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="edit-time" className="text-xs font-semibold text-heading uppercase tracking-wider">
                  Time
                </label>
                <CharCounter current={formData.time.length} max={LIMITS.time} />
              </div>
              <input
                id="edit-time"
                type="text"
                value={formData.time}
                maxLength={LIMITS.time}
                onChange={(e) => handleFieldChange('time', e.target.value, LIMITS.time)}
                placeholder="e.g. 9:00 AM - 4:00 PM"
                className="input-field"
              />
            </div>
          </div>

          {/* Place (Venue) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="edit-venue" className="text-xs font-semibold text-heading uppercase tracking-wider">
                Place
              </label>
              <CharCounter current={formData.venue.length} max={LIMITS.venue} />
            </div>
            <input
              id="edit-venue"
              type="text"
              value={formData.venue}
              maxLength={LIMITS.venue}
              onChange={(e) => handleFieldChange('venue', e.target.value, LIMITS.venue)}
              placeholder="e.g. Central Sports Arena, Campus Ground"
              className="input-field"
            />
          </div>

          {/* Key details (up to 4 lines) */}
          <div className="space-y-3 pt-2 border-t border-line">
            <div>
              <h3 className="text-xs font-semibold text-heading uppercase tracking-wider">
                Details (up to 4 lines)
              </h3>
              <p className="text-xs text-muted mt-0.5">Brief highlights or instructions for attendees</p>
            </div>

            {[0, 1, 2, 3].map((idx) => (
              <div key={idx}>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor={`edit-detail-${idx}`} className="text-xs text-muted">
                    Point {idx + 1}
                  </label>
                  <CharCounter current={formData.details[idx]?.length || 0} max={LIMITS.detail} />
                </div>
                <input
                  id={`edit-detail-${idx}`}
                  type="text"
                  value={formData.details[idx] || ''}
                  maxLength={LIMITS.detail}
                  onChange={(e) => handleDetailChange(idx, e.target.value)}
                  placeholder={`Detail line ${idx + 1}`}
                  className="input-field"
                />
              </div>
            ))}
          </div>

          {/* Photo */}
          <div className="pt-4 border-t border-line">
            <h3 className="text-xs font-semibold text-heading uppercase tracking-wider mb-2">Photo</h3>
            <PosterImageInput
              value={content?.imageUrl || content?.image || ''}
              onChange={(url) => onApplyChange({ ...content, imageUrl: url || '', image: url || '' })}
            />
          </div>

          {/* Spaces the layout left to be filled in */}
          {blankDesign && onBlankContent ? (
            <Suspense fallback={null}>
              <VariableFields
                design={blankDesign}
                content={content}
                view={blankView}
                alternatives={blankAlternatives}
                canUpload={canUploadBlanks}
                onContentChange={onBlankContent}
                onViewChange={onBlankView}
                onEdited={onBlankEdited}
              />
            </Suspense>
          ) : null}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-line bg-section/40 space-y-3">
          {saveError && (
            <div className="flex items-center justify-between gap-2 text-xs text-danger">
              <span>{saveError}</span>
              {conflict && onReloadLatest && (
                <button type="button" onClick={onReloadLatest} className="underline font-semibold shrink-0">
                  Reload latest
                </button>
              )}
            </div>
          )}
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted">
              {canSave ? 'Unsaved changes — save to keep them' : 'Changes on this poster are saved'}
            </p>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={onClose} className="btn-ghost border border-line text-xs px-3 py-2">
                Done editing
              </button>
              <button
                type="button"
                onClick={onSaveChanges}
                disabled={!canSave || isSaving}
                className="btn-primary py-2 px-4 text-xs disabled:opacity-50"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Saving…</span>
                  </>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Save changes</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
