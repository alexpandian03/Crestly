import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  Sparkles,
  Loader2,
  X,
  Upload,
  AlertCircle,
  ClipboardList,
} from 'lucide-react';
import { elementsOfDesign, cardListsOf } from '../../../../shared/templateElements.js';
import { singularLabel, tidyPastedText } from '../../utils/cardListHelpers.js';
import { directUploadAsset } from '../../utils/assetUpload.js';

function CharCounter({ current, max }) {
  const isNear = current >= max * 0.9;
  const isFull = current >= max;
  return (
    <span
      className={`text-[11px] font-mono tabular-nums ${
        isFull
          ? 'text-red-600 font-semibold'
          : isNear
          ? 'text-amber-600'
          : 'text-[#9CA3AF]'
      }`}
    >
      {current}/{max}
    </span>
  );
}

export default function CardListEntriesEditor({
  design,
  content,
  onContentChange,
  canUpload = true,
}) {
  const [pasteOpen, setPasteOpen] = useState({});
  const [pastedText, setPastedText] = useState({});
  const [uploadingState, setUploadingState] = useState(null); // { listKey, entryIndex, fieldKey }
  const [uploadError, setUploadError] = useState('');

  // Extract all card lists available in this design/template
  const cardLists = useMemo(() => {
    const fromDesign = elementsOfDesign(design);
    const elements = fromDesign.length
      ? fromDesign
      : Array.isArray(design?.elements)
      ? design.elements
      : [];
    return cardListsOf(elements);
  }, [design]);

  if (!cardLists.length) return null;

  const currentLists = content?.lists && typeof content.lists === 'object' ? content.lists : {};

  const updateEntriesForList = (listKey, nextEntries) => {
    const nextLists = {
      ...currentLists,
      [listKey]: nextEntries,
    };
    onContentChange?.({
      ...(content || {}),
      lists: nextLists,
    });
  };

  const handleAddEntry = (listSlot) => {
    const listKey = listSlot.key;
    const existing = Array.isArray(currentLists[listKey]) ? [...currentLists[listKey]] : [];
    if (existing.length >= (listSlot.maxCount || 12)) return;

    const newEntry = {};
    (listSlot.card?.fields || []).forEach((f) => {
      newEntry[f.key] = '';
    });

    updateEntriesForList(listKey, [...existing, newEntry]);
  };

  const handleDeleteEntry = (listKey, index) => {
    const existing = Array.isArray(currentLists[listKey]) ? [...currentLists[listKey]] : [];
    existing.splice(index, 1);
    updateEntriesForList(listKey, existing);
  };

  const handleMoveEntry = (listKey, fromIdx, toIdx) => {
    const existing = Array.isArray(currentLists[listKey]) ? [...currentLists[listKey]] : [];
    if (toIdx < 0 || toIdx >= existing.length) return;
    const [moved] = existing.splice(fromIdx, 1);
    existing.splice(toIdx, 0, moved);
    updateEntriesForList(listKey, existing);
  };

  const handleFieldTextChange = (listKey, entryIndex, fieldKey, value, maxLength) => {
    const existing = Array.isArray(currentLists[listKey]) ? [...currentLists[listKey]] : [];
    const entry = { ...(existing[entryIndex] || {}) };
    entry[fieldKey] = String(value || '').slice(0, maxLength);
    existing[entryIndex] = entry;
    updateEntriesForList(listKey, existing);
  };

  const handlePhotoUpload = async (listKey, entryIndex, fieldKey, file) => {
    if (!file) return;
    setUploadError('');
    setUploadingState({ listKey, entryIndex, fieldKey });

    try {
      const result = await directUploadAsset(file);
      const existing = Array.isArray(currentLists[listKey]) ? [...currentLists[listKey]] : [];
      const entry = { ...(existing[entryIndex] || {}) };
      entry[fieldKey] = result.url;
      existing[entryIndex] = entry;
      updateEntriesForList(listKey, existing);
      setUploadingState(null);
    } catch (err) {
      setUploadError(err.message || 'We could not upload this photo. Please try again.');
      setUploadingState(null);
    }
  };

  const handleRemovePhoto = (listKey, entryIndex, fieldKey) => {
    const existing = Array.isArray(currentLists[listKey]) ? [...currentLists[listKey]] : [];
    const entry = { ...(existing[entryIndex] || {}) };
    entry[fieldKey] = '';
    existing[entryIndex] = entry;
    updateEntriesForList(listKey, existing);
  };

  const handleTidyPasted = (listSlot) => {
    const listKey = listSlot.key;
    const textToTidy = pastedText[listKey] || '';
    if (!textToTidy.trim()) return;

    const { entries: tidied } = tidyPastedText(
      textToTidy,
      listSlot.card?.fields,
      listSlot.maxCount || 12
    );

    if (tidied.length > 0) {
      const existing = Array.isArray(currentLists[listKey]) ? [...currentLists[listKey]] : [];
      // Combine existing or replace with tidied
      const combined = [...existing, ...tidied].slice(0, listSlot.maxCount || 12);
      updateEntriesForList(listKey, combined);
      setPastedText((prev) => ({ ...prev, [listKey]: '' }));
      setPasteOpen((prev) => ({ ...prev, [listKey]: false }));
    }
  };

  return (
    <div className="space-y-6 pt-4 border-t border-[#E5E7EB]">
      {uploadError && (
        <div className="flex items-center gap-2 p-2.5 rounded-[6px] border border-red-200 bg-red-50 text-xs text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-500" />
          <span>{uploadError}</span>
        </div>
      )}

      {cardLists.map((listSlot) => {
        const listKey = listSlot.key;
        const entries = Array.isArray(currentLists[listKey]) ? currentLists[listKey] : [];
        const singular = singularLabel(listSlot.label || listSlot.key);
        const isPasteActive = Boolean(pasteOpen[listKey]);
        const maxEntries = listSlot.maxCount || 12;

        return (
          <div key={listKey} className="space-y-3">
            {/* List Header */}
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-semibold text-[#111827] uppercase tracking-wider">
                    {listSlot.label || listSlot.key}
                  </h3>
                  <span className="text-[11px] font-mono tabular-nums px-1.5 py-0.5 rounded-[4px] bg-slate-100 text-[#4B5563]">
                    {entries.length} of {maxEntries}
                  </span>
                </div>
                {listSlot.hint ? (
                  <p className="text-xs text-[#6B7280] mt-0.5">{listSlot.hint}</p>
                ) : null}
              </div>

              {/* Paste a list toggle button */}
              <button
                type="button"
                onClick={() =>
                  setPasteOpen((prev) => ({ ...prev, [listKey]: !prev[listKey] }))
                }
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-[6px] text-xs font-medium border transition-colors ${
                  isPasteActive
                    ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                    : 'border-[#E5E7EB] bg-white text-[#4B5563] hover:text-[#111827] hover:bg-slate-50'
                }`}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span>Paste a list</span>
              </button>
            </div>

            {/* "PASTE A LIST" BOX (AI Tidy) */}
            {isPasteActive && (
              <div className="rounded-[8px] border border-blue-200 bg-blue-50/50 p-3 space-y-2.5 animate-in fade-in duration-150">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-blue-600" />
                    Paste names and titles
                  </span>
                  <button
                    type="button"
                    onClick={() => setPasteOpen((prev) => ({ ...prev, [listKey]: false }))}
                    className="text-[#9CA3AF] hover:text-[#111827]"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>

                <p className="text-[11px] text-[#4B5563]">
                  Paste text from an email or document. The assistant will format it into entries without inventing any details.
                </p>

                <textarea
                  rows={4}
                  value={pastedText[listKey] || ''}
                  onChange={(e) =>
                    setPastedText((prev) => ({ ...prev, [listKey]: e.target.value }))
                  }
                  placeholder={`Dr. Jane Smith - Keynote Speaker\nAlex Rivera, Design Director\nTaylor Chen | Lead Architect`}
                  className="w-full rounded-[6px] border border-[#CBD5E1] bg-white p-2 text-xs font-mono placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none"
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setPasteOpen((prev) => ({ ...prev, [listKey]: false }))}
                    className="px-2.5 py-1 text-xs text-[#6B7280] hover:text-[#111827]"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handleTidyPasted(listSlot)}
                    disabled={!pastedText[listKey]?.trim()}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#2563EB] text-xs font-medium text-white shadow-xs hover:bg-[#1D4ED8] disabled:opacity-50"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Tidy into entries</span>
                  </button>
                </div>
              </div>
            )}

            {/* ENTRIES LIST */}
            {entries.length === 0 ? (
              <div className="rounded-[8px] border border-dashed border-[#D1D5DB] bg-slate-50/50 p-4 text-center">
                <p className="text-xs text-[#6B7280]">
                  No entries yet. Click &quot;Add {singular}&quot; or paste a list above.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {entries.map((entry, idx) => (
                  <div
                    key={idx}
                    className="rounded-[8px] border border-[#E5E7EB] bg-white p-3 space-y-3 shadow-xs"
                  >
                    {/* Row Header: Entry Number & Reorder/Delete */}
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-[11px] font-bold text-[#4B5563] uppercase tracking-wider">
                        {singular} #{idx + 1}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          title="Move up"
                          disabled={idx === 0}
                          onClick={() => handleMoveEntry(listKey, idx, idx - 1)}
                          className="h-6 w-6 flex items-center justify-center rounded-[4px] border border-[#E5E7EB] text-[#4B5563] hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowUp className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title="Move down"
                          disabled={idx === entries.length - 1}
                          onClick={() => handleMoveEntry(listKey, idx, idx + 1)}
                          className="h-6 w-6 flex items-center justify-center rounded-[4px] border border-[#E5E7EB] text-[#4B5563] hover:bg-slate-50 disabled:opacity-30"
                        >
                          <ArrowDown className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          title={`Delete ${singular}`}
                          onClick={() => handleDeleteEntry(listKey, idx)}
                          className="h-6 w-6 flex items-center justify-center rounded-[4px] border border-red-200 text-red-600 hover:bg-red-50 ml-1"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    {/* Entry Form Fields */}
                    <div className="space-y-2.5">
                      {(listSlot.card?.fields || []).map((f) => {
                        const val = entry[f.key] || '';
                        const isUploading =
                          uploadingState?.listKey === listKey &&
                          uploadingState?.entryIndex === idx &&
                          uploadingState?.fieldKey === f.key;

                        if (f.type === 'image') {
                          return (
                            <div key={f.key} className="space-y-1">
                              <label className="text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider">
                                {f.label || f.key}
                              </label>

                              {val ? (
                                <div className="flex items-center gap-3">
                                  <div className="h-12 w-12 rounded-[6px] overflow-hidden border border-[#CBD5E1] bg-slate-100 shrink-0">
                                    <img
                                      src={val}
                                      alt=""
                                      crossOrigin="anonymous"
                                      className="h-full w-full object-cover"
                                    />
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => handleRemovePhoto(listKey, idx, f.key)}
                                    className="text-xs text-red-600 hover:underline flex items-center gap-1"
                                  >
                                    <X className="h-3.5 w-3.5" /> Remove photo
                                  </button>
                                </div>
                              ) : (
                                <div>
                                  <label
                                    className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-[6px] border border-[#D1D5DB] bg-white text-xs font-medium text-[#374151] hover:bg-slate-50 cursor-pointer ${
                                      isUploading ? 'opacity-50 pointer-events-none' : ''
                                    }`}
                                  >
                                    {isUploading ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#2563EB]" />
                                        <span>Uploading…</span>
                                      </>
                                    ) : (
                                      <>
                                        <Upload className="h-3.5 w-3.5 text-[#6B7280]" />
                                        <span>Upload {f.label?.toLowerCase() || 'photo'}</span>
                                      </>
                                    )}
                                    <input
                                      type="file"
                                      accept="image/jpeg,image/png,image/webp"
                                      disabled={isUploading || !canUpload}
                                      onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handlePhotoUpload(listKey, idx, f.key, file);
                                      }}
                                      className="hidden"
                                    />
                                  </label>
                                </div>
                              )}
                            </div>
                          );
                        }

                        // Text Field
                        const maxL = f.maxLength || 40;
                        return (
                          <div key={f.key}>
                            <div className="flex items-center justify-between mb-1">
                              <label className="text-[11px] font-semibold text-[#4B5563] uppercase tracking-wider">
                                {f.label || f.key}
                              </label>
                              <CharCounter current={val.length} max={maxL} />
                            </div>
                            <input
                              type="text"
                              maxLength={maxL}
                              value={val}
                              placeholder={`Enter ${f.label?.toLowerCase() || f.key}`}
                              onChange={(e) =>
                                handleFieldTextChange(listKey, idx, f.key, e.target.value, maxL)
                              }
                              className="h-8 w-full rounded-[6px] border border-[#D1D5DB] bg-white px-2.5 text-xs text-[#111827] placeholder:text-[#9CA3AF] focus:border-[#2563EB] focus:outline-none"
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ADD BUTTON */}
            {entries.length < maxEntries ? (
              <button
                type="button"
                onClick={() => handleAddEntry(listSlot)}
                className="w-full flex items-center justify-center gap-1.5 h-9 rounded-[6px] border border-dashed border-[#CBD5E1] bg-white text-xs font-semibold text-[#2563EB] hover:bg-blue-50/50 hover:border-[#2563EB] transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add {singular}</span>
              </button>
            ) : (
              <p className="text-center text-[11px] text-[#6B7280]">
                Maximum of {maxEntries} {listSlot.label?.toLowerCase() || 'entries'} reached.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
