import React, { useEffect, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import {
  contrastLabel,
  parseColor,
  toHex,
  wcagLevel,
} from "../../utils/contrast";
import { resolveColorToken } from "../../../../shared/templateElements.js";
import BrandImageField from "./BrandImageField";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";

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
  "Outfit",
  "Inter",
  "Montserrat",
  "Poppins",
  "Playfair Display",
  "Plus Jakarta Sans",
  "Cinzel",
  "Roboto",
  "Open Sans",
  "Lato",
  "DM Sans",
  "Nunito",
];

export const WEIGHT_OPTIONS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
];

export const SOCIAL_OPTIONS = [
  "facebook",
  "instagram",
  "x",
  "linkedin",
  "youtube",
  "whatsapp",
];

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const DEFAULT_TEXT_STYLE = {
  fontFamily: "Inter",
  size: 20,
  weight: 500,
  color: "#0f172a",
  uppercase: false,
  letterSpacing: 0,
};

const POSITIONS = ["top", "center", "bottom", "left", "right"];
const PATTERNS = ["none", "dots", "lines", "grid"];

/** A labelled block: name, control, then optional helper or warning. */
export function Field({ label, hint, htmlFor, children, className = "" }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="block text-[13px] font-medium text-[#111827]"
        >
          {label}
        </label>
      )}
      {children}
      {hint && (
        <p className="text-xs text-[#6B7280] leading-snug">{hint}</p>
      )}
    </div>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  id,
  maxLength,
  placeholder,
  hint,
  type = "text",
}) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <Input
        id={id}
        type={type}
        value={value ?? ""}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-[6px] border-[#E5E7EB] bg-white text-sm text-[#111827] focus-visible:border-[#2563EB] focus-visible:ring-1 focus-visible:ring-[#2563EB]"
      />
      {maxLength && (
        <p className="text-[11px] text-[#6B7280] text-right">
          {String(value ?? "").length}/{maxLength}
        </p>
      )}
    </Field>
  );
}

export function Select({ label, value, onChange, options, hint, id }) {
  return (
    <Field label={label} hint={hint} htmlFor={id}>
      <select
        id={id}
        value={value ?? ""}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 text-sm text-[#111827] shadow-none outline-none focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB]"
      >
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
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
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0">
        <p className="text-[13px] font-medium text-[#111827]">{label}</p>
        {hint && (
          <p className="text-xs text-[#6B7280] leading-snug mt-0.5">
            {hint}
          </p>
        )}
      </div>
      <Switch
        checked={Boolean(checked)}
        onCheckedChange={(val) => onChange(val)}
        aria-label={label}
      />
    </div>
  );
}

/** Slider plus number box: drag for a feel, type for the exact value. */
export function SliderNumber({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  unit = "",
  hint,
}) {
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
          className="flex-1 min-w-0 cursor-pointer accent-[#2563EB]"
        />
        <div className="flex items-center gap-1.5 shrink-0">
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
              else if (event.target.value === "") onChange(min);
            }}
            onBlur={(event) => clampTo(event.target.value)}
            className="h-9 w-[74px] rounded-[6px] border border-[#E5E7EB] bg-white px-2 py-1 text-right tabular-nums text-sm text-[#111827] focus:border-[#2563EB] focus:ring-1 focus:ring-[#2563EB] outline-none"
          />
          {unit && (
            <span className="text-xs text-[#6B7280]">{unit}</span>
          )}
        </div>
      </div>
    </Field>
  );
}

