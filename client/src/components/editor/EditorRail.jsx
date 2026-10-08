import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Circle,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  ListChecks,
  Lock,
  LockOpen,
  Palette,
  RotateCcw,
  Shapes,
  Sliders,
  Sparkles,
  Square,
  Trash2,
  Type,
  X,
} from "lucide-react";
import BrandImageField from "../brand/BrandImageField";
import {
  BackgroundEditor,
  ColorInput,
  LIMITS,
  Segmented,
  SliderNumber,
  Toggle,
} from "../brand/controls";
import {
  BRAND_COLOR_TOKENS,
  CONTENT_DECORATIONS,
  DEFAULT_PAGE_BACKGROUND,
  DEFAULT_PAGE_DECORATION,
  DEFAULT_PAGE_INFO_CARD,
  DEFAULT_PAGE_WATERMARK,
  ELEMENT_LIMITS,
  isBrandColorToken,
  resolveColorToken,
} from "../../../../shared/templateElements.js";
import { toHex } from "../../utils/contrast.js";
import {
  FIELD_LABELS,
  FIELD_ORDER,
  SHAPE_VARIANTS,
  TEXT_VARIANTS,
  counterLine,
  isHeadlineItem,
  itemLabel,
  layersOf,
  modeOf,
  pictureCountOf,
} from "../../utils/templateEditorItems";

/* ------------------------------------------------------------------ *
 * The narrow strip down the left, and the panel it slides open.
 *
 * Seven doors: the poster's own parts, words of your own, photos, plain shapes,
 * the order things sit in, the poster's page overrides and the organization's brand.
 * Each one opens over the canvas and shuts again as soon as you click the poster,
 * so the canvas is never squeezed by a permanent panel.
 * ------------------------------------------------------------------ */

export const RAIL_TABS = [
  {
    key: "fields",
    label: "Fields",
    title: "Built-in fields",
    Icon: ListChecks,
  },
  { key: "text", label: "Text", title: "Add text", Icon: Type },
  { key: "images", label: "Images", title: "Photos", Icon: ImageIcon },
  { key: "shapes", label: "Shapes", title: "Shapes", Icon: Shapes },
  { key: "layers", label: "Layers", title: "Layers", Icon: Layers },
  { key: "page", label: "Page", title: "Page settings", Icon: Sliders },
  { key: "brand", label: "Brand", title: "Brand style", Icon: Palette },
];

export default function EditorRail({ tab, onTab }) {
  return (
    <nav
      aria-label="What to add"
      className="flex w-14 shrink-0 flex-col items-center gap-1 border-r border-[#E5E7EB] bg-[#FAFAFA] py-2"
    >
      {RAIL_TABS.map(({ key, label, Icon }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            aria-label={label}
            title={label}
            aria-pressed={active}
            onClick={() => onTab(active ? "" : key)}
            className={`flex w-12 flex-col items-center gap-1 rounded-[6px] py-2 text-[11px] font-medium leading-tight transition-colors ${
              active
                ? "bg-[#F3F4F6] text-[#111827]"
                : "text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827]"
            }`}
          >
            <Icon
              className={`h-[18px] w-[18px] ${
                active ? "text-[#111827]" : "text-[#6B7280]"
              }`}
            />
            {label}
          </button>
        );
      })}
    </nav>
  );
}

function Row({
  item,
  selected,
  onSelect,
  children,
  dropTarget = false,
  handle = null,
  inList = false,
}) {
  return (
    <div
      data-layer-row={inList ? item.id : undefined}
      className={`flex items-center gap-1.5 rounded-[6px] border px-2 py-1.5 ${
        dropTarget || selected
          ? "border-[#2563EB] bg-[#EFF6FF]"
          : "border-[#E5E7EB] bg-white"
      } ${dropTarget ? "border-dashed" : ""}`}
    >
      {handle}
      <ModeChip item={item} />
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className="min-w-0 flex-1 truncate text-left text-xs font-medium text-[#111827] hover:text-[#2563EB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
      >
        {itemLabel(item)}
      </button>
      {children}
    </div>
  );
}

const MODE_CHIPS = {
  ai: {
    label: "The assistant writes these words",
    Icon: Sparkles,
    className: "border-blue-200 bg-[#EFF6FF] text-[#2563EB]",
  },
  user: {
    label: "The person filling this in chooses the picture",
    Icon: ImagePlus,
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
  },
  locked: {
    label: "Locked, part of the design",
    Icon: Lock,
    className: "border-slate-200 bg-slate-50 text-slate-600",
  },
  hold: {
    label: "Fixed in place",
    Icon: Lock,
    className: "border-line bg-section text-muted-foreground",
  },
};

