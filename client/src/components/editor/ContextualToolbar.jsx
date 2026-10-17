import React, { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HexColorPicker } from "react-colorful";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Copy,
  Layers,
  Lock,
  LockOpen,
  MoreHorizontal,
  Sliders,
  Sparkles,
  Trash2,
  Type,
  Upload,
  Crop,
  AlertTriangle,
  FlipHorizontal,
  FlipVertical,
} from "lucide-react";
import {
  ELEMENT_FONTS,
  ELEMENT_LIMITS,
  IMAGE_FITS,
  IMAGE_MASKS,
  VARIABLE_LIMITS,
  isBrandColorToken,
  isGenericLabel,
  resolveColorToken,
  effectivePage,
} from "../../../../shared/templateElements.js";
import { directUploadAsset } from "../../utils/assetUpload.js";
import { contrastRatio, pickReadableColor, toHex } from "../../utils/contrast.js";
import {
  hasWords,
  isHeadlineItem,
  isPicture,
  labelSuggestions,
} from "../../utils/templateEditorItems";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

const BRAND_SWATCHES = [
  { token: "brand:primary", label: "Primary" },
  { token: "brand:secondary", label: "Secondary" },
  { token: "brand:accent", label: "Accent" },
  { token: "brand:text", label: "Text" },
  { token: "brand:background", label: "Background" },
  { token: "brand:heading", label: "Heading" },
  { token: "brand:body", label: "Body" },
];

const GRADIENT_SWATCHES = [
  { label: "Deep Blue", value: "linear-gradient(135deg, #1e3a8a, #3b82f6)" },
  { label: "Sunset", value: "linear-gradient(135deg, #ea580c, #ec4899)" },
  { label: "Emerald", value: "linear-gradient(135deg, #065f46, #10b981)" },
  { label: "Purple Mist", value: "linear-gradient(135deg, #581c87, #a855f7)" },
  { label: "Golden Sun", value: "linear-gradient(135deg, #b45309, #f59e0b)" },
  { label: "Dark Slate", value: "linear-gradient(135deg, #0f172a, #334155)" },
];

/**
 * The panels that are open right now, so opening one closes the others - except the panel it
 * hangs from, which has to stay put for its own controls to keep working.
 */
const openPanels = new Map();
const PanelLineage = React.createContext([]);
let panelSeq = 0;

/**
 * A toolbar panel that hangs under its own button.
 * The pill bar is a narrow, clipped strip, so a panel placed inside it gets cut off. Every
 * panel here is painted on the page itself, under the button that opened it, flipped up when
 * there is no room below and kept inside the window. `data-editor-ui` tells the poster
 * workspace that a click inside belongs to the tools, not to the canvas.
 */
function ToolbarPanel({ anchorRect, label, width = 260, className = "", children, onClose }) {
  const hostRef = useRef(null);
  const [placed, setPlaced] = useState(null);
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = ++panelSeq;
  const lineage = useContext(PanelLineage);
  const lineageRef = useRef(null);
  if (lineageRef.current === null) lineageRef.current = lineage;
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useLayoutEffect(() => {
    const node = hostRef.current;
    if (!node || !anchorRect) return;
    const panelW = node.offsetWidth || width;
    const panelH = node.offsetHeight || 160;
    const margin = 8;
    const left = Math.min(
      Math.max(margin, anchorRect.left),
      Math.max(margin, window.innerWidth - panelW - margin),
    );
    const below = anchorRect.bottom + 6;
    const above = anchorRect.top - panelH - 6;
    const top = below + panelH <= window.innerHeight - margin ? below : Math.max(margin, above);
    setPlaced({ left: Math.round(left), top: Math.round(top), width: panelW });
  }, [anchorRect, width, children]);

  useEffect(() => {
    /* Opening a panel shuts every other panel down, except the ones it hangs from: a control
       that lives inside the More panel still has to be able to show its own choices. A click
       that lands on any tool or panel is left alone - the panels live at the end of the
       document, so "outside this panel" means little. */
    const id = idRef.current;
    const ancestors = lineageRef.current;
    const close = () => closeRef.current?.();
    openPanels.set(id, close);
    openPanels.forEach((shut, other) => {
      if (other !== id && !ancestors.includes(other)) shut();
    });
    const away = (event) => {
      if (event.target?.closest?.("[data-editor-ui]")) return;
      close();
    };
    const escape = (event) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", escape, true);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      if (openPanels.get(id) === close) openPanels.delete(id);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", escape, true);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, []);

  if (!anchorRect) return null;
  return createPortal(
    <div
      ref={hostRef}
      role="dialog"
      aria-label={label}
      data-editor-ui="true"
      onPointerDown={(event) => event.stopPropagation()}
      className={`fixed rounded-[8px] border border-[#E5E7EB] bg-white p-3 shadow-xl text-left text-xs ${className}`}
      style={{
        left: placed ? placed.left : anchorRect.left,
        top: placed ? placed.top : anchorRect.bottom + 6,
        width: placed ? undefined : width,
        zIndex: 1200,
        visibility: placed ? "visible" : "hidden",
      }}
    >
      <PanelLineage.Provider value={lineage.concat(idRef.current)}>{children}</PanelLineage.Provider>
    </div>,
    document.body,
  );
}

/** Open/close a panel from its own button, remembering where the button is. */
function useToolbarPanel() {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState(null);

  const toggle = (event) => {
    const box = event.currentTarget.getBoundingClientRect();
    setRect({ left: box.left, top: box.top, bottom: box.bottom, right: box.right });
    setOpen((prev) => !prev);
  };

  return { open, setOpen, rect, toggle };
}

/**
 * A choice list opened from the tool strip.
 *
 * The strip's overflow panel is painted at a high stacking level, so a plain menu list opened
 * from inside it lands underneath and its buttons cannot be reached. These lists are marked as
 * editor tools and painted above every panel, so a click inside them stays inside the tools
 * instead of shutting the panel that holds the button.
 */
function ToolbarMenuContent({ className = "", ...props }) {
  return (
    <DropdownMenuContent
      data-editor-ui="true"
      className={`z-[1300] ${className}`}
      {...props}
    />
  );
}

/**
 * How many of the last groups step into the More panel.
 *
 * Every group is measured once, invisibly, at its natural width. The bar then keeps the groups
 * that fit and tucks the rest away, so a narrow window never leaves a control cut off.
 */
const GROUP_GAP = 8;
const MORE_BUTTON_WIDTH = 44;
const FIT_SAFETY = 12;

function foldsFor(widths, available) {
  if (widths.length === 0 || available <= 0) return 0;
  const gaps = GROUP_GAP * Math.max(0, widths.length - 1);
  let used = widths.reduce((total, width) => total + width, 0) + gaps;
  if (used <= available - FIT_SAFETY) return 0;
  let fold = 0;
  while (fold < widths.length - 1 && used + MORE_BUTTON_WIDTH > available - FIT_SAFETY) {
    used -= widths[widths.length - 1 - fold] + GROUP_GAP;
    fold += 1;
  }
  return fold;
}

/**
 * The tool strip. Groups come in order of how much they are needed: the ones at the end are the
 * first to move into the More panel when the room gets tight.
 */
function ToolbarRow({ groups, signature, label }) {
  const rowRef = useRef(null);
  const measureRef = useRef(null);
  const [widths, setWidths] = useState([]);
  const [available, setAvailable] = useState(0);
  const panel = useToolbarPanel();

  const listed = useMemo(() => groups.filter(Boolean), [groups]);
  const stacked = useMemo(
    () =>
      listed.map((group) => (
        <div key={group.key} className="flex items-center gap-1.5 shrink-0">
          {group.node}
        </div>
      )),
    [listed],
  );

  useLayoutEffect(() => {
    const host = measureRef.current;
    if (!host) return;
    const next = Array.from(host.children).map((node) => node.getBoundingClientRect().width);
    setWidths((prev) =>
      prev.length === next.length && prev.every((w, i) => Math.abs(w - next[i]) < 1)
        ? prev
        : next,
    );
  }, [signature, stacked]);

  useEffect(() => {
    const room = () => {
      const row = rowRef.current;
      if (!row) return;
      const controls = row.closest("[data-editor-controls]");
      const width = (controls || row.parentElement)?.clientWidth || 0;
      setAvailable(Math.max(0, width - 34));
    };
    room();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", room);
      return () => window.removeEventListener("resize", room);
    }
    const observer = new ResizeObserver(room);
    const controls = rowRef.current?.closest("[data-editor-controls]");
    if (controls) observer.observe(controls);
    else if (rowRef.current?.parentElement) observer.observe(rowRef.current.parentElement);
    return () => observer.disconnect();
  }, [label]);

  const fold = foldsFor(widths, available);
  const keep = Math.max(1, widths.length - fold);
  const inline = stacked.slice(0, keep);
  const tucked = listed.slice(keep);

  return (
    <>
      <div
        ref={rowRef}
        role="toolbar"
        aria-label={label}
        data-editor-ui="true"
        onPointerDown={keepClickInsideTools}
        onMouseDown={keepClickInsideTools}
        className={TOOLBAR_ROW_CLASS}
      >
        {inline}
        {tucked.length > 0 && (
          <button
            type="button"
            title="More tools"
            aria-label="More tools"
            aria-expanded={panel.open}
            onClick={panel.toggle}
            className={`h-8 w-8 shrink-0 flex items-center justify-center rounded-[6px] border transition-colors ${
              panel.open
                ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
                : "border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]"
            }`}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Measured, never seen: the natural width of every group. */}
      <div className="absolute left-0 top-0 h-0 w-0 overflow-hidden" aria-hidden="true">
        <div ref={measureRef} className="flex items-center gap-2 flex-nowrap whitespace-nowrap w-max">
          {stacked}
        </div>
      </div>

      {tucked.length > 0 && panel.open && (
        <ToolbarPanel
          anchorRect={panel.rect}
          label="More tools"
          width={300}
          className="space-y-3"
          onClose={() => panel.setOpen(false)}
        >
          {tucked.map((group) => (
            <div key={group.key} className="space-y-1.5">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                {group.label}
              </span>
              <div className="flex flex-wrap items-center gap-1.5">{group.node}</div>
            </div>
          ))}
        </ToolbarPanel>
      )}
    </>
  );
}

