import React, { useEffect, useState } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { contrastLabel, parseColor, toHex, wcagLevel } from '../../utils/contrast';
import BrandImageField from './BrandImageField';

/* Same bounds the server accepts, so the form can't offer a value it would reject. */
export const LIMITS = {
  fontSize: { min: 8, max: 200, step: 1 },
  letterSpacing: { min: 0, max: 12, step: 0.5 },
  gradientAngle: { min: 0, max: 360, step: 5 },
  overlayOpacity: { min: 0, max: 1, step: 0.05 },
  watermarkOpacity: { min: 0, max: 0.3, step: 0.01 },
  headerHeight: { min: 60, max: 200, step: 2 },
  footerHeight: { min: 60, max: 260, step: 2 },
  logoSize: { min: 24, max: 160, step: 2 },
  borderThickness: { min: 0, max: 8, step: 1 },
  dividerThickness: { min: 0, max: 8, step: 1 },
  cardRadius: { min: 0, max: 32, step: 1 },
};

export const FONT_OPTIONS = [
  'Outfit',
  'Inter',
  'Montserrat',
  'Poppins',
  'Playfair Display',
  'Plus Jakarta Sans',
  'Cinzel',
  'Roboto',
  'Open Sans',
  'Lato',
  'DM Sans',
  'Nunito',
];

export const WEIGHT_OPTIONS = [
  { value: 400, label: 'Regular' },
  { value: 500, label: 'Medium' },
  { value: 600, label: 'Semibold' },
  { value: 700, label: 'Bold' },
];

export const SOCIAL_OPTIONS = ['facebook', 'instagram', 'x', 'linkedin', 'youtube', 'whatsapp'];

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const DEFAULT_TEXT_STYLE = {
  fontFamily: 'Inter',
  size: 20,
  weight: 500,
  color: '#0f172a',
  uppercase: false,
  letterSpacing: 0,
};

const POSITIONS = ['top', 'center', 'bottom', 'left', 'right'];
const PATTERNS = ['none', 'dots', 'lines', 'grid'];

/** A labelled block: name, control, then optional helper or warning. */
export function Field({ label, hint, htmlFor, children, className = '' }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="block text-xs font-semibold text-heading">
          {label}
        </label>
      )}
      {children}
      {hint && <p className="text-xs text-muted leading-snug">{hint}</p>}
    </div>
  );
}

export function TextInput({ label, value, onChange, id, maxLength, placeholder, hint, type = 'text' }) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <input
        id={id}
        type={type}
        value={value ?? ''}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="input-field"
      />
      {maxLength && (
        <p className="text-[11px] text-muted text-right">
          {String(value ?? '').length}/{maxLength}
        </p>
      )}
    </Field>
  );
}

export function Select({ label, value, onChange, options, hint, id }) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select id={id} value={value ?? ''} onChange={(event) => onChange(event.target.value)} className="input-field">
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          return (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          );
        })}
      </select>
    </Field>
  );
}

export function Toggle({ label, checked, onChange, hint }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-btn border border-line bg-canvas px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-heading">{label}</p>
        {hint && <p className="text-[11px] text-muted leading-snug mt-0.5">{hint}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={`shrink-0 w-11 h-6 rounded-chip border transition-colors relative ${
          checked ? 'bg-primary border-primary' : 'bg-section border-line'
        }`}
      >
        <span
          className="absolute top-0.5 rounded-chip bg-canvas shadow-soft transition-all"
          style={{ left: checked ? '22px' : '3px', width: '18px', height: '18px' }}
        />
      </button>
    </div>
  );
}

/** Slider plus number box: drag for a feel, type for the exact value. */
export function SliderNumber({ label, value, onChange, min, max, step = 1, unit = '', hint }) {
  const clampTo = (raw) => {
    const n = Number(raw);
    if (!Number.isFinite(n)) return;
    onChange(clampNumber(Math.round(n / step) * step, min, max));
  };
  const shown = Number.isFinite(Number(value)) ? Number(value) : min;
  return (
    <Field label={label} hint={hint}>
      <div className="flex items-center gap-3">
        <input
          type="range"
          aria-label={label}
          min={min}
          max={max}
          step={step}
          value={shown}
          onChange={(event) => clampTo(event.target.value)}
          className="flex-1 min-w-0 cursor-pointer"
          style={{ accentColor: 'var(--color-primary)' }}
        />
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            aria-label={`${label} value`}
            min={min}
            max={max}
            step={step}
            value={shown}
            onChange={(event) => {
              const n = Number(event.target.value);
              if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
              else if (event.target.value === '') onChange(min);
            }}
            onBlur={(event) => clampTo(event.target.value)}
            className="input-field w-[74px] px-2 py-1.5 text-right tabular-nums"
          />
          {unit && <span className="text-xs text-muted">{unit}</span>}
        </div>
      </div>
    </Field>
  );
}

