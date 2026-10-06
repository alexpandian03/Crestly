import React from 'react';
import { AlignCenter, AlignLeft, AlignRight, CaseSensitive, Bold, Italic } from 'lucide-react';
import {
  ELEMENT_FONTS,
  ELEMENT_LIMITS,
  IMAGE_FITS,
} from '../../../../shared/templateElements.js';
import { hasWords, isPicture } from '../../utils/templateEditorItems';

/* ------------------------------------------------------------------ *
 * The tools for the item you picked, floating at the top of the canvas.
 *
 * Words get their face, size, colour, weight, arrangement, capitals and letter
 * spacing; a photo gets how it fills its box and how round its corners are.
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

export default function ItemToolbar({ item, onStyle, onStyleLive }) {
  if (!item) return null;

  const style = item.style || {};
  const set = (patch) => onStyle?.(item.id, patch);
  const live = (patch) => onStyleLive?.(item.id, patch);
  const weight = Number(style.weight) || 500;
  const bold = weight >= 700;

  const textTools = hasWords(item);
  const photoTools = isPicture(item);
  if (!textTools && !photoTools) return null;

  return (
    <div
      role="group"
      aria-label="Item settings"
      className="flex max-w-full flex-wrap items-end gap-x-3 gap-y-2 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-md"
      onPointerDown={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
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
