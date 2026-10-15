import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  X,
  Check,
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Layers,
  RotateCw,
  Type,
  Image as ImageIcon,
  Square,
  Sparkles,
  Sliders,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Bold,
  Italic,
  Underline,
  Eye,
  Maximize2,
  ZoomIn,
  ZoomOut,
  ChevronDown,
} from 'lucide-react';
import {
  CARD_LIST_LIMITS,
  ELEMENT_FONTS,
  ELEMENT_LIMITS,
  ICON_NAMES,
  IMAGE_MASKS,
  VARIABLE_LIMITS,
  isBrandColorToken,
  resolveColorToken,
} from '../../../../shared/templateElements.js';
import { TAMIL_FONT_FAMILIES } from '../../../../shared/textScripts.js';
import { toHex } from '../../utils/contrast.js';
import { makeSampleEntries } from '../../utils/cardListHelpers.js';
import { getMaskStyle } from '../PosterElementLayer.jsx';

/* This panel lists five faces that fit any poster plus the six that shape Tamil letters,
   so the drop-down stays readable instead of showing the whole allowed list. */
const CARD_FONTS = [...ELEMENT_FONTS.slice(0, 5), ...TAMIL_FONT_FAMILIES];

const BRAND_SWATCHES = [
  { token: 'brand:primary', label: 'Primary' },
  { token: 'brand:secondary', label: 'Secondary' },
  { token: 'brand:accent', label: 'Accent' },
  { token: 'brand:text', label: 'Text' },
  { token: 'brand:background', label: 'Background' },
  { token: 'brand:heading', label: 'Heading' },
  { token: 'brand:body', label: 'Body' },
];