function Chip({ tone, label, Icon }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={`shrink-0 rounded border p-0.5 ${tone.className}`}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
    </span>
  );
}

/** The same cues the canvas shows, so a list row says what the box on the poster says. */
function ModeChip({ item }) {
  const tone = MODE_CHIPS[modeOf(item)];
  if (item?.kind === "text" || item?.kind === "image") {
    return <Chip tone={tone} label={tone.label} Icon={tone.Icon} />;
  }
  if (item?.locked)
    return (
      <Chip
        tone={MODE_CHIPS.hold}
        label={MODE_CHIPS.hold.label}
        Icon={MODE_CHIPS.hold.Icon}
      />
    );
  return null;
}

function TinyButton({ label, icon, onClick, disabled }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded p-1 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
        label === "Remove"
          ? "text-[rgb(220,38,38)] hover:bg-red-50"
          : "text-muted-foreground hover:bg-section hover:text-heading"
      }`}
    >
      {icon}
    </button>
  );
}

const lockIcon = (locked) =>
  locked ? (
    <LockOpen className="h-3.5 w-3.5" />
  ) : (
    <Lock className="h-3.5 w-3.5" />
  );

function AddButton({ onClick, children, disabled = false }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="w-full rounded-[6px] border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-3 py-2 text-left text-xs font-medium text-[#111827] hover:border-[#2563EB] hover:bg-[#EFF6FF] disabled:cursor-not-allowed disabled:border-[#E5E7EB] disabled:text-[#9CA3AF] disabled:hover:border-[#E5E7EB] disabled:hover:bg-[#FAFAFA] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
    >
      {children}
    </button>
  );
}

function Note({ children }) {
  return <p className="text-[11px] text-muted-foreground">{children}</p>;
}

function Warning({ children }) {
  return (
    <p className="rounded-btn border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] leading-snug text-amber-800">
      {children}
    </p>
  );
}

const RADIUS = ELEMENT_LIMITS.radius;
const OPACITY = ELEMENT_LIMITS.opacity;
const STROKE = ELEMENT_LIMITS.strokeWidth;

function hexOf(value) {
  return /^#[0-9a-f]{6}$/i.test(value || "") ? value : "";
}

function opacityOf(style) {
  const value = Number(style?.opacity);
  return Number.isFinite(value)
    ? Math.min(OPACITY.max, Math.max(OPACITY.min, value))
    : OPACITY.max;
}

/** A colour you can pick or type, with a way back to "no colour at all". */
function ColourRow({ label, value, fallback = "#0f172a", brandKit = null, onPick, onCommit }) {
  const isToken = isBrandColorToken(value);
  const resolved = resolveColorToken(value, brandKit);
  const shown = hexOf(resolved);
  /* What is typed stays on screen while it is being typed, even when it is not a colour yet. */
  const [draft, setDraft] = useState(value || "");
  useEffect(() => {
    setDraft(value || "");
  }, [value]);
  const finish = () => {
    const raw = draft.trim();
    const next = raw === "" || /^#[0-9a-f]{6}$/i.test(raw) || isBrandColorToken(raw) ? raw : value || "";
    setDraft(next);
    onCommit?.(next);
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-body">{label}</span>
        {isToken ? (
          <span className="text-[10px] font-semibold text-primary capitalize">
            {value.replace("brand:", "")}
          </span>
        ) : null}
        <span className="flex items-center gap-1">
          <input
            type="color"
            aria-label={label}
            value={shown || fallback}
            onChange={(event) => onPick?.(event.target.value)}
            className="h-8 w-10 cursor-pointer rounded-[6px] border border-[#E5E7EB] bg-white p-0.5"
          />
          <input
            type="text"
            aria-label={`${label} code`}
            value={draft}
            placeholder="none"
            onChange={(event) => setDraft(event.target.value)}
            onBlur={finish}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setDraft(value || "");
                event.currentTarget.blur();
              }
            }}
            className="h-8 w-[76px] rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-xs font-mono text-[#111827]"
          />
        </span>
      </div>
      {brandKit ? (
        <div className="flex items-center gap-1.5 justify-end">
          {["brand:primary", "brand:secondary", "brand:accent", "brand:text"].map((tok) => {
            const swatchHex = toHex(resolveColorToken(tok, brandKit), "#ffffff");
            return (
              <button
                key={tok}
                type="button"
                title={`Brand ${tok.replace("brand:", "")}`}
                onClick={() => {
                  setDraft(tok);
                  onCommit?.(tok);
                }}
                className={`h-4 w-4 rounded-full border border-slate-300 hover:scale-110 transition-transform ${
                  value === tok ? "ring-2 ring-primary ring-offset-1" : ""
                }`}
                style={{ backgroundColor: swatchHex }}
              />
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** A slider with the number it stands for written next to it. */
function AmountRow({
  label,
  value,
  min,
  max,
  step = 1,
  readout,
  onLive,
  onCommit,
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-body">{label}</span>
        <span className="text-[11px] tabular-nums text-muted-foreground">
          {readout}
        </span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onLive?.(Number(event.target.value))}
        onPointerUp={(event) => onCommit?.(Number(event.currentTarget.value))}
        onBlur={(event) => onCommit?.(Number(event.target.value))}
        className="w-full accent-[#2563eb]"
      />
    </div>
  );
}

/** A number you type, held inside the range the save rules allow. */
function NumberRow({ label, value, min, max, onLive, onCommit }) {
  const [draft, setDraft] = useState(() => String(value ?? min));
  useEffect(() => {
    setDraft(String(value ?? min));
  }, [value, min]);

  const hold = (n) => Math.min(max, Math.max(min, Math.round(n)));
  const change = (raw) => {
    setDraft(raw);
    const n = Number(raw);
    if (raw.trim() !== "" && Number.isFinite(n)) onLive?.(hold(n));
  };
  const finish = () => {
    const n = Number(draft);
    const next =
      draft.trim() !== "" && Number.isFinite(n)
        ? hold(n)
        : hold(Number(value) || min);
    setDraft(String(next));
    onCommit?.(next);
  };

  return (
    <label className="flex items-center justify-between gap-2 text-xs text-body">
      {label}
      <input
        type="number"
        aria-label={label}
        min={min}
        max={max}
        value={draft}
        onChange={(event) => change(event.target.value)}
        onBlur={finish}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="h-8 w-20 rounded-[6px] border border-[#E5E7EB] bg-white px-2 text-xs tabular-nums text-[#111827]"
      />
    </label>
  );
}

function FieldsPanel({ items, selectedId, actions }) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        The poster&rsquo;s own parts, whose words come from what the person
        filling it in types.
      </p>
      <ul className="space-y-1.5">
        {FIELD_ORDER.map((field) => {
          const placed = items.filter(
            (item) => item.kind === "field" && item.field === field,
          );
          if (placed.length === 0) {
            return (
              <li key={field}>
                <AddButton onClick={() => actions.addField(field)}>
                  Add {FIELD_LABELS[field]}
                </AddButton>
              </li>
            );
          }
          return (
            <li key={field} className="space-y-1">
              {placed.map((item) => (
                <Row
                  key={item.id}
                  item={item}
                  selected={item.id === selectedId}
                  onSelect={actions.select}
                >
                  <TinyButton
                    label={item.locked ? "Allow moving" : "Keep in place"}
                    icon={lockIcon(item.locked)}
                    onClick={() => actions.toggleLock(item.id)}
                  />
                  <TinyButton
                    label="Remove"
                    icon={<X className="h-3.5 w-3.5" />}
                    disabled={isHeadlineItem(item)}
                    onClick={() => actions.remove(item.id)}
                  />
                </Row>
              ))}
            </li>
          );
        })}
      </ul>
      <Note>The headline always stays on the poster.</Note>
    </div>
  );
}

function TextPanel({ items, selectedId, actions }) {
  const textItems = items.filter((item) => item.kind === "text");
  const counters = counterLine(items);
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A new box is words the assistant writes for each poster; switch it to
        Locked for words of your own.
      </p>
      <div className="space-y-1.5">
        {Object.entries(TEXT_VARIANTS).map(([key, variant]) => (
          <AddButton key={key} onClick={() => actions.addText(key)}>
            Add {variant.label}
          </AddButton>
        ))}
      </div>
      {counters.fullTexts ? (
        <Note>
          A new box will hold fixed words of your own, since {counters.texts}.
        </Note>
      ) : null}
      {textItems.length > 0 ? (
        <div className="space-y-1.5 border-t border-[#E5E7EB] pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">On this poster</p>
          {textItems.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={actions.select}
            >
              <TinyButton
                label="Make a copy"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => actions.duplicate(item.id)}
              />
              <TinyButton
                label="Remove"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => actions.remove(item.id)}
              />
            </Row>
          ))}
        </div>
      ) : null}
      <Note>
        {counters.texts} · {items.length} of {ELEMENT_LIMITS.maxItems} items
        placed.
      </Note>
    </div>
  );
}

function ImagesPanel({ items, selectedId, actions, brandKit }) {
  const pictures = items.filter(
    (item) => item.kind === "image" || item.field === "photo",
  );
  const chosen = pictures.find((item) => item.id === selectedId) || null;
  const defaultPhoto = brandKit?.content?.defaultImageUrl || "";
  const own = pictureCountOf(items);
  const left = ELEMENT_LIMITS.maxImage - own;
  const counters = counterLine(items);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        A new photo space is one the person filling the poster in replaces.
      </p>
      {left > 0 ? (
        <BrandImageField
          insert
          kind="template"
          label="Upload a photo"
          value=""
          onChange={(url) => actions.insertImage(url)}
          hint={
            <Note>
              {left} of {ELEMENT_LIMITS.maxImage} photo spaces left.{" "}
              {counters.images}.
            </Note>
          }
        />
      ) : (
        <Warning>
          This template already has {ELEMENT_LIMITS.maxImage} photos of its own,
          which is the most it can hold. Take one away below to put another in
          its place.
        </Warning>
      )}

      <AddButton disabled={left <= 0} onClick={() => actions.addImage()}>
        {left > 0
          ? "Add an empty photo space"
          : `No photo spaces left (${ELEMENT_LIMITS.maxImage})`}
      </AddButton>

      {counters.fullImages ? (
        <Note>
          A new space will keep the picture you put in it, since{" "}
          {counters.images}.
        </Note>
      ) : null}

      {pictures.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-[#111827]">On this poster</p>
          {pictures.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={actions.select}
            >
              <TinyButton
                label="Make a copy"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => actions.duplicate(item.id)}
              />
              <TinyButton
                label="Remove"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => actions.remove(item.id)}
              />
            </Row>
          ))}
        </div>
      ) : (
        <Note>
          A photo space with nothing in it shows nothing at all, so the poster
          stays clean either way.
        </Note>
      )}

      {chosen ? (
        <div className="space-y-3 border-t border-[#E5E7EB] pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">
            {itemLabel(chosen)}
          </p>
          {chosen.variable ? (
            <Note>
              Whoever makes the poster chooses this picture, so it prints empty
              until they do.
            </Note>
          ) : null}

          {chosen.kind === "image" ? (
            <>
              <BrandImageField
                label="Choose a different photo"
                kind="template"
                value={chosen.imageUrl || ""}
                onChange={(url) => actions.setImageUrl(chosen.id, url)}
              />
              {defaultPhoto && chosen.imageUrl !== defaultPhoto ? (
                <button
                  type="button"
                  onClick={() => actions.setImageUrl(chosen.id, defaultPhoto)}
                  className="w-full rounded-btn border border-line px-3 py-2 text-xs font-semibold text-heading hover:bg-section"
                >
                  Use your organization&rsquo;s own photo
                </button>
              ) : null}
            </>
          ) : (
            <Note>
              This space shows the photo that comes with each event, so it has
              no picture of its own.
            </Note>
          )}

          <AmountRow
            label="Rounded corners"
            value={Math.min(
              RADIUS.max,
              Math.max(RADIUS.min, Number(chosen.style?.radius) || 0),
            )}
            min={RADIUS.min}
            max={RADIUS.max}
            readout={Math.round(Number(chosen.style?.radius) || 0)}
            onLive={(radius) => actions.setStyleLive(chosen.id, { radius })}
            onCommit={(radius) => actions.setStyle(chosen.id, { radius })}
          />
          <AmountRow
            label="See-through"
            value={opacityOf(chosen.style)}
            min={OPACITY.min}
            max={OPACITY.max}
            step={0.05}
            readout={`${Math.round(opacityOf(chosen.style) * 100)}%`}
            onLive={(opacity) => actions.setStyleLive(chosen.id, { opacity })}
            onCommit={(opacity) => actions.setStyle(chosen.id, { opacity })}
          />
        </div>
      ) : null}
    </div>
  );
}

function ShapesPanel({ items, selectedId, actions, brandKit = null }) {
  const shapes = items.filter((item) => item.kind === "shape");
  const chosen = shapes.find((item) => item.id === selectedId) || null;
  const shape = chosen?.shape || {};
  const line = shape.type === "line";

  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        {Object.entries(SHAPE_VARIANTS).map(([key, variant]) => (
          <AddButton key={key} onClick={() => actions.addShape(key)}>
            <span className="flex items-center gap-2">
              {key === "circle" ? (
                <Circle className="h-3.5 w-3.5" />
              ) : key === "line" ? (
                <ArrowDown className="h-3.5 w-3.5 rotate-90" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
              Add a {variant.label.toLowerCase()}
            </span>
          </AddButton>
        ))}
      </div>

      {shapes.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-[13px] font-semibold text-[#111827]">On this poster</p>
          {shapes.map((item) => (
            <Row
              key={item.id}
              item={item}
              selected={item.id === selectedId}
              onSelect={actions.select}
            >
              <TinyButton
                label="Make a copy"
                icon={<Copy className="h-3.5 w-3.5" />}
                onClick={() => actions.duplicate(item.id)}
              />
              <TinyButton
                label="Remove"
                icon={<X className="h-3.5 w-3.5" />}
                onClick={() => actions.remove(item.id)}
              />
            </Row>
          ))}
        </div>
      ) : (
        <Note>
          A line, a box or a circle behind the words is often what makes a
          poster look finished.
        </Note>
      )}

      {chosen ? (
        <div className="space-y-3 border-t border-[#E5E7EB] pt-3">
          <p className="text-[13px] font-semibold text-[#111827]">This shape</p>
          <div className="flex gap-1.5">
            {["rect", "circle", "line"].map((type) => (
              <button
                key={type}
                type="button"
                aria-pressed={shape.type === type}
                onClick={() => actions.setShape(chosen.id, { type })}
                className={`flex-1 rounded-btn border px-2 py-1 text-[11px] font-semibold ${
                  shape.type === type
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-line text-body hover:bg-section"
                }`}
              >
                {SHAPE_VARIANTS[type].label}
              </button>
            ))}
          </div>

          {line ? (
            <>
              <ColourRow
                label="Line colour"
                value={shape.stroke || shape.fill || ""}
                fallback="#334155"
                brandKit={brandKit}
                onPick={(color) =>
                  actions.setShape(chosen.id, { stroke: color, fill: "" })
                }
                onCommit={(color) =>
                  actions.setShape(chosen.id, { stroke: color, fill: "" })
                }
              />
              <NumberRow
                label="Line thickness"
                value={Number(shape.strokeWidth) || 4}
                min={1}
                max={STROKE.max}
                onLive={(strokeWidth) =>
                  actions.setShape(chosen.id, { strokeWidth })
                }
                onCommit={(strokeWidth) =>
                  actions.setShape(chosen.id, { strokeWidth })
                }
              />
            </>
          ) : (
            <>
              <ColourRow
                label="Fill colour"
                value={shape.fill || ""}
                fallback="#059669"
                brandKit={brandKit}
                onPick={(fill) => actions.setShape(chosen.id, { fill })}
                onCommit={(fill) => actions.setShape(chosen.id, { fill })}
              />
              <ColourRow
                label="Border colour"
                value={shape.stroke || ""}
                fallback="#0f172a"
                brandKit={brandKit}
                onPick={(stroke) => actions.setShape(chosen.id, { stroke })}
                onCommit={(stroke) => actions.setShape(chosen.id, { stroke })}
              />
              <NumberRow
                label="Border thickness"
                value={Number(shape.strokeWidth) || 0}
                min={STROKE.min}
                max={STROKE.max}
                onLive={(strokeWidth) =>
                  actions.setShape(chosen.id, { strokeWidth })
                }
                onCommit={(strokeWidth) =>
                  actions.setShape(chosen.id, { strokeWidth })
                }
              />
              {shape.type === "rect" ? (
                <AmountRow
                  label="Rounded corners"
                  value={Math.min(
                    RADIUS.max,
                    Math.max(RADIUS.min, Number(chosen.style?.radius) || 0),
                  )}
                  min={RADIUS.min}
                  max={RADIUS.max}
                  readout={Math.round(Number(chosen.style?.radius) || 0)}
                  onLive={(radius) =>
                    actions.setStyleLive(chosen.id, { radius })
                  }
                  onCommit={(radius) => actions.setStyle(chosen.id, { radius })}
                />
              ) : null}
            </>
          )}

          <AmountRow
            label="See-through"
            value={opacityOf(chosen.style)}
            min={OPACITY.min}
            max={OPACITY.max}
            step={0.05}
            readout={`${Math.round(opacityOf(chosen.style) * 100)}%`}
            onLive={(opacity) => actions.setStyleLive(chosen.id, { opacity })}
            onCommit={(opacity) => actions.setStyle(chosen.id, { opacity })}
          />
        </div>
      ) : null}
    </div>
  );
}

function LayersPanel({ items, selectedId, hiddenIds, actions }) {
  const layers = layersOf(items);
  const [drag, setDrag] = useState(null);

  const rowUnder = (event) => {
    const node =
      typeof document !== "undefined"
        ? document.elementFromPoint?.(event.clientX, event.clientY)
        : null;
    return (
      node?.closest?.("[data-layer-row]")?.getAttribute("data-layer-row") || ""
    );
  };

  const startDrag = (event, id) => {
    if (event.button !== undefined && event.button !== 0) return;
    event.preventDefault();
    setDrag({ id, over: "" });

    const move = (moveEvent) =>
      setDrag((prev) =>
        prev ? { ...prev, over: rowUnder(moveEvent) || prev.over } : prev,
      );
    const end = (endEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
      const target = rowUnder(endEvent);
      setDrag(null);
      if (target && target !== id) actions.dropLayer(id, target);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
  };

  if (layers.length === 0)
    return (
      <p className="text-xs text-muted-foreground">
        Nothing has been placed on this poster yet.
      </p>
    );

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        What sits on top of what. The first row is the closest to you. Grab the
        handle to move a row, or use the arrows.
      </p>
      <ul className="space-y-1">
        {layers.map((item, index) => {
          const hidden = Boolean(hiddenIds?.has?.(item.id));
          return (
            <li key={item.id}>
              <Row
                item={item}
                selected={item.id === selectedId}
                onSelect={actions.select}
                inList
                dropTarget={
                  Boolean(drag) && drag.over === item.id && drag.id !== item.id
                }
                handle={
                  <button
                    type="button"
                    aria-label={`Move ${itemLabel(item)} in the stack`}
                    title="Drag to change the order"
                    onPointerDown={(event) => startDrag(event, item.id)}
                    className="shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-section hover:text-heading touch-none"
                  >
                    <GripVertical className="h-4 w-4" />
                  </button>
                }
              >
                <TinyButton
                  label="Bring forward"
                  icon={<ArrowUp className="h-3.5 w-3.5" />}
                  disabled={index === 0}
                  onClick={() => actions.moveLayer(item.id, 1)}
                />
                <TinyButton
                  label="Send backward"
                  icon={<ArrowDown className="h-3.5 w-3.5" />}
                  disabled={index === layers.length - 1}
                  onClick={() => actions.moveLayer(item.id, -1)}
                />
                <TinyButton
                  label={item.locked ? "Allow moving" : "Keep in place"}
                  icon={lockIcon(item.locked)}
                  onClick={() => actions.toggleLock(item.id)}
                />
                <TinyButton
                  label={
                    hidden ? "Show on the poster again" : "Hide while you edit"
                  }
                  icon={
                    hidden ? (
                      <EyeOff className="h-3.5 w-3.5" />
                    ) : (
                      <Eye className="h-3.5 w-3.5" />
                    )
                  }
                  onClick={() => actions.toggleHidden(item.id)}
                />
                <TinyButton
                  label="Remove"
                  icon={<Trash2 className="h-3.5 w-3.5" />}
                  disabled={isHeadlineItem(item)}
                  onClick={() => actions.remove(item.id)}
                />
              </Row>
            </li>
          );
        })}
      </ul>
      <Note>
        Hiding only keeps something out of your way while you place the rest.
        The poster a person downloads always has every item on it.
      </Note>
    </div>
  );
}

function PageSection({
  title,
  isCustom,
  onToggleMode,
  onReset,
  children,
}) {
  return (
    <div className="space-y-3 rounded-[6px] border border-[#E5E7EB] bg-[#FAFAFA] p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-[#111827]">{title}</span>
        {isCustom ? (
          <div className="flex items-center gap-1.5">
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
              Customized
            </span>
            <button
              type="button"
              onClick={onReset}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900"
              title="Reset to brand setting"
            >
              <RotateCcw className="h-3 w-3" />
              <span>Reset to brand</span>
            </button>
          </div>
        ) : null}
      </div>

      <Segmented
        value={isCustom ? "custom" : "brand"}
        onChange={(val) => onToggleMode(val === "custom")}
        options={[
          { value: "brand", label: "Use brand setting" },
          { value: "custom", label: "Customize" },
        ]}
      />

      {isCustom ? (
        <div className="space-y-3 pt-2 border-t border-line">
          {children}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground leading-snug">
          Using your organization&rsquo;s brand setting.
        </p>
      )}
    </div>
  );
}

function PagePanel({ page, brandKit, onPageChange, onResetSection }) {
  const bg = page?.background || { mode: "brand" };
  const dec = page?.decoration || { mode: "brand" };
  const wm = page?.watermark || { mode: "brand" };
  const card = page?.infoCard || { mode: "brand" };

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground">
        Customize the poster&rsquo;s backdrop, decorations and info cards. Anything you don&rsquo;t customize will follow your brand kit.
      </p>

      {/* 1. Background */}
      <PageSection
        title="Background"
        isCustom={bg.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("background", {
              ...DEFAULT_PAGE_BACKGROUND,
              ...bg,
              mode: "custom",
            });
          } else {
            onResetSection("background");
          }
        }}
        onReset={() => onResetSection("background")}
      >
        <BackgroundEditor
          label="Poster background"
          value={bg}
          onChange={(patch) =>
            onPageChange("background", { ...bg, ...patch, mode: "custom" })
          }
          types={["color", "gradient", "image", "pattern"]}
          uploadKind="content"
          uploadLabel="Upload background photo"
        />
      </PageSection>

      {/* 2. Decoration */}
      <PageSection
        title="Decoration"
        isCustom={dec.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("decoration", {
              ...DEFAULT_PAGE_DECORATION,
              ...dec,
              mode: "custom",
            });
          } else {
            onResetSection("decoration");
          }
        }}
        onReset={() => onResetSection("decoration")}
      >
        <Segmented
          label="Pattern or shape"
          value={dec.decoration || "none"}
          onChange={(decoration) =>
            onPageChange("decoration", { ...dec, mode: "custom", decoration })
          }
          options={[
            { value: "none", label: "None" },
            { value: "band", label: "Band" },
            { value: "circle", label: "Circle" },
            { value: "corners", label: "Corners" },
          ]}
        />
        {(dec.decoration || "none") !== "none" ? (
          <ColorInput
            label="Decoration color"
            value={dec.decorationColor || "brand:primary"}
            brandKit={brandKit}
            onChange={(decorationColor) =>
              onPageChange("decoration", {
                ...dec,
                mode: "custom",
                decorationColor,
              })
            }
          />
        ) : null}
      </PageSection>

      {/* 3. Watermark */}
      <PageSection
        title="Watermark"
        isCustom={wm.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("watermark", {
              ...DEFAULT_PAGE_WATERMARK,
              ...wm,
              mode: "custom",
            });
          } else {
            onResetSection("watermark");
          }
        }}
        onReset={() => onResetSection("watermark")}
      >
        <Toggle
          label="Show logo watermark"
          checked={Boolean(wm.show)}
          onChange={(show) =>
            onPageChange("watermark", { ...wm, mode: "custom", show })
          }
          hint="Faint brand logo placed in the center of the poster"
        />
        {wm.show ? (
          <SliderNumber
            label="Watermark opacity"
            value={wm.opacity ?? 0.08}
            min={LIMITS.watermarkOpacity.min}
            max={LIMITS.watermarkOpacity.max}
            step={LIMITS.watermarkOpacity.step}
            onChange={(opacity) =>
              onPageChange("watermark", { ...wm, mode: "custom", opacity })
            }
          />
        ) : null}
      </PageSection>

      {/* 4. Cards for date, time and place */}
      <PageSection
        title="Cards for date, time and place"
        isCustom={card.mode === "custom"}
        onToggleMode={(custom) => {
          if (custom) {
            onPageChange("infoCard", {
              ...DEFAULT_PAGE_INFO_CARD,
              ...card,
              mode: "custom",
            });
          } else {
            onResetSection("infoCard");
          }
        }}
        onReset={() => onResetSection("infoCard")}
      >
        <ColorInput
          label="Card background"
          value={card.background || "#f8fafc"}
          brandKit={brandKit}
          onChange={(background) =>
            onPageChange("infoCard", { ...card, mode: "custom", background })
          }
        />
        <ColorInput
          label="Card border color"
          value={card.border || "#e2e8f0"}
          brandKit={brandKit}
          onChange={(border) =>
            onPageChange("infoCard", { ...card, mode: "custom", border })
          }
        />
        <ColorInput
          label="Icon color"
          value={card.iconColor || "brand:primary"}
          brandKit={brandKit}
          onChange={(iconColor) =>
            onPageChange("infoCard", { ...card, mode: "custom", iconColor })
          }
        />
        <SliderNumber
          label="Card rounded corners"
          value={card.radius ?? 16}
          min={LIMITS.cardRadius.min}
          max={LIMITS.cardRadius.max}
          step={LIMITS.cardRadius.step}
          unit="px"
          onChange={(radius) =>
            onPageChange("infoCard", { ...card, mode: "custom", radius })
          }
        />
      </PageSection>
    </div>
  );
}

const BRAND_RAIL_SWATCHES = [
  { token: "brand:primary", label: "Primary" },
  { token: "brand:secondary", label: "Secondary" },
  { token: "brand:accent", label: "Accent" },
  { token: "brand:text", label: "Text" },
  { token: "brand:background", label: "Background" },
];

function BrandPanel({
  selectedItem,
  brandKit,
  onApplyColorToken,
  onApplyFontToken,
}) {
  const headingFont = brandKit?.fonts?.heading || "Cinzel";
  const bodyFont = brandKit?.fonts?.body || "Inter";

  return (
    <div className="space-y-4">
      <div className="rounded-btn border border-line bg-section p-3 space-y-2">
        <p className="text-xs text-muted-foreground leading-snug">
          Header and footer are set in the Brand Kit.
        </p>
        <a
          href="/brand-kit"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          <span>Edit in Brand Kit</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <div className="space-y-2">
        <span className="text-[13px] font-semibold text-[#111827]">Brand colours</span>
        <p className="text-[11px] text-[#6B7280]">
          {selectedItem
            ? "Click a colour to apply it to the selected item."
            : "Select an item on the poster to apply a brand colour."}
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {BRAND_RAIL_SWATCHES.map((swatch) => {
            const hex = toHex(resolveColorToken(swatch.token, brandKit), "#ffffff");
            return (
              <button
                key={swatch.token}
                type="button"
                onClick={() => onApplyColorToken?.(swatch.token)}
                disabled={!selectedItem}
                className="flex items-center gap-2.5 rounded-[6px] border border-[#E5E7EB] bg-white px-2.5 py-2 text-left hover:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span
                  className="h-6 w-6 rounded-full border border-slate-300 shrink-0 shadow-inner"
                  style={{ backgroundColor: hex }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium text-[#111827]">{swatch.label}</p>
                  <p className="font-mono text-[10px] text-[#6B7280] uppercase">{hex}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-2 border-t border-[#E5E7EB] pt-3">
        <span className="text-[13px] font-semibold text-[#111827]">Brand fonts</span>
        <p className="text-[11px] text-muted-foreground">
          {selectedItem?.kind === "text"
            ? "Click a font to apply it to the selected text."
            : "Select a text item on the poster to apply a brand font."}
        </p>
        <div className="space-y-1.5">
          <button
            type="button"
            onClick={() => onApplyFontToken?.("brand:heading")}
            disabled={selectedItem?.kind !== "text"}
            className="w-full rounded-btn border border-line bg-canvas p-2.5 text-left hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-heading">Brand heading</span>
            <p className="text-sm text-heading mt-0.5 truncate" style={{ fontFamily: `'${headingFont}', sans-serif` }}>
              {headingFont}
            </p>
          </button>
          <button
            type="button"
            onClick={() => onApplyFontToken?.("brand:body")}
            disabled={selectedItem?.kind !== "text"}
            className="w-full rounded-btn border border-line bg-canvas p-2.5 text-left hover:border-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            <span className="text-xs font-semibold text-heading">Brand body</span>
            <p className="text-sm text-heading mt-0.5 truncate" style={{ fontFamily: `'${bodyFont}', sans-serif` }}>
              {bodyFont}
            </p>
          </button>
        </div>
      </div>
    </div>
  );
}

export function EditorPanel({
  tab,
  items,
  selectedId,
  hiddenIds,
  brandKit,
  page,
  onPageChange,
  onResetPageSection,
  onApplyColorToken,
  onApplyFontToken,
  actions,
  onClose,
}) {
  useEffect(() => {
    if (!tab) return undefined;
    const escape = (event) => {
      if (event.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [tab, onClose]);

  if (!tab) return null;

  const title = RAIL_TABS.find((entry) => entry.key === tab)?.title || "";

  return (
    <div
      role="dialog"
      aria-label={title}
      className="absolute bottom-0 left-0 top-0 z-[55] w-[300px] max-w-[86vw] overflow-y-auto border-r border-[#E5E7EB] bg-white p-4"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold text-[#111827]">{title}</h2>
        <button
          type="button"
          aria-label="Close this panel"
          onClick={onClose}
          className="rounded-[6px] p-1 text-[#6B7280] hover:bg-[#F3F4F6] hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#2563EB]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {tab === "fields" ? (
        <FieldsPanel items={items} selectedId={selectedId} actions={actions} />
      ) : null}
      {tab === "text" ? (
        <TextPanel items={items} selectedId={selectedId} actions={actions} />
      ) : null}
      {tab === "images" ? (
        <ImagesPanel
          items={items}
          selectedId={selectedId}
          actions={actions}
          brandKit={brandKit}
        />
      ) : null}
      {tab === "shapes" ? (
        <ShapesPanel
          items={items}
          selectedId={selectedId}
          actions={actions}
          brandKit={brandKit}
        />
      ) : null}
      {tab === "layers" ? (
        <LayersPanel
          items={items}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          actions={actions}
        />
      ) : null}
      {tab === "page" ? (
        <PagePanel
          page={page}
          brandKit={brandKit}
          onPageChange={onPageChange}
          onResetSection={onResetPageSection}
        />
      ) : null}
      {tab === "brand" ? (
        <BrandPanel
          selectedItem={items.find((item) => item.id === selectedId) || null}
          brandKit={brandKit}
          onApplyColorToken={onApplyColorToken}
          onApplyFontToken={onApplyFontToken}
        />
      ) : null}
    </div>
  );
}
