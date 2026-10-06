import React, { useEffect, useRef, useState } from 'react';
import { AlignCenter, AlignLeft, AlignRight, CaseSensitive, Bold, Italic, ChevronDown } from 'lucide-react';
import {
  ELEMENT_FONTS,
  ELEMENT_LIMITS,
  IMAGE_FITS,
  VARIABLE_LIMITS,
} from '../../../../shared/templateElements.js';
import {
  FIXED_TEXT_WARNING,
  ITEM_MODES,
  counterLine,
  hasWords,
  isPicture,
  looksLikeFixedText,
  modeOf,
} from '../../utils/templateEditorItems';

/* ------------------------------------------------------------------ *
 * The tools for the item you picked, floating at the top of the canvas.
 *
 * Words get their face, size, colour, weight, arrangement, capitals and letter
 * spacing; a photo gets how it fills its box and how round its corners are. A box of
 * words or a picture of its own also says who fills it in later - the assistant, the
 * person making the poster, or nobody - and where it says the number of those blanks
 * the template still has room for.
 * Every change goes through the same shared rules the API uses, so a tool can
 * never offer something the save would refuse.
 * ------------------------------------------------------------------ */

const SIZE = { min: ELEMENT_LIMITS.fontSize.min, max: ELEMENT_LIMITS.fontSize.max };
const SPACING = ELEMENT_LIMITS.letterSpacing;
const RADIUS = ELEMENT_LIMITS.radius;
const OPACITY = ELEMENT_LIMITS.opacity;

/** A photo with no fade set is fully there. */
function opacityOf(style) {
  const value = Number(style.opacity);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 1;
}

const FIT_LABELS = { cover: 'Fill the box', contain: 'Fit inside' };
const ALIGN_LABELS = { left: 'Left', center: 'Center', right: 'Right' };
const ALIGN_ICONS = { left: AlignLeft, center: AlignCenter, right: AlignRight };

function Tool({ label, children }) {
  return (
    <label className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</span>
      {children}
    </label>
  );
}