export default function CardEditorModal({
  isOpen,
  onClose,
  item,
  brandKit,
  onCommit,
}) {
  // Local state for the card list properties
  const [label, setLabel] = useState(() => item?.label || 'Card list');
  const [hint, setHint] = useState(() => item?.hint || '');
  const [columns, setColumns] = useState(() => Math.max(1, Math.min(5, Number(item?.columns) || 2)));
  const [gapX, setGapX] = useState(() => Number(item?.gapX) || 16);
  const [gapY, setGapY] = useState(() => Number(item?.gapY) || 16);
  const [align, setAlign] = useState(() => item?.align || 'center');
  const [minCount, setMinCount] = useState(() => Number(item?.minCount) || 0);
  const [maxCount, setMaxCount] = useState(() => Number(item?.maxCount) || 8);
  const [previewCount, setPreviewCount] = useState(() => Number(item?.previewCount) || 3);

  // Card dimensions and inner items
  const [cardW, setCardW] = useState(() => Math.max(100, Number(item?.card?.w) || 400));
  const [cardH, setCardH] = useState(() => Math.max(50, Number(item?.card?.h) || 140));
  const [fields, setFields] = useState(() => Array.isArray(item?.card?.fields) ? [...item.card.fields] : []);
  const [cardItems, setCardItems] = useState(() => Array.isArray(item?.card?.items) ? [...item.card.items] : []);

  // Selection & Zoom
  const [selectedSubId, setSelectedSubId] = useState('');
  const [zoom, setZoom] = useState(1);

  // New field form state
  const [newFieldOpen, setNewFieldOpen] = useState(false);
  const [newFieldLabel, setNewFieldLabel] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldType, setNewFieldType] = useState('text');
  const [newFieldMax, setNewFieldMax] = useState(40);

  const selectedSubItem = useMemo(
    () => cardItems.find((it) => it.id === selectedSubId),
    [cardItems, selectedSubId]
  );

  // Zoom auto-fit
  useEffect(() => {
    const availableW = 540;
    const availableH = 340;
    const scale = Math.min(1.4, Math.max(0.6, Math.min(availableW / cardW, availableH / cardH)));
    setZoom(Number(scale.toFixed(2)));
  }, [cardW, cardH]);

  // Patching an item inside the card
  const patchSubItem = (id, patch) => {
    setCardItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const next = { ...it, ...patch };
        if (patch.style) next.style = { ...(it.style || {}), ...patch.style };
        if (patch.shape) next.shape = { ...(it.shape || {}), ...patch.shape };
        return next;
      })
    );
  };

  // Add items inside the card
  const addSubText = (fieldKey = '') => {
    const foundField = fields.find((f) => f.key === fieldKey) || fields.find((f) => f.type === 'text');
    const keyToUse = foundField ? foundField.key : 'title';
    const newItem = {
      id: `c-text-${Date.now()}`,
      kind: 'text',
      fieldKey: keyToUse,
      text: `{{${keyToUse}}}`,
      x: 20,
      y: 20,
      w: Math.min(260, cardW - 40),
      h: 30,
      rotation: 0,
      style: {
        fontFamily: 'brand:heading',
        size: 18,
        weight: 700,
        color: 'brand:heading',
        align: 'left',
      },
    };
    setCardItems((prev) => [...prev, newItem]);
    setSelectedSubId(newItem.id);
  };

  const addSubImage = (fieldKey = '') => {
    const foundField = fields.find((f) => f.key === fieldKey) || fields.find((f) => f.type === 'image');
    const keyToUse = foundField ? foundField.key : 'photo';
    const size = Math.min(90, cardH - 30);
    const newItem = {
      id: `c-img-${Date.now()}`,
      kind: 'image',
      fieldKey: keyToUse,
      imageUrl: `{{${keyToUse}}}`,
      mask: 'circle',
      x: 20,
      y: Math.max(10, Math.floor((cardH - size) / 2)),
      w: size,
      h: size,
      rotation: 0,
      style: {
        radius: Math.floor(size / 2),
        fit: 'cover',
      },
    };
    setCardItems((prev) => [...prev, newItem]);
    setSelectedSubId(newItem.id);
  };

  const addSubShape = (shapeType = 'rect') => {
    const newItem = {
      id: `c-shape-${Date.now()}`,
      kind: 'shape',
      shape: { type: shapeType, fill: '#f8fafc' },
      style: { radius: 10, border: '#e2e8f0', strokeWidth: 1 },
      x: 0,
      y: 0,
      w: cardW,
      h: cardH,
      rotation: 0,
    };
    setCardItems((prev) => [newItem, ...prev]);
    setSelectedSubId(newItem.id);
  };

  // Reorder / Duplicate / Delete
  const deleteSubItem = (id) => {
    setCardItems((prev) => prev.filter((it) => it.id !== id));
    if (selectedSubId === id) setSelectedSubId('');
  };

  const duplicateSubItem = (id) => {
    const target = cardItems.find((it) => it.id === id);
    if (!target) return;
    const copy = {
      ...target,
      id: `c-copy-${Date.now()}`,
      x: Math.min(cardW - target.w, target.x + 15),
      y: Math.min(cardH - target.h, target.y + 15),
    };
    setCardItems((prev) => [...prev, copy]);
    setSelectedSubId(copy.id);
  };

  const moveLayer = (id, delta) => {
    setCardItems((prev) => {
      const idx = prev.findIndex((it) => it.id === id);
      if (idx < 0) return prev;
      const targetIdx = idx + delta;
      if (targetIdx < 0 || targetIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(targetIdx, 0, item);
      return copy;
    });
  };

  // Field Management
  const handleAddField = () => {
    const lbl = newFieldLabel.trim();
    if (!lbl) return;
    const k = (newFieldKey.trim() || lbl.toLowerCase().replace(/[^a-z0-9_]/g, '_')).slice(0, 24);
    if (fields.some((f) => f.key === k)) return;
    if (fields.length >= 6) return;

    const newField = {
      key: k,
      label: lbl,
      type: newFieldType,
      ...(newFieldType === 'text' ? { maxLength: Math.max(10, Math.min(120, Number(newFieldMax) || 40)) } : {}),
    };
    setFields((prev) => [...prev, newField]);
    setNewFieldLabel('');
    setNewFieldKey('');
    setNewFieldOpen(false);
  };

  const handleDeleteField = (key) => {
    if (fields.length <= 1) return;
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  // Dragging inside Card Canvas
  const handlePointerDownItem = (e, subItem) => {
    e.stopPropagation();
    setSelectedSubId(subItem.id);
    const startX = e.clientX;
    const startY = e.clientY;
    const initialItemX = subItem.x;
    const initialItemY = subItem.y;

    const handlePointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      const nextX = Math.round(Math.max(0, Math.min(cardW - subItem.w, initialItemX + dx)));
      const nextY = Math.round(Math.max(0, Math.min(cardH - subItem.h, initialItemY + dy)));
      patchSubItem(subItem.id, { x: nextX, y: nextY });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Resize handle drag
  const handleResizePointerDown = (e, subItem, handleType) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const initX = subItem.x;
    const initY = subItem.y;
    const initW = subItem.w;
    const initH = subItem.h;

    const handlePointerMove = (moveEvent) => {
      const dx = (moveEvent.clientX - startX) / zoom;
      const dy = (moveEvent.clientY - startY) / zoom;
      let newW = initW;
      let newH = initH;
      let newX = initX;
      let newY = initY;

      if (handleType.includes('e')) newW = Math.max(20, Math.min(cardW - initX, initW + dx));
      if (handleType.includes('s')) newH = Math.max(16, Math.min(cardH - initY, initH + dy));
      if (handleType.includes('w')) {
        const potentialW = Math.max(20, initW - dx);
        newX = Math.max(0, initX + (initW - potentialW));
        newW = potentialW;
      }
      if (handleType.includes('n')) {
        const potentialH = Math.max(16, initH - dy);
        newY = Math.max(0, initY + (initH - potentialH));
        newH = potentialH;
      }

      patchSubItem(subItem.id, {
        x: Math.round(newX),
        y: Math.round(newY),
        w: Math.round(newW),
        h: Math.round(newH),
      });
    };

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  // Commit changes back
  const handleDone = () => {
    const updatedCard = {
      w: cardW,
      h: cardH,
      fields,
      items: cardItems,
    };
    onCommit({
      ...item,
      label: label.trim() || item.label,
      hint: hint.trim(),
      columns,
      gapX,
      gapY,
      align,
      minCount,
      maxCount,
      previewCount,
      card: updatedCard,
    });
    onClose();
  };

  // Sample entries for live preview
  const sampleData = useMemo(() => {
    return makeSampleEntries({ fields }, previewCount);
  }, [fields, previewCount]);

  if (!isOpen || !item) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Draw card"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm animate-in fade-in duration-150"
    >
      <div className="relative flex flex-col h-[92vh] max-h-[880px] w-full max-w-[1100px] rounded-[10px] border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden">
        {/* MODAL HEADER */}
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#E5E7EB] px-5 bg-white">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-[6px] bg-blue-50 text-[#2563EB]">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#111827]">Draw card: {label}</h2>
                <span className="rounded-[4px] bg-slate-100 px-1.5 py-0.5 text-[11px] font-mono text-[#6B7280]">
                  {cardW} × {cardH} px
                </span>
              </div>
              <p className="text-[11px] text-[#6B7280]">
                Design one card. The poster repeats it for each entry in this list.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live sample selector */}
            <div className="flex items-center rounded-[6px] border border-[#E5E7EB] p-0.5 bg-slate-50 text-xs">
              <span className="px-2 text-[11px] text-[#6B7280] font-medium">Preview:</span>
              {[2, 3, 5].map((cnt) => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => setPreviewCount(cnt)}
                  className={`px-2 py-0.5 rounded-[4px] text-xs font-medium transition-colors ${
                    previewCount === cnt
                      ? 'bg-white text-[#2563EB] shadow-xs'
                      : 'text-[#6B7280] hover:text-[#111827]'
                  }`}
                >
                  {cnt} entries
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-[6px] border border-[#E5E7EB] text-xs font-medium text-[#4B5563] hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="h-8 px-4 rounded-[6px] bg-[#2563EB] text-xs font-semibold text-white shadow-xs hover:bg-[#1D4ED8]"
            >
              Done
            </button>
          </div>
        </header>

        {/* MODAL WORKSPACE */}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* LEFT: CARD DESIGN STAGE (CANVAS) */}
          <div className="flex flex-1 flex-col min-w-0 border-r border-[#E5E7EB] bg-[#F8FAFC]">
            {/* Canvas Toolbar */}
            <div className="flex h-11 shrink-0 items-center justify-between border-b border-[#E5E7EB] px-4 bg-white text-xs">
              {/* Element Add Buttons */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-semibold text-[#6B7280] uppercase tracking-wider mr-1">
                  Add:
                </span>
                <button
                  type="button"
                  onClick={() => addSubText()}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[4px] border border-[#E5E7EB] bg-white text-xs font-medium text-[#374151] hover:bg-slate-50"
                >
                  <Type className="h-3.5 w-3.5 text-blue-600" />
                  <span>Text</span>
                </button>
                <button
                  type="button"
                  onClick={() => addSubImage()}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[4px] border border-[#E5E7EB] bg-white text-xs font-medium text-[#374151] hover:bg-slate-50"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Photo</span>
                </button>
                <button
                  type="button"
                  onClick={() => addSubShape('rect')}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-[4px] border border-[#E5E7EB] bg-white text-xs font-medium text-[#374151] hover:bg-slate-50"
                >
                  <Square className="h-3.5 w-3.5 text-amber-600" />
                  <span>Shape</span>
                </button>
              </div>

              {/* Zoom Controls */}
              <div className="flex items-center gap-1 text-[#6B7280]">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.1).toFixed(2))))}
                  className="h-7 w-7 flex items-center justify-center rounded-[4px] hover:bg-slate-100"
                >
                  <ZoomOut className="h-3.5 w-3.5" />
                </button>
                <span className="w-12 text-center font-mono text-[11px]">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(2.0, Number((z + 0.1).toFixed(2))))}
                  className="h-7 w-7 flex items-center justify-center rounded-[4px] hover:bg-slate-100"
                >
                  <ZoomIn className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Contextual Properties for Selected Sub-Item */}
            {selectedSubItem ? (
              <div className="flex h-11 shrink-0 items-center gap-3 border-b border-[#E5E7EB] bg-blue-50/50 px-4 text-xs overflow-x-auto">
                <span className="font-semibold text-blue-700 capitalize">
                  {selectedSubItem.kind}:
                </span>

                {/* TEXT SETTINGS */}
                {selectedSubItem.kind === 'text' && (
                  <>
                    {/* Bound Field Selector */}
                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Field:</span>
                      <select
                        value={selectedSubItem.fieldKey || ''}
                        onChange={(e) => {
                          const k = e.target.value;
                          patchSubItem(selectedSubItem.id, {
                            fieldKey: k,
                            text: k ? `{{${k}}}` : selectedSubItem.text,
                          });
                        }}
                        className="h-7 rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs font-medium text-[#111827]"
                      >
                        {fields
                          .filter((f) => f.type === 'text')
                          .map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label} ({`{{${f.key}}}`})
                            </option>
                          ))}
                        <option value="">Custom text</option>
                      </select>
                    </div>

                    {/* Font Family */}
                    <select
                      value={selectedSubItem.style?.fontFamily || 'brand:heading'}
                      onChange={(e) =>
                        patchSubItem(selectedSubItem.id, {
                          style: { fontFamily: e.target.value },
                        })
                      }
                      className="h-7 rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs font-medium"
                    >
                      <option value="brand:heading">Brand heading</option>
                      <option value="brand:body">Brand body</option>
                      {CARD_FONTS.map((f) => (
                        <option key={f} value={f}>
                          {f}
                        </option>
                      ))}
                    </select>

                    {/* Font Size */}
                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Size:</span>
                      <input
                        type="number"
                        min="10"
                        max="80"
                        value={selectedSubItem.style?.size || 16}
                        onChange={(e) =>
                          patchSubItem(selectedSubItem.id, {
                            style: { size: Number(e.target.value) || 16 },
                          })
                        }
                        className="h-7 w-14 rounded-[4px] border border-[#D1D5DB] bg-white px-1 text-center font-mono"
                      />
                    </div>

                    {/* Bold / Italic */}
                    <div className="flex items-center rounded-[4px] border border-[#D1D5DB] bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          patchSubItem(selectedSubItem.id, {
                            style: {
                              weight: (selectedSubItem.style?.weight || 500) >= 700 ? 500 : 700,
                            },
                          })
                        }
                        className={`h-7 px-2 text-xs font-bold ${
                          (selectedSubItem.style?.weight || 500) >= 700
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-[#4B5563]'
                        }`}
                      >
                        B
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          patchSubItem(selectedSubItem.id, {
                            style: { italic: !selectedSubItem.style?.italic },
                          })
                        }
                        className={`h-7 px-2 text-xs italic ${
                          selectedSubItem.style?.italic
                            ? 'bg-blue-100 text-blue-700'
                            : 'text-[#4B5563]'
                        }`}
                      >
                        I
                      </button>
                    </div>

                    {/* Color tokens quick dots */}
                    <div className="flex items-center gap-1">
                      {BRAND_SWATCHES.slice(0, 4).map((swatch) => (
                        <button
                          key={swatch.token}
                          type="button"
                          title={swatch.label}
                          onClick={() =>
                            patchSubItem(selectedSubItem.id, {
                              style: { color: swatch.token },
                            })
                          }
                          className="h-5 w-5 rounded-full border border-slate-300"
                          style={{
                            backgroundColor: toHex(
                              resolveColorToken(swatch.token, brandKit),
                              '#111827'
                            ),
                          }}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* IMAGE SETTINGS */}
                {selectedSubItem.kind === 'image' && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Photo field:</span>
                      <select
                        value={selectedSubItem.fieldKey || ''}
                        onChange={(e) =>
                          patchSubItem(selectedSubItem.id, {
                            fieldKey: e.target.value,
                            imageUrl: `{{${e.target.value}}}`,
                          })
                        }
                        className="h-7 rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs font-medium text-[#111827]"
                      >
                        {fields
                          .filter((f) => f.type === 'image')
                          .map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label} ({`{{${f.key}}}`})
                            </option>
                          ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Mask:</span>
                      <select
                        value={selectedSubItem.mask || 'rounded'}
                        onChange={(e) =>
                          patchSubItem(selectedSubItem.id, {
                            mask: e.target.value,
                          })
                        }
                        className="h-7 rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs capitalize"
                      >
                        {IMAGE_MASKS.map((m) => (
                          <option key={m} value={m}>
                            {m}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Fit:</span>
                      <select
                        value={selectedSubItem.style?.fit || 'cover'}
                        onChange={(e) =>
                          patchSubItem(selectedSubItem.id, {
                            style: { fit: e.target.value },
                          })
                        }
                        className="h-7 rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs"
                      >
                        <option value="cover">Fill</option>
                        <option value="contain">Fit</option>
                      </select>
                    </div>
                  </>
                )}

                {/* SHAPE SETTINGS */}
                {selectedSubItem.kind === 'shape' && (
                  <>
                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Fill:</span>
                      <input
                        type="color"
                        value={
                          toHex(
                            resolveColorToken(selectedSubItem.shape?.fill || '#ffffff', brandKit),
                            '#ffffff'
                          )
                        }
                        onChange={(e) =>
                          patchSubItem(selectedSubItem.id, {
                            shape: { fill: e.target.value },
                          })
                        }
                        className="h-6 w-8 rounded-[4px] border border-[#D1D5DB] cursor-pointer"
                      />
                    </div>

                    <div className="flex items-center gap-1">
                      <span className="text-[#6B7280]">Radius:</span>
                      <input
                        type="number"
                        min="0"
                        max="40"
                        value={selectedSubItem.style?.radius || 0}
                        onChange={(e) =>
                          patchSubItem(selectedSubItem.id, {
                            style: { radius: Number(e.target.value) || 0 },
                          })
                        }
                        className="h-7 w-12 rounded-[4px] border border-[#D1D5DB] bg-white px-1 text-center font-mono"
                      />
                    </div>
                  </>
                )}

                {/* Common Action Buttons */}
                <div className="ml-auto flex items-center gap-1">
                  <button
                    type="button"
                    title="Bring forward"
                    onClick={() => moveLayer(selectedSubItem.id, 1)}
                    className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-[#D1D5DB] bg-white hover:bg-slate-50"
                  >
                    <ArrowUp className="h-3.5 w-3.5 text-[#4B5563]" />
                  </button>
                  <button
                    type="button"
                    title="Send back"
                    onClick={() => moveLayer(selectedSubItem.id, -1)}
                    className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-[#D1D5DB] bg-white hover:bg-slate-50"
                  >
                    <ArrowDown className="h-3.5 w-3.5 text-[#4B5563]" />
                  </button>
                  <button
                    type="button"
                    title="Duplicate"
                    onClick={() => duplicateSubItem(selectedSubItem.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-[#D1D5DB] bg-white hover:bg-slate-50"
                  >
                    <Copy className="h-3.5 w-3.5 text-[#4B5563]" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => deleteSubItem(selectedSubItem.id)}
                    className="h-7 w-7 flex items-center justify-center rounded-[4px] border border-[#FCA5A5] bg-white text-red-600 hover:bg-red-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : null}

            {/* Canvas Viewport Container */}
            <div
              className="flex-1 flex items-center justify-center overflow-auto p-6"
              onClick={() => setSelectedSubId('')}
            >
              <div
                style={{
                  width: `${cardW * zoom}px`,
                  height: `${cardH * zoom}px`,
                  position: 'relative',
                  backgroundColor: '#ffffff',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                  borderRadius: '12px',
                  overflow: 'visible',
                  userSelect: 'none',
                }}
                className="border border-[#CBD5E1]"
              >
                {/* Scaled Inner Card Container */}
                <div
                  style={{
                    width: `${cardW}px`,
                    height: `${cardH}px`,
                    transform: `scale(${zoom})`,
                    transformOrigin: 'top left',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                  }}
                >
                  {/* Card items rendered */}
                  {cardItems.map((subItem) => {
                    const isSelected = subItem.id === selectedSubId;
                    const resolvedColor = resolveColorToken(
                      subItem.style?.color || 'brand:heading',
                      brandKit
                    );
                    const shapeFill = resolveColorToken(
                      subItem.shape?.fill || '#f8fafc',
                      brandKit
                    );

                    return (
                      <div
                        key={subItem.id}
                        onPointerDown={(e) => handlePointerDownItem(e, subItem)}
                        style={{
                          position: 'absolute',
                          left: `${subItem.x}px`,
                          top: `${subItem.y}px`,
                          width: `${subItem.w}px`,
                          height: `${subItem.h}px`,
                          transform: subItem.rotation ? `rotate(${subItem.rotation}deg)` : undefined,
                          cursor: 'move',
                          boxSizing: 'border-box',
                          outline: isSelected ? '2px solid #2563EB' : 'none',
                          outlineOffset: '1px',
                          zIndex: isSelected ? 30 : 10,
                        }}
                      >
                        {/* Render by kind */}
                        {subItem.kind === 'shape' && (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              backgroundColor: shapeFill,
                              borderRadius: `${subItem.style?.radius || 0}px`,
                              border: subItem.style?.border
                                ? `${subItem.style?.strokeWidth || 1}px solid ${subItem.style.border}`
                                : 'none',
                            }}
                          />
                        )}

                        {subItem.kind === 'text' && (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              fontFamily:
                                subItem.style?.fontFamily === 'brand:heading'
                                  ? brandKit?.fonts?.heading || 'Cinzel'
                                  : subItem.style?.fontFamily === 'brand:body'
                                  ? brandKit?.fonts?.body || 'Inter'
                                  : subItem.style?.fontFamily || 'Inter',
                              fontSize: `${subItem.style?.size || 16}px`,
                              fontWeight: subItem.style?.weight || 600,
                              fontStyle: subItem.style?.italic ? 'italic' : 'normal',
                              color: resolvedColor,
                              textAlign: subItem.style?.align || 'left',
                              display: 'flex',
                              alignItems: 'center',
                              overflow: 'hidden',
                              whiteSpace: 'nowrap',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.2,
                            }}
                          >
                            {subItem.text || `{{${subItem.fieldKey || 'text'}}}`}
                          </div>
                        )}

                        {subItem.kind === 'image' && (
                          <div
                            style={{
                              width: '100%',
                              height: '100%',
                              ...getMaskStyle(subItem.mask || 'rounded', subItem.style?.radius || 8),
                              backgroundColor: '#E2E8F0',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflow: 'hidden',
                            }}
                          >
                            <img
                              src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80"
                              alt="Avatar"
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: subItem.style?.fit || 'cover',
                                pointerEvents: 'none',
                              }}
                            />
                          </div>
                        )}

                        {/* Resize Handles when Selected */}
                        {isSelected && (
                          <>
                            {['nw', 'ne', 'se', 'sw', 'n', 's', 'e', 'w'].map((h) => {
                              const posStyle = {};
                              if (h.includes('n')) posStyle.top = '-5px';
                              if (h.includes('s')) posStyle.bottom = '-5px';
                              if (h.includes('w')) posStyle.left = '-5px';
                              if (h.includes('e')) posStyle.right = '-5px';
                              if (h === 'n' || h === 's') posStyle.left = 'calc(50% - 4px)';
                              if (h === 'e' || h === 'w') posStyle.top = 'calc(50% - 4px)';

                              return (
                                <div
                                  key={h}
                                  onPointerDown={(e) => handleResizePointerDown(e, subItem, h)}
                                  style={{
                                    position: 'absolute',
                                    width: '8px',
                                    height: '8px',
                                    backgroundColor: '#ffffff',
                                    border: '1.5px solid #2563EB',
                                    borderRadius: '2px',
                                    cursor: `${h}-resize`,
                                    zIndex: 40,
                                    ...posStyle,
                                  }}
                                />
                              );
                            })}
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: SETTINGS & LIVE PREVIEW SIDEBAR */}
          <div className="w-[380px] shrink-0 flex flex-col border-l border-[#E5E7EB] bg-white overflow-y-auto">
            <div className="p-4 space-y-5">
              {/* SECTION 1: Card Dimensions */}
              <div>
                <h3 className="text-xs font-semibold text-[#111827] uppercase tracking-wider mb-2">
                  Card Size
                </h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#6B7280]">Width (px)</label>
                    <input
                      type="number"
                      min="100"
                      max="800"
                      value={cardW}
                      onChange={(e) => setCardW(Math.max(100, Number(e.target.value) || 300))}
                      className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs font-mono font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#6B7280]">Height (px)</label>
                    <input
                      type="number"
                      min="40"
                      max="600"
                      value={cardH}
                      onChange={(e) => setCardH(Math.max(40, Number(e.target.value) || 120))}
                      className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs font-mono font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: Card Fields */}
              <div className="border-t border-[#E5E7EB] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[#111827] uppercase tracking-wider">
                    Card Fields ({fields.length}/6)
                  </h3>
                  {fields.length < 6 && (
                    <button
                      type="button"
                      onClick={() => setNewFieldOpen(true)}
                      className="text-xs text-[#2563EB] font-medium hover:underline inline-flex items-center gap-0.5"
                    >
                      <Plus className="h-3 w-3" /> Add field
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {fields.map((f) => (
                    <div
                      key={f.key}
                      className="flex items-center justify-between rounded-[6px] border border-[#E5E7EB] bg-slate-50 px-2.5 py-1.5 text-xs"
                    >
                      <div>
                        <span className="font-semibold text-[#111827]">{f.label}</span>
                        <span className="ml-1.5 text-[11px] font-mono text-[#6B7280]">
                          {`{{${f.key}}}`} ({f.type})
                        </span>
                      </div>
                      {fields.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteField(f.key)}
                          className="text-[#9CA3AF] hover:text-red-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Field Inline Box */}
                {newFieldOpen && (
                  <div className="mt-2.5 rounded-[6px] border border-blue-200 bg-blue-50/60 p-3 space-y-2.5">
                    <div>
                      <label className="text-[11px] font-medium text-[#374151]">Field Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Company or Bio"
                        value={newFieldLabel}
                        onChange={(e) => {
                          setNewFieldLabel(e.target.value);
                          setNewFieldKey(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
                        }}
                        className="mt-1 h-7 w-full rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-[#374151]">Type</label>
                        <select
                          value={newFieldType}
                          onChange={(e) => setNewFieldType(e.target.value)}
                          className="mt-1 h-7 w-full rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs"
                        >
                          <option value="text">Words</option>
                          <option value="image">Photo</option>
                        </select>
                      </div>
                      {newFieldType === 'text' && (
                        <div>
                          <label className="text-[11px] font-medium text-[#374151]">Max chars</label>
                          <input
                            type="number"
                            min="10"
                            max="120"
                            value={newFieldMax}
                            onChange={(e) => setNewFieldMax(Number(e.target.value) || 40)}
                            className="mt-1 h-7 w-full rounded-[4px] border border-[#D1D5DB] bg-white px-2 text-xs"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setNewFieldOpen(false)}
                        className="h-6 px-2 text-[11px] text-[#6B7280] hover:text-[#111827]"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAddField}
                        className="h-6 px-2.5 rounded-[4px] bg-[#2563EB] text-[11px] font-semibold text-white hover:bg-[#1D4ED8]"
                      >
                        Save field
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 3: Grid Layout Settings */}
              <div className="border-t border-[#E5E7EB] pt-4 space-y-3">
                <h3 className="text-xs font-semibold text-[#111827] uppercase tracking-wider">
                  List Grid Layout
                </h3>

                {/* Columns */}
                <div>
                  <label className="text-[11px] text-[#6B7280]">Columns</label>
                  <div className="mt-1 grid grid-cols-5 gap-1 text-xs">
                    {[1, 2, 3, 4, 5].map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setColumns(col)}
                        className={`h-7 rounded-[4px] font-medium border ${
                          columns === col
                            ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                            : 'border-[#D1D5DB] bg-white text-[#4B5563] hover:bg-slate-50'
                        }`}
                      >
                        {col}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Gap X & Gap Y */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#6B7280]">Gap Horizontal (px)</label>
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={gapX}
                      onChange={(e) => setGapX(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs font-mono font-medium"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-[#6B7280]">Gap Vertical (px)</label>
                    <input
                      type="number"
                      min="0"
                      max="80"
                      value={gapY}
                      onChange={(e) => setGapY(Math.max(0, Number(e.target.value) || 0))}
                      className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Align */}
                <div>
                  <label className="text-[11px] text-[#6B7280]">Alignment</label>
                  <div className="mt-1 grid grid-cols-3 gap-1 text-xs">
                    {['left', 'center', 'right'].map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAlign(a)}
                        className={`h-7 rounded-[4px] font-medium capitalize border ${
                          align === a
                            ? 'border-[#2563EB] bg-blue-50 text-[#2563EB]'
                            : 'border-[#D1D5DB] bg-white text-[#4B5563] hover:bg-slate-50'
                        }`}
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Min & Max Count */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[11px] text-[#6B7280]">Min entries</label>
                    <select
                      value={minCount}
                      onChange={(e) => setMinCount(Number(e.target.value) || 0)}
                      className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs"
                    >
                      <option value="0">0 (Optional)</option>
                      <option value="1">1 (Required)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-[#6B7280]">Max entries</label>
                    <input
                      type="number"
                      min="1"
                      max="12"
                      value={maxCount}
                      onChange={(e) => setMaxCount(Math.min(12, Math.max(1, Number(e.target.value) || 12)))}
                      className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs font-mono font-medium"
                    />
                  </div>
                </div>

                {/* Label and Hint */}
                <div>
                  <label className="text-[11px] text-[#6B7280]">List Title</label>
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => setLabel(e.target.value)}
                    placeholder="e.g. Speakers"
                    className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-[#6B7280]">Helper Hint</label>
                  <input
                    type="text"
                    value={hint}
                    onChange={(e) => setHint(e.target.value)}
                    placeholder="e.g. Add keynote speakers and their titles"
                    className="mt-1 h-8 w-full rounded-[6px] border border-[#D1D5DB] px-2 text-xs"
                  />
                </div>
              </div>

              {/* SECTION 4: Live Grid Preview */}
              <div className="border-t border-[#E5E7EB] pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold text-[#111827] uppercase tracking-wider">
                    Grid Preview ({previewCount} entries)
                  </h3>
                </div>

                {/* Scaled Mini-Grid Preview */}
                <div className="rounded-[8px] border border-[#E5E7EB] bg-slate-50 p-3 overflow-hidden">
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                      gap: `${Math.round(gapY / 4)}px ${Math.round(gapX / 4)}px`,
                      justifyItems: align === 'center' ? 'center' : align === 'right' ? 'end' : 'start',
                    }}
                  >
                    {sampleData.map((s, sIdx) => (
                      <div
                        key={sIdx}
                        style={{
                          width: `${Math.round(cardW / 3.2)}px`,
                          height: `${Math.round(cardH / 3.2)}px`,
                          position: 'relative',
                          backgroundColor: '#ffffff',
                          borderRadius: '6px',
                          border: '1px solid #E2E8F0',
                          overflow: 'hidden',
                        }}
                      >
                        {/* Mini rendered elements */}
                        {cardItems.map((cItem) => {
                          const scale = 1 / 3.2;
                          const mX = Math.round(cItem.x * scale);
                          const mY = Math.round(cItem.y * scale);
                          const mW = Math.round(cItem.w * scale);
                          const mH = Math.round(cItem.h * scale);
                          const isImg = cItem.kind === 'image';
                          const isTxt = cItem.kind === 'text';

                          if (isImg) {
                            return (
                              <div
                                key={cItem.id}
                                style={{
                                  position: 'absolute',
                                  left: `${mX}px`,
                                  top: `${mY}px`,
                                  width: `${mW}px`,
                                  height: `${mH}px`,
                                  borderRadius: cItem.mask === 'circle' ? '9999px' : '3px',
                                  backgroundColor: '#CBD5E1',
                                  overflow: 'hidden',
                                }}
                              >
                                <img
                                  src={s[cItem.fieldKey] || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&auto=format&fit=crop&q=80'}
                                  alt=""
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                              </div>
                            );
                          }

                          if (isTxt) {
                            const val = cItem.fieldKey && s[cItem.fieldKey] ? s[cItem.fieldKey] : cItem.text;
                            return (
                              <div
                                key={cItem.id}
                                style={{
                                  position: 'absolute',
                                  left: `${mX}px`,
                                  top: `${mY}px`,
                                  width: `${mW}px`,
                                  height: `${mH}px`,
                                  fontSize: `${Math.max(6, Math.round((cItem.style?.size || 16) * scale))}px`,
                                  fontWeight: cItem.style?.weight || 600,
                                  color: resolveColorToken(cItem.style?.color || 'brand:heading', brandKit),
                                  overflow: 'hidden',
                                  whiteSpace: 'nowrap',
                                  textOverflow: 'ellipsis',
                                  lineHeight: 1,
                                }}
                              >
                                {val}
                              </div>
                            );
                          }

                          return null;
                        })}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
