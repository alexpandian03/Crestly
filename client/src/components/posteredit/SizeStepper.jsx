import React from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";

/* ------------------------------------------------------------------ *
 * The one thing a user may change about the size of the words: how big they are,
 * never past what the template allows and never under the smallest readable size
 * the organization set. Moving, resizing or deleting is not offered here at all.
 * ------------------------------------------------------------------ */

export default function SizeStepper({
  label,
  size,
  range,
  disabled = false,
  onChange,
  onReset,
}) {
  const atLow = size <= range.lo;
  const atHigh = size >= range.hi;
  const changed = size !== range.current;

  return (
    <div
      role="group"
      aria-label={`${label} text size`}
      className="flex items-center gap-1 rounded-chip border border-line bg-canvas px-1.5 py-1"
      style={{ pointerEvents: "auto" }}
    >
      <span className="hidden px-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground sm:inline">
        {label}
      </span>

      <button
        type="button"
        disabled={disabled || atLow}
        onClick={() => onChange(size - range.step)}
        aria-label="Make these words smaller"
        title={
          atLow
            ? "These words are already as small as they can be."
            : "Make these words smaller"
        }
        className="flex h-7 w-7 items-center justify-center rounded-chip border border-line text-heading hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>

      <span className="min-w-[3.4rem] text-center text-xs font-semibold tabular-nums text-heading">
        {size} px
      </span>

      <button
        type="button"
        disabled={disabled || atHigh}
        onClick={() => onChange(size + range.step)}
        aria-label="Make these words larger"
        title={
          atHigh
            ? "These words are already as large as this layout allows."
            : "Make these words larger"
        }
        className="flex h-7 w-7 items-center justify-center rounded-chip border border-line text-heading hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>

      {changed ? (
        <button
          type="button"
          disabled={disabled}
          onClick={onReset}
          className="flex items-center gap-1 rounded-chip px-1.5 py-1 text-[11px] font-semibold text-muted-foreground hover:bg-section hover:text-heading"
          title="Back to the size this layout was made with"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      ) : null}
    </div>
  );
}