function Press({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      onMouseUp={(event) => event.currentTarget.blur()}
      onClick={onClick}
      className={`rounded px-1.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
        active ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  );
}

function Step({ label, value, min, max, step = 1, onLive, onCommit, suffix = '' }) {
  const nudge = (delta) => {
    const next = Math.min(max, Math.max(min, (Number(value) || 0) + delta));
    onCommit(next);
  };
  return (
    <div className="flex items-center gap-1">
      <Press title={`Less ${label}`} onClick={() => nudge(-step)}>
        <span className="text-sm leading-none">−</span>
      </Press>
      <input
        type="number"
        inputMode="decimal"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => {
          const n = Number(event.target.value);
          if (event.target.value.trim() === '' || !Number.isFinite(n)) return;
          onLive(Math.min(max, Math.max(min, n)));
        }}
        onBlur={(event) => {
          const n = Number(event.target.value);
          onCommit(Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : value);
        }}
        onKeyDown={(event) => event.stopPropagation()}
        className="w-[52px] rounded border border-slate-300 px-1 py-0.5 text-center text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none"
      />
      <Press title={`More ${label}`} onClick={() => nudge(step)}>
        <span className="text-sm leading-none">+</span>
      </Press>
      {suffix ? <span className="text-[10px] text-slate-400">{suffix}</span> : null}
    </div>
  );
}

function Slide({ value, min, max, step, label, onLive, onCommit }) {
  return (
    <input
      type="range"
      aria-label={label}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(event) => onLive(Number(event.target.value))}
      onPointerUp={(event) => onCommit(Number(event.currentTarget.value))}
      onBlur={(event) => onCommit(Number(event.currentTarget.value))}
      onKeyDown={(event) => event.stopPropagation()}
      className="h-1.5 w-24 cursor-pointer accent-blue-600"
    />
  );
}

/** Which ways this kind of item can be filled in, in the order the buttons show them. */
function modeOptionsFor(item) {
  if (item?.kind === 'text') return ['locked', 'ai'];
  if (item?.kind === 'image') return ['locked', 'user'];
  return [];
}

const MAX_LENGTH = VARIABLE_LIMITS.maxLength;

/** The name, the instruction and the room of a fill-in, kept out of the way until asked for. */
function MetaPopover({ item, onMeta, onClose }) {
  const [label, setLabel] = useState(item.label || '');
  const [hint, setHint] = useState(item.hint || '');
  const [maxLength, setMaxLength] = useState(Number(item.maxLength) || MAX_LENGTH.default);
  const rootRef = useRef(null);

  useEffect(() => {
    setLabel(item.label || '');
    setHint(item.hint || '');
    setMaxLength(Number(item.maxLength) || MAX_LENGTH.default);
  }, [item.id, item.label, item.hint, item.maxLength]);

  useEffect(() => {
    const away = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) onClose();
    };
    const escape = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', escape, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', escape, true);
    };
  }, [onClose]);

  const hold = (n) => Math.min(MAX_LENGTH.max, Math.max(MAX_LENGTH.min, Math.round(Number(n) || MAX_LENGTH.min)));

  return (
    <div
      ref={rootRef}
      role="dialog"
      aria-label="Fill-in settings"
      className="absolute left-0 top-[calc(100%+6px)] z-[60] w-[280px] max-w-[86vw] rounded-lg border border-slate-200 bg-white p-2.5 text-left shadow-lg"
    >
      <label className="block">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Name of this blank
        </span>
        <input
          type="text"
          aria-label="Name of this blank"
          value={label}
          maxLength={VARIABLE_LIMITS.labelChars}
          onChange={(event) => setLabel(event.target.value)}
          onBlur={() => onMeta({ label })}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') {
              event.preventDefault();
              onMeta({ label });
              onClose();
            }
          }}
          className="mt-0.5 w-full rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
        />
        <span className="mt-0.5 block text-[10px] text-slate-400">
          {label.length}/{VARIABLE_LIMITS.labelChars} · what the assistant is asked to write about
        </span>
      </label>

      <label className="mt-2 block">
        <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          What should the AI write here?
        </span>
        <textarea
          aria-label="What should the AI write here?"
          value={hint}
          rows={2}
          maxLength={VARIABLE_LIMITS.hintChars}
          onChange={(event) => setHint(event.target.value)}
          onBlur={() => onMeta({ hint })}
          onKeyDown={(event) => event.stopPropagation()}
          className="mt-0.5 w-full resize-none rounded border border-slate-300 px-1.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
        />
        <span className="mt-0.5 block text-[10px] text-slate-400">{hint.length}/{VARIABLE_LIMITS.hintChars}</span>
      </label>

      <label className="mt-1 flex items-center justify-between gap-2 text-[11px] text-slate-600">
        Longest it may be
        <input
          type="number"
          aria-label="Longest it may be"
          value={maxLength}
          min={MAX_LENGTH.min}
          max={MAX_LENGTH.max}
          onChange={(event) => {
            const n = Number(event.target.value);
            if (event.target.value.trim() !== '' && Number.isFinite(n)) setMaxLength(hold(n));
          }}
          onBlur={() => onMeta({ maxLength: hold(maxLength) })}
          onKeyDown={(event) => {
            event.stopPropagation();
            if (event.key === 'Enter') onMeta({ maxLength: hold(maxLength) });
          }}
          className="w-16 rounded border border-slate-300 px-1.5 py-1 text-center text-xs tabular-nums text-slate-800 focus:border-blue-500 focus:outline-none"
        />
        <span className="text-[10px] text-slate-400">characters</span>
      </label>

      <button
        type="button"
        onClick={onClose}
        className="mt-2 w-full rounded bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200"
      >
        Done
      </button>
    </div>
  );
}

/** Who fills this item in, how many of them the template still has room for, and its settings. */
function ModeRow({ item, mode, modes, counters, onMode, onMeta }) {
  const [metaOpen, setMetaOpen] = useState(false);
  useEffect(() => setMetaOpen(false), [item.id]);
  const ai = mode === 'ai';
  const warns = ai && looksLikeFixedText(item.text);

  return (
    <div className="relative">
      <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-500">Who changes this?</span>
      <span className="mt-0.5 flex items-center gap-0.5 rounded-btn border border-slate-200 bg-slate-50 p-0.5">
        {modes.map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mode === key}
            title={ITEM_MODES[key]}
            onClick={() => onMode?.(item.id, key)}
            className={`rounded px-2 py-1 text-[11px] font-semibold leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 ${
              mode === key ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {ITEM_MODES[key]}
          </button>
        ))}
      </span>
      <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500">
        <span>{counters.texts}</span>
        <span aria-hidden="true">·</span>
        <span>{counters.images}</span>
        {ai ? (
          <button
            type="button"
            aria-haspopup="dialog"
            aria-expanded={metaOpen}
            onClick={() => setMetaOpen((open) => !open)}
            className="inline-flex items-center gap-1 rounded border border-slate-300 px-1.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            Edit label and hint
            <ChevronDown className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </p>
      {metaOpen ? <MetaPopover item={item} onMeta={(patch) => onMeta?.(item.id, patch)} onClose={() => setMetaOpen(false)} /> : null}
      {warns ? (
        <p
          role="status"
          className="mt-1 w-[260px] max-w-[80vw] rounded border border-amber-300 bg-amber-50 px-2 py-1 text-[10px] leading-snug text-amber-800"
        >
          {FIXED_TEXT_WARNING}
        </p>
      ) : null}
    </div>
  );
}

export default function ItemToolbar({ item, items = [], onStyle, onStyleLive, onMode, onMeta }) {
  if (!item) return null;

  const style = item.style || {};
  const set = (patch) => onStyle?.(item.id, patch);
  const live = (patch) => onStyleLive?.(item.id, patch);
  const weight = Number(style.weight) || 500;
  const bold = weight >= 700;

  const textTools = hasWords(item);
  const photoTools = isPicture(item);
  if (!textTools && !photoTools) return null;

  const counters = counterLine(items);
  const modes = modeOptionsFor(item);
  const mode = modeOf(item);

  return (
    <div
      role="group"
      aria-label="Item settings"
      className="flex max-w-full flex-wrap items-end gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {modes.length > 1 ? (
        <ModeRow item={item} mode={mode} modes={modes} counters={counters} onMode={onMode} onMeta={onMeta} />
      ) : null}

      {textTools ? (
        <>
          <Tool label="Font">
            <select
              aria-label="Font"
              value={style.fontFamily}
              onChange={(event) => set({ fontFamily: event.target.value })}
              className="max-w-[150px] rounded border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
            >
              {ELEMENT_FONTS.map((font) => (
                <option key={font} value={font}>
                  {font}
                </option>
              ))}
            </select>
          </Tool>

          <Tool label="Text size">
            <Step
              label="text size"
              value={style.size}
              min={SIZE.min}
              max={SIZE.max}
              onLive={(size) => live({ size })}
              onCommit={(size) => set({ size })}
            />
          </Tool>

          <Tool label="Colour">
            <span className="flex items-center gap-1">
              <input
                type="color"
                aria-label="Colour"
                value={/^#[0-9a-f]{6}$/i.test(style.color || '') ? style.color : '#0f172a'}
                onChange={(event) => live({ color: event.target.value })}
                onBlur={(event) => set({ color: event.target.value })}
                className="h-7 w-8 cursor-pointer rounded border border-slate-300 bg-white p-0.5"
              />
              <input
                type="text"
                aria-label="Colour code"
                value={style.color || ''}
                maxLength={7}
                onChange={(event) => {
                  const raw = event.target.value;
                  if (/^#[0-9a-fA-F]{6}$/.test(raw)) live({ color: raw });
                }}
                onBlur={(event) => {
                  const raw = event.target.value;
                  if (/^#[0-9a-fA-F]{6}$/.test(raw)) set({ color: raw });
                }}
                onKeyDown={(event) => event.stopPropagation()}
                className="w-[74px] rounded border border-slate-300 px-1 py-1 font-mono text-[11px] uppercase text-slate-700 focus:border-blue-500 focus:outline-none"
              />
            </span>
          </Tool>

          <span className="flex items-center gap-0.5 self-end">
            <Press
              title="Bold"
              active={bold}
              onClick={() => set({ weight: bold ? 400 : 700 })}
            >
              <Bold className="h-3.5 w-3.5" />
            </Press>
            <Press title="Italic" active={Boolean(style.italic)} onClick={() => set({ italic: !style.italic })}>
              <Italic className="h-3.5 w-3.5" />
            </Press>
            <Press
              title="All capitals"
              active={Boolean(style.uppercase)}
              onClick={() => set({ uppercase: !style.uppercase })}
            >
              <CaseSensitive className="h-3.5 w-3.5" />
            </Press>
          </span>

          <Tool label="Align">
            <span className="flex items-center gap-0.5">
              {['left', 'center', 'right'].map((key) => {
                const Icon = ALIGN_ICONS[key];
                return (
                  <Press
                    key={key}
                    title={ALIGN_LABELS[key]}
                    active={(style.align || 'left') === key}
                    onClick={() => set({ align: key })}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </Press>
                );
              })}
            </span>
          </Tool>

          <Tool label="Letter spacing">
            <span className="flex items-center gap-1.5 pb-1">
              <Slide
                label="Letter spacing"
                value={style.letterSpacing || 0}
                min={SPACING.min}
                max={SPACING.max}
                step={0.2}
                onLive={(letterSpacing) => live({ letterSpacing })}
                onCommit={(letterSpacing) => set({ letterSpacing })}
              />
              <span className="w-7 text-[11px] tabular-nums text-slate-500">{(style.letterSpacing || 0).toFixed(1)}</span>
            </span>
          </Tool>
        </>
      ) : null}

      {photoTools ? (
        <>
          <Tool label="Photo display">
            <span className="flex items-center gap-0.5">
              {IMAGE_FITS.map((fit) => (
                <Press key={fit} title={FIT_LABELS[fit]} active={(style.fit || 'cover') === fit} onClick={() => set({ fit })}>
                  <span className="text-[11px] font-semibold">{FIT_LABELS[fit]}</span>
                </Press>
              ))}
            </span>
          </Tool>
          <Tool label="Rounded corners">
            <span className="flex items-center gap-1.5 pb-1">
              <Slide
                label="Rounded corners"
                value={style.radius || 0}
                min={RADIUS.min}
                max={RADIUS.max}
                step={1}
                onLive={(radius) => live({ radius })}
                onCommit={(radius) => set({ radius })}
              />
              <span className="w-7 text-[11px] tabular-nums text-slate-500">{Math.round(style.radius || 0)}</span>
            </span>
          </Tool>
          <Tool label="See-through">
            <span className="flex items-center gap-1.5 pb-1">
              <Slide
                label="How see-through the photo is"
                value={opacityOf(style)}
                min={OPACITY.min}
                max={OPACITY.max}
                step={0.05}
                onLive={(opacity) => live({ opacity })}
                onCommit={(opacity) => set({ opacity })}
              />
              <span className="w-9 text-[11px] tabular-nums text-slate-500">{Math.round(opacityOf(style) * 100)}%</span>
            </span>
          </Tool>
        </>
      ) : null}

      {textTools ? (
        <Tool label="Line height">
          <span className="flex items-center gap-1.5 pb-1">
            <Slide
              label="Line height"
              value={style.lineHeight || 1.2}
              min={ELEMENT_LIMITS.lineHeight.min}
              max={ELEMENT_LIMITS.lineHeight.max}
              step={0.05}
              onLive={(lineHeight) => live({ lineHeight })}
              onCommit={(lineHeight) => set({ lineHeight })}
            />
            <span className="w-7 text-[11px] tabular-nums text-slate-500">{(style.lineHeight || 1.2).toFixed(2)}</span>
          </span>
        </Tool>
      ) : null}
    </div>
  );
}
