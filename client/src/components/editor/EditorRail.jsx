import React, { useEffect, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  ImagePlus,
  Layers,
  ListChecks,
  Lock,
  LockOpen,
  Shapes,
  Sparkles,
  Square,
  Trash2,
  Type,
  X,
} from "lucide-react";
import BrandImageField from "../brand/BrandImageField";
import { ELEMENT_LIMITS } from "../../../../shared/templateElements.js";
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
 * Five doors: the poster's own parts, words of your own, photos, plain shapes and
 * the order things sit in. Each one opens over the canvas and shuts again as soon
 * as you click the poster, so the canvas is never squeezed by a permanent panel.
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
];

export default function EditorRail({ tab, onTab }) {
  return (
    <nav
      aria-label="What to add"
      className="flex w-16 shrink-0 flex-col items-stretch gap-1 border-r border-line bg-canvas py-2"
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
            className={`mx-2 flex flex-col items-center gap-1 rounded-btn py-2 text-[10px] font-semibold leading-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary ${
              active
                ? "bg-primary/10 text-primary"
                : "text-body hover:bg-section"
            }`}
          >
            <Icon className="h-4 w-4" />
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
      className={`flex items-center gap-1.5 rounded-btn border px-2 py-1.5 ${
        dropTarget || selected
          ? "border-primary bg-primary/5"
          : "border-line bg-canvas"
      } ${dropTarget ? "border-dashed" : ""}`}
    >
      {handle}
      <ModeChip item={item} />
      <button
        type="button"
        onClick={() => onSelect(item.id)}
        className="min-w-0 flex-1 truncate text-left text-xs font-semibold text-heading hover:text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
    className: "border-indigo-200 bg-indigo-50 text-indigo-700",
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
      className="w-full rounded-btn border border-dashed border-line bg-section px-3 py-2 text-left text-xs font-semibold text-heading hover:border-primary hover:bg-primary/5 disabled:cursor-not-allowed disabled:border-line disabled:text-muted-foreground disabled:hover:border-line disabled:hover:bg-section focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
function ColourRow({ label, value, fallback = "#0f172a", onPick, onCommit }) {
  const shown = hexOf(value);
  /* What is typed stays on screen while it is being typed, even when it is not a colour yet. */
  const [draft, setDraft] = useState(value || "");
  useEffect(() => {
    setDraft(value || "");
  }, [value]);
  const finish = () => {
    const raw = draft.trim();
    const next = raw === "" || /^#[0-9a-f]{6}$/i.test(raw) ? raw : value || "";
    setDraft(next);
    onCommit?.(next);
  };

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-body">{label}</span>
      <span className="flex items-center gap-1">
        <input
          type="color"
          aria-label={label}
          value={shown || fallback}
          onChange={(event) => onPick?.(event.target.value)}
          className="h-7 w-9 cursor-pointer rounded border border-line bg-canvas p-0.5"
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
          className="w-[74px] rounded border border-line px-1.5 py-1 text-[11px] font-mono"
        />
      </span>
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
        className="w-20 rounded border border-line px-1.5 py-1 text-xs tabular-nums"
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
        <div className="space-y-1.5 border-t border-line pt-3">
          <p className="text-xs font-semibold text-heading">On this poster</p>
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
          <p className="text-xs font-semibold text-heading">On this poster</p>
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
        <div className="space-y-3 border-t border-line pt-3">
          <p className="text-xs font-semibold text-heading">
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

function ShapesPanel({ items, selectedId, actions }) {
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
          <p className="text-xs font-semibold text-heading">On this poster</p>
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
        <div className="space-y-3 border-t border-line pt-3">
          <p className="text-xs font-semibold text-heading">This shape</p>
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
                onPick={(fill) => actions.setShape(chosen.id, { fill })}
                onCommit={(fill) => actions.setShape(chosen.id, { fill })}
              />
              <ColourRow
                label="Border colour"
                value={shape.stroke || ""}
                fallback="#0f172a"
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

export function EditorPanel({
  tab,
  items,
  selectedId,
  hiddenIds,
  brandKit,
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
      className="absolute bottom-0 left-0 top-0 z-[55] w-[300px] max-w-[86vw] overflow-y-auto border-r border-line bg-canvas p-4 shadow-xl"
      onPointerDown={(event) => event.stopPropagation()}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-heading">{title}</h2>
        <button
          type="button"
          aria-label="Close this panel"
          onClick={onClose}
          className="rounded p-1 text-muted-foreground hover:bg-section hover:text-heading focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
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
        <ShapesPanel items={items} selectedId={selectedId} actions={actions} />
      ) : null}
      {tab === "layers" ? (
        <LayersPanel
          items={items}
          selectedId={selectedId}
          hiddenIds={hiddenIds}
          actions={actions}
        />
      ) : null}
    </div>
  );
}