/** The strip that holds the tools: never wider than the room it was given. */
const TOOLBAR_ROW_CLASS =
  "flex items-center gap-2 text-xs select-none flex-nowrap whitespace-nowrap min-w-0 overflow-x-hidden";

/** Clicks on the bar must never reach the canvas behind it. */
function keepClickInsideTools(event) {
  event.stopPropagation();
  /* A field the person can type in still needs its own focus and its own picker. */
  if (event.target?.closest?.("input, select, textarea, [contenteditable]")) return;
  event.preventDefault();
}

function ItemColorPicker({ value, brandKit, surfaceBg, onCommit, label = "Colour", allowGradient = false }) {
  const { open, setOpen, rect, toggle } = useToolbarPanel();

  const isGrad = typeof value === "string" && (value.includes("gradient") || value.includes("url"));
  const isToken = !isGrad && isBrandColorToken(value);
  const tokenObj = BRAND_SWATCHES.find((s) => s.token === value);
  const tokenLabel = tokenObj ? tokenObj.label : "Brand";
  const resolvedColor = isGrad ? value : resolveColorToken(value, brandKit);
  const resolvedHex = isGrad ? "#2563eb" : toHex(resolvedColor, "#0f172a");
  const [draftHex, setDraftHex] = useState(resolvedHex);
  useEffect(() => setDraftHex(resolvedHex), [resolvedHex]);

  return (
    <>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={toggle}
        className="flex items-center gap-1.5 h-8 rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-xs text-[#111827] hover:bg-[#F9FAFB] focus:outline-none"
      >
        <span
          className="h-4 w-4 rounded-full border border-slate-300 shrink-0 shadow-inner"
          style={{ background: isGrad ? value : resolvedHex }}
        />
        <span className="max-w-[70px] truncate font-medium">
          {isGrad ? "Gradient" : isToken ? tokenLabel : "Custom"}
        </span>
        <ChevronDown className="h-3 w-3 text-[#9CA3AF]" />
      </button>

      {open && (
        <ToolbarPanel
          anchorRect={rect}
          label="Colour picker"
          className="space-y-2"
          onClose={() => setOpen(false)}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
            Brand colours
          </span>
          <div className="flex flex-wrap gap-1.5">
            {BRAND_SWATCHES.map((swatch) => {
              const swatchColor = toHex(resolveColorToken(swatch.token, brandKit), "#ffffff");
              const active = value === swatch.token;
              return (
                <button
                  key={swatch.token}
                  type="button"
                  title={`${swatch.label} (${swatchColor})`}
                  onClick={() => {
                    onCommit(swatch.token);
                    setOpen(false);
                  }}
                  className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 transition-transform hover:scale-105 ${
                    active ? "ring-2 ring-[#2563EB] ring-offset-1" : ""
                  }`}
                  style={{ backgroundColor: swatchColor }}
                >
                  {active && <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />}
                </button>
              );
            })}
          </div>

          {allowGradient && (
            <div className="pt-2 border-t border-[#E5E7EB] space-y-1">
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
                Gradients
              </span>
              <div className="flex flex-wrap gap-1.5">
                {GRADIENT_SWATCHES.map((grad) => {
                  const active = value === grad.value;
                  return (
                    <button
                      key={grad.label}
                      type="button"
                      title={grad.label}
                      onClick={() => {
                        onCommit(grad.value);
                        setOpen(false);
                      }}
                      className={`relative flex h-7 w-7 items-center justify-center rounded-full border border-slate-300 transition-transform hover:scale-105 ${
                        active ? "ring-2 ring-[#2563EB] ring-offset-1" : ""
                      }`}
                      style={{ background: grad.value }}
                    >
                      {active && <Check className="h-3.5 w-3.5 text-white drop-shadow-md" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-[#E5E7EB] space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Custom colour
            </span>
            <HexColorPicker
              color={resolvedHex}
              onChange={(next) => onCommit(next)}
              style={{ width: "100%", height: "96px" }}
              aria-label="Pick any colour"
            />
            <input
              type="text"
              value={draftHex}
              onChange={(e) => setDraftHex(e.target.value)}
              onBlur={() => /^#?[0-9a-f]{6}$/i.test(draftHex.trim()) && onCommit(`#${draftHex.trim().replace(/^#/, "").toLowerCase()}`)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              spellCheck={false}
              className="h-7 w-full rounded border border-[#E5E7EB] px-2 font-mono text-xs uppercase"
              aria-label="Colour code"
            />
          </div>
        </ToolbarPanel>
      )}
    </>
  );
}

function SpacingPopover({ letterSpacing = 0, lineHeight = 1.2, onCommit, onLive }) {
  const { open, setOpen, rect, toggle } = useToolbarPanel();

  return (
    <>
      <button
        type="button"
        title="Spacing"
        aria-expanded={open}
        onClick={toggle}
        className={`h-8 px-2 flex items-center gap-1 rounded-[6px] border text-xs font-medium transition-colors ${
          open
            ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
            : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
        }`}
      >
        <span>Spacing</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <ToolbarPanel
          anchorRect={rect}
          label="Text spacing"
          width={256}
          className="space-y-3"
          onClose={() => setOpen(false)}
        >
          <div>
            <div className="flex justify-between text-xs text-[#4B5563] mb-1">
              <span>Letter spacing</span>
              <span className="font-mono">{letterSpacing.toFixed(1)} px</span>
            </div>
            <input
              type="range"
              min={-2}
              max={10}
              step={0.5}
              value={letterSpacing}
              onChange={(e) => {
                const val = Number(e.target.value);
                onLive?.({ letterSpacing: val });
                onCommit({ letterSpacing: val });
              }}
              className="w-full accent-[#2563EB]"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#4B5563] mb-1">
              <span>Line height</span>
              <span className="font-mono">{lineHeight.toFixed(2)}</span>
            </div>
            <input
              type="range"
              min={0.8}
              max={2.5}
              step={0.05}
              value={lineHeight}
              onChange={(e) => {
                const val = Number(e.target.value);
                onLive?.({ lineHeight: val });
                onCommit({ lineHeight: val });
              }}
              className="w-full accent-[#2563EB]"
            />
          </div>
        </ToolbarPanel>
      )}
    </>
  );
}

function PositionPopover({
  item,
  items: _items,
  selectedIds,
  area,
  onRect,
  onRotation,
  onAlign,
  onDistribute,
  onMatchSize,
  onGroup: _onGroup,
  onUngroup,
}) {
  const { open, setOpen, rect, toggle } = useToolbarPanel();

  const isMulti = selectedIds && selectedIds.length > 1;
  if (!item && !isMulti) return null;

  const alignTo = (pos) => {
    if (isMulti) {
      onAlign?.(pos);
    } else if (item) {
      const rect = { x: item.x, y: item.y, w: item.w, h: item.h };
      if (pos === "left") rect.x = area.x;
      if (pos === "center") rect.x = area.x + Math.round((area.w - item.w) / 2);
      if (pos === "right") rect.x = area.x + area.w - item.w;
      if (pos === "top") rect.y = area.y;
      if (pos === "middle") rect.y = area.y + Math.round((area.h - item.h) / 2);
      if (pos === "bottom") rect.y = area.y + area.h - item.h;
      onRect?.(item.id, rect);
    }
  };

  return (
    <>
      <button
        type="button"
        title="Position and sizing"
        aria-expanded={open}
        onClick={toggle}
        className={`h-8 px-2 flex items-center gap-1 rounded-[6px] border text-xs font-medium transition-colors ${
          open
            ? "border-[#2563EB] bg-[#EFF6FF] text-[#2563EB]"
            : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB]"
        }`}
      >
        <span>Position</span>
        <ChevronDown className="h-3 w-3" />
      </button>

      {open && (
        <ToolbarPanel
          anchorRect={rect}
          label="Item position"
          width={256}
          className="space-y-3"
          onClose={() => setOpen(false)}
        >
          {!isMulti && item ? (
            <>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-[10px] text-[#6B7280] font-semibold uppercase">X</label>
                  <input
                    type="number"
                    value={Math.round(item.x)}
                    onChange={(e) => onRect(item.id, { x: Number(e.target.value) })}
                    className="mt-0.5 h-7 w-full rounded border border-[#E5E7EB] px-2 font-mono tabular-nums text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#6B7280] font-semibold uppercase">Y</label>
                  <input
                    type="number"
                    value={Math.round(item.y)}
                    onChange={(e) => onRect(item.id, { y: Number(e.target.value) })}
                    className="mt-0.5 h-7 w-full rounded border border-[#E5E7EB] px-2 font-mono tabular-nums text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#6B7280] font-semibold uppercase">Width</label>
                  <input
                    type="number"
                    value={Math.round(item.w)}
                    onChange={(e) => onRect(item.id, { w: Number(e.target.value) })}
                    className="mt-0.5 h-7 w-full rounded border border-[#E5E7EB] px-2 font-mono tabular-nums text-xs"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#6B7280] font-semibold uppercase">Height</label>
                  <input
                    type="number"
                    value={Math.round(item.h)}
                    onChange={(e) => onRect(item.id, { h: Number(e.target.value) })}
                    className="mt-0.5 h-7 w-full rounded border border-[#E5E7EB] px-2 font-mono tabular-nums text-xs"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-[#6B7280] font-semibold uppercase">Rotation</label>
                  <div className="relative mt-0.5 flex items-center">
                    <input
                      type="number"
                      min="-180"
                      max="180"
                      value={Math.round(item.rotation || 0)}
                      onChange={(e) => onRotation?.(item.id, Number(e.target.value))}
                      className="h-7 w-full rounded border border-[#E5E7EB] px-2 font-mono tabular-nums text-xs pr-6"
                    />
                    <span className="absolute right-2 text-xs text-[#9CA3AF]">°</span>
                  </div>
                </div>
              </div>

              {item.groupId ? (
                <div className="pt-2 border-t border-[#E5E7EB] flex items-center justify-between">
                  <span className="text-[11px] text-[#6B7280]">Grouped</span>
                  <button
                    type="button"
                    onClick={onUngroup}
                    className="h-6 px-2 rounded border border-[#E5E7EB] text-[11px] text-red-600 hover:bg-red-50"
                  >
                    Ungroup
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <div className="text-xs text-[#6B7280] pb-1">
              <span className="font-semibold text-[#111827]">{selectedIds?.length || 0} items</span> selected
            </div>
          )}

          <div className="pt-2 border-t border-[#E5E7EB]">
            <span className="block text-[10px] text-[#6B7280] font-semibold uppercase mb-1.5">
              {isMulti ? "Align to selection" : "Align to section"}
            </span>
            <div className="grid grid-cols-3 gap-1">
              <button
                type="button"
                onClick={() => alignTo("left")}
                className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
              >
                Left
              </button>
              <button
                type="button"
                onClick={() => alignTo("center")}
                className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
              >
                Center
              </button>
              <button
                type="button"
                onClick={() => alignTo("right")}
                className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
              >
                Right
              </button>
              <button
                type="button"
                onClick={() => alignTo("top")}
                className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
              >
                Top
              </button>
              <button
                type="button"
                onClick={() => alignTo("middle")}
                className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
              >
                Middle
              </button>
              <button
                type="button"
                onClick={() => alignTo("bottom")}
                className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
              >
                Bottom
              </button>
            </div>
          </div>

          {isMulti && (
            <>
              {selectedIds?.length >= 3 && (
                <div className="pt-2 border-t border-[#E5E7EB]">
                  <span className="block text-[10px] text-[#6B7280] font-semibold uppercase mb-1.5">
                    Distribute
                  </span>
                  <div className="grid grid-cols-2 gap-1">
                    <button
                      type="button"
                      onClick={() => onDistribute?.("horizontal")}
                      className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
                    >
                      Horizontally
                    </button>
                    <button
                      type="button"
                      onClick={() => onDistribute?.("vertical")}
                      className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
                    >
                      Vertically
                    </button>
                  </div>
                </div>
              )}

              <div className="pt-2 border-t border-[#E5E7EB]">
                <span className="block text-[10px] text-[#6B7280] font-semibold uppercase mb-1.5">
                  Match size
                </span>
                <div className="grid grid-cols-3 gap-1">
                  <button
                    type="button"
                    onClick={() => onMatchSize?.("width")}
                    className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
                  >
                    Width
                  </button>
                  <button
                    type="button"
                    onClick={() => onMatchSize?.("height")}
                    className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
                  >
                    Height
                  </button>
                  <button
                    type="button"
                    onClick={() => onMatchSize?.("both")}
                    className="h-6 rounded border border-[#E5E7EB] text-[11px] hover:bg-[#F9FAFB]"
                  >
                    Both
                  </button>
                </div>
              </div>
            </>
          )}
        </ToolbarPanel>
      )}
    </>
  );
}

/**
 * The A button. The bar under it is the colour the words are painted in; a dashed empty bar
 * means the selected pieces do not all share one colour.
 */
function TextColorButton({ value, brandKit, onCommit, onLive, mixed = false }) {
  const { open, setOpen, rect, toggle } = useToolbarPanel();
  const resolvedHex = toHex(resolveColorToken(value, brandKit), "#0f172a");
  const [draftHex, setDraftHex] = useState(resolvedHex);
  const draggedHex = useRef(null);
  useEffect(() => setDraftHex(resolvedHex), [resolvedHex]);

  const commitHex = (raw) => {
    const clean = String(raw || "").trim().replace(/^#/, "");
    if (/^[0-9a-f]{6}$/i.test(clean)) onCommit(`#${clean.toLowerCase()}`);
  };

  return (
    <>
      <button
        type="button"
        title={mixed ? "Text colour (mixed)" : "Text colour"}
        aria-label="Text colour"
        aria-expanded={open}
        onClick={toggle}
        className="flex flex-col items-center justify-center h-8 w-7 rounded-[4px] text-xs font-bold text-[#111827] hover:bg-[#F3F4F6] transition-colors"
      >
        <span className="leading-none text-[13px]">A</span>
        <span
          className={`h-1 w-4 rounded-xs mt-0.5 ${mixed ? "border border-dashed border-[#9CA3AF]" : ""}`}
          style={mixed ? undefined : { backgroundColor: resolvedHex }}
        />
      </button>

      {open && (
        <ToolbarPanel
          anchorRect={rect}
          label="Text colour picker"
          width={248}
          className="space-y-2"
          onClose={() => setOpen(false)}
        >
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
            Brand colours
          </span>
          <div className="flex flex-wrap gap-1.5">
            {BRAND_SWATCHES.map((swatch) => {
              const hex = toHex(resolveColorToken(swatch.token, brandKit), "#000");
              const active = !mixed && value === swatch.token;
              return (
                <button
                  key={swatch.token}
                  type="button"
                  title={swatch.label}
                  onClick={() => {
                    onCommit(swatch.token);
                    setOpen(false);
                  }}
                  className={`h-7 w-7 rounded-full border border-slate-300 transition-transform hover:scale-110 flex items-center justify-center ${
                    active ? "ring-2 ring-[#2563EB] ring-offset-1" : ""
                  }`}
                  style={{ backgroundColor: hex }}
                >
                  {active && <Check className="h-3 w-3 text-white drop-shadow-xs" />}
                </button>
              );
            })}
          </div>
          <div className="pt-2 border-t border-[#E5E7EB] space-y-1.5">
            <span className="block text-[10px] font-semibold uppercase tracking-wide text-[#6B7280]">
              Any other colour
            </span>
            <HexColorPicker
              color={resolvedHex}
              /* Dragging shows the colour at once and is stored once, when the pointer lets go. */
              onChange={(next) => {
                draggedHex.current = next;
                (onLive || onCommit)(next);
              }}
              onPointerUp={() => {
                if (draggedHex.current) {
                  onCommit(draggedHex.current);
                  draggedHex.current = null;
                }
              }}
              style={{ width: "100%", height: "96px" }}
              aria-label="Pick any colour"
            />
            <input
              type="text"
              value={draftHex}
              onChange={(e) => setDraftHex(e.target.value)}
              onBlur={() => commitHex(draftHex)}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
              spellCheck={false}
              className="h-7 w-full rounded border border-[#E5E7EB] px-2 font-mono text-xs uppercase"
              aria-label="Colour code"
            />
          </div>
        </ToolbarPanel>
      )}
    </>
  );
}

function AlignDropdown({ align = "left", mixed = false, onAlign }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1 h-8 px-2 rounded-[4px] text-xs font-medium text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827] transition-colors"
        >
          {mixed ? (
            <AlignLeft className="h-3.5 w-3.5 text-[#9CA3AF]" />
          ) : align === "center" ? (
            <AlignCenter className="h-3.5 w-3.5" />
          ) : align === "right" ? (
            <AlignRight className="h-3.5 w-3.5" />
          ) : (
            <AlignLeft className="h-3.5 w-3.5" />
          )}
          <span>Align</span>
        </button>
      </DropdownMenuTrigger>
      <ToolbarMenuContent align="center" className="w-32 text-xs">
        {[
          { key: "left", Icon: AlignLeft, label: "Left" },
          { key: "center", Icon: AlignCenter, label: "Center" },
          { key: "right", Icon: AlignRight, label: "Right" },
        ].map((option) => (
          <DropdownMenuItem
            key={option.key}
            onClick={() => onAlign?.(option.key)}
            className={!mixed && align === option.key ? "font-semibold text-[#2563EB]" : ""}
          >
            <option.Icon className="mr-2 h-3.5 w-3.5" /> {option.label}
          </DropdownMenuItem>
        ))}
      </ToolbarMenuContent>
    </DropdownMenu>
  );
}

function EffectsPopover({ effect = "none", mixed = false, onEffect }) {
  const currentEffect = mixed ? "none" : effect || "none";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`h-8 px-2 rounded-[4px] text-xs font-medium transition-colors ${
            !mixed && currentEffect !== "none"
              ? "bg-[#EFF6FF] text-[#2563EB]"
              : "text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]"
          }`}
        >
          Effects
        </button>
      </DropdownMenuTrigger>
      <ToolbarMenuContent align="center" className="w-36 text-xs">
        {[
          { key: "none", label: "None" },
          { key: "shadow", label: "Shadow" },
          { key: "lift", label: "Lift" },
          { key: "outline", label: "Outline" },
        ].map((eff) => (
          <DropdownMenuItem
            key={eff.key}
            onClick={() => onEffect?.(eff.key)}
            className={!mixed && currentEffect === eff.key ? "font-semibold text-[#2563EB]" : ""}
          >
            {eff.label}
          </DropdownMenuItem>
        ))}
      </ToolbarMenuContent>
    </DropdownMenu>
  );
}

function CropPopover({ style, onCommit }) {
  const crop = style?.crop || {};
  const zoom = Math.min(3, Math.max(1, Number(crop.zoom) || 1));
  const panX = Math.min(50, Math.max(-50, Number(crop.x) || 0));
  const panY = Math.min(50, Math.max(-50, Number(crop.y) || 0));

  const hasCrop = zoom > 1 || panX !== 0 || panY !== 0;

  const update = (patch) => {
    onCommit({
      crop: {
        zoom: patch.zoom !== undefined ? patch.zoom : zoom,
        x: patch.x !== undefined ? patch.x : panX,
        y: patch.y !== undefined ? patch.y : panY,
      },
    });
  };

  const reset = () => {
    onCommit({
      crop: { zoom: 1, x: 0, y: 0 },
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Crop and zoom photo inside mask"
          className={`h-8 px-2 flex items-center gap-1 rounded-[6px] border text-xs font-medium transition-colors ${
            hasCrop
              ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
              : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
          }`}
        >
          <Crop className="h-3.5 w-3.5 text-[#6B7280]" />
          <span>Crop</span>
        </button>
      </DropdownMenuTrigger>
      <ToolbarMenuContent align="center" className="w-56 p-3 text-xs space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-[#111827]">Crop & Pan</span>
          {hasCrop && (
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        {/* Zoom */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#4B5563] mb-1">
            <span>Zoom</span>
            <span className="font-mono">{Math.round(zoom * 100)}%</span>
          </div>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => update({ zoom: Number(e.target.value) })}
            className="w-full accent-[#2563EB]"
          />
        </div>

        {/* Pan X */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#4B5563] mb-1">
            <span>Pan Horizontal</span>
            <span className="font-mono">{panX > 0 ? `+${panX}%` : `${panX}%`}</span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={panX}
            onChange={(e) => update({ x: Number(e.target.value) })}
            className="w-full accent-[#2563EB]"
          />
        </div>

        {/* Pan Y */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#4B5563] mb-1">
            <span>Pan Vertical</span>
            <span className="font-mono">{panY > 0 ? `+${panY}%` : `${panY}%`}</span>
          </div>
          <input
            type="range"
            min={-50}
            max={50}
            step={1}
            value={panY}
            onChange={(e) => update({ y: Number(e.target.value) })}
            className="w-full accent-[#2563EB]"
          />
        </div>
      </ToolbarMenuContent>
    </DropdownMenu>
  );
}

function ImageFiltersPopover({ style, onCommit }) {
  const brightness = typeof style?.brightness === "number" ? style.brightness : 100;
  const contrast = typeof style?.contrast === "number" ? style.contrast : 100;
  const grayscale = Boolean(style?.grayscale);

  const hasFilters = brightness !== 100 || contrast !== 100 || grayscale;

  const reset = () => {
    onCommit({ brightness: 100, contrast: 100, grayscale: false });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Photo color and filter adjustments"
          className={`h-8 px-2 flex items-center gap-1 rounded-[6px] border text-xs font-medium transition-colors ${
            hasFilters
              ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
              : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
          }`}
        >
          <Sliders className="h-3.5 w-3.5 text-[#6B7280]" />
          <span>Filters</span>
        </button>
      </DropdownMenuTrigger>
      <ToolbarMenuContent align="center" className="w-56 p-3 text-xs space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-[#111827]">Photo Filters</span>
          {hasFilters && (
            <button
              type="button"
              onClick={reset}
              className="text-[11px] text-blue-600 hover:underline"
            >
              Reset
            </button>
          )}
        </div>

        {/* Brightness */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#4B5563] mb-1">
            <span>Brightness</span>
            <span className="font-mono">{brightness}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={150}
            step={1}
            value={brightness}
            onChange={(e) => onCommit({ brightness: Number(e.target.value) })}
            className="w-full accent-[#2563EB]"
          />
        </div>

        {/* Contrast */}
        <div>
          <div className="flex items-center justify-between text-[11px] text-[#4B5563] mb-1">
            <span>Contrast</span>
            <span className="font-mono">{contrast}%</span>
          </div>
          <input
            type="range"
            min={50}
            max={150}
            step={1}
            value={contrast}
            onChange={(e) => onCommit({ contrast: Number(e.target.value) })}
            className="w-full accent-[#2563EB]"
          />
        </div>

        {/* Grayscale */}
        <label className="flex items-center justify-between text-[11px] text-[#374151] cursor-pointer pt-1 border-t border-[#F3F4F6]">
          <span>Black & White</span>
          <input
            type="checkbox"
            checked={grayscale}
            onChange={(e) => onCommit({ grayscale: e.target.checked })}
            className="h-4 w-4 rounded border-[#D1D5DB] text-[#2563EB] focus:ring-blue-500"
          />
        </label>
      </ToolbarMenuContent>
    </DropdownMenu>
  );
}

function TextModePopover({ item, items, onChangeMode, onChangeMeta }) {
  const isAi = Boolean(item?.variable);
  const aiTextsCount = (items || []).filter((it) => it.kind === "text" && it.variable).length;
  const maxTexts = VARIABLE_LIMITS.maxText;
  const canMakeVariable = aiTextsCount < maxTexts || isAi;

  const [label, setLabel] = useState(item?.label || "");
  const [hint, setHint] = useState(item?.hint || "");
  const [sample, setSample] = useState(item?.sample || "");
  const [maxLength, setMaxLength] = useState(item?.maxLength || 80);

  useEffect(() => {
    setLabel(item?.label || "");
    setHint(item?.hint || "");
    setSample(item?.sample || "");
    setMaxLength(item?.maxLength || 80);
  }, [item?.id, item?.label, item?.hint, item?.sample, item?.maxLength]);

  const handleCommitMeta = (patch) => {
    onChangeMeta?.(item.id, patch);
  };

  const suggestions = useMemo(() => labelSuggestions(label), [label]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Field fill-in settings"
          className={`h-8 w-full min-w-0 px-2.5 flex items-center gap-1.5 rounded-[6px] border text-xs font-medium transition-colors ${
            isAi
              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
              : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
          }`}
        >
          {isAi ? (
            <>
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-blue-600" />
              <span className="min-w-0 truncate" title={item.label || "Text"}>
                Fill-in: {item.label || "Text"}
              </span>
            </>
          ) : (
            <>
              <Type className="h-3.5 w-3.5 shrink-0 text-gray-500" />
              <span>Fixed text</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <ToolbarMenuContent align="start" className="w-80 p-3 text-xs space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-[#111827]">Who writes this?</span>
          <span className="text-[11px] font-mono text-[#6B7280]">
            {aiTextsCount} of {maxTexts} blanks
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1 rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-1">
          <button
            type="button"
            onClick={() => onChangeMode?.(item.id, "locked")}
            className={`py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
              !isAi ? "bg-white text-[#111827] shadow-sm font-semibold" : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            Fixed in template
          </button>
          <button
            type="button"
            disabled={!canMakeVariable && !isAi}
            onClick={() => {
              if (!canMakeVariable && !isAi) return;
              onChangeMode?.(item.id, "ai");
            }}
            className={`py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
              isAi ? "bg-white text-blue-700 shadow-sm font-semibold" : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            AI fills it in
          </button>
        </div>

        {isAi ? (
          <div className="space-y-2.5 pt-1 border-t border-[#F3F4F6]">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-[#4B5563]">
                  Field label (required)
                </label>
                <span className="text-[10px] text-[#9CA3AF]">{label.length}/30</span>
              </div>
              <input
                type="text"
                maxLength={30}
                value={label}
                placeholder="e.g. Chief guest"
                onChange={(e) => {
                  setLabel(e.target.value);
                  handleCommitMeta({ label: e.target.value });
                }}
                className="w-full h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#2563EB]"
              />
              {isGenericLabel(label) && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Generic label will be skipped by AI. Give it a specific label.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-[#4B5563]">
                  What should go here? (hint)
                </label>
                <span className="text-[10px] text-[#9CA3AF]">{hint.length}/80</span>
              </div>
              <input
                type="text"
                maxLength={80}
                value={hint}
                placeholder="What should go here?"
                onChange={(e) => {
                  setHint(e.target.value);
                  handleCommitMeta({ hint: e.target.value });
                }}
                className="w-full h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#2563EB]"
              />
              {suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {suggestions.map((sug) => (
                    <button
                      key={sug}
                      type="button"
                      onClick={() => {
                        setHint(sug);
                        handleCommitMeta({ hint: sug });
                      }}
                      className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[#4B5563] truncate max-w-full text-left"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-medium text-[#4B5563]">
                  Sample words (optional)
                </label>
                <span className="text-[10px] text-[#9CA3AF]">{sample.length}/80</span>
              </div>
              <input
                type="text"
                maxLength={80}
                value={sample}
                placeholder="Shown in templates & previews until filled"
                onChange={(e) => {
                  setSample(e.target.value);
                  handleCommitMeta({ sample: e.target.value });
                }}
                className="w-full h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#4B5563] block mb-1">
                Max length: {maxLength} chars
              </label>
              <input
                type="range"
                min={10}
                max={200}
                value={maxLength}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setMaxLength(val);
                  handleCommitMeta({ maxLength: val });
                }}
                className="w-full accent-[#2563EB]"
              />
            </div>
          </div>
        ) : (
          <p className="text-[11px] text-[#6B7280] leading-snug">
            This text stays fixed as part of the poster design and cannot be changed by normal users.
          </p>
        )}
      </ToolbarMenuContent>
    </DropdownMenu>
  );
}

function ImageModePopover({ item, items, onChangeMode, onChangeMeta }) {
  const isUser = Boolean(item.variable);
  const userImagesCount = (items || []).filter(
    (it) => (it.kind === "image" || it.field === "photo") && it.variable
  ).length;
  const maxImages = VARIABLE_LIMITS.maxImage;
  const canMakeVariable = userImagesCount < maxImages || isUser;

  const [label, setLabel] = useState(item.label || "");
  const [hint, setHint] = useState(item.hint || "");
  const [aspectRatio, setAspectRatio] = useState(item.aspectRatio || "");
  const [sampleImage, setSampleImage] = useState(item.sampleImage || "");

  useEffect(() => {
    setLabel(item.label || "");
    setHint(item.hint || "");
    setAspectRatio(item.aspectRatio || "");
    setSampleImage(item.sampleImage || "");
  }, [item.id, item.label, item.hint, item.aspectRatio, item.sampleImage]);

  const handleModeToggle = (newMode) => {
    if (newMode === "user") {
      if (!canMakeVariable) return;
      onChangeMode?.(item.id, "user");
    } else {
      onChangeMode?.(item.id, "locked");
    }
  };

  const handleCommitMeta = (patch) => {
    onChangeMeta?.(item.id, patch);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Who changes this photo?"
          className={`h-8 px-2.5 flex items-center gap-1.5 rounded-[6px] border text-xs font-medium transition-colors ${
            isUser
              ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 font-semibold"
              : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
          }`}
        >
          {isUser ? (
            <>
              <Sparkles className="h-3.5 w-3.5 text-blue-600" />
              <span>Users replace it ({userImagesCount} of {maxImages})</span>
            </>
          ) : (
            <>
              <Lock className="h-3.5 w-3.5 text-gray-500" />
              <span>Locked</span>
            </>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" />
        </button>
      </DropdownMenuTrigger>
      <ToolbarMenuContent align="start" className="w-72 p-3 text-xs space-y-3" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs text-[#111827]">Who changes this?</span>
          <span className="text-[11px] font-mono text-[#6B7280]">
            {userImagesCount} of {maxImages} photos
          </span>
        </div>

        {/* Mode Segmented Buttons */}
        <div className="grid grid-cols-2 gap-1 rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-1">
          <button
            type="button"
            onClick={() => handleModeToggle("locked")}
            className={`py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
              !isUser ? "bg-white text-[#111827] shadow-sm font-semibold" : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            Locked
          </button>
          <button
            type="button"
            disabled={!canMakeVariable && !isUser}
            onClick={() => handleModeToggle("user")}
            title={!canMakeVariable && !isUser ? `Maximum ${maxImages} photo spaces reached` : undefined}
            className={`py-1.5 rounded-[4px] text-xs font-medium transition-colors ${
              isUser
                ? "bg-white text-blue-700 shadow-sm font-semibold"
                : !canMakeVariable
                ? "opacity-40 cursor-not-allowed text-[#9CA3AF]"
                : "text-[#6B7280] hover:text-[#111827]"
            }`}
          >
            Users replace it
          </button>
        </div>

        {isUser ? (
          <div className="space-y-2.5 pt-1 border-t border-[#F3F4F6]">
            <div>
              <label className="text-[11px] font-medium text-[#4B5563] block mb-1">
                Space label <span className="text-[#9CA3AF]">({label.length}/30)</span>
              </label>
              <input
                type="text"
                maxLength={30}
                value={label}
                placeholder="e.g. Speaker photo"
                onChange={(e) => {
                  setLabel(e.target.value);
                  handleCommitMeta({ label: e.target.value });
                }}
                className="w-full h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#2563EB]"
              />
              {isGenericLabel(label) && (
                <p className="text-[11px] text-amber-600 mt-1">
                  Generic label. Give it a specific label.
                </p>
              )}
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#4B5563] block mb-1">
                Help text for users <span className="text-[#9CA3AF]">({hint.length}/80)</span>
              </label>
              <input
                type="text"
                maxLength={80}
                value={hint}
                placeholder="e.g. Upload a clear headshot"
                onChange={(e) => {
                  setHint(e.target.value);
                  handleCommitMeta({ hint: e.target.value });
                }}
                className="w-full h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#4B5563] block mb-1">
                Sample photo address (optional)
              </label>
              <input
                type="text"
                value={sampleImage}
                placeholder="Cloudinary URL"
                onChange={(e) => {
                  setSampleImage(e.target.value);
                  handleCommitMeta({ sampleImage: e.target.value });
                }}
                className="w-full h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#2563EB]"
              />
            </div>

            <div>
              <label className="text-[11px] font-medium text-[#4B5563] block mb-1">
                Aspect ratio / Shape
              </label>
              <select
                value={aspectRatio}
                onChange={(e) => {
                  setAspectRatio(e.target.value);
                  handleCommitMeta({ aspectRatio: e.target.value });
                }}
                className="w-full h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white text-xs text-[#111827] focus:outline-none focus:border-[#2563EB]"
              >
                <option value="">Free (any shape)</option>
                <option value="1:1">Square (1:1)</option>
                <option value="4:3">Landscape (4:3)</option>
                <option value="3:4">Portrait (3:4)</option>
                <option value="16:9">Wide (16:9)</option>
              </select>
            </div>

            {item.imageUrl ? (
              <label className="flex items-start gap-2 rounded-[6px] border border-[#E5E7EB] bg-[#F9FAFB] p-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={item.defaultImage === true}
                  onChange={(e) =>
                    handleCommitMeta({ defaultImage: e.target.checked })
                  }
                  className="mt-0.5 h-3.5 w-3.5 accent-[#2563EB]"
                />
                <span className="text-[11px] leading-snug text-[#4B5563]">
                  Use this picture as the default for every poster
                </span>
              </label>
            ) : null}

            <p className="text-[11px] text-[#6B7280] leading-snug">
              {item.defaultImage && item.imageUrl
                ? "New posters start with this picture already standing in this space. Anyone making a poster can still take it out and put their own in."
                : "This picture is only an example, shown faintly here so you can see what fits the space. Anyone making a poster starts with nothing in it."}
            </p>
          </div>
        ) : (
          <p className="text-[11px] text-[#6B7280] leading-snug">
            This photo stays fixed as part of the poster design and cannot be changed by normal users.
          </p>
        )}
      </ToolbarMenuContent>
    </DropdownMenu>
  );
}

function ImageToolbarSection({
  selectedItem,
  items,
  style,
  set,
  onStyle,
  onReplaceImage,
  onChangeMode,
  onChangeMeta,
}) {
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLowRes, setIsLowRes] = useState(false);

  useEffect(() => {
    if (!selectedItem?.imageUrl || !selectedItem?.w || !selectedItem?.h) {
      setIsLowRes(false);
      return;
    }
    const img = new Image();
    img.src = selectedItem.imageUrl;
    img.onload = () => {
      if (img.naturalWidth < selectedItem.w * 0.8 || img.naturalHeight < selectedItem.h * 0.8) {
        setIsLowRes(true);
      } else {
        setIsLowRes(false);
      }
    };
    img.onerror = () => setIsLowRes(false);
  }, [selectedItem?.imageUrl, selectedItem?.w, selectedItem?.h]);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setIsUploading(true);
    try {
      const asset = await directUploadAsset(file);
      if (asset?.url) {
        if (onReplaceImage) {
          onReplaceImage(selectedItem.id, asset.url);
        } else {
          onStyle?.(selectedItem.id, { imageUrl: asset.url });
        }
      }
    } catch (err) {
      alert(err.message || "Could not upload photo");
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileSelect}
      />

      {/* "Who changes this?" Mode Popover */}
      <ImageModePopover
        item={selectedItem}
        items={items}
        onChangeMode={onChangeMode}
        onChangeMeta={onChangeMeta}
      />

      {/* Replace Button */}
      <button
        type="button"
        disabled={isUploading}
        title="Choose a new photo from your computer"
        onClick={() => fileInputRef.current?.click()}
        className="h-8 px-2.5 flex items-center gap-1.5 rounded-[6px] border border-[#E5E7EB] bg-white text-xs font-medium text-[#111827] hover:bg-[#F9FAFB] transition-colors"
      >
        {isUploading ? (
          <span className="flex items-center gap-1 text-blue-600">
            <Upload className="h-3.5 w-3.5 animate-bounce" /> Uploading...
          </span>
        ) : (
          <>
            <Upload className="h-3.5 w-3.5 text-[#6B7280]" />
            <span>Replace</span>
          </>
        )}
      </button>

      {/* Fill or Fit */}
      <div className="flex items-center rounded-[6px] border border-[#E5E7EB] bg-white p-0.5">
        {IMAGE_FITS.map((fit) => {
          const active = (style.fit || "cover") === fit;
          return (
            <button
              key={fit}
              type="button"
              onClick={() => set({ fit })}
              className={`px-2 py-1 rounded-[4px] text-xs font-medium capitalize transition-colors ${
                active ? "bg-[#EFF6FF] text-[#2563EB] font-semibold" : "text-[#6B7280] hover:bg-[#F3F4F6]"
              }`}
            >
              {fit === "cover" ? "Fill" : "Fit"}
            </button>
          );
        })}
      </div>

      {/* Mask Preset */}
      <select
        value={selectedItem.mask || style.mask || "none"}
        onChange={(e) => onStyle?.(selectedItem.id, { mask: e.target.value })}
        className="h-8 rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-xs text-[#111827] focus:outline-none"
        title="Image mask"
      >
        <option value="none">No mask</option>
        {IMAGE_MASKS.filter((m) => m !== "none").map((m) => (
          <option key={m} value={m}>
            Mask: {m}
          </option>
        ))}
      </select>

      {/* Crop Popover (Pan & Zoom) */}
      <CropPopover style={style} onCommit={(patch) => set(patch)} />

      {/* Flip Horizontal */}
      <button
        type="button"
        title="Flip photo horizontally"
        onClick={() => set({ flipX: !style.flipX })}
        className={`h-8 w-8 flex items-center justify-center rounded-[6px] border transition-colors ${
          style.flipX
            ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
            : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
        }`}
      >
        <FlipHorizontal className="h-3.5 w-3.5" />
      </button>

      {/* Flip Vertical */}
      <button
        type="button"
        title="Flip photo vertically"
        onClick={() => set({ flipY: !style.flipY })}
        className={`h-8 w-8 flex items-center justify-center rounded-[6px] border transition-colors ${
          style.flipY
            ? "border-blue-200 bg-blue-50 text-blue-700 font-semibold"
            : "border-[#E5E7EB] bg-white text-[#4B5563] hover:bg-[#F9FAFB] hover:text-[#111827]"
        }`}
      >
        <FlipVertical className="h-3.5 w-3.5" />
      </button>

      {/* Corner Radius */}
      {(selectedItem.mask === "none" || selectedItem.mask === "rounded" || !selectedItem.mask) && (
        <div className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
          <span className="text-[11px] text-[#6B7280]">Radius</span>
          <input
            type="range"
            min={0}
            max={64}
            step={2}
            value={Number(style.radius) || 0}
            onChange={(e) => set({ radius: Number(e.target.value) })}
            className="w-16 accent-[#2563EB]"
          />
          <span className="text-xs font-mono tabular-nums w-5 text-right">
            {Math.round(Number(style.radius) || 0)}
          </span>
        </div>
      )}

      {/* Opacity */}
      <div className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
        <span className="text-[11px] text-[#6B7280]">Opacity</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={style.opacity !== undefined ? Number(style.opacity) : 1}
          onChange={(e) => set({ opacity: Number(e.target.value) })}
          className="w-16 accent-[#2563EB]"
        />
        <span className="text-xs font-mono tabular-nums w-8 text-right">
          {Math.round((style.opacity !== undefined ? Number(style.opacity) : 1) * 100)}%
        </span>
      </div>

      {/* Filters Popover */}
      <ImageFiltersPopover style={style} onCommit={(patch) => set(patch)} />

      {/* Low-Resolution Warning Chip */}
      {isLowRes && (
        <div
          className="flex items-center gap-1 h-8 px-2 rounded-[6px] border border-amber-200 bg-amber-50 text-amber-800 text-[11px] font-medium"
          title="This photo is small and may appear blurry when printed."
        >
          <AlertTriangle className="h-3 w-3 text-amber-600 shrink-0" />
          <span>May look blurry</span>
        </div>
      )}
    </>
  );
}

/** Front and back. Works on one thing or on a whole selection. */
function OrderMenu({ ids, onReorder }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          title="Front and back"
          className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]"
        >
          <Layers className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <ToolbarMenuContent align="end">
        <DropdownMenuItem onClick={() => onReorder?.(ids, 1)}>
          <ArrowUp className="mr-2 h-3.5 w-3.5" /> Bring forward
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReorder?.(ids, -1)}>
          <ArrowDown className="mr-2 h-3.5 w-3.5" /> Send backward
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReorder?.(ids, "front")}>
          <ArrowUp className="mr-2 h-3.5 w-3.5 text-blue-600" /> Bring to front
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onReorder?.(ids, "back")}>
          <ArrowDown className="mr-2 h-3.5 w-3.5 text-blue-600" /> Send to back
        </DropdownMenuItem>
      </ToolbarMenuContent>
    </DropdownMenu>
  );
}

/**
 * The unlock button. A locked piece of the design cannot be moved or typed in, so the button says
 * which way it is going, and the title says why it was fixed in the first place.
 */
function KeepStillButton({ ids, locked, disabled, title, onToggleLock }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={() => onToggleLock?.(ids)}
      className={`h-8 px-2 flex items-center gap-1 rounded-[6px] border text-xs font-medium transition-colors ${
        locked
          ? "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
          : "border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]"
      } ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}
    >
      {locked ? <Lock className="h-3.5 w-3.5" /> : <LockOpen className="h-3.5 w-3.5" />}
      <span>{locked ? "Unlock" : "Keep still"}</span>
    </button>
  );
}

function CopyButton({ ids, onDuplicate }) {
  return (
    <button
      type="button"
      title="Make another copy of this"
      onClick={() => onDuplicate?.(ids)}
      className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-[#E5E7EB] bg-white text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]"
    >
      <Copy className="h-3.5 w-3.5" />
    </button>
  );
}

function RemoveButton({ ids, onDelete, disabled, title }) {
  return (
    <button
      type="button"
      title={title || "Remove this"}
      disabled={disabled}
      onClick={() => onDelete?.(ids)}
      className="h-8 w-8 flex items-center justify-center rounded-[6px] border border-[#E5E7EB] bg-white text-[#DC2626] hover:bg-red-50 disabled:opacity-40 disabled:hover:bg-white"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}

/** Shown when the selected pieces do not all agree, so a field stays blank instead of lying. */
const MIXED = "__mixed__";

function sharedOf(items, read) {
  if (!items || items.length === 0) return undefined;
  const first = read(items[0]);
  return items.every((item) => read(item) === first) ? first : MIXED;
}

function sharedFlag(items, test) {
  const on = items.filter(test).length;
  if (on === items.length) return true;
  return on === 0 ? false : MIXED;
}

/**
 * The words tools, built for whatever is selected: one box or six.
 *
 * Every control reads the value all the selected pieces share, and writes to all of them, so
 * selecting three lines of words and pressing B makes all three bold in one go.
 */
function textToolGroups({ items, onSet, onLive, brandKit, surfaceBg }) {
  const styleOf = (item) => item?.style || {};
  const any = (flag) => flag === true || flag === MIXED;
  const bold = sharedFlag(items, (item) => Number(styleOf(item).weight) || (styleOf(item).bold ? 700 : 500) >= 700);
  const italic = sharedFlag(items, (item) => Boolean(styleOf(item).italic));
  const underline = sharedFlag(items, (item) => styleOf(item).textDecoration === "underline" || Boolean(styleOf(item).underline));
  const strike = sharedFlag(items, (item) => styleOf(item).textDecoration === "line-through");
  const uppercase = sharedFlag(items, (item) => styleOf(item).textTransform === "uppercase" || Boolean(styleOf(item).uppercase));
  const fontFamily = sharedOf(items, (item) => styleOf(item).fontFamily || "brand:body");
  const align = sharedOf(items, (item) => styleOf(item).align || "left");
  const color = sharedOf(items, (item) => styleOf(item).color || "brand:text");
  const weight = sharedOf(items, (item) => Number(styleOf(item).weight) || (styleOf(item).bold ? 700 : 500));
  const size = sharedOf(items, (item) => Math.round(Number(styleOf(item).size ?? styleOf(item).fontSize) || 0));
  const effect = sharedOf(items, (item) => styleOf(item).effect || "none");
  const letterSpacing = sharedOf(items, (item) => Number(styleOf(item).letterSpacing) || 0);
  const lineHeight = sharedOf(items, (item) => Number(styleOf(item).lineHeight) || 1.2);
  const opacity = sharedOf(items, (item) =>
    styleOf(item).opacity === undefined ? 1 : Number(styleOf(item).opacity),
  );

  const mixedTint = "text-[#9CA3AF]";
  const toggle = (flag, patch) => onSet(typeof flag === "boolean" ? patch(!flag) : patch(true));
  const activeClass = (flag) =>
    flag === true
      ? "bg-[#EFF6FF] text-[#2563EB]"
      : flag === MIXED
        ? "bg-[#F3F4F6] text-[#4B5563]"
        : "text-[#4B5563] hover:bg-[#F3F4F6] hover:text-[#111827]";

  const fontGroup = {
    key: "font",
    label: "Font",
    node: (
      <select
        aria-label="Font family"
        value={fontFamily === MIXED ? "" : fontFamily}
        onChange={(e) => onSet({ fontFamily: e.target.value })}
        className={`h-8 max-w-[150px] rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-xs font-medium focus:border-[#2563EB] focus:outline-none ${
          fontFamily === MIXED ? mixedTint : "text-[#111827]"
        }`}
      >
        <option value="" disabled hidden>
          Mixed
        </option>
        <optgroup label="Brand fonts">
          <option value="brand:heading">
            Brand heading ({brandKit?.fonts?.heading || "Cinzel"})
          </option>
          <option value="brand:body">
            Brand body ({brandKit?.fonts?.body || "Inter"})
          </option>
        </optgroup>
        <optgroup label="Other fonts">
          {ELEMENT_FONTS.filter((f) => f !== "brand:heading" && f !== "brand:body").map((font) => (
            <option key={font} value={font}>
              {font}
            </option>
          ))}
        </optgroup>
      </select>
    ),
  };

  const sizeGroup = {
    key: "size",
    label: "Size",
    node: (
      <div className="flex items-center rounded-[6px] border border-[#E5E7EB] bg-white h-8 px-1">
        <button
          type="button"
          title="Smaller words"
          onClick={() =>
            onSet({
              size: Math.max(
                ELEMENT_LIMITS.fontSize.min,
                (size === MIXED ? 24 : size || 24) - 2,
              ),
            })
          }
          className="px-1 text-xs font-bold text-[#6B7280] hover:text-[#111827]"
        >
          −
        </button>
        <input
          type="number"
          aria-label="Words size"
          value={size === MIXED ? "" : size || ""}
          placeholder="—"
          onChange={(e) => onSet({ size: Number(e.target.value) })}
          className="w-9 bg-transparent text-center font-mono text-xs tabular-nums text-[#111827] border-none focus:outline-none"
        />
        <button
          type="button"
          title="Bigger words"
          onClick={() =>
            onSet({
              size: Math.min(ELEMENT_LIMITS.fontSize.max, (size === MIXED ? 24 : size || 24) + 2),
            })
          }
          className="px-1 text-xs font-bold text-[#6B7280] hover:text-[#111827]"
        >
          +
        </button>
      </div>
    ),
  };

  const colorGroup = {
    key: "color",
    label: "Words colour",
    node: (
      <TextColorButton
        value={color === MIXED ? "brand:text" : color}
        mixed={color === MIXED}
        brandKit={brandKit}
        surfaceBg={surfaceBg}
        onCommit={(next) => onSet({ color: next })}
        onLive={(next) => onLive?.({ color: next })}
      />
    ),
  };

  const lookGroup = {
    key: "look",
    label: "Bold and italics",
    node: (
      <div className="flex items-center gap-0.5">
        <button
          type="button"
          title="Bold"
          aria-pressed={any(bold)}
          onClick={() => toggle(bold, (on) => ({ weight: on ? 700 : 400 }))}
          className={`h-8 w-7 flex items-center justify-center rounded-[4px] text-xs font-bold transition-colors ${activeClass(bold)}`}
        >
          B
        </button>
        <select
          aria-label="Font weight"
          value={weight === MIXED ? "" : weight}
          onChange={(e) => onSet({ weight: Number(e.target.value) })}
          className={`h-8 rounded-[4px] border border-[#E5E7EB] bg-white px-1 text-xs focus:outline-none ${
            weight === MIXED ? mixedTint : "text-[#111827]"
          }`}
        >
          <option value="" disabled hidden>
            Mixed
          </option>
          <option value={400}>400 (Regular)</option>
          <option value={500}>500 (Medium)</option>
          <option value={600}>600 (SemiBold)</option>
          <option value={700}>700 (Bold)</option>
          <option value={800}>800 (ExtraBold)</option>
        </select>
        <button
          type="button"
          title="Italic"
          aria-pressed={any(italic)}
          onClick={() => toggle(italic, (on) => ({ italic: on }))}
          className={`h-8 w-7 flex items-center justify-center rounded-[4px] text-xs font-serif italic transition-colors ${activeClass(italic)}`}
        >
          I
        </button>
        <button
          type="button"
          title="Underline"
          aria-pressed={any(underline)}
          onClick={() =>
            toggle(underline, (on) => ({
              underline: on,
              textDecoration: on ? "underline" : strike === true ? "line-through" : "none",
            }))
          }
          className={`h-8 w-7 flex items-center justify-center rounded-[4px] text-xs underline transition-colors ${activeClass(underline)}`}
        >
          U
        </button>
        <button
          type="button"
          title="Cross out"
          aria-pressed={any(strike)}
          onClick={() =>
            toggle(strike, (on) => ({
              textDecoration: on ? "line-through" : underline === true ? "underline" : "none",
            }))
          }
          className={`h-8 w-7 flex items-center justify-center rounded-[4px] text-xs line-through transition-colors ${activeClass(strike)}`}
        >
          S
        </button>
        <button
          type="button"
          title="Capitals"
          aria-pressed={any(uppercase)}
          onClick={() =>
            toggle(uppercase, (on) => ({ uppercase: on, textTransform: on ? "uppercase" : "none" }))
          }
          className={`h-8 px-1.5 flex items-center justify-center rounded-[4px] text-xs font-semibold transition-colors ${activeClass(uppercase)}`}
        >
          aA
        </button>
      </div>
    ),
  };

  const alignGroup = {
    key: "align",
    label: "Alignment",
    node: (
      <AlignDropdown
        align={align === MIXED ? "left" : align}
        mixed={align === MIXED}
        onAlign={(next) => onSet({ align: next })}
      />
    ),
  };

  const spacingGroup = {
    key: "spacing",
    label: "Spacing",
    node: (
      <SpacingPopover
        letterSpacing={letterSpacing === MIXED ? 0 : letterSpacing}
        lineHeight={lineHeight === MIXED ? 1.2 : lineHeight}
        onLive={(patch) => onLive?.(patch)}
        onCommit={(patch) => onSet(patch)}
      />
    ),
  };

  const effectGroup = {
    key: "effect",
    label: "Effects",
    node: (
      <EffectsPopover
        effect={effect === MIXED ? "none" : effect}
        mixed={effect === MIXED}
        onEffect={(next) => onSet({ effect: next })}
      />
    ),
  };

  const opacityGroup = {
    key: "opacity",
    label: "Opacity",
    node: (
      <div className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
        <span className="text-[11px] text-[#6B7280]">Opacity</span>
        <input
          type="range"
          min={0.1}
          max={1}
          step={0.05}
          value={opacity === MIXED ? 1 : opacity}
          onChange={(e) => onSet({ opacity: Number(e.target.value) })}
          className="w-16 accent-[#2563EB]"
        />
        <span className="text-xs font-mono tabular-nums w-8 text-right">
          {opacity === MIXED ? "—" : `${Math.round(opacity * 100)}%`}
        </span>
      </div>
    ),
  };

  const resolvedColor = toHex(
    isBrandColorToken(color === MIXED ? "brand:text" : color)
      ? resolveColorToken(color === MIXED ? "brand:text" : color, brandKit)
      : (color === MIXED ? "#0f172a" : color),
    "#0f172a"
  );
  const ratio = contrastRatio(resolvedColor, surfaceBg);
  const isLowContrast = ratio !== null && ratio < 4.5;

  const contrastGroup = isLowContrast
    ? {
        key: "contrast-warning",
        label: "Low contrast warning",
        node: (
          <div className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
            <span>Low contrast</span>
            <button
              type="button"
              onClick={() => {
                const fixed = pickReadableColor(["#111827", "#ffffff"], surfaceBg, 4.5) || "#111827";
                onSet({ color: fixed });
              }}
              className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 font-semibold transition-colors"
            >
              Fix low contrast
            </button>
          </div>
        ),
      }
    : null;

  return {
    primary: [fontGroup, sizeGroup, colorGroup, ...(contrastGroup ? [contrastGroup] : []), lookGroup, alignGroup],
    secondary: [spacingGroup, effectGroup, opacityGroup],
  };
}

export default function ContextualToolbar({
  selectedItem,
  items,
  selectedIds = null,
  isNormalUser = false,
  activeSection = "content",
  sections,
  brandKit,
  page,
  size: _size,
  area,
  showFullPoster: _showFullPoster,
  isContentCustom: _isContentCustom,
  onStyle,
  onStyleLive,
  onRect,
  onRotation,
  onAlign,
  onDistribute,
  onMatchSize,
  onGroup,
  onUngroup,
  onToggleLock,
  onDuplicate,
  onDelete,
  onReorder,
  onReplaceImage,
  onChangeMode,
  onChangeMeta,
  onEditCard,
  onPatchItem,
  onSwitchSection: _onSwitchSection,
  onSectionChange,
  onPageChange,
  onToggleSettings,
  isSettingsOpen: _isSettingsOpen,
  onToggleShowFullPoster: _onToggleShowFullPoster,
}) {
  const isHeader = activeSection === "header";
  const isFooter = activeSection === "footer";

  const effective = effectivePage(brandKit, { page });
  const surfaceBg =
    resolveColorToken(effective?.background?.color || "brand:background", brandKit) ||
    "#ffffff";

  /** Why a thing is fixed in place, in the words a person would use. */
  const lockTitleFor = (bandLockedForYou, isLocked) =>
    bandLockedForYou
      ? "Your organization keeps the header and footer fixed for everyone."
      : isLocked
        ? "Fixed in place. Press Unlock to move or change it."
        : "Fix this in place so nothing moves it by accident.";

  // Several things picked at once
  if (selectedIds && selectedIds.length > 1) {
    const chosen = (items || []).filter((it) => selectedIds.includes(it.id));
    const words = chosen.filter((it) => it.kind === "text");
    const allLocked = chosen.length > 0 && chosen.every((it) => it.locked);
    const inBrandBand = chosen.some((it) => it.section === "header" || it.section === "footer");
    const bandLockedForYou = isNormalUser && (inBrandBand || isHeader || isFooter);
    const hasGroup = chosen.some((it) => it.groupId);

    const text = words.length
      ? textToolGroups({
          items: words,
          onSet: (patch) => onStyle?.(selectedIds, patch),
          onLive: (patch) => onStyleLive?.(selectedIds, patch),
          brandKit,
          surfaceBg,
        })
      : null;

    const groups = [
      {
        key: "count",
        label: "Picked",
        node: (
          <span className="font-semibold px-2.5 py-1 rounded-[6px] bg-blue-50 text-blue-700 border border-blue-200">
            {selectedIds.length} picked
          </span>
        ),
      },
      ...(text ? text.primary : []),
      {
        key: "group",
        label: "Move together",
        node: (
          <button
            type="button"
            title={hasGroup ? "Move these apart again" : "Keep these together while you move them"}
            onClick={() => (hasGroup ? onUngroup?.() : onGroup?.())}
            className="h-8 px-2.5 rounded-[6px] border border-[#E5E7EB] bg-white font-medium text-[#374151] hover:bg-[#F9FAFB] transition-colors"
          >
            {hasGroup ? "Ungroup" : "Group"}
          </button>
        ),
      },
      ...(text ? text.secondary : []),
      {
        key: "position",
        label: "Position",
        node: (
          <PositionPopover
            items={chosen}
            selectedIds={selectedIds}
            area={area}
            onRect={onRect}
            onAlign={onAlign}
            onDistribute={onDistribute}
            onMatchSize={onMatchSize}
            onGroup={onGroup}
            onUngroup={onUngroup}
          />
        ),
      },
      {
        key: "order",
        label: "Front and back",
        node: <OrderMenu ids={selectedIds} onReorder={onReorder} />,
      },
      {
        key: "lock",
        label: "Keep still",
        node: (
          <KeepStillButton
            ids={selectedIds}
            locked={allLocked}
            disabled={bandLockedForYou}
            title={lockTitleFor(bandLockedForYou, allLocked)}
            onToggleLock={onToggleLock}
          />
        ),
      },
      {
        key: "copy",
        label: "Copy",
        node: <CopyButton ids={selectedIds} onDuplicate={onDuplicate} />,
      },
      {
        key: "remove",
        label: "Remove",
        node: <RemoveButton ids={selectedIds} onDelete={onDelete} title="Remove these" />,
      },
    ];

    return (
      <ToolbarRow
        groups={groups}
        signature={`${selectedIds.join(",")}|${words.length}|${hasGroup}|${allLocked}`}
        label={`Tools for ${selectedIds.length} picked things`}
      />
    );
  }

  // One thing picked
  if (selectedItem) {
    const style = selectedItem.style || {};
    const set = (patch) => onStyle?.(selectedItem.id, patch);
    const live = (patch) => onStyleLive?.(selectedItem.id, patch);

    const isCardList = selectedItem.kind === "cardlist";
    const isText = !isCardList && (hasWords(selectedItem) || selectedItem.kind === "text");
    const isImage = !isCardList && !isText && (isPicture(selectedItem) || selectedItem.kind === "image");
    const isShape = !isCardList && !isText && !isImage && selectedItem.kind === "shape";
    const isIcon = !isCardList && !isText && !isImage && !isShape && selectedItem.kind === "icon";
    const shape = selectedItem.shape || {};
    const inBrandBand = selectedItem.section === "header" || selectedItem.section === "footer";
    const bandLockedForYou = isNormalUser && (inBrandBand || isHeader || isFooter);

    const text = isText
      ? textToolGroups({ items: [selectedItem], onSet: set, onLive: live, brandKit, surfaceBg })
      : null;

    const kindGroups = [];

    if (isText && selectedItem.kind === "text") {
      kindGroups.push({
        key: "text-mode",
        label: "Field settings",
        node: (
          <TextModePopover
            item={selectedItem}
            items={items}
            onChangeMode={onChangeMode}
            onChangeMeta={onChangeMeta}
          />
        ),
      });
    }

    if (isImage) {
      kindGroups.push({
        key: "photo",
        label: "Photo",
        node: (
          <ImageToolbarSection
            selectedItem={selectedItem}
            items={items}
            style={style}
            set={set}
            onStyle={onStyle}
            onReplaceImage={onReplaceImage}
            onChangeMode={onChangeMode}
            onChangeMeta={onChangeMeta}
          />
        ),
      });
    }

    if (isShape) {
      kindGroups.push(
        {
          key: "fill",
          label: "Colour",
          node: (
            <>
              <ItemColorPicker
                label="Fill"
                allowGradient={true}
                value={shape.fill || "brand:primary"}
                brandKit={brandKit}
                surfaceBg={surfaceBg}
                onCommit={(fill) => onStyle?.(selectedItem.id, { shape: { fill } })}
              />
              <ItemColorPicker
                label="Border"
                value={shape.stroke || "brand:primary"}
                brandKit={brandKit}
                surfaceBg={surfaceBg}
                onCommit={(stroke) => onStyle?.(selectedItem.id, { shape: { stroke } })}
              />
            </>
          ),
        },
        {
          key: "thickness",
          label: "Border width",
          node: (
            <div className="flex items-center gap-1 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
              <span className="text-[11px] text-[#6B7280]">Border</span>
              <input
                type="number"
                min={0}
                max={20}
                value={Number(shape.strokeWidth) || 0}
                onChange={(e) =>
                  onStyle?.(selectedItem.id, { shape: { strokeWidth: Number(e.target.value) } })
                }
                className="w-10 text-center text-xs font-mono"
              />
              <span className="text-[10px] text-[#9CA3AF]">px</span>
            </div>
          ),
        },
      );
      if (shape.type !== "circle" && shape.type !== "line") {
        kindGroups.push({
          key: "radius",
          label: "Corner rounding",
          node: (
            <div className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
              <span className="text-[11px] text-[#6B7280]">Corners</span>
              <input
                type="range"
                min={0}
                max={40}
                step={2}
                value={Number(style.radius ?? shape.radius) || 0}
                onChange={(e) => {
                  const r = Number(e.target.value);
                  set({ radius: r });
                  onStyle?.(selectedItem.id, { shape: { radius: r } });
                }}
                className="w-16 accent-[#2563EB]"
              />
              <span className="text-xs font-mono tabular-nums w-5 text-right">
                {Math.round(Number(style.radius ?? shape.radius) || 0)}
              </span>
            </div>
          ),
        });
      }
      kindGroups.push({
        key: "opacity",
        label: "How see-through",
        node: (
          <div className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
            <span className="text-[11px] text-[#6B7280]">Opacity</span>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.05}
              value={
                style.opacity !== undefined
                  ? Number(style.opacity)
                  : shape.opacity !== undefined
                    ? Number(shape.opacity)
                    : 1
              }
              onChange={(e) => {
                const op = Number(e.target.value);
                set({ opacity: op });
                onStyle?.(selectedItem.id, { shape: { opacity: op } });
              }}
              className="w-16 accent-[#2563EB]"
            />
            <span className="text-xs font-mono tabular-nums w-8 text-right">
              {Math.round((style.opacity !== undefined ? Number(style.opacity) : 1) * 100)}%
            </span>
          </div>
        ),
      });
    }

    if (isIcon) {
      kindGroups.push(
        {
          key: "color",
          label: "Colour",
          node: (
            <ItemColorPicker
              label="Colour"
              value={style.color || "brand:primary"}
              brandKit={brandKit}
              surfaceBg={surfaceBg}
              onCommit={(color) => set({ color })}
            />
          ),
        },
        {
          key: "thickness",
          label: "Line thickness",
          node: (
            <div className="flex items-center gap-1 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
              <span className="text-[11px] text-[#6B7280]">Thickness</span>
              <input
                type="number"
                min={1}
                max={4}
                value={Number(style.strokeWidth) || 2}
                onChange={(e) =>
                  set({ strokeWidth: Math.max(1, Math.min(4, Number(e.target.value))) })
                }
                className="w-8 text-center text-xs font-mono"
              />
            </div>
          ),
        },
        {
          key: "opacity",
          label: "How see-through",
          node: (
            <div className="flex items-center gap-1.5 h-8 px-2 rounded-[6px] border border-[#E5E7EB] bg-white">
              <span className="text-[11px] text-[#6B7280]">Opacity</span>
              <input
                type="range"
                min={0.1}
                max={1}
                step={0.05}
                value={style.opacity !== undefined ? Number(style.opacity) : 1}
                onChange={(e) => set({ opacity: Number(e.target.value) })}
                className="w-16 accent-[#2563EB]"
              />
              <span className="text-xs font-mono tabular-nums w-8 text-right">
                {Math.round((style.opacity !== undefined ? Number(style.opacity) : 1) * 100)}%
              </span>
            </div>
          ),
        },
      );
    }

    if (isCardList) {
      kindGroups.push(
        {
          key: "cards",
          label: "Cards",
          node: (
            <>
              <span className="font-semibold text-[#111827] px-2.5 py-1 rounded-[6px] bg-slate-100 border border-[#E5E7EB]">
                {selectedItem.label || "Card list"}
              </span>
              <button
                type="button"
                onClick={() => onEditCard?.(selectedItem.id)}
                className="h-8 px-2.5 flex items-center gap-1.5 rounded-[6px] bg-[#2563EB] text-white font-semibold hover:bg-[#1D4ED8] shadow-xs transition-colors"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Draw card</span>
              </button>
            </>
          ),
        },
        {
          key: "columns",
          label: "Columns",
          node: (
            <div className="flex items-center gap-1">
              <span className="text-[#6B7280]">Side by side</span>
              <div className="flex items-center rounded-[6px] border border-[#E5E7EB] bg-white p-0.5">
                {[1, 2, 3, 4, 5].map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => onPatchItem?.(selectedItem.id, { columns: col })}
                    className={`h-6 w-6 rounded-[4px] text-xs font-medium ${
                      (selectedItem.columns || 2) === col
                        ? "bg-blue-50 text-[#2563EB] font-bold"
                        : "text-[#6B7280] hover:text-[#111827]"
                    }`}
                  >
                    {col}
                  </button>
                ))}
              </div>
            </div>
          ),
        },
        {
          key: "align",
          label: "Alignment",
          node: (
            <div className="flex items-center rounded-[6px] border border-[#E5E7EB] bg-white p-0.5">
              {[
                { key: "left", Icon: AlignLeft, label: "Align left" },
                { key: "center", Icon: AlignCenter, label: "Align center" },
                { key: "right", Icon: AlignRight, label: "Align right" },
              ].map((option) => (
                <button
                  key={option.key}
                  type="button"
                  title={option.label}
                  onClick={() => onPatchItem?.(selectedItem.id, { align: option.key })}
                  className={`h-6 px-1.5 rounded-[4px] ${
                    (selectedItem.align || "center") === option.key
                      ? "bg-blue-50 text-[#2563EB]"
                      : "text-[#6B7280]"
                  }`}
                >
                  <option.Icon className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          ),
        },
        {
          key: "preview",
          label: "Sample lines",
          node: (
            <div className="flex items-center gap-1">
              <span className="text-[#6B7280]">Show</span>
              <div className="flex items-center rounded-[6px] border border-[#E5E7EB] bg-white p-0.5">
                {[2, 3, 5].map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => onPatchItem?.(selectedItem.id, { previewCount: cnt })}
                    className={`h-6 px-2 rounded-[4px] text-xs font-medium ${
                      (selectedItem.previewCount || 3) === cnt
                        ? "bg-blue-50 text-[#2563EB] font-bold"
                        : "text-[#6B7280] hover:text-[#111827]"
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            </div>
          ),
        },
      );
    }

    const groups = [
      ...(text ? text.primary : []),
      ...kindGroups,
      ...(text ? text.secondary : []),
      {
        key: "position",
        label: "Position",
        node: (
          <PositionPopover
            item={selectedItem}
            area={area}
            onRect={onRect}
            onRotation={onRotation}
            onAlign={onAlign}
            onUngroup={onUngroup}
          />
        ),
      },
      {
        key: "order",
        label: "Front and back",
        node: <OrderMenu ids={selectedItem.id} onReorder={onReorder} />,
      },
      {
        key: "lock",
        label: "Keep still",
        node: (
          <KeepStillButton
            ids={selectedItem.id}
            locked={Boolean(selectedItem.locked)}
            disabled={bandLockedForYou}
            title={lockTitleFor(bandLockedForYou, Boolean(selectedItem.locked))}
            onToggleLock={onToggleLock}
          />
        ),
      },
      {
        key: "copy",
        label: "Copy",
        node: <CopyButton ids={selectedItem.id} onDuplicate={onDuplicate} />,
      },
      {
        key: "remove",
        label: "Remove",
        node: (
          <RemoveButton
            ids={selectedItem.id}
            onDelete={onDelete}
            disabled={isHeadlineItem(selectedItem)}
            title={
              isHeadlineItem(selectedItem)
                ? "The name of the layout stays on the poster."
                : "Remove this"
            }
          />
        ),
      },
    ];

    return (
      <ToolbarRow
        groups={groups}
        signature={`${selectedItem.id}|${selectedItem.kind}|${Boolean(selectedItem.locked)}|${JSON.stringify(
          style,
        )}`}
        label="Tools for what you picked"
      />
    );
  }


  // When NOTHING is selected: Section settings toolbar (matching Screenshot 1)
  const currentSection = sections?.[activeSection] || {};
  const currentHeight = currentSection.height ?? (isHeader ? 108 : isFooter ? 70 : 0);
  const currentBg = isHeader
    ? sections?.header?.background
    : isFooter
      ? sections?.footer?.background
      : sections?.content?.page?.background;
  const bgColor = currentBg?.color || (isHeader || isFooter ? "brand:primary" : "brand:background");

  return (
    <div
      role="toolbar"
      aria-label="Section toolbar"
      data-editor-ui="true"
      onPointerDown={keepClickInsideTools}
      onMouseDown={keepClickInsideTools}
      className={TOOLBAR_ROW_CLASS}
    >
      <span className="font-semibold text-sm text-[#111827] capitalize">
        {activeSection}
      </span>

      <span className="text-xs font-medium text-[#6B7280]">
        Background
      </span>

      {/* Section Background Color */}
      <ItemColorPicker
        label="Section background"
        value={bgColor}
        brandKit={brandKit}
        surfaceBg={surfaceBg}
        onCommit={(color) => {
          if (activeSection === "content") {
            onPageChange?.("background", {
              ...(sections?.content?.page?.background || {}),
              mode: "custom",
              color,
            });
          } else {
            onSectionChange?.(activeSection, {
              background: {
                ...(sections?.[activeSection]?.background || {}),
                color,
              },
            });
          }
        }}
      />

      {/* Quick Brand Swatches dots */}
      <div className="flex items-center gap-1.5">
        {BRAND_SWATCHES.slice(0, 3).map((swatch) => {
          const hex = toHex(resolveColorToken(swatch.token, brandKit), "#ffffff");
          const active = bgColor === swatch.token;
          return (
            <button
              key={swatch.token}
              type="button"
              title={`Use this ${swatch.label.toLowerCase()} colour`}
              onClick={() => {
                if (activeSection === "content") {
                  onPageChange?.("background", {
                    ...(sections?.content?.page?.background || {}),
                    mode: "custom",
                    color: swatch.token,
                  });
                } else {
                  onSectionChange?.(activeSection, {
                    background: {
                      ...(sections?.[activeSection]?.background || {}),
                      color: swatch.token,
                    },
                  });
                }
              }}
              className={`h-4 w-4 rounded-full border border-slate-300 transition-transform hover:scale-110 ${
                active ? "ring-2 ring-[#2563EB] ring-offset-1" : ""
              }`}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>

      {/* Band Height for Header & Footer */}
      {(isHeader || isFooter) && (
        <div className="flex items-center gap-1.5 ml-2">
          <span className="text-xs font-medium text-[#6B7280]">Height</span>
          <span className="text-xs font-bold text-[#111827] tabular-nums">
            {currentHeight} px
          </span>
        </div>
      )}

      {/* Locked note */}
      {(isHeader || isFooter) && (
        <span className="text-xs text-[#6B7280] ml-2">
          Anyone making a poster sees this part exactly as you leave it
        </span>
      )}

      {/* Settings Drawer Toggle */}
      {onToggleSettings && (
        <button
          type="button"
          onClick={onToggleSettings}
          title="More section settings"
          className="ml-2 h-7 px-2 flex items-center gap-1 rounded-[4px] border border-[#E5E7EB] bg-white text-xs font-medium text-[#6B7280] hover:text-[#111827] hover:bg-[#F9FAFB]"
        >
          <Sliders className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