export function Segmented({ label, value, onChange, options, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div className="flex flex-wrap gap-1 rounded-btn border border-line bg-section p-1" role="group" aria-label={label}>
        {options.map((option) => {
          const item = typeof option === 'string' ? { value: option, label: option } : option;
          const active = String(item.value) === String(value);
          return (
            <button
              key={String(item.value)}
              type="button"
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              className={`flex-1 min-w-[64px] rounded-[6px] px-2.5 py-1.5 text-xs font-semibold capitalize transition-colors ${
                active ? 'bg-primary text-white shadow-soft' : 'text-body hover:bg-canvas hover:text-heading'
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
    </Field>
  );
}

function ContrastNote({ foreground, background, large }) {
  if (!background || !parseColor(foreground)) return null;
  const level = wcagLevel(foreground, background, { large });
  if (level === 'AAA' || level === 'AA') {
    return <p className="text-[11px] text-success leading-snug">{contrastLabel(foreground, background, { large })}</p>;
  }
  return (
    <p className="flex items-start gap-1.5 text-[11px] text-danger leading-snug">
      <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
      <span>
        {contrastLabel(foreground, background, { large })}. The preview lifts or darkens this text so it stays
        readable.
      </span>
    </p>
  );
}

/** Native color picker plus a typed value, with a contrast check underneath. */
export function ColorInput({ label, value, onChange, onSurface, large = false, hint }) {
  const [draft, setDraft] = useState(null);
  useEffect(() => setDraft(null), [value]);
  const text = draft === null ? String(value ?? '') : draft;
  const invalid = draft !== null && !parseColor(draft);

  const commit = (raw) => {
    const next = raw.trim();
    if (parseColor(next)) onChange(next);
  };

  const named = String(label || '')
    .replace(/\s+color$/i, '')
    .trim();
  const group = named ? `${named} color` : 'Color';

  return (
    <Field label={label} hint={hint}>
      <div
        className={`flex items-center gap-2 rounded-btn border bg-canvas px-2 py-1.5 ${
          invalid ? 'border-danger' : 'border-line'
        }`}
      >
        <input
          type="color"
          aria-label={`${group} picker`}
          value={toHex(value, '#ffffff')}
          onChange={(event) => {
            setDraft(null);
            onChange(event.target.value);
          }}
          className="w-8 h-8 shrink-0 cursor-pointer rounded-[6px] border border-line bg-transparent p-0"
        />
        <input
          type="text"
          aria-label={`${group} value`}
          value={text}
          spellCheck={false}
          onChange={(event) => {
            setDraft(event.target.value);
            if (parseColor(event.target.value)) onChange(event.target.value.trim());
          }}
          onBlur={() => {
            if (draft !== null && !parseColor(draft)) setDraft(null);
            else commit(draft ?? '');
          }}
          className="w-full min-w-0 bg-transparent text-sm text-heading uppercase tracking-wide focus:outline-none"
        />
      </div>
      {invalid && <p className="text-[11px] text-danger">Use a color like #4338CA.</p>}
      {!invalid && <ContrastNote foreground={text} background={onSurface} large={large} />}
    </Field>
  );
}

/** Font, size, weight, color, capitalization and spacing for one text block. */
export function TextStyleEditor({ label, value, onChange, onSurface, sample, columns = true }) {
  const style = value || {};
  const patch = (over) => onChange({ ...DEFAULT_TEXT_STYLE, ...style, ...over });
  const fontFamily = FONT_OPTIONS.includes(style.fontFamily) ? style.fontFamily : DEFAULT_TEXT_STYLE.fontFamily;
  const size = clampNumber(Number(style.size) || DEFAULT_TEXT_STYLE.size, LIMITS.fontSize.min, LIMITS.fontSize.max);

  return (
    <div className="space-y-3 rounded-btn border border-line bg-section p-3">
      <p className="text-xs font-semibold text-heading">{label}</p>
      <div className={columns ? 'grid grid-cols-1 sm:grid-cols-2 gap-3' : 'space-y-3'}>
        <Select
          label="Font"
          value={fontFamily}
          onChange={(next) => patch({ fontFamily: next })}
          options={FONT_OPTIONS}
        />
        <SliderNumber
          label="Text size"
          value={size}
          onChange={(next) => patch({ size: next })}
          min={LIMITS.fontSize.min}
          max={LIMITS.fontSize.max}
          unit="px"
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Segmented
          label="Weight"
          value={WEIGHT_OPTIONS.some((w) => w.value === Number(style.weight)) ? Number(style.weight) : 400}
          onChange={(next) => patch({ weight: Number(next) })}
          options={WEIGHT_OPTIONS}
        />
        <SliderNumber
          label="Letter spacing"
          value={Number.isFinite(Number(style.letterSpacing)) ? Number(style.letterSpacing) : 0}
          onChange={(next) => patch({ letterSpacing: next })}
          min={LIMITS.letterSpacing.min}
          max={LIMITS.letterSpacing.max}
          step={LIMITS.letterSpacing.step}
          unit="px"
        />
      </div>
      <ColorInput
        label="Text color"
        value={style.color}
        onChange={(next) => patch({ color: next })}
        onSurface={onSurface}
        large={size >= 24}
      />
      <Toggle
        label="Show in capitals"
        checked={Boolean(style.uppercase)}
        onChange={(next) => patch({ uppercase: next })}
      />
      {sample && (
        <p
          className="rounded-btn border border-line bg-canvas px-3 py-2 truncate"
          style={{
            fontFamily: `'${fontFamily}', sans-serif`,
            fontSize: `${Math.min(size, 30)}px`,
            fontWeight: Number(style.weight) || 400,
            letterSpacing: `${Number(style.letterSpacing) || 0}px`,
            textTransform: style.uppercase ? 'uppercase' : 'none',
            color: toHex(style.color, '#1e1b4b'),
          }}
        >
          {sample}
        </p>
      )}
    </div>
  );
}

const BACKGROUND_TYPE_LABELS = {
  color: 'Solid',
  gradient: 'Gradient',
  image: 'Photo',
  pattern: 'Pattern',
};

/**
 * Background block shared by the poster, the top band and the bottom band.
 * `onImage` receives the uploaded URL for the photo option.
 */
export function BackgroundEditor({
  label,
  value,
  onChange,
  types = ['color', 'gradient', 'image'],
  uploadKind = 'header',
  uploadLabel = 'Upload background image',
  hint,
}) {
  const bg = value || {};
  const allowed = types;
  const type = allowed.includes(bg.type) ? bg.type : allowed[0];
  const patch = (over) => onChange({ ...bg, type, ...over });

  return (
    <div className="space-y-3">
      <Segmented
        label={label}
        hint={hint}
        value={type}
        onChange={(next) => patch({ type: next })}
        options={allowed.map((item) => ({ value: item, label: BACKGROUND_TYPE_LABELS[item] }))}
      />
      {type === 'color' && (
        <ColorInput label="Background color" value={bg.color} onChange={(next) => patch({ color: next })} />
      )}
      {type === 'gradient' && (
        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorInput label="Start color" value={bg.gradientFrom} onChange={(next) => patch({ gradientFrom: next })} />
            <ColorInput label="End color" value={bg.gradientTo} onChange={(next) => patch({ gradientTo: next })} />
          </div>
          <SliderNumber
            label="Gradient direction"
            value={Number.isFinite(Number(bg.gradientAngle)) ? Number(bg.gradientAngle) : 135}
            onChange={(next) => patch({ gradientAngle: next })}
            min={LIMITS.gradientAngle.min}
            max={LIMITS.gradientAngle.max}
            step={LIMITS.gradientAngle.step}
            unit="°"
          />
        </div>
      )}
      {type === 'image' && (
        <div className="space-y-3">
          <BrandImageField
            label={uploadLabel}
            kind={uploadKind}
            value={bg.imageUrl || ''}
            onChange={(url) => patch({ imageUrl: url })}
            hint="A dark or light wash over the photo keeps the text readable."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <ColorInput
              label="Wash color"
              value={bg.overlayColor}
              onChange={(next) => patch({ overlayColor: next })}
            />
            <SliderNumber
              label="Wash strength"
              value={Number.isFinite(Number(bg.overlayOpacity)) ? Number(bg.overlayOpacity) : 0.4}
              onChange={(next) => patch({ overlayOpacity: next })}
              min={LIMITS.overlayOpacity.min}
              max={LIMITS.overlayOpacity.max}
              step={LIMITS.overlayOpacity.step}
            />
          </div>
          {'position' in bg && (
            <Segmented
              label="Photo focus"
              value={POSITIONS.includes(bg.position) ? bg.position : 'center'}
              onChange={(next) => patch({ position: next })}
              options={POSITIONS.map((item) => ({ value: item, label: item }))}
            />
          )}
        </div>
      )}
      {type === 'pattern' && (
        <div className="space-y-3">
          <ColorInput label="Background color" value={bg.color} onChange={(next) => patch({ color: next })} />
          <Segmented
            label="Pattern"
            value={PATTERNS.includes(bg.pattern) ? bg.pattern : 'dots'}
            onChange={(next) => patch({ pattern: next })}
            options={PATTERNS.map((item) => ({ value: item, label: item }))}
          />
          <p className="text-xs text-muted">The pattern is drawn in the decoration color.</p>
        </div>
      )}
    </div>
  );
}

/** Card wrapper with a title and an optional "restore saved values" action. */
export function SectionCard({ title, desc, icon: Icon, onReset, resetLabel = 'Reset section', children }) {
  return (
    <section className="card-surface p-4 sm:p-5 space-y-4">
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-line">
        <div className="flex items-start gap-2.5 min-w-0">
          {Icon && <Icon size={18} className="shrink-0 text-primary mt-0.5" />}
          <div className="min-w-0">
            <h2 className="text-sm font-semibold text-heading">{title}</h2>
            {desc && <p className="text-xs text-muted mt-0.5 leading-snug">{desc}</p>}
          </div>
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="btn-ghost border border-line shrink-0 text-[11px] px-2 py-1"
            title={resetLabel}
          >
            <RotateCcw size={12} />
            <span>Reset</span>
          </button>
        )}
      </div>
      {children}
    </section>
  );
}