export function Segmented({ label, value, onChange, options, hint }) {
  return (
    <Field label={label} hint={hint}>
      <div
        className="flex flex-wrap gap-1 rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-1"
        role="group"
        aria-label={label}
      >
        {options.map((option) => {
          const item =
            typeof option === "string"
              ? { value: option, label: option }
              : option;
          const active = String(item.value) === String(value);
          return (
            <button
              key={String(item.value)}
              type="button"
              onClick={() => onChange(item.value)}
              aria-pressed={active}
              className={`flex-1 min-w-[64px] rounded-[6px] px-2.5 py-1.5 text-xs font-medium capitalize transition-colors ${
                active
                  ? "bg-white text-[#111827] border border-[#E5E7EB] shadow-xs"
                  : "text-[#6B7280] hover:text-[#111827] hover:bg-white/50"
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

function ContrastNote({ foreground, background, large, brandKit }) {
  const fg = resolveColorToken(foreground, brandKit);
  const bg = resolveColorToken(background, brandKit);
  if (!bg || !parseColor(fg)) return null;
  const level = wcagLevel(fg, bg, { large });
  const isPass = level === "AAA" || level === "AA";
  return (
    <p className="flex items-center gap-1.5 text-xs text-[#6B7280] leading-snug mt-1">
      <span
        className={`w-1.5 h-1.5 rounded-full shrink-0 ${
          isPass ? "bg-[#10B981]" : "bg-[#F59E0B]"
        }`}
      />
      <span>{contrastLabel(fg, bg, { large })}</span>
    </p>
  );
}

/** Native color picker plus a typed value, with a contrast check underneath. */
export function ColorInput({
  label,
  value,
  onChange,
  onSurface,
  large = false,
  hint,
  brandKit = null,
}) {
  const [draft, setDraft] = useState(null);
  useEffect(() => setDraft(null), [value]);
  const text = draft === null ? String(value ?? "") : draft;
  const resolvedText = resolveColorToken(text, brandKit);
  const invalid = draft !== null && !parseColor(resolvedText);

  const commit = (raw) => {
    const next = raw.trim();
    if (parseColor(resolveColorToken(next, brandKit))) onChange(next);
  };

  const named = String(label || "")
    .replace(/\s+color$/i, "")
    .trim();
  const group = named ? `${named} color` : "Color";
  const swatchHex = toHex(resolveColorToken(value, brandKit), "#ffffff");

  return (
    <Field label={label} hint={hint}>
      <div
        className={`relative flex items-center h-9 rounded-[6px] border bg-white px-2.5 gap-2.5 transition-colors focus-within:border-[#2563EB] focus-within:ring-1 focus-within:ring-[#2563EB] ${
          invalid ? "border-[#DC2626]" : "border-[#E5E7EB]"
        }`}
      >
        <label
          className="relative flex items-center justify-center w-5 h-5 rounded-[4px] border border-[#E5E7EB] shrink-0 cursor-pointer overflow-hidden shadow-xs"
          style={{ backgroundColor: swatchHex }}
          title={`Pick ${group}`}
        >
          <input
            type="color"
            aria-label={`${group} picker`}
            value={swatchHex}
            onChange={(event) => {
              setDraft(null);
              onChange(event.target.value);
            }}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
        </label>
        <input
          type="text"
          aria-label={`${group} value`}
          value={text}
          spellCheck={false}
          onChange={(event) => {
            setDraft(event.target.value);
            if (parseColor(resolveColorToken(event.target.value, brandKit)))
              onChange(event.target.value.trim());
          }}
          onBlur={() => {
            if (draft !== null && !parseColor(resolveColorToken(draft, brandKit)))
              setDraft(null);
            else commit(draft ?? "");
          }}
          className="flex-1 min-w-[70px] bg-transparent text-sm font-mono text-[#111827] uppercase tracking-wide focus:outline-none placeholder:text-[#9CA3AF]"
        />
      </div>
      {invalid && (
        <p className="text-xs text-[#DC2626] mt-1">
          Use a color like #2563EB or a brand color.
        </p>
      )}
      {!invalid && (
        <ContrastNote
          foreground={text}
          background={onSurface}
          large={large}
          brandKit={brandKit}
        />
      )}
    </Field>
  );
}

/** Font, size, weight, color, capitalization and spacing for one text block. */
export function TextStyleEditor({
  label,
  value,
  onChange,
  onSurface,
  sample,
  columns = true,
}) {
  const style = value || {};
  const patch = (over) =>
    onChange({ ...DEFAULT_TEXT_STYLE, ...style, ...over });
  const fontFamily = FONT_OPTIONS.includes(style.fontFamily)
    ? style.fontFamily
    : DEFAULT_TEXT_STYLE.fontFamily;
  const size = clampNumber(
    Number(style.size) || DEFAULT_TEXT_STYLE.size,
    LIMITS.fontSize.min,
    LIMITS.fontSize.max,
  );

  return (
    <div className="space-y-3 rounded-[8px] border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
      <p className="text-[13px] font-semibold text-[#111827]">{label}</p>
      <div
        className={
          columns ? "grid grid-cols-2 gap-4" : "space-y-3"
        }
      >
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
      <div className="grid grid-cols-2 gap-4">
        <Segmented
          label="Weight"
          value={
            WEIGHT_OPTIONS.some((w) => w.value === Number(style.weight))
              ? Number(style.weight)
              : 400
          }
          onChange={(next) => patch({ weight: Number(next) })}
          options={WEIGHT_OPTIONS}
        />
        <SliderNumber
          label="Letter spacing"
          value={
            Number.isFinite(Number(style.letterSpacing))
              ? Number(style.letterSpacing)
              : 0
          }
          onChange={(next) => patch({ letterSpacing: next })}
          min={LIMITS.letterSpacing.min}
          max={LIMITS.letterSpacing.max}
          step={LIMITS.letterSpacing.step}
          unit="px"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <ColorInput
          label="Text color"
          value={style.color}
          onChange={(next) => patch({ color: next })}
          onSurface={onSurface}
          large={size >= 24}
        />
      </div>
      <Toggle
        label="Show in capitals"
        checked={Boolean(style.uppercase)}
        onChange={(next) => patch({ uppercase: next })}
      />
      {sample && (
        <p
          className="rounded-[6px] border border-[#E5E7EB] bg-white px-3 py-2 truncate text-sm text-[#111827]"
          style={{
            fontFamily: `'${fontFamily}', sans-serif`,
            fontSize: `${Math.min(22, Math.max(12, size * 0.75))}px`,
            fontWeight: Number(style.weight) || 400,
            textTransform: style.uppercase ? "uppercase" : "none",
            letterSpacing: `${style.letterSpacing || 0}px`,
          }}
        >
          {sample}
        </p>
      )}
    </div>
  );
}

const BACKGROUND_TYPE_LABELS = {
  color: "Solid",
  gradient: "Gradient",
  image: "Photo",
  pattern: "Pattern",
};

/**
 * Background block shared by the poster, the top band and the bottom band.
 * `onImage` receives the uploaded URL for the photo option.
 */
export function BackgroundEditor({
  label,
  value,
  onChange,
  types = ["color", "gradient", "image"],
  uploadKind = "header",
  uploadLabel = "Upload background image",
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
        options={allowed.map((item) => ({
          value: item,
          label: BACKGROUND_TYPE_LABELS[item],
        }))}
      />
      {type === "color" && (
        <ColorInput
          label="Background color"
          value={bg.color}
          onChange={(next) => patch({ color: next })}
        />
      )}
      {type === "gradient" && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <ColorInput
              label="Start color"
              value={bg.gradientFrom}
              onChange={(next) => patch({ gradientFrom: next })}
            />
            <ColorInput
              label="End color"
              value={bg.gradientTo}
              onChange={(next) => patch({ gradientTo: next })}
            />
          </div>
          <SliderNumber
            label="Gradient direction"
            value={
              Number.isFinite(Number(bg.gradientAngle))
                ? Number(bg.gradientAngle)
                : 135
            }
            onChange={(next) => patch({ gradientAngle: next })}
            min={LIMITS.gradientAngle.min}
            max={LIMITS.gradientAngle.max}
            step={LIMITS.gradientAngle.step}
            unit="°"
          />
        </div>
      )}
      {type === "image" && (
        <div className="space-y-3">
          <BrandImageField
            label={uploadLabel}
            kind={uploadKind}
            value={bg.imageUrl || ""}
            onChange={(url) => patch({ imageUrl: url })}
            hint="A dark or light wash over the photo keeps the text readable."
          />
          <div className="grid grid-cols-2 gap-4">
            <ColorInput
              label="Wash color"
              value={bg.overlayColor}
              onChange={(next) => patch({ overlayColor: next })}
            />
            <SliderNumber
              label="Wash strength"
              value={
                Number.isFinite(Number(bg.overlayOpacity))
                  ? Number(bg.overlayOpacity)
                  : 0.4
              }
              onChange={(next) => patch({ overlayOpacity: next })}
              min={LIMITS.overlayOpacity.min}
              max={LIMITS.overlayOpacity.max}
              step={LIMITS.overlayOpacity.step}
            />
          </div>
          {"position" in bg && (
            <Segmented
              label="Photo focus"
              value={POSITIONS.includes(bg.position) ? bg.position : "center"}
              onChange={(next) => patch({ position: next })}
              options={POSITIONS.map((item) => ({ value: item, label: item }))}
            />
          )}
        </div>
      )}
      {type === "pattern" && (
        <div className="space-y-3">
          <ColorInput
            label="Background color"
            value={bg.color}
            onChange={(next) => patch({ color: next })}
          />
          <Segmented
            label="Pattern"
            value={PATTERNS.includes(bg.pattern) ? bg.pattern : "dots"}
            onChange={(next) => patch({ pattern: next })}
            options={PATTERNS.map((item) => ({ value: item, label: item }))}
          />
          <p className="text-xs text-muted-foreground">
            The pattern is drawn in the decoration color.
          </p>
        </div>
      )}
    </div>
  );
}

/** Section wrapper with a 16px/600 title, helper text, and an optional ghost "Reset" action. */
export function SectionCard({
  title,
  desc,
  icon: Icon,
  onReset,
  resetLabel = "Reset section",
  children,
}) {
  return (
    <section className="space-y-4 py-6 first:pt-0 last:pb-0 border-b border-[#E5E7EB] last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold text-[#111827]">{title}</h2>
          {desc && (
            <p className="text-xs text-[#6B7280] mt-0.5 leading-snug">
              {desc}
            </p>
          )}
        </div>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="h-7 px-2 text-xs font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] rounded-[6px] transition-colors shrink-0 flex items-center gap-1.5"
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
